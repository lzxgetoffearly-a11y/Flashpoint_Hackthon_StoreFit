import React, { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Circle, Tooltip } from 'react-leaflet'
import { candidates, DATASET_URL } from './data/candidates.js'
import { research } from './data/research.js'
import { fetchSignals, SOURCES } from './lib/nycdata.js'
import { scoreSite, WEIGHTS } from './lib/score.js'
import { planLayout, llmParams, RULES } from './lib/layout.js'
import Scene3D from './components/Scene3D.jsx'

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

function Sites({ go, state, setState }) {
  const { signals, selected, rent, revenue } = state
  useEffect(() => {
    candidates.forEach((c) => {
      if (signals[c.id]) return
      fetchSignals(c).then((s) => setState((st) => ({ ...st, signals: { ...st.signals, [c.id]: s } })))
        .catch((e) => setState((st) => ({ ...st, signals: { ...st.signals, [c.id]: { error: String(e) } } })))
    })
  }, [])
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
              <div><div className="rank">#{idx + 1}</div><h3>{c.address}</h3><div className="muted">{c.zip} · was {c.prevUse.toLowerCase()}</div></div>
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
          </div>
        ))}
      </div>
      <div className="map">
        <MapContainer center={[40.8045, -73.9625]} zoom={15} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
          <TileLayer attribution='&copy; OpenStreetMap &copy; CARTO' url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
          {sel && <Circle center={[sel.c.lat, sel.c.lng]} radius={300} pathOptions={{ color: '#5b6cff', weight: 1, fillOpacity: 0.06 }} />}
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
        <div className="legend"><span className="lg dark" />Candidate <span className="lg cafe" />Coffee/tea competitor (DOHMH)</div>
      </div>
    </section>
  )
}

function Layout({ state, setState }) {
  const site = candidates.find((c) => c.id === state.selected) || candidates[0]
  const [w, setW] = useState(state.room.wFt), [d, setD] = useState(state.room.dFt)
  const [req, setReq] = useState(state.request)
  const [shown, setShown] = useState(state.plan ? state.plan.steps.length : 0)
  const [busy, setBusy] = useState(false)
  const room = { W: w * FT, D: d * FT }
  async function run() {
    setBusy(true); setShown(0)
    const params = await llmParams(req)
    const plan = planLayout(room, params)
    plan.via = params.via
    setState((s) => ({ ...s, plan, request: req, room: { wFt: w, dFt: d } }))
    for (let i = 1; i <= plan.steps.length; i++) { await new Promise((r) => setTimeout(r, 420)); setShown(i) }
    setBusy(false)
  }
  useEffect(() => { if (!state.plan) run() }, [])
  const plan = state.plan
  return (
    <section className="layout">
      <aside className="panel">
        <div className="muted">Selected space</div>
        <h2>{site.address}</h2>
        <div className="dims">
          <label>Frontage (ft)<input type="number" value={w} onChange={(e) => setW(+e.target.value)} /></label>
          <label>Depth (ft)<input type="number" value={d} onChange={(e) => setD(+e.target.value)} /></label>
        </div>
        <p className="note">Floor size is not in the city data. Default 20 × 40 ft is an assumption: replace it with the listing’s numbers.</p>
        <label className="req">Tell the agent what you need
          <textarea value={req} onChange={(e) => setReq(e.target.value)} rows={3} />
        </label>
        <button className="pill" disabled={busy} onClick={run}>{busy ? 'Agent working…' : 'Run layout agent'}</button>
        {plan && (
          <>
            <ol className="agent-steps">
              {plan.steps.slice(0, shown).map((s, i) => <li key={i}>{s}</li>)}
            </ol>
            {shown >= plan.steps.length && (
              <div className="checks">
                {plan.checks.map((c, i) => <div key={i} className={c.ok ? 'ok' : 'bad'}>{c.ok ? '✓' : '!'} {c.text}</div>)}
                <div className="muted small">Parsed by: {plan.via === 'llm' ? 'LLM' : 'built-in rules (no API key set)'} · Placement and checks: rule engine</div>
              </div>
            )}
          </>
        )}
      </aside>
      <div className="stage">
        {plan && <Scene3D room={room} plan={plan} />}
        <div className="stage-legend"><span className="lg aisle" />Main aisle {RULES.mainAisle} m <span className="lg queue" />Queue {RULES.queueDepth} m <span className="credit">3D models: KayKit (CC0)</span></div>
      </div>
    </section>
  )
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
        <li><a href="https://github.com/KayKit-Game-Assets/KayKit-Furniture-Bits-1.0" target="_blank">KayKit Furniture Bits</a> and <a href="https://github.com/KayKit-Game-Assets/KayKit-Restaurant-Bits-1.0" target="_blank">Restaurant Bits</a> (CC0 3D models)</li>
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
  const [state, setState] = useState({ signals: {}, selected: null, rent: '', revenue: '', room: { wFt: 20, dFt: 40 }, request: '24 个座位，附近学生多，想要临窗吧台和几张双人桌', plan: null })
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
