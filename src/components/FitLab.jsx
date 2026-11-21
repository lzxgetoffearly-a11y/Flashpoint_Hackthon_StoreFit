import React, { useEffect, useMemo, useRef, useState } from 'react'
import Scene3D from './Scene3D.jsx'
import { useLidar } from './Lidar.jsx'
import { buildScene, fmtRange, fmtM, fmtFt, METHODS } from '../lib/scene.js'
import { llmParams, parseRequest } from '../lib/layout.js'
import { PRODUCTS, PRICE_DATE } from '../data/products.js'
import { estimateRoom } from '../data/candidates.js'
import './fitlab.css'

const FT = 0.3048
const V = { WORKS: 'Works', TIGHT: 'Tight', FAILS: 'Fails', NEEDS: 'Needs measuring' }
const ORDER = ['FAILS', 'TIGHT', 'NEEDS', 'WORKS']
const Pill = ({ v, n }) => <span className={'pill-v ' + v.toLowerCase()}>{n != null && <b>{n}</b>} {n != null ? V[v].split(' ')[0] : V[v]}</span>
const need = (c) => `${c.op === '<=' ? '≤' : '≥'} ${c.need.unit === 'm' ? `${fmtM(c.need.value)} · ${fmtFt(c.need.value)}` : `${c.need.value} ${c.need.unit}`}`

