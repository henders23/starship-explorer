import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent, ReactNode } from 'react'
import type { Campaign } from '../engine/exploration/campaign.js'
import { plotCourse } from '../engine/exploration/navigation.js'
import { REGIONAL_THREAT } from '../engine/exploration/v2.js'
import type { StarType } from '../engine/worldgen/types.js'
import { REGION_NAMES } from '../engine/worldgen/types.js'

const STAR_COLORS: Record<StarType, string> = {
  yellow: '#f6ddaa', orange: '#ffbd82', 'red-dwarf': '#e89b8b', 'red-giant': '#f6a278',
  'blue-giant': '#9bdfff', 'white-dwarf': '#edf7fd', neutron: '#b5a2ff', binary: '#d6ffe5',
}
/** Space kept clear of stars for the chart tools above and the key below. */
const PAD = { top: 84, right: 60, bottom: 86, left: 60 }

/**
 * The full-screen stellar atlas. Hovering a star for a second, or selecting
 * it, opens a card beside it with the route and travel orders. Visual state
 * never alters the campaign state.
 */
export function ExpeditionGalaxyChart({ state, selected, onSelect, card, status }: {
  state: Campaign; selected: string | null; onSelect: (id: string | null) => void; card: (id: string) => ReactNode; status: ReactNode
}) {
  const frame = useRef<HTMLElement>(null)
  const [size, setSize] = useState({ w: 1200, h: 700 })
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [hovered, setHovered] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null)
  const hoverTimer = useRef(0), hideTimer = useRef(0), inCard = useRef(false)
  useLayoutEffect(() => {
    const element = frame.current
    if (!element) return
    const measure = () => setSize({ w: Math.max(320, element.clientWidth), h: Math.max(320, element.clientHeight) })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  useEffect(() => () => { window.clearTimeout(hoverTimer.current); window.clearTimeout(hideTimer.current) }, [])
  const systems = state.galaxy.systems
  const { w, h } = size
  const spots = useMemo(() => {
    const xs = systems.map(s => s.x), ys = systems.map(s => s.y)
    const minX = Math.min(...xs), minY = Math.min(...ys)
    const spanX = Math.max(1, Math.max(...xs) - minX), spanY = Math.max(1, Math.max(...ys) - minY)
    const innerW = Math.max(120, w - PAD.left - PAD.right), innerH = Math.max(120, h - PAD.top - PAD.bottom)
    // Stretch to the frame, but never more than twice as far on one axis as the other.
    const sx = innerW / spanX, sy = innerH / spanY, scaleX = Math.min(sx, sy * 2), scaleY = Math.min(sy, sx * 2)
    const padX = PAD.left + (innerW - spanX * scaleX) / 2, padY = PAD.top + (innerH - spanY * scaleY) / 2
    return new Map(systems.map(s => [s.id, { x: padX + (s.x - minX) * scaleX, y: padY + (s.y - minY) * scaleY }]))
  }, [systems, w, h])
  const cx = w / 2, cy = h / 2
  const spot = (id: string) => spots.get(id) ?? { x: cx, y: cy }
  /** Where a star sits on screen once the camera has zoomed and panned. */
  const screen = (id: string) => { const p = spot(id); return { x: cx + pan.x + (p.x - cx) * zoom, y: cy + pan.y + (p.y - cy) * zoom } }
  const connected = new Set(state.galaxy.adjacency[state.at] ?? [])
  const visited = new Set(state.visited)
  const active = hovered ?? selected
  // The same course the travel controls fly: fewest jumps with the current drive, then least fuel.
  const course = useMemo(() => active ? plotCourse(state, active) : null, [state, active])
  const route = course?.path ?? []
  const routeEdges = new Set(route.slice(1).map((id, i) => [route[i], id].sort().join('|')))
  useEffect(() => { setZoom(1); setPan({ x: 0, y: 0 }); setHovered(null) }, [state.seed])

  const hideSoon = () => {
    window.clearTimeout(hoverTimer.current); window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => { if (!inCard.current) setHovered(null) }, 350)
  }
  const hoverSoon = (id: string) => {
    window.clearTimeout(hideTimer.current); window.clearTimeout(hoverTimer.current)
    hoverTimer.current = window.setTimeout(() => setHovered(id), 1000)
  }
  const pick = (id: string | null) => {
    window.clearTimeout(hoverTimer.current); window.clearTimeout(hideTimer.current)
    inCard.current = false; setHovered(null); onSelect(id)
  }
  const pointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0 || (event.target instanceof Element && event.target.closest('.exp-atlas-star'))) return
    drag.current = { px: event.clientX, py: event.clientY, x: pan.x, y: pan.y }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const pointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!drag.current) return
    const x = drag.current.x + event.clientX - drag.current.px, y = drag.current.y + event.clientY - drag.current.py
    setPan({ x: Math.max(-w / 2, Math.min(w / 2, x)), y: Math.max(-h / 2, Math.min(h / 2, y)) })
  }
  const pointerUp = (event: PointerEvent<SVGSVGElement>) => {
    drag.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  const matches = query.trim() ? systems.filter((s) => `${s.name} ${REGION_NAMES[s.region]}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8) : []
  const anchor = active ? screen(active) : null
  const right = !!anchor && anchor.x > w * 0.62, low = !!anchor && anchor.y > h * 0.52
  const cardStyle = anchor ? {
    left: right ? undefined : Math.min(anchor.x + 28, w - 300), right: right ? Math.max(12, w - anchor.x + 28) : undefined,
    top: low ? undefined : Math.max(76, anchor.y - 40), bottom: low ? Math.max(12, h - anchor.y - 40) : undefined,
  } : undefined

  return <section className="exp-atlas" aria-label="Interactive stellar chart" ref={frame}>
    <svg className="exp-atlas-svg" viewBox={`0 0 ${w} ${h}`} aria-label="Exploration galaxy map"
      onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}>
      <defs>
        <radialGradient id="atlas-halo"><stop stopColor="#9cdff6" stopOpacity=".55"/><stop offset="1" stopColor="#72c4f2" stopOpacity="0"/></radialGradient>
        <radialGradient id="atlas-danger"><stop stopColor="#ff4a3a" stopOpacity=".5"/><stop offset=".55" stopColor="#ff4a3a" stopOpacity=".16"/><stop offset="1" stopColor="#ff4a3a" stopOpacity="0"/></radialGradient>
      </defs>
      <image href="/assets/galaxy/expedition-nebula.webp" x={0} y={0} width={w} height={h} preserveAspectRatio="xMidYMid slice" pointerEvents="none" />
      <rect className="exp-atlas-veil" width={w} height={h} pointerEvents="none"/>
      <g className="exp-atlas-cartography" data-testid="galaxy-camera" transform={`translate(${cx + pan.x} ${cy + pan.y}) scale(${zoom}) translate(${-cx} ${-cy})`}>
        {/* Hostile space: hazes that deepen with regional threat, where jumps can end in an interception. */}
        <g className="exp-atlas-danger" pointerEvents="none" data-testid="galaxy-danger">
          {systems.filter((s) => REGIONAL_THREAT[s.region] > 0).map((s) => { const p = spot(s.id), t = REGIONAL_THREAT[s.region]
            return <circle key={s.id} cx={p.x} cy={p.y} r={26 + t * 9} fill="url(#atlas-danger)" opacity={0.3 + t * 0.2} /> })}
        </g>
        <g className="exp-atlas-lanes" pointerEvents="none">
          {state.galaxy.lanes.map(([a, b]) => {
            const p = spot(a), q = spot(b), highlighted = routeEdges.has([a, b].sort().join('|'))
            return <line key={`${a}-${b}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y} className={highlighted ? 'route' : connected.has(a) || connected.has(b) ? 'nearby' : 'ordinary'}/>
          })}
        </g>
        {route.length > 1 && <polyline data-testid="galaxy-route" className="exp-atlas-route" points={route.map(id => { const p = spot(id); return `${p.x},${p.y}` }).join(' ')} fill="none" pointerEvents="none"/>}
        {systems.map(s => {
          const p = spot(s.id), current = s.id === state.at, chosen = s.id === active, near = connected.has(s.id), seen = visited.has(s.id)
          return <g key={s.id} className={`exp-atlas-star ${current ? 'is-current' : ''} ${chosen ? 'is-selected' : ''}`}
            role="button" tabIndex={0} aria-label={`${current ? 'Lodestar at' : 'Select'} ${s.name}`} aria-pressed={s.id === selected}
            onPointerEnter={() => hoverSoon(s.id)} onPointerLeave={hideSoon}
            onFocus={() => { window.clearTimeout(hideTimer.current); setHovered(s.id) }} onBlur={hideSoon}
            onClick={() => pick(s.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(s.id) } }}>
            <circle className="exp-atlas-hit" cx={p.x} cy={p.y} r={15} fill="transparent" stroke="transparent"/>
            <circle cx={p.x} cy={p.y} r={current ? 27 : near ? 17 : 13} fill="url(#atlas-halo)" opacity={current ? 0.75 : near ? 0.48 : 0.2} pointerEvents="none"/>
            {chosen && !current && <circle cx={p.x} cy={p.y} r={19} className="exp-atlas-target" fill="none" pointerEvents="none"/>}
            {near && !current && <circle cx={p.x} cy={p.y} r={11} fill="none" stroke="#67c9e3" strokeOpacity=".55" strokeWidth=".8" pointerEvents="none"/>}
            <circle cx={p.x} cy={p.y} r={current ? 6.5 : seen ? 5.3 : near ? 4.5 : 3.8} fill={STAR_COLORS[s.star]} stroke={seen ? '#d6fcf3' : '#051a24'} strokeWidth={seen ? 1.3 : 1.6} opacity={seen || near ? 1 : .86} pointerEvents="none"/>
            {current && <image href="/assets/ships/expedition-ithaca.webp" x={p.x - 10} y={p.y - 22} width={20} height={30} className="exp-atlas-ithaca" pointerEvents="none"/>}
            {(current || chosen) && <text x={p.x} y={p.y - (current ? 30 : 26)} textAnchor="middle" className={`exp-atlas-label${chosen && !current ? ' chosen' : ''}`} pointerEvents="none">{current ? 'LODESTAR / ' : ''}{s.name}</text>}
          </g>
        })}
      </g>
    </svg>
    <div className="exp-atlas-tools" role="group" aria-label="Galactic chart controls">
      <div className="exp-atlas-search">
        <label className="exp-search"><span className="exp-sr">Find system</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find system" aria-label="Find system" /></label>
        {matches.length > 0 && <div className="exp-chart-list">{matches.map((system) => <button key={system.id}
          onClick={() => { setQuery(''); pick(system.id) }}><strong>{system.name}</strong><small>{REGION_NAMES[system.region]}{visited.has(system.id) ? ' · visited' : ''}</small></button>)}</div>}
      </div>
      <button onClick={() => setZoom(n => Math.min(2.5, Math.round((n + .2) * 10) / 10))} disabled={zoom >= 2.5} aria-label="Zoom in" title="Zoom in"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M8 2v12M2 8h12"/></svg></button>
      <button onClick={() => setZoom(n => Math.max(.8, Math.round((n - .2) * 10) / 10))} disabled={zoom <= .8} aria-label="Zoom out" title="Zoom out"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M2 8h12"/></svg></button>
      <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }} aria-label="Recenter chart" title="Recenter chart"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true"><circle cx="9" cy="9" r="5"/><path d="M9 1v4M9 13v4M1 9h4M13 9h4"/></svg></button>
    </div>
    {active && cardStyle && <section className="exp-atlas-card" aria-label={`${systems.find((s) => s.id === active)?.name} details`} aria-live="polite" style={cardStyle}
      onPointerEnter={() => { inCard.current = true; window.clearTimeout(hideTimer.current) }} onPointerLeave={() => { inCard.current = false; if (hovered) hideSoon() }}>
      <button className="exp-close" aria-label="Close details" onClick={() => pick(null)}><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12"/></svg></button>
      {card(active)}
    </section>}
    <div className="exp-atlas-key">
      <span><strong>GALACTIC ATLAS</strong> · {systems.length} systems · {state.visited.length} visited</span>
      <span className="exp-atlas-legend"><span className="ithaca">▲ Lodestar</span><span>● Visited</span><span>○ Unvisited</span><span className="selected">◌ Selected</span><span className="danger">◍ Hostile space</span></span>
      {status}
    </div>
  </section>
}
