// One scene object drives the whole Fit Lab view (panel + 3D), modeled on Obia's scene.json:
//   site      facts about the address
//   layout    elements, items, views, sections
//   measures  every number with value, range {min,max}, method, source
//   checks    need / have / verdict / why / tour / pin / sweep
//   alternatives  other layouts for the same space
// Verdict uses the whole range: WORKS if even the worst end passes, TIGHT if the range crosses
// the requirement, FAILS if even the best end fails, NEEDS if the number was never measured.
import { planLayout, parseRequest, RULES } from './layout.js'
import { PRODUCTS } from '../data/products.js'

const FT = 0.3048
export const TOL = { wall: 0.3, place: 0.05, chair: 0.3 } // metres
export const METHODS = {
  assumed: 'assumed, not measured',
  listing_claim: 'from the listing (a claim)',
  derived: 'worked out by code',
  counted: 'counted by code',
  city_record: 'city record',
  lidar: 'LiDAR',
  not_measured: 'not measured yet',
}
const r2 = (v) => Math.round(v * 100) / 100
export const fmtM = (v) => `${v.toFixed(2)} m`
export const fmtFt = (v) => `${(v / FT).toFixed(1)} ft`
export function fmtVal(v, unit) { return unit === 'm' ? `${fmtM(v)} · ${fmtFt(v)}` : `${Math.round(v)} ${unit}` }
export function fmtRange(m) {
  if (!m || m.value == null) return 'Not measured yet'
  if (!m.range || m.range.min === m.range.max) return fmtVal(m.value, m.unit)
  return m.unit === 'm' ? `${m.range.min.toFixed(2)} to ${m.range.max.toFixed(2)} m` : `${Math.round(m.range.min)} to ${Math.round(m.range.max)} ${m.unit}`
}
export function verdict(check, m) {
  if (!m || m.value == null) return 'NEEDS'
  const lo = m.range?.min ?? m.value, hi = m.range?.max ?? m.value
  if (check.op === '<=') return hi <= check.need.value ? 'WORKS' : lo <= check.need.value ? 'TIGHT' : 'FAILS'
  return lo >= check.need.value ? 'WORKS' : hi >= check.need.value ? 'TIGHT' : 'FAILS'
}

function fp(it) {
  const r = Math.abs(Math.sin(it.rotY || 0)) > 0.5
  const w = r ? it.d : it.w, d = r ? it.w : it.d
  return { x0: it.x - w / 2, x1: it.x + w / 2, z0: it.z - d / 2, z1: it.z + d / 2, it }
}
const zOv = (a, z0, z1) => a.z0 < z1 && a.z1 > z0
const xOv = (a, x0, x1) => a.x0 < x1 && a.x1 > x0
function rectGap(a, b) {
  const dx = Math.max(0, Math.max(a.x0, b.x0) - Math.min(a.x1, b.x1))
  const dz = Math.max(0, Math.max(a.z0, b.z0) - Math.min(a.z1, b.z1))
  return Math.hypot(dx, dz)
}
function rectPts(a, b) {
  const c = (lo0, hi0, lo1, hi1) => hi0 <= lo1 ? [hi0, lo1] : hi1 <= lo0 ? [lo0, hi1] : [(Math.max(lo0, lo1) + Math.min(hi0, hi1)) / 2, (Math.max(lo0, lo1) + Math.min(hi0, hi1)) / 2]
  const [ax, bx] = c(a.x0, a.x1, b.x0, b.x1), [az, bz] = c(a.z0, a.z1, b.z0, b.z1)
  return [[ax, az], [bx, bz]]
}

