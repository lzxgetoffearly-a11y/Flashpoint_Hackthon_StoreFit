import React, { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Circle, Tooltip, ScaleControl, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import { PRODUCTS, PRICE_DATE } from './data/products.js'
import { candidates, DATASET_URL, snapshot, estimateRoom } from './data/candidates.js'
import { research } from './data/research.js'
import { fetchSignals, SOURCES } from './lib/nycdata.js'
import { scoreSite, WEIGHTS } from './lib/score.js'
import { planLayout, llmParams, RULES } from './lib/layout.js'
import FitLab from './components/FitLab.jsx'

const FT = 0.3048

function Nav({ page, go }) {
  return (
    <header className="nav">
      <div className="logo" onClick={() => go('home')}><span className="ring" />STOREFIT</div>
      <nav>
        {[['sites', '选址 Sites'], ['layout', '布局 Layout'], ['research', '调研依据 Research'], ['report', '报告 Report']].map(([k, l]) => (
          <a key={k} className={page === k ? 'on' : ''} onClick={() => go(k)}>{l}</a>
        ))}
      </nav>
      <button className="pill" onClick={() => go('sites')}>Start a search</button>
    </header>
  )
}

function Home({ go }) {
  const ticker = ['Pulling vacant storefronts from NYC open data…', 'Counting coffee shops within 300 m…', 'Measuring walk to the nearest subway…', 'Placing the counter, keeping a 1.2 m aisle…']
  const [i, setI] = useState(0)
  useEffect(() => { const t = setInterval(() => setI((x) => (x + 1) % ticker.length), 1800); return () => clearInterval(t) }, [])
  return (
    <section className="hero">
      <div className="blob b1" /><div className="blob b2" /><div className="blob b3" />
      <div className="hero-inner">
        <div className="badge">Prototype · Flashpoint AI × CUB Hackathon</div>
        <h1>Find the storefront.<br />Fit the store.</h1>
        <p className="lead">第一次开店，从“选哪个铺面”到“店里怎么摆”，一个 AI 顾问陪你走完。每一个分数都能点开看到公开数据来源。</p>
        <div className="row">
          <button className="pill big" onClick={() => go('sites')}>Start a search →</button>
          <button className="ghost" onClick={() => go('research')}>How we decided</button>
        </div>
        <div className="ticker"><span className="dot" />{ticker[i]}</div>
      </div>
      <div className="steps3">
        <div><b>01</b><h3>Shortlist real vacancies</h3><p>Vacant storefronts reported to NYC (Local Law 157), around Columbia.</p></div>
        <div><b>02</b><h3>Score with public data</h3><p>Competitors, food activity, subway access, previous use. Sources on every line.</p></div>
        <div><b>03</b><h3>Fit the store in 3D</h3><p>An agent lays out counter, queue and seats, then checks aisles and overlaps.</p></div>
      </div>
    </section>
  )
}

function Radar({ center, radius }) {
  const map = useMap()
  const [px, setPx] = useState(100)
  useEffect(() => {
    const f = () => {
      const p1 = map.latLngToLayerPoint(center)
      const p2 = map.latLngToLayerPoint([center[0] + radius / 111320, center[1]])
      setPx(Math.abs(p1.y - p2.y))
    }
    f(); map.on('zoomend', f); return () => map.off('zoomend', f)
  }, [map, center[0], center[1], radius])
  const icon = useMemo(() => L.divIcon({ className: '', iconSize: [px * 2, px * 2], iconAnchor: [px, px],
    html: `<div class="radar" style="width:${px * 2}px;height:${px * 2}px"><div class="sweep"></div><div class="ring r1"></div><div class="ring r2"></div><div class="ring r3"></div><span class="rlabel">${radius} m</span></div>` }), [px, radius])
  return <Marker position={center} icon={icon} interactive={false} />
}

function AgentLog({ rows }) {
  const lines = []
  rows.forEach(({ c, s }) => {
    if (!s) lines.push({ t: `Scanning 300 m around ${c.address}…`, live: true })
    else if (s.error) lines.push({ t: `${c.address}: live data unavailable`, bad: true })
    else lines.push({ t: `${c.address}: ${s.cafes.length} coffee shops · ${s.foodCount} food businesses · ${Math.round(s.subway?.d ?? 0)} m to ${s.subway?.name}${s.fromSnapshot ? ' (snapshot)' : ''}` })
  })
  return <div className="agentlog"><div className="al-h"><span className="dot" />Site agent</div>{lines.map((l, i) => <div key={i} className={l.bad ? 'bad' : l.live ? 'live' : ''}>{l.bad ? '!' : l.live ? '◌' : '✓'} {l.t}</div>)}</div>
}

function Sites({ go, state, setState }) {
  const { signals, selected, rent, revenue } = state
  useEffect(() => {
    let dead = false
    ;(async () => {
      // one site at a time: bursts of anonymous Socrata calls get throttled
      for (const c of candidates) {
        if (dead) return
        if (signals[c.id] && !signals[c.id].fromSnapshot) continue
        let s = null, err = null
        for (let i = 0; i < 3 && !s; i++) {
          try { s = await fetchSignals(c) } catch (e) { err = e; await new Promise((r) => setTimeout(r, 800 * (i + 1))) }
        }
        if (dead) return
        const v = s || (snapshot[c.id] ? { ...snapshot[c.id], fromSnapshot: true } : { error: String(err) })
        setState((st) => ({ ...st, signals: { ...st.signals, [c.id]: v } }))
      }
    })()
    return () => { dead = true }
  }, [])
  const [sat, setSat] = useState(false)
  const rows = candidates.map((c) => {
    const s = signals[c.id]
    const sc = s && !s.error ? scoreSite(c, s, { rent: +rent || 0, revenue: +revenue || 0 }) : null
    return { c, s, sc }
  }).sort((a, b) => (b.sc?.total ?? -1) - (a.sc?.total ?? -1))
  const sel = rows.find((r) => r.c.id === selected) || rows[0]
  return (
    <section className="sites">
      <div className="list">
        <h2>Vacant storefronts near Columbia</h2>
        <p className="muted">8 storefronts reported vacant on 12/31/2025 · <a href={SOURCES.storefront.url} target="_blank">NYC open data</a></p>
        <div className="inputs">
          <label>Asking rent $/mo <input value={rent} onChange={(e) => setState((s) => ({ ...s, rent: e.target.value }))} placeholder="optional" /></label>
          <label>Expected revenue $/mo <input value={revenue} onChange={(e) => setState((s) => ({ ...s, revenue: e.target.value }))} placeholder="optional" /></label>
        </div>
        {rows.map(({ c, s, sc }, idx) => (
          <div key={c.id} className={`card ${sel?.c.id === c.id ? 'sel' : ''}`} onClick={() => setState((st) => ({ ...st, selected: c.id }))}>
            <div className="card-top">
              <div><div className="rank">#{idx + 1}</div><h3>{c.address}</h3><div className="muted">{c.zip} · was {c.prevUse.toLowerCase()}{(() => { const e = estimateRoom(c); return e.source === 'pluto' ? ` · about ${e.wFt} × ${e.dFt} ft (estimated from PLUTO)` : ' · size not on record' })()}</div></div>
              <div className="score">{sc ? sc.total : s?.error ? '—' : <span className="spin" />}</div>
            </div>
            {sel?.c.id === c.id && sc && (
              <div className="factors">
                {sc.factors.map((f) => (
                  <div key={f.key} className="factor">
                    <div className="f-head"><span>{f.label}</span><span>{Math.round(f.score)} <small>× {WEIGHTS[f.key]}</small></span></div>
                    <div className="bar"><i style={{ width: `${f.score}%` }} /></div>
                    <div className="f-val">{f.value}</div>
                    <div className="f-why">{f.why} {SOURCES[f.source] && <a href={SOURCES[f.source].url} target="_blank">Source: {SOURCES[f.source].name}</a>}{f.source === 'user' && <em>Source: your input</em>}</div>
                  </div>
                ))}
                <button className="pill" onClick={(e) => { e.stopPropagation(); go('layout') }}>Fit a cafe in this space →</button>
              </div>
            )}
            {s?.error && <div className="err">Live data failed: {s.error}</div>}
            {s?.fromSnapshot && <div className="muted small">Live API unreachable: showing the snapshot captured {s.fetchedAt.slice(0, 10)}</div>}
          </div>
        ))}
      </div>
      <div className="map">
        <MapContainer center={[40.8045, -73.9625]} zoom={15} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
          {sat
            ? <TileLayer key="sat" maxZoom={19} attribution="Imagery &copy; Esri, Maxar, Earthstar Geographics" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
            : <TileLayer key="map" maxZoom={19} attribution="&copy; OpenStreetMap contributors" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />}
          {sel && <Circle center={[sel.c.lat, sel.c.lng]} radius={300} pathOptions={{ color: '#5b6cff', weight: 1, fillOpacity: 0.04, dashArray: '4 4' }} />}
          {sel && <Radar center={[sel.c.lat, sel.c.lng]} radius={300} />}
          <ScaleControl position="topright" imperial metric />
          {sel?.s?.cafes?.map((k, i) => (
            <CircleMarker key={i} center={[k.lat, k.lng]} radius={4} pathOptions={{ color: '#b86b3b', fillOpacity: 0.9 }}><Tooltip>{k.name} · {k.address}</Tooltip></CircleMarker>
          ))}
          {rows.map(({ c, sc }) => (
            <CircleMarker key={c.id} center={[c.lat, c.lng]} radius={sel?.c.id === c.id ? 10 : 7}
              pathOptions={{ color: '#0b0c12', fillColor: sel?.c.id === c.id ? '#0b0c12' : '#ffffff', fillOpacity: 1, weight: 2 }}
              eventHandlers={{ click: () => setState((st) => ({ ...st, selected: c.id })) }}>
              <Tooltip direction="top">{c.address}{sc ? ` · ${sc.total}` : ''}</Tooltip>
            </CircleMarker>
          ))}
        </MapContainer>
        <div className="maptog"><button className={!sat ? 'on' : ''} onClick={() => setSat(false)}>Map</button><button className={sat ? 'on' : ''} onClick={() => setSat(true)}>Satellite</button></div>
        {sel && (
          <div className="sv">
            <div className="sv-h"><b>Street view · {sel.c.address}</b><a href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${sel.c.lat},${sel.c.lng}`} target="_blank" rel="noreferrer">Open in Google Maps ↗</a></div>
            <iframe key={sel.c.id} title="Street view" loading="lazy" referrerPolicy="no-referrer-when-downgrade" src={`https://www.google.com/maps?layer=c&cbll=${sel.c.lat},${sel.c.lng}&cbp=12,0,0,0,0&output=svembed`} />
          </div>
        )}
        <div className="legend"><span className="lg dark" />Candidate <span className="lg cafe" />Coffee/tea competitor (DOHMH) <span className="lg ring300" />300 m scan</div>
        <AgentLog rows={rows} />
      </div>
    </section>
  )
}

function BuyLink({ p }) {
  return (
    <a className={'buy ' + p.link.kind} href={p.link.url} target="_blank" rel="noreferrer">
      {p.link.kind === 'exact' ? `Buy on ${p.link.retailer} ↗` : `View on ${p.link.retailer} ↗`}
    </a>
  )
}

function ProductCard({ it, onClose }) {
  const p = PRODUCTS[it.product]
  if (!p) return null
  return (
    <div className="pcard">
      <button className="x" onClick={onClose}>×</button>
      <div className="muted small">{p.cat} · {it.zone}</div>
      <div className="pname">{p.name}</div>
      <div className="pdims">{(it.w * 100).toFixed(0)} × {(it.d * 100).toFixed(0)} × {(it.h * 100).toFixed(0)} cm</div>
      <div className="pprice">{p.price ? `$${p.price.toLocaleString()}` : 'Price on retailer page'}{p.price ? <small> seen {PRICE_DATE}</small> : null}</div>
      <span className={'tagk ' + p.link.kind}>{p.link.kind === 'exact' ? 'Exact product: the 3D model is this item' : 'Similar product: the 3D model is generic'}</span>
      <BuyLink p={p} />
    </div>
  )
}

function ShoppingList({ items, onPick }) {
  const groups = {}
  for (const it of items) {
    const p = PRODUCTS[it.product]
    if (!p) continue
    const g = (groups[p.cat] ||= {})
    ;(g[it.product] ||= { p, n: 0, first: it }).n++
  }
  const priced = items.filter((it) => PRODUCTS[it.product])
  const total = priced.length
  const sum = priced.reduce((a, it) => a + (PRODUCTS[it.product].price || 0), 0)
  const unpriced = priced.filter((it) => !PRODUCTS[it.product].price).length
  return (
    <div className="shop">
      <div className="shop-h"><b>Shopping list</b><span className="muted small">{total} items</span></div>
      <div className="shop-sum"><b>${sum.toLocaleString(undefined, { maximumFractionDigits: 0 })}</b> list-price estimate<div className="muted small">Retailer list prices seen {PRICE_DATE}; excludes {unpriced} items without a captured price, tax, delivery and install.</div></div>
      {Object.entries(groups).map(([cat, g]) => (
        <div key={cat} className="shop-g">
          <div className="shop-cat">{cat}</div>
          {Object.entries(g).map(([k, r]) => (
            <div key={k} className="shop-row">
              <span className="qty">{r.n}×</span>
              <span className="sname" onClick={() => onPick(r.first.id)}>{r.p.name}{r.p.price ? <em> ${r.p.price.toLocaleString()} each</em> : null}</span>
              <BuyLink p={r.p} />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function Layout({ state, setState }) {
  const site = candidates.find((c) => c.id === state.selected) || candidates[0]
  return <FitLab key={site.id} site={site} state={state} setState={setState} />
}

function Research() {
  return (
    <section className="research">
      <h2>How research shaped the product</h2>
      <p className="muted">Each rule in the app traces back to a question we investigated with Flashpoint AI. Survey results are labeled synthetic or real.</p>
      <div className="rgrid">
        {research.map((r, i) => (
          <div key={i} className="rcard">
            <div className="q">Q{i + 1}. {r.question}</div>
            <div className="fnd">{r.finding || <span className="todo">Flashpoint finding — to be added</span>}</div>
            <div className="dec"><b>Decision →</b> {r.decision}</div>
            {r.evidence && <a href={r.evidence} target="_blank">Evidence</a>}
          </div>
        ))}
      </div>
      <h3>Data sources</h3>
      <ul className="src">
        {Object.values(SOURCES).map((s) => <li key={s.url}><a href={s.url} target="_blank">{s.name}</a></li>)}
        <li>3D models: GlamVelvetSofa and AnisotropyBarnLamp (© Wayfair, CC-BY 4.0), SheenChair (© Wayfair, CC0), DiffuseTransmissionPlant (© Darmstadt Graphics Group, CC-BY 4.0), DiffuseTransmissionTeacup (CC0), via <a href="https://github.com/KhronosGroup/glTF-Sample-Assets" target="_blank">Khronos glTF-Sample-Assets</a></li>
      </ul>
    </section>
  )
}

function Report({ state, go }) {
  const site = candidates.find((c) => c.id === state.selected) || candidates[0]
  const s = state.signals[site.id]
  const sc = s && !s.error ? scoreSite(site, s, { rent: +state.rent || 0, revenue: +state.revenue || 0 }) : null
  const p = state.plan
  return (
    <section className="report">
      <div className="muted">StoreFit report · {new Date().toLocaleDateString()}</div>
      <h2>{site.address}, New York {site.zip}</h2>
      <div className="kpis">
        <div><b>{sc?.total ?? '—'}</b><span>Site score</span></div>
        <div><b>{s?.cafes?.length ?? '—'}</b><span>Coffee competitors ≤300 m</span></div>
        <div><b>{s?.subway ? Math.round(s.subway.d) + ' m' : '—'}</b><span>To {s?.subway?.name || 'subway'}</span></div>
        <div><b>{p?.seats ?? '—'}</b><span>Seats that fit</span></div>
      </div>
      {sc && <ul>{sc.factors.map((f) => <li key={f.key}><b>{f.label}:</b> {f.value}</li>)}</ul>}
      {p && <ul>{p.checks.map((c, i) => <li key={i}>{c.ok ? '✓' : '!'} {c.text}</li>)}</ul>}
      <p className="note">Prototype. Scores use public-data proxies, not foot-traffic counts or real rents. Verify zoning, venting and lease terms on a tour.</p>
      <div className="row"><button className="pill" onClick={() => window.print()}>Print / save PDF</button><button className="ghost" onClick={() => go('layout')}>Back to layout</button></div>
    </section>
  )
}

export default function App() {
  const [page, setPage] = useState('home')
  const [state, setState] = useState({ signals: {}, selected: null, rent: '', revenue: '', room: { wFt: 20, dFt: 40 }, request: '12 个座位，附近学生多，想要临窗吧台、几张双人桌和一个沙发休息区', plan: null })
  const go = (p) => { setPage(p); window.scrollTo(0, 0) }
  return (
    <div className="app">
      <Nav page={page} go={go} />
      {page === 'home' && <Home go={go} />}
      {page === 'sites' && <Sites go={go} state={state} setState={setState} />}
      {page === 'layout' && <Layout state={state} setState={setState} />}
      {page === 'research' && <Research />}
      {page === 'report' && <Report state={state} go={go} />}
    </div>
  )
}
