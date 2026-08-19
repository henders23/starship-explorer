import { useEffect, useState } from 'react'
import type { OfficerRole } from '../engine/crew/types.js'
import type { SceneOption } from '../engine/encounters/types.js'
import { sitePlan } from '../engine/state/reducer.js'
import { MissionPanel } from './MissionPanel.js'
import { useDispatch, useGame } from './store.js'

/**
 * The scene overlay: where the game happens now. Renders the encounter in
 * the engine state as dialogue — beats advance on click, then the options
 * appear with their costs and requirements printed. Options dispatch engine
 * actions; the one piece of UI-only flow is the mission option, which closes
 * the scene and opens away-team planning.
 */

const STATION_LABELS: Record<OfficerRole, string> = {
  captain: 'Command',
  security: 'Security',
  science: 'Science',
  medical: 'Medical',
}

export function EncounterOverlay() {
  const scene = useGame((s) => s.state.encounter)
  const roster = useGame((s) => s.state.roster)
  const fuel = useGame((s) => s.state.ship.fuel)
  const gameState = useGame((s) => s.state)
  const systems = useGame((s) => s.state.galaxy.systems)
  const dispatch = useDispatch()
  const [beat, setBeat] = useState(0)
  const [planning, setPlanning] = useState<string | null>(null)

  // A new scene starts from its first beat.
  useEffect(() => setBeat(0), [scene?.at, scene?.templateId])

  if (planning) {
    const { site } = sitePlan(gameState, planning)
    if (site) {
      return <MissionPanel system={planning} site={site} onClose={() => setPlanning(null)} />
    }
  }

  if (!scene) return null

  const atLastBeat = beat >= scene.beats.length - 1
  const current = scene.beats[Math.min(beat, scene.beats.length - 1)]!
  const officer = current.speaker && current.speaker !== 'figure'
    ? roster.find((o) => o.role === current.speaker)
    : undefined

  const choose = (option: SceneOption) => {
    dispatch({ type: 'sceneOption', option: option.id })
    if (option.effect.kind === 'mission') setPlanning(scene.at)
  }

  const disabledReason = (option: SceneOption): string | null => {
    if (option.needs && roster.find((o) => o.role === option.needs)?.status !== 'fit')
      return `needs the ${option.needs} officer fit`
    if (option.effect.kind === 'collect' && (option.effect.fuel ?? 0) > 0 && fuel <= option.effect.fuel!)
      return 'not enough fuel'
    return null
  }

  return (
    <div className="scene-overlay" onClick={() => !atLastBeat && setBeat((b) => b + 1)}>
      <div className="scene-veil" aria-hidden="true" />

      <div className="scene-header">
        <div className="eyebrow">
          {systems.find((x) => x.id === scene.at)?.name ?? scene.at}
          {scene.figure ? ` · ${scene.figure.label.toLowerCase()}` : ' · contact'}
        </div>
      </div>

      <div className="scene-dialogue panel-glass" key={beat}>
        {current.speaker === 'figure' && scene.figure ? (
          <div className="scene-portrait is-figure">{scene.figure.name.slice(0, 1)}</div>
        ) : officer ? (
          <div className="scene-portrait">
            {officer.portrait ? <img src={officer.portrait} alt="" /> : officer.name.slice(0, 1)}
          </div>
        ) : (
          <div className="scene-portrait is-log">✦</div>
        )}
        <div className="scene-copy">
          <div className="scene-speaker">
            {current.speaker === 'figure' && scene.figure ? (
              <>
                <strong>{scene.figure.name}</strong>
                <span>{scene.figure.label}</span>
              </>
            ) : officer ? (
              <>
                <strong>{officer.name}</strong>
                <span>{STATION_LABELS[officer.role]}</span>
              </>
            ) : (
              <strong>Contact log</strong>
            )}
          </div>
          <p className="scene-line">{current.text}</p>
        </div>
      </div>

      <div className="scene-footer" onClick={(event) => event.stopPropagation()}>
        {!atLastBeat ? (
          <button className="scene-advance" onClick={() => setBeat((b) => b + 1)}>
            Continue <span>›</span>
          </button>
        ) : (
          <div className="scene-options">
            {scene.options.map((option) => {
              const blocked = disabledReason(option)
              return (
                <button
                  key={option.id}
                  className="scene-option"
                  disabled={blocked !== null}
                  onClick={() => choose(option)}
                >
                  <strong>{option.label}</strong>
                  {(blocked ?? option.detail) && <small>{blocked ?? option.detail}</small>}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
