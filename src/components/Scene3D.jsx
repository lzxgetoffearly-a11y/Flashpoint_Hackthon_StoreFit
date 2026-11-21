import React, { Suspense, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, useGLTF, ContactShadows, Html } from '@react-three/drei'
import * as THREE from 'three'

const BASE = import.meta.env.BASE_URL

function Model({ it, showLabels }) {
  const { scene } = useGLTF(`${BASE}models/${it.model}.gltf`)
  const { obj, scale, offset } = useMemo(() => {
    const obj = scene.clone(true)
    const box = new THREE.Box3().setFromObject(obj)
    const size = new THREE.Vector3(); box.getSize(size)
    const center = new THREE.Vector3(); box.getCenter(center)
    // Fit the model's footprint to the planned footprint (meters).
    // Rotated items swap footprint axes.
    const rotated = Math.abs(Math.sin(it.rotY || 0)) > 0.5
    const fw = rotated ? it.d : it.w, fd = rotated ? it.w : it.d
    let s = Math.min(fw / size.x, fd / size.z)
    let sv = [s, s, s]
    if (it.squash) sv = [fw / size.x, it.h ? it.h / size.y : Math.min(fw / size.x, fd / size.z) * 1.4, fd / size.z]
    return { obj, scale: sv, offset: [-center.x, -box.min.y, -center.z] }
  }, [scene, it])
  return (
    <group position={[it.x, 0, it.z]} rotation={[0, it.rotY || 0, 0]}>
      <group scale={scale}>
        <primitive object={obj} position={offset} />
      </group>
      {showLabels && it.zone !== 'seat' && (
        <Html position={[0, 1.6, 0]} center distanceFactor={9}><div className="tag3d">{it.label}</div></Html>
      )}
    </group>
  )
}

function Room({ W, D, zones }) {
  const wallH = 3.2, t = 0.12
  const wallMat = <meshStandardMaterial color="#e9e7e1" />
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[W / 2, 0, D / 2]} receiveShadow>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial color="#d8cfc2" />
      </mesh>
      {/* main aisle + queue highlight */}
      {zones && (
        <>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(zones.aisle[0] + zones.aisle[1]) / 2, 0.005, zones.seatZoneEnd / 2]}>
            <planeGeometry args={[zones.aisle[1] - zones.aisle[0], zones.seatZoneEnd]} />
            <meshBasicMaterial color="#9fb6e8" transparent opacity={0.35} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[W / 2, 0.006, zones.seatZoneEnd + 0.75]}>
            <planeGeometry args={[W - 0.4, 1.5]} />
            <meshBasicMaterial color="#c7b8f0" transparent opacity={0.35} />
          </mesh>
        </>
      )}
      <mesh position={[W / 2, wallH / 2, D + t / 2]}><boxGeometry args={[W + 2 * t, wallH, t]} />{wallMat}</mesh>
      <mesh position={[-t / 2, wallH / 2, D / 2]}><boxGeometry args={[t, wallH, D]} />{wallMat}</mesh>
      <mesh position={[W + t / 2, wallH / 2, D / 2]}><boxGeometry args={[t, wallH, D]} />{wallMat}</mesh>
      {/* glass storefront */}
      <mesh position={[W / 2, wallH / 2, -0.02]}><boxGeometry args={[W, wallH, 0.04]} /><meshPhysicalMaterial color="#cfe0ff" transparent opacity={0.18} roughness={0} /></mesh>
    </group>
  )
}

export default function Scene3D({ room, plan, showLabels = true }) {
  const { W, D } = room
  return (
    <Canvas shadows camera={{ position: [W / 2 + 7, 11, -6], fov: 40 }} dpr={[1, 2]}>
      <color attach="background" args={['#f2f2f0']} />
      <hemisphereLight intensity={0.9} groundColor="#cbbfae" />
      <directionalLight position={[W + 4, 12, -4]} intensity={1.4} castShadow />
      <Suspense fallback={<Html center><div className="tag3d">Loading models…</div></Html>}>
        <Room W={W} D={D} zones={plan?.zones} />
        {plan?.items.map((it) => <Model key={it.id} it={it} showLabels={showLabels} />)}
        <ContactShadows position={[W / 2, 0.01, D / 2]} scale={Math.max(W, D) * 1.6} opacity={0.35} blur={2.4} />
      </Suspense>
      <OrbitControls target={[W / 2, 0, D / 2]} maxPolarAngle={Math.PI / 2.1} />
    </Canvas>
  )
}
