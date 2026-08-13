import { useMemo } from 'react'
import type { Officer } from '../engine/crew/types.js'
import { moraleBand } from '../engine/state/reducer.js'
import { useDispatch, useGame } from './store.js'

/**
 * The roster: four named people and two numbers.
 *
 * The generics are shown as counts on purpose — they become people, with
 * names, only at the moment one is promoted into a dead officer's chair.
 */
const BAND_LABELS = {
  steady: ['steady', 'text-phosphor'],
  uneasy: ['uneasy', 'text-amber-dim'],
  fractious: ['fractious', 'text-amber'],
  mutinous: ['MUTINOUS', 'text-alarm'],
} as const

const STATION_LABELS: Record<Officer['role'], string> = {
  captain: 'Command',
  security: 'Security',
  science: 'Science',
  medical: 'Medical',
}

export function CrewPanel() {
  const roster = useGame((s) => s.state.roster)
  const pools = useGame((s) => s.state.pools)
  const morale = useGame((s) => s.state.morale)
  const day = useGame((s) => s.state.day)
  const dispatch = useDispatch()
  const [bandLabel, bandTone] = BAND_LABELS[moraleBand(morale)]

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
    <div className="flex flex-col gap-[7px] px-[18px] py-3">
      {roster.map((o) => (
        <OfficerRow key={o.role} officer={o} day={day} />
      ))}

      <div className="text-ink mt-1.5 flex justify-between text-[12px]">
        <span>Security staff ×{pools.security}</span>
        <span>Crew ×{pools.crew}</span>
        <span>
          morale <span className={bandTone}>{bandLabel}</span>
        </span>
      </div>

      <button
        onClick={() => dispatch({ type: 'consult' })}
        className="border-rule text-ink hover:border-amber-dim hover:text-amber mt-1.5 border px-2.5 py-1.5 text-[12px]"
      >
        Consult the bridge
      </button>

      {open.map((role) => (
        <button
          key={role}
          onClick={() => dispatch({ type: 'promote', role })}
          className="border-amber-dim text-amber hover:bg-amber-dim/15 mt-1 border px-2.5 py-1.5 text-left text-[11px]"
        >
          The {role} station is empty. Promote from the crew ({pools.crew} remain).
        </button>
      ))}
    </div>
  )
}

function OfficerRow({ officer, day }: { officer: Officer; day: number }) {
  const tone =
    officer.status === 'dead'
      ? 'text-ink-faint line-through'
      : officer.status === 'injured'
        ? 'text-amber-dim'
        : 'text-ink'

  return (
    <div className="flex items-center justify-between gap-2 text-[14px]">
      <span className={`flex min-w-0 items-center gap-2.5 ${tone}`}>
        {officer.portrait && (
          <img
            src={officer.portrait}
            alt=""
            className={`roster-portrait ${officer.status === 'dead' ? 'is-dead' : ''}`}
          />
        )}
        <span className="truncate">
          <span className="text-ink-dim mr-1.5 text-[11px] tracking-[0.08em] uppercase no-underline">
            {STATION_LABELS[officer.role]}
          </span>
          {officer.name}
          {officer.origin === 'promoted' && (
            <span className="text-ink-faint no-underline"> (promoted)</span>
          )}
        </span>
      </span>
      <span
        className={`w-[86px] shrink-0 text-right text-[13px] ${
          officer.status === 'dead'
            ? 'text-alarm'
            : officer.status === 'injured'
              ? 'text-amber'
              : 'text-ink'
        }`}
        title={
          officer.status === 'injured'
            ? `In the medbay, out of action. Fit for duty in ${Math.max(0, (officer.healedAfter ?? day) - day)} days.`
            : undefined
        }
      >
        {officer.status === 'injured'
          ? `medbay ${Math.max(0, (officer.healedAfter ?? day) - day)}d`
          : officer.status}
      </span>
    </div>
  )
}
