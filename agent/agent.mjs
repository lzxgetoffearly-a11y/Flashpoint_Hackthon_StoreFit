#!/usr/bin/env node
// StoreFit research agent.
// Give it one objective. It decides what to ask, builds and sends its own surveys through the
// Flashpoint MCP, reads the answers, decides whether to run a follow-up round, and ends by
// choosing, from what it learned, which of StoreFit's furnished 3D layouts fits the storefront.
//
//   node agent.mjs                       run with the default objective
//   node agent.mjs --objective "..."     run with your own objective
//   node agent.mjs --dry-run             rehearse with a simulated Flashpoint (no USDC, no emails)
//   node agent.mjs --resume runs/<id>    continue a run that was interrupted
//
// The model makes every research decision. This file only gives it tools, enforces the budget
// and round limits, and writes down everything that happens.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./env.mjs";
import { compareLayouts, listSites } from "./storefit.mjs";
import { buildReport } from "./report.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
loadEnv();

// ---------- settings ----------
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name, dflt) => { const i = argv.indexOf(`--${name}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt; };

const DEFAULT_OBJECTIVE = "Figure out what kind of cafe we should open in the vacant storefront at 2905 Broadway, next to Columbia University: who it should serve, what it should offer, and which layout to build.";
const DRY = flag("dry-run");
const resumeDir = opt("resume", null);
const PRICE = { survey: 0.5, demographics: 0.05 }; // USDC per call, as charged during the hackathon

let cfg, state, runDir;
if (resumeDir) {
  runDir = path.resolve(resumeDir);
  state = JSON.parse(fs.readFileSync(path.join(runDir, "state.json"), "utf8"));
  cfg = state.cfg;
} else {
  cfg = {
    objective: opt("objective", DEFAULT_OBJECTIVE),
    panel: opt("panel", "StoreFit testers"),
    emailsFile: opt("emails", null),
    site: opt("site", "bwy-2905"),
    budget: Number(opt("budget", "12")),
    maxRounds: Number(opt("max-rounds", "3")),
    model: opt("model", "claude-sonnet-5-5"),
    dryRun: DRY,
  };
  const id = (DRY ? "dryrun-" : "") + new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  runDir = path.join(here, "runs", id);
  fs.mkdirSync(runDir, { recursive: true });
  state = { cfg, id, startedAt: new Date().toISOString(), messages: [], spent: 0, receipts: [], rounds: {}, beliefs: [], layoutOptions: null, finished: null, turn: 0 };
}
const emails = cfg.emailsFile ? fs.readFileSync(cfg.emailsFile, "utf8").split(/[\s,;]+/).filter((e) => /@/.test(e)) : [];

if (!process.env.ANTHROPIC_API_KEY) { console.error("ANTHROPIC_API_KEY is missing. Put it in agent/.env (see agent/.env.example)."); process.exit(1); }

// ---------- logging ----------
const C = { dim: "\x1b[2m", bold: "\x1b[1m", cyan: "\x1b[36m", green: "\x1b[32m", yellow: "\x1b[33m", magenta: "\x1b[35m", red: "\x1b[31m", off: "\x1b[0m" };
const clock = () => new Date().toLocaleTimeString("en-US", { hour12: false });
function log(type, data) {
  fs.appendFileSync(path.join(runDir, "log.jsonl"), JSON.stringify({ t: new Date().toISOString(), type, ...data }) + "\n");
}
function say(color, label, text) {
  console.log(`${C.dim}${clock()}${C.off} ${color}${C.bold}${label}${C.off} ${text}`);
}
const save = () => fs.writeFileSync(path.join(runDir, "state.json"), JSON.stringify(state, null, 1));
const clip = (s, n = 600) => (s.length > n ? s.slice(0, n) + ` … (+${s.length - n} chars, full text in log.jsonl)` : s);

// ---------- Flashpoint MCP (real or simulated) ----------
let fp = null;
async function flashpoint(tool, args) {
  if (cfg.dryRun) return (await import("./simulator.mjs")).simulate(tool, args, state);
  fp ??= await import("./flashpoint.mjs");
  const before = fp.receipts.length;
  const h = await fp.connect(); // sessions last 1 hour and calls can be hours apart, so sign in each time
  const out = await fp.callTool(h, tool, args);
  const paid = fp.receipts.slice(before);
  state.receipts.push(...paid.map((url) => ({ tool, url, t: new Date().toISOString() })));
  return out;
}
function charge(kind) {
  if (state.spent + PRICE[kind] > cfg.budget + 1e-9) {
    throw new Error(`Budget guard: this call costs $${PRICE[kind].toFixed(2)} and would pass the $${cfg.budget} budget (spent so far $${state.spent.toFixed(2)}). Do not retry. Finish with the evidence you have.`);
  }
}

// ---------- tools the model can use ----------
const TOOLS = [
  {
    name: "flashpoint_demographics",
    description: `Flashpoint MCP tool "demographics" ($${PRICE.demographics} per call). Census-style data for a location: population, age, race, gender, education and household income, plus AI commentary. Check what area the returned numbers actually cover before relying on them.`,
    input_schema: { type: "object", properties: { note: { type: "string", description: "One or two sentences for the run log: what this step is for." }, location: { type: "string" }, question: { type: "string", description: "Optional specific question about the area." } }, required: ["note", "location"] },
  },
  {
    name: "flashpoint_survey",
    description: `Flashpoint MCP tool "tool_survey" ($${PRICE.survey} per call, including confirmations and result pulls; each call takes 1 to 10 minutes). You write a natural-language brief; Flashpoint's survey agent does the work and replies in text. It can design surveys (single / multi choice, grids, ranking, MaxDiff, conjoint, sliders, open ends, AI-moderated interview questions), add skip and display logic and piping, run a survey check, publish, email a first-party panel, send reminders, and analyse results (frequencies, crosstabs, open-end themes). It will NOT publish or send on the first ask: it replies asking for confirmation, and you confirm by calling again with the same round number and a brief such as "confirm publish". All calls with the same round number continue the same survey; a new round number starts a new survey.`,
    input_schema: { type: "object", properties: { note: { type: "string", description: "One or two sentences for the run log: what this step is for." }, round: { type: "integer", description: "1 for the first survey, 2 for the follow-up survey, and so on." }, brief: { type: "string" } }, required: ["note", "round", "brief"] },
  },
  {
    name: "wait_for_responses",
    description: "Pause while people answer. Free. The respondents are teammates who were told to answer quickly, so short waits are fine at first; the operator can also press Enter in the terminal to end the wait early once people have answered. Checking results afterwards costs a flashpoint_survey call, so do not poll more often than is useful: if a check shows few or no answers, wait longer before the next one. Maximum 240 minutes per call.",
    input_schema: { type: "object", properties: { minutes: { type: "number" }, reason: { type: "string" } }, required: ["minutes", "reason"] },
  },
  {
    name: "update_beliefs",
    description: "Your research notebook, kept outside your memory and shown in the final report. Call it at the start with your initial hypotheses, and again every time evidence changes them. Send the full current list each time.",
    input_schema: {
      type: "object",
      properties: {
        hypotheses: { type: "array", items: { type: "object", properties: {
          id: { type: "string", description: "Short stable id such as H1." },
          statement: { type: "string" },
          confidence: { type: "number", description: "0 to 1. How sure you are that the statement is true." },
          evidence: { type: "string", description: "What this confidence rests on. Say 'prior, no data yet' when it is a guess." },
        }, required: ["id", "statement", "confidence", "evidence"] } },
        what_changed: { type: "string", description: "What you learned since the last update and what you will do next because of it." },
      },
      required: ["hypotheses", "what_changed"],
    },
  },
  {
    name: "storefit_compare_layouts",
    description: "StoreFit's own layout planner (free, instant, no inputs). Returns the three furnished layouts StoreFit's Fit Lab has for this storefront: seats, service style, features (window bar, banquette, sofa lounge), which accessibility and egress checks pass or fail, and a furniture list-price estimate. Use it to see what the space can actually hold, and to choose the layout your findings support.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "finish",
    description: "End the run with your final recommendation. Only call this after storefit_compare_layouts.",
    input_schema: { type: "object", properties: {
      concept: { type: "string", description: "The recommended cafe in one sentence." },
      recommendation: { type: "string", description: "Markdown. The answer to the objective: who it serves, what it offers, how the space is laid out, and the evidence for each point with counts (e.g. '4 of 5')." },
      layout: { type: "string", description: "The id of the StoreFit layout you recommend, from storefit_compare_layouts." },
      layout_reason: { type: "string", description: "Which findings point to this layout over the other two, and any trade-off (for example a failed check) the owner should know about." },
      caveats: { type: "array", items: { type: "string" }, description: "Honest limits: sample size, who answered, what was not measured." },
      next_steps: { type: "array", items: { type: "string" } },
    }, required: ["concept", "recommendation", "layout", "layout_reason", "caveats"] },
  },
];

