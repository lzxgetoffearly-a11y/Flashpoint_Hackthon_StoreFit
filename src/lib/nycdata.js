// Live public-data signals, fetched in the browser from NYC / NY State open data (Socrata, CORS-enabled).
const DOHMH = 'https://data.cityofnewyork.us/resource/43nn-pn8j.json' // DOHMH restaurant inspections
const MTA = 'https://data.ny.gov/resource/39hk-dx4f.json' // MTA subway stations
export const SOURCES = {
  dohmh: { name: 'DOHMH Restaurant Inspection Results', url: 'https://data.cityofnewyork.us/Health/DOHMH-New-York-City-Restaurant-Inspection-Results/43nn-pn8j' },
  mta: { name: 'MTA Subway Stations', url: 'https://data.ny.gov/Transportation/MTA-Subway-Stations/39hk-dx4f' },
  storefront: { name: 'Storefronts Reported Vacant or Not', url: 'https://data.cityofnewyork.us/City-Government/Storefronts-Reported-Vacant-or-Not/92iy-9c3n' },
}

async function soql(base, params) {
  const q = new URLSearchParams(params).toString()
  const r = await fetch(`${base}?${q}`)
  if (!r.ok) throw new Error(`${r.status} ${base}`)
  return r.json()
}

let stationsCache = null
async function stations() {
  if (!stationsCache) {
    stationsCache = await soql(MTA, { $select: 'stop_name,daytime_routes,gtfs_latitude,gtfs_longitude', $where: "borough='M'", $limit: 500 })
  }
  return stationsCache
}

export function haversine(a, b) {
  const R = 6371000, toR = (d) => (d * Math.PI) / 180
  const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng)
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

export async function fetchSignals(c, radius = 300) {
  const circle = `within_circle(location,${c.lat},${c.lng},${radius})`
  const [cafes, food, st] = await Promise.all([
    soql(DOHMH, { $select: 'dba,building,street,latitude,longitude', $where: `${circle} AND cuisine_description='Coffee/Tea'`, $group: 'dba,building,street,latitude,longitude', $limit: 200 }),
    soql(DOHMH, { $select: 'count(distinct camis) as n', $where: circle }),
    stations(),
  ])
  let nearest = null
  for (const s of st) {
    const d = haversine(c, { lat: +s.gtfs_latitude, lng: +s.gtfs_longitude })
    if (!nearest || d < nearest.d) nearest = { d, name: s.stop_name, routes: s.daytime_routes }
  }
  // de-duplicate cafes by name+address
  const seen = new Set()
  const cafeList = cafes.filter((x) => { const k = `${x.dba}|${x.building}|${x.street}`; if (seen.has(k)) return false; seen.add(k); return true })
    .map((x) => ({ name: x.dba, address: `${x.building} ${x.street}`, lat: +x.latitude, lng: +x.longitude }))
  return { cafes: cafeList, foodCount: +food[0]?.n || 0, subway: nearest, radius, fetchedAt: new Date().toISOString() }
}
