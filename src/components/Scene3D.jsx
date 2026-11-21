import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, ContactShadows, Html, Environment, Lightformer, Line, Grid, Edges, OrthographicCamera, PerspectiveCamera } from '@react-three/drei'
import { LidarPoints, Massing } from './Lidar.jsx'
import Google3D from './Google3D.jsx'
import * as THREE from 'three'
import { Item } from './Furniture.jsx'

function useFloorTexture() {
  return useMemo(() => {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 1024
    const g = c.getContext('2d')
    const plankW = 1024 / 8
    for (let i = 0; i < 8; i++) {
      let y = -Math.random() * 400
      while (y < 1024) {
        const len = 300 + Math.random() * 400
        const l = 58 + Math.random() * 10
        g.fillStyle = `hsl(28, 32%, ${l}%)`
        g.fillRect(i * plankW, y, plankW - 3, len - 3)
        g.globalAlpha = 0.08
        for (let k = 0; k < 6; k++) { g.fillStyle = '#5a3a20'; g.fillRect(i * plankW + Math.random() * plankW, y, 1.5, len) }
        g.globalAlpha = 1
        y += len
      }
    }
    const t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
}

function useBoardTexture() {
  return useMemo(() => {
    const c = document.createElement('canvas'); c.width = 768; c.height = 320
    const g = c.getContext('2d')
    g.fillStyle = '#17191c'; g.fillRect(0, 0, 768, 320)
    g.strokeStyle = '#b98b4e'; g.lineWidth = 4; g.strokeRect(10, 10, 748, 300)
    g.fillStyle = '#f3efe6'; g.font = '600 54px Georgia, serif'; g.fillText('COFFEE', 44, 92)
    g.font = '28px Georgia, serif'; g.fillStyle = '#cfc8b8'
    ;['Espresso', 'Cortado', 'Flat white', 'Cold brew'].forEach((t, i) => g.fillText(t, 48, 150 + i * 40))
    ;['Matcha', 'Chai', 'Pastry', 'Bagels'].forEach((t, i) => g.fillText(t, 420, 150 + i * 40))
    g.fillStyle = '#b98b4e'; g.fillRect(44, 108, 680, 2)
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
}

function Dim({ a, b, label, offset = [0, 0, 0], color = '#0b0c12' }) {
  const pts = [a, b].map((p) => [p[0] + offset[0], p[1] + offset[1], p[2] + offset[2]])
  const mid = [(pts[0][0] + pts[1][0]) / 2, pts[0][1], (pts[0][2] + pts[1][2]) / 2]
  return (
    <group>
      <Line points={pts} color={color} lineWidth={1.2} />
      {pts.map((p, i) => <Line key={i} points={[[p[0], p[1] - 0.12, p[2]], [p[0], p[1] + 0.12, p[2]]]} color={color} lineWidth={1.2} />)}
      <Html position={mid} center zIndexRange={[4, 0]}><div className="dim3d">{label}</div></Html>
    </group>
  )
}

function Room({ W, D, zones, showZones, dark, dims, items }) {
  const floor = useFloorTexture()
  const board = useBoardTexture()
  floor.repeat.set(W / 1.6, D / 1.6)
  const wallH = 3.4, sideH = 1.1, t = 0.15
  const wall = useMemo(() => dark ? new THREE.MeshStandardMaterial({ color: '#9aa0aa', roughness: 0.9, transparent: true, opacity: 0.18, depthWrite: false }) : new THREE.MeshStandardMaterial({ color: '#efede8', roughness: 0.95 }), [dark])
  const ec = dark ? '#e8ebf2' : '#0b0c12'
  const doorW = 1.0, dx = zones?.doorX ?? W / 2
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[W / 2, 0, D / 2]} receiveShadow>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial map={floor} roughness={0.6} />
      </mesh>
      {showZones && zones && (
        <group position={[0, 0.004, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(zones.aisle[0] + zones.aisle[1]) / 2, 0, zones.seatZoneEnd / 2]}>
            <planeGeometry args={[zones.aisle[1] - zones.aisle[0], zones.seatZoneEnd]} /><meshBasicMaterial color="#5b6cff" transparent opacity={0.16} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[W / 2, 0.001, zones.seatZoneEnd + 0.75]}>
            <planeGeometry args={[W - 0.3, 1.5]} /><meshBasicMaterial color="#9b7bff" transparent opacity={0.16} />
          </mesh>
        </group>
      )}
      <Grid position={[W / 2, 0.006, D / 2]} args={[W, D]} cellSize={1} cellThickness={0.6} cellColor={dark ? "#8a8f99" : "#6f6a60"} sectionSize={5} sectionThickness={1} sectionColor={dark ? "#cfd3db" : "#3b3834"} fadeDistance={60} infiniteGrid={false} />
      <mesh position={[W / 2, wallH / 2, D + t / 2]} receiveShadow><boxGeometry args={[W + 2 * t, wallH, t]} /><meshStandardMaterial color="#2f4a40" roughness={0.85} />{dark && <Edges color={ec} />}</mesh>
      {/* tiled splash behind the back bar and a plain menu board (no prices: decoration only) */}
      <mesh position={[W / 2, 0.6, D - 0.005]}><planeGeometry args={[W, 1.2]} /><meshStandardMaterial color="#e9e4d8" roughness={0.35} /></mesh>
      <mesh position={[W / 2, 1.2, D - 0.01]} rotation={[0, Math.PI, 0]}><planeGeometry args={[W, 0.04]} /><meshStandardMaterial color="#b98b4e" metalness={0.6} roughness={0.3} /></mesh>
      <mesh position={[Math.min(W - 1.4, W * 0.62), 2.35, D - 0.03]} rotation={[0, Math.PI, 0]}><planeGeometry args={[Math.min(2.4, W * 0.45), 1.0]} /><meshStandardMaterial map={board} roughness={0.9} /></mesh>
      {(items || []).filter((it) => it.kind === 'lamp').map((it) => <pointLight key={it.id} position={[it.x, 2.2, it.z]} color="#ffc98a" intensity={6} distance={5} decay={2} />)}
      {/* full-height storefront frame */}
      {[0, dx - doorW / 2, dx + doorW / 2, W].map((x, i) => <mesh key={'p' + i} position={[x, wallH / 2, -0.02]}><boxGeometry args={[0.05, wallH, 0.06]} /><meshStandardMaterial color="#141416" /></mesh>)}
      <mesh position={[W / 2, wallH, -0.02]}><boxGeometry args={[W + 0.05, 0.06, 0.08]} /><meshStandardMaterial color="#141416" /></mesh>
      <mesh position={[dx, 2.15, -0.02]}><boxGeometry args={[doorW, 0.05, 0.06]} /><meshStandardMaterial color="#141416" /></mesh>
      <mesh position={[W / 2, wallH / 2, -0.02]}><planeGeometry args={[W, wallH]} /><meshPhysicalMaterial color="#cfe0f2" transparent opacity={0.06} roughness={0} side={THREE.DoubleSide} depthWrite={false} /></mesh>
      <mesh material={wall} position={[-t / 2, (dark ? wallH : sideH) / 2, D / 2]} receiveShadow castShadow={!dark}><boxGeometry args={[t, dark ? wallH : sideH, D]} />{dark && <Edges color={ec} />}</mesh>
      <mesh material={wall} position={[W + t / 2, (dark ? wallH : sideH) / 2, D / 2]} receiveShadow castShadow={!dark}><boxGeometry args={[t, dark ? wallH : sideH, D]} />{dark && <Edges color={ec} />}</mesh>
      {/* storefront: glass + black mullions + door opening */}
      {[[0, dx - doorW / 2], [dx + doorW / 2, W]].map(([x0, x1], i) => (
        <mesh key={i} position={[(x0 + x1) / 2, sideH / 2, -0.02]}><boxGeometry args={[x1 - x0, sideH, 0.02]} /><meshPhysicalMaterial color="#dfe8f5" transparent opacity={0.12} roughness={0} /></mesh>
      ))}
      {[0, dx - doorW / 2, dx + doorW / 2, W].map((x, i) => (
        <mesh key={'m' + i} position={[x, sideH / 2, -0.02]}><boxGeometry args={[0.06, sideH, 0.08]} /><meshStandardMaterial color="#141416" /></mesh>
      ))}
            <mesh position={[W / 2, sideH, -0.02]}><boxGeometry args={[W, 0.05, 0.08]} /><meshStandardMaterial color="#141416" /></mesh>
      <Html position={[dx, 0.05, -0.6]} center zIndexRange={[4, 0]}><div className="dim3d door">ENTRANCE</div></Html>
      {dims && <>
        <Dim color={ec} a={[0, 0.02, 0]} b={[W, 0.02, 0]} offset={[0, 0, -0.55]} label={`${W.toFixed(2)} m · ${(W / 0.3048).toFixed(0)} ft`} />
        <Dim color={ec} a={[W, 0.02, 0]} b={[W, 0.02, D]} offset={[0.55, 0, 0]} label={`${D.toFixed(2)} m · ${(D / 0.3048).toFixed(0)} ft`} />
        <Dim color={ec} a={[-0.4, 0, D]} b={[-0.4, wallH, D]} label={`ceiling ${wallH.toFixed(1)} m (assumed)`} />
        {(items || []).filter((it) => ['counter', 'windowbar', 'sofa'].includes(it.kind)).filter((it, i, a) => a.findIndex((b) => b.kind === it.kind) === i).map((it) => {
          const r = Math.abs(Math.sin(it.rotY || 0)) > 0.5, w = r ? it.d : it.w, d = r ? it.w : it.d
          const len = it.kind === 'counter' ? (items.filter((b) => b.kind === 'counter').length * 1.2) : (r ? d : w)
          const x0 = it.kind === 'counter' ? it.x - 0.6 : it.x - w / 2, z = it.z - d / 2 - 0.15
          return r
            ? <Dim key={it.id} color={ec} a={[it.x + w / 2 + 0.15, 0.03, it.z - d / 2]} b={[it.x + w / 2 + 0.15, 0.03, it.z + d / 2]} label={`${(d * 100).toFixed(0)} cm`} />
            : <Dim key={it.id} color={ec} a={[x0, 0.03, z]} b={[x0 + len, 0.03, z]} label={`${(len * 100).toFixed(0)} cm`} />
        })}
      </>}
    </group>
  )
}

const VIEWS = (W, D, Z) => ({
  overview: { p: [W / 2 + 34, 56, -46], t: [W / 2, 0, D / 2] },
  inside: { p: [W + 6, 12.5, -7], t: [W / 2, 0, D / 2 + 0.6] },
  top: { p: [W / 2, 60, D / 2 + 0.01], t: [W / 2, 0, D / 2], ortho: true },
  street: { p: [W / 2, 1.7, -Math.max(11, W * 1.25)], t: [W / 2, 1.5, D / 2] },
  walk: { p: [(Z?.doorX ?? W / 2), 1.6, 0.3], t: [(Z?.doorX ?? W / 2) - 0.8, 1.2, D] },
  counter: { p: [W / 2 + 1.5, 4.2, (Z?.counterZ ?? D) - 6.5], t: [W / 2 - 0.5, 0.9, (Z?.counterZ ?? D)] },
})

function CameraRig({ goal, north, compassRef }) {
  const { camera, controls } = useThree()
  const moving = useRef(false)
  useEffect(() => { moving.current = true }, [goal])
  useFrame((_, dt) => {
    if (compassRef?.current && controls) {
      const dx = controls.target.x - camera.position.x, dz = controls.target.z - camera.position.z
      const view = Math.atan2(dx, -dz), n = Math.atan2(north[0], -north[1])
      compassRef.current.style.transform = `rotate(${n - view}rad)`
    }
    if (!moving.current || !goal || !controls) return
    const k = 1 - Math.pow(0.0015, dt)
    camera.position.lerp(new THREE.Vector3(...goal.p), k)
    controls.target.lerp(new THREE.Vector3(...goal.t), k)
    controls.update()
    if (camera.position.distanceTo(new THREE.Vector3(...goal.p)) < 0.03) moving.current = false
  })
  return null
}

function CheckLayer({ checks, active, onCheck, colors }) {
  return (checks || []).map((c, i) => {
    const on = active === c.id, col = colors[c.verdict]
    const m = c.measure
    const len = m ? Math.hypot(m[1][0] - m[0][0], m[1][1] - m[0][1]) : 0
    return (
      <group key={c.id}>
        <Html position={c.pin} center zIndexRange={[4, 0]}>
          <button className={'marker ' + c.verdict.toLowerCase() + (on ? ' on' : '')} onClick={() => onCheck?.(on ? null : c.id)}>{i + 1}</button>
        </Html>
        {on && m && (
          <group position={[0, 0.035, 0]}>
            <Line points={[[m[0][0], 0, m[0][1]], [m[1][0], 0, m[1][1]]]} color={col} lineWidth={3.5} />
            {m.map((p, j) => <mesh key={j} position={[p[0], 0, p[1]]}><sphereGeometry args={[0.06]} /><meshBasicMaterial color={col} /></mesh>)}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(m[0][0] + m[1][0]) / 2, -0.01, (m[0][1] + m[1][1]) / 2]}>
              <ringGeometry args={[Math.max(0.35, len / 2 + 0.25), Math.max(0.42, len / 2 + 0.32), 64]} />
              <meshBasicMaterial color={col} transparent opacity={0.85} />
            </mesh>
            <Html position={[(m[0][0] + m[1][0]) / 2, 0.5, (m[0][1] + m[1][1]) / 2]} center zIndexRange={[4, 0]}>
              <div className="needtag" style={{ color: col }}>{len.toFixed(2)} m · needs ≥ {c.need.value.toFixed(2)}</div>
            </Html>
          </group>
        )}
      </group>
    )
  })
}

