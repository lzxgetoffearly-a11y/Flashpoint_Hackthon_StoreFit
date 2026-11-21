import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useThree, useFrame } from '@react-three/fiber'
import { TilesRenderer, TilesPlugin, TilesAttributionOverlay } from '3d-tiles-renderer/r3f'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { GLTFExtensionsPlugin, GoogleCloudAuthPlugin, ReorientationPlugin, TilesFadePlugin, TileCompressionPlugin } from '3d-tiles-renderer/plugins'

export const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || ''
const draco = new DRACOLoader().setDecoderPath(import.meta.env.BASE_URL + 'draco/')
const GEOID = -31.9 // NAVD88 → WGS84 ellipsoid height in Manhattan, metres (approximate)

// Google Photorealistic 3D Tiles, re-centred on the storefront and turned into the room frame.
// The column above the unit is clipped away so the plan stays visible inside the real building.
export default function Google3D({ site, info, north, W, D }) {
  const gl = useThree((s) => s.gl)
  const ref = useRef()
  const planes = useMemo(() => {
    const m = 0.2
    return [
      new THREE.Plane(new THREE.Vector3(-1, 0, 0), -m),
      new THREE.Plane(new THREE.Vector3(1, 0, 0), -(W + m)),
      new THREE.Plane(new THREE.Vector3(0, 0, -1), -1.1),
      new THREE.Plane(new THREE.Vector3(0, 0, 1), -(D + m)),
    ]
  }, [W, D])
  useEffect(() => { gl.localClippingEnabled = true; return () => { gl.localClippingEnabled = false } }, [gl])
  const onLoad = ({ scene }) => scene.traverse((o) => {
    if (o.material) { o.material.clippingPlanes = planes; o.material.clipIntersection = true; o.material.needsUpdate = true }
  })
  useEffect(() => {
    ref.current?.group?.traverse((o) => { if (o.material) { o.material.clippingPlanes = planes; o.material.clipIntersection = true; o.material.needsUpdate = true } })
  }, [planes])
  useEffect(() => { window.__tiles = ref })
  // Snap to the real building: cast rays from the street at the storefront and slide the tiles
  // until the facade they hit sits on the room's front wall (z = 0). Lot centroids are metres off.
  const [off, setOff] = useState(0)
  const st = useRef({ n: 0, done: 0 })
  const ray = useMemo(() => { const r = new THREE.Raycaster(); r.firstHitOnly = true; r.far = 11; return r }, [])
  useFrame(() => {
    const s = st.current, g = ref.current?.group
    if (!g || s.done > 3 || ++s.n % 45) return
    const hits = []
    for (const fx of [0.15, 0.35, 0.5, 0.65, 0.85]) for (const y of [2.0, 2.8]) {
      ray.set(new THREE.Vector3(W * fx, y, -2.5), new THREE.Vector3(0, 0, 1))
      const h = ray.intersectObject(g, true)[0]
      if (h) hits.push(h.point.z)
    }
    if (hits.length < 4) return
    hits.sort((a, b) => a - b)
    const z = hits[Math.floor(hits.length / 2)]
    // start under the trees, 2.5 m out on the sidewalk, and never move more than a few metres in total
    if (Math.abs(z) > 0.15) { s.done++; setOff((o) => Math.max(-9, Math.min(9, o - z))) } else s.done = 9
  })
  const rotY = Math.atan2(north[0], north[1]) // the re-centred tiles have north on +z
  const args = useMemo(() => ({ lat: site.lat * Math.PI / 180, lon: site.lng * Math.PI / 180, height: info.groundElevM + GEOID, up: '+y', recenter: true }), [site.lat, site.lng, info.groundElevM])
  return (
    <group position={[W / 2, 0, Math.abs(info.streetFaceM) + off]} rotation={[0, rotY, 0]}>
      <TilesRenderer ref={ref} key={site.id} onLoadModel={onLoad} errorTarget={10}>
        <TilesPlugin plugin={GoogleCloudAuthPlugin} args={{ apiToken: GOOGLE_KEY, autoRefreshToken: true }} />
        <TilesPlugin plugin={GLTFExtensionsPlugin} args={{ dracoLoader: draco }} />
        <TilesPlugin plugin={ReorientationPlugin} args={args} />
        <TilesPlugin plugin={TileCompressionPlugin} />
        <TilesPlugin plugin={TilesFadePlugin} />
        <TilesAttributionOverlay />
      </TilesRenderer>
    </group>
  )
}
