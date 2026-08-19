import { useMemo, useState } from 'react'
import { PARTS_NEEDED } from '../engine/research/parts.js'
import { jumpReady, TECH_BY_ID } from '../engine/research/tech.js'
import { sitePlan, travelCost } from '../engine/state/reducer.js'
import { canScoop, FUEL_MAX, LONG_JUMP_RESERVE, nearestScoopCost, routeTo } from '../engine/travel/travel.js'
import { FEATURE_NAMES, REGION_NAMES, STAR_NAMES } from '../engine/worldgen/types.js'
import { JumpCeremony } from './JumpCeremony.js'
import { SystemView } from './SystemView.js'
import { useDispatch, useGalaxyIndex, useGame, useNavPlot } from './store.js'

/**
 * The selected system: what the catalogue says about it, whether it survives
 * the plot, whether there is evidence to sweep, and the commit button.
 */
export function Inspector() {
  const index = useGalaxyIndex()
  const dispatch = useDispatch()
  const selectedId = useGame((s) => s.state.selected)
  const searched = useGame((s) => s.state.searched)
  const outcome = useGame((s) => s.state.outcome)
  const jumps = useGame((s) => s.state.jumps)
  const start = useGame((s) => s.state.galaxy.start)
  const gameState = useGame((s) => s.state)
  const { candidateSet, sites, trusted } = useNavPlot()
  const [confirming, setConfirming] = useState(false)
  const [ceremony, setCeremony] = useState(false)

  if (!selectedId) {
    return <div className="text-ink-faint px-4 py-6 text-[11px]">Select a star on the chart.</div>
  }

  const system = index.system(selectedId)
  const isCandidate = candidateSet.has(system.id)
  const hasEvidence = sites.has(system.id)
  const hasRecruit = gameState.recruits.sites[system.id] !== undefined
  const alreadyTried = jumps.some((j) => j.target === system.id)
  const { site } = sitePlan(gameState, system.id)
  const ship = gameState.ship
  const here = ship.at === system.id
  const route = useMemo(
    () => (here ? null : routeTo(index, ship.at, system.id)),
    [here, index, ship.at, system.id],
  )

  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-amber text-[15px]">{system.name}</h2>
          {system.id === start && <span className="text-ink-faint text-[10px]">arrival point</span>}
        </div>
        <div className="text-ink-faint text-[10px]">{REGION_NAMES[system.region]}</div>
      </div>

      <SystemView system={system} hasEvidence={hasEvidence} here={here} />

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[11px]">
        <Row label="Star">{STAR_NAMES[system.star]}</Row>
        <Row label="Lanes">{index.degree(system.id)}</Row>
        <Row label="Distance">
          {here ? 'you are here' : `${index.jumps(ship.at, system.id)} jumps from the ship`}
        </Row>
        <Row label="Claimed by">
          {system.faction ? index.factionName(system.faction) : 'nobody'}
        </Row>
        <Row label="Contains">
          {system.features.length === 0
            ? 'nothing of note'
            : system.features.map((f) => FEATURE_NAMES[f]).join(', ')}
        </Row>
      </dl>

      <div
        className={`border px-2 py-1 text-[11px] ${
          isCandidate ? 'border-phosphor-dim text-phosphor' : 'border-rule text-ink-faint'
        }`}
      >
        {trusted.length === 0
          ? 'No plot filed — every star is still possible.'
          : isCandidate
            ? 'Consistent with everything you trust.'
            : 'Ruled out by your plot.'}
      </div>

      {!here && outcome === 'seeking' && (
        <button
          disabled={!route || travelCost(gameState, route.cost) > ship.fuel}
          onClick={() => dispatch({ type: 'travel', to: system.id })}
          className={`border px-3 py-1.5 text-[11px] ${
            route && travelCost(gameState, route.cost) <= ship.fuel
              ? 'border-amber-dim text-amber hover:bg-amber-dim/15'
              : 'border-rule text-ink-faint'
          }`}
        >
          {route
            ? `Travel here — ${route.path.length - 1} ${route.path.length - 1 === 1 ? 'jump' : 'jumps'}, ` +
              `${travelCost(gameState, route.cost)} fuel` +
              (gameState.driveScarred ? ' (scarred drive)' : '') +
              (travelCost(gameState, route.cost) > ship.fuel ? ' — not enough' : '')
            : 'No lane route reaches this system'}
        </button>
      )}

      {/* The safety readout (R10): what the leg arrives with, and what
          rescue costs from there. The playtests taught the pilot this
          arithmetic; the player gets it printed instead of learned. */}
      {!here && outcome === 'seeking' && route && travelCost(gameState, route.cost) <= ship.fuel && (
        <ArrivalSafety
          arrival={ship.fuel - travelCost(gameState, route.cost)}
          destination={system.id}
        />
      )}

      {here && canScoop(index, system.id) && ship.fuel < FUEL_MAX && outcome === 'seeking' && (
        <button
          onClick={() => dispatch({ type: 'scoop' })}
          className="border-phosphor-dim text-phosphor hover:bg-phosphor-dim/15 border px-3 py-1.5 text-[11px]"
        >
          Scoop the gas giant — refill the tank (2 days)
        </button>
      )}

      {here &&
        (gameState.driveScarred || gameState.ship.hull < 100) &&
        system.faction !== null &&
        outcome === 'seeking' && (
          <button
            onClick={() => dispatch({ type: 'refit' })}
            className="border-amber-dim text-amber hover:bg-amber-dim/15 border px-3 py-1.5 text-[11px]"
          >
            {gameState.driveScarred && gameState.ship.hull < 100
              ? 'Refit the drive and the hull (4 days)'
              : gameState.driveScarred
                ? 'Refit the scarred drive (4 days)'
                : 'Repair the hull (4 days)'}
          </button>
        )}

      {here && (hasEvidence || hasRecruit) && outcome === 'seeking' && (
        <button
          onClick={() => dispatch({ type: 'openScene' })}
          className="border-amber-dim text-amber hover:bg-amber-dim/15 border px-3 py-1.5 text-[11px]"
        >
          {hasEvidence
            ? site !== null
              ? `Respond — ${site.label.toLowerCase()}`
              : 'Respond to the contact'
            : 'Someone dockside is asking for the captain'}
        </button>
      )}

      {!here && (hasEvidence || hasRecruit) && (
        <div className="text-ink-faint text-[10px]">
          {hasEvidence
            ? 'Something waits here, but the ship must arrive before anyone answers it.'
            : 'Word of a specialist looking for a berth at this station.'}
        </div>
      )}

      {!hasEvidence && searched.includes(system.id) && (
        <div className="text-ink-faint text-[10px]">Already searched. Nothing further here.</div>
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

      {ceremony && (
        <JumpCeremony
          target={system.id}
          name={system.name}
          onClose={() => setCeremony(false)}
        />
      )}
    </div>
  )
}

/**
 * What a committed leg leaves in the tank, priced against the rescue beyond
 * it. A Rift Surge can steal ten fuel mid-flight, so the safe line is the
 * nearest scoop plus that slack — the same margin a careful captain flies.
 */
function ArrivalSafety({ arrival, destination }: { arrival: number; destination: string }) {
  const index = useGalaxyIndex()
  const gameState = useGame((s) => s.state)
  const rescue = useMemo(() => nearestScoopCost(index, destination), [index, destination])
  if (!Number.isFinite(rescue)) return null

  const scoopsThere = rescue === 0
  const rescueCost = travelCost(gameState, rescue)
  const tone = scoopsThere || arrival >= rescueCost + 10
    ? 'text-ink-faint'
    : arrival >= rescueCost
      ? 'text-amber-dim'
      : 'text-alarm-dim'

  return (
    <div className={`text-[10px] leading-relaxed ${tone}`}>
      {scoopsThere
        ? `Arrives with ${arrival} in the tank — at a gas giant. The scoop refills it there.`
        : `Arrives with ${arrival} in the tank · nearest scoop from there costs ${rescueCost}` +
          (arrival < rescueCost
            ? ' — beyond rescue. This leg only arrives.'
            : arrival < rescueCost + 10
              ? ' — one bad surge from stranding.'
              : '.')}
    </div>
  )
}

/** The technological gate, itemised: what stands between the ship and the jump. */
function TrackStatus() {
  const state = useGame((s) => s.state)

  const line = (id: 'rift-drive' | 'rift-shield') => {
    const node = TECH_BY_ID[id]!
    const kind = node.component!
    if (state.tech.researched.includes(id)) return `${node.name}: built`
    if (state.tech.active?.id === id)
      return `${node.name}: building, ${state.tech.active.daysLeft}d left`
    if (state.parts[kind] >= PARTS_NEEDED[kind])
      return `${node.name}: components complete — build it on the research bench`
    return `${node.name}: ${state.parts[kind]} of ${PARTS_NEEDED[kind]} components found`
  }

  return (
    <div className="border-rule text-ink-dim border px-2 py-1.5 text-[10px] leading-relaxed">
      <div className="text-ink-faint mb-0.5 tracking-[0.1em] uppercase">The way home takes three things</div>
      <div>{line('rift-drive')}</div>
      <div>{line('rift-shield')}</div>
      <div>Heading: what the Nav Plot says, when you trust it.</div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-ink-faint">{label}</dt>
      <dd className="text-ink-dim">{children}</dd>
    </>
  )
}

/**
 * The commit. Two-step by design: the whole game funnels into this button and
 * a misclick should never spend the reserve.
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
    return (
      <div className="border-alarm-dim text-alarm-dim border px-2 py-1 text-[10px]">
        Already attempted. The anomaly was not here.
      </div>
    )
  }

  if (!ready) return <TrackStatus />

  if (fuel < LONG_JUMP_RESERVE) {
    return (
      <div className="border-rule text-ink-faint border px-2 py-1 text-[10px]">
        The Long Jump takes a reserve of {LONG_JUMP_RESERVE} fuel. The tank holds {fuel}.
      </div>
    )
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="border-rule text-ink-dim hover:border-amber-dim hover:text-amber border px-3 py-1.5 text-[11px]"
      >
        Plot the Long Jump to {name} — {LONG_JUMP_RESERVE} fuel
      </button>
    )
  }

  return (
    <div className="border-amber-dim border px-3 py-2">
      <p className="text-ink-dim mb-2 text-[11px] leading-relaxed">
        Committing burns the {LONG_JUMP_RESERVE}-fuel reserve. If you are wrong, the rift throws
        the ship somewhere far from here with almost nothing in the tank.
        {!isCandidate && (
          <span className="text-alarm">
            {' '}
            Your own plot rules this star out.
          </span>
        )}
      </p>
      <div className="flex gap-2">
        <button
          onClick={onCommit}
          className="border-amber text-amber hover:bg-amber-dim/20 border px-3 py-1 text-[11px]"
        >
          Commit
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="border-rule text-ink-faint hover:text-ink-dim border px-3 py-1 text-[11px]"
        >
          Hold
        </button>
      </div>
    </div>
  )
}
