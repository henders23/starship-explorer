import { encounterDef } from '../engine/encounters/catalog.js'
import { CULTURE_NAMES, type Backdrop, type EncounterChoice } from '../engine/encounters/types.js'
import { choiceAvailable } from '../engine/state/reducer.js'
import { techDef } from '../engine/research/tech.js'
import { useDispatch, useGame } from './store.js'

/**
 * The viewscreen: whoever — or whatever — the arrival put in front of the
 * ship. A portrait if someone fronts the encounter, a landing backdrop for
 * the place, the dialogue, and the choices with their requirements shown.
 * Locked options stay visible: knowing what the ship *cannot yet* say is
 * how the player learns what research is for.
 */

const BACKDROPS: Record<Backdrop, string | null> = {
  space: null,
  planet: '/assets/landing/away_mission_planet.png',
  station: '/assets/landing/away_mission_space_station.png',
  derelict: '/assets/landing/away_mission_derelict.png',
}

const TAG_LABELS: Record<string, string> = {
  key: 'Priority contact',
  contact: 'Contact',
  event: 'Event',
  mission: 'Mission',
  crew: 'Ship’s company',
  world: 'Planetfall',
  derelict: 'Derelict',
  war: 'War zone',
  bounty: 'Bounty',
  hostile: 'Hostile contact',
}

function lockReason(state: ReturnType<typeof useGame.getState>['state'], choice: EncounterChoice): string | null {
  const needs = choice.needs
  if (needs?.tech && !state.unlockedTech.includes(needs.tech)) {
    return `requires ${techDef(needs.tech).name}`
  }
  if (needs?.officer) {
    const officer = state.roster.find((o) => o.role === needs.officer)
    if (!officer || officer.status !== 'fit') return `needs a fit ${needs.officer} officer`
  }
  if (needs?.standing && state.standing[needs.standing[0]] < needs.standing[1]) {
    return `needs standing ${needs.standing[1] >= 0 ? '+' : ''}${needs.standing[1]} with ${CULTURE_NAMES[needs.standing[0]]}`
  }
  if (needs?.flag && !state.flags.includes(needs.flag)) return 'the moment has not come'
  const spend = choice.spend
  if (spend) {
    if ((spend.fuel ?? 0) > state.ship.fuel) return `costs ${spend.fuel} fuel — not enough`
    if ((spend.data ?? 0) > state.data) return `costs ${spend.data} data — not enough`
    if ((spend.supplies ?? 0) > state.supplies) return `costs ${spend.supplies} supplies — not enough`
  }
  return null
}

function costLine(choice: EncounterChoice): string | null {
  const spend = choice.spend
  if (!spend) return null
  const parts: string[] = []
  if (spend.fuel) parts.push(`${spend.fuel} fuel`)
  if (spend.data) parts.push(`${spend.data} data`)
  if (spend.supplies) parts.push(`${spend.supplies} supplies`)
  return parts.length > 0 ? parts.join(', ') : null
}

export function EncounterScreen() {
  const state = useGame((s) => s.state)
  const dispatch = useDispatch()
  const active = state.encounter
  if (!active) return null

  const def = encounterDef(active.id)
  if (!def) return null
  const node = def.nodes[active.node]
  const backdrop = BACKDROPS[def.backdrop]
  const showingOutcome = active.outcome !== undefined
  const continuesIntoCombat = state.combat !== null

  return (
    <div className="fixed inset-0 z-30 overflow-hidden bg-black">
      {backdrop ? (
        <img src={backdrop} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
      ) : (
        <div className="encounter-space absolute inset-0" aria-hidden="true" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/25" />

      <div className="relative z-10 flex h-full items-end justify-center px-8 pb-10">
        <div className="flex w-full max-w-4xl items-end gap-6">
          {def.portrait && (
            <div className="encounter-portrait shrink-0">
              <img src={def.portrait} alt={node?.speaker ?? def.title} />
              {node?.speaker && !showingOutcome && <div className="encounter-speaker">{node.speaker}</div>}
            </div>
          )}

          <div className="panel-glass min-w-0 flex-1 px-6 py-5">
            <div className="mb-1 flex items-baseline justify-between gap-4">
              <div className="eyebrow">
                {TAG_LABELS[def.tag] ?? def.tag}
                {def.culture ? ` · ${CULTURE_NAMES[def.culture]}` : ''}
              </div>
              <div className="text-ink-faint text-[10px]">Day {state.day}</div>
            </div>
            <h2 className="text-amber mb-3 text-[17px]">{def.title}</h2>

            {!showingOutcome && node && (
              <>
                <div className="encounter-prose mb-4 flex max-h-[38vh] flex-col gap-2 overflow-y-auto pr-2">
                  {node.text.map((paragraph, i) => (
                    <p key={i} className="text-ink text-[12.5px] leading-relaxed">{paragraph}</p>
                  ))}
                </div>
                <div className="flex flex-col gap-1.5">
                  {node.choices.map((choice) => {
                    const locked = lockReason(state, choice)
                    const available = choiceAvailable(state, choice)
                    const cost = costLine(choice)
                    return (
                      <button
                        key={choice.id}
                        disabled={!available}
                        onClick={() => dispatch({ type: 'encounterChoose', choice: choice.id })}
                        className={`border px-3 py-2 text-left text-[12px] transition-colors ${
                          available
                            ? 'border-amber-dim text-ink hover:bg-amber-dim/15 hover:text-amber'
                            : 'border-rule text-ink-faint'
                        }`}
                      >
                        <span>{choice.label}</span>
                        {cost && <span className="text-amber-dim ml-2 text-[10px]">— {cost}</span>}
                        {locked && <span className="text-alarm-dim ml-2 text-[10px]">({locked})</span>}
                      </button>
                    )
                  })}
                </div>
              </>
            )}

            {showingOutcome && (
              <>
                <div className="encounter-prose mb-4 flex max-h-[42vh] flex-col gap-2 overflow-y-auto pr-2">
                  {active.outcome!.text.map((paragraph, i) => (
                    <p key={i} className="text-ink text-[12.5px] leading-relaxed">{paragraph}</p>
                  ))}
                </div>
                <button
                  onClick={() => dispatch({ type: 'encounterContinue' })}
                  className={`border px-4 py-2 text-[12px] ${
                    continuesIntoCombat
                      ? 'border-alarm text-alarm hover:bg-alarm-dim/20'
                      : 'border-amber-dim text-amber hover:bg-amber-dim/15'
                  }`}
                >
                  {continuesIntoCombat ? 'All hands to battle stations' : 'Continue'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
