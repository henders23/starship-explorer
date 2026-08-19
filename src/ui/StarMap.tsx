import { useEffect, useMemo, useRef, useState } from 'react'
import { travelCost } from '../engine/state/reducer.js'
import { routeTo } from '../engine/travel/travel.js'
import type { StarSystem, SystemId } from '../engine/worldgen/types.js'
import { REGION_NAMES } from '../engine/worldgen/types.js'
import { useDispatch, useGalaxyIndex, useGame, useNavPlot } from './store.js'

const PADDING = 60

/** How far the legend floats above the deck floor, with and without the drawer. */
const LEGEND_ABOVE_RAIL = 186
const LEGEND_ABOVE_DRAWER = 396

/**
 * The chart, full bleed. Its job is to answer one question at a glance —
 * *which stars are still possible* — and to make the second question ("and
 * where is the evidence I have not collected") answerable without hunting.
 *
 * Everything the clues can talk about (star type, features, region, lanes) is
 * public astrographic data, drawn straight on the chart. That is not a
 * concession: a deduction the player cannot check against the map is not a
 * deduction, so this data has to be catalogued even for systems never visited.
 * M1's fog of war hides what is *happening* at a system, not what it is.
 *
 * The chart owns the whole deck now: the HUD floats over it and the command
 * rail is docked along the bottom, so nothing but the sky sits between the
 * player and the stars they are ruling out.
 */