let skipWait = null;
// Without a terminal (background run), `kill -USR1 <pid>` ends the current wait the same way Enter does.
process.on("SIGUSR1", () => { if (skipWait) skipWait(); });
fs.writeFileSync(path.join(runDir, "pid"), String(process.pid));
if (process.stdin.isTTY) {
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", () => { if (skipWait) skipWait(); });
  process.stdin.unref?.();
}

async function runTool(name, input) {
  if (name === "flashpoint_demographics") {
    charge("demographics");
    const out = await flashpoint("demographics", { location: input.location, ...(input.question ? { question: input.question } : {}) });
    state.spent += PRICE.demographics;
    const r = out?.result ?? out;
    // Keep what a researcher needs; the raw reply repeats itself and is saved in full in the log.
    return { costUSD: PRICE.demographics, areaQueried: r?.demographics?.location, source: r?.demographics?.metadata, data: r?.demographics ? { age: r.demographics.age, education: r.demographics.education, income: r.demographics.income, gender: r.demographics.gender, race: r.demographics.race } : r, commentary: (r?.aiInsights?.insightsList ?? []).map((i) => i.insight) };
  }
  if (name === "flashpoint_survey") {
    const round = String(input.round);
    if (input.round < 1 || input.round > cfg.maxRounds) throw new Error(`Round guard: rounds 1 to ${cfg.maxRounds} are allowed in this run.`);
    charge("survey");
    const ctx = (state.rounds[round] ??= { briefs: [] });
    const args = { brief: input.brief, ...(ctx.conversation_id ? { conversation_id: ctx.conversation_id } : {}), ...(ctx.survey_id ? { survey_id: ctx.survey_id } : {}) };
    const out = await flashpoint("tool_survey", args);
    state.spent += PRICE.survey;
    ctx.conversation_id = out?.conversation_id ?? out?.result?.conversation_id ?? ctx.conversation_id;
    ctx.survey_id = out?.result?.survey_id ?? ctx.survey_id;
    ctx.briefs.push(input.brief);
    state.lastSurveyAt = new Date().toISOString();
    if (out?.error || out?.status === "failed") throw new Error(`Flashpoint reported an error: ${JSON.stringify(out.error ?? out).slice(0, 800)}`);
    return { costUSD: PRICE.survey, spentSoFarUSD: +state.spent.toFixed(2), budgetUSD: cfg.budget, survey_id: ctx.survey_id ?? null, reply: out?.result?.final_text ?? (typeof out === "string" ? out : JSON.stringify(out)) };
  }
  if (name === "wait_for_responses") {
    const minutes = Math.min(240, Math.max(1, Number(input.minutes) || 10));
    const ms = cfg.dryRun ? 1500 : minutes * 60_000;
    state.lastWaitMinutes = (state.lastWaitMinutes ?? 0) + minutes;
    if (!cfg.dryRun) console.log(`${C.dim}         waiting ${minutes} min — press Enter to continue now${C.off}`);
    const t0 = Date.now();
    await new Promise((res) => { const timer = setTimeout(res, ms); skipWait = () => { clearTimeout(timer); res(); }; });
    skipWait = null;
    const waited = cfg.dryRun ? minutes : Math.round((Date.now() - t0) / 60_000);
    return { waitedMinutes: waited, endedEarlyByOperator: !cfg.dryRun && waited < minutes - 1, now: new Date().toISOString() };
  }
  if (name === "update_beliefs") {
    state.beliefs.push({ t: new Date().toISOString(), hypotheses: input.hypotheses, what_changed: input.what_changed });
    return { saved: true, version: state.beliefs.length };
  }
  if (name === "storefit_compare_layouts") {
    const { scene, summary } = await compareLayouts(cfg.site);
    state.layoutOptions = summary;
    fs.writeFileSync(path.join(runDir, "storefit-scene.json"), JSON.stringify(scene, null, 1));
    return summary;
  }
  if (name === "finish") {
    if (!state.layoutOptions) throw new Error("Call storefit_compare_layouts first, so the recommendation comes with a checked layout.");
    if (state.lastSurveyAt && (state.beliefs.at(-1)?.t ?? "") < state.lastSurveyAt) throw new Error("Update your notebook (update_beliefs) with what the latest results changed, then call finish again.");
    if (!state.layoutOptions.options.some((o) => o.id === input.layout)) throw new Error(`"layout" must be one of: ${state.layoutOptions.options.map((o) => o.id).join(", ")}`);
    state.finished = { t: new Date().toISOString(), ...input };
    return { done: true };
  }
  throw new Error(`Unknown tool ${name}`);
}

