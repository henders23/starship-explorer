import { useMemo, useState } from 'react'
import type { Officer } from '../engine/crew/types.js'
import { useGame } from './store.js'

type Slot = 'primary' | 'armour' | 'equipment'

interface GearItem {
  id: string
  name: string
  slot: Slot
  mark: string
  effect: string
  mass: number
  risk: string
}

const GEAR: GearItem[] = [
  { id: 'pulse', name: 'M-9 Pulse Carbine', slot: 'primary', mark: 'M9', effect: '+12 clean outcome', mass: 4.8, risk: 'Medium range' },
  { id: 'scatter', name: 'Kestrel Scattergun', slot: 'primary', mark: 'SG', effect: '+18 breach outcome', mass: 6.1, risk: 'Close range' },
  { id: 'stunner', name: 'Vektor Arc Projector', slot: 'primary', mark: 'AP', effect: '+16 capture outcome', mass: 5.4, risk: 'Non-lethal' },
  { id: 'hardsuit', name: 'Aegis Mk III Hardsuit', slot: 'armour', mark: 'A3', effect: '−24 injury chance', mass: 12.6, risk: 'Sealed' },
  { id: 'scout', name: 'Pathfinder Flexweave', slot: 'armour', mark: 'PF', effect: '−10 injury · +8 speed', mass: 6.2, risk: 'Mobile' },
  { id: 'hazmat', name: 'Sable Environment Rig', slot: 'armour', mark: 'ER', effect: 'Immune to exposure', mass: 9.7, risk: 'Hazard rated' },
  { id: 'scanner', name: 'Tarsis Field Scanner', slot: 'equipment', mark: 'FS', effect: '+22 science approach', mass: 2.1, risk: '8 hour cell' },
  { id: 'medkit', name: 'Trauma Foam Kit', slot: 'equipment', mark: 'TK', effect: 'First injury ignored', mass: 1.8, risk: 'Single use' },
  { id: 'drone', name: 'Firefly Survey Drone', slot: 'equipment', mark: 'SD', effect: '+12 clean · reveals traps', mass: 3.4, risk: 'Autonomous' },
]

const DEFAULTS: Record<string, Record<Slot, string>> = {
  captain: { primary: 'pulse', armour: 'hardsuit', equipment: 'scanner' },
  security: { primary: 'scatter', armour: 'hardsuit', equipment: 'drone' },
  science: { primary: 'stunner', armour: 'scout', equipment: 'scanner' },
  medical: { primary: 'stunner', armour: 'hazmat', equipment: 'medkit' },
}

const SLOT_LABELS: Record<Slot, string> = {
  primary: 'Primary weapon',
  armour: 'Armour system',
  equipment: 'Field equipment',
}

export function LoadoutScreen() {
  const roster = useGame((s) => s.state.roster)
  const pools = useGame((s) => s.state.pools)
  const morale = useGame((s) => s.state.morale)
  const [selectedRole, setSelectedRole] = useState(roster[0]?.role ?? 'captain')
  const [loadouts, setLoadouts] = useState(DEFAULTS)
  const [slot, setSlot] = useState<Slot>('primary')
  const [notice, setNotice] = useState('Locker manifest synchronised')

  const officer = roster.find((entry) => entry.role === selectedRole) ?? roster[0]!
  const assigned = loadouts[selectedRole] ?? DEFAULTS.captain!
  const equipped = (target: Slot) => GEAR.find((item) => item.id === assigned[target])!
  const mass = (Object.keys(SLOT_LABELS) as Slot[]).reduce((sum, target) => sum + equipped(target).mass, 0)
  const ready = roster.filter((entry) => entry.status === 'fit').length
  const options = useMemo(() => GEAR.filter((item) => item.slot === slot), [slot])

  const equip = (item: GearItem) => {
    setLoadouts((current) => ({
      ...current,
      [selectedRole]: { ...(current[selectedRole] ?? DEFAULTS.captain!), [slot]: item.id },
    }))
    setNotice(`${item.name} issued to ${officer.name}`)
  }

  return (
    <div className="loadout-screen h-full overflow-y-auto">
      <header className="screen-titlebar">
        <div>
          <div className="eyebrow">Away mission operations</div>
          <h2>Expedition Loadout</h2>
          <p>Issue weapons, armour and specialist equipment before deployment.</p>
        </div>
        <div className="mission-readiness">
          <span>Team readiness</span>
          <strong>{Math.round(((ready * 18 + morale) / (roster.length * 18 + 100)) * 100)}%</strong>
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
            {(Object.keys(SLOT_LABELS) as Slot[]).map((target, index) => {
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
          <div className="panel-heading"><span>Mission package</span><span>Draft</span></div>
          <div className="readiness-ring" style={{ '--readiness': `${Math.min(100, 70 + officer.skill * 6)}%` } as React.CSSProperties}>
            <strong>{70 + officer.skill * 6}%</strong>
            <span>projected readiness</span>
          </div>
          <div className="summary-stat"><span>Protection</span><strong>Class III</strong></div>
          <div className="summary-stat"><span>Firepower</span><strong>7.4 kJ</strong></div>
          <div className="summary-stat"><span>Field utility</span><strong>{equipped('equipment').mark}</strong></div>
          <p className="loadout-notice">{notice}</p>
          <button className="primary-action" disabled={officer.status !== 'fit'} onClick={() => setNotice('Loadout locked · shuttle crew notified')}>
            Confirm loadout <span>›</span>
          </button>
          <button className="secondary-action" onClick={() => { setLoadouts(DEFAULTS); setNotice('Standard issue restored') }}>
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
