import React, { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
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
    const m = 1.2
    return [
      new THREE.Plane(new THREE.Vector3(-1, 0, 0), -m),
      new THREE.Plane(new THREE.Vector3(1, 0, 0), -(W + m)),
      new THREE.Plane(new THREE.Vector3(0, 0, -1), -1.5),
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
  const rotY = Math.atan2(north[0], north[1]) // the re-centred tiles have north on +z
  const args = useMemo(() => ({ lat: site.lat * Math.PI / 180, lon: site.lng * Math.PI / 180, height: info.groundElevM + GEOID, up: '+y', recenter: true }), [site.lat, site.lng, info.groundElevM])
  return (
    <group position={[W / 2, 0, Math.abs(info.streetFaceM)]} rotation={[0, rotY, 0]}>
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
