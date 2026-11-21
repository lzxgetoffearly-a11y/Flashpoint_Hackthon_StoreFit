import React, { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

const BASE = import.meta.env.BASE_URL
// Materials (PBR)
const M = {
  oak: new THREE.MeshStandardMaterial({ color: '#b9875a', roughness: 0.55 }),
  walnut: new THREE.MeshStandardMaterial({ color: '#6b4429', roughness: 0.5 }),
  steel: new THREE.MeshStandardMaterial({ color: '#1d1e22', roughness: 0.35, metalness: 0.8 }),
  brass: new THREE.MeshStandardMaterial({ color: '#b08d57', roughness: 0.3, metalness: 1 }),
  marble: new THREE.MeshPhysicalMaterial({ color: '#3a3d42', roughness: 0.45, clearcoat: 0.2 }),
  quartz: new THREE.MeshPhysicalMaterial({ color: '#e9e6df', roughness: 0.25, clearcoat: 0.4 }),
  stainless: new THREE.MeshStandardMaterial({ color: '#c9ccd1', roughness: 0.25, metalness: 0.95 }),
  glass: new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.02, transmission: 0.9, thickness: 0.02, transparent: true, opacity: 0.35 }),
  black: new THREE.MeshStandardMaterial({ color: '#141416', roughness: 0.6 }),
  white: new THREE.MeshStandardMaterial({ color: '#f4f3ef', roughness: 0.8 }),
  pastry: new THREE.MeshStandardMaterial({ color: '#d39a5b', roughness: 0.7 }),
}
const S = (props) => <mesh castShadow receiveShadow {...props} />

function Bistro() {
  return (
    <group>
      <S material={M.marble} position={[0, 0.735, 0]}><cylinderGeometry args={[0.35, 0.35, 0.03, 48]} /></S>
      <S material={M.steel} position={[0, 0.37, 0]}><cylinderGeometry args={[0.03, 0.03, 0.7, 16]} /></S>
      <S material={M.steel} position={[0, 0.012, 0]}><cylinderGeometry args={[0.24, 0.26, 0.024, 40]} /></S>
    </group>
  )
}

// Sitter faces -z; backrest at +z.
function Chair() {
  const legs = [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]
  return (
    <group>
      <S material={M.oak} position={[0, 0.46, 0]}><boxGeometry args={[0.44, 0.03, 0.44]} /></S>
      {legs.map(([x, z], i) => <S key={i} material={M.steel} position={[x, 0.23, z]}><cylinderGeometry args={[0.012, 0.012, 0.46, 10]} /></S>)}
      {[-0.19, 0.19].map((x, i) => <S key={i} material={M.steel} position={[x, 0.66, 0.205]}><cylinderGeometry args={[0.011, 0.011, 0.4, 10]} /></S>)}
      <S material={M.oak} position={[0, 0.78, 0.21]} rotation={[0.08, 0, 0]}><boxGeometry args={[0.42, 0.11, 0.025]} /></S>
      <S material={M.oak} position={[0, 0.6, 0.208]} rotation={[0.08, 0, 0]}><boxGeometry args={[0.38, 0.04, 0.02]} /></S>
    </group>
  )
}

function Stool() {
  return (
    <group>
      <S material={M.walnut} position={[0, 0.74, 0]}><cylinderGeometry args={[0.18, 0.17, 0.035, 36]} /></S>
      {[0, 1, 2, 3].map((i) => {
        const a = (i * Math.PI) / 2 + Math.PI / 4
        return <S key={i} material={M.steel} position={[Math.cos(a) * 0.14, 0.37, Math.sin(a) * 0.14]} rotation={[Math.sin(a) * -0.08, 0, Math.cos(a) * 0.08]}><cylinderGeometry args={[0.012, 0.012, 0.74, 10]} /></S>
      })}
      <S material={M.brass} position={[0, 0.28, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.155, 0.008, 8, 40]} /></S>
    </group>
  )
}

function WindowBar({ w, d }) {
  const n = Math.max(2, Math.round(w / 1.2) + 1)
  return (
    <group>
      <S material={M.oak} position={[0, 1.04, 0]}><boxGeometry args={[w, 0.04, d]} /></S>
      {Array.from({ length: n }).map((_, i) => (
        <S key={i} material={M.steel} position={[-w / 2 + 0.08 + (i * (w - 0.16)) / (n - 1), 0.52, 0]}><boxGeometry args={[0.04, 1.04, 0.04]} /></S>
      ))}
    </group>
  )
}

