import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { jumpReady } from '../engine/research/tech.js'
import { sitePlan, travelCost } from '../engine/state/reducer.js'
import { canScoop, FUEL_MAX, LONG_JUMP_RESERVE, routeTo } from '../engine/travel/travel.js'
import { FEATURE_NAMES, REGION_NAMES, STAR_NAMES } from '../engine/worldgen/types.js'
import { JumpCeremony } from './JumpCeremony.js'
import { SystemView } from './SystemView.js'
import { useDispatch, useGalaxyIndex, useGame, useNavPlot } from './store.js'

/**
 * The inspector: one panel docked to the right of the chart carrying
 * everything the player does with a star. Selecting a star is the only verb
 * the chart has, and this is what selecting it says — what the star *is*,
 * where it stands in the plot, what getting there costs, and what the ship
 * can do about it, in that order.
 *
 * It sits over the sky rather than beside it because the chart is the screen:
 * a docked column would take a fifth of the galaxy away permanently, and the
 * panel is only wanted while a star is selected.
 */
export function SystemPanel() {
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
      <aside className="map-ui system-panel is-empty">
        <div className="panel-kicker">System information</div>
        <p className="panel-empty">
          Select a star on the chart. The Ithaca sits at the near edge of the sector; the way home
          is somewhere out to the right.
        </p>
      </aside>
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

  // Accounts the player already holds that were come by at this star. The
  // chart is where the deduction happens, so the evidence a place produced
  // belongs on the place, not only in the drawer.
  const accounts = clues.filter((clue) => clue.source.at === system.id)

  const standing = alreadyTried
    ? { text: 'Jump attempted — not here', tone: 'is-alarm' }
    : trusted.length === 0
      ? { text: 'Nothing ruled out yet', tone: 'is-dim' }
      : isCandidate
        ? { text: 'Still possible', tone: 'is-amber' }
        : { text: 'Ruled out by your plot', tone: 'is-dim' }

  const contact = hasEvidence
    ? { text: here ? 'Evidence — respond now' : 'Evidence, unsearched', tone: 'is-phosphor' }
    : hasRecruit
      ? { text: 'Specialist for hire', tone: 'is-phosphor' }
      : searched.includes(system.id)
        ? { text: 'Searched — nothing further', tone: 'is-dim' }
        : { text: 'No contact reported', tone: 'is-dim' }

  return (
    <aside className="map-ui system-panel" key={system.id}>
      <div className="panel-head">
        <div className="panel-head-row">
          <span className="panel-kicker">System information</span>
          <button
            className="panel-close"
            aria-label="Clear the selection"
            onClick={() => dispatch({ type: 'select', system: null })}
          >
            ×
          </button>
        </div>
        <h2>{system.name}</h2>
        <div className="panel-region">{REGION_NAMES[system.region]}</div>
      </div>

      <div className="panel-body">
        <SystemView system={system} hasEvidence={hasEvidence} here={here} />

        <p className="panel-blurb">
          Catalogued as {STAR_NAMES[system.star]}. The survey holds {features}.
        </p>
        <div className="panel-meta">
          {index.degree(system.id)} {index.degree(system.id) === 1 ? 'lane' : 'lanes'} ·{' '}
          {system.faction ? index.factionName(system.faction) : 'claimed by nobody'}
          {system.id === start ? ' · the arrival point' : ''}
        </div>

        <dl className="panel-grid">
          <dt>Standing</dt>
          <dd className={standing.tone}>{standing.text}</dd>
          <dt>Contact</dt>
          <dd className={contact.tone}>{contact.text}</dd>
          <dt>Distance</dt>
          <dd>
            {here
              ? 'the ship is here'
              : route
                ? `${route.path.length - 1} ${route.path.length - 1 === 1 ? 'jump' : 'jumps'}`
                : 'no lane route'}
          </dd>
          <dt>Fuel cost</dt>
          <dd className={!route ? 'is-dim' : !affordable ? 'is-alarm' : fuel > 24 ? 'is-amber' : ''}>
            {here ? '—' : route ? `${fuel} of ${ship.fuel}` : '—'}
          </dd>
        </dl>

        {accounts.length > 0 ? (
          accounts.map((clue) => (
            <div key={clue.id} className="panel-account">
              <div className="panel-account-head">Account from this system</div>
              <div className="panel-account-body">{clue.prose}</div>
              <div className="panel-account-foot">
                {clue.source.attribution} ·{' '}
                {clue.state === 'trusted'
                  ? 'trusted'
                  : clue.state === 'doubted'
                    ? 'doubted'
                    : 'unfiled'}
              </div>
            </div>
          ))
        ) : (
          <div className="panel-noaccount">No account has come from this system.</div>
        )}
      </div>

      <div className="panel-foot">
        {!here && outcome === 'seeking' && (
          <button
            disabled={!route || !affordable}
            onClick={() => dispatch({ type: 'travel', to: system.id })}
            className={`panel-action ${route && affordable ? 'is-go' : route ? 'is-bad' : 'is-off'}`}
          >
            {route
              ? `Travel — ${route.path.length - 1} ${route.path.length - 1 === 1 ? 'jump' : 'jumps'}, ${fuel} fuel` +
                (gameState.driveScarred ? ' (scarred drive)' : '') +
                (affordable ? '' : ' — not enough')
              : 'No lane route reaches this system'}
          </button>
        )}

        {here && (hasEvidence || hasRecruit) && outcome === 'seeking' && (
          <button onClick={() => dispatch({ type: 'openScene' })} className="panel-action is-go">
            {hasEvidence
              ? site !== null
                ? `Respond — ${site.label.toLowerCase()}`
                : 'Respond to the contact'
              : 'Someone dockside is asking for the captain'}
          </button>
        )}

        {here && canScoop(index, system.id) && ship.fuel < FUEL_MAX && outcome === 'seeking' && (
          <button onClick={() => dispatch({ type: 'scoop' })} className="panel-action is-cyan">
            Scoop the gas giant — refill the tank (2 days)
          </button>
        )}

        {here &&
          (gameState.driveScarred || ship.hull < 100) &&
          system.faction !== null &&
          outcome === 'seeking' && (
            <button onClick={() => dispatch({ type: 'refit' })} className="panel-action is-go">
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
      </div>

      {/* The ceremony takes the whole screen, so it is portalled out of the
          panel: the panel's own backdrop filter would otherwise become its
          containing block and trap it in a 330px column. */}
      {ceremony &&
        createPortal(
          <JumpCeremony target={system.id} name={system.name} onClose={() => setCeremony(false)} />,
          document.body,
        )}
    </aside>
  )
}

/**
 * The commit. Two-step by design: the whole game funnels into this button and
 * a misclick should never spend the reserve. The confirmation takes the whole
 * deck — the chart should go quiet when the ship is about to bet itself.
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
    return <div className="panel-note is-alarm">Already attempted. The anomaly was not here.</div>
  }

  // Not yet buildable: the plot bar along the foot carries the gate, and the
  // inspector has no room to say the same thing twice.
  if (!ready) return null

  if (fuel < LONG_JUMP_RESERVE) {
    return (
      <div className="panel-note">
        The Long Jump takes a reserve of {LONG_JUMP_RESERVE} fuel. The tank holds {fuel}.
      </div>
    )
  }

  return (
    <>
      <button onClick={() => setConfirming(true)} className="panel-action is-quiet">
        Plot the Long Jump to {name} — {LONG_JUMP_RESERVE} fuel
      </button>

      {/* Portalled to the body: the panel's backdrop filter would otherwise
          become the containing block and trap the veil in a 330px column. */}
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