function BuyLink({ p }) {
  return <a className={'buy ' + p.link.kind} href={p.link.url} target="_blank" rel="noreferrer">{p.link.kind === 'exact' ? `Buy on ${p.link.retailer} ↗` : `View on ${p.link.retailer} ↗`}</a>
}
function Shop({ items, onPick }) {
  const groups = {}
  const list = items.filter((it) => PRODUCTS[it.product])
  for (const it of list) { const p = PRODUCTS[it.product]; const g = (groups[p.cat] ||= {}); (g[it.product] ||= { p, n: 0, first: it }).n++ }
  const sum = list.reduce((a, it) => a + (PRODUCTS[it.product].price || 0), 0)
  const unpriced = list.filter((it) => !PRODUCTS[it.product].price).length
  return (
    <div className="shop">
      <div className="shop-sum"><b>${sum.toLocaleString(undefined, { maximumFractionDigits: 0 })}</b> list-price estimate<small>Retailer list prices seen {PRICE_DATE}. Leaves out {unpriced} items with no captured price, plus tax, delivery and install.</small></div>
      {Object.entries(groups).map(([cat, g]) => (
        <div key={cat}>
          <div className="shop-cat">{cat}</div>
          {Object.entries(g).map(([k, r]) => (
            <div key={k} className="shop-row">
              <span className="qty">{r.n}×</span>
              <span className="sname" onClick={() => onPick(r.first.id)}>{r.p.name}{r.p.price ? <em>${r.p.price.toLocaleString()} each</em> : null}</span>
              <BuyLink p={r.p} />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function Check({ c, i, open, onOpen, sweep, setSweep }) {
  const m = c.haveMeasure
  const sw = c.sweep
  const here = sw && m?.value != null ? m.value + (open ? sweep : 0) : null
  const fits = here != null && (c.op === '<=' ? here <= c.need.value : here >= c.need.value)
  return (
    <li className={'chk ' + c.verdict.toLowerCase() + (open ? ' open' : '')}>
      <button className="chk-row" onClick={() => onOpen(open ? null : c.id)}>
        <span className="num">{i + 1}</span>
        <span className="chk-t">{c.label}<em>{m?.value != null ? fmtRange(m) : 'not measured'} <i>needs {c.op === '<=' ? '≤' : '≥'} {c.need.unit === 'm' ? fmtM(c.need.value) : `${c.need.value} ${c.need.unit}`}</i></em></span>
        <Pill v={c.verdict} />
      </button>
      {open && (
        <div className="chk-body">
          <p>{c.explain}</p>
          <dl>
            <div><dt>Needs</dt><dd>{need(c)}<small>{c.need.source}</small></dd></div>
            <div><dt>Has</dt><dd>{m?.value != null ? fmtRange(m) : 'Not measured yet'}<small>{m?.label}</small></dd></div>
            <div><dt>Method</dt><dd>{METHODS[m?.method] || m?.method}</dd></div>
            <div><dt>Source</dt><dd className="src">{m?.source}</dd></div>
          </dl>
          {sw && m?.value != null && (
            <div className="sweep">
              <label>{sw.label}<input type="range" min={sw.min} max={sw.max} step={0.01} value={sweep} onChange={(e) => setSweep(+e.target.value)} /></label>
              <output>Room here <b>{fmtM(here)}</b> · {fmtFt(here)} · <span className={fits ? 'ok' : 'no'}>{fits ? 'fits' : 'too tight'}</span> (needs {fmtM(c.need.value)})</output>
            </div>
          )}
          {c.tour && <div className="tour"><span>On the tour</span>{c.tour}</div>}
        </div>
      )}
    </li>
  )
}

const DOCK = [
  [['overview', 'Overview'], ['top', 'Top'], ['street', 'Street'], ['inside', 'Inside']],
  [['walk', 'Walk in']],
]

export default function FitLab({ site, state, setState }) {
  const est = useMemo(() => estimateRoom(site), [site])
  const [w, setW] = useState(est.wFt), [d, setD] = useState(est.dFt)
  const [req, setReq] = useState(state.request)
  const [params, setParams] = useState(() => parseRequest(state.request))
  const [via, setVia] = useState('rules')
  const [busy, setBusy] = useState(false)
  const [altId, setAltId] = useState('brief')
  const [openSec, setOpenSec] = useState('entry')
  const [active, setActive] = useState(null)
  const [sweep, setSweep] = useState(0)
  const [picked, setPicked] = useState(null)
  const [view, setView] = useState('inside')
  const [layers, setLayers] = useState({ dims: true, zones: false, block: true, lidar: false })
  const [dark, setDark] = useState(() => { try { return localStorage.getItem('fitlab-theme') !== 'light' } catch { return true } })
  const [brief, setBrief] = useState(false)
  const compassRef = useRef(null)
  const room = useMemo(() => ({ W: w * FT, D: d * FT }), [w, d])
  const lidarData = useLidar(site.id, room.W, room.D)
  const dimsSource = w === est.wFt && d === est.dFt ? est.source : 'user'
  const scene = useMemo(() => buildScene({ site, room, request: req, params, dimsSource, est, lidar: lidarData?.info }), [site, room, params, dimsSource, lidarData?.info])
  const alt = scene.alternatives.find((a) => a.id === altId) || scene.alternatives[0]
  const plan = alt
  useEffect(() => { setState((s) => ({ ...s, plan: { ...alt, steps: alt.sections.find((x) => x.steps)?.steps || [], checks: alt.checks.map((c) => ({ ok: c.verdict === 'WORKS', text: `${c.label}: ${V[c.verdict]}` })) }, scene, request: req, room: { wFt: w, dFt: d } })) }, [alt])
  useEffect(() => { try { localStorage.setItem('fitlab-theme', dark ? 'dark' : 'light') } catch {} }, [dark])
  async function run() {
    setBusy(true)
    const p = await llmParams(req)
    setVia(p.via || 'rules'); setParams(p); setAltId('brief'); setActive(null); setBusy(false); setBrief(false)
  }
  const pick = (id) => { setActive(id); setSweep(0); setPicked(null); if (id) { const s = alt.sections.find((x) => x.checks?.includes(id)); if (s) setOpenSec(s.id) } }
  const openSection = (s) => { const o = openSec === s.id ? null : s.id; setOpenSec(o); setActive(null); setSweep(0); if (o) setView(s.view) }
  const count = (v) => alt.checks.filter((c) => c.verdict === v).length
  const ac = alt.checks.find((c) => c.id === active)
  // move the measure line with the slider
  const checks3d = useMemo(() => alt.checks.map((c) => {
    if (c.id !== active || !c.sweep || !c.measure || !sweep) return c
    const m = c.measure.map((p) => [...p])
    if (c.sweep.kind === 'wallR') m[1][0] += sweep
    if (c.sweep.kind === 'back') m[1][1] += sweep
    if (c.sweep.kind === 'chair') { const dx = m[1][0] - m[0][0], dz = m[1][1] - m[0][1], L = Math.hypot(dx, dz) || 1; m[0][0] -= (dx / L) * sweep; m[0][1] -= (dz / L) * sweep }
    return { ...c, measure: m }
  }), [alt, active, sweep])
  const pickedItem = picked ? alt.items.find((x) => x.id === picked) : null
  const pp = pickedItem && PRODUCTS[pickedItem.product]
  const download = () => {
    const blob = new Blob([JSON.stringify(scene, null, 1)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `scene-${site.id}.json`; a.click()
  }
  const tog = (k) => setLayers((l) => ({ ...l, [k]: !l[k] }))
  return (
    <section className={'fitlab ' + (dark ? 'dark' : 'light')}>
      <aside id="panel">
        <header>
          <p className="eyebrow">Fit check</p>
          <h1>Cafe at {site.address}</h1>
          <p className="addr">{site.address}, New York, NY {site.zip}</p>
          <p className="use">{req}</p>
          <button className="linkbtn" onClick={() => setBrief(!brief)}>{brief ? 'Close' : 'Change the brief or the room size'}</button>
          {brief && (
            <div className="brief">
              <div className="two">
                <label>Frontage (ft)<input type="number" value={w} onChange={(e) => setW(+e.target.value || 1)} /></label>
                <label>Depth (ft)<input type="number" value={d} onChange={(e) => setD(+e.target.value || 1)} /></label>
              </div>
              <label>Brief<textarea rows={2} value={req} onChange={(e) => setReq(e.target.value)} /></label>
              <button className="run" disabled={busy} onClick={run}>{busy ? 'Agent working…' : 'Run layout agent'}</button>
              <small>Brief parsed by {via === 'llm' ? 'an LLM' : 'built-in rules (no API key set)'}. Placement and checks are a rule engine.</small>
            </div>
          )}
        </header>
        <details className="opts">
          <summary><span className={'dot ' + ORDER.find((v) => count(v) > 0).toLowerCase()} /><b>{alt.name}</b><span className="n">{scene.alternatives.length} layouts</span></summary>
          <div className="opt-list">
            {scene.alternatives.map((a) => (
              <button key={a.id} className={a.id === alt.id ? 'on' : ''} onClick={(e) => { setAltId(a.id); setActive(null); setPicked(null); e.currentTarget.closest('details').open = false }}>
                <span className={'dot ' + ORDER.find((v) => a.checks.some((c) => c.verdict === v)).toLowerCase()} />{a.name}<span className="n">{a.seats} seats</span>
              </button>
            ))}
          </div>
        </details>
        <div id="summary">{ORDER.filter((v) => count(v)).map((v) => <Pill key={v} v={v} n={count(v)} />)}</div>
        <section id="checks">
          {alt.sections.map((s) => {
            const cs = (s.checks || []).map((id) => alt.checks.find((c) => c.id === id))
            const open = openSec === s.id
            return (
              <section key={s.id} className={'sec' + (open ? ' open' : '')}>
                <button className="sec-row" onClick={() => openSection(s)}>
                  <span>{s.title}</span>
                  <span className="sec-pills">{ORDER.filter((v) => cs.some((c) => c.verdict === v)).map((v) => <Pill key={v} v={v} n={cs.filter((c) => c.verdict === v).length} />)}<i className="chev" /></span>
                </button>
                {open && (
                  <div className="sec-body">
                    {s.body && <p>{s.body}</p>}
                    {s.table && (
                      <table><thead><tr><th>What</th><th>Range</th><th>How we know</th></tr></thead>
                        <tbody>{alt.measures.filter((m) => ['frontage', 'depth', 'area', 'ceiling', 'door'].includes(m.id)).map((m) => <tr key={m.id}><td>{m.label}</td><td>{fmtRange(m)}</td><td>{METHODS[m.method]}</td></tr>)}</tbody></table>
                    )}
                    {cs.length > 0 && <ol className="chks">{cs.map((c) => <Check key={c.id} c={c} i={alt.checks.indexOf(c)} open={active === c.id} onOpen={pick} sweep={sweep} setSweep={setSweep} />)}</ol>}
                    {s.shop && <Shop items={alt.items} onPick={(id) => { setPicked(id); setActive(null) }} />}
                    {s.steps && <><ol className="steps">{s.steps.map((t, i) => <li key={i}>{t}</li>)}</ol><button className="linkbtn" onClick={download}>Download scene.json ↓</button></>}
                  </div>
                )}
              </section>
            )
          })}
        </section>
        <details id="facts">
          <summary>The property</summary>
          <dl className="facts">
            <div><dt>Address</dt><dd>{site.address}, {site.zip}</dd><small>city vacancy record</small></div>
            <div><dt>Last use</dt><dd>{site.prevUse.toLowerCase()}</dd><small>city vacancy record, 2025</small></div>
            <div><dt>Room</dt><dd>{room.W.toFixed(1)} × {room.D.toFixed(1)} m · {Math.round(w * d)} ft²</dd><small>{dimsSource === 'pluto' ? `estimated: ${est.areaFt2.toLocaleString()} ft² = lot retail area ÷ storefronts (PLUTO)` : dimsSource === 'default' ? 'assumed, not measured' : 'typed in, not measured'}</small></div>
            {site.pluto && <div><dt>Building</dt><dd>{site.pluto.numfloors} floors, built {site.pluto.yearbuilt}, zoning {site.pluto.zone}</dd><small>NYC PLUTO 26v2, lot {site.pluto.bbl}; {site.pluto.retailarea.toLocaleString()} ft² retail across {site.pluto.storefronts} storefronts</small></div>}
            {lidarData && <div><dt>Ground</dt><dd>{lidarData.info.groundElevM} m</dd><small>LiDAR, at the centre</small></div>}
            {lidarData && <div><dt>Faces</dt><dd>street on the {lidarData.info.streetSide} side</dd><small>found from the LiDAR points; approximate</small></div>}
          </dl>
          <p className="built">Built {scene.builtAt.slice(0, 16).replace('T', ' ')} UTC · USGS 3DEP NY_NewYorkCity 2017</p>
        </details>
      </aside>
      <main id="stage">
        <Scene3D room={room} plan={plan} onPick={(id) => { setPicked(id === picked ? null : id); setActive(null) }} picked={picked}
          showZones={layers.zones} dims={layers.dims && !layers.lidar && view !== 'overview'} block={layers.block && view === 'overview' && !active} lidar={layers.lidar} lidarData={lidarData}
          dark={dark} view={view} checks={checks3d} activeCheck={active} onCheck={pick} compassRef={compassRef}
          sweep={ac?.sweep ? { kind: ac.sweep.kind, off: sweep } : null} />
        <div id="brand"><span className="ring" />STOREFIT<i />Fit Lab</div>
        <div id="north"><span ref={compassRef}><b>N</b></span></div>
        {pp && (
          <div className="pcard">
            <button className="x" onClick={() => setPicked(null)}>×</button>
            <small>{pp.cat}</small>
            <div className="pname">{pp.name}</div>
            <div className="pdims">{(pickedItem.w * 100).toFixed(0)} × {(pickedItem.d * 100).toFixed(0)} × {(pickedItem.h * 100).toFixed(0)} cm in the plan</div>
            <div className="pprice">{pp.price ? `$${pp.price.toLocaleString()}` : 'Price on retailer page'}{pp.price ? <small> seen {PRICE_DATE}</small> : null}</div>
            <span className={'tagk ' + pp.link.kind}>{pp.link.kind === 'exact' ? 'Exact product: the 3D model is this item' : 'Similar product: the 3D model is generic'}</span>
            <BuyLink p={pp} />
          </div>
        )}
        {layers.lidar && lidarData && (
          <div id="lidar-note">
            <b>LiDAR · USGS 2017</b>
            <div>{lidarData.info.total.toLocaleString()} points within {lidarData.info.radiusM} m</div>
            <div className="lg-row"><span className="dot g" />ground <span className="grad" />2–30+ m high</div>
            <small>Roofs, trees and street only, not the inside. The shop’s position on the block is approximate.</small>
          </div>
        )}
        <nav id="dock">
          <div className="seg">{DOCK[0].map(([k, l]) => <button key={k} className={view === k && !active ? 'on' : ''} onClick={() => { setActive(null); setView(k) }}>{l}</button>)}</div>
          <button id="walk" className={view === 'walk' && !active ? 'on' : ''} onClick={() => { setActive(null); setView('walk') }}>Walk in</button>
          <div className="seg">
            <button className={layers.dims ? 'on' : ''} onClick={() => tog('dims')}>Dimensions</button>
            <button className={layers.zones ? 'on' : ''} onClick={() => tog('zones')}>Zones</button>
            <button className={layers.block ? 'on' : ''} onClick={() => tog('block')}>Block</button>
            <button className={layers.lidar ? 'on' : ''} onClick={() => { tog('lidar'); if (!layers.lidar) { setActive(null); setView('overview') } }}>LiDAR</button>
            <button className={dark ? 'on' : ''} onClick={() => setDark(!dark)}>Dark</button>
          </div>
        </nav>
        <div id="credit">Sofa, lamp: Wayfair (CC-BY 4.0) · Chair, cup: Wayfair/Khronos (CC0) · Plant: DGG (CC-BY 4.0) · LiDAR: USGS 3DEP</div>
      </main>
    </section>
  )
}
