import { useState } from 'react'
import { hasSave, useGame } from './store.js'

export function StartScreen({
  onBegin,
  onResume,
  onExplore,
  explorationSaved,
  explorationError,
}: {
  onBegin: (seed?: string) => void
  onResume: () => void
  onExplore: (seed?: string, resumeSaved?: boolean) => void
  explorationSaved: boolean
  explorationError: string | null
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
          Starship <em>Ithaca</em>
        </h1>
        <p>Sail your crew home</p>
        <div className="start-exploration">
          <span className="exp-eyebrow">OPEN EXPEDITION / BUILD A WAY HOME</span>
          <p>Explore strange worlds. Decide which stories you leave behind. Lead boarding teams, defend survey ships and build a way home.</p>
          {explorationSaved && <button className="exp-button primary" onClick={() => onExplore(undefined, true)}>Resume expedition</button>}
          <button className="exp-button primary" onClick={() => {
            if ((explorationSaved || explorationError) && !window.confirm('Replace the expedition save with a new voyage? Your original campaign is unaffected.')) return
            onExplore(customSeed.trim() || undefined)
          }}>Begin expedition</button>
          {explorationError && <p role="alert">{explorationError}</p>}
        </div>
        <div className="start-classic-label exp-eyebrow">CLASSIC VOYAGE / FOLLOW THE MYSTERY</div>
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
            maxLength={200}
            placeholder={resumable ? seed : 'leave blank for a random sky'}
            spellCheck={false}
          />
        </label>

      </div>
    </div>
  )
}
