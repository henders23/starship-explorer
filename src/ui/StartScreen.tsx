import { useState } from 'react'
import { VOYAGE_LABELS, type VoyageLength } from '../engine/state/modes.js'
import { hasSave, useGame } from './store.js'

export function StartScreen({
  onBegin,
  onResume,
}: {
  onBegin: (seed: string | undefined, length: VoyageLength) => void
  onResume: () => void
}) {
  const day = useGame((s) => s.state.day)
  const seed = useGame((s) => s.state.seed)
  const outcome = useGame((s) => s.state.outcome)
  const [customSeed, setCustomSeed] = useState('')
  // The short sky is the first-run mode (R10); veterans switch it off.
  const [length, setLength] = useState<VoyageLength>('short')
  const resumable = hasSave() && outcome === 'seeking' && day > 0

  return (
    <div className="start-screen">
      <div className="start-art" aria-hidden="true" />
      <div className="start-veil" aria-hidden="true" />
      <div className="start-copy">
        <h1>
          Starship <em>Explorer</em>
        </h1>
        <p>Bring you and your crew home</p>
        <div className="start-actions">
          {resumable && (
            <button className="start-begin" onClick={onResume}>
              Resume the voyage — day {day} <span>›</span>
            </button>
          )}
          <button
            className="start-begin is-secondary"
            onClick={() => onBegin(customSeed.trim() || undefined, length)}
          >
            {resumable ? 'Begin a new voyage' : 'Take command'} <span>›</span>
          </button>
        </div>
        <div className="start-length" role="radiogroup" aria-label="Voyage length">
          {(['short', 'standard'] as const).map((option) => (
            <button
              key={option}
              role="radio"
              aria-checked={length === option}
              className={`start-length-option ${length === option ? 'is-chosen' : ''}`}
              onClick={() => setLength(option)}
            >
              {VOYAGE_LABELS[option]}
            </button>
          ))}
        </div>
        <label className="start-seed">
          <span>galaxy seed</span>
          <input
            value={customSeed}
            onChange={(event) => setCustomSeed(event.target.value)}
            placeholder={resumable ? seed : 'leave blank for a random sky'}
            spellCheck={false}
          />
          <small>A seed names its sky together with the voyage length.</small>
        </label>
      </div>
    </div>
  )
}
