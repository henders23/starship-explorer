import { useEffect, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import type { Campaign, CampaignAction } from '../engine/exploration/campaign.js'
import { actionLock } from '../engine/exploration/campaign.js'
import { assignedPower, effectiveRoom, escortClass, evadeChance, REACTOR_POWER, SHIP_ROOMS, shieldCapacity, surrenderAvailable, weaponPower } from '../engine/exploration/ship-battle.js'
import type { ShipBattle, ShipOrder } from '../engine/exploration/ship-battle.js'
import { ENEMY_LAYOUTS, SHIP_BY_ID } from '../engine/combat/ships.js'
import { contactArtForClass } from './ship-contact-art.js'
import type { EnemyRoomKey } from '../engine/combat/ships.js'
import './ship-battle.css'
import { CrewLine } from './crew-presence.js'
import { MuteButton } from './sound.js'

export function EscortOffer({ state, locationId, dispatch }: { state: Campaign; locationId: string; dispatch: (a: CampaignAction) => void }) {
  const station = state.world.locations.find((s) => s.id === locationId)!
  const cls = escortClass(state.seed, station.id, station.threat)
  const action: CampaignAction = { type: 'escort', locationId }
  const lock = actionLock(state, action)
  return <div className="escort-offer"><span className="exp-eyebrow">Optional / survey escort</span><h3>A tender needs a clear lane.</h3>
    <p>Reported contact: {cls.name} · {cls.hull} hull · {cls.shields} shields. Negotiate, slip past or fight. Your ship’s damage persists.</p>
    <p>One-time payment: 12 materials + 35 credits for victory, or 6 + 18 for a peaceful passage. You can review the contact and decline.</p>
    <button className="exp-button" disabled={!!lock} onClick={() => dispatch(action)}>Review escort contact</button>{lock && <small>{lock}</small>}
  </div>
}
const OWN_ROOMS: Record<EnemyRoomKey, { x: number; y: number; w: number; h: number }> = {
  engines: { x: 9, y: 34, w: 17, h: 31 }, shields: { x: 28, y: 34, w: 16, h: 31 }, weapons: { x: 47, y: 34, w: 17, h: 31 }, helm: { x: 73, y: 34, w: 18, h: 31 },
}
const ROOM_EFFECT: Record<EnemyRoomKey, string> = { helm: 'Controls evasion', weapons: 'Damage slows all weapon charging', shields: 'Damage reduces shield capacity', engines: 'Controls evasion and escape charging' }
export function ExplorationBattle({ state, dispatch, saved, onExit }: { state: Campaign; dispatch: (a: CampaignAction) => void; saved: boolean; onExit: () => void }) {
  const b = state.shipBattle!, cls = SHIP_BY_ID[b.classId]!
  const [running, setRunning] = useState(false)
  const [selectedWeapon, setWeapon] = useState(0)
  const [repairing, setRepairing] = useState<{ origin: { x: number; y: number }; cursor: { x: number; y: number } } | null>(null)
  const friendly = useRef<HTMLElement>(null)
  const repairButton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!repairing) return
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') setRepairing(null) }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [repairing])
  const loadedShots = useRef(b.shots)
  const bridgeDispatch = useRef(dispatch); bridgeDispatch.current = dispatch
  const surrenderSeen = useRef(false)
  const surrender = surrenderAvailable(b)
  useEffect(() => {
    if (!running || b.phase !== 'battle') return
    const clock = window.setInterval(() => {
      if (!document.hidden) bridgeDispatch.current({ type: 'ship-order', order: { type: 'advance', seconds: 1 } })
    }, 1000)
    return () => window.clearInterval(clock)
  }, [running, b.phase])
  useEffect(() => {
    const hide = () => { if (document.hidden) setRunning(false) }
    document.addEventListener('visibilitychange', hide)
    return () => document.removeEventListener('visibilitychange', hide)
  }, [])
  useEffect(() => { if (surrender && !surrenderSeen.current) { setRunning(false); surrenderSeen.current = true } }, [surrender])
  const order = (a: ShipOrder) => dispatch({ type: 'ship-order', order: a })
  const button = (a: ShipOrder, label: string, primary = false) => {
    const lock = actionLock(state, { type: 'ship-order', order: a })
    return <button className={`exp-button ${primary ? 'primary' : ''}`} disabled={!!lock} title={lock ?? undefined} onClick={() => order(a)}>{label}</button>
  }
  const powerButton = (system: 'shields' | 'engines' | 'weapons', step: number) => {
    const a: ShipOrder = { type: 'power', system, amount: b.power[system] + step }, lock = actionLock(state, { type: 'ship-order', order: a })
    return <button className="exp-button space-pw" disabled={!!lock} title={lock ?? undefined} aria-label={`${step < 0 ? 'Decrease' : 'Increase'} ${system} power`} onClick={() => order(a)}>{step < 0 ? '−' : '+'}</button>
  }
  if (b.phase === 'contact') return <main className="exp-deck ship-contact"><section className="ship-contact-frame">
    <div className="ship-contact-art"><img className="reconstructed" data-testid="contact-recon-art" src={contactArtForClass(cls.id,cls.sprite)} alt={'Top-down sensor reconstruction of '+cls.name} /><span>SENSOR RECONSTRUCTION / {cls.layout.toUpperCase()} HULL</span></div>
    <div className="ship-contact-copy"><span className="exp-eyebrow">Survey escort / interception</span><h1>A ship across our bow.</h1><h2>{cls.name}</h2>
      <CrewLine person="cross" compact>We can talk, slip past, or fight. Their systems tell us what a fight would cost.</CrewLine>
      <div className="ship-contact-stats"><span><b>{cls.hull}</b>hull</span><span><b>{cls.shields}</b>shield layers</span><span><b>{cls.evade}%</b>evasion</span></div>
      <p>The tender’s captain keeps her voice level. “We can wait at the station. But if you’re taking us out, I need to know you can get us through.”</p>
      <p>Weapons identified: {cls.guns.map((g) => g.label.toLowerCase()).join(', ')}. The Lodestar has {b.hull}/{b.hullMax} hull. The station supplies four missiles for this escort; unused ordnance is returned afterward.</p>
      {b.hailed && <p className="ship-contact-response">{b.log.at(-1)}</p>}
      <div className="ship-contact-options">{button({ type: 'hail' }, 'Hail the contact')}
        {b.hailed && <>{button({ type: 'pay' }, `Pay passage · ${b.toll} credits`)}{b.upgrades.contextual ? button({ type: 'negotiate' }, 'Negotiate passage · no payment', true) : <small>Contextual Translation opens a negotiated passage without a toll.</small>}</>}
        {button({ type: 'evade' }, `Evade with the tender · ${evadeChance(b)}% chance`)}
        <small>A failed evasion begins battle. A successful passage earns 6 materials and 18 credits.</small>
        {button({ type: 'engage' }, 'Engage · enter battle paused', true)}
        {button({ type: 'cancel' }, 'Decline escort · no cost')}
      </div><small>{saved ? 'Contact saved' : 'Autosave unavailable — keep this tab open'}</small>
    </div>
  </section></main>
  if (b.phase === 'report') {
    const title = { victory: 'The lane is clear.', negotiated: 'No shots fired.', evaded: 'A quiet passage.', yielded: 'Weapons standing down.', fled: 'The tender turns back.', disabled: 'A tow back to port.', cancelled: 'Another captain, another day.' }[b.result!]
    const success = ['victory', 'negotiated', 'evaded', 'yielded'].includes(b.result!)
    return <main className="exp-deck ship-report"><section className="exp-modal exp-ending"><span className="exp-eyebrow">Escort report / {b.time} combat seconds</span><h2>{title}</h2>
      <p>{b.log.at(-1)}</p><div className="exp-ending-stats"><span><b>{b.hull}</b>hull remaining</span><span><b>{success ? b.result === 'victory' ? 12 : 6 : 0}</b>materials earned</span><span><b>{success ? b.result === 'victory' ? 35 : 18 : 0}</b>credits earned</span></div>
      <p>{b.result === 'disabled' ? 'Emergency recovery takes three days and costs up to 8 materials and 20 credits from your stores. Station survey contracts can fund repairs; the voyage can continue.' : b.result === 'cancelled' ? 'The tender stays at the station. No campaign time passes, and you can reconsider later.' : success ? 'The station pays once when you acknowledge this report. One campaign day passes. The laboratory continues its work.' : 'One campaign day passes. The escort can be attempted again; hull damage remains.'}</p>
      <button className="exp-button primary" onClick={() => dispatch({ type: 'ship-debrief' })}>Acknowledge escort report</button><small>{saved ? 'Report saved' : 'Autosave unavailable'}</small>
    </section></main>
  }
  const activeWeapon = b.weapons[selectedWeapon]!
  const volley = b.volley && b.shots > loadedShots.current ? b.volley : null
  const startRepair = () => {
    if (repairing) { setRepairing(null); return }
    const button = repairButton.current, area = friendly.current
    if (!button || !area) return
    const a = area.getBoundingClientRect(), r = button.getBoundingClientRect()
    const origin = { x: r.left + r.width / 2 - a.left, y: r.top - a.top }
    setRepairing({ origin, cursor: { x: origin.x, y: origin.y - 80 } })
  }
  const track = (event: MouseEvent<HTMLElement>) => {
    if (!repairing) return
    const a = event.currentTarget.getBoundingClientRect()
    setRepairing({ ...repairing, cursor: { x: event.clientX - a.left, y: event.clientY - a.top } })
  }
  return <main className="exp-deck space-battle">
    <header className="space-header">
      <span className={`space-clock-state ${running ? 'live' : ''}`} role="status">{running ? 'LIVE' : 'PAUSED'} <small>{b.time}s</small></span>
      <button className="exp-button primary" onClick={() => setRunning(!running)}>{running ? 'Pause battle' : 'Resume battle'}</button>
      <button className="exp-button" disabled={running} onClick={() => order({ type: 'advance', seconds: 1 })}>Advance 1 second</button>
      {button({ type: 'retreat', active: !b.escape }, b.escape ? `Cancel retreat · ${Math.floor(b.escapeWork * 10)}% charged` : 'Charge retreat · engines required')}
      <button className="exp-button space-title" onClick={() => { setRunning(false); onExit() }}>Save & title</button>
      <MuteButton icon />
    </header>
    <section className="space-arena" aria-label="Ship battle area">
      {surrender && <div className="space-surrender"><p>Their hull is failing. The translator relays an offer to stand down.</p>{button({ type: 'accept-surrender' }, 'Accept surrender', true)}</div>}
      <article className={`space-ship friendly${repairing ? ' repairing' : ''}`} ref={friendly} onMouseMove={track}>
        <ShipReadout name="ISS Lodestar" hull={b.hull} max={b.hullMax} shields={b.shield} capacity={shieldCapacity(b)} />
        <div className="space-hull own"><img src="/assets/ships/indefatigable-combat.png" alt="Lodestar compartment cutaway" />{b.shield > 0 && <div className="space-shield" aria-hidden="true" />}
          {SHIP_ROOMS.map((key) => <Room key={key} b={b} side="player" room={key} selected={b.repair === key} onClick={() => { order({ type: 'repair', room: key }); setRepairing(null) }} />)}
          {volley?.side === 'enemy' && <Impact key={b.shots} volley={volley} box={OWN_ROOMS[volley.target]} />}
        </div>
        <div className="space-repair">
          <button ref={repairButton} className="exp-button space-repair-button" aria-pressed={!!repairing} onClick={startRepair}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z" /></svg>
            <span>{repairing ? 'Cancel repair' : 'Repair'}</span></button>
          <small role="status">{repairing ? 'Select a compartment to repair' : `Crew repairing ${b.repair}`}</small>
        </div>
        {repairing && <svg className="space-repair-line" aria-hidden="true"><line x1={repairing.origin.x} y1={repairing.origin.y} x2={repairing.cursor.x} y2={repairing.cursor.y} /><circle cx={repairing.origin.x} cy={repairing.origin.y} r={3} className="dot" /><circle cx={repairing.cursor.x} cy={repairing.cursor.y} r={7} /></svg>}
      </article>
      <div className="space-versus" aria-hidden="true"><span>ESCORT<br />CORRIDOR</span>
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#b5a880" strokeWidth="1"><path d="M12 3l9 9-9 9-9-9z" /></svg><small>{running ? 'LIVE FIRE' : 'TACTICAL PAUSE'}</small></div>
      <article className="space-ship hostile"><ShipReadout name={cls.name} hull={b.enemy.hull} max={b.enemy.maxHull} shields={b.enemy.shield} capacity={cls.shields} />
        <div className="space-hull enemy"><img src={cls.sprite} alt={cls.name} />{b.enemy.shield > 0 && <div className="space-shield" aria-hidden="true" />}
          {SHIP_ROOMS.map((key) => <Room key={key} b={b} side="enemy" room={key} selected={activeWeapon.target === key} onClick={() => order({ type: 'target', index: selectedWeapon, room: key })} />)}
          {volley?.side === 'player' && <Impact key={b.shots} volley={volley} box={ENEMY_LAYOUTS[cls.layout][volley.target]} />}
        </div>
        <div className="space-enemy-guns">{cls.guns.map((g, i) => <label key={i}>{g.label}<progress value={b.enemy.charges[i]} max={g.time} aria-label={`Enemy ${g.label} charge`} /></label>)}</div>
      </article>
    </section>
    <div className="space-console">
      <section className="space-reactor" aria-label="Reactor">
        <div className="space-console-label"><span className="exp-eyebrow">Reactor</span><strong>{assignedPower(b)}/{REACTOR_POWER} <span>· {REACTOR_POWER - assignedPower(b)} spare</span></strong></div>
        {(['shields', 'engines', 'weapons'] as const).map((system) => <div className="space-power" key={system} title={system === 'shields' ? `${shieldCapacity(b)} layers · ${b.upgrades.adaptive ? '1.2×' : '1×'} recovery` : system === 'engines' ? 'More power improves evasion and escape' : `${weaponPower(b)} allocated to active weapons`}>
          <span>{system}</span>{powerButton(system, -1)}<b>{b.power[system]}</b>{powerButton(system, 1)}</div>)}
      </section>
      <section className="space-battery" aria-label="Weapon control">
        <div className="space-console-label"><span className="exp-eyebrow">Weapons</span><strong>{b.missiles} {b.missiles === 1 ? 'missile' : 'missiles'}</strong></div>
        {b.weapons.map((w, i) => {
          const ready = w.charge >= w.period, disabled = effectiveRoom(b, 'player', 'weapons') === 0
          return <article key={w.kind} className={selectedWeapon === i ? 'selected' : ''} aria-label={w.name} title={`${WEAPON_NOTES[w.kind]} · Auto fires at the selected room when charged; hold keeps a full charge`}>
            <button className="space-weapon-title" aria-pressed={selectedWeapon === i} onClick={() => setWeapon(i)}>{w.name}<small>{w.cost} power · → {w.target}</small></button>
            <div className="space-charge"><progress value={w.charge} max={w.period} aria-label={`${w.name} charge`} /><small>{disabled ? 'COMPARTMENT DISABLED' : `${ready ? 'READY' : `${Math.floor(w.charge * 100 / w.period)}%`} · ${w.mode.toUpperCase()}`}</small></div>
            <div className="space-modes" role="group" aria-label={`${w.name} mode`}>{(['off', 'hold', 'auto'] as const).map((mode) => <button key={mode} aria-pressed={w.mode === mode} disabled={!!actionLock(state, { type: 'ship-order', order: { type: 'weapon', index: i, mode } })} onClick={() => order({ type: 'weapon', index: i, mode })}>{mode}</button>)}</div>
            {button({ type: 'fire', index: i }, 'Fire', true)}
          </article>
        })}
      </section>
    </div>
  </main>
}
const WEAPON_NOTES: Record<string, string> = { ion: 'Strips shields / 6s system disruption', beam: '3 damage / ignores evade / shields block', missile: '2 damage / bypasses shields / uses ammo', laser: 'Two shots / 1 damage each' }
/** Damage lands where it was aimed, then fades. */
function Impact({ volley, box }: { volley: NonNullable<ShipBattle['volley']>; box: { x: number; y: number; w: number; h: number } }) {
  const x = box.x + box.w / 2, y = box.y + box.h / 2
  const label = volley.hit ? volley.damage ? `−${volley.damage} ${volley.target}` : volley.kind === 'ion' ? 'ION' : 'SHIELD' : 'MISS'
  return <><span className={`space-burst ${volley.hit ? '' : 'miss'}`} aria-hidden="true" style={{ left: `${x}%`, top: `${y}%` }} />
    <span className={`space-hit ${volley.hit ? '' : 'miss'}`} role="status" style={{ left: `${x}%`, top: `${Math.max(0, y - 22)}%` }}>{label}<small>{volley.kind === 'laser' ? 'pulse laser' : volley.kind}</small></span></>
}
function ShipReadout({ name, hull, max, shields, capacity }: { name: string; hull: number; max: number; shields: number; capacity: number }) {
  return <div className="space-readout"><h2>{name}</h2><div><span className="space-hull-label">HULL <b>{hull}/{max}</b></span>
    <span className="space-bar" role="progressbar" aria-label={`${name} hull`} aria-valuemin={0} aria-valuemax={max} aria-valuenow={hull}><i style={{ width: `${Math.max(0, hull) * 100 / max}%` }} /></span><span>SHIELDS {shields}/{capacity}</span></div></div>
}
function Room({ b, side, room, selected, onClick }: { b: ShipBattle; side: 'player' | 'enemy'; room: EnemyRoomKey; selected: boolean; onClick: () => void }) {
  const box = side === 'player' ? OWN_ROOMS[room] : ENEMY_LAYOUTS[SHIP_BY_ID[b.classId]!.layout][room]
  const r = side === 'player' ? b.rooms[room] : b.enemy.rooms[room]
  const ion = r.ionUntil > b.time
  return <button className={`space-room ${selected ? 'selected' : ''} ${r.hp === 0 ? 'disabled-room' : ''} ${ion ? 'ionised' : ''}`} style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%` }}
    aria-label={`${side === 'player' ? 'Repair' : 'Target'} ${room}`} aria-pressed={selected} title={ROOM_EFFECT[room]} onClick={onClick}><strong>{room}</strong><span>{ion ? `ION ${r.ionUntil - b.time}s` : `${r.hp}/${r.max}`}</span></button>
}
