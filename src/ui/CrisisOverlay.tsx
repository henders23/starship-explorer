import { useEffect } from 'react'
import { shiftOdds } from '../engine/missions/crisis.js'
import { useDispatch, useGame } from './store.js'

/**
 * The mid-mission decision (R9): the team is on the ground, the situation
 * has changed, and everything waits on the captain's call. Each choice
 * prints the odds it would roll — the same house rule as the mission
 * panel: the player is never lied to about a probability.
 */
export function CrisisOverlay() {
  const crisis = useGame((s) => s.state.crisis)
  const roster = useGame((s) => s.state.roster)
  const systems = useGame((s) => s.state.galaxy.systems)
  const dispatch = useDispatch()

  const blocked = (needs?: string): string | null => {
    if (!crisis) return 'no crisis'
    if (!needs) return null
    if (!crisis.team.officers.includes(needs as never)) return `needs the ${needs} officer on the team`
    if (roster.find((o) => o.role === needs)?.status !== 'fit') return `needs the ${needs} officer fit`
    return null
  }

  // Keyboard coverage (R10): the digits make the call, in printed order.
  useEffect(() => {
    if (!crisis) return
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
      const digit = Number(event.key)
      if (digit >= 1 && digit <= crisis.choices.length) {
        const choice = crisis.choices[digit - 1]!
        if (blocked(choice.needs) === null) dispatch({ type: 'crisisCall', choice: choice.id })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crisis, roster, dispatch])

  if (!crisis) return null
  const system = systems.find((x) => x.id === crisis.at)?.name ?? crisis.at

  return (
    <div className="scene-overlay">
      <div className="scene-veil" aria-hidden="true" />

      <div className="scene-header">
        <div className="eyebrow">{system} · away team · holding for your call</div>
      </div>

      <div className="scene-dialogue panel-glass">
        <div className="scene-portrait is-log">⚠</div>
        <div className="scene-copy">
          <div className="scene-speaker">
            <strong>Ground team</strong>
            <span>
              standing at {crisis.odds.clean}% clean · {crisis.odds.messy}% costly ·{' '}
              {crisis.odds.disaster}% disaster
            </span>
          </div>
          <p className="scene-line">{crisis.text}</p>
        </div>
      </div>

      <div className="scene-footer">
        <div className="scene-options">
          {crisis.choices.map((choice) => {
            const lock = blocked(choice.needs)
            const rolled = shiftOdds(crisis.odds, choice.shift)
            return (
              <button
                key={choice.id}
                className="scene-option"
                disabled={lock !== null}
                onClick={() => dispatch({ type: 'crisisCall', choice: choice.id })}
              >
                <strong>
                  <span className="scene-option-key">{crisis.choices.indexOf(choice) + 1}</span>{' '}
                  {choice.label}
                </strong>
                <small>
                  {lock ?? choice.detail} — rolls {rolled.clean}% · {rolled.messy}% ·{' '}
                  {rolled.disaster}%{choice.days > 0 ? ` · +${choice.days} day` : ''}
                </small>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
