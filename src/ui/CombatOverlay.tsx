import { useMemo, useState } from 'react'
import {
  EVADE_CHANCE,
  EVADE_CLEAN_DRIVE_BONUS,
  FLEE_CHANCE,
  FLEE_SHIELDS_BONUS,
  hasIntelOn,
  HULL_MAX,
  playerDamage,
} from '../engine/combat/combat.js'
import { GalaxyIndex } from '../engine/worldgen/index-galaxy.js'
import { useDispatch, useGame } from './store.js'

/**
 * The interception. Fully legible: every chance the dice will use is
 * printed on the button that rolls it, and the intelligence that opens the
 * bloodless endings is called out when the player holds it.
 */
export function CombatOverlay() {
  const combat = useGame((s) => s.state.combat)
  const state = useGame((s) => s.state)
  const dispatch = useDispatch()
  const [power, setPower] = useState<'guns' | 'shields'>('guns')

  const index = useMemo(() => new GalaxyIndex(state.galaxy), [state.galaxy])
  if (!combat) return null

  const intel = hasIntelOn(state, index, combat.enemy.faction)
  const volley = playerDamage(state, state.roster)
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
          <span className="combat-round">{combat.phase === 'battle' ? `round ${combat.round + 1}` : 'contact'}</span>
        </div>

        <div className="combat-bars">
          <HullBar label="Indefatigable" value={state.ship.hull} max={HULL_MAX} tone="amber" />
          <HullBar label={combat.enemy.faction ? 'Patrol cutter' : 'Raider'} value={combat.enemy.hull} max={combat.enemy.hullMax} tone="alarm" />
        </div>

        {latest && <p className="combat-log">{latest.text}</p>}

        {intel && combat.phase !== 'battle' && (
          <p className="combat-intel">
            You hold collected evidence out of their own space. That is leverage — a hail may end
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
              detail={`${Math.round((EVADE_CHANCE + (state.driveScarred ? 0 : EVADE_CLEAN_DRIVE_BONUS)) * 100)}% to slip away${state.driveScarred ? ' (the scarred drive slows us)' : ''}`}
              onClick={() => dispatch({ type: 'combatContact', choice: 'evade' })}
            />
            <CombatButton
              label="Engage"
              detail={`Open fire first — ${volley} damage per volley`}
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

        {combat.phase === 'battle' && (
          <>
            <div className="combat-power">
              <span>Reactor</span>
              <button className={power === 'guns' ? 'is-active' : ''} onClick={() => setPower('guns')}>
                Guns — full volley ({volley}), full exposure
              </button>
              <button className={power === 'shields' ? 'is-active' : ''} onClick={() => setPower('shields')}>
                Shields — {Math.round(volley * 0.6)} volley, half the damage taken
              </button>
            </div>
            <div className="combat-actions">
              <CombatButton
                label="Fire"
                detail={`${power === 'shields' ? Math.round(volley * 0.6) : volley} damage · they answer with ${power === 'shields' ? Math.ceil(combat.enemy.guns / 2) : combat.enemy.guns}`}
                onClick={() => dispatch({ type: 'combatRound', power, intent: 'fire' })}
              />
              <CombatButton
                label="Break off"
                detail={`${Math.round((FLEE_CHANCE + (power === 'shields' ? FLEE_SHIELDS_BONUS : 0)) * 100)}% to escape · a failed break still costs a volley`}
                onClick={() => dispatch({ type: 'combatRound', power, intent: 'flee' })}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function HullBar({ label, value, max, tone }: { label: string; value: number; max: number; tone: 'amber' | 'alarm' }) {
  return (
    <div className={`hull-bar tone-${tone}`}>
      <span>{label}</span>
      <div><i style={{ width: `${Math.max(0, (value / max) * 100)}%` }} /></div>
      <small>{value}/{max}</small>
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
