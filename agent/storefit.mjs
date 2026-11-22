// Bridge from the research agent to the StoreFit product. It runs the same layout planner and
// code checks the web app's Fit Lab uses (src/lib/scene.js) from Node, with no browser, and
// reports on the three layouts the Fit Lab already offers for a storefront. The web app itself
// is not changed: the agent picks one of its existing layouts.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildScene } from "../src/lib/scene.js";
import { parseRequest } from "../src/lib/layout.js";
import { PRODUCTS } from "../src/data/products.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const FT = 0.3048;
export const LIVE_APP = "https://lzxgetoffearly-a11y.github.io/Flashpoint_Hackthon_StoreFit/";
// The brief the Fit Lab opens with (src/App.jsx).
const DEFAULT_BRIEF = "12 seats, lots of students nearby, a window bar, a few two-tops and a sofa lounge";
// Button labels in the Fit Lab for each layout id.
const TAB = { brief: "Your brief", grab: "Grab-and-go", max: "Max seating" };

// src/data/candidates.js imports a JSON snapshot the Vite way, which plain Node rejects.
// Load the same file with that one import stubbed, so the site list stays in a single place.
async function loadCandidates() {
  const src = fs.readFileSync(path.join(here, "../src/data/candidates.js"), "utf8").replace(/^import snap from .*$/m, "const snap = null");
  return import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
}

export async function listSites() {
  const { candidates, estimateRoom } = await loadCandidates();
  return candidates.map((c) => ({ id: c.id, address: c.address, previousUse: c.prevUse, estimatedRoomFt: estimateRoom(c) }));
}

export async function compareLayouts(siteId = "bwy-2905") {
  const { candidates, estimateRoom } = await loadCandidates();
  const site = candidates.find((c) => c.id === siteId);
  if (!site) throw new Error(`Unknown site "${siteId}". Known: ${candidates.map((c) => c.id).join(", ")}`);
  const est = estimateRoom(site);
  const room = { W: est.wFt * FT, D: est.dFt * FT };
  const scene = buildScene({ site, room, request: DEFAULT_BRIEF, params: parseRequest(DEFAULT_BRIEF), dimsSource: est.source, est });
  const options = scene.alternatives.map((plan) => {
    const priced = plan.items.filter((it) => PRODUCTS[it.product]);
    const count = (v) => plan.checks.filter((c) => c.verdict === v).length;
    const has = (kind) => plan.items.some((it) => it.kind === kind);
    return {
      id: plan.id,
      nameInApp: TAB[plan.id] ?? plan.name,
      serviceStyle: plan.params.style,
      seatsPlaced: plan.seats,
      features: [has("windowbar") && "window bar with stools", has("banquette") && "wall banquette with two-tops", has("sofa") && "sofa lounge", has("bistro") && "free-standing two-tops"].filter(Boolean),
      checks: { works: count("WORKS"), tight: count("TIGHT"), fails: count("FAILS"), needsMeasuring: count("NEEDS") },
      notPassing: plan.checks.filter((c) => c.verdict !== "WORKS").map((c) => `${c.label}: ${c.verdict}`),
      furnitureListPriceUSD: Math.round(priced.reduce((a, it) => a + (PRODUCTS[it.product].price || 0), 0)),
      itemsWithoutPrice: priced.filter((it) => !PRODUCTS[it.product].price).length,
    };
  });
  return {
    scene,
    summary: {
      site: site.address,
      room: `${est.wFt} ft wide x ${est.dFt} ft deep (estimated from city lot data, not measured)`,
      options,
      howToView: `Open ${LIVE_APP} → Start a search → ${site.address} → Fit a cafe in this space → choose the layout by name.`,
    },
  };
}
