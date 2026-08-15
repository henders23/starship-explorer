import { encounterDef } from '../engine/encounters/catalog.js'
import { CULTURE_NAMES, CULTURE_NOTES, type CultureId } from '../engine/encounters/types.js'
import { canResearch, TECHS, type TechDef, type TechTree } from '../engine/research/tech.js'
import { useDispatch, useGame } from './store.js'

/**
 * The intelligence deck: what the ship knows, and what knowing costs.
 *
 * Three columns of truth. The research trees turn data into capability;
 * the contacts ledger tracks who out here will still take the ship's calls;
 * the leads board lists the threads that are scheduled to find you — and
 * how hard the war is currently leaning on the region.
 */

const TREES: Array<{ id: TechTree; label: string; blurb: string }> = [
  { id: 'drives', label: 'Drives', blurb: 'Cheaper lanes, and a rift transit the ship can survive being wrong about.' },
  { id: 'scanners', label: 'Scanners', blurb: 'See systems before arriving, land teams with better maps, and finally — hear the rift itself.' },
  { id: 'comms', label: 'Comms', blurb: 'Every tier unlocks conversations the ship currently cannot have.' },
  { id: 'warfare', label: 'Warfare', blurb: 'The tactical display grows teeth: ion, beam, armour.' },
]

export function IntelScreen() {
  const state = useGame((s) => s.state)
  const dispatch = useDispatch()
  const scienceFit = state.roster.some((o) => o.role === 'science' && o.status === 'fit')

  return (
    <div className="intel-screen h-full overflow-y-auto px-6 py-5">
      <header className="mb-5 flex items-baseline justify-between">
        <div>
          <div className="eyebrow">Science deck · intelligence assessment</div>
          <h2 className="text-ink text-[17px] tracking-wide">Research &amp; Intelligence</h2>
        </div>
        <div className="flex items-center gap-6 text-[12px]">
          <span>
            <span className="label mr-2">Data</span>
            <span className="text-phosphor text-[15px]">{state.data}</span>
          </span>
          <span className="text-ink-faint text-[10px]">
            {scienceFit
              ? 'Research projects take 2 days at the bench.'
              : 'No fit science officer — the bench stands idle.'}
          </span>
        </div>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        {TREES.map((tree) => (
          <section key={tree.id} className="panel flex flex-col gap-2 px-4 py-3">
            <div>
              <div className="label">{tree.label}</div>
              <p className="text-ink-faint mt-1 text-[10px] leading-relaxed">{tree.blurb}</p>
            </div>
            {TECHS.filter((t) => t.tree === tree.id).map((tech) => (
              <TechCard key={tech.id} tech={tech} scienceFit={scienceFit} onResearch={() => dispatch({ type: 'research', tech: tech.id })} />
            ))}
          </section>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="panel px-4 py-3">
          <div className="label mb-2">Contacts</div>
          <div className="flex flex-col gap-3">
            {(Object.keys(CULTURE_NAMES) as CultureId[]).map((culture) => (
              <StandingRow key={culture} culture={culture} value={state.standing[culture]} />
            ))}
          </div>
          <div className="border-rule mt-3 border-t pt-2">
            <div className="text-ink-faint flex justify-between text-[10px]">
              <span>War pressure</span>
              <span className={state.warPressure >= 5 ? 'text-alarm' : state.warPressure >= 2 ? 'text-amber' : ''}>
                {state.warPressure} / 10 —{' '}
                {state.warPressure === 0
                  ? 'the war is somewhere else'
                  : state.warPressure < 3
                    ? 'patrols on the long lanes'
                    : state.warPressure < 6
                      ? 'the front is drifting this way'
                      : 'the ship is flying through a war'}
              </span>
            </div>
          </div>
        </section>

        <section className="panel px-4 py-3">
          <div className="label mb-2">Leads</div>
          {state.pending.length === 0 ? (
            <p className="text-ink-faint text-[11px]">
              No open threads. The galaxy will supply more.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {[...state.pending]
                .sort((a, b) => a.notBefore - b.notBefore)
                .map((p) => {
                  const def = encounterDef(p.id)
                  const due = p.notBefore - state.day
                  return (
                    <div key={p.id} className="flex items-baseline justify-between gap-3 text-[11px]">
                      <span className="text-ink-dim">{def?.title ?? p.id}</span>
                      <span className="text-ink-faint shrink-0 text-[10px]">
                        {due <= 0 ? 'will find the ship at the next arrival' : `expected in ~${due} ${due === 1 ? 'day' : 'days'}`}
                      </span>
                    </div>
                  )
                })}
            </div>
          )}
          <p className="text-ink-faint mt-3 text-[10px] leading-relaxed">
            Threads the ship has pulled — favours owed, hunters with your scent, appointments the
            galaxy intends to keep. They find you wherever you jump.
          </p>
        </section>
      </div>
    </div>
  )
}

function TechCard({
  tech,
  scienceFit,
  onResearch,
}: {
  tech: TechDef
  scienceFit: boolean
  onResearch: () => void
}) {
  const unlockedTech = useGame((s) => s.state.unlockedTech)
  const data = useGame((s) => s.state.data)
  const outcome = useGame((s) => s.state.outcome)
  const combat = useGame((s) => s.state.combat)

  const unlocked = unlockedTech.includes(tech.id)
  const available = canResearch(unlockedTech, tech.id)
  const affordable = data >= tech.cost
  const actionable = available && affordable && scienceFit && outcome === 'seeking' && combat === null

  return (
    <div
      className={`border px-2.5 py-2 ${
        unlocked ? 'border-phosphor-dim/60 bg-phosphor-dim/5' : available ? 'border-rule' : 'border-rule opacity-50'
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className={`text-[11px] ${unlocked ? 'text-phosphor' : 'text-ink'}`}>{tech.name}</span>
        <span className="text-ink-faint shrink-0 text-[10px]">{unlocked ? 'researched' : `${tech.cost} data`}</span>
      </div>
      <p className="text-ink-dim mt-0.5 text-[10px] leading-relaxed">{tech.effect}</p>
      {!unlocked && available && (
        <button
          disabled={!actionable}
          onClick={onResearch}
          className={`mt-1.5 border px-2 py-0.5 text-[10px] ${
            actionable
              ? 'border-amber-dim text-amber hover:bg-amber-dim/15'
              : 'border-rule text-ink-faint'
          }`}
        >
          {affordable ? 'Research — 2 days' : `Research — need ${tech.cost} data`}
        </button>
      )}
      {!unlocked && !available && tech.requires && (
        <div className="text-ink-faint mt-1 text-[9px]">requires prior node</div>
      )}
    </div>
  )
}

const STANDING_LABELS = ['hunted', 'hostile', 'wary', 'neutral', 'cordial', 'trusted', 'favoured']

function StandingRow({ culture, value }: { culture: CultureId; value: number }) {
  const label = STANDING_LABELS[value + 3] ?? 'neutral'
  return (
    <div>
      <div className="flex items-baseline justify-between text-[11px]">
        <span className="text-ink">{CULTURE_NAMES[culture]}</span>
        <span className={value > 0 ? 'text-phosphor' : value < 0 ? 'text-alarm' : 'text-ink-faint'}>
          {label} {value > 0 ? `+${value}` : value}
        </span>
      </div>
      <div className="mt-1 flex gap-1">
        {[-3, -2, -1, 0, 1, 2, 3].map((notch) => (
          <div
            key={notch}
            className="h-1 flex-1"
            style={{
              background:
                notch === 0
                  ? 'var(--color-rule)'
                  : (notch < 0 && value <= notch) ? 'var(--color-alarm-dim)'
                    : (notch > 0 && value >= notch) ? 'var(--color-phosphor-dim)'
                      : 'rgb(27 48 56 / 0.5)',
            }}
          />
        ))}
      </div>
      <p className="text-ink-faint mt-1 text-[9.5px] leading-relaxed">{CULTURE_NOTES[culture]}</p>
    </div>
  )
}
