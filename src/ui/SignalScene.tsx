import { actionLock } from '../engine/exploration/campaign.js'
import type { Campaign, CampaignAction } from '../engine/exploration/campaign.js'
import { quietChoice, SIGNAL_BY_ID, signalTerms } from '../engine/exploration/signals.js'
import { CrewLine } from './crew-presence.js'

/**
 * An arrival signal: the situation, an officer's read of it, and the choices
 * with their terms. Once answered, the outcome stays up until acknowledged.
 */
export function SignalScene({ state, shown, dispatch, onAnswer, onClose }: {
  state: Campaign; shown: string; dispatch: (action: CampaignAction) => void; onAnswer: () => void; onClose: () => void
}) {
  const signal = SIGNAL_BY_ID[state.signal?.id ?? shown]
  if (!signal) return null
  const answered = !state.signal
  const system = state.galaxy.systems.find((s) => s.id === state.at)?.name
  return <div className="exp-modal-backdrop"><section className="exp-modal exp-signal" role="dialog" aria-modal="true" aria-label={signal.title}>
    <span className="exp-eyebrow">Arrival signal / {system}</span>
    <h2>{signal.title}</h2>
    {answered ? <>
      <p className="exp-signal-outcome">{state.log.at(-1)?.replace(/^Day \d+ · /, '')}</p>
      <button className="exp-button primary" autoFocus onClick={onClose}>Continue</button>
    </> : <>
      <p>{signal.text}</p>
      <CrewLine person={signal.speaker} compact>{signal.line}</CrewLine>
      <div className="exp-story-choices">{signal.choices.map((choice) => {
        const action: CampaignAction = { type: 'signal', choiceId: choice.id }, lock = actionLock(state, action)
        return <div key={choice.id} className="exp-story-choice">
          <button className={`exp-button${choice.odds !== undefined ? ' risky' : ''}`} data-testid={choice === quietChoice(signal) ? 'signal-walk-away' : undefined} disabled={!!lock} onClick={() => { onAnswer(); dispatch(action) }}>
            <strong>{choice.label}</strong><small>{signalTerms(choice)}</small>
          </button>
          {lock && <small>{lock}</small>}
        </div>
      })}</div>
    </>}
  </section></div>
}
