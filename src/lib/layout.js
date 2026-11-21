// Rule-based layout planner. Coordinates in meters.
// x: 0..W along the street frontage. z: 0 = front window / street, D = back wall.
// The (optional) LLM only turns the request into parameters; this planner places objects and
// checks clearances, so the 3D result never overlaps or blocks the accessible route.
export const RULES = {
  aisle: 0.915, // 36 in accessible route (ADA 2010 §403.5.1) — verify with Flashpoint research
  mainAisle: 1.2,
  queueDepth: 1.5,
  bohDepth: 2.1,
  counterDepth: 0.75,
  staffPass: 0.915,
}

export function parseRequest(text = '') {
  const t = text.toLowerCase()
  const num = t.match(/(\d{1,3})\s*(个|seats?|位|座)?/)
  const style = /外带|takeout|take-out|grab|快取/.test(t) ? 'takeout' : /堂食|dine|自习|study|laptop|久坐|lounge|沙发/.test(t) ? 'dinein' : 'balanced'
  const windowBar = /窗|window|bar|吧台/.test(t) || style === 'takeout'
  const lounge = /沙发|sofa|lounge|休息/.test(t) || style === 'dinein'
  return { seats: num ? +num[1] : style === 'takeout' ? 12 : 24, style, windowBar, lounge }
}

const box = (it) => ({ x0: it.x - it.w / 2, x1: it.x + it.w / 2, z0: it.z - it.d / 2, z1: it.z + it.d / 2 })
function overlap(a, b, gap = 0) {
  const A = box(a), B = box(b)
  return A.x0 - gap < B.x1 && A.x1 + gap > B.x0 && A.z0 - gap < B.z1 && A.z1 + gap > B.z0
}

