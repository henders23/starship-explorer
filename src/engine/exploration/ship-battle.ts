import { createRng } from '../rng/prng.js'
import { SHIP_BY_ID } from '../combat/ships.js'
import type { EnemyRoomKey, ShipClass } from '../combat/ships.js'

export const SHIP_ROOMS: EnemyRoomKey[] = ['helm', 'weapons', 'shields', 'engines']
export const REACTOR_POWER = 8
export type ShipWeaponKind = 'laser' | 'missile' | 'ion' | 'beam'
export interface BattleRoom { hp: number; max: number; ionUntil: number }
export interface ShipWeapon { kind: ShipWeaponKind; name: string; cost: number; charge: number; period: number; damage: number; shots: number; mode: 'off' | 'hold' | 'auto'; target: EnemyRoomKey }
export interface BattleUpgrades { fireControl: boolean; ion: boolean; beam: boolean; layered: boolean; adaptive: boolean; translated: boolean; contextual: boolean; countermeasures: boolean }
export type ShipBattleResult = 'victory' | 'negotiated' | 'evaded' | 'yielded' | 'fled' | 'disabled' | 'cancelled'
export interface ShipBattle {
  seed: string; locationId: string; classId: string; phase: 'contact' | 'battle' | 'report'; hailed: boolean; result: ShipBattleResult | null
  hull: number; hullMax: number; upgrades: BattleUpgrades; time: number; rolls: number; toll: number
  power: { shields: number; engines: number; weapons: number }; rooms: Record<EnemyRoomKey, BattleRoom>
  shield: number; shieldWork: number; repair: EnemyRoomKey; repairWork: number; missiles: number
  weapons: ShipWeapon[]; escape: boolean; escapeWork: number
  enemy: { hull: number; maxHull: number; shield: number; shieldWork: number; repairWork: number; rooms: Record<EnemyRoomKey, BattleRoom>; charges: number[] }
  log: string[]; volley: { side: 'player' | 'enemy'; kind: ShipWeaponKind; target: EnemyRoomKey; hit: boolean; damage: number; id: number } | null; shots: number
}
export type ShipOrder =
  | { type: 'hail' | 'negotiate' | 'pay' | 'evade' | 'engage' | 'cancel' }
  | { type: 'advance'; seconds: number }
  | { type: 'power'; system: 'shields' | 'engines' | 'weapons'; amount: number }
  | { type: 'weapon'; index: number; mode: 'off' | 'hold' | 'auto' }
  | { type: 'target'; index: number; room: EnemyRoomKey }
  | { type: 'fire'; index: number }
  | { type: 'repair'; room: EnemyRoomKey }
  | { type: 'retreat'; active: boolean }
  | { type: 'accept-surrender' }
