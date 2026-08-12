import { useMemo, useState } from 'react'
import { MAX_ESCORTS, MAX_HANDS, type AwayTeam, type OfficerRole } from '../engine/crew/types.js'
import { approachesFor, approachOdds, type Site } from '../engine/missions/sites.js'
import { useDispatch, useGame } from './store.js'
import type { SystemId } from '../engine/worldgen/types.js'

/**
 * The away mission panel: pick the team, pick the approach, read the odds,
 * commit. The odds shown are the odds rolled — the player is never lied to
 * about risk, only about the galaxy.
 */
export function MissionPanel({
  system,
  site,
  onClose,
}: {
  system: SystemId
  site: Site
  onClose: () => void
}) {
  const roster = useGame((s) => s.state.roster)
  const pools = useGame((s) => s.state.pools)
  const systemNameById = useGame(
    (s) => s.state.galaxy.systems.find((x) => x.id === system)?.name ?? system,
  )
  const dispatch = useDispatch()

  const [team, setTeam] = useState<AwayTeam>({
    captain: false,
    officers: [],
    escorts: Math.min(2, pools.security),
    hands: 0,
  })
  const [approachId, setApproachId] = useState<string | null>(null)

  const approaches = approachesFor(site)
  const fit = (role: OfficerRole) => roster.find((o) => o.role === role)?.status === 'fit'

  const toggleOfficer = (role: Exclude<OfficerRole, 'captain'>) =>
    setTeam((t) => ({
      ...t,
      officers: t.officers.includes(role)
        ? t.officers.filter((r) => r !== role)
        : [...t.officers, role],
    }))

  const chosen = approaches.find((a) => a.id === approachId) ?? null
  const launchable =
    chosen !== null && (!chosen.needs || team.officers.includes(chosen.needs))

  const odds = useMemo(
    () => (chosen ? approachOdds(chosen, team, roster) : null),
    [chosen, team, roster],
  )

  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-black/75 px-6">
      <div className="panel flex w-full max-w-xl flex-col gap-3 px-5 py-4">
        <div>
          <div className="label">{site.label}</div>
          <div className="text-amber text-[14px]">{systemNameById}</div>
          <p className="text-ink-dim mt-1 text-[11px] leading-relaxed">{site.description}</p>
        </div>

        <div>
          <div className="label mb-1.5">Away team</div>
          <div className="flex flex-col gap-1">
            {roster.map((o) => {
              const isCaptain = o.role === 'captain'
              const aboard = isCaptain
                ? team.captain
                : team.officers.includes(o.role as Exclude<OfficerRole, 'captain'>)
              return (
                <label
                  key={o.role}
                  className={`flex items-center gap-2 text-[11px] ${
                    o.status !== 'fit' ? 'text-ink-faint' : 'text-ink-dim cursor-pointer'
                  }`}
                >
                  <input
                    type="checkbox"
                    disabled={o.status !== 'fit'}
                    checked={aboard && o.status === 'fit'}
                    onChange={() =>
                      isCaptain
                        ? setTeam((t) => ({ ...t, captain: !t.captain }))
                        : toggleOfficer(o.role as Exclude<OfficerRole, 'captain'>)
                    }
                    className="accent-[color:var(--color-amber)]"
                  />
                  <span>{o.name}</span>
                  <span className="text-ink-faint text-[10px]">
                    {o.status !== 'fit' ? o.status : isCaptain ? 'command +8%' : `${o.role}`}
                  </span>
                  {isCaptain && o.status === 'fit' && (
                    <span className="text-alarm-dim text-[10px]">
                      — if the captain dies out there, that is the end of it
                    </span>
                  )}
                </label>
              )
            })}
          </div>

          <div className="mt-2 flex gap-6">
            <Stepper
              label="Security escorts"
              value={team.escorts}
              max={Math.min(MAX_ESCORTS, pools.security)}
              onChange={(escorts) => setTeam((t) => ({ ...t, escorts }))}
            />
            <Stepper
              label="Crew hands"
              value={team.hands}
              max={Math.min(MAX_HANDS, pools.crew)}
              onChange={(hands) => setTeam((t) => ({ ...t, hands }))}
            />
          </div>
        </div>

        <div>
          <div className="label mb-1.5">Approach</div>
          <div className="flex flex-col gap-1">
            {approaches.map((approach) => {
              const locked = approach.needs !== null && !team.officers.includes(approach.needs)
              const active = approachId === approach.id
              const rowOdds = approachOdds(approach, team, roster)
              return (
                <button
                  key={approach.id}
                  disabled={locked && !fit(approach.needs!)}
                  onClick={() => setApproachId(approach.id)}
                  className={`flex items-baseline justify-between gap-3 border px-2 py-1.5 text-left text-[11px] ${
                    active
                      ? 'border-amber text-amber'
                      : locked
                        ? 'border-rule text-ink-faint'
                        : 'border-rule text-ink-dim hover:border-amber-dim'
                  }`}
                >
                  <span>
                    {approach.label}
                    {approach.needs && (
                      <span className={locked ? 'text-alarm-dim' : 'text-phosphor-dim'}>
                        {' '}
                        — needs {approach.needs} officer{locked ? ' on the team' : ''}
                      </span>
                    )}
                  </span>
                  <span className="text-ink-faint shrink-0 text-[10px]">
                    {rowOdds.clean}% clean · {rowOdds.messy}% costly · {rowOdds.disaster}% disaster
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {odds && (
          <div className="text-ink-dim text-[11px]">
            Committed odds:{' '}
            <span className="text-phosphor">{odds.clean}% clean</span> ·{' '}
            <span className="text-amber">{odds.messy}% costly</span> ·{' '}
            <span className="text-alarm">{odds.disaster}% disaster</span>
            <span className="text-ink-faint">
              {' '}
              — a costly landing still recovers the evidence; a disaster recovers nothing and the
              site must be attempted again.
            </span>
          </div>
        )}

        <div className="flex gap-2">
          <button
            disabled={!launchable}
            onClick={() => {
              if (!chosen) return
              dispatch({ type: 'runMission', system, team, approach: chosen.id })
              onClose()
            }}
            className={`border px-3 py-1.5 text-[11px] ${
              launchable
                ? 'border-amber text-amber hover:bg-amber-dim/15'
                : 'border-rule text-ink-faint'
            }`}
          >
            Launch the shuttle
          </button>
          <button
            onClick={onClose}
            className="border-rule text-ink-faint hover:text-ink-dim border px-3 py-1.5 text-[11px]"
          >
            Stand down
          </button>
        </div>
      </div>
    </div>
  )
}

function Stepper({
  label,
  value,
  max,
  onChange,
}: {
  label: string
  value: number
  max: number
  onChange: (value: number) => void
}) {
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="text-ink-faint text-[10px]">{label}</span>
      <button
        onClick={() => onChange(Math.max(0, value - 1))}
        className="border-rule text-ink-dim hover:border-amber-dim border px-1.5"
      >
        −
      </button>
      <span className="text-ink w-4 text-center">{value}</span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        className="border-rule text-ink-dim hover:border-amber-dim border px-1.5"
      >
        +
      </button>
    </div>
  )
}
