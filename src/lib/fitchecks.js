// Fit checks: each one is measured on the planned layout, compared to a written rule,
// and pinned in 3D. Status: works (>=10% margin), tight (meets it, <10% margin), fails.
import { RULES } from './layout.js'

const FT = 0.3048
const m = (v) => `${v.toFixed(2)} m · ${(v / FT).toFixed(1)} ft`
const status = (has, need) => (has >= need * 1.1 ? 'works' : has >= need ? 'tight' : 'fails')

function fp(it) {
  const r = Math.abs(Math.sin(it.rotY || 0)) > 0.5
  const w = r ? it.d : it.w, d = r ? it.w : it.d
  return { x0: it.x - w / 2, x1: it.x + w / 2, z0: it.z - d / 2, z1: it.z + d / 2, it }
}
const zOverlap = (a, z0, z1) => a.z0 < z1 && a.z1 > z0
const xOverlap = (a, x0, x1) => a.x0 < x1 && a.x1 > x0
function rectGap(a, b) {
  const dx = Math.max(0, Math.max(a.x0, b.x0) - Math.min(a.x1, b.x1))
  const dz = Math.max(0, Math.max(a.z0, b.z0) - Math.min(a.z1, b.z1))
  return Math.hypot(dx, dz)
}
// closest points between two rects (for drawing the measure line)
function rectPts(a, b) {
  const cx = (lo0, hi0, lo1, hi1) => hi0 <= lo1 ? [hi0, lo1] : hi1 <= lo0 ? [lo0, hi1] : [(Math.max(lo0, lo1) + Math.min(hi0, hi1)) / 2, (Math.max(lo0, lo1) + Math.min(hi0, hi1)) / 2]
  const [ax, bx] = cx(a.x0, a.x1, b.x0, b.x1), [az, bz] = cx(a.z0, a.z1, b.z0, b.z1)
  return [[ax, az], [bx, bz]]
}

