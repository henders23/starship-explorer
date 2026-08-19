import { useState } from 'react'
import { hasSave, useGame } from './store.js'

export function StartScreen({
  onBegin,
  onResume,
}: {
  onBegin: (seed?: string) => void
  onResume: () => void
}) {
  const day = useGame((s) => s.state.day)
  const seed = useGame((s) => s.state.seed)
  const outcome = useGame((s) => s.state.outcome)
  const [customSeed, setCustomSeed] = useState('')
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
          <button className="start-begin is-secondary" onClick={() => onBegin(customSeed.trim() || undefined)}>
            {resumable ? 'Begin a new voyage' : 'Take command'} <span>›</span>
          </button>
        </div>
        <label className="start-seed">
          <span>galaxy seed</span>
          <input
            value={customSeed}
            onChange={(event) => setCustomSeed(event.target.value)}
            placeholder={resumable ? seed : 'leave blank for a random sky'}
            spellCheck={false}
          />
        </label>
      </div>
    </div>
  )
}
