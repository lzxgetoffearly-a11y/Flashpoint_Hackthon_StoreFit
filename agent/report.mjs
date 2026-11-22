// Builds REPORT.md for a run from its saved state: what the agent decided and why, in order.
import fs from "node:fs";
import path from "node:path";

const pct = (c) => `${Math.round(c * 100)}%`;
const quote = (s) => s.trim().split("\n").map((l) => `> ${l}`).join("\n");
const cell = (s) => String(s).replace(/\|/g, "/").replace(/\n/g, " ");

export function buildReport(state, runDir) {
  const { cfg } = state;
  const events = fs.readFileSync(path.join(runDir, "log.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
  const out = [];
  out.push(`# Agent run ${state.id}`, "");
  if (cfg.dryRun) out.push("> **DRY RUN.** Flashpoint was replaced by a stand-in. No survey was sent, nobody answered, and every \"result\" below is fixed test data. This file is a rehearsal of the code path, not research.", "");
  out.push(`**Objective given to the agent:** ${cfg.objective}`, "");
  out.push(`- Started ${state.startedAt}${state.finished ? `, finished ${state.finished.t}` : ", not finished"}`);
  out.push(`- Model: \`${cfg.model}\` · budget $${cfg.budget} · round limit ${cfg.maxRounds} · recipients: ${cfg.emailsFile ? "email list supplied at launch" : `first-party panel "${cfg.panel}"`}`);
  out.push(`- Flashpoint spend: $${state.spent.toFixed(2)} over ${events.filter((e) => e.type === "tool_call" && e.name.startsWith("flashpoint")).length} MCP calls${state.balanceStart != null && state.balanceEnd != null ? ` (wallet ${state.balanceStart} → ${state.balanceEnd} USDC)` : ""}`);
  out.push(`- Survey rounds run: ${Object.keys(state.rounds).length}`, ...Object.entries(state.rounds).filter(([, c]) => c.survey_id).map(([r, c]) => `  - Round ${r}: survey \`${c.survey_id}\``), "");

  const f = state.finished;
  if (f) {
    out.push("## Final recommendation", "", `**${f.concept}**`, "", f.recommendation, "");
    const chosen = state.layoutOptions?.options.find((o) => o.id === f.layout);
    if (chosen) {
      out.push("### The layout it chose in StoreFit", "",
        `**${chosen.nameInApp}** for ${state.layoutOptions.site} (${state.layoutOptions.room}).`, "",
        `- Why this one: ${f.layout_reason}`,
        `- ${chosen.seatsPlaced} seats, ${chosen.serviceStyle}; ${chosen.features.join(", ")}`,
        `- Code checks: ${chosen.checks.works} work, ${chosen.checks.tight} tight, ${chosen.checks.fails} fail, ${chosen.checks.needsMeasuring} need measuring on site${chosen.notPassing.length ? ` (${chosen.notPassing.join("; ")})` : ""}`,
        `- Furniture and equipment list-price estimate: $${chosen.furnitureListPriceUSD.toLocaleString("en-US")} (${chosen.itemsWithoutPrice} items have no captured price)`,
        `- To see it in 3D: ${state.layoutOptions.howToView.replace("choose the layout by name", `choose **${chosen.nameInApp}**`)}`, "");
    }
    if (f.caveats?.length) out.push("### Limits of this evidence", "", ...f.caveats.map((c) => `- ${c}`), "");
    if (f.next_steps?.length) out.push("### Next steps", "", ...f.next_steps.map((c) => `- ${c}`), "");
  }
  if (state.beliefs.length) {
    out.push("## How its beliefs changed", "");
    state.beliefs.forEach((b, i) => {
      out.push(`### Notebook v${i + 1} (${b.t.slice(11, 19)} UTC)`, "", b.what_changed, "", "| | Hypothesis | Confidence | Based on |", "|---|---|---|---|",
        ...b.hypotheses.map((h) => `| ${h.id} | ${cell(h.statement)} | ${pct(h.confidence)} | ${cell(h.evidence)} |`), "");
    });
  }
  out.push("## Run log: every decision and action, in order", "", "Times are UTC.", "");
  for (const e of events) {
    const t = e.t.slice(11, 19);
    if (e.type === "reasoning") out.push(`**${t} · agent**`, "", quote(e.text), "");
    if (e.type === "tool_call") {
      if (e.name === "flashpoint_survey") out.push(`**${t} · Flashpoint \`tool_survey\`, round ${e.input.round}.** ${e.input.note ?? ""}`, "", "Brief the agent wrote:", "", quote(e.input.brief), "");
      else if (e.name === "update_beliefs") out.push(`**${t} · notebook updated** (${e.input.hypotheses.length} hypotheses)`, "");
      else if (e.name === "finish") out.push(`**${t} · finish**`, "");
      else out.push(`**${t} · \`${e.name}\`** \`${JSON.stringify(e.input)}\``, "");
    }
    if (e.type === "tool_result" && e.name !== "update_beliefs" && e.name !== "finish") {
      const o = e.output;
      const body = o?.reply ?? o?.error ?? JSON.stringify(o, null, 1);
      out.push(`<details><summary>${e.isError ? "Error" : "Result"} (${e.seconds}s, spend so far $${e.spent.toFixed(2)})</summary>`, "", o?.reply ? body : "```json\n" + body + "\n```", "", "</details>", "");
    }
  }
  if (state.receipts.length) out.push("## Payment receipts (USDC on Base)", "", ...state.receipts.map((r) => `- ${r.t.slice(11, 19)} \`${r.tool}\` ${r.url}`), "");
  return out.join("\n");
}
