import { useState } from 'react'
import { freshSeed, useGame } from './store.js'

export function StartScreen({ onBegin }: { onBegin: () => void }) {
  const state = useGame((s) => s.state)
  const restart = useGame((s) => s.restart)
  const [confirming, setConfirming] = useState(false)

  // A voyage worth resuming: the clock has moved, or the run has ended and
  // the ending screen deserves a second look.
  const underway = state.day > 0 || state.collected.length > 0 || state.outcome !== 'seeking'

  return (
    <div className="start-screen">
      <div className="start-art" aria-hidden="true" />
      <div className="start-veil" aria-hidden="true" />
      <div className="start-copy">
        <h1>
          Starship <em>Explorer</em>
        </h1>
        <p>Bring you and your crew home</p>
        <button className="start-begin" onClick={onBegin}>
          {underway ? 'Resume command' : 'Take command'} <span>›</span>
        </button>
        {underway && !confirming && (
          <button className="start-new" onClick={() => setConfirming(true)}>
            Begin a new voyage
          </button>
        )}
        {underway && confirming && (
          <div className="start-confirm">
            <span>The current voyage — day {state.day} — will be lost.</span>
            <button
              onClick={() => {
                restart(freshSeed())
                setConfirming(false)
                onBegin()
              }}
            >
              Abandon it
            </button>
            <button onClick={() => setConfirming(false)}>Keep it</button>
          </div>
        )}
      </div>
    </div>
  )
}
