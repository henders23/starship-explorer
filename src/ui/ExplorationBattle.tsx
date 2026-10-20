import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import type { Campaign, CampaignAction } from '../engine/exploration/campaign.js'
import { actionLock, ESCORT_MISSILES, INTERCEPTION_SPOILS, interceptionSpoils } from '../engine/exploration/campaign.js'
import { assignedPower, BATTLE_RULES, burning, CREW_HP, enemyGunEta, fireLock, effectiveRoom, enemyChargeRate, enemyEvasion, escortClass, evadeChance, playerChargeRate, playerEvasion, REACTOR_POWER, SHIP_ROOMS, shieldCapacity, surrenderAvailable, weaponPower } from '../engine/exploration/ship-battle.js'
import type { BattleCrew, BattleEvent, CrewId, Projectile, ShipBattle, ShipBattleResult, ShipOrder, ShipWeaponKind } from '../engine/exploration/ship-battle.js'
import { ENEMY_LAYOUTS, SHIP_BY_ID } from '../engine/combat/ships.js'
import { contactArtForClass } from './ship-contact-art.js'
import type { EnemyRoomKey } from '../engine/combat/ships.js'
import './ship-battle.css'
import { CREW, CrewLine } from './crew-presence.js'
import { MuteButton } from './sound.js'
import { playCombatSound, unlockCombatAudio } from './combat-sfx.js'
import type { CombatSound } from './combat-sfx.js'

export function EscortOffer({ state, locationId, dispatch }: { state: Campaign; locationId: string; dispatch: (a: CampaignAction) => void }) {
  const station = state.world.locations.find((s) => s.id === locationId)!
  const cls = escortClass(state.seed, station.id, station.threat, BATTLE_RULES)
  const action: CampaignAction = { type: 'escort', locationId, rules: BATTLE_RULES }
  const lock = actionLock(state, action)
  return <div className="escort-offer"><span className="exp-eyebrow">Optional / survey escort</span><h3>A tender needs a clear lane.</h3>
    <p>Reported contact: {cls.name} · {cls.hull} hull · {cls.shields} shields. Negotiate, slip past or fight. Your ship’s damage persists.</p>
    <p>One-time payment: 12 materials + 35 credits for victory, or 6 + 18 for a peaceful passage. You can review the contact and decline.</p>
    <button className="exp-button" disabled={!!lock} onClick={() => { unlockCombatAudio(); dispatch(action) }}>Review escort contact</button>{lock && <small>{lock}</small>}
  </div>
}
const OWN_ROOMS: Record<EnemyRoomKey, { x: number; y: number; w: number; h: number }> = {
  engines: { x: 9, y: 34, w: 17, h: 31 }, shields: { x: 28, y: 34, w: 16, h: 31 }, weapons: { x: 47, y: 34, w: 17, h: 31 }, helm: { x: 73, y: 34, w: 18, h: 31 },
}
const ROOM_EFFECT: Record<EnemyRoomKey, string> = { helm: 'Controls evasion', weapons: 'Damage slows all weapon charging', shields: 'Damage reduces shield capacity', engines: 'Controls evasion and escape charging' }
const WEAPON_NOTES: Record<string, string> = { ion: 'Strips shields / 6s system disruption', beam: '3 damage / ignores evade / shields block', missile: '2 damage / bypasses shields / uses ammo', laser: 'Two shots / 1 damage each' }
/** Each of our guns has its own colour, used for its projectile and its target marker. */
const WEAPON_COLOUR: Record<ShipWeaponKind, string> = { laser: '#ff6b5e', missile: '#ffb454', ion: '#5fd8ff', beam: '#c39bff' }
const ENEMY_COLOUR: Record<ShipWeaponKind, string> = { laser: '#ff8a3a', missile: '#ffd166', ion: '#7fe8ff', beam: '#ff7ad9' }
const OUTRO: Record<ShipBattleResult, { title: string; tone: 'win' | 'loss' | 'calm'; sound: CombatSound | null }> = {
  victory: { title: 'Target destroyed', tone: 'win', sound: 'explosion' }, yielded: { title: 'They stand down', tone: 'win', sound: 'victory' },
  fled: { title: 'Jump complete', tone: 'calm', sound: 'jump' }, disabled: { title: 'Main power lost', tone: 'loss', sound: 'defeat' },
  negotiated: { title: 'Lane open', tone: 'calm', sound: null }, evaded: { title: 'Clear of them', tone: 'calm', sound: null }, cancelled: { title: '', tone: 'calm', sound: null },
}
const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export function ExplorationBattle({ state, dispatch, saved, onExit }: { state: Campaign; dispatch: (a: CampaignAction) => void; saved: boolean; onExit: () => void }) {
  const b = state.shipBattle!
  // A battle that ends while on screen plays its ending before the report. The
  // ending is decided during render so the battle screen is never torn down
  // between the killing blow and the outro.
  const [outro, setOutro] = useState<ShipBattleResult | null>(null)
  const [phase, setPhase] = useState(b.phase)
  if (phase !== b.phase) {
    setPhase(b.phase)
    if (phase === 'battle' && b.phase === 'report' && b.result && OUTRO[b.result].title) setOutro(b.result)
  }
  useEffect(() => {
    if (!outro) return
    const sound = OUTRO[outro].sound
    if (sound) playCombatSound(sound)
    if (outro === 'victory') playCombatSound('victory', { delay: 1.1 })
    const done = window.setTimeout(() => setOutro(null), reducedMotion() ? 900 : 3000)
    return () => window.clearTimeout(done)
  }, [outro])
  if (b.phase === 'contact') return <ContactScreen state={state} dispatch={dispatch} saved={saved} />
  if (b.phase === 'report' && !outro) return <ReportScreen b={b} dispatch={dispatch} saved={saved} />
  return <BattleScreen state={state} dispatch={dispatch} onExit={onExit} outro={outro} onSkipOutro={() => setOutro(null)} />
}

