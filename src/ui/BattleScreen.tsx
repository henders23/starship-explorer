import { useEffect, useMemo, useReducer, useRef } from 'react'
import { battleParams, YIELD_HULL_FRACTION, RAIDER_BREAK_FRACTION, type BattleParams } from '../engine/combat/combat.js'
import { enemyClass } from '../engine/combat/combat.js'
import type { ShipClass } from '../engine/combat/ships.js'
import { GalaxyIndex } from '../engine/worldgen/index-galaxy.js'
import { useDispatch, useGame } from './store.js'

/**
 * The battle: FTL-style, real-time with pause, run entirely in the UI.
 *
 * The engine hands this component a deterministic setup — the enemy's ship
 * class, and BattleParams derived from research, crew and the magazine —
 * and receives back a single `combatResolve` action when the engagement
 * ends. The simulation itself (charge timers, power routing, shield layers,
 * evasion rolls) is presentation: its outcome enters the action log, the
 * way every other player decision does.
 *
 * Ported from the player's FTL-style prototype: rooms are clickable
 * targets, weapons charge and hold or auto-fire, ion strips shields and
 * disables compartments, beams ignore evasion but not shields, and the
 * reactor never has enough power for everything.
 */

type WeaponKind = 'laser' | 'missile' | 'ion' | 'beam' | 'fighter'

interface SimWeapon {
  name: string
  kind: WeaponKind
  room: 'weapons1' | 'weapons2'
  cost: number
  time: number
  charge: number
  shots: number
  dmg: number
  ammo?: number
  mode: 'off' | 'hold' | 'auto'
  target: string | null
  color: string
}

interface SimSystem { pw?: number; hp: number; max: number }
interface SimEnemySystem { hp: number; max: number; ionUntil: number }

interface Shot {
  side: 'player' | 'enemy'
  kind: WeaponKind
  dmg: number
  color: string
  target: string
  miss: boolean
  x0: number; y0: number; x1: number; y1: number
  t0: number; t1: number
  done: boolean
}

interface Sim {
  phase: 'playing' | 'victory' | 'driven-off' | 'yielded' | 'fled' | 'defeat'
  paused: boolean
  hull: number
  maxHull: number
  shieldLayers: number
  shieldTimer: number
  repairTimer: number
  retreat: boolean
  retreatCharge: number
  launchCharge: number
  craft: number
  raiderBreakChecked: boolean
  endAt: number
  reported: boolean
  sys: Record<string, SimSystem>
  weapons: SimWeapon[]
  selWeapon: number | null
  enemy: {
    hull: number
    maxHull: number
    shieldLayers: number
    shieldTimer: number
    shieldIonUntil: number
    repairTimer: number
    evade: number
    sys: Record<string, SimEnemySystem>
    guns: Array<{ kind: WeaponKind; label: string; charge: number; time: number; shots: number; dmg: number }>
  }
  shots: Shot[]
  floaters: Array<{ x: number; y: number; text: string; color: string; t0: number }>
  flash: Record<string, number>
  log: Array<{ text: string; color: string }>
}

const REACTOR = 10

const PROOMS: Record<string, { x: number; y: number; w: number; h: number; label: string }> = {
  engines: { x: 10, y: 33, w: 13, h: 30, label: 'ENGINES' },
  shields: { x: 26, y: 35, w: 12, h: 26, label: 'SHIELDS' },
  weapons2: { x: 41, y: 20, w: 12, h: 15, label: 'WEAPONS 2' },
  launch: { x: 41, y: 39, w: 12, h: 15, label: 'LAUNCH BAY' },
  weapons1: { x: 41, y: 58, w: 12, h: 15, label: 'WEAPONS 1' },
  sensors: { x: 56, y: 35, w: 12, h: 26, label: 'SENSORS' },
  helm: { x: 76, y: 36, w: 13, h: 24, label: 'HELM' },
}

const EROOMS: Record<string, { x: number; y: number; w: number; h: number; label: string }> = {
  helm: { x: 30, y: 14, w: 40, h: 10, label: 'HELM' },
  weapons: { x: 26, y: 32, w: 48, h: 12, label: 'WEAPONS' },
  shields: { x: 26, y: 50, w: 48, h: 12, label: 'SHIELDS' },
  engines: { x: 28, y: 70, w: 44, h: 13, label: 'ENGINES' },
}