function analyse(plan, room, target, dimsSource) {
  const { W, D } = room
  const Z = plan.zones
  const floor = plan.items.filter((it) => !it.onTop).map(fp)
  const front = floor.filter((f) => !['boh', 'counter'].includes(f.it.zone))
  const counters = floor.filter((f) => f.it.kind === 'counter')
  const cFront = Math.min(...counters.map((c) => c.z0)), cRight = Math.max(...counters.map((c) => c.x1)), cLeft = Math.min(...counters.map((c) => c.x0))
  const cz = (counters[0].z0 + counters[0].z1) / 2
  const measures = [], checks = []
  const M = (m) => { measures.push(m); return m }
  const wallSrc = dimsSource === 'user' ? 'You typed this size; nobody has taped the walls yet, so we allow ±0.30 m (±1 ft)' : 'Default 20 × 40 ft. Not in the city data, so we allow ±0.30 m (±1 ft) until it is taped'

  M({ id: 'frontage', label: 'Frontage (wall to wall)', value: W, unit: 'm', method: 'assumed', range: { min: W - TOL.wall, max: W + TOL.wall }, source: wallSrc })
  M({ id: 'depth', label: 'Depth (storefront to back wall)', value: D, unit: 'm', method: 'assumed', range: { min: D - TOL.wall, max: D + TOL.wall }, source: wallSrc })
  M({ id: 'area', label: 'Floor area', value: W * D, unit: 'm²', method: 'derived', range: { min: (W - TOL.wall) * (D - TOL.wall), max: (W + TOL.wall) * (D + TOL.wall) }, source: 'frontage × depth' })
  M({ id: 'ceiling', label: 'Ceiling height', value: null, unit: 'm', method: 'not_measured', source: 'Not in any public record. The 3D view draws 3.4 m as a placeholder.' })
  M({ id: 'door', label: 'Entrance position', value: Z.doorX, unit: 'm', method: 'assumed', range: { min: Z.doorX - TOL.wall, max: Z.doorX + TOL.wall }, source: 'Placed at 62% of the frontage. Check where the real door is.' })

  // 1 main aisle
  {
    let best = { w: Infinity, z: 0, l: 0, r: W }
    for (let z = 0.05; z < cFront; z += 0.05) {
      let l = 0, r = W
      for (const f of front) {
        if (!zOv(f, z - 0.025, z + 0.025)) continue
        if (f.x0 < Z.doorX && f.x1 > Z.doorX) { l = r = Z.doorX; break }
        if (f.x1 <= Z.doorX) l = Math.max(l, f.x1); else r = Math.min(r, f.x0)
      }
      if (r - l < best.w) best = { w: r - l, z, l, r }
    }
    M({ id: 'aisle:clear', label: 'Narrowest point on the straight path from the entrance to the counter', value: best.w, unit: 'm', method: 'derived', range: { min: best.w - 2 * TOL.place, max: best.w + 2 * TOL.place }, source: 'Path swept every 5 cm; furniture placed within ±5 cm on each side' })
    checks.push({ id: 'aisle', label: 'Main aisle, door to counter', op: '>=', need: { value: RULES.mainAisle, unit: 'm', source: 'Our rule: two people can pass. ADA 2010 §403.5.1 sets 36 in (0.915 m) as the minimum.' }, have: 'aisle:clear', pin: [(best.l + best.r) / 2, 0.05, best.z], measure: [[best.l, best.z], [best.r, best.z]], explain: 'The path from the door to the counter stays open the whole way.', tour: 'After the furniture is in, tape the narrowest point: it must stay at 1.2 m or more.' })
  }
  // 2 door clearance
  {
    const x0 = Z.doorX - 0.5 - 0.46, x1 = Z.doorX + 0.5
    const hit = front.filter((f) => xOv(f, x0, x1)).sort((a, b) => a.z0 - b.z0)[0]
    const has = hit ? hit.z0 : cFront
    M({ id: 'door:clear', label: 'Open floor inside the entrance (door width plus 18 in on the latch side)', value: has, unit: 'm', method: 'derived', range: { min: has - TOL.place, max: has + TOL.place }, source: 'Distance from the storefront to the first item in front of the door' })
    checks.push({ id: 'door', label: 'Clear floor inside the entrance', op: '>=', need: { value: 1.525, unit: 'm', source: 'ADA 2010 §404.2.4.1: 60 in (1.52 m) deep on the pull side of a door' }, have: 'door:clear', pin: [Z.doorX, 0.05, Math.min(has, 3) / 2], measure: [[Z.doorX, 0], [Z.doorX, Math.min(has, cFront)]], explain: 'The window bar stops short of the door so a wheelchair can turn in.', tour: 'Check which way the door swings. If it swings in, the swing must not hit a stool.' })
  }
  // 3 queue (moves with the back wall)
  {
    const near = front.filter((f) => xOv(f, cLeft, cRight) && f.z1 <= cFront + 0.01)
    const edge = near.length ? Math.max(...near.map((f) => f.z1)) : 0
    const has = cFront - edge, xm = (cLeft + cRight) / 2
    M({ id: 'queue:clear', label: 'Open depth between the counter front and the nearest seat', value: has, unit: 'm', method: 'derived', range: { min: has - TOL.wall, max: has + TOL.wall }, source: 'The counter is set off the back wall, so it moves with the depth (±0.30 m)' })
    checks.push({ id: 'queue', label: 'Queue space at the counter', op: '>=', need: { value: RULES.queueDepth, unit: 'm', source: 'Our rule: 1.5 m holds one line without blocking seats' }, have: 'queue:clear', pin: [xm, 0.05, (edge + cFront) / 2], measure: [[xm, edge], [xm, cFront]], explain: 'The counter and back of house are measured off the back wall.', tour: 'Tape the depth from the storefront glass to the back wall.', sweep: { kind: 'back', min: -TOL.wall, max: TOL.wall, label: 'Slide the back wall anywhere in its margin' } })
  }
  // 4 staff pass (moves with the side wall)
  {
    const has = W - cRight
    M({ id: 'staff:clear', label: 'Gap between the end of the counter and the side wall', value: has, unit: 'm', method: 'derived', range: { min: has - TOL.wall, max: has + TOL.wall }, source: 'The counter is set off the left wall, so this gap takes the whole frontage margin (±0.30 m)' })
    checks.push({ id: 'staff', label: 'Staff pass beside the counter', op: '>=', need: { value: RULES.staffPass, unit: 'm', source: 'Our rule: 36 in, same as an accessible route (ADA §403.5.1)' }, have: 'staff:clear', pin: [(cRight + W) / 2, 0.05, cz], measure: [[cRight, cz], [W, cz]], explain: 'Staff walk around the end of the counter to reach the back of house.', tour: 'Tape the frontage wall to wall at the back. Old buildings are rarely square.', sweep: { kind: 'wallR', min: -TOL.wall, max: TOL.wall, label: 'Slide the side wall anywhere in its margin' } })
  }
  // 5 headroom: needs a ceiling height
  {
    const lamp = plan.items.find((it) => it.kind === 'lamp')
    if (lamp) checks.push({ id: 'head', label: 'Headroom under the pendants', op: '>=', need: { value: 2.03, unit: 'm', source: 'ADA 2010 §307.4: 80 in (2.03 m) clear over walkways' }, have: 'ceiling', pin: [lamp.x, 2.3, lamp.z], explain: 'Pendants hang about 1.1 m below the ceiling, so the ceiling must be at least 3.1 m for this drop.', tour: 'Measure floor to ceiling above the counter. Under 3.1 m, use a shorter drop.' })
  }
  // 6 tables (chairs pull out)
  {
    const groups = front.filter((f) => !['chair', 'cup'].includes(f.it.kind)).map((f) => ({ ...f }))
    for (const g of groups) if (g.it.kind === 'bistro') for (const c of front.filter((f) => f.it.kind === 'chair' && Math.abs(f.it.x - g.it.x) < 0.01 && Math.abs(f.it.z - g.it.z) < 0.7)) { g.z0 = Math.min(g.z0, c.z0); g.z1 = Math.max(g.z1, c.z1); g.x0 = Math.min(g.x0, c.x0); g.x1 = Math.max(g.x1, c.x1) }
    const tables = groups.filter((g) => g.it.kind === 'bistro')
    let best = { g: Infinity }
    for (const t of tables) for (const o of groups) { if (o === t) continue; const g = rectGap(t, o); if (g > 0.001 && g < best.g) best = { g, a: t, b: o } }
    if (tables.length && best.a) {
      const [pa, pb] = rectPts(best.a, best.b)
      M({ id: 'tables:clear', label: 'Tightest gap between a table (chairs in) and the next piece of furniture', value: best.g, unit: 'm', method: 'derived', range: { min: best.g - TOL.chair, max: best.g }, source: 'Every pair of seating groups checked; a chair in use sits up to 0.30 m further out' })
      checks.push({ id: 'tables', label: 'Aisles between seating groups', op: '>=', need: { value: RULES.aisle, unit: 'm', source: 'ADA 2010 §403.5.1 and §902: a 36 in (0.915 m) route to accessible seating' }, have: 'tables:clear', pin: [(pa[0] + pb[0]) / 2, 0.05, (pa[1] + pb[1]) / 2], measure: [pa, pb], explain: 'Passes with chairs pushed in. With someone seated, the gap can drop below 36 in.', tour: 'Sit at the tightest table and check that someone can still walk behind you.', sweep: { kind: 'chair', min: -TOL.chair, max: 0, nominal: 0, label: 'Pull the chairs out, as when someone is seated' } })
    }
  }
  // 7 exit
  {
    const load = (w, d) => Math.floor((w * (d - (D - cFront))) / (FT * FT) / 15)
    const v = load(W, D)
    M({ id: 'exit:load', label: 'People the dining area is counted for (net floor area ÷ 15 ft²)', value: v, unit: 'people', method: 'derived', range: { min: load(W - TOL.wall, D - TOL.wall), max: load(W + TOL.wall, D + TOL.wall) }, source: 'Floor in front of the counter, at each end of the frontage and depth margins' })
    checks.push({ id: 'exit', label: 'One exit is enough', op: '<=', need: { value: 49, unit: 'people', source: 'NYC Building Code / IBC Table 1006.2.1: one exit up to 49 people; Table 1004.5: 15 net ft² per person at tables' }, have: 'exit:load', pin: [W / 2, 0.05, cFront * 0.55], explain: 'The dining area stays under the 49-person line where a second exit is required.', tour: 'Ask the landlord for the Certificate of Occupancy: it caps the number of people.' })
  }
  // 8 seats
  M({ id: 'seats', label: 'Seats placed (stools, chairs, lounge seats)', value: plan.seats, unit: 'seats', method: 'counted', range: { min: plan.seats, max: plan.seats }, source: 'Counted from the plan' })
  checks.push({ id: 'seats', label: `Seats: at least ${target}`, op: '>=', need: { value: target, unit: 'seats', source: 'Your brief' }, have: 'seats', pin: [W * 0.28, 0.05, 1.3], explain: plan.seats >= target ? 'The brief fits.' : 'The room is too small for this many seats at legal aisle widths.', tour: 'Short on seats? Trade the lounge corner for two more two-tops.' })

  for (const c of checks) {
    const m = measures.find((x) => x.id === c.have)
    c.haveMeasure = m
    c.verdict = verdict(c, m)
    const need = c.need.unit === 'm' ? fmtM(c.need.value) : `${c.need.value} ${c.need.unit}`
    c.why = c.verdict === 'NEEDS' ? `Needs ${c.op === '<=' ? 'at most' : 'at least'} ${need}; not measured yet` : `Needs ${c.op === '<=' ? 'at most' : 'at least'} ${need}; has ${fmtRange(m)}`
  }
  return { measures, checks }
}

