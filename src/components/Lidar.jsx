import React, { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'

// Real airborne LiDAR (USGS 3DEP, New York City 2017) around the storefront.
// Points are pre-cut to a 200 m square by scripts/lidar_export.py and stored as int16 decimetres.
const META_URL = `${import.meta.env.BASE_URL}lidar/meta.json`
let metaPromise
export const loadLidarMeta = () => (metaPromise ||= fetch(META_URL).then((r) => r.json()))

const GROUND = new THREE.Color('#6b7079'), LO = new THREE.Color('#3d4fd1'), HI = new THREE.Color('#dfe6ff')

export default function Lidar({ siteId, W, D, onInfo }) {
  const [geo, setGeo] = useState(null)
  useEffect(() => {
    let dead = false
    Promise.all([loadLidarMeta(), fetch(`${import.meta.env.BASE_URL}lidar/${siteId}.bin`).then((r) => r.arrayBuffer())]).then(([meta, buf]) => {
      if (dead) return
      const site = meta.sites[siteId]
      const n = new DataView(buf).getUint32(0, true)
      const q = new Int16Array(buf, 4, n * 3)
      const cls = new Uint8Array(buf, 4 + n * 6, n)
      const flip = site.streetSide === 'east' ? -1 : 1 // keep the map un-mirrored
      const pos = new Float32Array(n * 3), col = new Float32Array(n * 3)
      const c = new THREE.Color()
      let k = 0
      for (let i = 0; i < n; i++) {
        const x = (q[i * 3] / 10) * flip + W / 2, y = q[i * 3 + 1] / 10, z = q[i * 3 + 2] / 10
        // cut away the host building over our room so the plan shows through
        if (x > -0.4 && x < W + 0.4 && z > -0.3 && z < D + 0.4) continue
        if (cls[i] === 2 || y < 1.2) c.copy(GROUND)
        else c.copy(LO).lerp(HI, Math.min(1, Math.max(0, (y - 2) / 28)))
        pos.set([x, y, z], k * 3); col.set([c.r, c.g, c.b], k * 3); k++
      }
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, k * 3), 3))
      g.setAttribute('color', new THREE.BufferAttribute(col.subarray(0, k * 3), 3))
      setGeo(g)
      onInfo?.({ shown: k, total: n, ...site, source: meta.source, radiusM: meta.radiusM })
    })
    return () => { dead = true }
  }, [siteId, W, D])
  if (!geo) return null
  return (
    <points geometry={geo}>
      <pointsMaterial vertexColors size={0.35} sizeAttenuation transparent opacity={0.9} depthWrite={false} />
    </points>
  )
}
