import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

// Real airborne LiDAR (USGS 3DEP, New York City 2017) around the storefront.
// Points are pre-cut to a 200 m square by scripts/lidar_export.py and stored as int16 decimetres.
const BASE = import.meta.env.BASE_URL
let metaPromise
export const loadLidarMeta = () => (metaPromise ||= fetch(`${BASE}lidar/meta.json`).then((r) => r.json()))
const cache = {}
function loadSite(id) {
  return (cache[id] ||= Promise.all([loadLidarMeta(), fetch(`${BASE}lidar/${id}.bin`).then((r) => r.arrayBuffer())]).then(([meta, buf]) => {
    const n = new DataView(buf).getUint32(0, true)
    return { meta, site: meta.sites[id], n, q: new Int16Array(buf, 4, n * 3), cls: new Uint8Array(buf, 4 + n * 6, n) }
  }))
}

// Returns the cloud in room coordinates plus a 2.5 m height grid for the grey block massing.
export function useLidar(siteId, W, D) {
  const [data, setData] = useState(null)
  useEffect(() => {
    let dead = false
    setData(null)
    loadSite(siteId).then(({ meta, site, n, q, cls }) => {
      if (dead) return
      const flip = site.streetSide === 'east' ? -1 : 1 // keep the map un-mirrored
      const pos = new Float32Array(n * 3)
      const CELL = 2.5, N = 80, grid = new Float32Array(N * N), cnt = new Uint16Array(N * N)
      for (let i = 0; i < n; i++) {
        const x = (q[i * 3] / 10) * flip + W / 2, y = q[i * 3 + 1] / 10, z = q[i * 3 + 2] / 10
        pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z
        if (cls[i] === 2 || y < 3) continue
        const gx = Math.floor((x - W / 2 + 100) / CELL), gz = Math.floor((z + 100) / CELL)
        if (gx < 0 || gz < 0 || gx >= N || gz >= N) continue
        const k = gz * N + gx; cnt[k]++; if (y > grid[k]) grid[k] = y
      }
      // 3×3 median so roofs read as blocks, not spikes
      const sm = new Float32Array(N * N), buf9 = []
      for (let gz = 0; gz < N; gz++) for (let gx = 0; gx < N; gx++) {
        buf9.length = 0
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const x = gx + a, z = gz + b; if (x >= 0 && z >= 0 && x < N && z < N) buf9.push(cnt[z * N + x] >= 4 ? grid[z * N + x] : 0) }
        buf9.sort((p, q) => p - q); sm[gz * N + gx] = Math.round(buf9[buf9.length >> 1] / 3) * 3
      }
      const cells = []
      for (let gz = 0; gz < N; gz++) for (let gx = 0; gx < N; gx++) {
        const k = gz * N + gx
        if (sm[k] < 4) continue
        const cx = (gx + 0.5) * CELL - 100 + W / 2, czz = (gz + 0.5) * CELL - 100
        // leave the host building open around our room so the plan stays visible
        if (Math.abs(cx - W / 2) < W / 2 + 6 && czz > -2 && czz < D + 6) continue
        cells.push([cx, czz, sm[k]])
      }
      // north in scene coordinates (Manhattan avenues run 28.9° east of north)
      const a = (28.9 * Math.PI) / 180, s = site.streetSide === 'east' ? 1 : -1
      const north = [flip * Math.cos(a), s * Math.sin(a)]
      setData({ pos, cls, n, cells, CELL, north, info: { total: n, ...site, source: meta.source, radiusM: meta.radiusM } })
    }).catch(() => {})
    return () => { dead = true }
  }, [siteId, W, D])
  return data
}

const GROUND = new THREE.Color('#6b7079'), LO = new THREE.Color('#3d4fd1'), HI = new THREE.Color('#dfe6ff')
export function LidarPoints({ data, W, D }) {
  const geo = useMemo(() => {
    const { pos, cls, n } = data
    const p = new Float32Array(n * 3), col = new Float32Array(n * 3), c = new THREE.Color()
    let k = 0
    for (let i = 0; i < n; i++) {
      const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2]
      if (x > -0.4 && x < W + 0.4 && z > -0.3 && z < D + 0.4) continue
      if (cls[i] === 2 || y < 1.2) c.copy(GROUND); else c.copy(LO).lerp(HI, Math.min(1, Math.max(0, (y - 2) / 28)))
      p.set([x, y, z], k * 3); col.set([c.r, c.g, c.b], k * 3); k++
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(p.subarray(0, k * 3), 3))
    g.setAttribute('color', new THREE.BufferAttribute(col.subarray(0, k * 3), 3))
    return g
  }, [data, W, D])
  return <points geometry={geo}><pointsMaterial vertexColors size={0.35} sizeAttenuation transparent opacity={0.9} depthWrite={false} /></points>
}

export function Massing({ data, dark }) {
  const ref = useRef()
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    data.cells.forEach(([x, z, h], i) => { m.makeScale(data.CELL, h, data.CELL); m.setPosition(x, h / 2 - 0.05, z); ref.current.setMatrixAt(i, m) })
    ref.current.instanceMatrix.needsUpdate = true
  }, [data])
  return (
    <instancedMesh ref={ref} args={[null, null, data.cells.length]} key={data.cells.length}>
      <boxGeometry />
      <meshLambertMaterial color={dark ? '#6a6d73' : '#dedbd4'} />
    </instancedMesh>
  )
}
