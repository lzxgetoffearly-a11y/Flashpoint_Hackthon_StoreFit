# StoreFit — find the storefront, fit the store

Engineering & Product track · Flashpoint AI × CUB Hackathon (Nov 13–21, 2026)

StoreFit helps a first-time owner open a small cafe in New York. It ranks **real vacant storefronts** near Columbia using **live NYC open data**, explains every score with its source, and then runs a **layout agent** that fits a counter, queue and seats into the chosen space in 3D, checking aisles and overlaps.

> Status: prototype. Scores use public-data proxies (no foot-traffic counts or real rents). Floor sizes and rents are user inputs. See [SPEC.md](SPEC.md).

**Live demo:** https://lzxgetoffearly-a11y.github.io/flashpoint-hackthon/ (built from `main`, served from the `gh-pages` branch)

## What to try (for judges)
1. Open the app → **Start a search**. Cards load live data from NYC Open Data (takes a few seconds).
2. Click the top card: see each factor, its raw value and source link; competitors appear on the map.
3. **Fit a cafe in this space** opens the **Fit Lab** (form modeled on Obia's Fit Lab case-study viewer; all code is ours).
   - One scene object drives the panel and the 3D view (`src/lib/scene.js`; download it from "How the agent built this"). Every number carries a range, a method and a source.
   - Verdicts use the whole range: **Works** if the worst end passes, **Tight** if the range crosses the rule, **Fails** if the best end fails, **Needs measuring** if nobody measured it (ceiling height).
   - Open a check and drag its slider: the wall (or the chairs) moves inside its margin and the clearance updates live.
   - Switch between 3 layouts (Your brief / Grab-and-go / Max seating). "Change the brief or the room size" reruns the agent.
   - Dock: Overview (block massing built from LiDAR), Top (orthographic), Street, Inside, Walk in; Dimensions, Zones, Block, LiDAR, Dark. Compass top right.
   - Click any furniture for a product card; "Furniture and equipment" lists everything with product links and list prices.
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
# VITE_GOOGLE_MAPS_KEY (optional): Google Maps Platform key with the Map Tiles API enabled.
#   Turns on the "Google 3D" toggle in the Fit Lab. Restrict the key to your site by HTTP referrer.
```
Never commit `.env`. Note: `VITE_` variables are bundled into the client — use a throwaway key for demos only.

## Data sources
- [Storefronts Reported Vacant or Not](https://data.cityofnewyork.us/City-Government/Storefronts-Reported-Vacant-or-Not/92iy-9c3n) (NYC Local Law 157) — candidate list, reporting year 2025
- [DOHMH Restaurant Inspection Results](https://data.cityofnewyork.us/Health/DOHMH-New-York-City-Restaurant-Inspection-Results/43nn-pn8j) — competitors, food activity (live)
- [MTA Subway Stations](https://data.ny.gov/Transportation/MTA-Subway-Stations/39hk-dx4f) — transit access (live)
- Offline fallback: `src/data/snapshot.json` holds the same queries' results captured 2026-11-21 06:42 UTC; the UI labels it "snapshot" whenever it is used.
- [USGS 3DEP LiDAR, NY_NewYorkCity (2017)](https://registry.opendata.aws/usgs-lidar/) — public domain, Entwine Point Tiles on AWS Open Data. `scripts/lidar_export.py` cuts a 200 m square around each candidate into `public/lidar/*.bin` (int16 decimetres). Shop orientation is detected from the points (nearest street face) and is approximate.
- Fit-check rules: ADA 2010 Standards §403.5.1, §404.2.4.1, §307.4, §902; IBC / NYC Building Code Tables 1004.5 and 1006.2.1.
- Map tiles © OpenStreetMap contributors; satellite imagery © Esri, Maxar, Earthstar Geographics. Street view is Google's public embed.
- Product links and list prices: read from ikea.com and webstaurantstore.com search results on 2026-11-21 (`src/data/products.js`). Only the sofa and pendant are the exact modeled products (Wayfair); the rest are labeled "similar product".

Added in the last round:

- **NYC PLUTO** (`64uk-42ks`): building frontage, depth and ground-floor retail area for each lot. The Fit Lab divides the lot's retail area by the number of storefronts reported on that lot to estimate the unit's size. This is an estimate, labelled as such, with a ±0.6 m range on each wall; the user can type measured dimensions instead.
- **MTA Subway Hourly Ridership** (`5wq4-mkjj`, data.ny.gov): entries per day at the nearest station, averaged over the week of Oct 5–11, 2026. It is half of the subway factor; the other half is walking distance.
- **Google Photorealistic 3D Tiles** (Map Tiles API, needs a key): the real block around the storefront, shown with the "Google 3D" toggle. The column above the unit is cut away so the plan is visible.
- **USGS 3DEP LiDAR** is now exported at the survey's full density (about 8 points per m², 260–320k points per site).

## Work during the event & disclosures
- All code, data wiring and research in this repo were done during Nov 13–21, 2026. _Add a short log here._
- 3D models (realistic, from [Khronos glTF-Sample-Assets](https://github.com/KhronosGroup/glTF-Sample-Assets)):
  - GlamVelvetSofa — © 2021 Wayfair LLC, CC-BY 4.0 (a real Wayfair product; linked as "Buy on Wayfair")
  - AnisotropyBarnLamp — © 2023 Wayfair LLC, CC-BY 4.0 (a real Wayfair product; linked as "Buy on Wayfair")
  - SheenChair — © 2020 Wayfair LLC, CC0
  - DiffuseTransmissionPlant — © 2024 Darmstadt Graphics Group, CC-BY 4.0
  - DiffuseTransmissionTeacup — CC0
  - Tables, chairs, stools, counter, espresso machine, fridge, sink and shelves are procedural three.js models we wrote with PBR materials. They are generic, so their links say "Find similar" and open a retailer search. They link to one specific comparable product page each, labeled "similar product".
- Libraries: React, three.js, @react-three/fiber, drei, Leaflet, Vite (MIT/BSD).
- Visual style inspired by public startup landing pages; no assets copied.
- AI tools: Flashpoint AI (primary, research). Claude was used as a coding assistant for scaffolding this prototype.
