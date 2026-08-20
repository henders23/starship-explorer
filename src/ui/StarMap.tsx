import { useEffect, useMemo, useRef, useState } from 'react'
import { travelCost } from '../engine/state/reducer.js'
import { costsFrom, routeTo } from '../engine/travel/travel.js'
import type { StarSystem, SystemId } from '../engine/worldgen/types.js'
import { REGION_NAMES } from '../engine/worldgen/types.js'
import { useDispatch, useGalaxyIndex, useGame, useNavPlot } from './store.js'

/**
 * The chart's own coordinate frame. Deliberately landscape: the voyage reads
 * left to right, out of the core and toward the Rift Margin, so the axis the
 * player is actually travelling along gets the long side of the screen.
 */
const FRAME_WIDTH = 1440
const FRAME_HEIGHT = 820
/**
 * Margins inside that frame. The right one is wide on purpose: the inspector
 * docks there, and on a chart that runs left to right the far end is the end
 * the player is aiming at — it must not spend the whole game under a panel.
 */
const MARGIN = { left: 78, right: 372, top: 76, bottom: 84 }

/** How far the legend floats above the deck floor, with and without the drawer. */
const LEGEND_ABOVE_RAIL = 96
const LEGEND_ABOVE_DRAWER = 306

/** Point set for a flat-topped-on-its-side hexagon — the system glyph. */
function hexPoints(x: number, y: number, r: number): string {
  const points: string[] = []
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 90)
    points.push(`${(x + r * Math.cos(a)).toFixed(1)},${(y + r * Math.sin(a)).toFixed(1)}`)
  }
  return points.join(' ')
}

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
 * The chart owns the whole deck: the HUD floats over it, the inspector docks
 * to its right and the plot bar along its foot, so nothing but the sky sits
 * between the player and the stars they are ruling out.
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
  const gameState = useGame((s) => s.state)
  const recruitSites = useGame((s) => s.state.recruits.sites)
  const { candidateSet, sites, clues, trusted } = useNavPlot()
  const [hovered, setHovered] = useState<SystemId | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [query, setQuery] = useState('')
  const drag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)
  const dragged = useRef(false)

  /**
   * Galactic coordinates onto the chart frame, at true scale.
   *
   * `x` in the engine is distance out from the galactic core, and that is the
   * axis the voyage runs along — the Shallows where the ship arrived sit at
   * the near edge, the Rift Margin at the far one. So it becomes the screen's
   * horizontal, and the ship starts near the left with the frontier ahead of
   * it. `y`, the sideways spread across the sector's arc, runs down the frame.
   *
   * The sector is generated as a long, shallow wedge (worldgen holds it at
   * roughly three parts across to two deep) precisely so that this can be one
   * scale factor on both axes. A light year is the same length whichever way
   * it is drawn: a lane that looks twice as long as another is twice as long,
   * and the chart can be read as a map rather than as a diagram.
   */
  const project = useMemo(() => {
    const xs = index.systems.map((s) => s.x)
    const ys = index.systems.map((s) => s.y)
    const minX = Math.min(...xs)
    const minY = Math.min(...ys)
    const spanX = Math.max(...xs) - minX || 1
    const spanY = Math.max(...ys) - minY || 1
    const innerW = FRAME_WIDTH - MARGIN.left - MARGIN.right
    const innerH = FRAME_HEIGHT - MARGIN.top - MARGIN.bottom
    const scale = Math.min(innerW / spanX, innerH / spanY)
    // Centred in whichever direction the wedge does not fill.
    const offsetX = MARGIN.left + (innerW - spanX * scale) / 2
    const offsetY = MARGIN.top + (innerH - spanY * scale) / 2
    return (s: StarSystem) => ({
      x: offsetX + (s.x - minX) * scale,
      y: offsetY + (s.y - minY) * scale,
    })
  }, [index])

  const failedJumps = new Set(jumps.filter((j) => !j.correct).map((j) => j.target))
  // Before anything is ruled out every star is "still possible", which is no
  // information at all — so the chart stays catalogue-grey until the plot has
  // actually narrowed, and amber then means something the moment it appears.
  const anyTrusted = candidateSet.size < index.systems.length

  // Two ranges, drawn differently because they answer different questions.
  // The ring is the next hop — the stars one lane out, where the ship can go
  // without threading a route. Affordability is the other: fuel is the master
  // clock, so anything the tank can no longer reach fades off the chart
  // instead of quietly failing when the player finally clicks it.
  const nextHop = useMemo(() => new Set(index.neighbours(ship.at)), [index, ship.at])
  const affordable = useMemo(() => {
    const set = new Set<SystemId>()
    for (const [id, cost] of costsFrom(index, ship.at)) {
      if (travelCost(gameState, cost) <= ship.fuel) set.add(id)
    }
    return set
  }, [index, ship.at, ship.fuel, gameState])

  // The plotted course to whatever is selected, drawn on the chart so the
  // player sees what a trip costs before the inspector says it in words.
  const route = useMemo(() => {
    if (!selected || selected === ship.at) return null
    return routeTo(index, ship.at, selected)
  }, [index, ship.at, selected])

  const routeSet = useMemo(() => new Set(route?.path ?? []), [route])

  // Region names drawn at the centroid of each region's actual systems — the
  // chart names the places the engine knows, because the accounts name them
  // too and a region constraint has to be checkable against the sky.
  const regionLabels = useMemo(() => {
    const groups = new Map<string, { x: number; y: number; n: number }>()
    for (const system of index.systems) {
      const p = project(system)
      const g = groups.get(system.region) ?? { x: 0, y: 0, n: 0 }
      groups.set(system.region, { x: g.x + p.x, y: g.y + p.y, n: g.n + 1 })
    }
    // Watermarked at the centroid and drawn first, so the names sit behind
    // the lanes and glyphs. Clamped into the drawable area: the outer regions
    // would otherwise be titled underneath the inspector.
    return [...groups.entries()].map(([region, g]) => ({
      region: region as keyof typeof REGION_NAMES,
      x: Math.min(FRAME_WIDTH - MARGIN.right - 90, Math.max(MARGIN.left + 90, g.x / g.n)),
      y: Math.min(FRAME_HEIGHT - MARGIN.bottom, Math.max(MARGIN.top, g.y / g.n)),
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

  const shipPoint = project(index.system(ship.at))

  return (
    <div
      className="star-map absolute inset-0 overflow-hidden"
      onWheel={onWheel}
      onPointerDown={(event) => {
        if ((event.target as Element).closest('.map-ui')) return
        drag.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y }
        dragged.current = false
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => {
        if (!drag.current) return
        const dx = event.clientX - drag.current.x
        const dy = event.clientY - drag.current.y
        if (Math.abs(dx) + Math.abs(dy) > 4) dragged.current = true
        setPan({ x: drag.current.panX + dx, y: drag.current.panY + dy })
      }}
      onPointerUp={() => {
        drag.current = null
        // Let the click that ends a drag fall on the floor: dragging the sky
        // across a star should not select the star it passed under.
        setTimeout(() => {
          dragged.current = false
        }, 0)
      }}
    >
      <div className="core-glow" aria-hidden="true" />
      <div className="star-dust" aria-hidden="true" />
      <div className="chart-scanlines" aria-hidden="true" />
      <svg
        viewBox={`0 0 ${FRAME_WIDTH} ${FRAME_HEIGHT}`}
        className="galaxy-canvas"
        style={{ transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})` }}
        role="img"
        aria-label="Scrollable and zoomable galactic navigation chart"
      >
        <defs>
          <filter id="star-glow" x="-300%" y="-300%" width="600%" height="600%">
            <feGaussianBlur stdDeviation="2.4" result="blur" />
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
            const lit = hovered === a || hovered === b || ship.at === a || ship.at === b
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
            stroke="var(--color-course)"
            strokeWidth={1.6}
            strokeDasharray="6 4"
            className="plotted-route"
          />
        )}

        {index.systems.map((system) => {
          const { x, y } = project(system)
          const isCandidate = anyTrusted && candidateSet.has(system.id)
          const isSelected = selected === system.id
          const isHovered = hovered === system.id
          const isShip = ship.at === system.id
          const hasEvidence = sites.has(system.id)
          const wasSearched = searched.includes(system.id)
          const failed = failedJumps.has(system.id)
          const onRoute = routeSet.has(system.id)

          // Eliminated stars stay on the chart — knowing what you have ruled
          // out is half of knowing anything.
          const colour = isShip
            ? 'var(--color-course)'
            : failed
              ? 'var(--color-alarm)'
              : isCandidate
                ? 'var(--color-amber)'
                : 'var(--color-chart-dim)'
          const r = isShip || isCandidate ? 11.5 : 8.5
          const lit = isShip || isCandidate || isSelected || isHovered
          const beyondTank = !affordable.has(system.id)

          return (
            <g
              key={system.id}
              data-system={system.id}
              onMouseEnter={() => setHovered(system.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => {
                if (dragged.current) return
                dispatch({ type: 'select', system: system.id })
              }}
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
              {/* Generous invisible hit area — the glyphs are small. */}
              <circle cx={x} cy={y} r={20} fill="transparent" />

              {/* A candidate breathes. With ninety stars catalogued, the ones
                  still standing have to be findable from across the room. */}
              {isCandidate && !isShip && (
                <circle cx={x} cy={y} r={21} fill="var(--color-amber)" className="star-halo" />
              )}

              {/* One lane out: where the ship can go next. */}
              {nextHop.has(system.id) && (
                <circle
                  cx={x}
                  cy={y}
                  r={r + 7}
                  fill="none"
                  stroke="var(--color-reach)"
                  strokeWidth={0.8}
                  strokeDasharray="3 4"
                  opacity={0.7}
                />
              )}

              {hasEvidence && (
                <circle
                  className="site-ring"
                  cx={x}
                  cy={y}
                  r={r + 4}
                  fill="none"
                  stroke="var(--color-phosphor)"
                  strokeWidth={1}
                  strokeDasharray="2.5 3"
                />
              )}

              <polygon
                points={hexPoints(x, y, r)}
                fill="rgb(4 10 16 / .92)"
                stroke={colour}
                strokeWidth={isSelected ? 1.8 : 1.4}
                opacity={beyondTank ? 0.28 : lit ? 1 : 0.55}
                filter={lit ? 'url(#star-glow)' : undefined}
              />
              <circle cx={x} cy={y} r={isCandidate || isShip ? 3.6 : 2.4} fill={colour} opacity={beyondTank ? 0.3 : lit ? 1 : 0.7} />

              {recruitSites[system.id] && (
                <rect
                  x={x - 3}
                  y={y - r - 9}
                  width={6}
                  height={6}
                  fill="none"
                  stroke="var(--color-phosphor)"
                  strokeWidth={1}
                  transform={`rotate(45 ${x} ${y - r - 6})`}
                />
              )}

              {failed && (
                <path
                  d={`M ${x - 5} ${y - 5} L ${x + 5} ${y + 5} M ${x + 5} ${y - 5} L ${x - 5} ${y + 5}`}
                  stroke="var(--color-alarm)"
                  strokeWidth={1.2}
                />
              )}

              {wasSearched && !hasEvidence && (
                <circle cx={x} cy={y} r={r + 4} fill="none" stroke="var(--color-chart-dim)" strokeWidth={0.5} opacity={0.5} />
              )}

              {/* The selection is a reticle, not a highlight: the chart is an
                  instrument and the ship is aimed with it. */}
              {isSelected && (
                <>
                  <circle cx={x} cy={y} r={20} fill="none" stroke="var(--color-reticle)" strokeWidth={0.9} opacity={0.9} />
                  <path
                    d={`M ${x} ${y - 25} L ${x} ${y - 19} M ${x} ${y + 19} L ${x} ${y + 25} M ${x - 25} ${y} L ${x - 19} ${y} M ${x + 19} ${y} L ${x + 25} ${y}`}
                    stroke="var(--color-reticle)"
                    strokeWidth={1.1}
                  />
                </>
              )}

              {/* Label only what matters: candidates when the field is small,
                  the landmarks the accounts name, the contacts still waiting,
                  plus whatever the player is pointing at. Labelling ninety
                  stars at once makes the chart unreadable. */}
              {(isHovered ||
                isSelected ||
                onRoute ||
                hasEvidence ||
                system.landmark ||
                (isCandidate && anyTrusted && candidateSet.size <= 12)) && (
                <text
                  x={x}
                  y={y + r + 15}
                  textAnchor="middle"
                  className={`star-label ${
                    isSelected
                      ? 'is-selected'
                      : isCandidate
                        ? 'is-candidate'
                        : isHovered || isShip || hasEvidence || onRoute
                          ? ''
                          : 'is-quiet'
                  }`}
                >
                  {system.name}
                </text>
              )}
            </g>
          )
        })}

        {/* The Ithaca, drawn last so nothing crowds it. */}
        <g transform={`translate(${shipPoint.x}, ${shipPoint.y})`} className="pointer-events-none">
          <circle r={19} fill="none" stroke="var(--color-course)" strokeWidth={1.2} className="ship-ping" />
          <circle r={19} fill="none" stroke="var(--color-course)" strokeWidth={1.2} className="ship-ping is-late" />
          <path
            d="M 0 -30 L 5 -19 L 0 -23 L -5 -19 Z"
            fill="var(--color-reticle)"
            stroke="var(--color-course)"
            strokeWidth={1}
            filter="url(#star-glow)"
          />
          <text x={0} y={-37} textAnchor="middle" className="ship-label">ITHACA</text>
        </g>
      </svg>

      <div className="map-ui map-heading pointer-events-none absolute top-6 left-7">
        <h2>Galactic Chart</h2>
        <div className="map-tally">
          {anyTrusted ? (
            <>
              <span className="text-phosphor">{candidateSet.size}</span> of {index.systems.length}{' '}
              stars still possible
            </>
          ) : (
            <>{index.systems.length} stars catalogued · nothing ruled out yet</>
          )}
          {' · '}
          {clues.length} {clues.length === 1 ? 'account' : 'accounts'}, {trusted.length} trusted
          {' · '}
          {sites.size} {sites.size === 1 ? 'site' : 'sites'} unsearched
        </div>
        <div className="map-hint">
          the core lies to the left, the Rift Margin ahead · scroll to zoom · drag to pan
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

      <Legend bottom={evidenceOpen ? LEGEND_ABOVE_DRAWER : LEGEND_ABOVE_RAIL} />
    </div>
  )
}

function Legend({ bottom }: { bottom: number }) {
  return (
    <div className="map-ui map-legend pointer-events-none absolute left-7" style={{ bottom }}>
      <span>
        <svg width={14} height={14} aria-hidden="true">
          <polygon points={hexPoints(7, 7, 5.6)} fill="none" stroke="var(--color-amber)" strokeWidth={1.2} />
        </svg>
        still possible
      </span>
      <span>
        <svg width={14} height={14} aria-hidden="true">
          <polygon points={hexPoints(7, 7, 4.4)} fill="none" stroke="var(--color-chart-dim)" strokeWidth={1} />
        </svg>
        ruled out
      </span>
      <span>
        <svg width={14} height={14} aria-hidden="true">
          <polygon points={hexPoints(7, 7, 5.6)} fill="none" stroke="var(--color-course)" strokeWidth={1.2} />
        </svg>
        the Ithaca
      </span>
      <span>
        <svg width={16} height={16} aria-hidden="true">
          <circle cx={8} cy={8} r={6.4} fill="none" stroke="var(--color-phosphor)" strokeWidth={1} strokeDasharray="2.5 3" />
        </svg>
        evidence
      </span>
      <span>
        <svg width={16} height={16} aria-hidden="true">
          <circle cx={8} cy={8} r={6.4} fill="none" stroke="var(--color-reach)" strokeWidth={0.9} strokeDasharray="3 4" />
        </svg>
        one lane out
      </span>
      <span>
        <svg width={14} height={14} aria-hidden="true">
          <rect x={4} y={4} width={6} height={6} fill="none" stroke="var(--color-phosphor)" strokeWidth={1} transform="rotate(45 7 7)" />
        </svg>
        specialist
      </span>
      <span>
        <svg width={14} height={14} aria-hidden="true">
          <path d="M 3 3 L 11 11 M 11 3 L 3 11" stroke="var(--color-alarm)" strokeWidth={1.2} />
        </svg>
        jump attempted
      </span>
    </div>
  )
}