function Counter({ w, d }) {
  const slats = Math.floor(w / 0.06)
  return (
    <group>
      <S material={M.white} position={[0, 0.48, 0.04]}><boxGeometry args={[w, 0.96, d - 0.08]} /></S>
      {Array.from({ length: slats }).map((_, i) => (
        <S key={i} material={i % 2 ? M.oak : M.walnut} position={[-w / 2 + 0.03 + i * 0.06, 0.48, -d / 2 + 0.03]}><boxGeometry args={[0.045, 0.94, 0.03]} /></S>
      ))}
      <S material={M.quartz} position={[0, 0.98, 0]}><boxGeometry args={[w + 0.02, 0.04, d + 0.04]} /></S>
      <S material={M.steel} position={[0, 0.04, -d / 2 + 0.06]}><boxGeometry args={[w, 0.08, 0.04]} /></S>
    </group>
  )
}

function Espresso() {
  return (
    <group>
      <S material={M.stainless} position={[0, 0.2, 0.05]}><boxGeometry args={[0.72, 0.4, 0.45]} /></S>
      <S material={M.black} position={[0, 0.42, 0.05]}><boxGeometry args={[0.72, 0.04, 0.45]} /></S>
      {[-0.17, 0.17].map((x, i) => (
        <group key={i} position={[x, 0.24, -0.2]}>
          <S material={M.stainless}><cylinderGeometry args={[0.04, 0.04, 0.05, 20]} /></S>
          <S material={M.black} position={[0, -0.02, -0.09]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.012, 0.012, 0.16, 10]} /></S>
        </group>
      ))}
      <S material={M.stainless} position={[0.3, 0.5, 0.12]}><cylinderGeometry args={[0.09, 0.07, 0.18, 24]} /></S>
    </group>
  )
}

function Pastry({ w, d, h }) {
  return (
    <group>
      <S material={M.black} position={[0, 0.03, 0]}><boxGeometry args={[w, 0.06, d]} /></S>
      <mesh material={M.glass} position={[0, h / 2 + 0.03, 0]}><boxGeometry args={[w, h, d]} /></mesh>
      {[-0.25, 0, 0.25].map((x, i) => <S key={i} material={M.pastry} position={[x, 0.1, 0]}><sphereGeometry args={[0.06, 16, 12]} /></S>)}
      {[-0.25, 0, 0.25].map((x, i) => <S key={'b' + i} material={M.pastry} position={[x, 0.27, 0]}><cylinderGeometry args={[0.07, 0.07, 0.05, 20]} /></S>)}
      <S material={M.glass} position={[0, 0.22, 0]}><boxGeometry args={[w - 0.04, 0.01, d - 0.04]} /></S>
    </group>
  )
}

function Fridge({ w, d, h }) {
  return (
    <group>
      <S material={M.stainless} position={[0, h / 2, 0]}><boxGeometry args={[w, h, d]} /></S>
      <S material={M.black} position={[w / 2 - 0.08, h / 2 + 0.1, -d / 2 - 0.02]}><boxGeometry args={[0.03, 0.5, 0.03]} /></S>
    </group>
  )
}
function Sink({ w, d, h }) {
  return (
    <group>
      <S material={M.stainless} position={[0, h / 2, 0]}><boxGeometry args={[w, h, d]} /></S>
      {[-1, 0, 1].map((i) => <S key={i} material={M.black} position={[(i * w) / 3.2, h + 0.001, 0]}><boxGeometry args={[w / 3.6, 0.002, d * 0.7]} /></S>)}
      <S material={M.stainless} position={[0, h + 0.2, d / 2 - 0.05]}><cylinderGeometry args={[0.015, 0.015, 0.4, 10]} /></S>
    </group>
  )
}
function Shelf({ w, d, h }) {
  const cupMat = M.white
  return (
    <group>
      {[0.5, 1.0, 1.5].map((y, i) => (
        <group key={i}>
          <S material={M.oak} position={[0, y, 0]}><boxGeometry args={[w, 0.03, d]} /></S>
          {Array.from({ length: 7 }).map((_, k) => <S key={k} material={cupMat} position={[-w / 2 + 0.15 + k * ((w - 0.3) / 6), y + 0.06, 0]}><cylinderGeometry args={[0.045, 0.04, 0.09, 16]} /></S>)}
        </group>
      ))}
      {[-w / 2 + 0.02, w / 2 - 0.02].map((x, i) => <S key={i} material={M.steel} position={[x, h / 2, 0]}><boxGeometry args={[0.03, h, d]} /></S>)}
    </group>
  )
}
function CoffeeTable() {
  return (
    <group>
      <S material={M.walnut} position={[0, 0.43, 0]}><cylinderGeometry args={[0.3, 0.3, 0.04, 40]} /></S>
      <S material={M.brass} position={[0, 0.21, 0]}><cylinderGeometry args={[0.04, 0.12, 0.42, 20]} /></S>
    </group>
  )
}

