import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, ContactShadows, Html, Environment, Lightformer, Line, Grid, Edges } from '@react-three/drei'
import Lidar from './Lidar.jsx'
import * as THREE from 'three'
import { Item } from './Furniture.jsx'

function useFloorTexture(W, D) {
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
    t.repeat.set(W / 1.6, D / 1.6)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [W, D])
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
  const floor = useFloorTexture(W, D)
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
      <mesh material={wall} position={[W / 2, wallH / 2, D + t / 2]} receiveShadow><boxGeometry args={[W + 2 * t, wallH, t]} />{dark && <Edges color={ec} />}</mesh>
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
  overview: { p: [W + 6, 12.5, -7], t: [W / 2, 0, D / 2 + 0.6] },
  top: { p: [W / 2, 21, D / 2 + 0.01], t: [W / 2, 0, D / 2] },
  street: { p: [W / 2 + 2.5, 1.7, -10], t: [W / 2, 1.3, D / 2] },
  walk: { p: [(Z?.doorX ?? W / 2), 1.6, 0.3], t: [(Z?.doorX ?? W / 2) - 0.8, 1.2, D] },
  lidar: { p: [W / 2 + 70, 62, -70], t: [W / 2, 0, D / 2] },
})

function CameraRig({ goal }) {
  const { camera, controls } = useThree()
  const moving = useRef(false)
  useEffect(() => { moving.current = true }, [goal])
  useFrame((_, dt) => {
    if (!moving.current || !goal || !controls) return
    const k = 1 - Math.pow(0.0015, dt)
    camera.position.lerp(new THREE.Vector3(...goal.p), k)
    controls.target.lerp(new THREE.Vector3(...goal.t), k)
    controls.update()
    if (camera.position.distanceTo(new THREE.Vector3(...goal.p)) < 0.02) moving.current = false
  })
  return null
}

const STATUS_COLOR = { works: '#5fae6e', tight: '#e2a336', fails: '#e5534b' }

function CheckLayer({ checks, active, onCheck, dark }) {
  return (checks || []).map((c, i) => {
    const on = active === c.key, col = STATUS_COLOR[c.status]
    return (
      <group key={c.key}>
        <Html position={c.pin} center zIndexRange={[4, 0]}>
          <button className={'pin3d ' + c.status + (on ? ' on' : '')} onClick={() => onCheck?.(on ? null : c.key)}>{i + 1}</button>
        </Html>
        {on && c.measure && !c.vertical && (
          <group position={[0, 0.03, 0]}>
            <Line points={[[c.measure[0][0], 0, c.measure[0][1]], [c.measure[1][0], 0, c.measure[1][1]]]} color={col} lineWidth={3} />
            {c.measure.map((p, j) => <mesh key={j} position={[p[0], 0, p[1]]}><sphereGeometry args={[0.06]} /><meshBasicMaterial color={col} /></mesh>)}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(c.measure[0][0] + c.measure[1][0]) / 2, -0.01, (c.measure[0][1] + c.measure[1][1]) / 2]}>
              <ringGeometry args={[Math.max(0.35, Math.hypot(c.measure[1][0] - c.measure[0][0], c.measure[1][1] - c.measure[0][1]) / 2 + 0.25), Math.max(0.35, Math.hypot(c.measure[1][0] - c.measure[0][0], c.measure[1][1] - c.measure[0][1]) / 2 + 0.33), 64]} />
              <meshBasicMaterial color={col} transparent opacity={0.85} />
            </mesh>
          </group>
        )}
        {on && c.vertical && (
          <Line points={[[c.vertical[0] + 0.3, 0, c.vertical[2]], [c.vertical[0] + 0.3, c.vertical[1], c.vertical[2]]]} color={col} lineWidth={3} />
        )}
      </group>
    )
  })
}

export default function Scene3D({ room, plan, onPick, picked, showZones = true, dark = true, view = 'overview', dims = true, lidarSite = null, onLidarInfo, checks, activeCheck, onCheck }) {
  const { W, D } = room
  const [hover, setHover] = useState(null)
  const views = VIEWS(W, D, plan?.zones)
  const ac = checks?.find((c) => c.key === activeCheck)
  const goal = useMemo(() => {
    if (ac) return { p: [ac.pin[0] + 4.5, 7.5, ac.pin[2] - 6], t: ac.pin }
    if (lidarSite && view === 'overview') return views.lidar
    return views[view] || views.overview
  }, [view, ac?.key, lidarSite, W, D])
  const bg = dark ? '#2b2d31' : '#f2f2f0'
  return (
    <Canvas shadows camera={{ position: views.overview.p, fov: 40, near: 0.1, far: 2000 }} dpr={[1, 2]} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}>
      <color attach="background" args={[bg]} />
      {lidarSite && <fog attach="fog" args={[bg, 120, 320]} />}
      <ambientLight intensity={dark ? 0.25 : 0.35} />
      <directionalLight position={[W + 5, 14, -6]} intensity={dark ? 1.2 : 1.6} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={12} shadow-camera-bottom={-12} />
      <Environment resolution={256}>
        <Lightformer intensity={2} position={[0, 6, -9]} scale={[14, 4, 1]} />
        <Lightformer intensity={1} position={[-6, 4, 4]} rotation-y={Math.PI / 2} scale={[10, 3, 1]} />
        <Lightformer intensity={0.6} color="#ffe7c7" position={[6, 4, 6]} rotation-y={-Math.PI / 2} scale={[10, 3, 1]} />
      </Environment>
      <Suspense fallback={<Html center><div className="dim3d">Loading 3D furniture…</div></Html>}>
        <Room W={W} D={D} zones={plan?.zones} showZones={showZones} dark={dark} dims={dims && !lidarSite} items={plan?.items} />
        {plan?.items.map((it) => (
          <group key={it.id} position={[it.x, it.y || 0, it.z]} rotation={[0, it.rotY || 0, 0]}
            onPointerOver={(e) => { e.stopPropagation(); setHover(it.id) }} onPointerOut={() => setHover(null)}
            onClick={(e) => { e.stopPropagation(); onPick?.(it.id) }}>
            <Item it={it} />
            {(hover === it.id || picked === it.id) && (
              <Html position={[0, (it.h || 0.8) + 0.25, 0]} center zIndexRange={[4, 0]}><div className="tag3d">{it.label}</div></Html>
            )}
          </group>
        ))}
        <ContactShadows position={[W / 2, 0.008, D / 2]} scale={Math.max(W, D) * 1.4} opacity={0.4} blur={2.2} far={3} />
        <CheckLayer checks={checks} active={activeCheck} onCheck={onCheck} dark={dark} />
        {lidarSite && <Lidar siteId={lidarSite} W={W} D={D} onInfo={onLidarInfo} />}
      </Suspense>
      <OrbitControls makeDefault target={views.overview.t} maxPolarAngle={Math.PI / 2.05} minDistance={1} maxDistance={400} />
      <CameraRig goal={goal} />
    </Canvas>
  )
}