function sections(plan, checks, room) {
  const has = (ids) => ids.filter((id) => checks.some((c) => c.id === id))
  const n = plan.items.filter((it) => PRODUCTS[it.product]).length
  return [
    { id: 'space', title: 'The space and what we assumed', view: 'top', table: true,
      body: 'The city vacancy record gives the address and the last use, not the floor size. Until someone tapes the walls, the frontage and depth are assumptions, so each carries a ±0.30 m (±1 ft) margin. Every check below is tested at the worst end of that margin.' },
    { id: 'entry', title: 'Getting in and through', view: 'walk', checks: has(['door', 'aisle', 'exit']),
      body: `The entrance sits at 62% of the frontage. A ${RULES.mainAisle} m aisle runs straight from the door to the counter, and the window bar stops short of the door to leave the 60 in turning space.` },
    { id: 'counter', title: 'Counter and queue', view: 'counter', checks: has(['queue', 'staff', 'head']),
      body: `The back of house takes ${RULES.bohDepth} m off the back wall. The counter stands in front of it, set off the left wall, with a staff pass at the right end. Both move with the walls, which is why two of these checks carry the full wall margin.` },
    { id: 'seating', title: `Seating: ${plan.seats} seats`, view: 'inside', checks: has(['tables', 'seats']),
      body: 'Stools face the street at the window bar. Two-tops fill the floor between the bar and the queue, each with a 36 in route around it.' },
    { id: 'shop', title: `Furniture and equipment: ${n} items`, view: 'inside', shop: true,
      body: 'Click any item in the model for its product page. Only the sofa and the pendants are the exact modeled products; the rest link to one comparable product each.' },
    { id: 'agent', title: 'How the agent built this', view: 'inside', steps: plan.steps,
      body: null },
  ]
}