// Real-product glTF models (Khronos glTF-Sample-Assets): fitted to the planned footprint.
const GLB = { sofa: 'GlamVelvetSofa', armchair: 'SheenChair', plant: 'DiffuseTransmissionPlant', lamp: 'AnisotropyBarnLamp', cup: 'DiffuseTransmissionTeacup' }
function Glb({ name, w, d, h, fit = 'footprint' }) {
  const { scene } = useGLTF(`${BASE}models/real/${name}.glb`)
  const { obj, s, off } = useMemo(() => {
    const obj = scene.clone(true)
    obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true } })
    const b = new THREE.Box3().setFromObject(obj)
    const size = new THREE.Vector3(); b.getSize(size)
    const c = new THREE.Vector3(); b.getCenter(c)
    const s = fit === 'height' ? h / size.y : Math.min(w / size.x, d / size.z)
    return { obj, s, off: [-c.x, -b.min.y, -c.z] }
  }, [scene, w, d, h, fit])
  return <group scale={[s, s, s]}><primitive object={obj} position={off} /></group>
}

const LEATHER = new THREE.MeshStandardMaterial({ color: '#8a4b2a', roughness: 0.55 })
function Banquette({ w, d }) {
  const n = Math.max(1, Math.round(d / 0.65))
  return (
    <group>
      <S material={M.walnut} position={[0, 0.2, 0]}><boxGeometry args={[w, 0.4, d]} /></S>
      <S material={LEATHER} position={[0.02, 0.45, 0]}><boxGeometry args={[w - 0.04, 0.1, d - 0.04]} /></S>
      {Array.from({ length: n }).map((_, i) => (
        <S key={i} material={LEATHER} position={[-w / 2 + 0.07, 0.75, -d / 2 + (i + 0.5) * (d / n)]}><boxGeometry args={[0.1, 0.46, d / n - 0.03]} /></S>
      ))}
      <S material={M.walnut} position={[-w / 2 + 0.07, 1.0, 0]}><boxGeometry args={[0.14, 0.04, d]} /></S>
    </group>
  )
}
const RUG = new THREE.MeshStandardMaterial({ color: '#b7a58a', roughness: 1 }), RUG2 = new THREE.MeshStandardMaterial({ color: '#8c7a62', roughness: 1 })
function Rug({ w, d }) {
  return (
    <group>
      <mesh material={RUG2} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[w, d]} /></mesh>
      <mesh material={RUG} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}><planeGeometry args={[w - 0.3, d - 0.3]} /></mesh>
    </group>
  )
}
const ART = ['#c96f3b', '#2f4a40', '#d9c7a3'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }))
function Art({ d, h, id }) {
  const k = (id || '').length % 3
  return (
    <group>
      <mesh material={M.black}><boxGeometry args={[0.03, h, d]} /></mesh>
      <mesh material={M.white} position={[0.017, 0, 0]}><boxGeometry args={[0.005, h - 0.08, d - 0.08]} /></mesh>
      <mesh material={ART[k]} position={[0.021, -0.05, 0]}><boxGeometry args={[0.004, h * 0.45, d * 0.5]} /></mesh>
      <mesh material={ART[(k + 1) % 3]} position={[0.022, 0.16, 0.06]}><boxGeometry args={[0.004, h * 0.2, d * 0.3]} /></mesh>
    </group>
  )
}

export function Item({ it }) {
  const { kind, w, d, h } = it
  switch (kind) {
    case 'bistro': return <Bistro />
    case 'cafetable': return <Bistro />
    case 'banquette': return <Banquette w={w} d={d} />
    case 'rug': return <Rug w={w} d={d} />
    case 'art': return <Art d={d} h={h} id={it.id} />
    case 'chair': return <Chair />
    case 'stool': return <Stool />
    case 'windowbar': return <WindowBar w={w} d={d} />
    case 'counter': return <Counter w={w} d={d} />
    case 'espresso': return <Espresso />
    case 'pastry': return <Pastry w={w} d={d} h={h} />
    case 'fridge': return <Fridge w={w} d={d} h={h} />
    case 'sink': return <Sink w={w} d={d} h={h} />
    case 'shelf': return <Shelf w={w} d={d} h={h} />
    case 'coffeetable': return <CoffeeTable />
    case 'sofa': return <Glb name={GLB.sofa} w={w} d={d} h={h} />
    case 'armchair': return <Glb name={GLB.armchair} w={w} d={d} h={h} />
    case 'plant': return <Glb name={GLB.plant} w={w} d={d} h={h} fit="height" />
    case 'lamp': return <Glb name={GLB.lamp} w={w} d={d} h={h} fit="height" />
    case 'cup': return <Glb name={GLB.cup} w={w} d={d} h={h} fit="height" />
    default: return null
  }
}
