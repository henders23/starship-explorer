import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import type { Campaign } from '../engine/exploration/campaign.js'
import { plotCourse } from '../engine/exploration/navigation.js'
import type { StarType } from '../engine/worldgen/types.js'
import { REGION_NAMES } from '../engine/worldgen/types.js'

const WIDTH = 900
const HEIGHT = 440
const STAR_COLORS: Record<StarType, string> = {
  yellow: '#f6ddaa', orange: '#ffbd82', 'red-dwarf': '#e89b8b', 'red-giant': '#f6a278',
  'blue-giant': '#9bdfff', 'white-dwarf': '#edf7fd', neutron: '#b5a2ff', binary: '#d6ffe5',
}

/** An interactive stellar atlas. Visual state never alters the campaign state. */
export function ExpeditionGalaxyChart({ state, selected, onSelect }: { state: Campaign; selected: string; onSelect: (id: string) => void }) {
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [hovered, setHovered] = useState<string | null>(null)
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null)
  const systems = state.galaxy.systems
  const spots = useMemo(() => {
    const xs = systems.map(s => s.x), ys = systems.map(s => s.y)
    const minX = Math.min(...xs), minY = Math.min(...ys)
    const spanX = Math.max(1, Math.max(...xs) - minX), spanY = Math.max(1, Math.max(...ys) - minY)
    const scale = Math.min(740 / spanX, 316 / spanY)
    const padX = 80 + (740 - spanX * scale) / 2, padY = 64 + (316 - spanY * scale) / 2
    return new Map(systems.map(s => [s.id, { x: padX + (s.x - minX) * scale, y: padY + (s.y - minY) * scale }]))
  }, [systems])
  const spot = (id: string) => spots.get(id) ?? { x: 450, y: 220 }
  const connected = new Set(state.galaxy.adjacency[state.at] ?? [])
  const visited = new Set(state.visited)
  // The same course the travel controls fly: fewest jumps with the current drive, then least fuel.
  const course = useMemo(() => plotCourse(state, selected), [state, selected])
  const route = course?.path ?? []
  const jumps = route.length - 1
  const routeEdges = new Set(route.slice(1).map((id, i) => [route[i], id].sort().join('|')))
  const selectedSystem = systems.find(s => s.id === selected)
  const inspect = systems.find(s => s.id === hovered) ?? selectedSystem
  useEffect(() => { setZoom(1); setPan({ x: 0, y: 0 }); setHovered(null) }, [state.seed])

  const pointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0 || (event.target instanceof Element && event.target.closest('.exp-atlas-star'))) return
    drag.current = { px: event.clientX, py: event.clientY, x: pan.x, y: pan.y }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const pointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!drag.current) return
    const dimensions = event.currentTarget.getBoundingClientRect()
    const dx = (event.clientX - drag.current.px) * WIDTH / Math.max(1, dimensions.width)
    const dy = (event.clientY - drag.current.py) * HEIGHT / Math.max(1, dimensions.height)
    setPan({ x: Math.max(-380, Math.min(380, drag.current.x + dx)), y: Math.max(-220, Math.min(220, drag.current.y + dy)) })
  }
  const pointerUp = (event: PointerEvent<SVGSVGElement>) => {
    drag.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  return <section className="exp-atlas" aria-label="Interactive stellar chart">
    <svg className="exp-map exp-atlas-svg" viewBox="0 0 900 440" aria-label="Exploration galaxy map"
      onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}>
      <defs>
        <radialGradient id="atlas-halo"><stop stopColor="#9cdff6" stopOpacity=".55"/><stop offset="1" stopColor="#72c4f2" stopOpacity="0"/></radialGradient>
        <radialGradient id="atlas-vignette"><stop offset=".42" stopColor="#03111b" stopOpacity="0"/><stop offset="1" stopColor="#02060f" stopOpacity=".7"/></radialGradient>
        <pattern id="atlas-grid" width="45" height="45" patternUnits="userSpaceOnUse"><path d="M 45 0 L 0 0 L 0 45" fill="none" stroke="#a1c2da" strokeOpacity=".065" strokeWidth=".8"/></pattern>
      </defs>
      <image href="/assets/galaxy/expedition-nebula.webp" x={0} y={0} width={WIDTH} height={HEIGHT} preserveAspectRatio="xMidYMid slice" pointerEvents="none" />
      <rect width={WIDTH} height={HEIGHT} fill="#030b13" fillOpacity=".33" pointerEvents="none"/>
      <rect width={WIDTH} height={HEIGHT} fill="url(#atlas-vignette)" pointerEvents="none"/>
      <rect width={WIDTH} height={HEIGHT} fill="url(#atlas-grid)" pointerEvents="none"/>
      <g className="exp-atlas-cartography" data-testid="galaxy-camera" transform={`translate(${450 + pan.x} ${220 + pan.y}) scale(${zoom}) translate(-450 -220)`}>
        <g className="exp-atlas-rings" pointerEvents="none">
          {[100, 195, 300, 410].map(radius => <circle key={radius} cx="450" cy="220" r={radius} fill="none" stroke="#8abbce" strokeOpacity=".12" strokeWidth=".75" strokeDasharray="3 12"/>)}
          <path d="M 0 220 H 900 M 450 0 V 440" stroke="#78b8d1" strokeOpacity=".13" strokeWidth=".8" strokeDasharray="4 12"/>
        </g>
        <g className="exp-atlas-lanes" pointerEvents="none">
          {state.galaxy.lanes.map(([a,b]) => {
            const p=spot(a), q=spot(b), highlighted=routeEdges.has([a,b].sort().join('|'))
            return <line key={`${a}-${b}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y} className={highlighted?'route':connected.has(a)||connected.has(b)?'nearby':'ordinary'}/>
          })}
        </g>
        {route.length>1 && <polyline data-testid="galaxy-route" className="exp-atlas-route" points={route.map(id=>{const p=spot(id);return `${p.x},${p.y}`}).join(' ')} fill="none" pointerEvents="none"/>}
        {systems.map(s => {
          const p=spot(s.id), current=s.id===state.at, chosen=s.id===selected, near=connected.has(s.id), seen=visited.has(s.id)
          const label=current||chosen||hovered===s.id
          return <g key={s.id} className={`exp-atlas-star ${current?'is-current':''} ${chosen?'is-selected':''}`}
            role="button" tabIndex={0} aria-label={`Select ${s.name}`}
            onPointerEnter={()=>setHovered(s.id)} onPointerLeave={()=>setHovered(v=>v===s.id?null:v)}
            onFocus={()=>setHovered(s.id)} onBlur={()=>setHovered(v=>v===s.id?null:v)}
            onClick={()=>onSelect(s.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(s.id)}}}>
            <circle className="exp-atlas-hit" cx={p.x} cy={p.y} r={15} fill="transparent" stroke="transparent"/>
            <circle cx={p.x} cy={p.y} r={current?27:near?17:13} fill="url(#atlas-halo)" opacity={current ? 0.75 : near ? 0.48 : 0.20} pointerEvents="none"/>
            {chosen&&<circle cx={p.x} cy={p.y} r={18} className="exp-atlas-target" fill="none" pointerEvents="none"/>}
            {near&&!current&&<circle cx={p.x} cy={p.y} r={11} fill="none" stroke="#67c9e3" strokeOpacity=".55" strokeWidth=".8" pointerEvents="none"/>}
            <circle cx={p.x} cy={p.y} r={current?6.5:seen?5.3:near?4.5:3.8} fill={STAR_COLORS[s.star]} stroke={seen?'#d6fcf3':'#051a24'} strokeWidth={seen?1.3:1.6} opacity={seen||near?1:.86} pointerEvents="none"/>
            {current&&<image href="/assets/ships/expedition-ithaca.webp" x={p.x-10} y={p.y-22} width={20} height={30} className="exp-atlas-ithaca" pointerEvents="none"/>}
            {label&&<text x={p.x} y={p.y-27} textAnchor={p.x<135?'start':p.x>765?'end':'middle'} className="exp-atlas-label" pointerEvents="none">{current?'ITHACA / ':''}{s.name}</text>}
          </g>
        })}
      </g>
    </svg>
    <div className="exp-atlas-tools" role="group" aria-label="Galactic chart controls">
      <button onClick={()=>setZoom(n=>Math.min(2.5,Math.round((n+.2)*10)/10))} disabled={zoom>=2.5} aria-label="Zoom in" title="Zoom in">+</button>
      <button onClick={()=>setZoom(n=>Math.max(.8,Math.round((n-.2)*10)/10))} disabled={zoom<=.8} aria-label="Zoom out" title="Zoom out">−</button>
      <button onClick={()=>{setZoom(1);setPan({x:0,y:0})}} aria-label="Recenter chart" title="Recenter chart">⌖</button>
    </div>
    <div className="exp-atlas-readout">
      <span><strong>GALACTIC ATLAS</strong><small>{systems.length} systems · {state.visited.length} visited</small></span>
      <span aria-live="polite"><strong>{inspect?.name ?? 'Uncharted sector'}</strong><small>{inspect ? `${REGION_NAMES[inspect.region]} · ${inspect.star.replaceAll('-', ' ')}` : 'Select a destination'}</small></span>
      <span><strong>{jumps>0?`${jumps} ${jumps===1?'JUMP':'JUMPS'} · ${course!.fuel} FUEL`:selected===state.at?'CURRENT POSITION':'NO COURSE'}</strong><small>{selected===state.at?'ISS Ithaca':jumps>0?`Arrives day ${state.day+jumps}`:'Unreachable with the current drive'}</small></span>
    </div>
    <p className="exp-atlas-hint">Select a star to inspect · drag empty space to pan · use + / − to zoom</p>
  </section>
}