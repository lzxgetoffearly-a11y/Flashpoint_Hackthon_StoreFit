# StoreFit — find the storefront, fit the store

Engineering & Product track · Flashpoint AI × CUB Hackathon (Nov 13–21, 2026)

StoreFit helps a first-time owner open a small cafe in New York. It ranks **real vacant storefronts** near Columbia using **live NYC open data**, explains every score with its source, and then runs a **layout agent** that fits a counter, queue and seats into the chosen space in 3D, checking aisles and overlaps.

> Status: prototype. Scores use public-data proxies (no foot-traffic counts or real rents). Floor sizes and rents are user inputs. See [SPEC.md](SPEC.md).

## What to try (for judges)
1. Open the app → **Start a search**. Cards load live data from NYC Open Data (takes a few seconds).
2. Click the top card: see each factor, its raw value and source link; competitors appear on the map.
3. **Fit a cafe in this space** → edit the request (e.g. `12 seats, mostly takeout`) → **Run layout agent**. Drag to orbit the 3D view.
4. **Research** shows how Flashpoint findings shaped each rule. **Report** prints a one-page summary.

## How we use Flashpoint AI
Flashpoint is our primary research tool. We used it to:
- answer the desk-research questions in [docs/RESEARCH.md](docs/RESEARCH.md) (problem, user, competitors, layout rules);
- run a survey with a **synthetic panel** (ConnectedSynth) and compare it with **real** respondents;
- turn findings into product decisions: score factors and weights (`src/lib/score.js`), layout clearances (`src/lib/layout.js`), and what we show users (sources on every line).
Evidence (screenshots / report links) is in [`/evidence`](evidence/). Findings are also shown in the app's Research page (`src/data/research.js`).

## Required write-up
- **Problem and audience:** _TODO — fill from research_
- **Use of Flashpoint (question + evidence):** _TODO_
- **Impact of decisions (changed / kept / ruled out):** _TODO_
- **Proposed solution:** live-data site shortlist + 3D layout agent (this repo).
- **Supporting evidence (what was actually tested vs simulated):** _TODO — label synthetic vs real_
- **Limitations and next steps:** proxies instead of foot-traffic counts; no rent data; floor size typed by user; layout rules need professional review; next: listing integration, floor-plan upload, interviews with owners.

## Run locally
Prerequisites: Node.js 18+ and npm.
```bash
npm install
npm run dev        # open the printed localhost URL
npm run build      # static build in dist/
```
Environment variables (optional — without them the agent uses its built-in rule parser):
```bash
cp .env.example .env
# VITE_LLM_BASE_URL, VITE_LLM_API_KEY, VITE_LLM_MODEL (any OpenAI-compatible endpoint)
```
Never commit `.env`. Note: `VITE_` variables are bundled into the client — use a throwaway key for demos only.

## Data sources
- [Storefronts Reported Vacant or Not](https://data.cityofnewyork.us/City-Government/Storefronts-Reported-Vacant-or-Not/92iy-9c3n) (NYC Local Law 157) — candidate list, reporting year 2025
- [DOHMH Restaurant Inspection Results](https://data.cityofnewyork.us/Health/DOHMH-New-York-City-Restaurant-Inspection-Results/43nn-pn8j) — competitors, food activity (live)
- [MTA Subway Stations](https://data.ny.gov/Transportation/MTA-Subway-Stations/39hk-dx4f) — transit access (live)
- Map tiles © OpenStreetMap contributors © CARTO

## Work during the event & disclosures
- All code, data wiring and research in this repo were done during Nov 13–21, 2026. _Add a short log here._
- 3D models: [KayKit Furniture Bits](https://github.com/KayKit-Game-Assets/KayKit-Furniture-Bits-1.0) and [Restaurant Bits](https://github.com/KayKit-Game-Assets/KayKit-Restaurant-Bits-1.0) by Kay Lousberg, CC0 (see `public/models/LICENSE-KayKit.txt`).
- Libraries: React, three.js, @react-three/fiber, drei, Leaflet, Vite (MIT/BSD).
- Visual style inspired by public startup landing pages; no assets copied.
- AI tools: Flashpoint AI (primary, research). Claude was used as a coding assistant for scaffolding this prototype.