function ContactScreen({ state, dispatch, saved }: { state: Campaign; dispatch: (a: CampaignAction) => void; saved: boolean }) {
  const b = state.shipBattle!, cls = SHIP_BY_ID[b.classId]!
  const button = (a: ShipOrder, label: string, primary = false) => {
    const lock = actionLock(state, { type: 'ship-order', order: a })
    return <button className={`exp-button ${primary ? 'primary' : ''}`} disabled={!!lock} title={lock ?? undefined} onClick={() => { unlockCombatAudio(); dispatch({ type: 'ship-order', order: a }) }}>{label}</button>
  }
  const intercept = b.kind === 'interception'
  const place = state.galaxy.systems.find((s) => s.id === b.locationId)?.name
  return <main className="exp-deck ship-contact"><section className="ship-contact-frame">
    <div className="ship-contact-art"><img className="reconstructed" data-testid="contact-recon-art" src={contactArtForClass(cls.id, cls.sprite)} alt={'Top-down sensor reconstruction of ' + cls.name} /><span>SENSOR RECONSTRUCTION / {cls.layout.toUpperCase()} HULL</span></div>
    <div className="ship-contact-copy"><span className="exp-eyebrow">{intercept ? `Hostile interception / ${place}` : 'Survey escort / interception'}</span><h1>{intercept ? 'Weapons lock on arrival.' : 'A ship across our bow.'}</h1><h2>{cls.name}</h2>
      <CrewLine person="cross" compact>{intercept ? 'They were waiting at the jump point. We can pay them, run for it, or fight.' : 'We can talk, slip past, or fight. Their systems tell us what a fight would cost.'}</CrewLine>
      <div className="ship-contact-stats"><span><b>{cls.hull}</b>hull</span><span><b>{cls.shields}</b>shield layers</span><span><b>{cls.evade}%</b>evasion</span></div>
      {!intercept && <p>The tender’s captain keeps her voice level. “We can wait at the station. But if you’re taking us out, I need to know you can get us through.”</p>}
      <p>Weapons identified: {cls.guns.map((g) => g.label.toLowerCase()).join(', ')}. The Lodestar has {b.hull}/{b.hullMax} hull. {!b.rules ? 'The station supplies four missiles for this escort; unused ordnance is returned afterward.' : `${intercept ? 'The magazine holds' : `The station adds ${ESCORT_MISSILES} Hellions to our magazine:`} ${b.missiles} ${b.missiles === 1 ? 'missile' : 'missiles'}. Missiles fired are gone for good.`}</p>
      {b.hailed && <p className="ship-contact-response">{b.log.at(-1)}</p>}
      <div className="ship-contact-options">{button({ type: 'hail' }, 'Hail the contact')}
        {b.hailed && <>{button({ type: 'pay' }, `Pay passage · ${b.toll} credits`)}{b.upgrades.contextual ? button({ type: 'negotiate' }, 'Negotiate passage · no payment', true) : <small>Contextual Translation opens a negotiated passage without a toll.</small>}</>}
        {button({ type: 'evade' }, `${intercept ? 'Break their lock' : 'Evade with the tender'} · ${evadeChance(b)}% chance`)}
        <small>{intercept ? `A failed evasion begins battle. Victory recovers ${INTERCEPTION_SPOILS.victory!.materials} materials, ${INTERCEPTION_SPOILS.victory!.credits} credits and fuel from the wreck.` : 'A failed evasion begins battle. A successful passage earns 6 materials and 18 credits.'}</small>
        {button({ type: 'engage' }, 'Engage · enter battle paused', true)}
        {!intercept && button({ type: 'cancel' }, 'Decline escort · no cost')}
      </div><small>{saved ? 'Contact saved' : 'Autosave unavailable — keep this tab open'}</small>
    </div>
  </section></main>
}

function ReportScreen({ b, dispatch, saved }: { b: ShipBattle; dispatch: (a: CampaignAction) => void; saved: boolean }) {
  const intercept = b.kind === 'interception'
  const title = intercept
    ? { victory: 'Wreckage and salvage.', negotiated: 'Paid and on our way.', evaded: 'Lock broken.', yielded: 'Their hold, our lives.', fled: 'Lost them in the wake.', disabled: 'A tow back to port.', cancelled: '' }[b.result!]
    : { victory: 'The lane is clear.', negotiated: 'No shots fired.', evaded: 'A quiet passage.', yielded: 'Weapons standing down.', fled: 'The tender turns back.', disabled: 'A tow back to port.', cancelled: 'Another captain, another day.' }[b.result!]
  const success = ['victory', 'negotiated', 'evaded', 'yielded'].includes(b.result!)
  const spoils = intercept ? interceptionSpoils(b) : success ? b.result === 'victory' ? { materials: 12, credits: 35, fuel: 0 } : { materials: 6, credits: 18, fuel: 0 } : null
  const note = b.result === 'disabled' ? 'Emergency recovery takes three days and costs up to 8 materials and 20 credits from your stores. Station survey contracts can fund repairs; the voyage can continue.'
    : intercept ? spoils ? 'The salvage comes aboard when you acknowledge this report. No campaign time passes.' : 'No campaign time passes. Hull damage persists until a station repairs it.'
    : b.result === 'cancelled' ? 'The tender stays at the station. No campaign time passes, and you can reconsider later.' : success ? 'The station pays once when you acknowledge this report. One campaign day passes. The laboratory continues its work.' : 'One campaign day passes. The escort can be attempted again; hull damage remains.'
  return <main className="exp-deck ship-report"><section className="exp-modal exp-ending"><span className="exp-eyebrow">{intercept ? 'Interception report' : 'Escort report'} / {b.time} combat seconds</span><h2>{title}</h2>
    <p>{b.log.at(-1)}</p><div className="exp-ending-stats"><span><b>{b.hull}</b>hull remaining</span><span><b>{spoils?.materials ?? 0}</b>materials {intercept ? 'salvaged' : 'earned'}</span><span><b>{spoils?.credits ?? 0}</b>credits {intercept ? 'salvaged' : 'earned'}</span>{intercept && <span><b>{spoils?.fuel ?? 0}</b>fuel recovered</span>}{b.rules === 2 && <span><b>{b.missiles + (intercept && spoils && 'missiles' in spoils ? spoils.missiles : 0)}</b>missiles aboard</span>}</div>
    {intercept && spoils && 'find' in spoils && <p className="space-find">{spoils.find}.</p>}
    <p>{note}</p>
    <button className="exp-button primary" onClick={() => dispatch({ type: 'ship-debrief' })}>{intercept ? 'Acknowledge interception report' : 'Acknowledge escort report'}</button><small>{saved ? 'Report saved' : 'Autosave unavailable'}</small>
  </section></main>
}

/**
 * The live clock. The simulation advances in whole seconds; between them the
 * screen interpolates (`frac`, 0–1) so charge bars fill smoothly and shots
 * cross the gap. Pausing freezes everything mid-flight.
 */
