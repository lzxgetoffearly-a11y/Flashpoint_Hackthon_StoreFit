// Candidate storefronts near Columbia University (Morningside Heights / Manhattan Valley / Manhattanville).
// Source: NYC Storefronts Reported Vacant or Not (Local Law 157), dataset 92iy-9c3n,
// reporting_year = 2025, vacant_on_12_31 = YES. Pulled 2026-11-21.
// https://data.cityofnewyork.us/City-Government/Storefronts-Reported-Vacant-or-Not/92iy-9c3n
// Floor sizes are NOT in the dataset: the app asks the user (default = typical 20 x 40 ft NYC storefront, an assumption).
export const DATASET_URL = 'https://data.cityofnewyork.us/resource/92iy-9c3n.json'

export const candidates = [
  { id: 'bwy-2905', address: '2905 Broadway', zip: '10025', lat: 40.80652, lng: -73.96549, prevUse: 'FOOD SERVICES', nta: 'MN0901' },
  { id: 'ams-960', address: '960 Amsterdam Ave', zip: '10025', lat: 40.80137, lng: -73.96543, prevUse: 'FOOD SERVICES', nta: 'MN0703' },
  { id: 'bwy-2760', address: '2760 Broadway', zip: '10025', lat: 40.80141, lng: -73.96728, prevUse: 'HEALTH CARE or SOCIAL ASSISTANCE', nta: 'MN0703' },
  { id: 'bwy-2730', address: '2730 Broadway', zip: '10025', lat: 40.80014, lng: -73.96756, prevUse: 'MISCELLANEOUS OTHER SERVICE', nta: 'MN0703' },
  { id: 'ams-1270', address: '1270 Amsterdam Ave', zip: '10027', lat: 40.81117, lng: -73.95828, prevUse: 'HEALTH CARE or SOCIAL ASSISTANCE', nta: 'MN0901' },
  { id: 'w121-537', address: '537 W 121st St', zip: '10027', lat: 40.81123, lng: -73.96106, prevUse: 'RETAIL', nta: 'MN0901' },
  { id: 'bwy-2592', address: '2592 Broadway', zip: '10025', lat: 40.79556, lng: -73.97047, prevUse: 'FOOD SERVICES', nta: 'MN0702' },
  { id: 'ams-1342', address: '1342 Amsterdam Ave', zip: '10027', lat: 40.8138, lng: -73.95625, prevUse: 'FOOD SERVICES', nta: 'MN0902' },
]

// Snapshot of the live signals, used only if the live API calls fail during a demo
// (e.g. venue Wi-Fi). Captured with the same queries as `fetchSignals` on 2026-11-21 06:42 UTC.
import snap from './snapshot.json'
export const snapshot = snap
