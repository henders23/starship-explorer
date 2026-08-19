import { useMemo } from 'react'
import {
  enemyClass,
  EVADE_CHANCE,
  EVADE_CLEAN_DRIVE_BONUS,
  hasIntelOn,
} from '../engine/combat/combat.js'
import { GalaxyIndex } from '../engine/worldgen/index-galaxy.js'
import { BattleScreen } from './BattleScreen.js'
import { useDispatch, useGame } from './store.js'

/**
 * The interception. Contact and toll play as dialogue with the odds printed
 * on the buttons; choosing battle hands over to the FTL-style simulation.
 */
export function CombatOverlay() {
  const combat = useGame((s) => s.state.combat)
  const state = useGame((s) => s.state)
  const dispatch = useDispatch()

  const index = useMemo(() => new GalaxyIndex(state.galaxy), [state.galaxy])
  if (!combat) return null

  if (combat.phase === 'battle') {
    return <BattleScreen key={state.combats} />
  }

  const cls = enemyClass(combat.enemy)
  const intel = hasIntelOn(state, index, combat.enemy.faction)
  const systemName = state.galaxy.systems.find((s) => s.id === combat.at)?.name ?? combat.at
  const latest = state.log[state.log.length - 1]

  return (
    <div className="combat-overlay">
      <div className="combat-veil" aria-hidden="true" />
      <div className="combat-frame panel-glass">
        <div className="combat-heading">
          <div>
            <div className="eyebrow">{systemName} · intercept</div>
            <h2>{combat.enemy.name}</h2>
          </div>
          <span className="combat-round">contact</span>
        </div>

        <div className="contact-visual">
          <img src={cls.sprite} alt="" draggable={false} />
          <div className="contact-stats">
            <span>hull {cls.hull}</span>
            <span>shields {cls.shields > 0 ? `${cls.shields} ${cls.shields === 1 ? 'layer' : 'layers'}` : 'none'}</span>
            <span>{cls.guns.map((g) => g.label.toLowerCase()).join(' · ')}</span>
          </div>
        </div>

        {latest && <p className="combat-log">{latest.text}</p>}

        {intel && (
          <p className="combat-intel">
            You hold collected evidence out of their own space. That is leverage — a hail ends
            this without a shot.
          </p>
        )}

        {combat.phase === 'contact' && (
          <div className="combat-actions">
            <CombatButton
              label="Hail them"
              detail={intel ? 'They will stand down — you know too much about them' : 'They may demand a toll, or answer with fire'}
              onClick={() => dispatch({ type: 'combatContact', choice: 'hail' })}
            />
            <CombatButton
              label="Evade"
              detail={`${Math.round((EVADE_CHANCE + (state.driveScarred ? 0 : EVADE_CLEAN_DRIVE_BONUS)) * 100)}% to slip away${state.driveScarred ? ' (the scarred drive slows us)' : ''} — fail, and it comes to battle`}
              onClick={() => dispatch({ type: 'combatContact', choice: 'evade' })}
            />
            <CombatButton
              label="Engage"
              detail="Battle stations — rooms, reactor and guns are yours"
              onClick={() => dispatch({ type: 'combatContact', choice: 'engage' })}
            />
          </div>
        )}

        {combat.phase === 'toll' && (
          <div className="combat-actions">
            <CombatButton
              label={`Pay the toll — ${combat.toll} fuel`}
              detail={state.ship.fuel <= combat.toll ? 'The tank cannot spare it' : 'They open the lane and leave'}
              disabled={state.ship.fuel <= combat.toll}
              onClick={() => dispatch({ type: 'combatToll', pay: true })}
            />
            <CombatButton
              label="Refuse"
              detail="They will open fire"
              onClick={() => dispatch({ type: 'combatToll', pay: false })}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function CombatButton({
  label,
  detail,
  disabled,
  onClick,
}: {
  label: string
  detail: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button className="scene-option" disabled={disabled} onClick={onClick}>
      <strong>{label}</strong>
      <small>{detail}</small>
    </button>
  )
}
