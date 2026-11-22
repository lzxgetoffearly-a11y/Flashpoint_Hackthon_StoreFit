# StoreFit research agent (Flashpoint MCP Challenge)

Give the agent one objective. It plans the research, builds and sends its own surveys through the
Flashpoint MCP, reads the answers, decides whether a follow-up round is worth it, and ends by
choosing which StoreFit layout to build in the real storefront.

## Run it

Needs Node 20 or newer.

```bash
cd agent
npm install
cp .env.example .env      # then fill in the two keys; .env is git-ignored
node agent.mjs            # default objective, panel "StoreFit testers"
```

Options:

| Flag | Default | Meaning |
|---|---|---|
| `--objective "..."` | the cafe question for 2905 Broadway | The one thing you tell the agent |
| `--panel "name"` | `StoreFit testers` | First-party panel in your Flashpoint library to send to |
| `--emails file.txt` | none | Send to this list of addresses instead of a named panel |
| `--budget 12` | 12 | USDC limit for the run; the code refuses calls past it |
| `--max-rounds 3` | 3 | Most survey rounds allowed |
| `--test-respondents` | off | Say that the team itself answers the surveys in test personas (demo conditions); stamped on the report |
| `--dry-run` | off | Rehearse with a stand-in for Flashpoint: no emails, no USDC, fixed test answers |
| `--resume runs/<id>` | | Continue an interrupted run from its saved state |

While the agent waits for answers, press Enter to make it check now.
On a Mac, `caffeinate -i node agent.mjs` keeps the laptop awake for a long run.

Each run writes `runs/<id>/`: `log.jsonl` (every decision, call and result), `state.json`,
`storefit-scene.json` (the layouts it compared) and `REPORT.md` (the readable account).
