# StoreFit — Product Spec (hackathon prototype)

## One line
An AI advisor for first-time small food business owners in New York: shortlist a real vacant storefront with public data, then fit the store inside it in 3D.

## Target user
First-time owner opening a small coffee shop / tea shop near a campus (start: Columbia University area, Manhattan).
Pain points to validate with Flashpoint research (see docs/RESEARCH.md):
- Site choice is made on gut feel and broker pitches; data tools (Placer.ai, SiteZeus) are priced for chains.
- After signing, owners discover the space does not fit the seats / queue / back-of-house they planned.

## Scope for the demo (Nov 21)
| In | Out (next steps) |
|---|---|
| 8 storefronts reported vacant on 12/31/2025 (NYC Local Law 157 data) near Columbia | Live listings, real asking rents |
| Live signals per site: coffee/tea competitors ≤300 m and food businesses ≤300 m (DOHMH), nearest subway (MTA) | Pedestrian counts, demographics, zoning checks |
| Transparent weighted score; every factor shows raw value + source link | ML-trained score |
| Optional user input: asking rent + expected revenue → rent ratio factor | Rent comps |
| Layout agent: free-text request → params (rules, or optional LLM) → rule planner → 3D scene (three.js) | Floor-plan upload / scan |
| Checks: main aisle 1.2 m, accessible route 36 in (0.915 m), queue 1.5 m, no overlaps, seat target | Code-compliance review by a professional |
| Research page: Flashpoint question → finding → product decision | — |
| Printable one-page report | — |

## User flow
1. **Home** — value proposition, "agent at work" ticker.
2. **Sites** — ranked cards + map (CARTO light tiles). Click a card → factor breakdown with sources; competitors plotted on the map.
3. **Layout** — enter frontage/depth (default 20×40 ft, labeled as an assumption) and a request ("12 seats, students, window bar, sofa corner"). The agent streams its steps, then shows checks. 3D scene: realistic Wayfair/Khronos glTF models (sofa, barn pendant, armchair, plant, cup) plus procedural PBR furniture, 1 m grid, dimension lines in m/ft. Clicking an item opens a product card; a shopping list groups items with buy links ("exact" for real-product models, "similar" retailer search otherwise).
4. **Research** — how each rule came from Flashpoint research (placeholders until filled).
5. **Report** — KPIs + factors + checks, print to PDF.

## Scoring (src/lib/score.js)
| Factor | Raw signal | Rule | Weight |
|---|---|---|---|
| Demand proxy | food businesses ≤300 m (DOHMH) | linear, 60+ = 100 | 0.30 |
| Competition | coffee/tea shops ≤300 m (DOHMH) | 1–2 best, −9 per extra | 0.25 |
| Transit | distance to nearest subway (MTA) | 100 within 100 m, −1 per 4 m | 0.20 |
| Build-out | previous use (storefront registry) | food 90, retail 60, other 45 | 0.15 |
| Rent ratio | user input | penalize above 8% of revenue | 0.10 (only if entered) |
Weights are a starting point; update them from the Flashpoint findings and document the change.

## Layout planner (src/lib/layout.js)
Zones from back to front: back-of-house (2.3 m) → service counter (0.75 m, staff pass 0.915 m) → queue (1.5 m) → seating → optional window bar.
Seats placed as two-top modules on both sides of a 1.2 m main aisle from the door to the counter. Row spacing keeps ≥0.915 m route. Output is checked for overlaps and aisle blockers.
The LLM (optional, OpenAI-compatible endpoint via env vars) only extracts `{seats, style, windowBar}`; geometry is always rule-based so the demo cannot produce overlapping furniture.

## Honesty / labeling
- Candidate storefronts and signals are real public data; floor sizes and rents are user inputs, never invented.
- Synthetic survey results (Flashpoint ConnectedSynth) are labeled "synthetic" everywhere; real responses labeled "real".
- Only the sofa and barn pendant models are real products; other items are generic and link to "similar" searches. No prices shown.

## Tech
Vite + React 18, three.js via @react-three/fiber + drei, Leaflet via react-leaflet. No backend; all data calls are browser → Socrata (CORS).

## Fit Lab view (added 2026-11-21, modeled on Obia's Fit Lab case-study viewer)
- Dark 3D stage with translucent walls, numbered check pins, camera fly-to, and a bottom toolbar (Overview, Top, Street, Walk in, Dimensions, Zones, LiDAR, Dark).
- Fit checks (`src/lib/fitchecks.js`) are measured from the plan geometry, each with Needs / Has / Method / Source / On the tour. Status: Works (≥10% margin), Tight (meets rule, <10% margin), Fails.
- LiDAR layer: real USGS 3DEP points around the address, host building cut away so the plan shows through.
