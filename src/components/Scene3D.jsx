import React, { Suspense, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, ContactShadows, Html, Environment, Lightformer, Line, Grid } from '@react-three/drei'
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

function Dim({ a, b, label, offset = [0, 0, 0] }) {
  const pts = [a, b].map((p) => [p[0] + offset[0], p[1] + offset[1], p[2] + offset[2]])
  const mid = [(pts[0][0] + pts[1][0]) / 2, pts[0][1], (pts[0][2] + pts[1][2]) / 2]
  return (
    <group>
      <Line points={pts} color="#0b0c12" lineWidth={1.2} />
      {pts.map((p, i) => <Line key={i} points={[[p[0], p[1] - 0.12, p[2]], [p[0], p[1] + 0.12, p[2]]]} color="#0b0c12" lineWidth={1.2} />)}
      <Html position={mid} center><div className="dim3d">{label}</div></Html>
    </group>
  )
}

function Room({ W, D, zones, showZones }) {
  const floor = useFloorTexture(W, D)
  const wallH = 3.4, sideH = 1.1, t = 0.15
  const wall = new THREE.MeshStandardMaterial({ color: '#efede8', roughness: 0.95 })
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
      <Grid position={[W / 2, 0.006, D / 2]} args={[W, D]} cellSize={1} cellThickness={0.6} cellColor="#6f6a60" sectionSize={5} sectionThickness={1} sectionColor="#3b3834" fadeDistance={60} infiniteGrid={false} />
      <mesh material={wall} position={[W / 2, wallH / 2, D + t / 2]} receiveShadow><boxGeometry args={[W + 2 * t, wallH, t]} /></mesh>
      <mesh material={wall} position={[-t / 2, sideH / 2, D / 2]} receiveShadow castShadow><boxGeometry args={[t, sideH, D]} /></mesh>
      <mesh material={wall} position={[W + t / 2, sideH / 2, D / 2]} receiveShadow castShadow><boxGeometry args={[t, sideH, D]} /></mesh>
      {/* storefront: glass + black mullions + door opening */}
      {[[0, dx - doorW / 2], [dx + doorW / 2, W]].map(([x0, x1], i) => (
        <mesh key={i} position={[(x0 + x1) / 2, sideH / 2, -0.02]}><boxGeometry args={[x1 - x0, sideH, 0.02]} /><meshPhysicalMaterial color="#dfe8f5" transparent opacity={0.12} roughness={0} /></mesh>
      ))}
      {[0, dx - doorW / 2, dx + doorW / 2, W].map((x, i) => (
        <mesh key={'m' + i} position={[x, sideH / 2, -0.02]}><boxGeometry args={[0.06, sideH, 0.08]} /><meshStandardMaterial color="#141416" /></mesh>
      ))}
            <mesh position={[W / 2, sideH, -0.02]}><boxGeometry args={[W, 0.05, 0.08]} /><meshStandardMaterial color="#141416" /></mesh>
      <Html position={[dx, 0.05, -0.6]} center><div className="dim3d door">ENTRANCE</div></Html>
      <Dim a={[0, 0.02, 0]} b={[W, 0.02, 0]} offset={[0, 0, -0.55]} label={`${W.toFixed(2)} m · ${(W / 0.3048).toFixed(0)} ft`} />
      <Dim a={[W, 0.02, 0]} b={[W, 0.02, D]} offset={[0.55, 0, 0]} label={`${D.toFixed(2)} m · ${(D / 0.3048).toFixed(0)} ft`} />
    </group>
  )
}

export default function Scene3D({ room, plan, onPick, picked, showZones = true }) {
  const { W, D } = room
  const [hover, setHover] = useState(null)
  return (
    <Canvas shadows camera={{ position: [W + 6, 12.5, -7], fov: 40 }} dpr={[1, 2]} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}>
      <color attach="background" args={['#f2f2f0']} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[W + 5, 14, -6]} intensity={1.6} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={12} shadow-camera-bottom={-12} />
      <Environment resolution={256}>
        <Lightformer intensity={2} position={[0, 6, -9]} scale={[14, 4, 1]} />
        <Lightformer intensity={1} position={[-6, 4, 4]} rotation-y={Math.PI / 2} scale={[10, 3, 1]} />
        <Lightformer intensity={0.6} color="#ffe7c7" position={[6, 4, 6]} rotation-y={-Math.PI / 2} scale={[10, 3, 1]} />
      </Environment>
      <Suspense fallback={<Html center><div className="dim3d">Loading 3D furniture…</div></Html>}>
        <Room W={W} D={D} zones={plan?.zones} showZones={showZones} />
        {plan?.items.map((it) => (
          <group key={it.id} position={[it.x, it.y || 0, it.z]} rotation={[0, it.rotY || 0, 0]}
            onPointerOver={(e) => { e.stopPropagation(); setHover(it.id) }} onPointerOut={() => setHover(null)}
            onClick={(e) => { e.stopPropagation(); onPick?.(it.id) }}>
            <Item it={it} />
            {(hover === it.id || picked === it.id) && (
              <Html position={[0, (it.h || 0.8) + 0.25, 0]} center><div className="tag3d">{it.label}</div></Html>
            )}
          </group>
        ))}
        <ContactShadows position={[W / 2, 0.008, D / 2]} scale={Math.max(W, D) * 1.4} opacity={0.4} blur={2.2} far={3} />
      </Suspense>
      <OrbitControls target={[W / 2, 0, D / 2 + 0.6]} maxPolarAngle={Math.PI / 2.15} minDistance={3} maxDistance={30} />
    </Canvas>
  )
}
