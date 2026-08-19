import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { PARTS_NEEDED } from '../engine/research/parts.js'
import { jumpReady, TECH_BY_ID } from '../engine/research/tech.js'
import { sitePlan, travelCost } from '../engine/state/reducer.js'
import { canScoop, FUEL_MAX, LONG_JUMP_RESERVE, routeTo } from '../engine/travel/travel.js'
import { FEATURE_NAMES, REGION_NAMES, STAR_NAMES } from '../engine/worldgen/types.js'
import { JumpCeremony } from './JumpCeremony.js'
import { SystemView } from './SystemView.js'
import { useDispatch, useGalaxyIndex, useGame, useNavPlot } from './store.js'

/**
 * The command rail: one bar along the foot of the chart carrying everything
 * the player does with a star. Three cells, left to right — what this star
 * *is*, what is still standing, and what the ship can do about it — so the
 * chart above stays sky, not chrome.
 */
export function CommandRail({
  evidenceOpen,
  onToggleEvidence,
}: {
  evidenceOpen: boolean
  onToggleEvidence: () => void
}) {
  const index = useGalaxyIndex()
  const dispatch = useDispatch()
  const selectedId = useGame((s) => s.state.selected)
  const searched = useGame((s) => s.state.searched)
  const outcome = useGame((s) => s.state.outcome)
  const jumps = useGame((s) => s.state.jumps)
  const start = useGame((s) => s.state.galaxy.start)
  const gameState = useGame((s) => s.state)
  const { candidateSet, sites, trusted, clues } = useNavPlot()
  const [confirming, setConfirming] = useState(false)
  const [ceremony, setCeremony] = useState(false)

  const ship = gameState.ship
  const system = selectedId ? index.system(selectedId) : null
  const here = system !== null && ship.at === system.id
  const route = useMemo(
    () => (!system || here ? null : routeTo(index, ship.at, system.id)),
    [here, index, ship.at, system],
  )

  if (!system) {
    return (
      <div className="command-rail">
        <div className="rail-cell rail-empty text-ink-faint">Select a star on the chart.</div>
      </div>
    )
  }

  const isCandidate = candidateSet.has(system.id)
  const hasEvidence = sites.has(system.id)
  const hasRecruit = gameState.recruits.sites[system.id] !== undefined
  const alreadyTried = jumps.some((j) => j.target === system.id)
  const { site } = sitePlan(gameState, system.id)
  const fuel = route ? travelCost(gameState, route.cost) : 0
  const affordable = fuel <= ship.fuel
  const features =
    system.features.length === 0
      ? 'nothing of note'
      : system.features.map((f) => FEATURE_NAMES[f]).join(', ')

  return (
    <div className="command-rail">
      <div className="rail-cell rail-system">
        <SystemView system={system} hasEvidence={hasEvidence} here={here} />
        <div className="min-w-0">
          <div className="flex items-baseline gap-3">
            <h2>{system.name}</h2>
            <span className="rail-region">{REGION_NAMES[system.region]}</span>
          </div>
          <p className="rail-blurb">
            Catalogued as {STAR_NAMES[system.star]}. The survey holds {features}.
          </p>
          <div className="rail-meta">
            {index.degree(system.id)} {index.degree(system.id) === 1 ? 'lane' : 'lanes'} ·{' '}
            {system.faction ? index.factionName(system.faction) : 'claimed by nobody'}
            {system.id === start ? ' · the arrival point' : ''}
          </div>
          <div className="rail-states">
            <span className={alreadyTried ? 'text-alarm' : isCandidate ? 'text-phosphor' : 'text-ink-dim'}>
              {trusted.length === 0
                ? 'No plot filed — every star is still possible'
                : alreadyTried
                  ? 'Jump attempted'
                  : isCandidate
                    ? 'Consistent with your plot'
                    : 'Ruled out by your plot'}
            </span>
            <span className={hasEvidence ? 'text-amber' : 'text-ink-faint'}>
              {hasEvidence
                ? here
                  ? 'Evidence here — respond to the contact'
                  : 'Evidence, unsearched'
                : hasRecruit
                  ? 'Specialist for hire'
                  : searched.includes(system.id)
                    ? 'Searched — nothing further'
                    : 'No contact reported'}
            </span>
          </div>
        </div>
      </div>

      <CandidateCell />

      <div className="rail-cell rail-actions">
        {here ? (
          <div className="rail-stat">
            <span>Position</span>
            <span className="text-amber">the ship is here</span>
          </div>
        ) : (
          <>
            <div className="rail-stat">
              <span>Distance</span>
              <span className="text-ink">
                {route
                  ? `${route.path.length - 1} ${route.path.length - 1 === 1 ? 'jump' : 'jumps'}`
                  : 'unreachable'}
              </span>
            </div>
            <div className="rail-stat">
              <span>Fuel cost</span>
              <span className={!route ? 'text-ink-faint' : !affordable ? 'text-alarm' : fuel > 24 ? 'text-amber' : 'text-ink'}>
                {route ? `${fuel} of ${ship.fuel}` : '—'}
              </span>
            </div>
          </>
        )}

        {!here && outcome === 'seeking' && (
          <button
            disabled={!route || !affordable}
            onClick={() => dispatch({ type: 'travel', to: system.id })}
            className={`rail-action ${route && affordable ? 'is-go' : route ? 'is-bad' : 'is-off'}`}
          >
            {route
              ? `Travel — ${route.path.length - 1} ${route.path.length - 1 === 1 ? 'jump' : 'jumps'}, ${fuel} fuel` +
                (gameState.driveScarred ? ' (scarred drive)' : '') +
                (affordable ? '' : ' — not enough')
              : 'No lane route reaches this system'}
          </button>
        )}

        {here && (hasEvidence || hasRecruit) && outcome === 'seeking' && (
          <button onClick={() => dispatch({ type: 'openScene' })} className="rail-action is-go">
            {hasEvidence
              ? site !== null
                ? `Respond — ${site.label.toLowerCase()}`
                : 'Respond to the contact'
              : 'Someone dockside is asking for the captain'}
          </button>
        )}

        {here && canScoop(index, system.id) && ship.fuel < FUEL_MAX && outcome === 'seeking' && (
          <button onClick={() => dispatch({ type: 'scoop' })} className="rail-action is-cyan">
            Scoop the gas giant — refill the tank (2 days)
          </button>
        )}

        {here &&
          (gameState.driveScarred || ship.hull < 100) &&
          system.faction !== null &&
          outcome === 'seeking' && (
            <button onClick={() => dispatch({ type: 'refit' })} className="rail-action is-go">
              {gameState.driveScarred && ship.hull < 100
                ? 'Refit the drive and the hull (4 days)'
                : gameState.driveScarred
                  ? 'Refit the scarred drive (4 days)'
                  : 'Repair the hull (4 days)'}
            </button>
          )}

        {outcome === 'seeking' && (
          <LongJump
            name={system.name}
            isCandidate={isCandidate}
            alreadyTried={alreadyTried}
            fuel={ship.fuel}
            ready={jumpReady(gameState)}
            confirming={confirming}
            setConfirming={setConfirming}
            onCommit={() => {
              setConfirming(false)
              setCeremony(true)
            }}
          />
        )}

        <button
          onClick={onToggleEvidence}
          className={`rail-action rail-evidence ${evidenceOpen ? 'is-open' : ''}`}
          aria-expanded={evidenceOpen}
        >
          {evidenceOpen
            ? 'Hide evidence'
            : `Evidence · ${clues.length} ${clues.length === 1 ? 'account' : 'accounts'}`}
        </button>
      </div>

      {/* The ceremony takes the whole screen, so it is portalled out of the
          rail: the rail's own backdrop filter would otherwise become its
          containing block and trap it in a 170px strip. */}
      {ceremony &&
        createPortal(
          <JumpCeremony target={system.id} name={system.name} onClose={() => setCeremony(false)} />,
          document.body,
        )}
    </div>
  )
}