function buildSim(params: BattleParams, cls: ShipClass): Sim {
  const weapons: SimWeapon[] = [
    { name: 'PULSE LASER', kind: 'laser', room: 'weapons1', cost: 1, time: 8, charge: 0, shots: 2, dmg: 1, mode: 'auto', target: 'shields', color: '#ff6b5e' },
    { name: 'HELLION MISSILE', kind: 'missile', room: 'weapons1', cost: 1, time: 13, charge: 0, shots: 1, dmg: 2, ammo: params.missiles, mode: 'off', target: null, color: '#ffb454' },
  ]
  if (params.hasIon)
    weapons.push({ name: 'ION DISRUPTOR', kind: 'ion', room: 'weapons2', cost: 1, time: 7, charge: 0, shots: 1, dmg: 0, mode: 'off', target: null, color: '#5fd8ff' })
  if (params.hasBeam)
    weapons.push({ name: 'FOCUS BEAM', kind: 'beam', room: 'weapons2', cost: 2, time: 15, charge: 0, shots: 1, dmg: 3, mode: 'off', target: null, color: '#c39bff' })

  return {
    phase: 'playing',
    paused: false,
    hull: params.hull,
    maxHull: params.hullMax,
    shieldLayers: 2,
    shieldTimer: 0,
    repairTimer: 0,
    retreat: false,
    retreatCharge: 0,
    launchCharge: 0,
    craft: params.drones,
    raiderBreakChecked: false,
    endAt: 0,
    reported: false,
    sys: {
      shields: { pw: 4, hp: 4, max: 4 },
      engines: { pw: 2, hp: 3, max: 3 },
      launch: { pw: 0, hp: 2, max: 2 },
      sensors: { pw: 1, hp: 1, max: 1 },
      weapons1: { hp: 3, max: 3 },
      weapons2: { hp: 3, max: 3 },
      helm: { hp: 2, max: 2 },
    },
    weapons,
    selWeapon: null,
    enemy: {
      hull: cls.hull,
      maxHull: cls.hull,
      shieldLayers: cls.shields,
      shieldTimer: 0,
      shieldIonUntil: 0,
      repairTimer: 0,
      evade: cls.evade,
      sys: {
        helm: { hp: 2, max: 2, ionUntil: 0 },
        weapons: { hp: 4, max: 4, ionUntil: 0 },
        shields: { hp: 4, max: 4, ionUntil: 0 },
        engines: { hp: 3, max: 3, ionUntil: 0 },
      },
      guns: cls.guns.map((g) => ({ ...g, charge: 0.15 })),
    },
    shots: [],
    floaters: [],
    flash: {},
    log: [
      { text: 'Hostile contact holding its lock. Weapons free.', color: '#ffb454' },
      { text: 'Click a weapon, then an enemy compartment to target it.', color: '#8ea6c4' },
    ],
  }
}