export function fitChecks(plan, room, target) {
  const { W, D } = room
  const Z = plan.zones
  const floor = plan.items.filter((it) => !it.onTop).map(fp)
  const front = floor.filter((f) => !['boh', 'counter'].includes(f.it.zone))
  const counters = floor.filter((f) => f.it.kind === 'counter')
  const counterFront = Math.min(...counters.map((c) => c.z0))
  const counterRight = Math.max(...counters.map((c) => c.x1))
  const out = []

  // 1. Main aisle, door to counter
  {
    const cx = Z.doorX
    let best = { w: Infinity, z: 0, l: 0, r: W }
    for (let z = 0.05; z < counterFront; z += 0.05) {
      let l = 0, r = W
      for (const f of front) {
        if (!zOverlap(f, z - 0.025, z + 0.025)) continue
        if (f.x0 < cx && f.x1 > cx) { l = cx; r = cx; break }
        if (f.x1 <= cx) l = Math.max(l, f.x1)
        else r = Math.min(r, f.x0)
      }
      if (r - l < best.w) best = { w: r - l, z, l, r }
    }
    out.push({
      key: 'aisle', title: 'Main aisle, door to counter', need: RULES.mainAisle, has: best.w, unit: 'm',
      status: status(best.w, RULES.mainAisle),
      where: 'Narrowest point along the straight path from the entrance to the counter.',
      method: 'Measured by code: swept the path every 5 cm and took the tightest gap between furniture.',
      source: 'Our rule: two people can pass. ADA 2010 §403.5.1 sets 36 in as the minimum for any accessible route.',
      tour: 'Tape the narrowest point once the furniture is in: it must stay ≥ 1.2 m.',
      measure: [[best.l, best.z], [best.r, best.z]], pin: [(best.l + best.r) / 2, 0.05, best.z],
    })
  }
  // 2. Door maneuvering clearance
  {
    const x0 = Z.doorX - 0.5 - 0.46, x1 = Z.doorX + 0.5
    const hit = front.filter((f) => xOverlap(f, x0, x1)).sort((a, b) => a.z0 - b.z0)[0]
    const has = hit ? hit.z0 : counterFront
    const need = 1.525
    out.push({
      key: 'door', title: 'Clear floor inside the entrance', need, has, unit: 'm', status: status(has, need),
      where: 'Depth of open floor inside the door, door width plus 18 in on the latch side.',
      method: 'Measured by code: distance from the storefront to the first item in front of the door.',
      source: 'ADA 2010 §404.2.4.1: 60 in (1.52 m) deep maneuvering clearance on the pull side of a door.',
      tour: 'Check which way the door swings. If it swings in, the swing must not hit any seat.',
      measure: [[Z.doorX, 0], [Z.doorX, has]], pin: [Z.doorX, 0.05, has / 2],
    })
  }
  // 3. Queue in front of the counter
  {
    const x0 = Math.min(...counters.map((c) => c.x0))
    const near = front.filter((f) => xOverlap(f, x0, counterRight) && f.z1 <= counterFront + 0.01)
    const edge = near.length ? Math.max(...near.map((f) => f.z1)) : 0
    const has = counterFront - edge
    const xm = (x0 + counterRight) / 2
    out.push({
      key: 'queue', title: 'Queue space at the counter', need: RULES.queueDepth, has, unit: 'm', status: status(has, RULES.queueDepth),
      where: 'Open depth between the counter front and the nearest seat or table.',
      method: 'Measured by code along the counter length.',
      source: 'Our rule: 1.5 m holds one line of customers without blocking seats.',
      tour: 'Watch the morning rush at a nearby cafe: count how deep the line gets.',
      measure: [[xm, edge], [xm, counterFront]], pin: [xm, 0.05, (edge + counterFront) / 2],
    })
  }
  // 4. Aisles between seating groups
  {
    const groups = []
    for (const f of front) {
      if (f.it.kind === 'chair' || f.it.kind === 'cup') continue
      groups.push({ ...f })
    }
    // grow tables to include their chairs
    for (const g of groups) if (g.it.kind === 'bistro') {
      for (const c of front.filter((f) => f.it.kind === 'chair' && Math.abs(f.it.x - g.it.x) < 0.01)) {
        if (Math.abs(c.it.z - g.it.z) < 0.7) { g.z0 = Math.min(g.z0, c.z0); g.z1 = Math.max(g.z1, c.z1); g.x0 = Math.min(g.x0, c.x0); g.x1 = Math.max(g.x1, c.x1) }
      }
    }
    let best = { g: Infinity }
    const tables = groups.filter((g) => g.it.kind === 'bistro')
    for (const t of tables) for (const o of groups) {
      if (o === t) continue
      const g = rectGap(t, o)
      if (g > 0.001 && g < best.g) best = { g, a: t, b: o }
    }
    const has = best.g === Infinity ? 0 : best.g
    const [pa, pb] = best.a ? rectPts(best.a, best.b) : [[0, 0], [0, 0]]
    out.push({
      key: 'tables', title: 'Aisles between seating groups', need: RULES.aisle, has, unit: 'm', status: tables.length ? status(has, RULES.aisle) : 'works',
      where: 'Tightest gap between a table (with its chairs pushed in) and the next piece of furniture.',
      method: 'Measured by code over every pair of seating groups.',
      source: 'ADA 2010 §403.5.1 and §902: an accessible route of at least 36 in (0.915 m) to accessible seating.',
      tour: 'Chairs get pulled out in use. Sit at the tightest table and check you can still walk behind it.',
      measure: [pa, pb], pin: [(pa[0] + pb[0]) / 2, 0.05, (pa[1] + pb[1]) / 2],
    })
  }
  // 5. Staff pass beside the counter
  {
    const has = W - counterRight
    const z = counters[0] ? (counters[0].z0 + counters[0].z1) / 2 : 0
    out.push({
      key: 'staff', title: 'Staff pass behind the counter', need: RULES.staffPass, has, unit: 'm', status: status(has, RULES.staffPass),
      where: 'Gap between the end of the counter and the side wall.',
      method: 'Measured by code.',
      source: 'Our rule: 36 in, the same as an accessible route (ADA §403.5.1). Employee-only areas are partly exempt (§203.9).',
      tour: 'Measure the real wall-to-wall width at the back: old buildings are rarely square.',
      measure: [[counterRight, z], [W, z]], pin: [(counterRight + W) / 2, 0.05, z],
    })
  }
  // 6. Headroom under pendants
  {
    const lamps = plan.items.filter((it) => it.kind === 'lamp')
    if (lamps.length) {
      const l = lamps[0], has = (l.y || 2.35) - 0.05, need = 2.03
      out.push({
        key: 'head', title: 'Headroom under the pendants', need, has, unit: 'm', status: status(has, need),
        where: 'Height of the lowest pendant above the floor.',
        method: 'Read from the plan (pendant hung at a fixed height).',
        source: 'ADA 2010 §307.4: 80 in (2.03 m) vertical clearance over circulation paths.',
        tour: 'Measure the ceiling height. Under about 2.8 m, use shorter drops.',
        measure: [[l.x, l.z], [l.x, l.z]], vertical: [l.x, has, l.z], pin: [l.x, has, l.z],
      })
    }
  }
  // 7. One exit is enough? (occupant load)
  {
    const areaFt2 = (W * counterFront) / (FT * FT)
    const load = Math.floor(areaFt2 / 15)
    const travel = D + Math.abs(W / 2 - Z.doorX)
    out.push({
      key: 'exit', title: 'One exit is enough', need: 49, has: load, unit: 'people', lowerIsBetter: true,
      status: load <= 44 && travel / FT <= 75 ? 'works' : load <= 49 && travel / FT <= 75 ? 'tight' : 'fails',
      where: `Occupant load of the dining area (${areaFt2.toFixed(0)} ft² ÷ 15) and walk from the back wall to the door (${(travel / FT).toFixed(0)} ft).`,
      method: 'Worked out by code from the floor area in front of the counter.',
      source: 'NYC Building Code / IBC Table 1004.5 (15 net ft² per person, tables and chairs) and Table 1006.2.1 (one exit if ≤ 49 people and ≤ 75 ft common path).',
      tour: 'Ask the landlord for the Certificate of Occupancy: it caps the number of people allowed.',
      pin: [W / 2, 0.05, counterFront / 2],
    })
  }
  // 8. Seats vs. target
  {
    const has = plan.seats
    out.push({
      key: 'seats', title: `Seats: target ${target}`, need: target, has, unit: 'seats',
      status: has >= target ? (has > target + 2 ? 'works' : 'works') : has >= target * 0.9 ? 'tight' : 'fails',
      where: 'Bar stools, chairs and lounge seats placed by the agent.',
      method: 'Counted by code.',
      source: 'Your request.',
      tour: 'Fewer seats than you hoped? Trade the lounge corner for two more 2-tops.',
      pin: [W * 0.3, 0.05, 1.2],
    })
  }
  return out
}
export const fmtHas = (c) => (c.unit === 'm' ? m(c.has) : `${c.has} ${c.unit}`)
export const fmtNeed = (c) => (c.unit === 'm' ? `≥ ${c.need.toFixed(2)} m` : c.lowerIsBetter ? `≤ ${c.need} ${c.unit}` : `≥ ${c.need} ${c.unit}`)