/**
 * The candidate list is the score. It replaces the progress bar the design
 * forbids: it goes down as evidence accumulates and back up when the player
 * withdraws trust, which is exactly the feedback a deduction needs. On the
 * rail it doubles as a shortlist — every chip selects its star on the chart.
 */
function CandidateCell() {
  const index = useGalaxyIndex()
  const dispatch = useDispatch()
  const selected = useGame((s) => s.state.selected)
  const { candidates, trusted, impossible } = useNavPlot()

  return (
    <div className="rail-cell rail-candidates">
      <div className="rail-cell-head">
        <span>Candidates still standing</span>
        <span className={impossible ? 'text-alarm' : 'text-phosphor'}>
          {impossible ? 'none' : candidates.length}
        </span>
      </div>
      {impossible ? (
        <div className="text-alarm mt-3 text-[11px]">
          No star fits. Something you trust is false — doubt an account on the evidence drawer.
        </div>
      ) : trusted.length === 0 ? (
        <div className="text-ink-faint mt-3 text-[11px]">
          Trust an account on the evidence drawer to begin narrowing the field.
        </div>
      ) : (
        <div className="candidate-chips">
          {candidates.map((id) => (
            <button
              key={id}
              onClick={() => dispatch({ type: 'select', system: id })}
              className={`candidate-chip ${selected === id ? 'is-on' : ''}`}
            >
              {index.system(id).name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * The technological gate, on one line: the rail has room for a status, not a
 * lecture. The full itemisation lives on the research bench, and in the title.
 */
function TrackStatus() {
  const state = useGame((s) => s.state)

  const stage = (id: 'rift-drive' | 'rift-shield') => {
    const node = TECH_BY_ID[id]!
    const kind = node.component!
    if (state.tech.researched.includes(id)) return 'built'
    if (state.tech.active?.id === id) return `${state.tech.active.daysLeft}d`
    if (state.parts[kind] >= PARTS_NEEDED[kind]) return 'ready'
    return `${state.parts[kind]}/${PARTS_NEEDED[kind]}`
  }

  return (
    <div
      className="rail-note is-gate"
      title="The way home takes three things: the rift drive, the rift shielding, and a heading you trust."
    >
      Way home — drive <b>{stage('rift-drive')}</b> · shield <b>{stage('rift-shield')}</b> ·
      heading <b>the plot</b>
    </div>
  )
}

/**
 * The commit. Two-step by design: the whole game funnels into this button and
 * a misclick should never spend the reserve. The confirmation takes the whole
 * deck now — the chart should go quiet when the ship is about to bet itself.
 */
function LongJump({
  name,
  isCandidate,
  alreadyTried,
  fuel,
  ready,
  confirming,
  setConfirming,
  onCommit,
}: {
  name: string
  isCandidate: boolean
  alreadyTried: boolean
  fuel: number
  ready: boolean
  confirming: boolean
  setConfirming: (v: boolean) => void
  onCommit: () => void
}) {
  if (alreadyTried) {
    return <div className="rail-note is-alarm">Already attempted. The anomaly was not here.</div>
  }

  if (!ready) return <TrackStatus />

  if (fuel < LONG_JUMP_RESERVE) {
    return (
      <div className="rail-note">
        The Long Jump takes a reserve of {LONG_JUMP_RESERVE} fuel. The tank holds {fuel}.
      </div>
    )
  }

  return (
    <>
      <button onClick={() => setConfirming(true)} className="rail-action is-quiet">
        Plot the Long Jump to {name} — {LONG_JUMP_RESERVE} fuel
      </button>

      {/* Portalled to the body: the rail's backdrop filter would otherwise
          become the containing block and trap the veil in a 170px strip. */}
      {confirming &&
        createPortal(
          <div className="commit-veil">
            <div className="commit-card">
              <div className="commit-kicker">Commit the Long Jump</div>
              <h3>{name}</h3>
              <p>
                Committing burns the {LONG_JUMP_RESERVE}-fuel reserve. If you are wrong, the rift
                throws the ship somewhere far from here with almost nothing in the tank.
                {!isCandidate && (
                  <span className="text-alarm"> Your own plot rules this star out.</span>
                )}
              </p>
              <div className="flex gap-2.5">
                <button onClick={onCommit} className="commit-go">Commit</button>
                <button onClick={() => setConfirming(false)} className="commit-hold">Hold</button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
