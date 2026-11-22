// Rehearsal stand-in for the Flashpoint MCP, used only with --dry-run, to exercise the agent's
// code paths (build → confirm → send → wait → results → follow-up round) without spending USDC
// or emailing anyone. The "answers" below are fixed test data written by hand, not research.
// Dry-run output goes to runs/dryrun-* (git-ignored) and its report is stamped DRY RUN.
const TAG = "[SIMULATED TEST DATA]";

const RESULTS = [
  `${TAG} Completes: 5 of 7 invited.
Who answered: 2 undergraduates, 1 graduate student, 1 university staff member, 1 neighbourhood resident.
What they usually do at a cafe near campus: stay 1+ hour to study or work 3 of 5; sit 20 to 60 minutes 1 of 5; grab and leave 1 of 5.
Layout or cafe type they would visit most: the larger, mostly sit-down one 3 of 5; the mid-size mixed one 1 of 5; the small grab-and-go one 1 of 5.
Seating features ranked first: tables big enough for a laptop 3 of 5; window bar 1 of 5; sofa corner 1 of 5.
Typical spend per visit: $5 to $8 for 4 of 5; over $8 for 1 of 5.
Open answers: "Outlets and a table that fits a laptop, otherwise I go to the library." / "The line has to move between classes or I skip it." / "Sofas get taken by one person for three hours."
Any other question in the survey: answers were split with no clear majority.`,
  `${TAG} Completes: 5 of 7 invited (the same five people as the first survey).
On the main follow-up question: 4 of 5 chose the option that favours more seats over comfort; 1 of 5 chose the opposite.
On a time limit or minimum spend at busy hours: 3 of 5 said they would still come; 2 of 5 said they would come less.
On ordering ahead for pickup: 4 of 5 would use it at least weekly.
Open answers: "More seats beats a nicer seat." / "A two-hour limit at lunch is fair." / "If I can order ahead I don't care how big the queue area is."
Any other question in the survey: answers were split with no clear majority.`,
];

export async function simulate(tool, args, state) {
  if (tool === "demographics") {
    // Shape and figures copied from a real call for 2905 Broadway on 2026-11-21 (it answers for the whole county).
    return { status: "completed", result: { demographics: {
      location: { query: "county:061&in=state:36" },
      age: { under18: 235675, age18to24: 142562, age25to34: 349474, age35to44: 240769, age45to54: 202453, age55to64: 190678, age65to74: 154876, age75andOver: 129380, medianAge: 38.5, totalPopulation: 1645867 },
      education: { totalPopulation25AndOver: 1267630, bachelorsDegree: 410095, graduateDegree: 385349 },
      income: { totalHouseholds: 772601, medianHouseholdIncome: 99880 },
      gender: { male: 788264, female: 857603 }, race: {},
      metadata: { source: "US Census Bureau", year: "2022", surveyType: "ACS 5-Year Estimates" } },
      aiInsights: { insightsList: [{ insight: "About 65% of residents 25 and over hold a bachelor's degree or higher." }] } } };
  }
  state.sim ??= {};
  const key = args.conversation_id ?? `sim-${Object.keys(state.sim).length + 1}`;
  const n = Object.keys(state.sim).length + (state.sim[key] ? 0 : 1); // 1 for the first survey, 2 for the second
  const s = (state.sim[key] ??= { stage: "new", n });
  const brief = args.brief.toLowerCase();
  let text;
  if (s.stage === "new") {
    s.stage = "built";
    text = `${TAG} Survey built as specified, including the skip and display logic you described. Survey check: 0 blockers, 0 errors, 0 warnings. Estimated length about 3 minutes. Nothing is live yet. Reply "confirm publish" and I will publish it.`;
  } else if (s.stage === "built" && /confirm/.test(brief)) {
    s.stage = "published";
    text = `${TAG} Published. The survey is live at https://flashpointopinions.com/SIMULATED. Sending email needs its own confirmation: reply "confirm send" and I will send invitations to the 7 members of the first-party panel, each with a unique link.`;
  } else if (s.stage === "published" && /confirm/.test(brief)) {
    s.stage = "sent"; state.lastWaitMinutes = 0;
    text = `${TAG} Invitations sent: 7, all to the first-party panel, 0 suppressed. No paid or synthetic respondents were used.`;
  } else if (s.stage === "sent") {
    text = (state.lastWaitMinutes ?? 0) < 5 ? `${TAG} Completes: 0 of 7 invited so far.` : RESULTS[Math.min(s.n, RESULTS.length) - 1];
  } else {
    text = `${TAG} I need a confirmation before the next step. Reply "confirm" to continue.`;
  }
  return { conversation_id: key, status: "completed", result: { conversation_id: key, survey_id: `SIMULATED-${s.n}`, final_text: text } };
}