const room = (hp: number): BattleRoom => ({ hp, max: hp, ionUntil: 0 })
export function escortClass(seed: string, locationId: string, threat: number): ShipClass {
  const ids = threat >= 2 ? ['carrion-jack', 'reaver'] : ['rust-queen', 'magpie']
  return SHIP_BY_ID[createRng(`${seed}:${locationId}:escort-class`).pick(ids)]!
}
export function createShipBattle(seed: string, locationId: string, cls: ShipClass, hull: number, hullMax: number, upgrades: BattleUpgrades): ShipBattle {
  const weapons: ShipWeapon[] = [
    { kind: 'laser', name: 'Pulse laser', cost: 1, period: 8, charge: 0, damage: 1, shots: 2, mode: 'auto', target: 'weapons' },
    { kind: 'missile', name: 'Hellion missile', cost: 1, period: 13, charge: 0, damage: 2, shots: 1, mode: 'off', target: 'weapons' },
  ]
  if (upgrades.ion) weapons.push({ kind: 'ion', name: 'Ion projector', cost: 1, period: 7, charge: 0, damage: 0, shots: 1, mode: 'off', target: 'shields' })
  if (upgrades.beam) weapons.push({ kind: 'beam', name: 'Focus beam', cost: 2, period: 15, charge: 0, damage: 3, shots: 1, mode: 'off', target: 'weapons' })
  return { seed, locationId, classId: cls.id, phase: 'contact', hailed: false, result: null, hull, hullMax, upgrades, time: 0, rolls: 0, toll: 0,
    power: { shields: 2, engines: 2, weapons: 2 }, rooms: { helm: room(2), weapons: room(4), shields: room(4), engines: room(3) },
    shield: 1, shieldWork: 0, repair: 'weapons', repairWork: 0, missiles: 4, weapons, escape: false, escapeWork: 0,
    enemy: { hull: cls.hull, maxHull: cls.hull, shield: cls.shields, shieldWork: 0, repairWork: 0,
      rooms: { helm: room(cls.rooms.helm), weapons: room(cls.rooms.weapons), shields: room(cls.rooms.shields), engines: room(cls.rooms.engines) }, charges: cls.guns.map(() => 0) },
    log: ['The survey tender is holding beside us. An armed ship crosses its departure lane and transmits a demand for payment.'], volley: null, shots: 0 }
}
export const effectiveRoom = (b: ShipBattle, side: 'player' | 'enemy', key: EnemyRoomKey) => {
  const r = side === 'player' ? b.rooms[key] : b.enemy.rooms[key]
  return r.ionUntil > b.time ? 0 : r.hp
}
export const assignedPower = (b: ShipBattle) => b.power.shields + b.power.engines + b.power.weapons
export const weaponPower = (b: ShipBattle) => b.weapons.reduce((n, w) => n + (w.mode === 'off' ? 0 : w.cost), 0)
export const shieldCapacity = (b: ShipBattle) => Math.min(b.upgrades.layered ? 2 : 1, Math.floor(Math.min(b.power.shields, effectiveRoom(b, 'player', 'shields')) / 2))
export const enemyShieldCapacity = (b: ShipBattle) => Math.min(SHIP_BY_ID[b.classId]!.shields, Math.floor(effectiveRoom(b, 'enemy', 'shields') / 2))
export const evadeChance = (b: ShipBattle) => b.upgrades.countermeasures ? 85 : 65
export const surrenderAvailable = (b: ShipBattle) => b.phase === 'battle' && b.upgrades.contextual && b.enemy.hull <= b.enemy.maxHull * 0.3
export function fireLock(b: ShipBattle, index: number): string | null {
  const w = b.weapons[index]
  if (!w || !Number.isInteger(index)) return 'Unknown weapon'
  if (w.mode === 'off') return 'Power this weapon first'
  if (!effectiveRoom(b, 'player', 'weapons')) return 'Weapon compartment disabled; assign repairs'
  if (w.kind === 'missile' && !b.missiles) return 'Missile magazine empty'
  return w.charge < w.period ? 'Weapon charging' : null
}
export function shipOrderLock(b: ShipBattle, a: ShipOrder): string | null {
  if (!a || typeof a !== 'object') return 'Invalid bridge order'
  if (b.phase === 'report') return 'Acknowledge the encounter report'
  if (b.phase === 'contact') {
    if (a.type === 'hail') return b.hailed ? 'Channel already open' : null
    if (a.type === 'negotiate') return b.hailed && b.upgrades.contextual ? null : 'Hail first; requires Contextual Translation'
    if (a.type === 'pay') return b.hailed ? null : 'Hail to learn their price'
    if (['evade', 'engage', 'cancel'].includes(a.type)) return null
    return 'Resolve the contact first'
  }
  switch (a.type) {
    case 'advance': return Number.isInteger(a.seconds) && a.seconds >= 1 && a.seconds <= 5 ? null : 'Advance between one and five simulation seconds'
    case 'power': {
      if (!['shields', 'engines', 'weapons'].includes(a.system) || !Number.isInteger(a.amount)) return 'Unknown power setting'
      const max = a.system === 'shields' ? b.upgrades.layered ? 4 : 2 : a.system === 'engines' ? 3 : 4
      if (a.amount < 0 || a.amount > max) return `System accepts 0–${max} power`
      if (assignedPower(b) - b.power[a.system] + a.amount > REACTOR_POWER) return 'Reactor fully allocated; reduce another system first'
      return a.system === 'weapons' && a.amount < weaponPower(b) ? 'Switch off a weapon before reducing its power supply' : null
    }
    case 'weapon': {
      const w = b.weapons[a.index]
      if (!w || !Number.isInteger(a.index) || !['off', 'hold', 'auto'].includes(a.mode)) return 'Unknown weapon setting'
      return w.mode === 'off' && a.mode !== 'off' && weaponPower(b) + w.cost > b.power.weapons ? 'Allocate more reactor power to weapons first' : null
    }
    case 'target': return b.weapons[a.index] && Number.isInteger(a.index) && SHIP_ROOMS.includes(a.room) ? null : 'Select an enemy compartment'
    case 'fire': return fireLock(b, a.index)
    case 'repair': return SHIP_ROOMS.includes(a.room) ? null : 'Unknown repair compartment'
    case 'retreat': return typeof a.active === 'boolean' ? null : 'Invalid retreat order'
    case 'accept-surrender': return surrenderAvailable(b) ? null : 'Requires Contextual Translation and enemy hull at or below 30%'
    default: return 'Order unavailable in battle'
  }
}
function log(b: ShipBattle, text: string) { b.log.push(`${b.time}s · ${text}`); b.log = b.log.slice(-35) }
function finish(b: ShipBattle, result: ShipBattleResult, text: string) { b.phase = 'report'; b.result = result; log(b, text) }
function roll(b: ShipBattle, percent: number) { return createRng(`${b.seed}:roll:${b.rolls++}`).int(100) < percent }
function attack(b: ShipBattle, side: 'player' | 'enemy', kind: ShipWeaponKind, target: EnemyRoomKey, damage: number) {
  const to = side === 'player' ? 'enemy' : 'player'
  const rooms = to === 'player' ? b.rooms : b.enemy.rooms
  const shield = to === 'player' ? b.shield : b.enemy.shield
  const evade = to === 'player' ? effectiveRoom(b, 'player', 'helm') ? 10 + Math.min(b.power.engines, effectiveRoom(b, 'player', 'engines')) * 7 + (b.upgrades.countermeasures ? 10 : 0) : 0
    : effectiveRoom(b, 'enemy', 'helm') && effectiveRoom(b, 'enemy', 'engines') ? SHIP_BY_ID[b.classId]!.evade : 0
  const hit = kind === 'beam' || !roll(b, evade)
  b.volley = { side, kind, target, hit, damage: 0, id: ++b.shots }
  if (!hit) { log(b, `${side === 'player' ? 'Our' : 'Hostile'} ${kind} misses.`); return }
  if (kind === 'beam' && shield > 0) { log(b, 'Beam blocked by shields.'); return }
  if (kind !== 'missile' && shield > 0) {
    if (to === 'player') b.shield--; else b.enemy.shield--
    if (kind === 'ion') rooms.shields.ionUntil = b.time + 6
    log(b, `${to === 'player' ? 'Ithaca' : 'Hostile'} shield absorbs ${kind}.`); return
  }
  if (kind === 'ion') { rooms[target].ionUntil = b.time + 6; log(b, `${to === 'player' ? 'Our' : 'Enemy'} ${target} ionised for six seconds.`); return }
  if (to === 'player') b.hull = Math.max(1, b.hull - damage); else b.enemy.hull = Math.max(0, b.enemy.hull - damage)
  rooms[target].hp = Math.max(0, rooms[target].hp - (kind === 'beam' ? 2 : 1))
  b.volley.damage = damage
  log(b, `${to === 'player' ? 'Ithaca' : 'Hostile'} ${target} hit: ${damage} hull damage.`)
  if (b.enemy.hull <= 0) finish(b, 'victory', 'The hostile ship breaks apart. The tender has a clear route.')
  else if (b.hull <= 1) finish(b, 'disabled', 'Main power fails. The tender retrieves the disabled Ithaca under emergency tow.')
}
function fire(b: ShipBattle, i: number) {
  const w = b.weapons[i]!
  w.charge = 0
  if (w.kind === 'missile') b.missiles--
  for (let j = 0; j < w.shots && b.phase === 'battle'; j++) attack(b, 'player', w.kind, w.target, w.damage)
}
function tick(b: ShipBattle) {
  b.time++
  if (b.escape) {
    b.escapeWork += Math.min(b.power.engines, effectiveRoom(b, 'player', 'engines')) / 2
    if (b.escapeWork >= 10) { finish(b, 'fled', 'Escape jump complete. The tender turns back with us; no contract payment.'); return }
  }
  b.shield = Math.min(b.shield, shieldCapacity(b)); b.enemy.shield = Math.min(b.enemy.shield, enemyShieldCapacity(b))
  b.shieldWork += b.upgrades.adaptive ? 1.2 : 1
  if (b.shieldWork >= 4) { if (b.shield < shieldCapacity(b)) b.shield++; b.shieldWork -= 4 }
  b.enemy.shieldWork++
  if (b.enemy.shieldWork >= 5) { if (b.enemy.shield < enemyShieldCapacity(b)) b.enemy.shield++; b.enemy.shieldWork = 0 }
  if (++b.repairWork >= 6) { const r = b.rooms[b.repair]; r.hp = Math.min(r.max, r.hp + 1); b.repairWork = 0 }
  if (++b.enemy.repairWork >= 12) {
    const key = SHIP_ROOMS.find((r) => b.enemy.rooms[r].hp < b.enemy.rooms[r].max)
    if (key) b.enemy.rooms[key].hp++; b.enemy.repairWork = 0
  }
  const chargeRate = (b.upgrades.fireControl ? 1.1 : 1) * effectiveRoom(b, 'player', 'weapons') / b.rooms.weapons.max
  for (let i = 0; i < b.weapons.length && b.phase === 'battle'; i++) {
    const w = b.weapons[i]!
    if (w.mode === 'off' || (w.kind === 'missile' && !b.missiles)) continue
    w.charge = Math.min(w.period, w.charge + chargeRate)
    if (w.mode === 'auto' && !fireLock(b, i)) fire(b, i)
  }
  const cls = SHIP_BY_ID[b.classId]!
  const enemyRate = effectiveRoom(b, 'enemy', 'weapons') / b.enemy.rooms.weapons.max
  for (let i = 0; i < cls.guns.length && b.phase === 'battle'; i++) {
    const g = cls.guns[i]!
    b.enemy.charges[i] = Math.min(g.time, b.enemy.charges[i]! + enemyRate)
    if (b.enemy.charges[i]! >= g.time) {
      b.enemy.charges[i] = 0
      const target = createRng(`${b.seed}:target:${b.rolls++}`).pick(SHIP_ROOMS)
      for (let j = 0; j < g.shots && b.phase === 'battle'; j++) attack(b, 'enemy', g.kind, target, g.dmg)
    }
  }
}
export function reduceShipBattle(state: ShipBattle, a: ShipOrder): ShipBattle {
  if (shipOrderLock(state, a)) return state
  const b = structuredClone(state)
  switch (a.type) {
    case 'hail': b.hailed = true; b.toll = b.upgrades.translated ? 8 : 15; log(b, `Their captain asks for ${b.toll} credits to clear the tender's route.${b.upgrades.contextual ? ' Our translator identifies a face-saving way to refuse.' : ''}`); break
    case 'pay': finish(b, 'negotiated', 'Transit payment accepted. The tender reaches its survey site.'); break
    case 'negotiate': finish(b, 'negotiated', 'We offer a public navigation advisory. Their captain calls it sufficient courtesy and opens the lane.'); break
    case 'evade':
      if (roll(b, evadeChance(b))) finish(b, 'evaded', 'The tender follows our wake past the interception point. Escort complete.')
      else { b.phase = 'battle'; log(b, 'They match our course. The tender falls behind our shields. Battle stations.') }
      break
    case 'cancel': finish(b, 'cancelled', 'We decline the escort. The tender remains safely at the station.'); break
    case 'engage': b.phase = 'battle'; log(b, 'Weapons ready. Target a compartment and manage reactor power.'); break
    case 'advance': for (let i = 0; i < a.seconds && b.phase === 'battle'; i++) tick(b); break
    case 'power': b.power[a.system] = a.amount; b.shield = Math.min(b.shield, shieldCapacity(b)); break
    case 'weapon': b.weapons[a.index]!.mode = a.mode; if (a.mode === 'off') b.weapons[a.index]!.charge = 0; break
    case 'target': b.weapons[a.index]!.target = a.room; break
    case 'fire': fire(b, a.index); break
    case 'repair': b.repair = a.room; b.repairWork = 0; break
    case 'retreat': b.escape = a.active; if (!a.active) b.escapeWork = 0; break
    case 'accept-surrender': finish(b, 'yielded', 'The hostile captain powers down. We accept the surrender and escort the tender through.'); break
  }
  return b
}
