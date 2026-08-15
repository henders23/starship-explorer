import { useEffect, useMemo, useRef, useState } from 'react'
import { ENEMY_CLASSES, playerWeaponsFor, type EnemyGun, type PendingCombat, type PlayerWeaponSpec } from '../engine/combat/ships.js'
import { hullMaxFor, reactorFor } from '../engine/research/tech.js'
import { createRng, type Rng } from '../engine/rng/prng.js'
import { useDispatch, useGame } from './store.js'

/**
 * The tactical display: real-time, pausable, FTL-school ship combat.
 *
 * The battle runs entirely in this component — a reactor to allocate, rooms
 * that take damage, weapons that charge, target and fire, an enemy that
 * shoots back on its own clock. Only the *verdict* leaves the screen: when
 * the engagement ends, the result is dispatched as a `resolveCombat` action
 * and the pure reducer takes it from there. Rolls draw from a seeded RNG so
 * a re-mounted battle replays its opening identically.
 */

type PRoomId = 'engines' | 'shields' | 'weapons2' | 'launch' | 'weapons1' | 'sensors' | 'helm'
type ERoomId = 'helm' | 'weapons' | 'shields' | 'engines'

const PROOMS: Record<PRoomId, { x: number; y: number; w: number; h: number; label: string }> = {
  engines: { x: 10, y: 33, w: 13, h: 30, label: 'ENGINES' },
  shields: { x: 26, y: 35, w: 12, h: 26, label: 'SHIELDS' },
  weapons2: { x: 41, y: 20, w: 12, h: 15, label: 'WEAPONS 2' },
  launch: { x: 41, y: 39, w: 12, h: 15, label: 'LAUNCH BAY' },
  weapons1: { x: 41, y: 58, w: 12, h: 15, label: 'WEAPONS 1' },
  sensors: { x: 56, y: 35, w: 12, h: 26, label: 'SENSORS' },
  helm: { x: 76, y: 36, w: 13, h: 24, label: 'HELM' },
}
const EROOMS: Record<ERoomId, { x: number; y: number; w: number; h: number; label: string }> = {
  helm: { x: 37, y: 16, w: 26, h: 10, label: 'HELM' },
  weapons: { x: 34, y: 34, w: 32, h: 12, label: 'WEAPONS' },
  shields: { x: 34, y: 52, w: 32, h: 12, label: 'SHIELDS' },
  engines: { x: 33, y: 72, w: 34, h: 13, label: 'ENGINES' },
}

interface SysState {
  pw?: number
  hp: number
  max: number
}
interface ESysState {
  hp: number
  max: number
  ionUntil: number
}
interface BattleWeapon {
  spec: PlayerWeaponSpec
  charge: number
  mode: 'off' | 'hold' | 'auto'
  target: ERoomId | null
  ammo?: number
}
interface EnemyGunState extends EnemyGun {
  charge: number
}
interface Shot {
  side: 'player' | 'enemy'
  kind: string
  dmg: number
  color: string
  target: string
  miss: boolean
  x0: number
  y0: number
  x1: number
  y1: number
  t0: number
  t1: number
  done: boolean
}
interface Floater {
  x: number
  y: number
  text: string
  color: string
  t0: number
}
interface LogLine {
  text: string
  color: string
}

interface Battle {
  phase: 'playing' | 'victory' | 'defeat' | 'withdrawn'
  paused: boolean
  hull: number
  maxHull: number
  reactor: number
  shieldLayers: number
  shieldTimer: number
  repairTimer: number
  launchCharge: number
  craft: number
  withdrawArmed: boolean
  withdrawCharge: number
  sys: Record<PRoomId, SysState>
  weapons: BattleWeapon[]
  selWeapon: number | null
  enemy: {
    hull: number
    maxHull: number
    shieldLayers: number
    maxShields: number
    shieldTimer: number
    shieldIonUntil: number
    repairTimer: number
    repairSecs: number
    sys: Record<ERoomId, ESysState>
    guns: EnemyGunState[]
  }
  shots: Shot[]
  floaters: Floater[]
  flash: Record<string, number>
  log: LogLine[]
}

function freshBattle(combat: PendingCombat, hull: number, maxHull: number, reactor: number, weapons: PlayerWeaponSpec[]): Battle {
  const cls = ENEMY_CLASSES[combat.enemy]
  return {
    phase: 'playing',
    paused: false,
    hull,
    maxHull,
    reactor,
    shieldLayers: 2,
    shieldTimer: 0,
    repairTimer: 0,
    launchCharge: 0,
    craft: 12,
    withdrawArmed: false,
    withdrawCharge: 0,
    sys: {
      shields: { pw: 4, hp: 4, max: 4 },
      engines: { pw: 2, hp: 3, max: 3 },
      launch: { pw: 0, hp: 2, max: 2 },
      sensors: { pw: 1, hp: 1, max: 1 },
      weapons1: { hp: 3, max: 3 },
      weapons2: { hp: 3, max: 3 },
      helm: { hp: 2, max: 2 },
    },
    weapons: weapons.map((spec, i) => ({
      spec,
      charge: 0,
      mode: i === 0 ? 'auto' : 'off',
      target: i === 0 ? 'shields' : null,
      ammo: spec.ammo,
    })),
    selWeapon: null,
    enemy: {
      hull: cls.hull,
      maxHull: cls.hull,
      shieldLayers: cls.shields,
      maxShields: cls.shields,
      shieldTimer: 0,
      shieldIonUntil: 0,
      repairTimer: 0,
      repairSecs: cls.repairSecs,
      sys: {
        helm: { hp: 2, max: 2, ionUntil: 0 },
        weapons: { hp: 4, max: 4, ionUntil: 0 },
        shields: { hp: 4, max: 4, ionUntil: 0 },
        engines: { hp: 3, max: 3, ionUntil: 0 },
      },
      guns: cls.guns.map((g, i) => ({ ...g, charge: i === 0 ? 0.2 : 0 })),
    },
    shots: [],
    floaters: [],
    flash: {},
    log: [
      { text: `${cls.name} on intercept. Weapons free.`, color: '#ffb454' },
      { text: 'Click a weapon, then an enemy room to target it.', color: '#8ea6c4' },
    ],
  }
}

