// Candidate storefronts near Columbia University (Morningside Heights / Manhattan Valley / Manhattanville).
// Source: NYC Storefronts Reported Vacant or Not (Local Law 157), dataset 92iy-9c3n,
// reporting_year = 2025, vacant_on_12_31 = YES. Pulled 2026-11-21.
// https://data.cityofnewyork.us/City-Government/Storefronts-Reported-Vacant-or-Not/92iy-9c3n
// Floor sizes are NOT in the dataset: the app asks the user (default = typical 20 x 40 ft NYC storefront, an assumption).
export const DATASET_URL = 'https://data.cityofnewyork.us/resource/92iy-9c3n.json'

export const candidates = [
  { id: 'bwy-2905', address: '2905 Broadway', zip: '10025', lat: 40.80652, lng: -73.96549, prevUse: 'FOOD SERVICES', nta: 'MN0901', pluto: {"bbl": "1018950055", "lot": "2901 BROADWAY", "bldgfront": 98, "bldgdepth": 174, "retailarea": 12000, "storefronts": 11, "numfloors": 12, "yearbuilt": 1910, "zone": "R8"} },
  { id: 'ams-960', address: '960 Amsterdam Ave', zip: '10025', lat: 40.80137, lng: -73.96543, prevUse: 'FOOD SERVICES', nta: 'MN0703', pluto: {"bbl": "1018790029", "lot": "960 AMSTERDAM AVENUE", "bldgfront": 50, "bldgdepth": 90, "retailarea": 3000, "storefronts": 2, "numfloors": 6, "yearbuilt": 1925, "zone": "R8A"} },
  { id: 'bwy-2760', address: '2760 Broadway', zip: '10025', lat: 40.80141, lng: -73.96728, prevUse: 'HEALTH CARE or SOCIAL ASSISTANCE', nta: 'MN0703', pluto: {"bbl": "1018780012", "lot": "2760 BROADWAY", "bldgfront": 112, "bldgdepth": 170, "retailarea": 7000, "storefronts": 5, "numfloors": 16, "yearbuilt": 1928, "zone": "C2-8A"} },
  { id: 'bwy-2730', address: '2730 Broadway', zip: '10025', lat: 40.80014, lng: -73.96756, prevUse: 'MISCELLANEOUS OTHER SERVICE', nta: 'MN0703', pluto: {"bbl": "1018760046", "lot": "2730 BROADWAY", "bldgfront": 71, "bldgdepth": 133, "retailarea": 5000, "storefronts": 7, "numfloors": 14, "yearbuilt": 1920, "zone": "R9A"} },
  { id: 'ams-1270', address: '1270 Amsterdam Ave', zip: '10027', lat: 40.81117, lng: -73.95828, prevUse: 'HEALTH CARE or SOCIAL ASSISTANCE', nta: 'MN0901', pluto: {"bbl": "1019770034", "lot": "1270 AMSTERDAM AVENUE", "bldgfront": 27, "bldgdepth": 85, "retailarea": 2000, "storefronts": 2, "numfloors": 5, "yearbuilt": 1926, "zone": "R8"} },
  { id: 'w121-537', address: '537 W 121st St', zip: '10027', lat: 40.81123, lng: -73.96106, prevUse: 'RETAIL', nta: 'MN0901', pluto: null },
  { id: 'bwy-2592', address: '2592 Broadway', zip: '10025', lat: 40.79556, lng: -73.97047, prevUse: 'FOOD SERVICES', nta: 'MN0702', pluto: {"bbl": "1018690044", "lot": "2586 BROADWAY", "bldgfront": 100, "bldgdepth": 168, "retailarea": 8740, "storefronts": 10, "numfloors": 12, "yearbuilt": 1911, "zone": "R9A"} },
  { id: 'ams-1342', address: '1342 Amsterdam Ave', zip: '10027', lat: 40.8138, lng: -73.95625, prevUse: 'FOOD SERVICES', nta: 'MN0902', pluto: {"bbl": "1019820024", "lot": "501 WEST 125 STREET", "bldgfront": 70, "bldgdepth": 98, "retailarea": 4720, "storefronts": 2, "numfloors": 2, "yearbuilt": 1926, "zone": "R7A"} },
]

// Snapshot of the live signals, used only if the live API calls fail during a demo
// (e.g. venue Wi-Fi). Captured with the same queries as `fetchSignals` on 2026-11-21 06:42 UTC.
import snap from './snapshot.json'
export const snapshot = snap

// PLUTO 26v2 (dataset 64uk-42ks) joined by BBL on 2026-11-21. `storefronts` = number of storefront
// filings on that lot in the 2025 vacancy dataset. The city does not publish a per-shop floor size,
// so we estimate one: retail area on the lot ÷ storefronts on the lot, drawn at 1 : 2 (frontage : depth)
// and capped by the building's own frontage and depth. It is an estimate, shown with a ±0.6 m margin.
export function estimateRoom(c) {
  const p = c.pluto
  if (!p || !p.retailarea || !p.storefronts) return { wFt: 20, dFt: 40, source: 'default' }
  const area = p.retailarea / p.storefronts
  let w = Math.sqrt(area / 2), d = 2 * w
  w = Math.min(w, p.bldgfront); d = Math.min(d, p.bldgdepth)
  return { wFt: Math.round(w), dFt: Math.round(d), source: 'pluto', areaFt2: Math.round(area) }
}