// ---------- the model ----------
function systemPrompt(sites) {
  const site = sites.find((s) => s.id === cfg.site);
  const who = emails.length
    ? `this email list, and nobody else: ${emails.join(", ")}. Ask Flashpoint to create (or reuse) a first-party panel from exactly these addresses`
    : `the existing first-party panel named "${cfg.panel}" in the team's Flashpoint library (about 7 people who agreed to take part), and nobody else`;
  return `You are the StoreFit research agent. You are given one objective and you run the research yourself, start to finish, without a human directing the steps. Nobody will answer questions during the run, so decide and act.

# What you have
- The Flashpoint MCP, for research with real people: flashpoint_demographics and flashpoint_survey.
- StoreFit's layout planner (storefit_compare_layouts), which holds three furnished, code-checked floor plans of the real storefront. They differ in seat count, service style (takeout / dine-in / balanced) and features such as a window bar, a wall banquette and a sofa lounge. Your research should end by telling the owner which of them to build, so find out early what the options are and aim your questions at whatever would separate them.
- A notebook (update_beliefs) and a pause (wait_for_responses).

# The storefront
${site ? `${site.address}, New York (site id ${site.id}). Previous use: ${site.previousUse}. Estimated unit: ${site.estimatedRoomFt.wFt} ft wide by ${site.estimatedRoomFt.dFt} ft deep, an estimate from city lot data.` : cfg.site}

# How to work
1. Start by writing down what you would need to know to answer the objective, as hypotheses with honest confidence levels (update_beliefs). Most will be guesses at this point; say so.
2. Design each survey to test the hypotheses you are least sure about and that matter most for the decision. A survey is worth sending only if some answer to it would change what you recommend. Surveys are good at telling you what people want, do and would pay; they cannot tell you facts about the building or the market, so do not ask for those.
3. Think about who is answering. Different respondents (students, staff, residents, people who would never go) should get different questions; use skip and display logic for that instead of making everyone answer everything. Keep a survey short enough to finish in about three minutes. You choose the question types; pick the one that gives the most decisive evidence for each hypothesis, and tell Flashpoint exactly what you want, including the logic.
4. Send only to ${who}. The email should say it comes from team KFCv50 (StoreFit), that it takes about three minutes, and that it is a research survey for a student hackathon project.
5. After results come in, update your beliefs first. Then decide: is a follow-up round worth its cost? Run one when the first round left something decision-relevant unresolved or surprised you, and make the follow-up questions build on what people actually said, quoting or naming their answers where useful. Stop when another round would not change the recommendation, when you reach ${cfg.maxRounds} rounds, or when the budget runs out.
6. Choose the StoreFit layout your findings support. Say which findings point to it, and be plain about any trade-off, such as a layout people would like that fails a code check.
7. Call finish with the recommendation.

# Rules
- Budget: $${cfg.budget} in USDC for the whole run. Every flashpoint_survey call costs $${PRICE.survey}, including confirmations and result pulls, so put as much as you sensibly can into each brief (for example: build the whole survey, run the survey check and report back in one call). The code stops you at the limit.
- Flashpoint asks for confirmation before publishing and before sending. You are authorised to confirm, provided the recipients are exactly the ones named above. If Flashpoint proposes to send to anyone else, or to use paid or synthetic respondents, refuse and correct it.
- Real first-party respondents only. Do not use synthetic panels or paid recruitment.
- Be honest about evidence. The sample is tiny. Report counts ("3 of 5"), never bare percentages, and never describe a guess as a finding. If a data source turns out to be coarser or less reliable than expected, say so in your notebook and do not lean on it.
- Every Flashpoint call takes a short "note" for the run log: one or two sentences on what the step is for. Keep other commentary brief.${cfg.dryRun ? `

# Rehearsal
This run is a rehearsal of the software. Flashpoint is replaced by a stand-in that returns fixed test data marked [SIMULATED TEST DATA]. Work through the whole process as you would with real answers, so every step is exercised. The report is stamped as a rehearsal automatically.` : ""}`;
}