export function planLayout({ W, D }, params) {
  const steps = []
  const items = []
  const add = (it) => { const o = { id: `${it.kind}-${items.length}`, rotY: 0, ...it }; items.push(o); return o }
  steps.push(`读取铺面：面宽 ${W.toFixed(1)} m × 进深 ${D.toFixed(1)} m，面积 ${(W * D).toFixed(0)} m²（约 ${(W * D * 10.764).toFixed(0)} sq ft）`)
  steps.push(`理解需求：目标 ${params.seats} 个座位，风格 ${params.style === 'takeout' ? '外带为主' : params.style === 'dinein' ? '堂食为主' : '均衡'}${params.windowBar ? '，临窗吧台' : ''}${params.lounge ? '，沙发休息区' : ''}`)

  // 1. Back of house along the back wall
  let bx = 0.15
  for (const b of [
    { kind: 'fridge', w: 0.75, d: 0.8, h: 2.0, label: '冷藏柜 Fridge' },
    { kind: 'sink', w: 1.5, d: 0.6, h: 0.9, label: '三格水槽 Sink' },
    { kind: 'shelf', w: 1.6, d: 0.35, h: 1.8, label: '储物架 Shelving' },
  ]) {
    if (bx + b.w > W - 0.15) break
    add({ ...b, x: bx + b.w / 2, z: D - b.d / 2 - 0.05, zone: 'boh', product: b.kind })
    bx += b.w + 0.2
  }
  steps.push(`后场：沿后墙放冷藏柜、三格水槽、储物架，后场进深 ${RULES.bohDepth} m`)

  // 2. Service counter with espresso + pastry case, staff pass on the right
  const counterZ = D - RULES.bohDepth - RULES.counterDepth / 2
  const counterLen = Math.max(1.8, Math.min(W - RULES.staffPass - 0.3, 4.8))
  const modules = Math.max(2, Math.floor(counterLen / 1.2))
  for (let i = 0; i < modules; i++) {
    add({ kind: 'counter', w: 1.2, d: RULES.counterDepth, h: 1.0, x: 0.15 + 0.6 + i * 1.2, z: counterZ, zone: 'counter', label: '服务台 Counter', product: 'counter' })
  }
  add({ kind: 'espresso', w: 0.75, d: 0.55, h: 0.5, y: 1.0, x: 0.15 + 0.6, z: counterZ + 0.05, zone: 'counter', label: '意式咖啡机 Espresso', product: 'espresso', onTop: true })
  add({ kind: 'pastry', w: 0.9, d: 0.6, h: 0.45, y: 1.0, x: 0.15 + (modules - 1) * 1.2 + 0.6, z: counterZ, zone: 'counter', label: '甜品柜 Pastry case', product: 'pastry', onTop: true })
  for (let i = 0; i < Math.min(3, modules); i++) {
    add({ kind: 'lamp', w: 0.4, d: 0.4, h: 0.45, y: 2.35, x: 0.15 + 0.6 + i * 1.2 + (modules > 3 ? 0.6 : 0), z: counterZ, zone: 'light', label: '吊灯 Pendant', product: 'lamp', onTop: true })
  }
  steps.push(`服务台：${modules} 段 1.2 m 柜台 + 意式咖啡机 + 甜品柜，右侧留 ${RULES.staffPass} m 员工通道；柜台上方 ${Math.min(3, modules)} 盏吊灯`)

  // 3. Front of house
  const seatZoneEnd = counterZ - RULES.counterDepth / 2 - RULES.queueDepth
  steps.push(`排队区：柜台前留 ${RULES.queueDepth} m 排队空间`)
  const doorX = W * 0.62
  const aisleL = doorX - RULES.mainAisle / 2, aisleR = doorX + RULES.mainAisle / 2
  steps.push(`主通道：门口到柜台保留 ${RULES.mainAisle} m 直通道`)
  let seats = 0
  let zStart = 0.3
  const segs = [[0.15, aisleL - 0.05], [aisleR + 0.05, W - 0.15]]
  if (params.windowBar) {
    const barD = 0.45
    // keep ADA door maneuvering clearance (door + 18 in on the latch side) free of the bar
    const barSegs = [[0.15, doorX - 0.5 - 0.46 - 0.05], [doorX + 0.55, W - 0.15]]
    for (const [x0, x1] of barSegs) {
      const len = x1 - x0
      if (len < 1.2) continue
      add({ kind: 'windowbar', w: len, d: barD, h: 1.05, x: x0 + len / 2, z: 0.1 + barD / 2, zone: 'seat', label: '临窗吧台 Window bar', product: 'windowbar' })
      const n = Math.floor((len - 0.1) / 0.62)
      for (let i = 0; i < n && seats < params.seats; i++) {
        add({ kind: 'stool', w: 0.42, d: 0.42, h: 0.75, x: x0 + 0.36 + i * 0.62, z: 0.1 + barD + 0.25, rotY: Math.PI, zone: 'seat', label: '吧凳 Stool', product: 'stool' })
        seats++
      }
    }
    zStart = 0.1 + 0.45 + 0.5 + RULES.aisle
    steps.push(`临窗吧台：${seats} 个吧凳面朝街道，身后留 ${RULES.aisle} m 通道`)
  }
  // lounge: sofa against the left wall
  const placed = []
  if (params.lounge && aisleL > 2.3 && seatZoneEnd - zStart > 2.4) {
    const sofa = add({ kind: 'sofa', w: 2.2, d: 0.95, h: 0.85, x: 0.15 + 0.475, z: zStart + 1.1, rotY: Math.PI / 2, zone: 'seat', label: '丝绒沙发 Sofa', product: 'sofa' })
    add({ kind: 'coffeetable', w: 0.6, d: 0.6, h: 0.45, x: 1.45, z: zStart + 1.1, zone: 'seat', label: '茶几 Coffee table', product: 'coffeetable' })
    add({ kind: 'armchair', w: 0.75, d: 0.75, h: 0.85, x: Math.min(aisleL - 0.45, 2.3), z: zStart + 1.1, rotY: -Math.PI / 2, zone: 'seat', label: '单人沙发 Armchair', product: 'armchair' })
    placed.push({ x: (0.15 + aisleL) / 2, z: zStart + 1.1, w: aisleL - 0.15, d: 2.2 })
    seats += 3
    steps.push('休息区：左墙放一张丝绒沙发 + 茶几 + 单人沙发（+3 座）')
  }
  if (placed.length) add({ kind: 'rug', w: Math.min(aisleL - 0.3, 2.9), d: 2.7, h: 0.01, y: 0.007, x: 0.15 + Math.min(aisleL - 0.3, 2.9) / 2, z: zStart + 1.1, zone: 'decor', label: '地毯 Rug', onTop: true })
  // banquette along the left wall: one bench, a run of small tables, one chair opposite each.
  // This is how most narrow cafes seat people: it uses the wall and keeps the middle free to walk.
  const T = 0.7, CH = 0.48
  const modD = T + 2 * CH
  let tables = 0, bqEnd = 0.15
  {
    const need0 = Math.max(0, params.seats - seats)
    const zb0 = placed.length ? zStart + 2.2 + 0.75 : zStart + 0.1
    const pitch = 1.3, nMax = Math.floor((seatZoneEnd - 0.15 - zb0) / pitch)
    const reserve = need0 >= 10 ? 2 : need0 >= 6 ? 1 : 0 // keep a few free-standing two-tops for variety
    const nb = params.style !== 'takeout' && aisleL - 0.15 >= 2.0 && nMax >= 2 && need0 >= 2 ? Math.min(nMax, Math.max(2, Math.ceil((need0 - reserve * 2) / 2))) : 0
    if (nb) {
      const len = nb * pitch
      add({ kind: 'banquette', w: 0.55, d: len, h: 0.95, x: 0.15 + 0.275, z: zb0 + len / 2, zone: 'seat', label: '靠墙卡座 Banquette (custom millwork, no product link)' })
      for (let i = 0; i < nb; i++) {
        const z = zb0 + pitch / 2 + i * pitch
        add({ kind: 'cafetable', w: 0.7, d: 0.7, h: 0.75, x: 1.07, z, zone: 'seat', label: '双人桌 Two-top', product: 'bistro' })
        add({ kind: 'cup', w: 0.12, d: 0.12, h: 0.1, y: 0.76, x: 1.0, z: z - 0.1, zone: 'decor', label: '咖啡杯 Cup', product: 'cup', onTop: true })
        add({ kind: 'chair', w: 0.48, d: 0.45, h: 0.82, x: 1.66, z, rotY: -Math.PI / 2, zone: 'seat', label: '餐椅 Chair', product: 'chair' })
        if (i % 2 === 0) add({ kind: 'art', w: 0.03, d: 0.6, h: 0.8, y: 1.45, x: 0.17, z, zone: 'decor', label: '装饰画 Wall art', onTop: true })
        seats += 2; tables++
      }
      placed.push({ x: (0.15 + 1.9) / 2, z: zb0 + len / 2, w: 1.75, d: len })
      bqEnd = 1.9 + RULES.aisle
      segs[0][0] = bqEnd
      steps.push(`靠墙卡座：左墙一条 ${len.toFixed(1)} m 卡座，配 ${nb} 张小桌和对面的椅子（+${nb * 2} 座），中间留出走道`)
    }
  }
  // Build every free table slot row by row, then spread the tables we need evenly over the depth
  // (front to back) instead of packing one side first.
  const colW = T + RULES.aisle, rows = []
  for (let z = zStart + modD / 2; z + modD / 2 <= seatZoneEnd; z += modD + RULES.aisle) {
    const row = []
    for (const [x0, x1] of segs) {
      if (x1 - x0 < T) continue
      const cols = Math.max(0, Math.floor((x1 - x0 + RULES.aisle) / colW))
      const pad = (x1 - x0 - (cols * colW - RULES.aisle)) / 2
      for (let c = 0; c < cols; c++) {
        const mod = { x: x0 + pad + T / 2 + c * colW, z, w: T, d: modD }
        if (!placed.some((p) => overlap(p, mod, 0.45))) row.push(mod)
      }
    }
    if (row.length) rows.push(row)
  }
  const need = Math.ceil(Math.max(0, params.seats - seats) / 2)
  const perRow = Math.max(1, ...rows.map((r) => r.length))
  const useRows = Math.min(rows.length, Math.ceil(need / perRow))
  const picked = useRows <= 1 ? rows.slice(0, useRows) : Array.from({ length: useRows }, (_, i) => rows[Math.round((i * (rows.length - 1)) / (useRows - 1))])
  for (const row of [...new Set(picked)]) for (const mod of row) {
    if (seats >= params.seats) break
    const { x, z } = mod
    placed.push(mod)
    add({ kind: 'bistro', w: T, d: T, h: 0.75, x, z, zone: 'seat', label: '双人桌 Bistro table', product: 'bistro' })
    add({ kind: 'cup', w: 0.12, d: 0.12, h: 0.1, y: 0.76, x: x + 0.12, z: z - 0.1, zone: 'decor', label: '咖啡杯 Cup', product: 'cup', onTop: true })
    add({ kind: 'chair', w: 0.45, d: 0.48, h: 0.82, x, z: z - T / 2 - 0.2, rotY: Math.PI, zone: 'seat', label: '餐椅 Chair', product: 'chair' })
    add({ kind: 'chair', w: 0.45, d: 0.48, h: 0.82, x, z: z + T / 2 + 0.2, rotY: 0, zone: 'seat', label: '餐椅 Chair', product: 'chair' })
    seats += 2; tables++
  }
  steps.push(`座位区：${tables} 张双人桌，桌组前后保持 ≥ ${RULES.aisle} m 无障碍通道`)
  add({ kind: 'plant', w: 0.6, d: 0.6, h: 1.4, x: W - 0.45, z: Math.max(0.9, seatZoneEnd - 0.4), zone: 'decor', label: '绿植 Plant', product: 'plant' })

  // 4. Checks
  const checks = []
  const floorItems = items.filter((it) => !it.onTop)
  const blockers = floorItems.filter((it) => it.zone !== 'boh' && it.zone !== 'counter' && it.x + it.w / 2 > aisleL && it.x - it.w / 2 < aisleR && it.z - it.d / 2 < seatZoneEnd && it.z + it.d / 2 > zStart - 0.4)
  checks.push({ ok: blockers.length === 0, text: `主通道 ${RULES.mainAisle} m 畅通` })
  checks.push({ ok: seats >= params.seats, text: `座位 ${seats}/${params.seats}${seats < params.seats ? '（空间不足：减座位或改外带）' : ''}` })
  checks.push({ ok: seatZoneEnd > zStart, text: `排队区 ${RULES.queueDepth} m 保留` })
  let collisions = 0
  const solid = floorItems.filter((it) => !['chair', 'stool'].includes(it.kind))
  for (let i = 0; i < solid.length; i++) for (let j = i + 1; j < solid.length; j++) {
    const a = solid[i], b = solid[j]
    const ra = Math.abs(Math.sin(a.rotY)) > 0.5, rb = Math.abs(Math.sin(b.rotY)) > 0.5
    if (overlap(ra ? { ...a, w: a.d, d: a.w } : a, rb ? { ...b, w: b.d, d: b.w } : b, -0.01)) collisions++
  }
  checks.push({ ok: collisions === 0, text: collisions ? `${collisions} 处家具重叠` : '无家具重叠' })
  steps.push(`校验：${checks.filter((c) => c.ok).length}/${checks.length} 项通过`)
  return { items, steps, checks, seats, zones: { seatZoneEnd, counterZ, zStart, aisle: [aisleL, aisleR], doorX } }
}

// Optional: let an LLM turn free text into planner params. Falls back to parseRequest.
export async function llmParams(text) {
  const base = import.meta.env.VITE_LLM_BASE_URL, key = import.meta.env.VITE_LLM_API_KEY, model = import.meta.env.VITE_LLM_MODEL
  if (!base || !key || !model) return { ...parseRequest(text), via: 'rules' }
  try {
    const r = await fetch(`${base}/chat/completions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, temperature: 0, messages: [
        { role: 'system', content: 'Extract cafe layout parameters. Reply with JSON only: {"seats":int,"style":"takeout"|"dinein"|"balanced","windowBar":bool,"lounge":bool}' },
        { role: 'user', content: text } ] }),
    })
    const j = await r.json()
    const p = JSON.parse(j.choices[0].message.content.replace(/```json|```/g, ''))
    return { ...parseRequest(text), ...p, via: 'llm' }
  } catch { return { ...parseRequest(text), via: 'rules' } }
}
