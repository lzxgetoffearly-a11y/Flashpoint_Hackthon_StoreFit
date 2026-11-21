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
      const CELL = 2.5, N = 80, grid = new Float32Array(N * N), cnt = new Uint16Array(N * N), gnd = new Uint16Array(N * N)
      for (let i = 0; i < n; i++) {
        const x = (q[i * 3] / 10) * flip + W / 2, y = q[i * 3 + 1] / 10, z = q[i * 3 + 2] / 10
        pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z
        const gx = Math.floor((x - W / 2 + 100) / CELL), gz = Math.floor((z + 100) / CELL)
        if (gx < 0 || gz < 0 || gx >= N || gz >= N) continue
        const k = gz * N + gx
        // The laser reaches the pavement through a tree but not through a roof, so a cell that
        // still has ground returns is a tree (or a wall edge), not a building to extrude.
        if (cls[i] === 2 || y < 1.5) { gnd[k]++; continue }
        if (y < 3) continue
        cnt[k]++; if (y > grid[k]) grid[k] = y
      }
      // 3×3 median so roofs read as blocks, not spikes
      const sm = new Float32Array(N * N), buf9 = []
      for (let gz = 0; gz < N; gz++) for (let gx = 0; gx < N; gx++) {
        buf9.length = 0
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const x = gx + a, z = gz + b; if (x >= 0 && z >= 0 && x < N && z < N) buf9.push(cnt[z * N + x] >= 4 && gnd[z * N + x] <= 0.1 * (cnt[z * N + x] + gnd[z * N + x]) ? grid[z * N + x] : 0) }
        buf9.sort((p, q) => p - q); sm[gz * N + gx] = Math.round(buf9[buf9.length >> 1] / 3) * 3
      }
      const cells = [], host = []
      for (let gz = 0; gz < N; gz++) for (let gx = 0; gx < N; gx++) {
        const k = gz * N + gx
        if (sm[k] < 4) continue
        const cx = (gx + 0.5) * CELL - 100 + W / 2, czz = (gz + 0.5) * CELL - 100
        // the host building is drawn as glass so the ground-floor unit stays visible inside it
        const over = Math.abs(cx - W / 2) < W / 2 + 1.25 && czz > -1.25 && czz < D + 1.25
        const near = Math.abs(cx - W / 2) < W / 2 + 9 && czz > -1.25 && czz < D + 9
        if (over || near) host.push([cx, czz, sm[k], over ? 4.2 : 0]); else cells.push([cx, czz, sm[k]])
      }
      // north in scene coordinates (Manhattan avenues run 28.9° east of north)
      const a = (28.9 * Math.PI) / 180, s = site.streetSide === 'east' ? 1 : -1
      const north = [flip * Math.cos(a), s * Math.sin(a)]
      setData({ pos, cls, n, cells, host, CELL, north, info: { total: n, ...site, source: meta.source, radiusM: meta.radiusM } })
    }).catch(() => {})
    return () => { dead = true }
  }, [siteId, W, D])
  return data
}

const GROUND = new THREE.Color('#6b7079'), LO = new THREE.Color('#3d4fd1'), HI = new THREE.Color('#dfe6ff')
export function LidarPoints({ data, W, D }) {
  const [far, host] = useMemo(() => {
    const { pos, cls, n } = data
    const mk = () => ({ p: new Float32Array(n * 3), col: new Float32Array(n * 3), k: 0 })
    const A = mk(), B = mk(), c = new THREE.Color()
    for (let i = 0; i < n; i++) {
      const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2]
      const over = x > -1 && x < W + 1 && z > -0.5 && z < D + 1
      if (over && y < 4.2) continue // nothing was scanned indoors; stray returns would sit in the room
      if (cls[i] === 2 || y < 1.2) c.copy(GROUND); else c.copy(LO).lerp(HI, Math.min(1, Math.max(0, (y - 2) / 28)))
      const t = over ? B : A
      t.p.set([x, y, z], t.k * 3); t.col.set([c.r, c.g, c.b], t.k * 3); t.k++
    }
    return [A, B].map((t) => {
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(t.p.subarray(0, t.k * 3), 3))
      g.setAttribute('color', new THREE.BufferAttribute(t.col.subarray(0, t.k * 3), 3))
      return g
    })
  }, [data, W, D])
  return (
    <>
      <points geometry={far}><pointsMaterial vertexColors size={0.6} sizeAttenuation transparent opacity={0.95} depthWrite={false} /></points>
      <points geometry={host}><pointsMaterial vertexColors size={0.5} sizeAttenuation transparent opacity={0.3} depthWrite={false} /></points>
    </>
  )
}

function Boxes({ cells, CELL, children }) {
  const ref = useRef()
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    cells.forEach(([x, z, h, y0 = 0], i) => { m.makeScale(CELL, Math.max(0.1, h - y0), CELL); m.setPosition(x, (h + y0) / 2 - 0.05, z); ref.current.setMatrixAt(i, m) })
    ref.current.instanceMatrix.needsUpdate = true
  }, [cells, CELL])
  return <instancedMesh ref={ref} args={[null, null, cells.length]} key={cells.length} renderOrder={2}><boxGeometry />{children}</instancedMesh>
}

export function Massing({ data, dark }) {
  return (
    <>
      <Boxes cells={data.cells} CELL={data.CELL}><meshLambertMaterial color={dark ? '#6a6d73' : '#dedbd4'} /></Boxes>
      {data.host.length > 0 && <HostGlass data={data} dark={dark} />}
    </>
  )
}

// The building the unit sits in: translucent, starting above the shop ceiling.
export function HostGlass({ data, dark }) {
  return <Boxes cells={data.host} CELL={data.CELL}><meshLambertMaterial color={dark ? '#aeb6ff' : '#8f95a3'} transparent opacity={dark ? 0.13 : 0.16} depthWrite={false} /></Boxes>
}
