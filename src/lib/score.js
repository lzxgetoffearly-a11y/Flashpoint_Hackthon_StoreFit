// Transparent site score. Every factor shows its raw value, the rule and the source.
// Weights are a starting point; EDIT them after the Flashpoint research (see docs/RESEARCH.md).
import { RIDER_WEEK } from './nycdata.js'
export const WEIGHTS = { demand: 0.3, competition: 0.25, transit: 0.2, buildout: 0.15, rent: 0.1 }

const clamp = (x) => Math.max(0, Math.min(100, x))

export function scoreSite(c, s, opts = {}) {
  const f = []
  // Demand proxy: how many food businesses already operate within the radius (foot traffic magnet).
  const demand = clamp((s.foodCount / 60) * 100)
  f.push({ key: 'demand', label: '餐饮活跃度 Demand proxy', value: `${s.foodCount} food businesses within ${s.radius} m`, score: demand, source: 'dohmh',
    why: 'More food businesses nearby usually means steady foot traffic. Proxy only, not a pedestrian count.' })
  // Competition: coffee/tea shops nearby. A few validate demand; many means a crowded market.
  const n = s.cafes.length
  const competition = clamp(n <= 2 ? 80 + n * 5 : 100 - (n - 2) * 9)
  f.push({ key: 'competition', label: '同类竞品 Coffee competitors', value: `${n} coffee/tea shops within ${s.radius} m`, score: competition, source: 'dohmh',
    why: '1–2 competitors confirm demand; each extra one splits the same customers.' })
  // Transit
  const d = s.subway?.d ?? 9999
  const near = clamp(100 - Math.max(0, d - 100) / 4)
  const daily = s.subway?.daily ?? null
  // 20,000 entries a day is a busy local station on the 1 line; scale to that.
  const flow = daily == null ? null : clamp((daily / 20000) * 100)
  const transit = flow == null ? near : 0.5 * near + 0.5 * flow
  f.push({ key: 'transit', label: '地铁客流 Subway access and ridership', score: transit, source: daily == null ? 'mta' : 'riders',
    value: s.subway ? `${Math.round(d)} m to ${s.subway.name} (${s.subway.routes})${daily == null ? '' : ` · ${daily.toLocaleString()} entries a day`}` : 'n/a',
    why: daily == null ? 'Walking distance only: station ridership was not available for this run.' : `Half walking distance, half station entries per day (average over ${RIDER_WEEK.label}).` })
  // Build-out: previous food use means ventilation / plumbing may already exist.
  const food = /FOOD/i.test(c.prevUse)
  const buildout = food ? 90 : /RETAIL/i.test(c.prevUse) ? 60 : 45
  f.push({ key: 'buildout', label: '前业态 Previous use', value: c.prevUse, score: buildout, source: 'storefront',
    why: food ? 'Former food service: plumbing / venting likely reusable (verify on tour).' : 'Non-food use: budget for kitchen build-out.' })
  // Rent: only if the user enters asking rent and expected monthly revenue. Never invented.
  let rentScore = null
  if (opts.rent && opts.revenue) {
    const ratio = opts.rent / opts.revenue
    rentScore = clamp(100 - Math.max(0, ratio - 0.08) * 600)
    f.push({ key: 'rent', label: '租金压力 Rent / revenue', value: `${(ratio * 100).toFixed(1)}% of expected revenue`, score: rentScore, source: 'user',
      why: 'Rule of thumb to verify with Flashpoint research: keep occupancy cost low relative to revenue.' })
  }
  const used = f.filter((x) => x.score !== null)
  const wsum = used.reduce((a, x) => a + WEIGHTS[x.key], 0)
  const total = used.reduce((a, x) => a + x.score * WEIGHTS[x.key], 0) / wsum
  return { total: Math.round(total), factors: f }
}
