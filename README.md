# StoreFit — find the storefront, fit the store

## ▶ Open the live demo: https://lzxgetoffearly-a11y.github.io/flashpoint-hackthon/
No install or login. Open the link in Chrome on a laptop, click **Start a search**, pick **2905 Broadway**, then **Fit a cafe in this space**. (Hosted on GitHub Pages from the `gh-pages` branch, built from `main`.)

### Demo video (75 s)
[![StoreFit demo: click to watch the video](docs/demo.gif)](https://lzxgetoffearly-a11y.github.io/flashpoint-hackthon/demo.mp4)

Click the preview to watch the MP4 ([direct link](https://lzxgetoffearly-a11y.github.io/flashpoint-hackthon/demo.mp4)). Recorded step by step on the live site; every screen shows real data. It ends with clicking a piece of furniture, the shopping list, and the retailer product page the link opens.

Engineering & Product track · Flashpoint AI × CUB Hackathon (Nov 13–21, 2026)

StoreFit helps a first-time owner open a small cafe in New York. It ranks **real vacant storefronts** near Columbia using **live NYC open data**, explains every score with its source, and then runs a **layout agent** that fits a counter, queue and seats into the chosen space in 3D, checking aisles and overlaps.

> Status: prototype. Scores use public data (food businesses, coffee competitors, subway distance and station ridership), not pedestrian counts or real rents. Unit sizes are estimates from city lot data that the user can overwrite; rent is a user input. See [SPEC.md](SPEC.md).



## Why this matters
- **About 22 million new companies are registered worldwide every year.** That is roughly **60,000 a day, or about 40 every minute**. Our estimate: the World Bank's global rate of 4.3 new limited-liability firms per 1,000 working-age adults in 2024, across 188 economies ([World Bank, 2026](https://blogs.worldbank.org/en/psd/a-global-snapshot-of-entrepreneurship-trends)), multiplied by roughly 5.2 billion working-age adults (UN World Population Prospects).
- In the US alone, about **497,000 business applications** were filed in December 2025, about **16,000 a day** ([US Census Business Formation Statistics](https://www.census.gov/econ/bfs/pdf/historic/bfs_2025m12.pdf)).
- Many of these founders have to answer the same two questions before signing a lease: *Is this the right location?* and *Will my store actually fit inside it?* Today they answer them with broker tours, guesswork and a tape measure.

## How it works
StoreFit is a **location-intelligence engine plus a 3D spatial-planning agent**.

**1. Multi-source data fusion.** For every candidate storefront, StoreFit queries city and transit open data live, then joins the results on location:
- NYC Open Data: vacant storefronts (Local Law 157), the DOHMH restaurant inspection registry, and PLUTO tax-lot geometry
- MTA: subway station locations and hourly station ridership
- USGS 3DEP aerial LiDAR point clouds, and Google Photorealistic 3D Tiles

**2. Explainable site scoring.** A weighted multi-factor model combines five signals into one 0–100 score:
- demand density (nearby food activity)
- competitive saturation (a non-linear curve: a few competitors confirm demand, more split it)
- transit accessibility (walking distance blended with station ridership)
- build-out readiness (previous use of the unit)
- rent-to-revenue ratio

Every factor shows its raw value, its rule and its source, so the score is a decision aid, not a black box. Flashpoint research showed users distrust opaque scores (2.33 / 5), which is why we kept it this way.

**3. Spatial reconstruction.** StoreFit estimates each unit's footprint from lot geometry and orients the storefront from the LiDAR point cloud. This gives a 3D model of the real block.

**4. Constraint-solving layout agent.** The agent places the counter, back of house, queue and seating. It checks every layout against accessibility and egress codes (ADA 2010, IBC / NYC Building Code) and treats each dimension as a range, not a single number. Each layout gets a verdict: **Works**, **Tight**, **Fails** or **Needs measuring**.

## Business model (proposed, not yet tested)
The Fit Lab places real, purchasable furniture and equipment into the owner's actual space. Each item links to its product page, and the shopping list totals the list prices. That makes it a sales channel for manufacturers:
- **Manufacturers and suppliers** (furniture, seating, coffee and refrigeration equipment) pay to have their catalog as 3D models inside the Fit Lab. Their products then get "demoed" in thousands of real storefronts before purchase, which shortens the sales cycle and cuts returns from items that don't fit.
- **Revenue:** a per-SKU listing fee, plus a referral commission on orders placed from the shopping list.
- **Owners** use site search and layout for free. A paid, detailed report can be added later.

This model is a hypothesis. Our next research step is to interview suppliers and owners to test it.

## What to try (for judges)
Use **2905 Broadway** for the walkthrough; it is the address we checked end to end.

1. **Start a search.** Eight storefronts reported vacant near Columbia load with live numbers from NYC and MTA open data (a few seconds). Click a card to see each factor, its raw value and its source. Competitors show on the map; the Satellite and Street View toggles show the real place.
2. **Fit a cafe in this space** opens the **Fit Lab** (the form follows Obia's Fit Lab case-study viewer; all code is ours).
   - The room size is estimated per address from PLUTO (ground-floor retail area ÷ storefronts on the lot), so each address gets a different plan. Type measured dimensions to replace it.
   - The agent lays out a counter and back of house, a window bar, a wall banquette with two-tops, a lounge corner and free-standing tables, and keeps a straight 1.2 m aisle from the door to the counter.
   - Every number has a range, a method and a source. Verdicts use the whole range: **Works**, **Tight**, **Fails**, or **Needs measuring** (ceiling height). Open a check and drag its slider to move the wall or chairs inside the margin.
   - Three layouts: Your brief, Grab-and-go, Max seating.
   - Views: Overview, Top, Street, Inside, Walk in. Context layers in Overview: **Block** (building massing from LiDAR), **LiDAR** (the raw point cloud), **Google 3D** (photorealistic tiles, needs a key).
   - Click any furniture for its product page; "Furniture and equipment" totals list prices.
3. **Research** shows how Flashpoint findings shaped each rule. **Report** prints a one-page summary.

## How we use Flashpoint AI
Status (Nov 21, 13:10 ET): **one Flashpoint survey, sent to our own first-party panel, has 3 complete responses (1 more partial).** n=3 is a very small, convenience sample of people we know, so we treat it as directional, not proof.

What we actually did with Flashpoint:
- Connected the Flashpoint MCP tools with the team's Base USDC wallet (funded with 25 USDC).
- Built, published and sent a 5-question survey to our own first-party panel, "StoreFit testers" (7 real people, no third-party sample): https://flashpointopinions.com/bdcdb46f-cd9d-4e09-91e1-25ccd022274e
- Cost: $2.00 over 4 paid calls. On-chain receipts:
  [create](https://basescan.org/tx/0x0e4dd2a3bd01d379aad04ec537128bb5b3f7a50a973f357bef96fb89da00dd01) ·
  [confirm](https://basescan.org/tx/0xb7aaaddc7c6988cbc25f6f89e31846f0f4b3074fdb724584e7c5187c4d797cb0) ·
  [publish](https://basescan.org/tx/0x9f38091424d68d05dda84387331c069c3ed5d6ef73469399da9e627df365c64f) ·
  [send](https://basescan.org/tx/0x8dfb3b8b11e7ce38ecfd36243be76eb5027e4e63dcf33c3ebc17e289be4653fe) ·
  [results](https://basescan.org/tx/0x3875a8715af24eed2a4511673806f9c39a68991be0998a7de4966d64f44f606d) (total $2.50)

### Survey results (Flashpoint, n = 3 complete)
| Question | Result |
|---|---|
| Who are you | 2 run or plan to open a small shop/cafe, 1 customer |
| What matters most when judging a location (multi) | Rent worth it 2 · Equipment and seating fit 2 · Nearby customers (students, workers) 2 · Foot traffic 1 · Competition 0 |
| How helpful is a 3D layout preview before signing (1–5) | **3.67** (4, 4, 3) |
| How much do you trust an automatic site score (1–5) | **2.33** (2, 2, 3) |

Open answers, verbatim:
1. "As a customer I notice when the entrance is awkward or the queue blocks the seats. A shop should be easy to reach and comfortable to use not just look good in pictures. I have no experience signing a commercial lease so I cannot judge the business economics."
2. "Mistaking a busy street for enough paying customers. Before signing my first cafe lease I would count traffic at different times check whether those people would buy coffee and work out how many daily sales cover rent. A nice layout would not fix weak demand."
3. "Signing a lease before checking kitchen equipment ventilation and electrical capacity. Cheap rent can hide expensive fit-out work. I would verify the layout and renovation costs with a contractor before committing to a second food shop."

### What the results changed
- **Kept:** the Fit Lab as the lead feature. "Will my equipment and seating fit" tied for the top concern, and the 3D preview scored 3.67/5.
- **Reinforced:** every score shows its source and range instead of a bare number. Trust in an automatic score was low (2.33/5), so a black-box score would not be used.
- **Ruled out as a headline:** foot traffic alone (1 of 3) and competitor counts (0 of 3). Answer 2 says a busy street is not the same as paying customers, so the next step is a demand-vs-rent check (daily sales needed to cover rent), not a bigger traffic number.
- **Added to the Fit Lab backlog (not built yet):** entrance and queue path not blocking seats (answer 1); ventilation and electrical capacity flags (answer 3).

Each question is tied to a product decision we will make when answers arrive:

| Survey question | Decision it will drive |
|---|---|
| Who are you (owner / planning to open / customer) | Which user the product is written for |
| What matters most when judging a storefront's location | Weights of the site score (`src/lib/score.js`) |
| How much would a 3D layout preview help before signing (1–5) | Whether the Fit Lab stays the lead feature |
| How much do you trust an automatic site score (1–5) | How much source and range detail we show on every number |
| The mistake you most want to avoid when choosing a space (open) | Which checks the Fit Lab runs |

Not done: no synthetic panel was run, no AI-moderated interviews, and Flashpoint demographics are not used in the scores. The score weights and layout rules in this build are our own starting assumptions plus cited codes (ADA 2010, IBC / NYC Building Code), not survey results.

## Required write-up
- **Problem and audience:** A first-time owner has to commit to a lease before knowing two things: whether the location has demand without too much competition, and whether the counter, queue and seats they need will fit legally in that unit. Our intended user is a first-time independent cafe owner near Columbia. This is our hypothesis; the survey's first and last questions are there to test it.
- **Use of Flashpoint (question + evidence):** Question: "what do people opening a small shop find hardest to judge, and do a 3D fit preview and a sourced score help?" Evidence: survey sent to a 7-person first-party panel, 3 complete responses (results and receipts above).
- **Impact of decisions (changed / kept / ruled out):** Kept the Fit Lab as the lead feature; kept sources and ranges on every score because trust in automatic scores was low; ruled out foot traffic and competitor counts as headline metrics; added entrance/queue, ventilation and electrical checks and a sales-vs-rent check to the backlog. Based on n=3, so directional only.
- **Proposed solution:** live-data site shortlist + 3D layout agent (this repo).
- **Supporting evidence (what was actually tested vs simulated):** Real: live NYC / MTA open-data queries, USGS LiDAR, PLUTO lot data, Google 3D tiles, product pages and list prices, and a survey sent to 7 real people (3 complete answers). Estimated or assumed, and labelled so in the app: unit dimensions (from lot data), ceiling height, door position. Simulated: nothing is presented as user feedback; there are no synthetic respondents and no fabricated results. The layout itself is generated by rules, not validated with owners.
- **Limitations and next steps:** no pedestrian counts or rent data; unit size is an estimate from lot data (±0.6 m) until someone measures; ceiling height is assumed; the layout is rule-generated with one counter position (across the back) and needs professional review; the Google 3D facade alignment was checked on 2905 Broadway only. Next: store-type templates (side counter, loop circulation), listing integration, floor-plan upload, interviews with owners.

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