async function callModel(system) {
  for (let attempt = 0; ; attempt++) {
    let res, body;
    try {
      res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: cfg.model, max_tokens: 20000, system, tools: TOOLS, messages: state.messages }),
      });
      body = await res.json();
    } catch (e) { body = { error: { message: String(e) } }; }
    if (res?.ok && body.stop_reason !== "refusal") return body;
    if (res?.ok) { res = { status: 529 }; body = { error: { message: `the model declined this turn (${body.stop_details?.category ?? "refusal"})` } }; if (attempt >= 2) throw new Error(body.error.message); }
    const retry = !res || [408, 409, 429, 500, 502, 503, 504, 529].includes(res.status);
    if (!retry || attempt >= 6) throw new Error(`Anthropic API error ${res?.status ?? ""}: ${body?.error?.message ?? JSON.stringify(body)}`);
    const waitS = Math.min(120, 5 * 2 ** attempt);
    say(C.yellow, "retry", `model call failed (${res?.status ?? "network"}), trying again in ${waitS}s`);
    await new Promise((r) => setTimeout(r, waitS * 1000));
  }
}

function show(name, input) {
  if (name === "flashpoint_survey") return `round ${input.round}\n           ${C.cyan}${input.note ?? ""}${C.off}\n           ${C.dim}brief:${C.off} ${clip(input.brief, 600)}`;
  if (name === "flashpoint_demographics") return `${input.location}\n           ${C.cyan}${input.note ?? ""}${C.off}`;
  if (name === "wait_for_responses") return `${input.minutes} min — ${input.reason}`;
  if (name === "storefit_compare_layouts") return "";
  if (name === "update_beliefs") return "\n" + input.hypotheses.map((h) => `           ${h.id} ${String(Math.round(h.confidence * 100)).padStart(3)}%  ${h.statement}`).join("\n") + `\n           ${C.dim}${clip(input.what_changed, 400)}${C.off}`;
  if (name === "finish") return input.concept;
  return clip(JSON.stringify(input), 400);
}

