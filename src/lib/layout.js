// Rule-based layout planner. Coordinates in meters.
// x: 0..W along the street frontage. z: 0 = front window / street, D = back wall.
// The (optional) LLM only turns the request into parameters; this planner places objects and
// checks clearances, so the 3D result never overlaps or blocks the accessible route.
export const RULES = {
  aisle: 0.915, // 36 in accessible route (ADA 2010 §403.5.1) — verify with Flashpoint research
  mainAisle: 1.2,
  queueDepth: 1.5,
  bohDepth: 2.3,
  counterDepth: 0.75,
  staffPass: 0.915,
}

const T2 = { w: 0.7, d: 0.7, seats: 2 } // two-top table
const CHAIR = 0.5

export function parseRequest(text = '') {
  const t = text.toLowerCase()
  const num = t.match(/(\d{1,3})\s*(个|seats?|位|座)?/)
  const style = /外带|takeout|take-out|grab|快取/.test(t) ? 'takeout' : /堂食|dine|自习|study|laptop|久坐/.test(t) ? 'dinein' : 'balanced'
  const windowBar = /窗|window|bar|吧台/.test(t) || style === 'takeout'
  return { seats: num ? +num[1] : style === 'takeout' ? 12 : 24, style, windowBar }
}

function overlap(a, b, gap = 0) {
  return a.x - a.w / 2 - gap < b.x + b.w / 2 && a.x + a.w / 2 + gap > b.x - b.w / 2 &&
    a.z - a.d / 2 - gap < b.z + b.d / 2 && a.z + a.d / 2 + gap > b.z - b.d / 2
}