export function CombatScreen() {
  const combat = useGame((s) => s.state.combat)
  const hull = useGame((s) => s.state.hull)
  const unlockedTech = useGame((s) => s.state.unlockedTech)
  const dispatch = useDispatch()

  const maxHull = hullMaxFor(unlockedTech)
  const reactor = reactorFor(unlockedTech)
  const weapons = useMemo(() => playerWeaponsFor(unlockedTech), [unlockedTech])

  const battleRef = useRef<Battle | null>(null)
  const rngRef = useRef<Rng | null>(null)
  const acRef = useRef<AudioContext | null>(null)
  const areaRef = useRef<HTMLDivElement | null>(null)
  const [, setTick] = useState(0)
  const [scale, setScale] = useState(0.8)

  if (combat && !battleRef.current) {
    battleRef.current = freshBattle(combat, hull, maxHull, reactor, weapons)
    rngRef.current = createRng(combat.seed)
  }

  useEffect(() => {
    if (!combat) return
    const measure = () => {
      const area = areaRef.current
      if (area) setScale(Math.min(area.clientWidth / 1915, area.clientHeight / 815, 2))
    }
    measure()
    window.addEventListener('resize', measure)

    const ac = new AudioContext()
    acRef.current = ac
    const resume = () => {
      if (ac.state === 'suspended') void ac.resume()
    }
    window.addEventListener('pointerdown', resume)

    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        const b = battleRef.current
        if (b && b.phase === 'playing') b.paused = !b.paused
      }
    }
    window.addEventListener('keydown', onKey)

    const iv = setInterval(() => {
      tick()
      setTick((t) => t + 1)
    }, 50)

    return () => {
      clearInterval(iv)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', measure)
      window.removeEventListener('pointerdown', resume)
      void ac.close()
      acRef.current = null
      battleRef.current = null
      rngRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combat?.seed])

  /* ---------------------------------------------------------------- sfx */

  function sfx(type: string, delay = 0) {
    const c = acRef.current
    if (!c || c.state !== 'running') return
    const t = c.currentTime + Math.max(0, delay)
    const out = c.createGain()
    out.connect(c.destination)
    const osc = (shape: OscillatorType, f0: number, f1: number, dur: number, vol: number, curve = 1) => {
      const o = c.createOscillator()
      const g = c.createGain()
      o.type = shape
      o.frequency.setValueAtTime(f0, t)
      if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur * curve)
      g.gain.setValueAtTime(vol, t)
      g.gain.exponentialRampToValueAtTime(0.001, t + dur)
      o.connect(g)
      g.connect(out)
      o.start(t)
      o.stop(t + dur + 0.02)
    }
    const noise = (dur: number, vol: number, fc: number, f1?: number) => {
      const len = Math.ceil(c.sampleRate * dur)
      const buf = c.createBuffer(1, len, c.sampleRate)
      const d = buf.getChannelData(0)
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
      const s = c.createBufferSource()
      s.buffer = buf
      const f = c.createBiquadFilter()
      f.type = 'bandpass'
      f.frequency.setValueAtTime(fc, t)
      if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur)
      const g = c.createGain()
      g.gain.setValueAtTime(vol, t)
      g.gain.exponentialRampToValueAtTime(0.001, t + dur)
      s.connect(f)
      f.connect(g)
      g.connect(out)
      s.start(t)
      s.stop(t + dur + 0.02)
    }
    if (type === 'laser') osc('square', 880, 180, 0.13, 0.08)
    else if (type === 'missile') noise(0.45, 0.12, 600, 150)
    else if (type === 'ion') {
      osc('sine', 520, 300, 0.22, 0.1)
      osc('sine', 780, 450, 0.22, 0.05)
    } else if (type === 'beam') osc('sawtooth', 140, 900, 0.4, 0.07, 0.7)
    else if (type === 'fighter') {
      osc('triangle', 320, 640, 0.18, 0.09)
      noise(0.25, 0.05, 1800, 900)
    } else if (type === 'impact') {
      noise(0.18, 0.16, 900, 200)
      osc('sine', 120, 45, 0.22, 0.16)
    } else if (type === 'shield') {
      osc('sine', 1400, 1000, 0.16, 0.09)
      osc('sine', 2100, 1500, 0.12, 0.04)
    }
  }

  /* --------------------------------------------------------------- rules */

  const effE = (sys: ESysState, now: number) => (now < sys.ionUntil ? 0 : sys.hp)

  function weaponPowerUsed(b: Battle): number {
    return b.weapons.reduce((a, w) => a + (w.mode !== 'off' ? w.spec.cost : 0), 0)
  }
  function freePower(b: Battle): number {
    const s = b.sys
    return b.reactor - (s.shields.pw ?? 0) - (s.engines.pw ?? 0) - (s.launch.pw ?? 0) - (s.sensors.pw ?? 0) - weaponPowerUsed(b)
  }
  function addLog(b: Battle, text: string, color: string) {
    b.log.unshift({ text, color })
    if (b.log.length > 6) b.log.length = 6
  }
  function float(b: Battle, x: number, y: number, text: string, color: string) {
    b.floaters.push({ x, y, text, color, t0: Date.now() })
  }
  function pt(id: string): { x: number; y: number } {
    const el = document.getElementById(id)
    const a = areaRef.current
    if (!el || !a) return { x: 200, y: 200 }
    const r = el.getBoundingClientRect()
    const br = a.getBoundingClientRect()
    return { x: r.left + r.width / 2 - br.left, y: r.top + r.height / 2 - br.top }
  }

  function tick() {
    const b = battleRef.current
    const rng = rngRef.current
    if (!b || !rng) return
    if (b.phase !== 'playing' || b.paused) return
    const now = Date.now()
    const dt = 0.05

    // Player shields regenerate under power.
    const maxL = Math.floor((b.sys.shields.pw ?? 0) / 2)
    if (b.shieldLayers > maxL) b.shieldLayers = maxL
    if (b.shieldLayers < maxL) {
      b.shieldTimer += dt
      if (b.shieldTimer >= 3) {
        b.shieldLayers++
        b.shieldTimer = 0
      }
    }

    // Damage control.
    b.repairTimer += dt
    if (b.repairTimer >= 6) {
      b.repairTimer = 0
      const worst = (Object.entries(b.sys) as [PRoomId, SysState][])
        .filter(([, s]) => s.hp < s.max)
        .sort((a, c) => a[1].hp - c[1].hp)[0]
      if (worst) {
        worst[1].hp++
        addLog(b, 'Damage control repaired ' + PROOMS[worst[0]].label + '.', '#7dffa8')
      }
    }

    // Weapons charge; auto weapons fire when ready.
    for (const w of b.weapons) {
      if (w.mode === 'off') continue
      w.charge = Math.min(1, w.charge + dt / w.spec.time)
      if (w.charge >= 1 && w.target && w.mode === 'auto') fireWeapon(b, rng, w, now)
    }

    // Launch bay.
    const L = b.sys.launch
    if ((L.pw ?? 0) > 0 && L.hp > 0 && b.craft > 0) {
      b.launchCharge += (dt * (L.pw ?? 0)) / 22
      if (b.launchCharge >= 1) {
        b.launchCharge = 0
        launchFighter(b, rng, now)
      }
    } else b.launchCharge = 0

    // Withdrawal: the engines buy the ship out of the fight.
    if (b.withdrawArmed) {
      const eng = b.sys.engines
      if ((eng.pw ?? 0) >= 2 && eng.hp > 0) {
        b.withdrawCharge = Math.min(1, b.withdrawCharge + (dt * (eng.pw ?? 0)) / 36)
        if (b.withdrawCharge >= 1) {
          b.phase = 'withdrawn'
          return
        }
      }
    } else if (b.withdrawCharge > 0) {
      b.withdrawCharge = Math.max(0, b.withdrawCharge - dt / 6)
    }

    // Enemy shields.
    const e = b.enemy
    const eShMax = now < e.shieldIonUntil ? 0 : Math.min(e.maxShields, Math.ceil(effE(e.sys.shields, now) / 2))
    if (e.shieldLayers > eShMax) e.shieldLayers = eShMax
    if (e.shieldLayers < eShMax) {
      e.shieldTimer += dt
      if (e.shieldTimer >= 3.5) {
        e.shieldLayers++
        e.shieldTimer = 0
      }
    }

    // Enemy guns.
    if (effE(e.sys.weapons, now) > 0) {
      for (const g of e.guns) {
        g.charge += dt / g.time
        if (g.charge >= 1) {
          g.charge = 0
          enemyFire(b, rng, g, now)
        }
      }
    }

    // Enemy damage control.
    e.repairTimer += dt
    if (e.repairTimer >= e.repairSecs) {
      e.repairTimer = 0
      const worst = Object.values(e.sys)
        .filter((s) => s.hp < s.max)
        .sort((a, c) => a.hp - c.hp)[0]
      if (worst) worst.hp++
    }

    // Shots land.
    for (const p of b.shots) {
      if (!p.done && now >= p.t1) {
        p.done = true
        resolveShot(b, p, now)
      }
    }
    b.shots = b.shots.filter((p) => now < p.t1 + (p.kind === 'beam' ? 450 : 120))
    b.floaters = b.floaters.filter((f) => now - f.t0 < 1300)
  }

  function fireWeapon(b: Battle, rng: Rng, w: BattleWeapon, now: number) {
    const e = b.enemy
    if (w.spec.kind === 'missile') {
      if ((w.ammo ?? 0) <= 0) {
        w.mode = 'off'
        return
      }
      w.ammo = (w.ammo ?? 0) - 1
    }
    w.charge = 0
    const from = pt('proom-' + w.spec.room)
    const to = pt('eroom-' + w.target)
    const eng = effE(e.sys.engines, now)
    const evade = eng > 0 ? 8 + eng * 3 + (effE(e.sys.helm, now) > 0 ? 4 : 0) : 0
    for (let i = 0; i < w.spec.shots; i++) {
      const miss = w.spec.kind !== 'beam' && rng.next() * 100 < evade
      spawnShot(b, 'player', w.spec.kind, w.spec.dmg, w.spec.color, from, to, miss, now + i * 240, w.target!, rng)
    }
  }

  function launchFighter(b: Battle, rng: Rng, now: number) {
    if (b.craft <= 0) return
    b.craft--
    const e = b.enemy
    const targets = Object.keys(EROOMS) as ERoomId[]
    const target = targets[Math.floor(rng.next() * targets.length)]!
    const from = pt('proom-launch')
    const to = pt('eroom-' + target)
    const eng = effE(e.sys.engines, now)
    const evade = eng > 0 ? 8 + eng * 3 : 0
    spawnShot(b, 'player', 'fighter', 1, '#7be8d8', from, to, rng.next() * 100 < evade, now, target, rng)
  }

  function enemyFire(b: Battle, rng: Rng, g: EnemyGunState, now: number) {
    const rooms: PRoomId[] = ['helm', 'weapons1', 'weapons2', 'launch', 'shields', 'engines', 'sensors']
    const wts = [10, 15, 15, 13, 18, 15, 14]
    const from = pt('eroom-weapons')
    const evade = (b.sys.engines.pw ?? 0) * 5
    for (let i = 0; i < g.shots; i++) {
      let roll = rng.next() * 100
      let target: PRoomId = rooms[0]!
      let acc = 0
      for (let k = 0; k < rooms.length; k++) {
        acc += wts[k]!
        if (roll < acc) {
          target = rooms[k]!
          break
        }
      }
      const to = pt('proom-' + target)
      const miss = rng.next() * 100 < evade
      spawnShot(b, 'enemy', g.kind, g.dmg, g.kind === 'laser' ? '#ff8a5e' : g.kind === 'ion' ? '#5fd8ff' : '#ffd166', from, to, miss, now + i * 260, target, rng)
    }
    addLog(b, 'Enemy fired ' + (g.kind === 'laser' ? 'a laser volley' : g.kind === 'ion' ? 'an ion blast' : 'a missile') + '.', '#c9927a')
  }

  function spawnShot(
    b: Battle,
    side: 'player' | 'enemy',
    kind: string,
    dmg: number,
    color: string,
    from: { x: number; y: number },
    to: { x: number; y: number },
    miss: boolean,
    t0: number,
    target: string,
    rng: Rng,
  ) {
    let x1 = to.x + (rng.next() - 0.5) * 16
    let y1 = to.y + (rng.next() - 0.5) * 16
    if (miss) {
      y1 += (rng.next() < 0.5 ? -1 : 1) * 95
      x1 += (rng.next() - 0.5) * 60
    }
    const dist = Math.hypot(x1 - from.x, y1 - from.y)
    const speed: Record<string, number> = { laser: 760, missile: 430, ion: 560, fighter: 240, beam: 99999 }
    const dur = kind === 'beam' ? 180 : (dist / (speed[kind] ?? 600)) * 1000
    b.shots.push({ side, kind, dmg, color, target, miss, x0: from.x, y0: from.y, x1, y1, t0, t1: t0 + dur, done: false })
    sfx(kind, (t0 - Date.now()) / 1000)
  }

  function resolveShot(b: Battle, p: Shot, now: number) {
    if (!p.miss) {
      const shielded =
        p.side === 'player'
          ? (p.kind === 'beam' || p.kind === 'laser' || p.kind === 'fighter') && b.enemy.shieldLayers > 0
          : p.kind === 'laser' && b.shieldLayers > 0
      sfx(p.kind === 'ion' || shielded ? 'shield' : 'impact')
    }
    if (p.side === 'player') {
      const e = b.enemy
      if (p.miss) {
        float(b, p.x1, p.y1, 'MISS', '#9fb4cc')
        return
      }
      if (p.kind === 'beam') {
        if (e.shieldLayers > 0) {
          float(b, p.x1, p.y1, 'DEFLECTED', '#5fd8ff')
          addLog(b, 'Focus Beam deflected by enemy shields.', '#5fd8ff')
        } else {
          e.hull -= p.dmg
          const s = e.sys[p.target as ERoomId]
          if (s) s.hp = Math.max(0, s.hp - 2)
          b.flash['e-' + p.target] = now + 340
          float(b, p.x1, p.y1, '-' + p.dmg, '#c39bff')
          addLog(b, 'Beam carved enemy ' + p.target.toUpperCase() + ' −' + p.dmg + ' hull.', '#c39bff')
        }
      } else if (p.kind === 'ion') {
        if (e.shieldLayers > 0) {
          e.shieldLayers--
          e.shieldIonUntil = now + 4500
          float(b, p.x1, p.y1, 'ION', '#5fd8ff')
          addLog(b, 'Ion blast destabilised enemy shields.', '#5fd8ff')
        } else {
          const s = e.sys[p.target as ERoomId]
          if (s) s.ionUntil = now + 6000
          b.flash['e-' + p.target] = now + 340
          float(b, p.x1, p.y1, 'IONISED', '#5fd8ff')
          addLog(b, 'Enemy ' + p.target.toUpperCase() + ' ionised.', '#5fd8ff')
        }
      } else if ((p.kind === 'laser' || p.kind === 'fighter') && e.shieldLayers > 0) {
        e.shieldLayers--
        float(b, p.x1, p.y1, 'ABSORBED', '#5fd8ff')
      } else {
        e.hull -= p.dmg
        const s = e.sys[p.target as ERoomId]
        if (s) s.hp = Math.max(0, s.hp - p.dmg)
        b.flash['e-' + p.target] = now + 340
        float(b, p.x1, p.y1, '-' + p.dmg, '#ff6b5e')
        addLog(b, 'Hit enemy ' + p.target.toUpperCase() + ' −' + p.dmg + ' hull.', '#ff6b5e')
      }
      if (e.hull <= 0) {
        e.hull = 0
        b.phase = 'victory'
      }
    } else {
      if (p.miss) {
        float(b, p.x1, p.y1, 'MISS', '#9fb4cc')
        return
      }
      if (p.kind === 'laser' && b.shieldLayers > 0) {
        b.shieldLayers--
        float(b, p.x1, p.y1, 'ABSORBED', '#5fd8ff')
        return
      }
      if (p.kind === 'ion') {
        if (b.shieldLayers > 0) {
          b.shieldLayers--
          float(b, p.x1, p.y1, 'ION', '#5fd8ff')
        } else {
          const sys = b.sys[p.target as PRoomId]
          if (sys && sys.pw !== undefined && sys.pw > 0) {
            sys.pw = Math.max(0, sys.pw - 1)
            float(b, p.x1, p.y1, 'POWER LOST', '#5fd8ff')
          }
        }
        return
      }
      b.hull -= p.dmg
      const sys = b.sys[p.target as PRoomId]
      if (sys) {
        sys.hp = Math.max(0, sys.hp - p.dmg)
        if (sys.pw !== undefined) sys.pw = Math.min(sys.pw, sys.hp)
      }
      if (p.target === 'weapons1' || p.target === 'weapons2') enforceWeaponCap(b, p.target)
      b.flash['p-' + p.target] = now + 340
      float(b, p.x1, p.y1, '-' + p.dmg, '#ff6b5e')
      addLog(b, 'Enemy ' + (p.kind === 'missile' ? 'missile' : 'laser') + ' hit ' + p.target.toUpperCase() + ' −' + p.dmg + ' hull.', '#ffb454')
      if (b.hull <= 0) {
        b.hull = 0
        b.phase = 'defeat'
      }
    }
  }

  function enforceWeaponCap(b: Battle, room: 'weapons1' | 'weapons2') {
    const cap = b.sys[room].hp
    let used = 0
    for (const w of b.weapons) {
      if (w.spec.room === room && w.mode !== 'off') {
        used += w.spec.cost
        if (used > cap) {
          w.mode = 'off'
          used -= w.spec.cost
        }
      }
    }
  }

  function addPower(id: PRoomId, delta: number) {
    const b = battleRef.current
    if (!b) return
    const s = b.sys[id]
    if (s.pw === undefined) return
    if (delta > 0) {
      if (freePower(b) <= 0) {
        addLog(b, 'No free reactor power.', '#ffb454')
        return
      }
      if (s.pw >= Math.min(s.hp, s.max)) return
      s.pw++
    } else {
      if (s.pw <= 0) return
      s.pw--
    }
    setTick((t) => t + 1)
  }

  /* -------------------------------------------------------------- render */

  if (!combat) return null
  const b = battleRef.current
  if (!b) return null
  const now = Date.now()
  const e = b.enemy
  const cls = ENEMY_CLASSES[combat.enemy]
  const freePw = freePower(b)
  const sensorsOn = (b.sys.sensors.pw ?? 0) > 0 && b.sys.sensors.hp > 0
  const selW = b.selWeapon !== null ? b.weapons[b.selWeapon] : null
  const engineOk = (b.sys.engines.pw ?? 0) >= 2 && b.sys.engines.hp > 0

  const pips = (sys: SysState) => {
    const arr: Array<{ bg: string; border: string }> = []
    for (let i = 0; i < sys.max; i++) {
      arr.push(
        i < sys.hp
          ? { bg: i < (sys.pw ?? sys.hp) ? '#7dffa8' : '#2a4058', border: '#3a5a7a' }
          : { bg: '#5a1f1a', border: '#8a3a30' },
      )
    }
    return arr
  }

  const finish = () => {
    const result = b.phase === 'victory' ? 'victory' : b.phase === 'defeat' ? 'defeat' : 'withdrawn'
    dispatch({ type: 'resolveCombat', result, hull: b.hull })
  }

  const mono = "'IBM Plex Mono', monospace"

  return (
    <div className="fixed inset-0 z-40 flex flex-col" style={{ background: '#05080f', color: '#cfe3f5', userSelect: 'none' }}>
      {/* Status bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 22, padding: '9px 18px', background: 'rgba(7,12,21,.92)', borderBottom: '1px solid #1a2940', zIndex: 5 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: mono, fontSize: 10, color: '#8ea6c4', letterSpacing: 1, width: 56 }}>HULL</span>
            <div style={{ width: 170, height: 12, background: '#101c2e', border: '1px solid #27405f', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${Math.round((b.hull / b.maxHull) * 100)}%`, height: '100%', background: b.hull / b.maxHull > 0.5 ? '#7dffa8' : b.hull / b.maxHull > 0.25 ? '#ffd166' : '#ff6b5e', transition: 'width .2s' }} />
            </div>
            <span style={{ fontFamily: mono, fontSize: 11, color: '#e8f2ff' }}>{b.hull}/{b.maxHull}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: mono, fontSize: 10, color: '#8ea6c4', letterSpacing: 1, width: 56 }}>SHIELDS</span>
            {[0, 1].map((i) => (
              <div key={i} style={{ width: 13, height: 13, borderRadius: '50%', border: '1.5px solid #3fbfe8', background: i < b.shieldLayers ? '#5fd8ff' : 'transparent', boxShadow: i < b.shieldLayers ? '0 0 8px rgba(95,216,255,.8)' : 'none' }} />
            ))}
          </div>
        </div>
        <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: 2.5, color: '#e8f2ff' }}>ISS ITHACA</div>
        <div style={{ fontFamily: mono, fontSize: 11, color: '#9fdfb4' }}>EVADE {(b.sys.engines.pw ?? 0) * 5}%</div>
        <div style={{ fontFamily: mono, fontSize: 11, color: freePw > 0 ? '#7dffa8' : '#ffb454' }}>
          REACTOR {freePw}/{b.reactor} FREE
        </div>
        <div style={{ flex: 1 }} />
        {!combat.noWithdraw && (
        <button
          onClick={() => {
            b.withdrawArmed = !b.withdrawArmed
            setTick((t) => t + 1)
          }}
          style={{ fontFamily: mono, fontSize: 11, padding: '5px 14px', border: `1px solid ${b.withdrawArmed ? '#6b5722' : '#2c4568'}`, borderRadius: 3, cursor: 'pointer', color: b.withdrawArmed ? '#ffd166' : '#bcd6f2', background: b.withdrawArmed ? 'rgba(50,40,10,.6)' : 'rgba(20,34,55,.6)' }}
          title="Charge the engines to break off. Needs 2+ engine power."
        >
          {b.withdrawArmed ? `◍ WITHDRAWING ${Math.round(b.withdrawCharge * 100)}%${engineOk ? '' : ' — NEED ENG 2+'}` : '◌ WITHDRAW'}
        </button>
        )}
        {combat.noWithdraw && (
          <div style={{ fontFamily: mono, fontSize: 11, padding: '5px 14px', color: '#8a3a30', letterSpacing: 1 }}>NO WITHDRAWAL — COMMITTED</div>
        )}
        <button
          onClick={() => {
            if (b.phase === 'playing') b.paused = !b.paused
            setTick((t) => t + 1)
          }}
          style={{ fontFamily: mono, fontSize: 11, padding: '5px 14px', border: '1px solid #2c4568', borderRadius: 3, cursor: 'pointer', color: '#bcd6f2', background: 'rgba(20,34,55,.6)' }}
        >
          {b.paused ? '▶ RESUME' : '‖ PAUSE'}
        </button>
      </div>

      {/* Battle area */}
      <div ref={areaRef} style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        <div style={{ position: 'absolute', left: '50%', top: '50%', width: 1900, height: 800, transform: `translate(-50%,-50%) scale(${scale})` }}>
          {/* Player field */}
          <div
            style={{
              position: 'absolute', left: 0, top: 0, width: 1180, height: 798,
              border: '1.5px solid rgba(120,170,230,.35)', borderRadius: 8,
              backgroundColor: 'rgba(15,25,45,.35)',
              backgroundImage:
                'radial-gradient(circle at 12% 22%, rgba(170,205,255,.9) 0.7px, transparent 1.4px),radial-gradient(circle at 65% 72%, rgba(255,255,255,.75) 0.7px, transparent 1.4px),radial-gradient(ellipse 70% 60% at 70% 30%, rgba(40,70,130,.25), transparent 65%)',
              backgroundSize: '280px 280px,360px 360px,100% 100%',
              pointerEvents: 'none', boxSizing: 'border-box', overflow: 'hidden',
            }}
          >
            <div style={{ position: 'absolute', top: 10, left: 14, fontFamily: mono, fontSize: 9, letterSpacing: 2, color: '#8ab4e0' }}>ISS ITHACA</div>
          </div>
          {/* Enemy field */}
          <div
            style={{
              position: 'absolute', right: 0, top: 0, width: 620, height: 798,
              border: '1.5px solid rgba(230,150,100,.4)', borderRadius: 8,
              backgroundColor: 'rgba(30,18,12,.3)',
              backgroundImage:
                'radial-gradient(circle at 22% 32%, rgba(255,220,190,.8) 0.7px, transparent 1.4px),radial-gradient(circle at 70% 66%, rgba(255,255,255,.7) 0.6px, transparent 1.3px),radial-gradient(ellipse 80% 60% at 50% 40%, rgba(120,60,40,.18), transparent 65%)',
              backgroundSize: '260px 260px,330px 330px,100% 100%',
              pointerEvents: 'none', boxSizing: 'border-box', overflow: 'hidden',
            }}
          />
          <div style={{ position: 'absolute', left: 1188, width: 84, top: 400, borderTop: '1.5px dashed rgba(230,150,100,.4)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', left: 1180, width: 100, top: 379, textAlign: 'center', fontFamily: mono, fontSize: 9, color: '#c9927a', letterSpacing: 1, pointerEvents: 'none' }}>1.8 KM</div>

          {/* Player ship */}
          <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 1160, height: 660 }}>
            <img src="/assets/combat/ithaca-broadside.png" style={{ width: '100%', height: '100%', objectFit: 'fill', filter: 'drop-shadow(0 8px 22px rgba(0,0,0,.6))' }} draggable={false} alt="ISS Ithaca broadside" />
            <div style={{ position: 'absolute', inset: '-4% -2%', borderRadius: '50%', border: `2px solid rgba(95,216,255,${b.shieldLayers === 2 ? 0.75 : b.shieldLayers === 1 ? 0.42 : 0})`, background: `radial-gradient(ellipse, transparent 62%, rgba(95,216,255,${b.shieldLayers > 0 ? 0.12 : 0}) 100%)`, animation: 'shieldpulse 2.4s infinite', pointerEvents: 'none' }} />
            {(Object.keys(PROOMS) as PRoomId[]).map((id) => {
              const r = PROOMS[id]
              const sys = b.sys[id]
              const fl = (b.flash['p-' + id] ?? 0) > now
              return (
                <div
                  key={id}
                  id={'proom-' + id}
                  style={{
                    position: 'absolute', left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, height: `${r.h}%`,
                    border: `1.5px solid ${fl ? '#ff6b5e' : 'rgba(150,190,240,.55)'}`,
                    background: fl ? 'rgba(255,90,60,.6)' : sys.hp < sys.max ? 'rgba(120,60,30,.82)' : 'rgba(10,22,42,.82)',
                    borderRadius: 3, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '2px 3px', boxSizing: 'border-box',
                  }}
                >
                  <div style={{ fontFamily: mono, fontSize: 14, fontWeight: 600, letterSpacing: 0.5, color: '#b8d2f0', textShadow: '0 1px 2px #000', textAlign: 'center', width: '100%' }}>{r.label}</div>
                  <div style={{ display: 'flex', gap: 2 }}>
                    {pips(sys).map((pip, i) => (
                      <div key={i} style={{ width: 6, height: 6, borderRadius: 1, background: pip.bg, border: `1px solid ${pip.border}` }} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Enemy ship */}
          <div style={{ position: 'absolute', right: 85, bottom: 10, width: 450, height: 700 }}>
            <img src="/assets/combat/enemy-vessel.png" style={{ position: 'absolute', left: '50%', top: '50%', width: 700, height: 450, transform: 'translate(-50%,-50%) rotate(-90deg)', filter: 'drop-shadow(0 8px 22px rgba(0,0,0,.6))' }} draggable={false} alt={cls.name} />
            <div style={{ position: 'absolute', inset: '-3% -8%', borderRadius: '50%', border: `2px solid rgba(255,140,90,${e.shieldLayers === 2 ? 0.75 : e.shieldLayers === 1 ? 0.42 : 0})`, background: `radial-gradient(ellipse, transparent 62%, rgba(255,140,90,${e.shieldLayers > 0 ? 0.12 : 0}) 100%)`, animation: 'shieldpulse 2.1s infinite', pointerEvents: 'none' }} />
            {(Object.keys(EROOMS) as ERoomId[]).map((id) => {
              const r = EROOMS[id]
              const sys = e.sys[id]
              const fl = (b.flash['e-' + id] ?? 0) > now
              const ion = now < sys.ionUntil
              const marks = b.weapons.filter((w) => w.mode !== 'off' && w.target === id).map((w) => w.spec.color)
              const epips: Array<{ bg: string; border: string }> = []
              for (let i = 0; i < sys.max; i++) {
                epips.push(i < sys.hp ? { bg: '#7dffa8', border: '#3a5a7a' } : { bg: '#5a1f1a', border: '#8a3a30' })
              }
              return (
                <div
                  key={id}
                  id={'eroom-' + id}
                  onClick={() => {
                    if (b.selWeapon === null) return
                    const w = b.weapons[b.selWeapon]!
                    w.target = id
                    addLog(b, w.spec.name + ' targeting enemy ' + r.label + '.', '#ffd166')
                    b.selWeapon = null
                    setTick((t) => t + 1)
                  }}
                  style={{
                    position: 'absolute', left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, height: `${r.h}%`,
                    border: `1.5px solid ${fl ? '#ff6b5e' : ion ? '#5fd8ff' : b.selWeapon !== null ? '#ffd166' : 'rgba(240,190,150,.5)'}`,
                    background: fl ? 'rgba(255,90,60,.6)' : sys.hp < sys.max ? 'rgba(120,55,28,.82)' : 'rgba(34,22,14,.82)',
                    cursor: b.selWeapon !== null ? 'crosshair' : 'pointer',
                    borderRadius: 3, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '2px 4px', boxSizing: 'border-box',
                  }}
                >
                  <div style={{ position: 'relative', width: '100%' }}>
                    <div style={{ fontFamily: mono, fontSize: 14, fontWeight: 600, letterSpacing: 0.5, color: '#f0d8c8', textShadow: '0 1px 2px #000', textAlign: 'center' }}>{r.label}</div>
                    <div style={{ position: 'absolute', right: 2, top: 3, display: 'flex', gap: 3 }}>
                      {marks.map((color, i) => (
                        <div key={i} style={{ width: 8, height: 8, transform: 'rotate(45deg)', background: color, boxShadow: `0 0 6px ${color}` }} />
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    {epips.map((pip, i) => (
                      <div key={i} style={{ width: 6, height: 6, borderRadius: 1, background: pip.bg, border: `1px solid ${pip.border}` }} />
                    ))}
                    {ion && <div style={{ fontFamily: mono, fontSize: 8, color: '#5fd8ff', textShadow: '0 0 6px #5fd8ff' }}>⌁ION</div>}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Enemy readout */}
          <div style={{ position: 'absolute', right: 0, top: 0, width: 620, boxSizing: 'border-box', background: 'rgba(9,14,24,.85)', border: '1.5px solid rgba(230,150,100,.4)', borderRadius: '8px 8px 0 0', padding: '10px 14px', zIndex: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontWeight: 700, fontSize: 12, letterSpacing: 2, color: '#f2c9a8' }}>{cls.name}</div>
              <div style={{ fontFamily: mono, fontSize: 10, color: '#c9927a' }}>{cls.designation}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <span style={{ fontFamily: mono, fontSize: 9, color: '#a8907e' }}>HULL</span>
              <div style={{ flex: 1, height: 10, background: '#180f0c', border: '1px solid #4a3227', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${Math.round((e.hull / e.maxHull) * 100)}%`, height: '100%', background: '#d96a4a', transition: 'width .2s' }} />
              </div>
              <span style={{ fontFamily: mono, fontSize: 10, color: '#f2c9a8' }}>{e.hull}/{e.maxHull}</span>
              {[...Array(e.maxShields)].map((_, i) => (
                <div key={i} style={{ width: 11, height: 11, borderRadius: '50%', border: '1.5px solid #e88a5f', background: i < e.shieldLayers ? '#e88a5f' : 'transparent' }} />
              ))}
            </div>
            {sensorsOn && (
              <div style={{ marginTop: 7, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {e.guns.map((g, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: mono, fontSize: 9, color: '#a8907e', width: 56 }}>{g.label}</span>
                    <div style={{ flex: 1, height: 6, background: '#180f0c', border: '1px solid #3a2a20', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.round(Math.min(1, g.charge) * 100)}%`, height: '100%', background: g.kind === 'laser' ? '#ff8a5e' : g.kind === 'ion' ? '#5fd8ff' : '#ffd166' }} />
                    </div>
                  </div>
                ))}
                <div style={{ fontFamily: mono, fontSize: 8.5, color: '#6f5c4e' }}>SENSORS ONLINE — ENEMY WEAPON CHARGE VISIBLE</div>
              </div>
            )}
            <div style={{ marginTop: 7, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {b.log.slice(0, 4).map((line, i) => (
                <div key={i} style={{ fontFamily: mono, fontSize: 9, color: line.color, opacity: 1 - i * 0.2 }}>{line.text}</div>
              ))}
            </div>
          </div>
        </div>

        {/* Shots and floaters, in area coordinates */}
        {b.shots
          .filter((p) => now >= p.t0 && now < p.t1 + (p.kind === 'beam' ? 400 : 100))
          .map((p, i) => {
            const ang = (Math.atan2(p.y1 - p.y0, p.x1 - p.x0) * 180) / Math.PI
            if (p.kind === 'beam') {
              const len = Math.hypot(p.x1 - p.x0, p.y1 - p.y0)
              const age = (now - p.t0) / 580
              return (
                <div key={i} style={{ position: 'absolute', left: p.x0, top: p.y0, width: len, height: 3, background: 'linear-gradient(90deg, rgba(195,155,255,.2), #c39bff)', borderRadius: 2, boxShadow: '0 0 12px #c39bff', transform: `rotate(${ang}deg)`, transformOrigin: '0 50%', opacity: Math.max(0, 1 - age), pointerEvents: 'none', zIndex: 6 }} />
              )
            }
            const t = Math.min(1, (now - p.t0) / (p.t1 - p.t0))
            const x = p.x0 + (p.x1 - p.x0) * t
            const y = p.y0 + (p.y1 - p.y0) * t
            if (p.kind === 'ion')
              return <div key={i} style={{ position: 'absolute', left: x - 5, top: y - 5, width: 10, height: 10, borderRadius: 5, background: 'radial-gradient(circle, #d8f6ff, #5fd8ff 60%, transparent)', boxShadow: '0 0 14px #5fd8ff', pointerEvents: 'none', zIndex: 6 }} />
            if (p.kind === 'fighter')
              return <div key={i} style={{ position: 'absolute', left: x - 6, top: y - 4, width: 12, height: 8, borderRadius: 3, background: 'linear-gradient(90deg, rgba(123,232,216,.3), #7be8d8 60%, #eafffb)', boxShadow: '0 0 10px #7be8d8', transform: `rotate(${ang}deg)`, pointerEvents: 'none', zIndex: 6 }} />
            if (p.kind === 'missile')
              return <div key={i} style={{ position: 'absolute', left: x, top: y, width: 15, height: 5, borderRadius: 2, background: 'linear-gradient(90deg, transparent, #ffb454 40%, #fff0d0)', boxShadow: '0 0 10px #ffb454', transform: `rotate(${ang}deg)`, pointerEvents: 'none', zIndex: 6 }} />
            return <div key={i} style={{ position: 'absolute', left: x, top: y, width: 17, height: 3, borderRadius: 2, background: `linear-gradient(90deg, transparent, ${p.color} 30%, #ffe0d8)`, boxShadow: `0 0 9px ${p.color}`, transform: `rotate(${ang}deg)`, pointerEvents: 'none', zIndex: 6 }} />
          })}
        {b.floaters.map((f, i) => {
          const age = (now - f.t0) / 1300
          return (
            <div key={i} style={{ position: 'absolute', left: f.x, top: f.y - 34 * age, transform: 'translate(-50%,-50%)', fontFamily: mono, fontSize: 13, fontWeight: 600, color: f.color, opacity: Math.max(0, 1 - age * age), textShadow: `0 0 8px ${f.color}, 0 1px 2px #000`, pointerEvents: 'none', zIndex: 7 }}>
              {f.text}
            </div>
          )
        })}

        {selW && (
          <div style={{ position: 'absolute', left: '50%', bottom: 12, transform: 'translateX(-50%)', fontFamily: mono, fontSize: 12, color: '#ffd166', background: 'rgba(20,16,5,.85)', border: '1px solid #6b5722', padding: '6px 16px', borderRadius: 3, zIndex: 8 }}>
            ◈ {selW.spec.name} — CLICK AN ENEMY ROOM TO TARGET
          </div>
        )}
        {b.paused && (
          <div style={{ position: 'absolute', left: '50%', top: 14, transform: 'translateX(-50%)', fontFamily: mono, fontSize: 13, letterSpacing: 4, color: '#ffd166', background: 'rgba(20,16,5,.9)', border: '1px solid #6b5722', padding: '7px 22px', borderRadius: 3, zIndex: 9 }}>
            ‖ PAUSED — SPACE TO RESUME
          </div>
        )}
      </div>

      {/* Console: power, launch bay, weapons */}
      <div style={{ display: 'flex', gap: 12, padding: '7px 14px', background: 'rgba(7,12,21,.94)', borderTop: '1px solid #1a2940', alignItems: 'stretch', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
          {(
            [
              ['shields', 'SHD', true],
              ['engines', 'ENG', true],
              ['launch', 'LNC', true],
              ['sensors', 'SEN', true],
              ['weapons1', 'WP1', false],
              ['weapons2', 'WP2', false],
              ['helm', 'HLM', false],
            ] as Array<[PRoomId, string, boolean]>
          ).map(([id, short, adjustable]) => {
            const s = b.sys[id]
            const rowPips: Array<{ bg: string; border: string }> = []
            for (let i = 0; i < s.max; i++) {
              rowPips.push(
                i < s.hp
                  ? { bg: (s.pw !== undefined ? i < s.pw : true) ? '#7dffa8' : '#20344c', border: '#3a5a7a' }
                  : { bg: '#5a1f1a', border: '#8a3a30' },
              )
            }
            return (
              <div key={id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: 2 }}>
                  {rowPips.map((pip, i) => (
                    <div key={i} style={{ width: 17, height: 6, borderRadius: 1, background: pip.bg, border: `1px solid ${pip.border}` }} />
                  ))}
                </div>
                <div style={{ fontFamily: mono, fontSize: 8, color: '#8ea6c4', letterSpacing: 0.5 }}>{short}</div>
                <div style={{ display: 'flex', gap: 2, visibility: adjustable ? 'visible' : 'hidden' }}>
                  <button onClick={() => addPower(id, -1)} style={{ width: 16, height: 14, border: '1px solid #2c4568', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#bcd6f2', fontSize: 11, background: 'rgba(20,34,55,.6)', padding: 0 }}>−</button>
                  <button onClick={() => addPower(id, 1)} style={{ width: 16, height: 14, border: '1px solid #2c4568', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#bcd6f2', fontSize: 11, background: 'rgba(20,34,55,.6)', padding: 0 }}>+</button>
                </div>
              </div>
            )
          })}
        </div>
        <div style={{ width: 1, background: '#1a2940' }} />
        <div style={{ width: 158, border: '1.5px solid #2a6b5f', borderRadius: 4, background: 'rgba(10,30,26,.75)', padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: 3, alignSelf: 'flex-start', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 9.5, fontWeight: 600, color: '#7be8d8', letterSpacing: 0.5 }}>LAUNCH BAY</span>
            <span style={{ fontFamily: mono, fontSize: 8, color: '#8ea6c4' }}>CRAFT {b.craft}</span>
          </div>
          <div style={{ height: 5, background: '#0d1626', border: '1px solid #1e4038', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: `${Math.round(b.launchCharge * 100)}%`, height: '100%', background: '#7be8d8' }} />
          </div>
          <span style={{ fontFamily: mono, fontSize: 8, color: '#5a8a80' }}>
            {b.craft <= 0 ? 'NO CRAFT REMAINING' : b.sys.launch.hp <= 0 ? 'BAY DISABLED' : (b.sys.launch.pw ?? 0) <= 0 ? 'UNPOWERED — RAISE LNC' : 'CHARGING — AUTO LAUNCH'}
          </span>
        </div>
        <div style={{ flex: 1, display: 'flex', gap: 8 }}>
          {b.weapons.map((w, i) => {
            const on = w.mode !== 'off'
            const ready = on && w.charge >= 1
            return (
              <div
                key={w.spec.name}
                onClick={() => {
                  if (w.mode === 'off') return
                  b.selWeapon = b.selWeapon === i ? null : i
                  setTick((t) => t + 1)
                }}
                style={{
                  flex: 1, border: `1.5px solid ${b.selWeapon === i ? '#ffd166' : on ? '#3a5a7a' : '#22354f'}`, borderRadius: 4,
                  background: on ? 'rgba(16,28,46,.85)' : 'rgba(10,16,26,.6)', padding: '3px 6px', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', gap: 2,
                  animation: ready && (w.mode === 'hold' || !w.target) ? 'readyblink 1.2s infinite' : 'none',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 9.5, fontWeight: 600, color: w.spec.color, letterSpacing: 0.5 }}>{w.spec.name}</span>
                  <span style={{ fontFamily: mono, fontSize: 8, color: '#8ea6c4' }}>{w.spec.kind === 'missile' ? `AMMO ${w.ammo}` : ''}</span>
                </div>
                <div style={{ height: 5, background: '#0d1626', border: '1px solid #22354f', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.round(w.charge * 100)}%`, height: '100%', background: ready ? '#7dffa8' : w.spec.color }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button
                    onClick={(ev) => {
                      ev.stopPropagation()
                      if (w.mode === 'off') {
                        const roomUsed = b.weapons.reduce((a, x) => a + (x.spec.room === w.spec.room && x.mode !== 'off' ? x.spec.cost : 0), 0)
                        if (freePower(b) < w.spec.cost || roomUsed + w.spec.cost > b.sys[w.spec.room].hp) return
                        w.mode = 'hold'
                      } else if (w.mode === 'hold') w.mode = 'auto'
                      else {
                        w.mode = 'off'
                        w.charge = 0
                        if (b.selWeapon === i) b.selWeapon = null
                      }
                      setTick((t) => t + 1)
                    }}
                    style={{
                      fontFamily: mono, fontSize: 8.5, padding: '1px 7px', borderRadius: 2,
                      border: `1px solid ${w.mode === 'off' ? '#2c4568' : w.mode === 'hold' ? '#6b5722' : '#2a6b42'}`,
                      color: w.mode === 'off' ? '#8ea6c4' : w.mode === 'hold' ? '#ffd166' : '#7dffa8',
                      background: w.mode === 'off' ? 'rgba(20,34,55,.4)' : w.mode === 'hold' ? 'rgba(50,40,10,.5)' : 'rgba(20,50,32,.6)',
                      cursor: 'pointer', letterSpacing: 0.5,
                    }}
                  >
                    {w.mode === 'off' ? '○ OFF' : w.mode === 'hold' ? '◌ HOLD' : '▶ AUTO'}
                  </button>
                  <span style={{ fontFamily: mono, fontSize: 8, color: w.target ? '#ffd166' : '#5a7089' }}>
                    {w.target ? `→ ${w.target.toUpperCase()}` : 'NO TARGET'}
                  </span>
                </div>
              </div>
            )
          })}
          {b.weapons.length < 4 && (
            <div style={{ flex: 1, border: '1.5px dashed #22354f', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: mono, fontSize: 9, color: '#3d5166', letterSpacing: 1 }}>
              MOUNT EMPTY — SEE WARFARE RESEARCH
            </div>
          )}
        </div>
      </div>

      {/* End of engagement */}
      {b.phase !== 'playing' && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(3,6,12,.82)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, zIndex: 20 }}>
          <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: 10, color: b.phase === 'victory' ? '#7dffa8' : b.phase === 'withdrawn' ? '#ffd166' : '#ff6b5e', textShadow: `0 0 30px ${b.phase === 'victory' ? '#7dffa8' : b.phase === 'withdrawn' ? '#ffd166' : '#ff6b5e'}` }}>
            {b.phase === 'victory' ? 'VICTORY' : b.phase === 'withdrawn' ? 'DISENGAGED' : 'HULL LOST'}
          </div>
          <div style={{ fontFamily: mono, fontSize: 13, color: '#8ea6c4', maxWidth: 520, textAlign: 'center' }}>
            {b.phase === 'victory'
              ? `The ${cls.name} breaks apart. Salvage teams standing by.`
              : b.phase === 'withdrawn'
                ? 'The Ithaca pulls out of weapons range under emergency burn. The matter is not settled.'
                : 'The Ithaca succumbs to enemy fire. Escape pods away.'}
          </div>
          <button
            onClick={finish}
            style={{ marginTop: 10, fontFamily: mono, fontSize: 13, letterSpacing: 2, padding: '11px 30px', border: `1.5px solid ${b.phase === 'victory' ? '#7dffa8' : b.phase === 'withdrawn' ? '#ffd166' : '#ff6b5e'}`, borderRadius: 3, cursor: 'pointer', color: b.phase === 'victory' ? '#7dffa8' : b.phase === 'withdrawn' ? '#ffd166' : '#ff6b5e', background: 'transparent' }}
          >
            {b.phase === 'defeat' ? 'THE FINAL ENTRY' : 'RETURN TO THE BRIDGE'}
          </button>
        </div>
      )}
    </div>
  )
}
