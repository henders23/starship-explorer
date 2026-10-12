import { useEffect, useRef, useState } from 'react'
import type { Campaign, CampaignAction } from '../engine/exploration/campaign.js'
import { actionLock } from '../engine/exploration/campaign.js'
import { assignedPower, effectiveRoom, escortClass, evadeChance, REACTOR_POWER, SHIP_ROOMS, shieldCapacity, surrenderAvailable, weaponPower } from '../engine/exploration/ship-battle.js'
import type { ShipBattle, ShipOrder } from '../engine/exploration/ship-battle.js'
import { ENEMY_LAYOUTS, SHIP_BY_ID } from '../engine/combat/ships.js'
import { contactArtForClass } from './ship-contact-art.js'
import type { EnemyRoomKey } from '../engine/combat/ships.js'
import './ship-battle.css'

export function EscortOffer({ state, locationId, dispatch }: { state: Campaign; locationId: string; dispatch: (a: CampaignAction) => void }) {
  const station = state.world.locations.find((s) => s.id === locationId)!
  const cls = escortClass(state.seed, station.id, station.threat)
  const action: CampaignAction = { type: 'escort', locationId }
  const lock = actionLock(state, action)
  return <div className="escort-offer"><span className="exp-eyebrow">OPTIONAL / SURVEY ESCORT</span><h3>A tender needs a clear lane.</h3>
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
  if (b.phase === 'contact') return <main className="exp-deck ship-contact"><section className="ship-contact-frame">
    <div className="ship-contact-art"><img className="reconstructed" data-testid="contact-recon-art" src={contactArtForClass(cls.id,cls.sprite)} alt={'Top-down sensor reconstruction of '+cls.name} /><span>SENSOR RECONSTRUCTION / {cls.layout.toUpperCase()} HULL</span></div>
    <div className="ship-contact-copy"><span className="exp-eyebrow">STATION SURVEY ESCORT / INTERCEPTION</span><h1>A ship across our bow.</h1><h2>{cls.name}</h2>
      <div className="ship-contact-stats"><span><b>{cls.hull}</b>hull</span><span><b>{cls.shields}</b>shield layers</span><span><b>{cls.evade}%</b>evasion</span></div>
      <p>The tender’s captain keeps her voice level. “We can wait at the station. But if you’re taking us out, I need to know you can get us through.”</p>
      <p>Weapons identified: {cls.guns.map((g) => g.label.toLowerCase()).join(', ')}. The Ithaca has {b.hull}/{b.hullMax} hull. The station supplies four missiles for this escort; unused ordnance is returned afterward.</p>
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
    return <main className="exp-deck ship-report"><section className="exp-modal exp-ending"><span className="exp-eyebrow">ESCORT REPORT / {b.time} COMBAT SECONDS</span><h2>{title}</h2>
      <p>{b.log.at(-1)}</p><div className="exp-ending-stats"><span><b>{b.hull}</b>hull remaining</span><span><b>{success ? b.result === 'victory' ? 12 : 6 : 0}</b>materials earned</span><span><b>{success ? b.result === 'victory' ? 35 : 18 : 0}</b>credits earned</span></div>
      <p>{b.result === 'disabled' ? 'Emergency recovery takes three days and costs up to 8 materials and 20 credits from your stores. Station survey contracts can fund repairs; the voyage can continue.' : b.result === 'cancelled' ? 'The tender stays at the station. No campaign time passes, and you can reconsider later.' : success ? 'The station pays once when you acknowledge this report. One campaign day passes. The laboratory continues its work.' : 'One campaign day passes. The escort can be attempted again; hull damage remains.'}</p>
      <button className="exp-button primary" onClick={() => dispatch({ type: 'ship-debrief' })}>Acknowledge escort report</button><small>{saved ? 'Report saved' : 'Autosave unavailable'}</small>
    </section></main>
  }
  const activeWeapon = b.weapons[selectedWeapon]!
  return <main className="exp-deck space-battle">
    <header className="space-header"><div><span className="exp-eyebrow">ISS ITHACA / BATTLE STATIONS</span><h1>Keep the tender behind us.</h1><small>{cls.name} · {b.time}s elapsed · {saved ? 'Orders saved' : 'Autosave unavailable'}</small></div>
      <div className="space-clock"><span className={running ? 'live' : ''}>{running ? 'LIVE' : 'PAUSED'}</span><button className="exp-button primary" onClick={() => setRunning(!running)}>{running ? 'Pause battle' : 'Resume battle'}</button><button className="exp-button" disabled={running} onClick={() => order({ type: 'advance', seconds: 1 })}>Advance 1 second</button><button className="exp-button" onClick={() => { setRunning(false); onExit() }}>Save & title</button></div>
    </header>
    <div className="space-guidance"><span>{running ? 'Orders take effect while the clock runs. Pause whenever you need.' : 'Clock stopped. Set targets and power, then resume or advance one second.'}</span>{b.escape && <strong>ESCAPE {Math.floor(b.escapeWork * 10)}% · engines need power</strong>}{button({ type: 'retreat', active: !b.escape }, b.escape ? 'Cancel retreat' : 'Charge retreat · engines required')}</div>
    {surrender && <div className="space-surrender"><p>Their hull is failing. The translator relays an offer to stand down.</p>{button({ type: 'accept-surrender' }, 'Accept surrender', true)}</div>}
    <section className="space-arena" aria-label="Ship battle area">
      <article className="space-ship friendly"><ShipReadout name="ISS Ithaca" hull={b.hull} max={b.hullMax} shields={b.shield} capacity={shieldCapacity(b)} />
        <div className="space-hull own"><img src="/assets/ships/indefatigable-combat.png" alt="Ithaca compartment cutaway" />{b.shield > 0 && <div className="space-shield" aria-hidden="true" />}
          {SHIP_ROOMS.map((key) => <Room key={key} b={b} side="player" room={key} selected={b.repair === key} onClick={() => order({ type: 'repair', room: key })} />)}
        </div><p className="space-caption">Select an Ithaca compartment to assign repairs. One point restored every six seconds. Hull repairs require a station.</p>
      </article>
      <div className="space-versus"><span>ESCORT<br/>CORRIDOR</span><b>◇</b><small>{running ? 'LIVE FIRE' : 'TACTICAL PAUSE'}</small></div>
      <article className="space-ship hostile"><ShipReadout name={cls.name} hull={b.enemy.hull} max={b.enemy.maxHull} shields={b.enemy.shield} capacity={cls.shields} />
        <div className="space-hull enemy"><img src={cls.sprite} alt={cls.name} />{b.enemy.shield > 0 && <div className="space-shield" aria-hidden="true" />}
          {SHIP_ROOMS.map((key) => <Room key={key} b={b} side="enemy" room={key} selected={activeWeapon.target === key} onClick={() => order({ type: 'target', index: selectedWeapon, room: key })} />)}
        </div><p className="space-caption">Selected: {activeWeapon.name} → {activeWeapon.target}. Click an enemy compartment to retarget it.</p>
        <div className="space-enemy-guns">{cls.guns.map((g, i) => <label key={i}>{g.label}<progress value={b.enemy.charges[i]} max={g.time} aria-label={`Enemy ${g.label} charge`} /></label>)}</div>
      </article>
      {b.volley && b.shots > loadedShots.current && <div key={b.shots} className={`space-volley ${b.volley.side} ${b.volley.kind}`} aria-hidden="true"><i/><span>{b.volley.hit ? b.volley.damage ? `−${b.volley.damage} / ${b.volley.target}` : b.volley.kind === 'ion' ? 'ION' : 'SHIELD' : 'MISS'}</span></div>}
    </section>
    <div className="space-console"><section className="space-reactor"><div className="space-section-title"><span className="exp-eyebrow">REACTOR / {assignedPower(b)} OF {REACTOR_POWER} ALLOCATED</span><strong>{REACTOR_POWER - assignedPower(b)} spare</strong></div>
      {(['shields', 'engines', 'weapons'] as const).map((system) => <div className="space-power" key={system}><div><strong>{system}</strong><small>{system === 'shields' ? `${shieldCapacity(b)} layers · ${b.upgrades.adaptive ? '1.2×' : '1×'} recovery` : system === 'engines' ? 'More power improves evasion and escape' : `${weaponPower(b)} allocated to active weapons`}</small></div><div>{button({ type: 'power', system, amount: b.power[system] - 1 }, `− ${system}`)}<b>{b.power[system]}</b>{button({ type: 'power', system, amount: b.power[system] + 1 }, `+ ${system}`)}</div></div>)}
      <p>Repair team: <strong>{b.repair}</strong>. Ion disruption temporarily disables a compartment; normal repairs restore damage.</p>
    </section>
    <section className="space-battery"><span className="exp-eyebrow">WEAPON CONTROL / {b.missiles} MISSILES REMAINING</span><div className="space-weapons">{b.weapons.map((w, i) => <article key={w.kind} className={selectedWeapon === i ? 'selected' : ''} aria-label={w.name}>
      <button className="space-weapon-title" aria-pressed={selectedWeapon === i} onClick={() => setWeapon(i)}>{w.name}<span>{w.cost} POWER</span></button><small>{w.kind === 'ion' ? 'Strips shields / 6s system disruption' : w.kind === 'beam' ? '3 damage / ignores evade / shields block' : w.kind === 'missile' ? '2 damage / bypasses shields / uses ammo' : 'Two shots / 1 damage each'}<br/>Target: {w.target}</small>
      <progress value={w.charge} max={w.period} aria-label={`${w.name} charge`} /><div className="space-weapon-meta"><span>{w.charge >= w.period ? 'READY' : `${Math.floor(w.charge * 100 / w.period)}%`}</span><span>{effectiveRoom(b, 'player', 'weapons') === 0 ? 'COMPARTMENT DISABLED' : w.mode.toUpperCase()}</span></div>
      <div className="space-modes">{(['off', 'hold', 'auto'] as const).map((mode) => <button key={mode} aria-pressed={w.mode === mode} disabled={!!actionLock(state, { type: 'ship-order', order: { type: 'weapon', index: i, mode } })} onClick={() => order({ type: 'weapon', index: i, mode })}>{mode}</button>)}</div>
      {button({ type: 'fire', index: i }, 'Fire now', true)}
    </article>)}</div><p>Auto fires at the selected room when charged. Hold keeps a full charge for manual fire. Off frees weapon power and discards the charge.</p></section></div>
    <footer className="space-log" aria-live={running ? 'off' : 'polite'}><span className="exp-eyebrow">BRIDGE CHANNEL</span>{b.log.slice(-4).map((line, i) => <p key={i}>{line}</p>)}<details><summary>Earlier battle orders</summary>{b.log.slice(0, -4).map((line, i) => <p key={i}>{line}</p>)}</details></footer>
  </main>
}
function ShipReadout({ name, hull, max, shields, capacity }: { name: string; hull: number; max: number; shields: number; capacity: number }) {
  return <div className="space-readout"><h2>{name}</h2><div><label>HULL <b>{hull}/{max}</b></label><progress value={hull} max={max} aria-label={`${name} hull`} /><span>SHIELDS {shields}/{capacity}</span></div></div>
}
function Room({ b, side, room, selected, onClick }: { b: ShipBattle; side: 'player' | 'enemy'; room: EnemyRoomKey; selected: boolean; onClick: () => void }) {
  const box = side === 'player' ? OWN_ROOMS[room] : ENEMY_LAYOUTS[SHIP_BY_ID[b.classId]!.layout][room]
  const r = side === 'player' ? b.rooms[room] : b.enemy.rooms[room]
  const ion = r.ionUntil > b.time
  return <button className={`space-room ${selected ? 'selected' : ''} ${r.hp === 0 ? 'disabled-room' : ''} ${ion ? 'ionised' : ''}`} style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%` }}
    aria-label={`${side === 'player' ? 'Repair' : 'Target'} ${room}`} aria-pressed={selected} title={ROOM_EFFECT[room]} onClick={onClick}><strong>{room}</strong><span>{ion ? `ION ${r.ionUntil - b.time}s` : `${r.hp}/${r.max}`}</span></button>
}
