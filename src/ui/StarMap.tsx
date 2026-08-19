import { useEffect, useMemo, useRef, useState } from 'react'
import { routeTo } from '../engine/travel/travel.js'
import type { StarSystem, SystemId } from '../engine/worldgen/types.js'
import { REGION_NAMES } from '../engine/worldgen/types.js'
import { useDispatch, useGalaxyIndex, useGame, useNavPlot } from './store.js'

const PADDING = 40

/**
 * The chart. Its job is to answer one question at a glance — *which stars are
 * still possible* — and to make the second question ("and where is the
 * evidence I have not collected") answerable without hunting.
 *
 * Everything the clues can talk about (star type, features, region, lanes) is
 * public astrographic data, drawn straight on the chart. That is not a
 * concession: a deduction the player cannot check against the map is not a
 * deduction, so this data has to be catalogued even for systems never visited.
 * M1's fog of war hides what is *happening* at a system, not what it is.
 */
export function StarMap() {
  const index = useGalaxyIndex()
  const dispatch = useDispatch()
  const selected = useGame((s) => s.state.selected)
  const searched = useGame((s) => s.state.searched)
  const start = useGame((s) => s.state.galaxy.start)
  const jumps = useGame((s) => s.state.jumps)
  const ship = useGame((s) => s.state.ship)
  const recruitSites = useGame((s) => s.state.recruits.sites)
  const { candidateSet, sites, clues } = useNavPlot()
  const [hovered, setHovered] = useState<SystemId | null>(null)
  const [zoom, setZoom] = useState(1.35)
  const [pan, setPan] = useState({ x: -90, y: -35 })
  const [showLanes, setShowLanes] = useState(true)
  const [showRegions, setShowRegions] = useState(true)
  const [showLabels, setShowLabels] = useState(false)
  const [query, setQuery] = useState('')
  const drag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)

  const { viewBox, project } = useMemo(() => {
    const xs = index.systems.map((s) => s.x)
    const ys = index.systems.map((s) => s.y)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const width = maxX - minX + PADDING * 2
    const height = maxY - minY + PADDING * 2
    return {
      viewBox: `0 0 ${width} ${height}`,
      // The core sits at the origin, off to the left of the sector, so drawing
      // in raw coordinates already puts "coreward" on the left of the chart.
      project: (s: StarSystem) => ({ x: s.x - minX + PADDING, y: s.y - minY + PADDING }),
    }
  }, [index])

  const failedJumps = new Set(jumps.filter((j) => !j.correct).map((j) => j.target))
  const anyTrusted = candidateSet.size < index.systems.length

  // The plotted course to whatever is selected, drawn on the chart so the
  // player sees what a trip costs before the Inspector says it in words.
  const route = useMemo(() => {
    if (!selected || selected === ship.at) return null
    return routeTo(index, ship.at, selected)
  }, [index, ship.at, selected])

  // Region labels drawn at the centroid of each region's actual systems —
  // the chart names the places the engine knows, not invented sectors.
  const regionLabels = useMemo(() => {
    const groups = new Map<string, { x: number; y: number; n: number }>()
    for (const system of index.systems) {
      const p = project(system)
      const group = groups.get(system.region) ?? { x: 0, y: 0, n: 0 }
      groups.set(system.region, { x: group.x + p.x, y: group.y + p.y, n: group.n + 1 })
    }
    return [...groups.entries()].map(([region, { x, y, n }]) => ({
      region: region as keyof typeof REGION_NAMES,
      x: x / n,
      y: y / n,
    }))
  }, [index, project])

  const onWheel = (event: React.WheelEvent) => {
    event.preventDefault()
    setZoom((value) => Math.min(3.2, Math.max(0.85, value + (event.deltaY < 0 ? 0.14 : -0.14))))
  }

  const resetView = () => {
    setZoom(1.35)
    setPan({ x: -90, y: -35 })
  }

  const findSystem = (event: React.FormEvent) => {
    event.preventDefault()
    const match = index.systems.find((system) =>
      system.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
    )
    if (!match) return
    dispatch({ type: 'select', system: match.id })
    setHovered(match.id)
    setZoom((value) => Math.max(value, 1.75))
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return
      if (event.key === '+' || event.key === '=') setZoom((value) => Math.min(3.2, value + 0.2))
      if (event.key === '-') setZoom((value) => Math.max(0.85, value - 0.2))
      if (event.key === '0') resetView()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div
      className="star-map relative h-full w-full overflow-hidden"
      onWheel={onWheel}
      onPointerDown={(event) => {
        if ((event.target as Element).closest('.map-ui')) return
        drag.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y }
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => {
        if (!drag.current) return
        setPan({ x: drag.current.panX + event.clientX - drag.current.x, y: drag.current.panY + event.clientY - drag.current.y })
      }}
      onPointerUp={() => { drag.current = null }}
    >
      <div className="nebula nebula-one" aria-hidden="true" />
      <div className="nebula nebula-two" aria-hidden="true" />
      <div className="galactic-core" aria-hidden="true"><i /><i /><i /></div>
      <svg
        viewBox={viewBox}
        className="galaxy-canvas"
        style={{ transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})` }}
        role="img"
        aria-label="Scrollable and zoomable galactic navigation chart"
      >
        <defs>
          <filter id="star-glow" x="-300%" y="-300%" width="600%" height="600%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <radialGradient id="region-haze"><stop offset="0" stopColor="#164e63" stopOpacity=".24" /><stop offset="1" stopColor="#02060a" stopOpacity="0" /></radialGradient>
        </defs>

        {showRegions && regionLabels.map(({ region, x, y }) => (
          <g key={region} opacity={0.38}>
            <ellipse cx={x} cy={y} rx={150} ry={105} fill="url(#region-haze)" />
            <text x={x} y={y} textAnchor="middle" className="sector-label">
              {REGION_NAMES[region].toUpperCase()}
            </text>
          </g>
        ))}

        {showLanes && <g stroke="var(--color-rule)" strokeWidth={0.8}>
          {index.galaxy.lanes.map(([a, b]) => {
            const from = project(index.system(a))
            const to = project(index.system(b))
            return <line key={`${a}-${b}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} className="jump-lane" />
          })}
        </g>}

        {route && route.path.length > 1 && (
          <polyline
            points={route.path
              .map((id) => {
                const p = project(index.system(id))
                return `${p.x},${p.y}`
              })
              .join(' ')}
            fill="none"
            stroke="var(--color-amber-dim)"
            strokeWidth={1.4}
            strokeDasharray="4 3"
            className="plotted-route"
          />
        )}

        {index.systems.map((system) => {
          const { x, y } = project(system)
          const isCandidate = candidateSet.has(system.id)
          const isSelected = selected === system.id
          const isHovered = hovered === system.id
          const hasEvidence = sites.has(system.id)
          const isStart = system.id === start
          const wasSearched = searched.includes(system.id)
          const failed = failedJumps.has(system.id)

          // Eliminated stars stay on the chart — knowing what you have ruled
          // out is half of knowing anything.
          const fill = failed
            ? 'var(--color-alarm-dim)'
            : isCandidate
              ? 'var(--color-phosphor)'
              : 'var(--color-ink-faint)'
          const radius = isCandidate ? 3.4 : 2.2

          return (
            <g
              key={system.id}
              data-system={system.id}
              onMouseEnter={() => setHovered(system.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => dispatch({ type: 'select', system: system.id })}
              className="cursor-pointer"
              role="button"
              tabIndex={0}
              aria-label={`${system.name}, ${REGION_NAMES[system.region]}`}
              onFocus={() => setHovered(system.id)}
              onBlur={() => setHovered(null)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  dispatch({ type: 'select', system: system.id })
                }
              }}
            >
              {/* Generous invisible hit area — the dots are deliberately small. */}
              <circle cx={x} cy={y} r={11} fill="transparent" />

              {hasEvidence && (
                <circle
                  className="site-ring"
                  cx={x}
                  cy={y}
                  r={9}
                  fill="none"
                  stroke="var(--color-amber)"
                  strokeWidth={0.9}
                />
              )}

              {recruitSites[system.id] && (
                <rect
                  x={x - 3.4}
                  y={y - 3.4}
                  width={6.8}
                  height={6.8}
                  fill="none"
                  stroke="var(--color-phosphor)"
                  strokeWidth={0.8}
                  transform={`rotate(45 ${x} ${y})`}
                />
              )}

              {isSelected && (
                <circle cx={x} cy={y} r={7} fill="none" stroke="var(--color-amber)" strokeWidth={1.2} />
              )}

              {isStart && (
                <rect
                  x={x - 6}
                  y={y - 6}
                  width={12}
                  height={12}
                  fill="none"
                  stroke="var(--color-ink-dim)"
                  strokeWidth={0.9}
                />
              )}

              {ship.at === system.id && (
                <path
                  d={`M ${x} ${y - 8} L ${x + 6} ${y} L ${x} ${y + 8} L ${x - 6} ${y} Z`}
                  fill="none"
                  stroke="var(--color-amber)"
                  strokeWidth={1.3}
                />
              )}

              <circle
                cx={x}
                cy={y}
                r={radius}
                fill={fill}
                opacity={isCandidate || isHovered || isSelected ? 1 : 0.55}
                filter={isCandidate || isSelected ? 'url(#star-glow)' : undefined}
              />

              {wasSearched && !hasEvidence && (
                <circle cx={x} cy={y} r={5.5} fill="none" stroke="var(--color-ink-faint)" strokeWidth={0.5} />
              )}

              {/* Label only what matters: candidates when the field is small,
                  plus whatever the player is pointing at. Labelling ninety
                  stars at once makes the chart unreadable. */}
              {(isHovered ||
                isSelected ||
                showLabels ||
                (isCandidate && anyTrusted && candidateSet.size <= 12)) && (
                <text
                  x={x + 9}
                  y={y + 3.5}
                  fontSize={9}
                  fill={isCandidate ? 'var(--color-phosphor)' : 'var(--color-ink-dim)'}
                  className="pointer-events-none select-none"
                >
                  {system.name}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      <div className="map-ui map-title pointer-events-none absolute top-5 left-5 flex flex-col gap-1">
        <div className="eyebrow">Astrogation · sector chart 7</div>
        <h2>Galactic Navigation</h2>
        <div className="text-ink-dim text-[11px]">
          {anyTrusted ? (
            <>
              <span className="text-phosphor">{candidateSet.size}</span> of {index.systems.length}{' '}
              stars still consistent
            </>
          ) : (
            <>{index.systems.length} stars catalogued — nothing ruled out yet</>
          )}
        </div>
      </div>

      <div className="map-ui map-controls absolute top-5 right-5">
        <button onClick={() => setZoom((value) => Math.min(3.2, value + 0.2))} aria-label="Zoom in">+</button>
        <span>{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom((value) => Math.max(0.85, value - 0.2))} aria-label="Zoom out">−</button>
        <button onClick={resetView} aria-label="Reset map view">⌖</button>
      </div>

      <div className="map-ui map-tools absolute top-5">
        <form onSubmit={findSystem} className="map-search">
          <span aria-hidden="true">⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find system"
            aria-label="Find a star system"
            list="system-names"
          />
          <datalist id="system-names">
            {index.systems.map((system) => <option key={system.id} value={system.name} />)}
          </datalist>
        </form>
        <div className="map-layers" aria-label="Map layers">
          <button className={showLanes ? 'is-on' : ''} onClick={() => setShowLanes((value) => !value)}>Routes</button>
          <button className={showRegions ? 'is-on' : ''} onClick={() => setShowRegions((value) => !value)}>Regions</button>
          <button className={showLabels ? 'is-on' : ''} onClick={() => setShowLabels((value) => !value)}>Names</button>
        </div>
      </div>

      <Legend
        evidenceCount={sites.size}
        held={clues.length}
        recruits={Object.keys(recruitSites).length}
      />

      <div className="map-ui map-scale absolute right-5 bottom-5">
        <span>50 LY</span><i />
        <small>DRAG TO PAN · SCROLL TO ZOOM</small>
      </div>

      {hovered && hovered !== selected && <Readout system={index.system(hovered)} />}
      <div className="map-frame" aria-hidden="true" />
    </div>
  )
}

function Legend({
  evidenceCount,
  held,
  recruits,
}: {
  evidenceCount: number
  held: number
  recruits: number
}) {
  return (
    <div className="map-ui map-legend pointer-events-none absolute bottom-5 left-5 flex flex-col gap-1 text-[10px]">
      <div className="flex items-center gap-2">
        <svg width={14} height={14}>
          <path d="M 7 1.5 L 12 7 L 7 12.5 L 2 7 Z" fill="none" stroke="var(--color-amber)" strokeWidth={1.2} />
        </svg>
        <span className="text-ink-faint">the Ithaca</span>
      </div>
      <LegendRow colour="var(--color-phosphor)" label="consistent with your plot" />
      <LegendRow colour="var(--color-ink-faint)" label="ruled out" />
      <LegendRow colour="var(--color-amber)" label={`unsearched evidence (${evidenceCount})`} ring />
      {recruits > 0 && (
        <div className="flex items-center gap-2">
          <svg width={14} height={14}>
            <rect x={4} y={4} width={6} height={6} fill="none" stroke="var(--color-phosphor)" strokeWidth={1} transform="rotate(45 7 7)" />
          </svg>
          <span className="text-ink-faint">specialist for hire ({recruits})</span>
        </div>
      )}
      <div className="text-ink-faint mt-1">{held} accounts in hand</div>
    </div>
  )
}

function LegendRow({ colour, label, ring }: { colour: string; label: string; ring?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <svg width={14} height={14}>
        {ring ? (
          <circle cx={7} cy={7} r={5} fill="none" stroke={colour} strokeWidth={1} />
        ) : (
          <circle cx={7} cy={7} r={3} fill={colour} />
        )}
      </svg>
      <span className="text-ink-faint">{label}</span>
    </div>
  )
}

function Readout({ system }: { system: StarSystem }) {
  return (
    <div className="panel pointer-events-none absolute top-3 right-3 px-3 py-2">
      <div className="text-amber text-[12px]">{system.name}</div>
      <div className="text-ink-faint text-[10px]">{REGION_NAMES[system.region]}</div>
    </div>
  )
}