async function main() {
  const sites = await listSites();
  const system = systemPrompt(sites);
  console.log(`\n${C.bold}StoreFit research agent${C.off}${cfg.dryRun ? `  ${C.yellow}[DRY RUN: Flashpoint is simulated, nothing is sent or paid]${C.off}` : ""}`);
  console.log(`${C.bold}Objective:${C.off} ${cfg.objective}`);
  console.log(`${C.dim}model ${cfg.model} · budget $${cfg.budget} · up to ${cfg.maxRounds} rounds · recipients: ${emails.length ? emails.length + " emails" : `panel "${cfg.panel}"`} · log: ${path.relative(process.cwd(), runDir)}${C.off}\n`);

  if (!state.messages.length) {
    if (!cfg.dryRun) {
      try { fp = await import("./flashpoint.mjs"); state.balanceStart = await fp.balance(); say(C.dim, "wallet", `${state.balanceStart} USDC before the run`); } catch (e) { say(C.yellow, "wallet", `could not read balance (${e.message})`); }
    }
    log("start", { cfg: { ...cfg }, system });
    state.messages.push({ role: "user", content: `Objective: ${cfg.objective}\n\nBegin.` });
  } else {
    say(C.yellow, "resume", `continuing run ${state.id} at turn ${state.turn}`);
    // If the run stopped while a tool was running, run those tool calls again.
    const last = state.messages.at(-1);
    if (last.role === "assistant") await answerTools(last.content);
  }
  save();

  while (!state.finished && state.turn < 80) {
    state.turn += 1;
    const msg = await callModel(system);
    state.messages.push({ role: "assistant", content: msg.content });
    for (const b of msg.content) if (b.type === "text" && b.text.trim()) { say(C.cyan, "think  ", b.text.trim()); log("reasoning", { turn: state.turn, text: b.text.trim() }); }
    save();
    const used = await answerTools(msg.content);
    if (!used) state.messages.push({ role: "user", content: "Nobody is available to reply. Continue with a tool call, or call finish if you are done." });
    save();
  }

  if (!cfg.dryRun && fp) { try { state.balanceEnd = await fp.balance(); } catch {} }
  save();
  log("end", { spent: state.spent, receipts: state.receipts, finished: state.finished });
  const report = buildReport(state, runDir);
  fs.writeFileSync(path.join(runDir, "REPORT.md"), report);
  console.log(`\n${C.green}${C.bold}Done.${C.off} ${state.finished ? state.finished.concept : "Stopped at the turn limit without a recommendation."}`);
  const chosen = state.finished && state.layoutOptions?.options.find((o) => o.id === state.finished.layout);
  if (chosen) console.log(`${C.bold}StoreFit layout chosen:${C.off} ${chosen.nameInApp} (${chosen.seatsPlaced} seats). ${state.layoutOptions.howToView}`);
  console.log(`${C.bold}Report:${C.off} ${path.relative(process.cwd(), path.join(runDir, "REPORT.md"))}   ${C.dim}spent $${state.spent.toFixed(2)} of $${cfg.budget}${C.off}\n`);
  process.exit(0);
}

