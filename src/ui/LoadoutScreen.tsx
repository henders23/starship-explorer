import { useMemo, useState } from 'react'
import type { Officer } from '../engine/crew/types.js'
import {
  defaultLoadouts,
  GEAR,
  GEAR_BY_ID,
  gearGuard,
  loadoutMass,
  type ApproachStyle,
  type GearItem,
  type GearSlot,
} from '../engine/missions/gear.js'
import { useDispatch, useGame } from './store.js'

/**
 * The equipment locker. Everything on this screen is engine state: what is
 * issued here is what `approachOdds` and the harm rules read when a team
 * goes down, and the effect lines are the rules themselves.
 */

const SLOT_LABELS: Record<GearSlot, string> = {
  primary: 'Primary weapon',
  armour: 'Armour system',
  equipment: 'Field equipment',
}

const SLOTS = Object.keys(SLOT_LABELS) as GearSlot[]

const STYLE_LABELS: Record<ApproachStyle, string> = {
  force: 'Direct approaches',
  tactical: 'Tactical approaches',
  finesse: 'Finesse approaches',
}

export function LoadoutScreen() {
  const roster = useGame((s) => s.state.roster)
  const pools = useGame((s) => s.state.pools)
  const loadouts = useGame((s) => s.state.loadouts)
  const dispatch = useDispatch()
  const [selectedRole, setSelectedRole] = useState(roster[0]?.role ?? 'captain')
  const [slot, setSlot] = useState<GearSlot>('primary')
  const [notice, setNotice] = useState('Locker manifest synchronised')

  const officer = roster.find((entry) => entry.role === selectedRole) ?? roster[0]!
  const assigned = loadouts[officer.role]
  const equipped = (target: GearSlot) => GEAR_BY_ID[assigned[target]]!
  const mass = loadoutMass(assigned)
  const guard = gearGuard(loadouts, officer.role)
  const ready = roster.filter((entry) => entry.status === 'fit').length
  const options = useMemo(() => GEAR.filter((item) => item.slot === slot), [slot])

  // The officer's whole kit, summed per approach style — the same numbers
  // gearCleanBonus feeds into the mission odds when they are on the team.
  const styleBonus = (style: ApproachStyle) =>
    SLOTS.reduce((sum, target) => sum + equipped(target).clean[style], 0)

  const equip = (item: GearItem) => {
    dispatch({ type: 'equip', role: officer.role, slot, item: item.id })
    setNotice(`${item.name} issued to ${officer.name}`)
  }

  const restoreStandard = () => {
    // Re-issue standard kit through the reducer so the engine stays the
    // single source of truth; already-standard slots no-op harmlessly.
    const standard = defaultLoadouts()
    for (const entry of roster) {
      for (const target of SLOTS) {
        dispatch({ type: 'equip', role: entry.role, slot: target, item: standard[entry.role][target] })
      }
    }
    setNotice('Standard issue restored')
  }

  return (
    <div className="loadout-screen h-full overflow-y-auto">
      <header className="screen-titlebar">
        <div>
          <div className="eyebrow">Away mission operations</div>
          <h2>Expedition Loadout</h2>
          <p>What is issued here is what the mission odds and the injury rolls read.</p>
        </div>
        <div className="mission-readiness">
          <span>Team readiness</span>
          <strong>{Math.round((ready / roster.length) * 100)}%</strong>
          <small>{ready}/{roster.length} officers fit · {pools.security} security available</small>
        </div>
      </header>

      <div className="loadout-layout">
        <aside className="roster-rail">
          <div className="panel-heading"><span>Crew roster</span><span>{roster.length} officers</span></div>
          {roster.map((entry) => (
            <CrewCard
              key={entry.role}
              officer={entry}
              active={entry.role === selectedRole}
              onClick={() => setSelectedRole(entry.role)}
            />
          ))}
          <div className="generic-pool">
            <span>SEC</span>
            <strong>{pools.security}</strong>
            <small>Security detachment</small>
          </div>
        </aside>

        <main className="loadout-workbench">
          <div className="operator-header">
            <div className={`operator-silhouette operator-${officer.role}`}>
              <span>{officer.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span>
            </div>
            <div>
              <div className="eyebrow">{officer.role} officer · skill {officer.skill}</div>
              <h3>{officer.name}</h3>
              <p>{officer.status === 'fit' ? 'Cleared for surface deployment' : `Unavailable · ${officer.status}`}</p>
            </div>
            <div className="mass-readout"><span>Carry mass</span><strong>{mass.toFixed(1)} kg</strong><small>30.0 kg limit</small></div>
          </div>

          <div className="equipped-grid">
            {SLOTS.map((target, index) => {
              const item = equipped(target)
              return (
                <button
                  key={target}
                  onClick={() => setSlot(target)}
                  className={`gear-slot ${slot === target ? 'is-active' : ''}`}
                >
                  <span className="slot-number">0{index + 1}</span>
                  <span className="gear-icon">{item.mark}</span>
                  <span className="slot-copy">
                    <small>{SLOT_LABELS[target]}</small>
                    <strong>{item.name}</strong>
                    <em>{item.effect}</em>
                  </span>
                  <span className="slot-mass">{item.mass.toFixed(1)} kg</span>
                </button>
              )
            })}
          </div>

          <section className="locker-section">
            <div className="locker-heading">
              <span>Equipment locker · {SLOT_LABELS[slot]}</span>
              <small>{options.length} compatible items</small>
            </div>
            <div className="locker-grid">
              {options.map((item) => (
                <button
                  key={item.id}
                  className={`locker-item ${assigned[slot] === item.id ? 'is-equipped' : ''}`}
                  onClick={() => equip(item)}
                >
                  <span className="locker-mark">{item.mark}</span>
                  <span><strong>{item.name}</strong><small>{item.effect}</small><em>{item.risk}</em></span>
                  <span className="locker-mass">{item.mass.toFixed(1)} kg</span>
                </button>
              ))}
            </div>
          </section>
        </main>

        <aside className="loadout-summary">
          <div className="panel-heading"><span>Kit effect</span><span>{officer.role}</span></div>
          <div className="readiness-ring" style={{ '--readiness': `${Math.min(100, Math.round((guard / 15) * 100))}%` } as React.CSSProperties}>
            <strong>−{guard}%</strong>
            <span>injury chance</span>
          </div>
          {(Object.keys(STYLE_LABELS) as ApproachStyle[]).map((style) => (
            <div className="summary-stat" key={style}>
              <span>{STYLE_LABELS[style]}</span>
              <strong>{styleBonus(style) >= 0 ? '+' : ''}{styleBonus(style)} clean</strong>
            </div>
          ))}
          {SLOTS.some((target) => equipped(target).medkit) && (
            <div className="summary-stat"><span>Trauma kit</span><strong>1 injury negated</strong></div>
          )}
          <p className="loadout-notice">{notice}</p>
          <button
            className="primary-action"
            onClick={() => window.dispatchEvent(new CustomEvent('starship:navigate', { detail: 'galaxy' }))}
          >
            To the star chart <span>›</span>
          </button>
          <button className="secondary-action" onClick={restoreStandard}>
            Restore standard issue
          </button>
        </aside>
      </div>
    </div>
  )
}

function CrewCard({ officer, active, onClick }: { officer: Officer; active: boolean; onClick: () => void }) {
  const initials = officer.name.split(' ').map((part) => part[0]).join('').slice(0, 2)
  return (
    <button className={`crew-card ${active ? 'is-active' : ''}`} onClick={onClick}>
      <span className={`crew-avatar avatar-${officer.role}`}>
        {officer.portrait ? <img src={officer.portrait} alt="" /> : initials}
      </span>
      <span><strong>{officer.name}</strong><small>{officer.role} officer</small></span>
      <span className={`crew-state state-${officer.status}`}>{officer.status}</span>
    </button>
  )
}
