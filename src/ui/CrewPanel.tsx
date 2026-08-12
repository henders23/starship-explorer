import { useMemo } from 'react'
import type { Officer } from '../engine/crew/types.js'
import { useDispatch, useGame } from './store.js'

/**
 * The roster: four named people and two numbers.
 *
 * The generics are shown as counts on purpose — they become people, with
 * names, only at the moment one is promoted into a dead officer's chair.
 */
export function CrewPanel() {
  const roster = useGame((s) => s.state.roster)
  const pools = useGame((s) => s.state.pools)
  const dispatch = useDispatch()

  // Derived with useMemo, not inside the Zustand selector: a selector that
  // builds a fresh array every call never yields a stable snapshot, and React
  // treats the endless "new" values as an update loop.
  const open = useMemo(
    () =>
      roster
        .filter((o) => o.role !== 'captain' && o.status === 'dead')
        .map((o) => o.role as Exclude<Officer['role'], 'captain'>)
        .filter(() => pools.crew > 0),
    [roster, pools.crew],
  )

  return (
    <div className="flex flex-col gap-1 px-4 py-2">
      {roster.map((o) => (
        <OfficerRow key={o.role} officer={o} />
      ))}

      <div className="text-ink-faint mt-1 flex justify-between text-[10px]">
        <span>Security staff ×{pools.security}</span>
        <span>Crew ×{pools.crew}</span>
      </div>

      {open.map((role) => (
        <button
          key={role}
          onClick={() => dispatch({ type: 'promote', role })}
          className="border-amber-dim text-amber hover:bg-amber-dim/15 mt-1 border px-2 py-1 text-left text-[10px]"
        >
          The {role} station is empty. Promote from the crew ({pools.crew} remain).
        </button>
      ))}
    </div>
  )
}

function OfficerRow({ officer }: { officer: Officer }) {
  const tone =
    officer.status === 'dead'
      ? 'text-ink-faint line-through'
      : officer.status === 'injured'
        ? 'text-amber-dim'
        : 'text-ink-dim'

  return (
    <div className="flex items-baseline justify-between gap-2 text-[11px]">
      <span className={tone}>
        {officer.name}
        {officer.origin === 'promoted' && (
          <span className="text-ink-faint no-underline"> (promoted)</span>
        )}
      </span>
      <span className="flex items-center gap-2">
        <span className="text-amber-dim tracking-widest">
          {'▮'.repeat(officer.skill)}
          <span className="text-ink-faint/40">{'▮'.repeat(5 - officer.skill)}</span>
        </span>
        <span
          className={`w-12 text-right text-[10px] ${
            officer.status === 'dead'
              ? 'text-alarm'
              : officer.status === 'injured'
                ? 'text-amber'
                : 'text-phosphor-dim'
          }`}
        >
          {officer.status}
        </span>
      </span>
    </div>
  )
}