export function StarMap({
  evidenceOpen = false,
  onOpenGuide,
}: {
  /** The evidence drawer is up, so the legend steps out of its way. */
  evidenceOpen?: boolean
  onOpenGuide?: () => void
}) {
  const index = useGalaxyIndex()
  const dispatch = useDispatch()
  const selected = useGame((s) => s.state.selected)
  const searched = useGame((s) => s.state.searched)
  const jumps = useGame((s) => s.state.jumps)
  const ship = useGame((s) => s.state.ship)
  const recruitSites = useGame((s) => s.state.recruits.sites)
  const { candidateSet, sites, clues, trusted } = useNavPlot()
  const [hovered, setHovered] = useState<SystemId | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [query, setQuery] = useState('')
  const drag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)

  const { viewBox, project } = useMemo(() => {
    const xs = index.systems.map((s) => s.x)
    const ys = index.systems.map((s) => s.y)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const width = Math.max(...ys) - minY + PADDING * 2
    const height = maxX - Math.min(...xs) + PADDING * 2
    return {
      viewBox: `0 0 ${width} ${height}`,
      // Quarter-turned from raw galactic coordinates: the core sits at the
      // origin, so putting it at the bottom of the frame lets the chart's
      // light come up off the core the way it does out of a window.
      project: (s: StarSystem) => ({ x: s.y - minY + PADDING, y: maxX - s.x + PADDING }),
    }
  }, [index])

  const failedJumps = new Set(jumps.filter((j) => !j.correct).map((j) => j.target))
  const anyTrusted = candidateSet.size < index.systems.length

  // The plotted course to whatever is selected, drawn on the chart so the
  // player sees what a trip costs before the rail says it in words.
  const route = useMemo(() => {
    if (!selected || selected === ship.at) return null
    return routeTo(index, ship.at, selected)
  }, [index, ship.at, selected])

  // Region names drawn at the centroid of each region's actual systems — the
  // chart names the places the engine knows, because the accounts name them
  // too and a region constraint has to be checkable against the sky.
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
    setZoom((value) => Math.min(3.4, Math.max(0.6, value + (event.deltaY < 0 ? 0.12 : -0.12))))
  }

  const resetView = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  const findSystem = (event: React.FormEvent) => {
    event.preventDefault()
    const match = index.systems.find((system) =>
      system.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
    )
    if (!match) return
    dispatch({ type: 'select', system: match.id })
    setHovered(match.id)
    setZoom((value) => Math.max(value, 1.5))
  }

  /**
   * Arrow keys step the selection from star to star in the direction pressed:
   * the nearest system ahead, penalised for how far off the bearing it sits.
   * Panning a chart to find the next candidate is not navigation, it is work.
   */
  const stepSelection = (dx: number, dy: number) => {
    const current = selected ? index.system(selected) : null
    if (!current) return
    const from = project(current)
    let best: SystemId | null = null
    let bestScore = Infinity
    for (const system of index.systems) {
      if (system.id === current.id) continue
      const p = project(system)
      const ahead = (p.x - from.x) * dx + (p.y - from.y) * dy
      if (ahead <= 0) continue
      const aside = Math.abs((p.x - from.x) * dy - (p.y - from.y) * dx)
      const score = ahead + aside * 2.2
      if (score < bestScore) {
        bestScore = score
        best = system.id
      }
    }
    if (!best) return
    dispatch({ type: 'select', system: best })
    setHovered(best)
  }

  useEffect(() => {
    const steps: Record<string, [number, number]> = {
      ArrowRight: [1, 0],
      ArrowLeft: [-1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return
      if (event.key === '+' || event.key === '=') setZoom((value) => Math.min(3.4, value + 0.2))
      if (event.key === '-') setZoom((value) => Math.max(0.6, value - 0.2))
      if (event.key === '0') resetView()
      const step = steps[event.key]
      if (step) {
        event.preventDefault()
        stepSelection(step[0], step[1])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // Re-armed whenever the selection moves: stepping is relative to it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, index])

  return (
    <div
      className="star-map absolute inset-0 overflow-hidden"
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
      <div className="core-glow" aria-hidden="true" />
      <div className="star-dust" aria-hidden="true" />
      <svg
        viewBox={viewBox}
        className="galaxy-canvas"
        style={{ transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})` }}
        role="img"
        aria-label="Scrollable and zoomable galactic navigation chart"
      >
        <defs>
          <filter id="star-glow" x="-300%" y="-300%" width="600%" height="600%">
            <feGaussianBlur stdDeviation="2.2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {regionLabels.map(({ region, x, y }) => (
          <text key={region} x={x} y={y} textAnchor="middle" className="sector-label">
            {REGION_NAMES[region].toUpperCase()}
          </text>
        ))}

        <g>
          {index.galaxy.lanes.map(([a, b]) => {
            const from = project(index.system(a))
            const to = project(index.system(b))
            const lit = hovered === a || hovered === b
            return (
              <line
                key={`${a}-${b}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                className={`jump-lane ${lit ? 'is-lit' : ''}`}
              />
            )
          })}
        </g>

        {route && route.path.length > 1 && (
          <polyline
            points={route.path
              .map((id) => {
                const p = project(index.system(id))
                return `${p.x},${p.y}`
              })
              .join(' ')}
            fill="none"
            stroke="var(--color-amber)"
            strokeWidth={1.5}
            strokeDasharray="6 4"
            className="plotted-route"
          />
        )}

        {index.systems.map((system) => {
          const { x, y } = project(system)
          const isCandidate = candidateSet.has(system.id)
          const isSelected = selected === system.id
          const isHovered = hovered === system.id
          const hasEvidence = sites.has(system.id)
          const wasSearched = searched.includes(system.id)
          const failed = failedJumps.has(system.id)

          // Eliminated stars stay on the chart — knowing what you have ruled
          // out is half of knowing anything.
          const colour = failed
            ? 'var(--color-alarm-dim)'
            : isCandidate
              ? 'var(--color-phosphor)'
              : 'var(--color-ink-faint)'

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
              <circle cx={x} cy={y} r={15} fill="transparent" />

              {/* The selection is a reticle, not a highlight: the chart is an
                  instrument and the ship is aimed with it. */}
              {isSelected && (
                <>
                  <circle cx={x} cy={y} r={14} fill="none" stroke="var(--color-amber)" strokeWidth={0.9} opacity={0.9} />
                  <path
                    d={`M ${x} ${y - 18} L ${x} ${y - 13} M ${x} ${y + 13} L ${x} ${y + 18} M ${x - 18} ${y} L ${x - 13} ${y} M ${x + 13} ${y} L ${x + 18} ${y}`}
                    stroke="var(--color-amber)"
                    strokeWidth={1.1}
                  />
                </>
              )}

              {hasEvidence && (
                <circle
                  className="site-ring"
                  cx={x}
                  cy={y}
                  r={11}
                  fill="none"
                  stroke="var(--color-amber)"
                  strokeWidth={0.9}
                  strokeDasharray="2.5 3"
                />
              )}

              <circle
                cx={x}
                cy={y}
                r={isCandidate ? 7.5 : 5}
                fill="none"
                stroke={colour}
                strokeWidth={isCandidate ? 1.1 : 0.8}
                opacity={isCandidate ? 0.95 : isHovered || isSelected ? 0.8 : 0.4}
              />

              {recruitSites[system.id] && (
                <rect
                  x={x - 3}
                  y={y - 3}
                  width={6}
                  height={6}
                  fill="none"
                  stroke="var(--color-phosphor)"
                  strokeWidth={1}
                  transform={`rotate(45 ${x} ${y})`}
                />
              )}

              {failed && (
                <path
                  d={`M ${x - 4} ${y - 4} L ${x + 4} ${y + 4} M ${x + 4} ${y - 4} L ${x - 4} ${y + 4}`}
                  stroke="var(--color-alarm-dim)"
                  strokeWidth={1.1}
                />
              )}

              {wasSearched && !hasEvidence && (
                <circle cx={x} cy={y} r={9.5} fill="none" stroke="var(--color-ink-faint)" strokeWidth={0.5} opacity={0.55} />
              )}

              <circle
                cx={x}
                cy={y}
                r={isCandidate ? 3.4 : isHovered || isSelected ? 2.8 : 2}
                fill={colour}
                filter={isCandidate || isSelected || isHovered ? 'url(#star-glow)' : undefined}
              />

              {ship.at === system.id && (
                <path
                  d={`M ${x} ${y - 13} L ${x + 9} ${y} L ${x} ${y + 13} L ${x - 9} ${y} Z`}
                  fill="none"
                  stroke="var(--color-amber)"
                  strokeWidth={1.4}
                />
              )}

              {/* Label only what matters: candidates when the field is small,
                  the landmarks the accounts name, plus whatever the player is
                  pointing at. Labelling ninety stars at once makes the chart
                  unreadable. */}
              {(isHovered ||
                isSelected ||
                system.landmark ||
                (isCandidate && anyTrusted && candidateSet.size <= 12)) && (
                <text
                  x={x + 11}
                  y={y + 3.5}
                  fontSize={9}
                  fill={
                    isSelected
                      ? 'var(--color-amber)'
                      : isCandidate
                        ? '#bdeeea'
                        : 'var(--color-ink-dim)'
                  }
                  className="star-label pointer-events-none select-none"
                >
                  {system.name}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      <div className="map-ui map-heading pointer-events-none absolute top-6 left-7 flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="map-title">
          <h2>Galactic Chart</h2>
        </div>
        <div className="map-tally">
          <div>
            {anyTrusted ? (
              <>
                <span className="text-phosphor text-[15px]">{candidateSet.size}</span> of{' '}
                {index.systems.length} consistent
              </>
            ) : (
              <>{index.systems.length} stars catalogued — nothing ruled out yet</>
            )}
          </div>
          <div>
            {clues.length} {clues.length === 1 ? 'account' : 'accounts'} · {trusted.length} trusted ·{' '}
            {sites.size} {sites.size === 1 ? 'site' : 'sites'} unsearched
          </div>
        </div>
      </div>

      <div className="map-ui absolute top-6 right-7 flex items-center gap-2.5">
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
        <div className="map-controls">
          <button onClick={() => setZoom((value) => Math.min(3.4, value + 0.2))} aria-label="Zoom in">+</button>
          <span>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((value) => Math.max(0.6, value - 0.2))} aria-label="Zoom out">−</button>
          <button onClick={resetView} aria-label="Reset map view">⌖</button>
          {onOpenGuide && (
            <button onClick={onOpenGuide} aria-label="How to read the chart" title="How to read the chart">?</button>
          )}
        </div>
      </div>

      {hovered && hovered !== selected && <Readout id={hovered} />}

      <Legend bottom={evidenceOpen ? LEGEND_ABOVE_DRAWER : LEGEND_ABOVE_RAIL} />
    </div>
  )
}

/**
 * The hover card. It answers the two questions a pointed-at star raises —
 * is it still possible, and what does getting there cost — without the
 * player having to select it and lose the star they were comparing against.
 */
function Readout({ id }: { id: SystemId }) {
  const index = useGalaxyIndex()
  const state = useGame((s) => s.state)
  const ship = useGame((s) => s.state.ship)
  const searched = useGame((s) => s.state.searched)
  const jumps = useGame((s) => s.state.jumps)
  const recruitSites = useGame((s) => s.state.recruits.sites)
  const { candidateSet, sites } = useNavPlot()
  const system = index.system(id)
  const here = ship.at === id
  const route = here ? null : routeTo(index, ship.at, id)
  const hasEvidence = sites.has(id)

  const standing = jumps.some((j) => j.target === id && !j.correct)
    ? 'jump attempted'
    : candidateSet.has(id)
      ? 'consistent'
      : 'ruled out'

  return (
    <div className="map-ui map-readout pointer-events-none absolute right-7">
      <div className="readout-name">{system.name}</div>
      <div className="readout-region">{REGION_NAMES[system.region]}</div>
      <div className="readout-line">
        <span>{standing}</span>
        <span>
          {here
            ? 'ship is here'
            : route
              ? `${route.path.length - 1} ${route.path.length - 1 === 1 ? 'jump' : 'jumps'} · ${travelCost(state, route.cost)} fuel`
              : 'no lane route'}
        </span>
      </div>
      <div className={`readout-site ${hasEvidence ? 'is-live' : ''}`}>
        {hasEvidence
          ? 'Evidence, unsearched'
          : recruitSites[id]
            ? 'Specialist for hire'
            : searched.includes(id)
              ? 'Searched — nothing further'
              : 'No contact reported'}
      </div>
    </div>
  )
}

function Legend({ bottom }: { bottom: number }) {
  return (
    <div className="map-ui map-legend pointer-events-none absolute right-7" style={{ bottom }}>
      <span>
        <svg width={12} height={12} aria-hidden="true">
          <circle cx={6} cy={6} r={4.6} fill="none" stroke="var(--color-phosphor)" strokeWidth={1} />
          <circle cx={6} cy={6} r={1.8} fill="var(--color-phosphor)" />
        </svg>
        consistent
      </span>
      <span>
        <svg width={12} height={12} aria-hidden="true">
          <circle cx={6} cy={6} r={3.4} fill="none" stroke="var(--color-ink-faint)" strokeWidth={0.9} />
          <circle cx={6} cy={6} r={1.3} fill="var(--color-ink-faint)" />
        </svg>
        ruled out
      </span>
      <span>
        <svg width={14} height={14} aria-hidden="true">
          <circle cx={7} cy={7} r={5.6} fill="none" stroke="var(--color-amber)" strokeWidth={0.9} strokeDasharray="2.5 3" />
        </svg>
        evidence
      </span>
      <span>
        <svg width={14} height={14} aria-hidden="true">
          <circle cx={7} cy={7} r={5.6} fill="none" stroke="var(--color-ink-faint)" strokeWidth={0.5} />
        </svg>
        searched
      </span>
      <span>
        <svg width={14} height={14} aria-hidden="true">
          <rect x={4} y={4} width={6} height={6} fill="none" stroke="var(--color-phosphor)" strokeWidth={1} transform="rotate(45 7 7)" />
        </svg>
        specialist
      </span>
      <span>
        <svg width={14} height={14} aria-hidden="true">
          <path d="M 7 1.5 L 12.5 7 L 7 12.5 L 1.5 7 Z" fill="none" stroke="var(--color-amber)" strokeWidth={1.1} />
        </svg>
        the Ithaca
      </span>
    </div>
  )
}