// sweep = { kind: 'wallR' | 'back' | 'chair', off } moves the uncertain thing inside its margin
function sweptItem(it, sweep) {
  if (!sweep || !sweep.off) return it
  if (sweep.kind === 'back' && ['boh', 'counter', 'light'].includes(it.zone)) return { ...it, z: it.z + sweep.off }
  if (sweep.kind === 'chair' && it.kind === 'chair' && Math.abs(Math.cos(it.rotY)) > 0.5) return { ...it, z: it.z + (Math.abs(it.rotY) > 1 ? sweep.off : -sweep.off) }
  return it
}

export default function Scene3D({ room, plan, onPick, picked, showZones = false, dark = true, view = 'inside', dims = true, block = true, lidar = false, google = false, site, lidarData, checks, activeCheck, onCheck, sweep, compassRef }) {
  const W0 = room.W, D0 = room.D
  const W = W0 + (sweep?.kind === 'wallR' ? sweep.off : 0), D = D0 + (sweep?.kind === 'back' ? sweep.off : 0)
  const [hover, setHover] = useState(null)
  const views = useMemo(() => { const v = VIEWS(W0, D0, plan?.zones); return google ? { ...v, overview: { p: [W0 / 2 + 15, 24, -24], t: [W0 / 2, 2, D0 / 2] } } : v }, [W0, D0, plan, google])
  const ac = checks?.find((c) => c.id === activeCheck)
  const goal = useMemo(() => {
    if (ac) return { p: [ac.pin[0] + 4.5, 7.5, ac.pin[2] - 6], t: [ac.pin[0], 0, ac.pin[2]] }
    return views[view] || views.inside
  }, [view, ac?.id, views])
  const ortho = !ac && !!views[view]?.ortho
  const bg = dark ? '#2b2d31' : '#f7f6f3'
  const colors = dark ? { WORKS: '#5fae6e', TIGHT: '#e2a336', FAILS: '#e5534b', NEEDS: '#a3a19c' } : { WORKS: '#4c8a57', TIGHT: '#c28a1e', FAILS: '#c2453d', NEEDS: '#8e8d89' }
  return (
    <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}>
      {ortho
        ? <OrthographicCamera makeDefault position={views.top.p} zoom={Math.min(46, 560 / D0)} near={0.1} far={500} />
        : <PerspectiveCamera makeDefault position={views.overview.p} fov={40} near={0.1} far={2000} />}
      <color attach="background" args={[bg]} />
      <fog attach="fog" args={[bg, 140, 360]} />
      <ambientLight intensity={dark ? 0.3 : 0.55} />
      <hemisphereLight args={[dark ? '#c9ccd4' : '#ffffff', dark ? '#3a3c40' : '#d8d5cd', dark ? 1.1 : 1.3]} />
      <directionalLight position={[W + 5, 14, -6]} intensity={dark ? 1.2 : 1.5} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={12} shadow-camera-bottom={-12} />
      <Environment resolution={256}>
        <Lightformer intensity={2} position={[0, 6, -9]} scale={[14, 4, 1]} />
        <Lightformer intensity={1} position={[-6, 4, 4]} rotation-y={Math.PI / 2} scale={[10, 3, 1]} />
        <Lightformer intensity={0.6} color="#ffe7c7" position={[6, 4, 6]} rotation-y={-Math.PI / 2} scale={[10, 3, 1]} />
      </Environment>
      {!google && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[W0 / 2, -0.06, D0 / 2]}><planeGeometry args={[900, 900]} /><meshStandardMaterial color={dark ? '#34363a' : '#eceae4'} roughness={1} /></mesh>}
      <Suspense fallback={<Html center><div className="dim3d">Loading 3D furniture…</div></Html>}>
        <Room W={W} D={D} zones={plan?.zones} showZones={showZones} dark={dark} dims={dims} items={plan?.items} />
        {plan?.items.map((raw) => {
          const it = sweptItem(raw, sweep)
          return (
            <group key={it.id} position={[it.x, it.y || 0, it.z]} rotation={[0, it.rotY || 0, 0]}
              onPointerOver={(e) => { e.stopPropagation(); setHover(it.id) }} onPointerOut={() => setHover(null)}
              onClick={(e) => { e.stopPropagation(); onPick?.(it.id) }}>
              <Item it={it} />
              {(hover === it.id || picked === it.id) && (
                <Html position={[0, (it.h || 0.8) + 0.25, 0]} center zIndexRange={[4, 0]}><div className="tag3d">{it.label}</div></Html>
              )}
            </group>
          )
        })}
        <ContactShadows position={[W / 2, 0.008, D / 2]} scale={Math.max(W, D) * 1.4} opacity={0.4} blur={2.2} far={3} />
        <CheckLayer checks={checks} active={activeCheck} onCheck={onCheck} colors={colors} />
        {lidarData && google && site && <Google3D site={site} info={lidarData.info} north={lidarData.north} W={W0} D={D0} />}
        {lidarData && block && !lidar && !google && <Massing data={lidarData} dark={dark} />}
        {lidarData && lidar && <LidarPoints data={lidarData} W={W0} D={D0} />}
      </Suspense>
      <OrbitControls makeDefault target={views.inside.t} maxPolarAngle={Math.PI / 2.05} minDistance={1} maxDistance={400} />
      <CameraRig goal={goal} north={lidarData?.north || [0, -1]} compassRef={compassRef} />
    </Canvas>
  )
}