function useBattleClock(running: boolean, onSecond: () => void) {
  const [frac, setFrac] = useState(0)
  const acc = useRef(0), tick = useRef(onSecond)
  tick.current = onSecond
  useEffect(() => {
    if (!running) return
    let frame = 0, last = performance.now()
    const step = (now: number) => {
      const dt = Math.min(250, now - last); last = now
      if (!document.hidden) {
        acc.current += dt
        if (acc.current >= 1000) { acc.current -= 1000; tick.current() }
        setFrac(acc.current / 1000)
      }
      frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [running])
  const reset = () => { acc.current = 0; setFrac(0) }
  return { frac, reset }
}

type Point = { x: number; y: number }
type Fx = { key: string; type: 'burst' | 'hull-burst' | 'ripple' | 'flyby' | 'ion' | 'beam' | 'muzzle' | 'float' | 'smoke'; x: number; y: number; x2?: number; y2?: number; text?: string; colour?: string; delay?: number }

function BattleScreen({ state, dispatch, onExit, outro, onSkipOutro }: { state: Campaign; dispatch: (a: CampaignAction) => void; onExit: () => void; outro: ShipBattleResult | null; onSkipOutro: () => void }) {
  const b = state.shipBattle!, cls = SHIP_BY_ID[b.classId]!
  const live = b.phase === 'battle' && !outro
  const [running, setRunning] = useState(false)
  const [selectedWeapon, setWeapon] = useState(0)
  /** The order being given: a line runs from its origin (Repair button, or an officer) to the cursor. */
  const [repairing, setRepairing] = useState<{ origin: Point; cursor: Point; crew?: CrewId } | null>(null)
  const [fx, setFx] = useState<Fx[]>([])
  const [shake, setShake] = useState<{ side: 'player' | 'enemy'; n: number } | null>(null)
  const shakes = useRef(0)
  const arena = useRef<HTMLElement>(null)
  const friendly = useRef<HTMLElement>(null)
  const repairButton = useRef<HTMLButtonElement>(null)
  const rooms = useRef<Record<string, HTMLElement | null>>({})
  const shields = useRef<Record<string, HTMLElement | null>>({})
  const bridgeDispatch = useRef(dispatch); bridgeDispatch.current = dispatch
  const order = (a: ShipOrder) => dispatch({ type: 'ship-order', order: a })
  const { frac, reset } = useBattleClock(running && live, () => bridgeDispatch.current({ type: 'ship-order', order: { type: 'advance', seconds: 1 } }))
  // Pausing holds the fraction of a second already elapsed, so shots freeze where they are.
  const now = b.time + (live ? frac : 0)

  useEffect(() => {
    if (!repairing) return
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') setRepairing(null) }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [repairing])
  useEffect(() => {
    const hide = () => { if (document.hidden) setRunning(false) }
    document.addEventListener('visibilitychange', hide)
    return () => document.removeEventListener('visibilitychange', hide)
  }, [])
  const surrender = surrenderAvailable(b)
  const surrenderSeen = useRef(false)
  useEffect(() => { if (surrender && !surrenderSeen.current) { setRunning(false); surrenderSeen.current = true } }, [surrender])

  // Geometry, measured from the live layout so shots meet the rooms wherever they are drawn.
  const centre = (key: string, jitter = 0): Point | null => {
    const el = rooms.current[key], a = arena.current
    if (!el || !a) return null
    const r = el.getBoundingClientRect(), q = a.getBoundingClientRect()
    return { x: r.left + r.width / 2 - q.left + jitter * r.width * 0.22, y: r.top + r.height / 2 - q.top + jitter * r.height * 0.18 }
  }
  /** Where a shot from `from` toward `to` first touches the target's shield ellipse. */
  const shieldPoint = (side: 'player' | 'enemy', from: Point, to: Point): Point => {
    const el = shields.current[side], a = arena.current
    if (!el || !a) return to
    const r = el.getBoundingClientRect(), q = a.getBoundingClientRect()
    const cx = r.left + r.width / 2 - q.left, cy = r.top + r.height / 2 - q.top, rx = r.width / 2, ry = r.height / 2
    const dx = to.x - from.x, dy = to.y - from.y, ox = from.x - cx, oy = from.y - cy
    const A = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry), B = 2 * ((ox * dx) / (rx * rx) + (oy * dy) / (ry * ry)), C = (ox * ox) / (rx * rx) + (oy * oy) / (ry * ry) - 1
    const disc = B * B - 4 * A * C
    if (disc < 0 || A === 0) return to
    const t = (-B - Math.sqrt(disc)) / (2 * A)
    return t > 0 && t < 1 ? { x: from.x + dx * t, y: from.y + dy * t } : to
  }
  const gun = (side: 'player' | 'enemy') => centre(`${side}:weapons`)
  const other = (side: 'player' | 'enemy') => side === 'player' ? 'enemy' : 'player'
  const jitterFor = (shot: number) => shot === 0 ? 0 : shot % 2 ? 0.8 : -0.8

  // Turn each new engine event into sound and light, once.
  const seen = useRef(b.eventSeq ?? 0)
  const charges = useRef(b.weapons.map((w) => w.charge))
  const hullAlarm = useRef(b.hull <= b.hullMax * 0.3)
  const legacyShots = useRef(b.shots)
  useLayoutEffect(() => {
    const fresh = (b.events ?? []).filter((e) => e.id > seen.current)
    if (b.eventSeq !== undefined) seen.current = Math.max(seen.current, b.eventSeq)
    b.weapons.forEach((w, i) => { if (w.mode !== 'off' && w.charge >= w.period && (charges.current[i] ?? 0) < w.period) playCombatSound('ready', { pan: -0.5 }) })
    charges.current = b.weapons.map((w) => w.charge)
    if (!hullAlarm.current && b.hull <= b.hullMax * 0.3) { hullAlarm.current = true; playCombatSound('alarm') }
    // Rules-1 battles (saved before projectiles) report only their latest shot.
    if (!b.rules && b.volley && b.shots > legacyShots.current) {
      const v = b.volley, to = v.side === 'player' ? 0.55 : -0.55
      playCombatSound(v.kind, { pan: -to }); playCombatSound(v.hit ? v.damage ? 'impact' : 'shield' : 'miss', { pan: to, delay: 0.3 })
    }
    legacyShots.current = b.shots
    if (!fresh.length) return
    const added: Fx[] = []
    for (const e of fresh) added.push(...stack(effectsFor(e)))
    if (added.length) setFx((list) => [...list, ...added].slice(-60))
  }, [b])
  function effectsFor(e: BattleEvent): Fx[] {
    const key = `${e.id}`, pan = (side: 'player' | 'enemy') => side === 'player' ? -0.55 : 0.55
    if (e.type === 'launch') {
      const delay = e.shot * 0.12
      playCombatSound(e.kind, { pan: pan(e.side), delay, volume: e.side === 'player' ? 1 : 0.8 })
      const from = gun(e.side)
      if (!from) return []
      const out: Fx[] = [{ key: `${key}-m`, type: 'muzzle', ...from, colour: (e.side === 'player' ? WEAPON_COLOUR : ENEMY_COLOUR)[e.kind], delay }]
      if (e.kind === 'beam') {
        const to = centre(`${other(e.side)}:${e.target}`)
        if (to) out.push({ key: `${key}-b`, type: 'beam', x: from.x, y: from.y, x2: to.x, y2: to.y, colour: (e.side === 'player' ? WEAPON_COLOUR : ENEMY_COLOUR).beam })
      }
      return out
    }
    if (e.type === 'impact') {
      const to = other(e.side), from = gun(e.side), at = centre(`${to}:${e.target}`, jitterFor(e.shot))
      if (!from || !at) return []
      const delay = e.shot * 0.08
      const sound: CombatSound = e.outcome === 'hit' ? to === 'player' ? 'hull' : 'impact' : e.outcome === 'miss' ? 'miss' : e.outcome === 'ion' ? 'ionised' : 'shield'
      playCombatSound(sound, { pan: pan(to), delay })
      if (e.outcome === 'miss') {
        const dx = at.x - from.x, dy = at.y - from.y, len = Math.hypot(dx, dy) || 1
        return [{ key: `${key}-f`, type: 'flyby', x: at.x, y: at.y, x2: at.x + (dx / len) * 260, y2: at.y + (dy / len) * 260 + (e.shot % 2 ? 50 : -50), colour: (e.side === 'player' ? WEAPON_COLOUR : ENEMY_COLOUR)[e.kind], delay },
          { key: `${key}-t`, type: 'float', x: at.x, y: at.y - 30, text: 'MISS', colour: '#a9c3d0', delay }]
      }
      if (e.outcome === 'shield' || e.outcome === 'blocked') {
        const p = shieldPoint(to, from, at)
        return [{ key: `${key}-r`, type: 'ripple', ...p, colour: to === 'player' ? '#7fe3ff' : '#ffc27a', delay },
          { key: `${key}-t`, type: 'float', x: p.x, y: p.y - 26, text: e.outcome === 'blocked' ? 'DEFLECTED' : e.kind === 'ion' ? 'SHIELD IONISED' : 'ABSORBED', colour: '#8fe6ff', delay }]
      }
      if (e.outcome === 'ion') return [{ key: `${key}-i`, type: 'ion', ...at, delay }, { key: `${key}-t`, type: 'float', x: at.x, y: at.y - 30, text: 'IONISED', colour: '#8fe6ff', delay }]
      if (to === 'player' || e.damage >= 2) setShake({ side: to, n: ++shakes.current })
      return [{ key: `${key}-h`, type: to === 'player' ? 'hull-burst' : 'burst', ...at, delay },
        { key: `${key}-s`, type: 'smoke', ...at, delay: delay + 0.2 },
        { key: `${key}-t`, type: 'float', x: at.x, y: at.y - 34, text: `−${e.damage}`, colour: '#ff8b7a', delay }]
    }
    const at = centre(`${e.side}:${e.target}`)
    if (e.type === 'fire') { playCombatSound('fire', { pan: pan(e.side) }); return at ? [{ key: `${key}-t`, type: 'float', x: at.x, y: at.y - 40, text: 'FIRE', colour: '#ffb454' }] : [] }
    if (e.type === 'extinguished') { playCombatSound('extinguish', { pan: pan(e.side), volume: 0.7 }); return [] }
    if (e.type === 'wounded' || e.type === 'down' || e.type === 'returned') {
      const who = CREW[e.crew].name.split(' ')[1]
      if (e.type === 'down') playCombatSound('alarm', { volume: 0.5 })
      return at ? [{ key: `${key}-t`, type: 'float', x: at.x, y: at.y + 24, text: e.type === 'down' ? `${who} down` : e.type === 'returned' ? `${who} back` : `${who} hurt`, colour: e.type === 'returned' ? '#8ef0b5' : '#ffb3a8' }] : []
    }
    if (e.side === 'player') playCombatSound('repair', { pan: -0.55 })
    return at ? [{ key: `${key}-t`, type: 'float', x: at.x, y: at.y - 34, text: '+1', colour: '#8ef0b5' }] : []
  }
  const dropFx = (key: string) => setFx((list) => list.filter((f) => f.key !== key))
  // Labels landing on the same spot in quick succession stack upward instead of overlapping.
  const stacks = useRef<Record<string, { at: number; n: number }>>({})
  const stack = (list: Fx[]) => list.map((f) => {
    if (f.type !== 'float') return f
    const spot = `${Math.round(f.x / 40)}:${Math.round(f.y / 40)}`, at = performance.now(), last = stacks.current[spot]
    const n = last && at - last.at < 1300 ? last.n + 1 : 0
    stacks.current[spot] = { at, n }
    return { ...f, y: f.y - n * 17 }
  })

  // Keyboard: Space pauses, 1–4 pick a weapon, F fires it.
  const keys = useRef<(e: KeyboardEvent) => void>(() => {})
  keys.current = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null
    if (!live || e.repeat || e.ctrlKey || e.metaKey || e.altKey || target?.closest('input,textarea,select')) return
    // A focused button keeps Space for itself, as keyboard users expect.
    if (e.code === 'Space') { if (target?.closest('button')) return; e.preventDefault(); toggleRunning() }
    else if (/^Digit[1-4]$/.test(e.code)) { const i = Number(e.code.slice(5)) - 1; if (b.weapons[i]) { setWeapon(i); playCombatSound('click') } }
    else if (e.key === 'f' || e.key === 'F') { if (!actionLock(state, { type: 'ship-order', order: { type: 'fire', index: selectedWeapon } })) order({ type: 'fire', index: selectedWeapon }) }
    else if (e.key === 'v' || e.key === 'V') volley()
  }
  useEffect(() => {
    const listener = (e: KeyboardEvent) => keys.current(e)
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])
  /** Every charged, powered weapon at once: a held laser and missile together break a shield. */
  const ready = b.weapons.map((_, i) => i).filter((i) => !fireLock(b, i))
  const volley = () => { for (const index of ready) dispatch({ type: 'ship-order', order: { type: 'fire', index } }) }
  const toggleRunning = () => { unlockCombatAudio(); playCombatSound(running ? 'pause' : 'resume'); setRunning(!running) }

  const button = (a: ShipOrder, label: string, primary = false) => {
    const lock = actionLock(state, { type: 'ship-order', order: a })
    return <button className={`exp-button ${primary ? 'primary' : ''}`} disabled={!!lock} title={lock ?? undefined} onClick={() => order(a)}>{label}</button>
  }
  const power = (system: 'shields' | 'engines' | 'weapons', step: number) => {
    const a: ShipOrder = { type: 'power', system, amount: b.power[system] + step }, lock = actionLock(state, { type: 'ship-order', order: a })
    return <button className="space-pw" disabled={!!lock} title={lock ?? undefined} aria-label={`${step < 0 ? 'Decrease' : 'Increase'} ${system} power`} onClick={() => { playCombatSound('click'); order(a) }}>{step < 0 ? '−' : '+'}</button>
  }
  const activeWeapon = b.weapons[selectedWeapon] ?? b.weapons[0]!
  const startRepair = (from: HTMLElement | null = repairButton.current, crew?: CrewId) => {
    if (repairing && (!crew || repairing.crew === crew)) { setRepairing(null); return }
    const r = from?.getBoundingClientRect(), a = friendly.current?.getBoundingClientRect()
    if (!r || !a) return
    const origin = { x: r.left + r.width / 2 - a.left, y: r.top - a.top }
    playCombatSound('click')
    setRepairing({ origin, cursor: { x: origin.x, y: origin.y - 80 }, crew })
  }
  /** Rules 2: a click on our compartment sends the chosen officer there, or picks up whoever is in it. */
  const roomClick = (key: EnemyRoomKey) => {
    if (!live) return
    if (!b.crew) { order({ type: 'repair', room: key }); setRepairing(null); playCombatSound('click'); return }
    if (repairing?.crew) {
      const a: ShipOrder = { type: 'crew', id: repairing.crew, room: key }
      if (!actionLock(state, { type: 'ship-order', order: a })) { order(a); playCombatSound('click') }
      setRepairing(null); return
    }
    const here = b.crew.find((c) => c.room === key && c.hp > 0 && !c.moving)
    if (here) startRepair(rooms.current[`player:${key}`] ?? null, here.id)
  }
  const track = (event: MouseEvent<HTMLElement>) => {
    if (!repairing) return
    const a = event.currentTarget.getBoundingClientRect()
    setRepairing({ ...repairing, cursor: { x: event.clientX - a.left, y: event.clientY - a.top } })
  }
  const playerRate = playerChargeRate(b), enemyRate = enemyChargeRate(b)
  const smooth = (charge: number, period: number, rate: number, on: boolean) => on && live ? Math.min(period, charge + rate * frac) : charge
  const critical = b.hull <= b.hullMax * 0.3
  const legacyVolley = !b.rules && b.volley ? b.volley : null
  const outroInfo = outro ? OUTRO[outro] : null
  // Two identical animations, alternated, restart the shake without remounting the ship.
  const shakeClass = (side: 'player' | 'enemy') => shake?.side === side ? ` shake-${shake.n % 2 ? 'a' : 'b'}` : ''

  return <main className={`exp-deck space-battle${running && live ? '' : ' halted'}${critical ? ' critical' : ''}`} onPointerDown={unlockCombatAudio}>
    <header className="space-header">
      <span className={`space-clock-state ${running && live ? 'live' : ''}`} role="status">{!live ? 'ENGAGEMENT OVER' : running ? 'LIVE' : 'PAUSED'} <small>{b.time}s</small></span>
      {live && <>
        <button className="exp-button primary" onClick={toggleRunning} title="Space">{running ? 'Pause battle' : 'Resume battle'}</button>
        <button className="exp-button" disabled={running} onClick={() => { reset(); order({ type: 'advance', seconds: 1 }) }}>Advance 1 second</button>
        {button({ type: 'retreat', active: !b.escape }, b.escape ? `Cancel retreat · ${Math.floor(b.escapeWork * 10)}% charged` : 'Charge retreat · engines required')}
      </>}
      <span className="space-hint" aria-hidden="true">Space pause · 1–{b.weapons.length} weapon · F fire · V volley</span>
      <button className="exp-button space-title" onClick={() => { setRunning(false); onExit() }}>Save & title</button>
      <MuteButton icon />
    </header>
    <section className={`space-arena${running && live ? '' : ' frozen'}`} aria-label="Ship battle area" ref={arena}>
      <div className="space-starfield" aria-hidden="true" />
      {live && surrender && <div className="space-surrender"><p>Their hull is failing. The translator relays an offer to stand down.</p>{button({ type: 'accept-surrender' }, 'Accept surrender', true)}</div>}
      <article className={`space-ship friendly${repairing ? ' repairing' : ''}${outro === 'fled' ? ' jumping' : ''}${outro === 'disabled' ? ' powerless' : ''}`} ref={friendly} onMouseMove={track}>
        <ShipReadout name="ISS Lodestar" hull={b.hull} max={b.hullMax} shields={b.shield} capacity={shieldCapacity(b)} evasion={playerEvasion(b)} critical={critical} segments={20}
          offline={shieldCapacity(b) ? null : b.power.shields < 2 ? 'needs 2 power' : 'generator damaged'} />
        <div className={`space-hull own${shakeClass('player')}`}>
          <div className="space-bob"><img src="/assets/ships/indefatigable-combat.png" alt="Lodestar compartment cutaway" />
            <div className="space-engine-glow" aria-hidden="true" />
            <div ref={(el) => { shields.current.player = el }} className={`space-shield layers-${b.shield}`} aria-hidden="true" />
            {SHIP_ROOMS.map((key) => <Room key={key} b={b} side="player" room={key} selected={b.repair === key} register={(el) => { rooms.current[`player:${key}`] = el }}
              threats={live ? cls.guns.flatMap((g, i) => b.enemy.aim?.[i] === key ? [{ label: g.label, eta: enemyGunEta(b, i) }] : []) : []}
              crew={(b.crew ?? []).filter((c) => c.room === key && c.hp > 0).map((c) => ({ ...c, chosen: repairing?.crew === c.id }))}
              onClick={() => roomClick(key)} />)}
            {legacyVolley?.side === 'enemy' && <Impact key={b.shots} volley={legacyVolley} box={OWN_ROOMS[legacyVolley.target]} />}
          </div>
        </div>
        {b.crew ? <div className="space-crew" role="group" aria-label="Crew at battle stations">
          {b.crew.map((c) => {
            const person = CREW[c.id], r = b.rooms[c.room]
            const doing = c.hp <= 0 ? `Medical bay · ${c.moving}s` : c.moving ? `Moving to ${c.room}` : burning(r) ? `Fighting the ${c.room} fire` : r.hp < r.max ? `Repairing ${c.room}` : `Manning ${c.room}`
            return <button key={c.id} className={`space-crew-card${repairing?.crew === c.id ? ' chosen' : ''}${c.hp <= 0 ? ' down' : ''}`} disabled={!live || c.hp <= 0} aria-pressed={repairing?.crew === c.id}
              aria-label={`${person.name}, ${doing}`} onClick={(e) => startRepair(e.currentTarget, c.id)}>
              <img src={person.portrait} alt="" /><span><strong>{person.name.split(' ')[1]}</strong><small>{doing}</small>
                <i className="space-crew-hp" aria-hidden="true">{Array.from({ length: CREW_HP }, (_, n) => <b key={n} className={n < c.hp ? 'ok' : ''} />)}</i></span>
            </button>
          })}
          <small role="status" className="space-crew-hint">{repairing?.crew ? `Select a compartment for ${CREW[repairing.crew].name.split(' ')[1]}` : 'Crew repair and fight fire where they stand. The helm needs an officer for evasion.'}</small>
        </div> : <div className="space-repair">
          <button ref={repairButton} className="exp-button space-repair-button" aria-pressed={!!repairing} disabled={!live} onClick={() => startRepair()}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z" /></svg>
            <span>{repairing ? 'Cancel repair' : 'Repair'}</span></button>
          <small role="status">{repairing ? 'Select a compartment to repair' : burning(b.rooms[b.repair]) ? `Crew fighting the ${b.repair} fire` : `Crew repairing ${b.repair}`}</small>
          <span className="space-repair-progress" aria-hidden="true"><i style={{ width: `${Math.min(1, b.repairWork / 6) * 100}%` }} /></span>
        </div>}
        <ol className="space-log" aria-label="Combat log">{b.log.slice(-4).map((line, i, all) => <li key={b.log.length - all.length + i}>{line}</li>)}</ol>
        {repairing && <svg className="space-repair-line" aria-hidden="true"><line x1={repairing.origin.x} y1={repairing.origin.y} x2={repairing.cursor.x} y2={repairing.cursor.y} /><circle cx={repairing.origin.x} cy={repairing.origin.y} r={3} className="dot" /><circle cx={repairing.cursor.x} cy={repairing.cursor.y} r={7} /></svg>}
      </article>
      <div className="space-versus" aria-hidden="true"><span>{b.kind === 'interception' ? <>JUMP<br />POINT</> : <>ESCORT<br />CORRIDOR</>}</span>
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#b5a880" strokeWidth="1"><path d="M12 3l9 9-9 9-9-9z" /></svg><small>{!live ? 'CEASEFIRE' : running ? 'LIVE FIRE' : 'TACTICAL PAUSE'}</small></div>
      <article className={`space-ship hostile${outro === 'victory' ? ' destroyed' : ''}${outro === 'yielded' ? ' yielded' : ''}`}>
        <ShipReadout name={cls.name} hull={b.enemy.hull} max={b.enemy.maxHull} shields={b.enemy.shield} capacity={cls.shields} evasion={enemyEvasion(b)} segments={b.enemy.maxHull} />
        <div className={`space-hull enemy${shakeClass('enemy')}`}>
          <div className="space-bob slow"><img src={cls.sprite} alt={cls.name} />
            <div ref={(el) => { shields.current.enemy = el }} className={`space-shield layers-${b.enemy.shield}`} aria-hidden="true" />
            {SHIP_ROOMS.map((key) => <Room key={key} b={b} side="enemy" room={key} selected={activeWeapon.target === key} register={(el) => { rooms.current[`enemy:${key}`] = el }}
              markers={b.weapons.map((w, i) => ({ w, i })).filter(({ w }) => w.mode !== 'off' && w.target === key)}
              onClick={() => { if (!live) return; order({ type: 'target', index: selectedWeapon, room: key }); playCombatSound('target', { pan: 0.5 }) }} />)}
            {legacyVolley?.side === 'player' && <Impact key={b.shots} volley={legacyVolley} box={ENEMY_LAYOUTS[cls.layout][legacyVolley.target]} />}
          </div>
          {outro === 'victory' && <div className="space-wreck" aria-hidden="true">{[0, 1, 2, 3, 4, 5].map((i) => <i key={i} style={{ animationDelay: `${i * 0.18}s` }} />)}</div>}
        </div>
        <div className="space-enemy-guns" aria-label="Hostile weapons">{cls.guns.map((g, i) => {
          const value = smooth(b.enemy.charges[i]!, g.time, enemyRate, true), aim = b.enemy.aim?.[i], eta = enemyGunEta(b, i)
          return <label key={i} className={aim ? 'imminent' : ''}><span className="space-gun-name">{g.label}</span><span className="space-meter enemy" role="progressbar" aria-label={`Enemy ${g.label} charge`} aria-valuemin={0} aria-valuemax={g.time} aria-valuenow={Math.floor(b.enemy.charges[i]!)}><i style={{ width: `${value * 100 / g.time}%` }} /></span>
            <small>{aim ? `→ ${aim} · ${eta ?? '—'}s` : eta === null ? 'offline' : 'charging'}</small></label>
        })}</div>
      </article>
      <ProjectileLayer b={b} now={now} live={live} gun={gun} centre={centre} jitterFor={jitterFor} />
      <div className="space-fx" aria-hidden="true">{fx.map((f) => <FxNode key={f.key} f={f} done={() => dropFx(f.key)} />)}</div>
      {outroInfo && <div className={`space-outro ${outroInfo.tone}`} role="status"><strong>{outroInfo.title}</strong><button className="exp-button" onClick={onSkipOutro}>Continue to report</button></div>}
    </section>
    <div className="space-console">
      <section className="space-reactor" aria-label="Reactor">
        <div className="space-reactor-bar" aria-hidden="true">{Array.from({ length: REACTOR_POWER }, (_, i) => <i key={i} className={i < REACTOR_POWER - assignedPower(b) ? 'spare' : ''} />)}</div>
        <div className="space-console-label"><span className="exp-eyebrow">Reactor</span><strong>{assignedPower(b)}/{REACTOR_POWER} <span>· {REACTOR_POWER - assignedPower(b)} spare</span></strong></div>
        {(['shields', 'engines', 'weapons'] as const).map((system) => {
          const max = system === 'shields' ? b.upgrades.layered ? 4 : 2 : system === 'engines' ? 3 : 4
          const usable = effectiveRoom(b, 'player', system)
          return <div className="space-power" key={system} title={system === 'shields' ? `${shieldCapacity(b)} layers · ${b.upgrades.adaptive ? '1.2×' : '1×'} recovery · two power per layer` : system === 'engines' ? `More power improves evasion (${playerEvasion(b)}%) and escape` : `${weaponPower(b)} allocated to active weapons`}>
            <div className="space-pips" aria-hidden="true">{Array.from({ length: max }, (_, i) => <i key={i} className={`${i < b.power[system] ? 'on' : ''}${i >= usable ? ' broken' : ''}`} />)}</div>
            <SystemIcon room={system} /><span>{system}</span>
            <div className="space-pw-pair">{power(system, -1)}<b>{b.power[system]}</b>{power(system, 1)}</div>
          </div>
        })}
      </section>
      <section className="space-battery" aria-label="Weapon control">
        <div className="space-console-label"><span className="exp-eyebrow">Weapons</span><strong>{b.missiles} {b.missiles === 1 ? 'missile' : 'missiles'}</strong>
          <button className="exp-button space-volley" disabled={!live || ready.length < 2} title="V · fire every charged weapon together" onClick={volley}>Volley · {ready.length} ready</button></div>
        {b.weapons.map((w, i) => {
          const disabled = effectiveRoom(b, 'player', 'weapons') === 0, value = smooth(w.charge, w.period, playerRate, w.mode !== 'off' && !(w.kind === 'missile' && !b.missiles)), ready = w.charge >= w.period
          return <article key={w.kind} className={`${selectedWeapon === i ? 'selected' : ''}${ready && w.mode !== 'off' ? ' ready' : ''}${w.mode === 'off' ? ' unpowered' : ''}`} aria-label={w.name} title={`${WEAPON_NOTES[w.kind]} · Auto fires at the selected room when charged; hold keeps a full charge`} style={{ ['--gun' as string]: WEAPON_COLOUR[w.kind] }}>
            <button className="space-weapon-title" aria-pressed={selectedWeapon === i} onClick={() => { setWeapon(i); playCombatSound('click') }}><kbd>{i + 1}</kbd>{w.name}<small>{w.cost} power · → {w.target}</small></button>
            <div className="space-charge"><span className="space-meter" role="progressbar" aria-label={`${w.name} charge`} aria-valuemin={0} aria-valuemax={w.period} aria-valuenow={Math.floor(w.charge)}><i style={{ width: `${value * 100 / w.period}%` }} /></span><small>{disabled ? 'COMPARTMENT DISABLED' : `${ready ? 'READY' : `${Math.floor(value * 100 / w.period)}%`} · ${w.mode.toUpperCase()}`}</small></div>
            <div className="space-modes" role="group" aria-label={`${w.name} mode`}>{(['off', 'hold', 'auto'] as const).map((mode) => <button key={mode} aria-pressed={w.mode === mode} disabled={!!actionLock(state, { type: 'ship-order', order: { type: 'weapon', index: i, mode } })} onClick={() => { playCombatSound('click'); order({ type: 'weapon', index: i, mode }) }}>{mode}</button>)}</div>
            {button({ type: 'fire', index: i }, 'Fire', true)}
          </article>
        })}
      </section>
    </div>
  </main>
}

/** Shots in flight, positioned between the guns and their target compartments. */
function ProjectileLayer({ b, now, live, gun, centre, jitterFor }: {
  b: ShipBattle; now: number; live: boolean; gun: (side: 'player' | 'enemy') => Point | null; centre: (key: string, jitter?: number) => Point | null; jitterFor: (shot: number) => number
}) {
  // A shot fired between ticks (a manual Fire) starts from the moment it appeared.
  const born = useRef<Record<number, number>>({})
  const list = live ? b.inFlight ?? [] : []
  for (const p of list) if (born.current[p.id] === undefined) born.current[p.id] = Math.max(p.launched, now)
  return <svg className="space-projectiles" aria-hidden="true">
    <defs>
      <filter id="space-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      <linearGradient id="space-trail" x1="0" x2="1"><stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#fff" stopOpacity=".55" /></linearGradient>
    </defs>
    {list.map((p) => <Shot key={p.id} p={p} start={Math.min(p.lands - 0.3, born.current[p.id]! + p.shot * 0.12)} now={now} from={gun(p.side)} to={centre(`${p.side === 'player' ? 'enemy' : 'player'}:${p.target}`, jitterFor(p.shot))} />)}
  </svg>
}
function Shot({ p, start, now, from, to }: { p: Projectile; start: number; now: number; from: Point | null; to: Point | null }) {
  if (!from || !to || now < start) return null
  const t = Math.max(0, Math.min(1, (now - start) / Math.max(0.05, p.lands - start)))
  // Missiles climb and arc; energy weapons fly straight.
  const lift = p.kind === 'missile' ? (p.side === 'player' ? -1 : 1) * 90 : 0
  const at = (u: number) => ({ x: from.x + (to.x - from.x) * u, y: from.y + (to.y - from.y) * u + lift * 4 * u * (1 - u) })
  const pos = at(t), ahead = at(Math.min(1, t + 0.02)), angle = Math.atan2(ahead.y - pos.y, ahead.x - pos.x) * 180 / Math.PI
  const colour = (p.side === 'player' ? WEAPON_COLOUR : ENEMY_COLOUR)[p.kind]
  if (p.kind === 'ion') return <g transform={`translate(${pos.x} ${pos.y})`} filter="url(#space-glow)"><circle r="9" fill={colour} opacity=".35" /><circle r="5" fill="#e6fbff" /></g>
  if (p.kind === 'missile') {
    const trail = Array.from({ length: 8 }, (_, i) => at(Math.max(0, t - i * 0.025)))
    return <g><polyline points={trail.map((q) => `${q.x},${q.y}`).join(' ')} fill="none" stroke="rgba(220,220,220,.35)" strokeWidth="3" strokeLinecap="round" />
      <g transform={`translate(${pos.x} ${pos.y}) rotate(${angle})`} filter="url(#space-glow)"><rect x="-9" y="-2.5" width="16" height="5" rx="2" fill="#e9e2d0" /><path d="M-9 -3 L-17 0 L-9 3 Z" fill={colour} /><circle cx="-12" r="3" fill="#fff4c8" /></g></g>
  }
  return <g transform={`translate(${pos.x} ${pos.y}) rotate(${angle})`} filter="url(#space-glow)"><rect x="-22" y="-2" width="30" height="4" rx="2" fill="url(#space-trail)" /><rect x="-12" y="-2.5" width="20" height="5" rx="2.5" fill={colour} /><rect x="-6" y="-1" width="13" height="2" rx="1" fill="#fff" /></g>
}
function FxNode({ f, done }: { f: Fx; done: () => void }) {
  // A safety net: with animations disabled (reduced motion) animationend never fires.
  const finish = useRef(done); finish.current = done
  useEffect(() => { const t = window.setTimeout(() => finish.current(), reducedMotion() ? 700 : 4000); return () => window.clearTimeout(t) }, [])
  const style: Record<string, string | number> = { left: f.x, top: f.y, animationDelay: `${f.delay ?? 0}s` }
  if (f.colour) style['--fx'] = f.colour
  if (f.type === 'beam' || f.type === 'flyby') {
    const dx = f.x2! - f.x, dy = f.y2! - f.y
    style.width = Math.hypot(dx, dy); style.transform = `rotate(${Math.atan2(dy, dx)}rad)`
  }
  if (f.type === 'float') return <span className="fx-float" style={style} onAnimationEnd={done}>{f.text}</span>
  return <span className={`fx-${f.type}`} style={style} onAnimationEnd={(e) => { if (e.target === e.currentTarget && !e.pseudoElement) done() }} />
}
/** Rules 1 battles (saved before projectiles existed) still mark where damage landed. */
function Impact({ volley, box }: { volley: NonNullable<ShipBattle['volley']>; box: { x: number; y: number; w: number; h: number } }) {
  const x = box.x + box.w / 2, y = box.y + box.h / 2
  const label = volley.hit ? volley.damage ? `−${volley.damage} ${volley.target}` : volley.kind === 'ion' ? 'ION' : 'SHIELD' : 'MISS'
  return <><span className={`space-burst ${volley.hit ? '' : 'miss'}`} aria-hidden="true" style={{ left: `${x}%`, top: `${y}%` }} />
    <span className={`space-hit ${volley.hit ? '' : 'miss'}`} role="status" style={{ left: `${x}%`, top: `${Math.max(0, y - 22)}%` }}>{label}<small>{volley.kind === 'laser' ? 'pulse laser' : volley.kind}</small></span></>
}
function ShipReadout({ name, hull, max, shields, capacity, evasion, critical = false, segments, offline = null }: { name: string; hull: number; max: number; shields: number; capacity: number; evasion: number; critical?: boolean; segments: number; offline?: string | null }) {
  const per = max / segments, lit = Math.ceil(Math.max(0, hull) / per - 0.001)
  const tone = hull / max > 0.5 ? 'good' : hull / max > 0.25 ? 'warn' : 'bad'
  return <div className="space-readout"><h2>{name}{critical && <span className="space-critical">HULL CRITICAL</span>}</h2>
    <div><span className="space-hull-label">HULL <b>{hull}/{max}</b></span>
      <span className={`space-bar ${tone}`} role="progressbar" aria-label={`${name} hull`} aria-valuemin={0} aria-valuemax={max} aria-valuenow={hull}>{Array.from({ length: segments }, (_, i) => <i key={i} className={i < lit ? 'on' : ''} />)}</span></div>
    <div className="space-readout-sub"><span className="space-shield-pips" aria-label={`Shields ${shields} of ${capacity}`}>SHIELDS {Array.from({ length: Math.max(capacity, shields) }, (_, i) => <i key={i} className={i < shields ? 'up' : ''} />)}{offline ? <em className="offline">offline · {offline}</em> : capacity === 0 ? <em>none</em> : ` ${shields}/${capacity}`}</span>
      <span>EVASION <b>{evasion}%</b></span></div></div>
}
function Room({ b, side, room, selected, onClick, register, markers = [], threats = [], crew = [] }: { b: ShipBattle; side: 'player' | 'enemy'; room: EnemyRoomKey; selected: boolean; onClick: () => void; register: (el: HTMLElement | null) => void; markers?: { w: ShipBattle['weapons'][number]; i: number }[]; threats?: { label: string; eta: number | null }[]; crew?: (BattleCrew & { chosen: boolean })[] }) {
  const box = side === 'player' ? OWN_ROOMS[room] : ENEMY_LAYOUTS[SHIP_BY_ID[b.classId]!.layout][room]
  const r = side === 'player' ? b.rooms[room] : b.enemy.rooms[room]
  const ion = r.ionUntil > b.time, fire = burning(r)
  return <button ref={register} className={`space-room ${selected && !b.crew ? 'selected' : ''} ${threats.length ? 'targeted' : ''} ${r.hp === 0 ? 'disabled-room' : r.hp < r.max ? 'damaged' : ''} ${ion ? 'ionised' : ''} ${fire ? 'burning' : ''}`} style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%` }}
    aria-label={`${side === 'enemy' ? 'Target' : b.crew ? 'Order crew to' : 'Repair'} ${room}`} aria-pressed={selected} title={ROOM_EFFECT[room]} onClick={onClick}>
    {fire && <span className="space-flames" aria-hidden="true"><i /><i /><i /></span>}
    <SystemIcon room={room} />
    <strong>{room}</strong><span className="space-room-pips" aria-hidden="true">{Array.from({ length: r.max }, (_, i) => <i key={i} className={i < r.hp ? 'ok' : ''} />)}</span>
    <span>{ion ? `ION ${r.ionUntil - b.time}s` : fire ? `FIRE ${r.hp}/${r.max}` : `${r.hp}/${r.max}`}</span>
    {threats.length > 0 && <span className="space-threat" aria-label={`Hostile ${threats.map((t) => t.label.toLowerCase()).join(' and ')} locked on`}><i aria-hidden="true" />{threats.map((t, i) => <b key={i}>{t.label} {t.eta ?? '—'}s</b>)}</span>}
    {crew.length > 0 && <span className="space-room-crew" aria-hidden="true">{crew.map((c) => <img key={c.id} src={CREW[c.id].portrait} alt="" className={`${c.moving ? 'moving' : ''}${c.chosen ? ' chosen' : ''}${c.hp < CREW_HP ? ' hurt' : ''}`} />)}</span>}
    {markers.length > 0 && <span className="space-markers" aria-hidden="true">{markers.map(({ w, i }) => <i key={i} style={{ background: WEAPON_COLOUR[w.kind] }}>{i + 1}</i>)}</span>}
  </button>
}
function SystemIcon({ room }: { room: EnemyRoomKey }) {
  const path = { helm: 'M12 3v4M12 17v4M3 12h4M17 12h4M12 8a4 4 0 1 0 0 8a4 4 0 0 0 0-8z', weapons: 'M4 16l9-9 4 1-1 4-9 9zM14 6l4 4M5 19l-2 2', shields: 'M12 3l7 3v5c0 5-3 8-7 10c-4-2-7-5-7-10V6z', engines: 'M5 8h9l4 4-4 4H5zM2 10h3M2 14h3M18 12h4' }[room]
  return <svg className="space-sys-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true"><path d={path} /></svg>
}