async function answerTools(content) {
  const calls = content.filter((b) => b.type === "tool_use");
  if (!calls.length) return false;
  const results = [];
  for (const c of calls) {
    say(C.magenta, "act    ", `${c.name}  ${show(c.name, c.input)}`);
    log("tool_call", { turn: state.turn, name: c.name, input: c.input });
    let out, isError = false;
    const t0 = Date.now();
    try { out = await runTool(c.name, c.input); } catch (e) { out = { error: e.message }; isError = true; }
    const text = typeof out === "string" ? out : JSON.stringify(out);
    log("tool_result", { turn: state.turn, name: c.name, seconds: Math.round((Date.now() - t0) / 1000), isError, spent: +state.spent.toFixed(2), output: out });
    const shown = c.name === "storefit_compare_layouts" && !isError
      ? `${out.site}, ${out.room}` + out.options.map((o) => `\n           ${o.nameInApp.padEnd(12)} ${String(o.seatsPlaced).padStart(2)} seats · ${o.serviceStyle.padEnd(8)} · ${o.features.join(", ")} · checks ${o.checks.works} ok / ${o.checks.tight} tight / ${o.checks.fails} fail`).join("")
      : c.name === "flashpoint_demographics" && !isError ? `area covered: ${JSON.stringify(out.areaQueried)} · population ${out.data?.age?.totalPopulation ?? "?"} · source ${out.source?.source ?? "?"} ${out.source?.year ?? ""}`
      : clip(out?.reply ?? text, 900);
    say(isError ? C.red : C.green, isError ? "error  " : "result ", shown + (c.name.startsWith("flashpoint") ? `  ${C.dim}[spent $${state.spent.toFixed(2)}]${C.off}` : ""));
    results.push({ type: "tool_result", tool_use_id: c.id, content: text, ...(isError ? { is_error: true } : {}) });
    save();
  }
  state.messages.push({ role: "user", content: results });
  return true;
}

main().catch((e) => { save(); log("crash", { message: e.message }); console.error(`\n${C.red}Stopped: ${e.message}${C.off}\nNothing is lost. Continue with:  node agent.mjs --resume ${path.relative(process.cwd(), runDir)}\n`); process.exit(1); });
