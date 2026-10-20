import { actionLock } from '../engine/exploration/campaign.js'
import type { Campaign, CampaignAction } from '../engine/exploration/campaign.js'
import { outcomeChips, quietChoice, SIGNAL_BY_ID, signalLuck, signalTerms } from '../engine/exploration/signals.js'
import type { PendingSignal } from '../engine/exploration/signals.js'
import { CrewLine } from './crew-presence.js'

/**
 * An arrival signal: the situation, an officer's read of it, and the choices
 * with their terms. Once answered, the outcome stays up until acknowledged.
 */
export function SignalScene({ state, shown, dispatch, onAnswer, onClose }: {
  state: Campaign; shown: (PendingSignal & { choiceId?: string }) | null; dispatch: (action: CampaignAction) => void
  onAnswer: (choiceId: string) => void; onClose: () => void
}) {
  const signal = SIGNAL_BY_ID[state.signal?.id ?? shown?.id ?? '']
  if (!signal) return null
  const answered = !state.signal
  const system = state.galaxy.systems.find((s) => s.id === state.at)?.name
  return <div className="exp-modal-backdrop"><section className="exp-modal exp-signal" role="dialog" aria-modal="true" aria-label={signal.title}>
    <span className="exp-eyebrow">Arrival signal / {system}</span>
    <h2>{signal.title}</h2>
    {answered ? <>
      <p className="exp-signal-outcome">{state.log.at(-1)?.replace(/^Day \d+ · /, '')}</p>
      <Chips signal={signal} shown={shown} seed={state.seed} />
      <button className="exp-button primary" autoFocus onClick={onClose}>Continue</button>
    </> : <>
      <p>{signal.text}</p>
      <CrewLine person={signal.speaker} compact>{signal.line}</CrewLine>
      <div className="exp-story-choices">{signal.choices.map((choice) => {
        const action: CampaignAction = { type: 'signal', choiceId: choice.id }, lock = actionLock(state, action)
        return <div key={choice.id} className="exp-story-choice">
          <button className={`exp-button${choice.odds !== undefined ? ' risky' : ''}`} data-testid={choice === quietChoice(signal) ? 'signal-walk-away' : undefined} disabled={!!lock} onClick={() => { onAnswer(choice.id); dispatch(action) }}>
            <strong>{choice.label}</strong><small>{signalTerms(choice)}</small>
          </button>
          {lock && <small>{lock}</small>}
        </div>
      })}</div>
    </>}
  </section></div>
}

/** What the answer did, at a glance. */
function Chips({ signal, shown, seed }: { signal: NonNullable<(typeof SIGNAL_BY_ID)[string]>; shown: (PendingSignal & { choiceId?: string }) | null; seed: string }) {
  const choice = signal.choices.find((c) => c.id === shown?.choiceId)
  if (!choice || !shown) return null
  const chips = outcomeChips(signalLuck(seed, shown, choice) ? choice.good : choice.bad!, choice.cost)
  return chips.length ? <div className="exp-signal-chips">{chips.map((c) => <span key={c} className={c.startsWith('−') || c === 'ambush' ? 'loss' : 'gain'}>{c}</span>)}</div> : null
}