export function BattleScreen() {
  const state = useGame((s) => s.state)
  const dispatch = useDispatch()
  const [, force] = useReducer((n: number) => n + 1, 0)
  const areaRef = useRef<HTMLDivElement | null>(null)
  const acRef = useRef<AudioContext | null>(null)

  const combat = state.combat
  const index = useMemo(() => new GalaxyIndex(state.galaxy), [state.galaxy])
  const params = useMemo(() => battleParams(state, index), [index]) // frozen at battle start
  const cls = useMemo(() => (combat ? enemyClass(combat.enemy) : null), [combat?.enemy.classId])
  const simRef = useRef<Sim | null>(null)
  if (!simRef.current && cls) simRef.current = buildSim(params, cls)

  /* ------------------------------------------------------------------ */

  const sfx = (type: string, delay = 0) => {
    const c = acRef.current
    if (!c || c.state !== 'running') return
    const t = c.currentTime + Math.max(0, delay)
    const out = c.createGain()
    out.connect(c.destination)
    const osc = (shape: OscillatorType, f0: number, f1: number, dur: number, vol: number, curve = 1) => {
      const o = c.createOscillator(), g = c.createGain()
      o.type = shape
      o.frequency.setValueAtTime(f0, t)
      if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur * curve)
      g.gain.setValueAtTime(vol, t)
      g.gain.exponentialRampToValueAtTime(0.001, t + dur)
      o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.02)
    }
    const noise = (dur: number, vol: number, fc: number, f1?: number) => {
      const len = Math.ceil(c.sampleRate * dur), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0)
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
      const s = c.createBufferSource(); s.buffer = buf
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(fc, t)
      if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur)
      const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur)
      s.connect(f); f.connect(g); g.connect(out); s.start(t); s.stop(t + dur + 0.02)
    }
    if (type === 'laser') osc('square', 880, 180, 0.13, 0.08)
    else if (type === 'missile') noise(0.45, 0.12, 600, 150)
    else if (type === 'ion') { osc('sine', 520, 300, 0.22, 0.1); osc('sine', 780, 450, 0.22, 0.05) }
    else if (type === 'beam') osc('sawtooth', 140, 900, 0.4, 0.07, 0.7)
    else if (type === 'fighter') { osc('triangle', 320, 640, 0.18, 0.09); noise(0.25, 0.05, 1800, 900) }
    else if (type === 'impact') { noise(0.18, 0.16, 900, 200); osc('sine', 120, 45, 0.22, 0.16) }
    else if (type === 'shield') { osc('sine', 1400, 1000, 0.16, 0.09); osc('sine', 2100, 1500, 0.12, 0.04) }
  }

  const pt = (id: string) => {
    const el = document.getElementById(id), a = areaRef.current
    if (!el || !a) return { x: 200, y: 200 }
    const r = el.getBoundingClientRect(), b = a.getBoundingClientRect()
    return { x: r.left + r.width / 2 - b.left, y: r.top + r.height / 2 - b.top }
  }

  const eff = (sys: SimEnemySystem, now: number) => (now < sys.ionUntil ? 0 : sys.hp)
  const weaponPowerUsed = (st: Sim) => st.weapons.reduce((a, w) => a + (w.mode !== 'off' ? w.cost : 0), 0)
  const freePower = (st: Sim) =>
    REACTOR - (st.sys.shields!.pw ?? 0) - (st.sys.engines!.pw ?? 0) - (st.sys.launch!.pw ?? 0) - (st.sys.sensors!.pw ?? 0) - weaponPowerUsed(st)
  const addLog = (st: Sim, text: string, color: string) => { st.log.unshift({ text, color }); if (st.log.length > 6) st.log.length = 6 }
  const float = (st: Sim, x: number, y: number, text: string, color: string) => st.floaters.push({ x, y, text, color, t0: Date.now() })

  const endBattle = (st: Sim, phase: Sim['phase'], line: string, color: string) => {
    st.phase = phase
    st.endAt = Date.now()
    addLog(st, line, color)
  }

  const spawnShot = (st: Sim, side: Shot['side'], kind: WeaponKind, dmg: number, color: string, from: { x: number; y: number }, to: { x: number; y: number }, miss: boolean, t0: number, target: string) => {
    let x1 = to.x + (Math.random() - 0.5) * 16, y1 = to.y + (Math.random() - 0.5) * 16
    if (miss) { y1 += (Math.random() < 0.5 ? -1 : 1) * 95; x1 += (Math.random() - 0.5) * 60 }
    const dist = Math.hypot(x1 - from.x, y1 - from.y)
    const speed = { laser: 760, missile: 430, ion: 560, fighter: 240, beam: 99999 }[kind] || 600
    const dur = kind === 'beam' ? 180 : (dist / speed) * 1000
    st.shots.push({ side, kind, dmg, color, target, miss, x0: from.x, y0: from.y, x1, y1, t0, t1: t0 + dur, done: false })
    sfx(kind, (t0 - Date.now()) / 1000)
  }

  const fireWeapon = (st: Sim, w: SimWeapon, now: number) => {
    const e = st.enemy
    if (w.kind === 'missile') { if ((w.ammo ?? 0) <= 0) { w.mode = 'off'; return } w.ammo!-- }
    w.charge = 0
    const from = pt('proom-' + w.room), to = pt('eroom-' + w.target)
    const eng = eff(e.sys.engines!, now)
    const evade = Math.max(0, (eng > 0 ? e.evade + eng * 2 + (eff(e.sys.helm!, now) > 0 ? 4 : 0) : 0) - params.accuracy)
    for (let i = 0; i < w.shots; i++) {
      const miss = w.kind !== 'beam' && Math.random() * 100 < evade
      spawnShot(st, 'player', w.kind, w.dmg, w.color, from, to, miss, now + i * 240, w.target!)
    }
  }

  const launchFighter = (st: Sim, now: number) => {
    if (st.craft <= 0) return
    st.craft--
    const e = st.enemy
    const targets = Object.keys(EROOMS), target = targets[Math.floor(Math.random() * targets.length)]!
    const from = pt('proom-launch'), to = pt('eroom-' + target)
    const eng = eff(e.sys.engines!, now)
    const evade = Math.max(0, (eng > 0 ? e.evade + eng * 2 : 0) - params.accuracy)
    spawnShot(st, 'player', 'fighter', 1, '#7be8d8', from, to, Math.random() * 100 < evade, now, target)
  }

  const enemyFire = (st: Sim, g: Sim['enemy']['guns'][number], now: number) => {
    const rooms = ['helm', 'weapons1', 'weapons2', 'launch', 'shields', 'engines', 'sensors']
    const wts = [10, 15, 15, 13, 18, 15, 14]
    const from = pt('eroom-weapons')
    const evade = (st.sys.engines!.pw ?? 0) * 5
    for (let i = 0; i < g.shots; i++) {
      let roll = Math.random() * 100, target = rooms[0]!, acc = 0
      for (let k = 0; k < rooms.length; k++) { acc += wts[k]!; if (roll < acc) { target = rooms[k]!; break } }
      const to = pt('proom-' + target)
      const miss = Math.random() * 100 < evade
      spawnShot(st, 'enemy', g.kind, g.dmg, g.kind === 'laser' ? '#ff8a5e' : '#ffd166', from, to, miss, now + i * 260, target)
    }
  }

  const enforceWeaponCap = (st: Sim, room: string) => {
    const cap = st.sys[room]!.hp
    let used = 0
    for (const w of st.weapons) {
      if (w.room === room && w.mode !== 'off') { used += w.cost; if (used > cap) { w.mode = 'off'; used -= w.cost } }
    }
  }

  const resolveShot = (st: Sim, p: Shot, now: number) => {
    if (!p.miss) {
      const shielded = p.side === 'player'
        ? (p.kind === 'beam' || p.kind === 'laser' || p.kind === 'fighter') && st.enemy.shieldLayers > 0
        : p.kind === 'laser' && st.shieldLayers > 0
      sfx(p.kind === 'ion' ? 'shield' : shielded ? 'shield' : 'impact')
    }
    if (p.side === 'player') {
      const e = st.enemy
      if (p.miss) { float(st, p.x1, p.y1, 'MISS', '#9fb4cc'); return }
      if (p.kind === 'beam') {
        if (e.shieldLayers > 0) { float(st, p.x1, p.y1, 'DEFLECTED', '#5fd8ff'); addLog(st, 'Focus beam deflected by their shields.', '#5fd8ff') }
        else {
          e.hull -= p.dmg
          const s = e.sys[p.target]; if (s) s.hp = Math.max(0, s.hp - 2)
          st.flash['e-' + p.target] = now + 340
          float(st, p.x1, p.y1, '-' + p.dmg, '#c39bff')
          addLog(st, 'Beam carved their ' + p.target.toUpperCase() + ' −' + p.dmg + ' hull.', '#c39bff')
        }
      } else if (p.kind === 'ion') {
        if (e.shieldLayers > 0) { e.shieldLayers--; e.shieldIonUntil = now + 4500; float(st, p.x1, p.y1, 'ION', '#5fd8ff'); addLog(st, 'Ion blast destabilised their shields.', '#5fd8ff') }
        else { const s = e.sys[p.target]; if (s) s.ionUntil = now + 6000; st.flash['e-' + p.target] = now + 340; float(st, p.x1, p.y1, 'IONIZED', '#5fd8ff'); addLog(st, 'Their ' + p.target.toUpperCase() + ' is ionised.', '#5fd8ff') }
      } else if ((p.kind === 'laser' || p.kind === 'fighter') && e.shieldLayers > 0) {
        e.shieldLayers--
        float(st, p.x1, p.y1, 'ABSORBED', '#5fd8ff')
      } else {
        e.hull -= p.dmg
        const s = e.sys[p.target]; if (s) s.hp = Math.max(0, s.hp - p.dmg)
        st.flash['e-' + p.target] = now + 340
        float(st, p.x1, p.y1, '-' + p.dmg, '#ff6b5e')
        addLog(st, 'Hit their ' + p.target.toUpperCase() + ' −' + p.dmg + ' hull.', '#ff6b5e')
      }
      if (e.hull <= 0) { e.hull = 0; endBattle(st, 'victory', 'The hostile comes apart.', '#7dffa8') }
    } else {
      if (p.miss) { float(st, p.x1, p.y1, 'MISS', '#9fb4cc'); return }
      if (p.kind === 'laser' && st.shieldLayers > 0) { st.shieldLayers--; float(st, p.x1, p.y1, 'ABSORBED', '#5fd8ff'); return }
      st.hull -= p.dmg
      const sys = st.sys[p.target]
      if (sys) { sys.hp = Math.max(0, sys.hp - 1); if (sys.pw !== undefined) sys.pw = Math.min(sys.pw, sys.hp) }
      if (p.target === 'weapons1' || p.target === 'weapons2') enforceWeaponCap(st, p.target)
      st.flash['p-' + p.target] = now + 340
      float(st, p.x1, p.y1, '-' + p.dmg, '#ff6b5e')
      addLog(st, 'Their ' + (p.kind === 'missile' ? 'missile' : 'laser') + ' hit ' + p.target.toUpperCase() + ' −' + p.dmg + ' hull.', '#ffb454')
      if (st.hull <= 0) { st.hull = 0; endBattle(st, 'defeat', 'Hull integrity lost.', '#ff6b5e') }
    }
  }

  const tick = () => {
    const st = simRef.current
    if (!st || !cls) return
    const now = Date.now(), dt = 0.05

    // A finished battle reports once, after the banner has had its moment.
    if (st.phase !== 'playing') {
      if (!st.reported && now - st.endAt > 1600) {
        st.reported = true
        const missilesLeft = st.weapons.find((w) => w.kind === 'missile')?.ammo ?? 0
        dispatch({ type: 'combatResolve', result: st.phase, hullLeft: st.hull, missilesLeft })
      }
      force()
      return
    }
    if (st.paused) { force(); return }

    // Player shields, repairs, weapons, launch bay, retreat drive.
    const maxL = Math.floor((st.sys.shields!.pw ?? 0) / 2)
    if (st.shieldLayers > maxL) st.shieldLayers = maxL
    if (st.shieldLayers < maxL) { st.shieldTimer += dt; if (st.shieldTimer >= 3) { st.shieldLayers++; st.shieldTimer = 0 } }
    st.repairTimer += dt
    if (st.repairTimer >= 6) {
      st.repairTimer = 0
      const worst = Object.entries(st.sys).filter(([, s]) => s.hp < s.max).sort((a, b) => a[1].hp - b[1].hp)[0]
      if (worst) { worst[1].hp++; addLog(st, 'Damage control repaired ' + worst[0].toUpperCase() + '.', '#7dffa8') }
    }
    for (const w of st.weapons) {
      if (w.mode === 'off') continue
      w.charge = Math.min(1, w.charge + (dt * params.chargeMult) / w.time)
      if (w.charge >= 1 && w.target && w.mode === 'auto') fireWeapon(st, w, now)
    }
    const L = st.sys.launch!
    if ((L.pw ?? 0) > 0 && L.hp > 0 && st.craft > 0) {
      st.launchCharge += (dt * (L.pw ?? 0)) / 22
      if (st.launchCharge >= 1) { st.launchCharge = 0; launchFighter(st, now) }
    } else st.launchCharge = 0

    if (st.retreat) {
      const pw = st.sys.engines!.pw ?? 0
      if (pw <= 0 || st.sys.engines!.hp <= 0) { /* the drive needs power and a room */ }
      else {
        st.retreatCharge += (dt * pw) / 26
        if (st.retreatCharge >= 1) {
          endBattle(st, 'fled', 'The drive answers. Breaking the lock.', '#7dffa8')
        }
      }
    } else st.retreatCharge = Math.max(0, st.retreatCharge - dt / 8)

    // Enemy shields, guns, repairs — and the ways a fight ends early.
    const e = st.enemy
    const eShMax = now < e.shieldIonUntil ? 0 : Math.min(cls.shields, Math.ceil(eff(e.sys.shields!, now) / 2))
    if (e.shieldLayers > eShMax) e.shieldLayers = eShMax
    if (e.shieldLayers < eShMax) { e.shieldTimer += dt; if (e.shieldTimer >= 3.5) { e.shieldLayers++; e.shieldTimer = 0 } }
    if (eff(e.sys.weapons!, now) > 0) {
      for (const g of e.guns) { g.charge += dt / g.time; if (g.charge >= 1) { g.charge = 0; enemyFire(st, g, now) } }
    }
    e.repairTimer += dt
    if (e.repairTimer >= 8) {
      e.repairTimer = 0
      const worst = Object.values(e.sys).filter((s) => s.hp < s.max).sort((a, b) => a.hp - b.hp)[0]
      if (worst) worst.hp++
    }

    // Intelligence takes surrenders; raiders just stop finding this profitable.
    if (combat?.enemy.faction && params.intel && e.hull > 0 && e.hull <= e.maxHull * YIELD_HULL_FRACTION) {
      endBattle(st, 'yielded', 'They strike their colours — you know too much about them.', '#7dffa8')
    }
    if (!combat?.enemy.faction && !st.raiderBreakChecked && e.hull > 0 && e.hull <= e.maxHull * RAIDER_BREAK_FRACTION) {
      st.raiderBreakChecked = true
      if (Math.random() < 0.5) endBattle(st, 'driven-off', 'The raider breaks and burns for the dark.', '#7dffa8')
    }

    for (const p of st.shots) { if (!p.done && now >= p.t1) { p.done = true; resolveShot(st, p, now) } }
    st.shots = st.shots.filter((p) => now < p.t1 + (p.kind === 'beam' ? 450 : 120))
    st.floaters = st.floaters.filter((f) => now - f.t0 < 1300)
    force()
  }

  useEffect(() => {
    acRef.current = new (window.AudioContext || (window as never as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const resume = () => { if (acRef.current?.state === 'suspended') void acRef.current.resume() }
    window.addEventListener('pointerdown', resume)
    const iv = setInterval(tick, 50)
    const key = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        const st = simRef.current
        if (st && st.phase === 'playing') st.paused = !st.paused
      }
    }
    window.addEventListener('keydown', key)
    return () => {
      clearInterval(iv)
      window.removeEventListener('keydown', key)
      window.removeEventListener('pointerdown', resume)
      void acRef.current?.close()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const st = simRef.current
  if (!st || !combat || !cls) return null
  const now = Date.now()
  const freePw = freePower(st)
  const area = areaRef.current
  const scale = area ? Math.min(area.clientWidth / 1915, area.clientHeight / 815, 1.6) : 0.7

  const addPower = (id: string, delta: number) => {
    const s = st.sys[id]!
    if (delta > 0) {
      if (freePower(st) <= 0) { addLog(st, 'No free reactor power.', '#ffb454'); return }
      if ((s.pw ?? 0) >= Math.min(s.hp, s.max)) return
      s.pw = (s.pw ?? 0) + 1
    } else {
      if ((s.pw ?? 0) <= 0) return
      s.pw = (s.pw ?? 0) - 1
    }
    force()
  }

  const pips = (sys: SimSystem) => {
    const arr: Array<{ bg: string; border: string }> = []
    for (let i = 0; i < sys.max; i++) {
      arr.push(i < sys.hp
        ? { bg: i < (sys.pw ?? sys.hp) ? '#7dffa8' : '#2a4058', border: '#3a5a7a' }
        : { bg: '#5a1f1a', border: '#8a3a30' })
    }
    return arr
  }

  const banner = st.phase !== 'playing'
  const bannerText = {
    victory: 'TARGET DESTROYED', 'driven-off': 'HOSTILE WITHDRAWING', yielded: 'THEY STRIKE THEIR COLOURS',
    fled: 'CLEAN BREAK', defeat: 'HULL LOST', playing: '',
  }[st.phase]
  const bannerColor = st.phase === 'defeat' ? '#ff6b5e' : '#7dffa8'

  return (
    <div className="battle-screen" onPointerDown={() => { /* audio unlock via listener */ }}>
      {/* Top strip: our hull, shields, evade, reactor */}
      <div className="battle-top">
        <div className="battle-gauges">
          <div className="battle-row">
            <span className="battle-tag">HULL</span>
            <div className="battle-bar"><i style={{ width: `${(st.hull / st.maxHull) * 100}%`, background: st.hull / st.maxHull > 0.5 ? '#7dffa8' : st.hull / st.maxHull > 0.25 ? '#ffd166' : '#ff6b5e' }} /></div>
            <span className="battle-num">{st.hull}/{st.maxHull}</span>
          </div>
          <div className="battle-row">
            <span className="battle-tag">SHIELDS</span>
            {[0, 1].map((i) => (
              <span key={i} className="shield-pip" style={{ background: i < st.shieldLayers ? '#5fd8ff' : 'transparent', boxShadow: i < st.shieldLayers ? '0 0 8px rgba(95,216,255,.8)' : 'none' }} />
            ))}
          </div>
        </div>
        <div className="battle-title">ISS INDEFATIGABLE</div>
        <span className="battle-stat" style={{ color: '#9fdfb4' }}>EVADE {(st.sys.engines!.pw ?? 0) * 5}%</span>
        <span className="battle-stat" style={{ color: freePw > 0 ? '#7dffa8' : '#ffb454' }}>REACTOR {freePw}/{REACTOR} FREE</span>
        <div style={{ flex: 1 }} />
        <button className="battle-btn" onClick={() => { if (st.phase === 'playing') { st.paused = !st.paused; force() } }}>
          {st.paused ? '▶ RESUME' : '‖ PAUSE'}
        </button>
        <button
          className="battle-btn"
          style={st.retreat ? { borderColor: '#ffd166', color: '#ffd166' } : undefined}
          onClick={() => { st.retreat = !st.retreat; addLog(st, st.retreat ? 'Charging the drive to break off — keep power on ENGINES.' : 'Break-off aborted.', '#ffd166'); force() }}
        >
          {st.retreat ? `◈ BREAKING OFF ${Math.round(st.retreatCharge * 100)}%` : '⟲ BREAK OFF'}
        </button>
      </div>

      {/* Battle area */}
      <div ref={areaRef} className="battle-area">
        <div className="battle-stage" style={{ transform: `translate(-50%,-50%) scale(${scale})` }}>
          {/* Player field */}
          <div className="battle-field field-player">
            <div className="field-label">ISS INDEFATIGABLE</div>
          </div>
          {/* Enemy field */}
          <div className="battle-field field-enemy" />
          <div className="battle-range">1.8 KM</div>

          {/* Player ship, side view, with rooms */}
          <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 1160, height: 660 }}>
            <img src="/assets/ships/indefatigable-combat.png" style={{ width: '100%', height: '100%', objectFit: 'fill', filter: 'drop-shadow(0 8px 22px rgba(0,0,0,.6))' }} draggable={false} />
            <div className="shield-bubble" style={{ inset: '-4% -2%', borderColor: `rgba(95,216,255,${st.shieldLayers === 2 ? 0.75 : st.shieldLayers === 1 ? 0.42 : 0})`, background: st.shieldLayers > 0 ? 'radial-gradient(ellipse, transparent 62%, rgba(95,216,255,.12) 100%)' : 'none' }} />
            {Object.entries(PROOMS).map(([id, r]) => {
              const sys = st.sys[id]!
              const fl = (st.flash['p-' + id] || 0) > now
              return (
                <div
                  key={id}
                  id={'proom-' + id}
                  className="battle-room room-player"
                  style={{
                    left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, height: `${r.h}%`,
                    borderColor: fl ? '#ff6b5e' : 'rgba(150,190,240,.55)',
                    background: fl ? 'rgba(255,90,60,.6)' : sys.hp < sys.max ? 'rgba(120,60,30,.82)' : 'rgba(10,22,42,.82)',
                  }}
                >
                  <div className="room-label">{r.label}</div>
                  <div className="room-pips">{pips(sys).map((p, i) => <i key={i} style={{ background: p.bg, borderColor: p.border }} />)}</div>
                </div>
              )
            })}
          </div>

          {/* Enemy ship, top-down, with rooms */}
          <div style={{ position: 'absolute', right: 130, bottom: 40, width: 380, height: 620 }}>
            <img src={cls.sprite} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', mixBlendMode: 'screen', filter: 'drop-shadow(0 8px 22px rgba(0,0,0,.6))' }} draggable={false} />
            <div className="shield-bubble" style={{ inset: '-3% -8%', borderColor: `rgba(255,140,90,${st.enemy.shieldLayers >= 2 ? 0.75 : st.enemy.shieldLayers === 1 ? 0.42 : 0})`, background: st.enemy.shieldLayers > 0 ? 'radial-gradient(ellipse, transparent 62%, rgba(255,140,90,.12) 100%)' : 'none' }} />
            {Object.entries(EROOMS).map(([id, r]) => {
              const sys = st.enemy.sys[id]!
              const fl = (st.flash['e-' + id] || 0) > now
              const ionised = now < sys.ionUntil
              const marks = st.weapons.filter((w) => w.mode !== 'off' && w.target === id)
              return (
                <div
                  key={id}
                  id={'eroom-' + id}
                  className="battle-room room-enemy"
                  style={{
                    left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, height: `${r.h}%`,
                    borderColor: fl ? '#ff6b5e' : ionised ? '#5fd8ff' : st.selWeapon != null ? '#ffd166' : 'rgba(240,190,150,.5)',
                    background: fl ? 'rgba(255,90,60,.6)' : sys.hp < sys.max ? 'rgba(120,55,28,.82)' : 'rgba(34,22,14,.7)',
                    cursor: st.selWeapon != null ? 'crosshair' : 'pointer',
                  }}
                  onClick={() => {
                    if (st.selWeapon == null) return
                    const w = st.weapons[st.selWeapon]!
                    w.target = id
                    addLog(st, w.name + ' targeting their ' + r.label + '.', '#ffd166')
                    st.selWeapon = null
                    force()
                  }}
                >
                  <div className="room-label" style={{ color: '#f0d8c8' }}>
                    {r.label}
                    {marks.length > 0 && <span className="room-marks">{marks.map((w, i) => <i key={i} style={{ background: w.color, boxShadow: `0 0 6px ${w.color}` }} />)}</span>}
                  </div>
                  <div className="room-pips">
                    {Array.from({ length: sys.max }, (_, i) => (
                      <i key={i} style={{ background: i < sys.hp ? '#c9927a' : '#5a1f1a', borderColor: i < sys.hp ? '#8a6a56' : '#8a3a30' }} />
                    ))}
                    {ionised && <span className="ion-tag">⌁ION</span>}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Enemy readout card */}
          <div className="enemy-card">
            <div className="enemy-card-head">
              <span>{combat.enemy.name.toUpperCase()}</span>
              <span style={{ color: '#c9927a' }}>{combat.enemy.faction ? 'PATROL' : 'RAIDER'}</span>
            </div>
            <div className="battle-row" style={{ marginTop: 6 }}>
              <span className="battle-tag" style={{ color: '#a8907e' }}>HULL</span>
              <div className="battle-bar" style={{ background: '#180f0c', borderColor: '#4a3227' }}><i style={{ width: `${(st.enemy.hull / st.enemy.maxHull) * 100}%`, background: '#d96a4a' }} /></div>
              <span className="battle-num" style={{ color: '#f2c9a8' }}>{st.enemy.hull}/{st.enemy.maxHull}</span>
              {Array.from({ length: cls.shields }, (_, i) => (
                <span key={i} className="shield-pip" style={{ borderColor: '#e88a5f', background: i < st.enemy.shieldLayers ? '#e88a5f' : 'transparent' }} />
              ))}
            </div>
            {(st.sys.sensors!.pw ?? 0) > 0 && st.sys.sensors!.hp > 0 ? (
              <div style={{ marginTop: 7, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {st.enemy.guns.map((g, i) => (
                  <div key={i} className="battle-row">
                    <span className="battle-tag" style={{ color: '#a8907e', width: 56 }}>{g.label}</span>
                    <div className="battle-bar" style={{ height: 6, background: '#180f0c', borderColor: '#3a2a20' }}><i style={{ width: `${Math.min(1, g.charge) * 100}%`, background: g.kind === 'laser' ? '#ff8a5e' : '#ffd166' }} /></div>
                  </div>
                ))}
                <span className="sensors-note">SENSORS ONLINE — ENEMY WEAPON CHARGE VISIBLE</span>
              </div>
            ) : (
              <span className="sensors-note" style={{ marginTop: 7, display: 'block' }}>SENSORS DARK — POWER SEN TO READ THEIR CHARGE</span>
            )}
            {params.intel && combat.enemy.faction && (
              <span className="sensors-note" style={{ marginTop: 5, display: 'block', color: '#7fd4c1' }}>
                INTELLIGENCE HELD — THEY YIELD BELOW {Math.round(YIELD_HULL_FRACTION * 100)}% HULL
              </span>
            )}
          </div>

          {/* Shots and floaters */}
          {st.shots.filter((p) => now >= p.t0 && now < p.t1 + (p.kind === 'beam' ? 400 : 100)).map((p, i) => {
            const ang = (Math.atan2(p.y1 - p.y0, p.x1 - p.x0) * 180) / Math.PI
            if (p.kind === 'beam') {
              const len = Math.hypot(p.x1 - p.x0, p.y1 - p.y0)
              const age = (now - p.t0) / 580
              return <div key={i} className="battle-shot" style={{ left: p.x0, top: p.y0, width: len, height: 3, transform: `rotate(${ang}deg)`, transformOrigin: '0 50%', borderRadius: 2, opacity: Math.max(0, 1 - age), background: 'linear-gradient(90deg, rgba(195,155,255,.2), #c39bff)', boxShadow: '0 0 12px #c39bff' }} />
            }
            const t = Math.min(1, (now - p.t0) / (p.t1 - p.t0))
            const x = p.x0 + (p.x1 - p.x0) * t, y = p.y0 + (p.y1 - p.y0) * t
            if (p.kind === 'ion') return <div key={i} className="battle-shot" style={{ left: x - 5, top: y - 5, width: 10, height: 10, borderRadius: 5, background: 'radial-gradient(circle, #d8f6ff, #5fd8ff 60%, transparent)', boxShadow: '0 0 14px #5fd8ff' }} />
            if (p.kind === 'fighter') return <div key={i} className="battle-shot" style={{ left: x - 6, top: y - 4, width: 12, height: 8, transform: `rotate(${ang}deg)`, borderRadius: 3, background: 'linear-gradient(90deg, rgba(123,232,216,.3), #7be8d8 60%, #eafffb)', boxShadow: '0 0 10px #7be8d8' }} />
            if (p.kind === 'missile') return <div key={i} className="battle-shot" style={{ left: x, top: y, width: 15, height: 5, transform: `rotate(${ang}deg)`, borderRadius: 2, background: 'linear-gradient(90deg, transparent, #ffb454 40%, #fff0d0)', boxShadow: '0 0 10px #ffb454' }} />
            return <div key={i} className="battle-shot" style={{ left: x, top: y, width: 17, height: 3, transform: `rotate(${ang}deg)`, borderRadius: 2, background: `linear-gradient(90deg, transparent, ${p.color} 30%, #ffe0d8)`, boxShadow: `0 0 9px ${p.color}` }} />
          })}
          {st.floaters.map((f, i) => {
            const age = (now - f.t0) / 1300
            return <div key={i} className="battle-floater" style={{ left: f.x, top: f.y - 34 * age, color: f.color, opacity: Math.max(0, 1 - age * age), textShadow: `0 0 8px ${f.color}, 0 1px 2px #000` }}>{f.text}</div>
          })}
        </div>

        {st.selWeapon != null && (
          <div className="battle-hint">◈ {st.weapons[st.selWeapon]!.name} — CLICK AN ENEMY COMPARTMENT TO TARGET</div>
        )}
        {st.paused && <div className="battle-paused">‖ PAUSED — SPACE TO RESUME</div>}
        {banner && (
          <div className="battle-banner" style={{ color: bannerColor, borderColor: bannerColor, textShadow: `0 0 30px ${bannerColor}` }}>{bannerText}</div>
        )}
      </div>

      {/* Bottom strip: power allocation, launch bay, weapon cards */}
      <div className="battle-bottom">
        <div className="power-rows">
          {([['shields', 'SHD', true], ['engines', 'ENG', true], ['launch', 'LNC', true], ['sensors', 'SEN', true], ['weapons1', 'WP1', false], ['weapons2', 'WP2', false], ['helm', 'HLM', false]] as const).map(([id, short, adjustable]) => {
            const s = st.sys[id]!
            return (
              <div key={id} className="power-col">
                <div className="power-pips">
                  {Array.from({ length: s.max }, (_, i) => (
                    <i key={i} style={{ background: i < s.hp ? (s.pw !== undefined ? (i < s.pw ? '#7dffa8' : '#20344c') : '#7dffa8') : '#5a1f1a', borderColor: i < s.hp ? '#3a5a7a' : '#8a3a30' }} />
                  ))}
                </div>
                <span className="power-tag">{short}</span>
                <div className="power-btns" style={{ visibility: adjustable ? 'visible' : 'hidden' }}>
                  <button onClick={() => addPower(id, -1)}>−</button>
                  <button onClick={() => addPower(id, +1)}>+</button>
                </div>
              </div>
            )
          })}
        </div>
        <div className="battle-sep" />
        <div className="launch-card">
          <div className="launch-head"><span>LAUNCH BAY</span><span>CRAFT {st.craft}</span></div>
          <div className="battle-bar" style={{ height: 5 }}><i style={{ width: `${st.launchCharge * 100}%`, background: '#7be8d8' }} /></div>
          <span className="sensors-note">
            {st.craft <= 0 ? 'NO CRAFT REMAINING' : st.sys.launch!.hp <= 0 ? 'BAY DISABLED' : (st.sys.launch!.pw ?? 0) <= 0 ? 'UNPOWERED — RAISE LNC' : 'CHARGING — AUTO LAUNCH'}
          </span>
        </div>
        <div className="weapon-cards">
          {st.weapons.map((w, i) => {
            const on = w.mode !== 'off', ready = on && w.charge >= 1
            return (
              <div
                key={w.name}
                className="weapon-card"
                style={{ borderColor: st.selWeapon === i ? '#ffd166' : on ? '#3a5a7a' : '#22354f', background: on ? 'rgba(16,28,46,.85)' : 'rgba(10,16,26,.6)', animation: ready && (w.mode === 'hold' || !w.target) ? 'readyblink 1.2s infinite' : 'none' }}
                onClick={() => { if (w.mode === 'off') return; st.selWeapon = st.selWeapon === i ? null : i; force() }}
              >
                <div className="weapon-head">
                  <span style={{ color: w.color }}>{w.name}</span>
                  <span>{w.kind === 'missile' ? 'AMMO ' + (w.ammo ?? 0) : ''}</span>
                </div>
                <div className="battle-bar" style={{ height: 5 }}><i style={{ width: `${w.charge * 100}%`, background: ready ? '#7dffa8' : w.color }} /></div>
                <div className="weapon-foot">
                  <button
                    className="weapon-mode"
                    style={{
                      borderColor: w.mode === 'off' ? '#2c4568' : w.mode === 'hold' ? '#6b5722' : '#2a6b42',
                      color: w.mode === 'off' ? '#8ea6c4' : w.mode === 'hold' ? '#ffd166' : '#7dffa8',
                      background: w.mode === 'off' ? 'rgba(20,34,55,.4)' : w.mode === 'hold' ? 'rgba(50,40,10,.5)' : 'rgba(20,50,32,.6)',
                    }}
                    onClick={(ev) => {
                      ev.stopPropagation()
                      if (w.mode === 'off') {
                        const roomUsed = st.weapons.reduce((a, x) => a + (x.room === w.room && x.mode !== 'off' ? x.cost : 0), 0)
                        if (freePower(st) < w.cost || roomUsed + w.cost > st.sys[w.room]!.hp) return
                        w.mode = 'hold'
                      } else if (w.mode === 'hold') w.mode = 'auto'
                      else { w.mode = 'off'; w.charge = 0; if (st.selWeapon === i) st.selWeapon = null }
                      force()
                    }}
                  >
                    {w.mode === 'off' ? '○ OFF' : w.mode === 'hold' ? '◌ HOLD' : '▶ AUTO'}
                  </button>
                  <span style={{ color: w.target ? '#ffd166' : '#5a7089' }}>{w.target ? '→ ' + w.target.toUpperCase() : 'NO TARGET'}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Battle log */}
      <div className="battle-log">
        {st.log.slice(0, 2).map((l, i) => <div key={i} style={{ color: l.color, opacity: i === 0 ? 1 : 0.55 }}>{l.text}</div>)}
      </div>
    </div>
  )
}
