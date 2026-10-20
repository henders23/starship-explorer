import { useState } from 'react'
import { MuteButton } from './sound.js'

/** One game, one entry point. Existing expedition saves are not reinterpreted. */
export function StartScreen({
  onExplore, explorationSaved, explorationError, storageBlocked = false,
}: {
  onExplore: (seed?: string, resumeSaved?: boolean, hardcore?: boolean) => void
  explorationSaved: boolean
  explorationError: string | null
  storageBlocked?: boolean
}) {
  const [customSeed, setCustomSeed] = useState('')
  const [hardcore, setHardcore] = useState(false)
  return <main className="start-screen">
    <div className="start-art" aria-hidden="true" />
    <div className="start-veil" aria-hidden="true" />
    <div className="start-copy">
      <span className="exp-eyebrow">ISS LODESTAR / A VOYAGE INTO THE UNKNOWN</span>
      <h1>Starship <em>Explorer</em></h1>
      <section className="start-exploration" aria-label="Begin your voyage">
        <p>Far from home. One ship, a crew who depend on you, and a galaxy full of decisions.</p>
        {explorationSaved && <button className="exp-button primary" onClick={() => onExplore(undefined, true)}>Resume expedition</button>}
        <button className="exp-button primary" onClick={() => {
          if ((explorationSaved || explorationError) && !window.confirm('Replace your saved expedition with a new voyage?')) return
          onExplore(customSeed.trim() || undefined, false, hardcore)
        }}>Begin expedition</button>
        {explorationError && <p role="alert">{explorationError}</p>}
        {storageBlocked && <p role="status">Browser storage is blocked. Progress will not be saved after this tab closes.</p>}
      </section>
      <label className="start-seed"><span>Galaxy seed (optional)</span><input value={customSeed}
        onChange={event => setCustomSeed(event.target.value)} maxLength={200} placeholder="A different sky each voyage"
        spellCheck={false} /></label>
      <label className="start-hardcore"><input type="checkbox" checked={hardcore} onChange={(event) => setHardcore(event.target.checked)} />
        <span><strong>Hardcore</strong> Losing the ship in battle ends the voyage. No tow home, and raiders show no mercy to a wreck.</span></label>
      <MuteButton className="start-mute" />
    </div>
  </main>
}
