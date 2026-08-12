import { useMemo, useState } from 'react'
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
  const { candidateSet, sites, clues } = useNavPlot()
  const [hovered, setHovered] = useState<SystemId | null>(null)

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

  return (
    <div className="relative h-full w-full overflow-hidden">
      <svg viewBox={viewBox} className="h-full w-full" role="img" aria-label="Star chart">
        <g stroke="var(--color-rule)" strokeWidth={0.8}>
          {index.galaxy.lanes.map(([a, b]) => {
            const from = project(index.system(a))
            const to = project(index.system(b))
            return <line key={`${a}-${b}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
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
            stroke="var(--color-amber-dim)"
            strokeWidth={1.4}
            strokeDasharray="4 3"
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
              onMouseEnter={() => setHovered(system.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => dispatch({ type: 'select', system: system.id })}
              className="cursor-pointer"
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
              />

              {wasSearched && !hasEvidence && (
                <circle cx={x} cy={y} r={5.5} fill="none" stroke="var(--color-ink-faint)" strokeWidth={0.5} />
              )}

              {/* Label only what matters: candidates when the field is small,
                  plus whatever the player is pointing at. Labelling ninety
                  stars at once makes the chart unreadable. */}
              {(isHovered ||
                isSelected ||
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

      <div className="pointer-events-none absolute top-3 left-3 flex flex-col gap-1">
        <div className="label">Astrographic chart</div>
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

      <Legend evidenceCount={sites.size} held={clues.length} />

      {hovered && hovered !== selected && <Readout system={index.system(hovered)} />}
    </div>
  )
}

function Legend({ evidenceCount, held }: { evidenceCount: number; held: number }) {
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 flex flex-col gap-1 text-[10px]">
      <div className="flex items-center gap-2">
        <svg width={14} height={14}>
          <path d="M 7 1.5 L 12 7 L 7 12.5 L 2 7 Z" fill="none" stroke="var(--color-amber)" strokeWidth={1.2} />
        </svg>
        <span className="text-ink-faint">the Indefatigable</span>
      </div>
      <LegendRow colour="var(--color-phosphor)" label="consistent with your plot" />
      <LegendRow colour="var(--color-ink-faint)" label="ruled out" />
      <LegendRow colour="var(--color-amber)" label={`unsearched evidence (${evidenceCount})`} ring />
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