const ALTS = (p) => [
  { id: 'brief', name: 'Your brief', params: p },
  { id: 'grab', name: 'Grab-and-go', params: { seats: 8, style: 'takeout', windowBar: true, lounge: false } },
  { id: 'max', name: 'Max seating', params: { seats: 20, style: 'dinein', windowBar: true, lounge: false } },
]

export function buildScene({ site, room, request, params, dimsSource = 'default', lidar = null }) {
  const p = params || parseRequest(request)
  const alternatives = ALTS(p).map((a) => {
    const plan = planLayout(room, a.params)
    const { measures, checks } = analyse(plan, room, a.params.seats, dimsSource)
    return { id: a.id, name: a.name, params: a.params, seats: plan.seats, items: plan.items, zones: plan.zones, measures, checks, sections: sections(plan, checks, room) }
  })
  return {
    site: {
      slug: site.id, address: site.address, zip: site.zip, lat: site.lat, lng: site.lng,
      previousUse: site.prevUse, vacancySource: 'NYC Storefronts Reported Vacant or Not (Local Law 157), reporting year 2025',
      lidar: lidar ? { dataset: 'USGS 3DEP NY_NewYorkCity (2017)', points: lidar.points, groundElevM: lidar.groundElevM, streetSide: lidar.streetSide } : null,
    },
    layout: {
      client: 'First-time cafe owner', use: request,
      room: { W: r2(room.W), D: r2(room.D), ceilingPlaceholder: 3.4 },
      elements: [
        { id: 'wall_back', kind: 'wall', label: 'Back wall' }, { id: 'wall_left', kind: 'wall', label: 'Left wall' },
        { id: 'wall_right', kind: 'wall', label: 'Right wall' }, { id: 'storefront', kind: 'glass', label: 'Storefront glass and entrance' },
      ],
      views: ['overview', 'top', 'street', 'inside', 'walk', 'counter'],
    },
    rules: RULES, tolerances: TOL,
    alternatives,
    builtAt: new Date().toISOString(),
  }
}
