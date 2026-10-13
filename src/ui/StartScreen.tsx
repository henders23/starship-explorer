import { useState } from 'react'
import { MuteButton } from './sound.js'
import { hasSave, useGame } from './store.js'

/** The original mystery voyage stays playable, but only from `/?classic`. */
const classicVoyage = () => new URLSearchParams(window.location.search).has('classic')

export function StartScreen({
  onBegin,
  onResume,
  onExplore,
  explorationSaved,
  explorationError,
  storageBlocked = false,
}: {
  onBegin: (seed?: string) => void
  onResume: () => void
  onExplore: (seed?: string, resumeSaved?: boolean) => void
  explorationSaved: boolean
  explorationError: string | null
  storageBlocked?: boolean
}) {
  const day = useGame((s) => s.state.day)
  const seed = useGame((s) => s.state.seed)
  const outcome = useGame((s) => s.state.outcome)
  const [customSeed, setCustomSeed] = useState('')
  const classic = classicVoyage()
  const resumable = classic && hasSave() && outcome === 'seeking' && day > 0

  return (
    <div className="start-screen">
      <div className="start-art" aria-hidden="true" />
      <div className="start-veil" aria-hidden="true" />
      <div className="start-copy">
        <h1>
          Starship <em>Explorer</em>
        </h1>
        <section className="start-exploration" aria-label="Open Expedition">
          <span className="exp-eyebrow">Open Expedition / Build a way home</span>
          <p>Explore strange worlds. Decide which stories you leave behind. Lead boarding teams, defend survey ships and build a way home.</p>
          {explorationSaved && <button className="exp-button primary" onClick={() => onExplore(undefined, true)}>Resume expedition</button>}
          <button className="exp-button primary" onClick={() => {
            if ((explorationSaved || explorationError) && !window.confirm('Replace the expedition save with a new voyage? Your original campaign is unaffected.')) return
            onExplore(customSeed.trim() || undefined)
          }}>Begin expedition</button>
          {explorationError && <p role="alert">{explorationError}</p>}
          {storageBlocked && <p role="status">This browser is blocking site storage, so nothing will be saved. A voyage lasts until you close the tab.</p>}
        </section>
        {classic && <>
          <div className="start-classic-label exp-eyebrow">Classic voyage / Follow the mystery</div>
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
        </>}
        <label className="start-seed">
          <span>Galaxy seed</span>
          <input
            value={customSeed}
            onChange={(event) => setCustomSeed(event.target.value)}
            maxLength={200}
            placeholder={resumable ? seed : 'leave blank for a random sky'}
            spellCheck={false}
          />
        </label>
        <MuteButton className="start-mute" />
      </div>
    </div>
  )
}