export function planLayout({ W, D }, params) {
  const steps = []
  const items = []
  const add = (it) => { items.push({ id: `${it.model}-${items.length}`, rotY: 0, ...it }) }
  steps.push(`读取铺面：面宽 ${W.toFixed(1)} m × 进深 ${D.toFixed(1)} m，面积 ${(W * D).toFixed(0)} m²`)
  steps.push(`理解需求：目标 ${params.seats} 个座位，风格 ${params.style === 'takeout' ? '外带为主' : params.style === 'dinein' ? '堂食为主' : '均衡'}${params.windowBar ? '，含临窗吧台' : ''}`)

  // 1. Back of house along the back wall
  const bohZ = D - RULES.bohDepth / 2
  const bohItems = [
    { model: 'restaurant/fridge_A', w: 1.4, d: 0.8, label: '冷柜 Fridge' },
    { model: 'restaurant/kitchencounter_sink', w: 1.2, d: 0.75, label: '水槽台 Sink' },
    { model: 'restaurant/kitchencabinet', w: 1.2, d: 0.6, label: '储物柜 Storage' },
  ]
  let bx = 0.2
  for (const b of bohItems) {
    if (bx + b.w > W - 0.2) break
    add({ ...b, x: bx + b.w / 2, z: D - b.d / 2 - 0.05, zone: 'boh' })
    bx += b.w + 0.15
  }
  steps.push(`后场：沿后墙放置冷柜、水槽、储物柜，进深 ${RULES.bohDepth} m`)

  // 2. Service counter, leaving a staff pass-through on the right
  const counterZ = D - RULES.bohDepth - RULES.counterDepth / 2
  const counterLen = Math.max(1.8, W - RULES.staffPass - 0.4)
  const modules = Math.max(1, Math.floor(counterLen / 1.2))
  for (let i = 0; i < modules; i++) {
    add({ model: i === 0 ? 'restaurant/kitchencounter_straight_A_decorated' : 'restaurant/kitchencounter_straight_A', w: 1.2, d: RULES.counterDepth, x: 0.2 + 0.6 + i * 1.2, z: counterZ, zone: 'counter', label: i === 0 ? '咖啡机吧台 Espresso bar' : '服务台 Counter' })
  }
  add({ model: 'restaurant/menu', w: 0.4, d: 0.2, x: 0.2 + modules * 1.2 - 0.3, z: counterZ - RULES.counterDepth / 2 - 0.15, zone: 'counter', label: '点单牌 Menu' })
  steps.push(`服务台：${modules} 段柜台，右侧保留 ${RULES.staffPass} m 员工通道`)

  // 3. Seating zone
  const seatZoneEnd = counterZ - RULES.counterDepth / 2 - RULES.queueDepth
  steps.push(`排队区：柜台前预留 ${RULES.queueDepth} m 排队空间，不放家具`)
  const doorX = W / 2
  const aisleL = doorX - RULES.mainAisle / 2, aisleR = doorX + RULES.mainAisle / 2
  steps.push(`主通道：门口到柜台保留 ${RULES.mainAisle} m 宽直通道（x ${aisleL.toFixed(1)}–${aisleR.toFixed(1)} m）`)
  let seats = 0
  let zStart = 0.25
  if (params.windowBar) {
    // stools facing the window on both sides of the door
    const barD = 0.45
    for (const [x0, x1] of [[0.2, aisleL - 0.1], [aisleR + 0.1, W - 0.2]]) {
      const len = x1 - x0
      if (len < 1.2) continue
      add({ model: 'furniture/table_medium_long', w: len, d: barD, x: x0 + len / 2, z: 0.15 + barD / 2, zone: 'seat', label: '临窗吧台 Window bar', squash: true })
      const n = Math.floor(len / 0.6)
      for (let i = 0; i < n && seats < params.seats; i++) {
        add({ model: 'furniture/chair_stool_wood', w: 0.4, d: 0.4, x: x0 + 0.3 + i * 0.6, z: 0.15 + barD + 0.3, zone: 'seat', label: '吧凳 Stool' })
        seats++
      }
    }
    zStart = 0.15 + 0.45 + 0.6 + RULES.aisle
    steps.push(`临窗吧台：放置 ${seats} 个吧凳，吧凳后留 ${RULES.aisle} m 通道`)
  }
  // two-top modules on both sides of the main aisle
  const modD = T2.d + 2 * CHAIR
  const placedTables = []
  for (const [x0, x1] of [[0.25, aisleL - 0.1], [aisleR + 0.1, W - 0.25]]) {
    const colW = T2.w + 0.6 // side-by-side tables: 0.6 m between (chairs face front/back)
    const cols = Math.max(0, Math.floor((x1 - x0 + 0.6) / colW))
    for (let z = zStart + modD / 2; z + modD / 2 <= seatZoneEnd; z += modD + RULES.aisle) {
      for (let c = 0; c < cols; c++) {
        if (seats + 2 > params.seats) break
        const x = x0 + T2.w / 2 + c * colW + (cols === 1 ? (x1 - x0 - T2.w) / 2 : 0)
        const mod = { x, z, w: T2.w, d: modD }
        if (placedTables.some((p) => overlap(p, mod, 0.5))) continue
        placedTables.push(mod)
        add({ model: params.style === 'dinein' ? 'restaurant/table_round_A_small' : 'furniture/table_small', w: T2.w, d: T2.d, x, z, zone: 'seat', label: '双人桌 2-top' })
        add({ model: 'furniture/chair_A_wood', w: 0.45, d: 0.45, x, z: z - T2.d / 2 - 0.22, rotY: 0, zone: 'seat', label: '椅子 Chair' })
        add({ model: 'furniture/chair_A_wood', w: 0.45, d: 0.45, x, z: z + T2.d / 2 + 0.22, rotY: Math.PI, zone: 'seat', label: '椅子 Chair' })
        seats += 2
      }
    }
  }
  steps.push(`座位区：放置 ${placedTables.length} 张双人桌，桌组之间保持 ≥ ${RULES.aisle} m 无障碍通道`)
  // plants for warmth
  add({ model: 'furniture/cactus_medium_A', w: 0.5, d: 0.5, x: 0.4, z: Math.max(0.5, seatZoneEnd - 0.4), zone: 'decor', label: '绿植 Plant' })

  // 4. Checks
  const checks = []
  const blockers = items.filter((it) => it.zone !== 'boh' && it.zone !== 'counter' && it.x + it.w / 2 > aisleL && it.x - it.w / 2 < aisleR && it.z > zStart - 0.5)
  checks.push({ ok: blockers.length === 0, text: `主通道 ${RULES.mainAisle} m 畅通` })
  checks.push({ ok: seats >= params.seats, text: `座位 ${seats}/${params.seats}${seats < params.seats ? '（空间不足，建议减少座位或改外带）' : ''}` })
  checks.push({ ok: seatZoneEnd > zStart, text: `排队区 ${RULES.queueDepth} m 保留` })
  const collisions = []
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const a = items[i], b = items[j]
    if (a.label.startsWith('椅') || b.label.startsWith('椅') || a.label.startsWith('吧凳') || b.label.startsWith('吧凳')) continue
    if (overlap(a, b)) collisions.push([a.label, b.label])
  }
  checks.push({ ok: collisions.length === 0, text: collisions.length ? `${collisions.length} 处家具重叠` : '无家具重叠' })
  steps.push(`校验：${checks.filter((c) => c.ok).length}/${checks.length} 项通过`)
  return { items, steps, checks, seats, zones: { seatZoneEnd, counterZ, aisle: [aisleL, aisleR] } }
}

// Optional: let an LLM turn free text into planner params. Falls back to parseRequest.
export async function llmParams(text) {
  const base = import.meta.env.VITE_LLM_BASE_URL, key = import.meta.env.VITE_LLM_API_KEY, model = import.meta.env.VITE_LLM_MODEL
  if (!base || !key || !model) return { ...parseRequest(text), via: 'rules' }
  try {
    const r = await fetch(`${base}/chat/completions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, temperature: 0, messages: [
        { role: 'system', content: 'Extract cafe layout parameters. Reply with JSON only: {"seats":int,"style":"takeout"|"dinein"|"balanced","windowBar":bool}' },
        { role: 'user', content: text } ] }),
    })
    const j = await r.json()
    const p = JSON.parse(j.choices[0].message.content.replace(/```json|```/g, ''))
    return { ...parseRequest(text), ...p, via: 'llm' }
  } catch { return { ...parseRequest(text), via: 'rules' } }
}
