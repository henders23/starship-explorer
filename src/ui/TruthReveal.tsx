import { useState } from 'react'
import { describeConstraint } from '../engine/mystery/constraints.js'
import { useGalaxyIndex, useGame } from './store.js'

/**
 * The post-mortem. Once a run has ended — however it ended — the answer key
 * comes out: every account the player held, stamped true or false against
 * how they filed it. This is the one place the UI may read a clue's truth,
 * because the deduction is over and the lesson is the payoff.
 */
export function TruthReveal() {
  const state = useGame((s) => s.state)
  const index = useGalaxyIndex()
  const [open, setOpen] = useState(false)

  if (state.outcome === 'seeking') return null
  const held = state.mystery.clues.filter((clue) => state.collected.includes(clue.id))

  const verdict = (truth: 'true' | 'false', filing: string) => {
    if (truth === 'false' && filing === 'trusted') return ['You trusted a lie', 'text-alarm'] as const
    if (truth === 'false' && filing === 'doubted') return ['Rightly doubted', 'text-phosphor'] as const
    if (truth === 'true' && filing === 'doubted') return ['You doubted the truth', 'text-amber'] as const
    if (truth === 'true' && filing === 'trusted') return ['Rightly trusted', 'text-phosphor'] as const
    return [truth === 'true' ? 'True, never filed' : 'A lie, never filed', 'text-ink-faint'] as const
  }

  const liesTrusted = held.filter(
    (c) => c.truth === 'false' && (state.clueStates[c.id] ?? 'unfiled') === 'trusted',
  ).length

  return (
    <div className="mt-3 border-t border-rule pt-3">
      <div className="text-ink-dim mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
        <span>day {state.day}</span>
        <span>{state.jumps.filter((j) => !j.correct).length} failed {state.jumps.filter((j) => !j.correct).length === 1 ? 'attempt' : 'attempts'}</span>
        <span>{held.length} accounts held</span>
        <span className="text-ink-faint">seed {state.seed}</span>
      </div>

      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="border-rule text-ink-dim hover:border-amber-dim hover:text-amber border px-3 py-1.5 text-[11px]"
        >
          The truth of the plot — who lied
        </button>
      ) : (
        <div className="max-h-56 overflow-y-auto pr-1">
          {held.length === 0 && (
            <div className="text-ink-faint text-[11px]">
              No accounts were ever gathered. The galaxy kept all of its secrets.
            </div>
          )}
          {held.map((clue) => {
            const filing = state.clueStates[clue.id] ?? 'unfiled'
            const [label, tone] = verdict(clue.truth, filing)
            return (
              <div key={clue.id} className="border-rule mb-1.5 border-b pb-1.5 text-[11px] last:border-b-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-ink-dim">{describeConstraint(clue.constraint, index)}</span>
                  <span className={`${tone} shrink-0 text-[10px]`}>{label}</span>
                </div>
                <div className="text-ink-faint text-[10px]">
                  {clue.id} · {index.system(clue.source.at).name} · filed {filing}
                </div>
              </div>
            )
          })}
          {liesTrusted > 0 && (
            <div className="text-alarm-dim mt-1 text-[10px]">
              {liesTrusted} {liesTrusted === 1 ? 'lie sat' : 'lies sat'} in your trusted column.
              That is where the plot bent.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
