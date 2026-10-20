import { createRng } from '../rng/prng.js'
import { SHIP_BY_ID } from '../combat/ships.js'
import type { EnemyLayoutId, EnemyRoomKey, ShipClass } from '../combat/ships.js'

export const SHIP_ROOMS: EnemyRoomKey[] = ['helm', 'weapons', 'shields', 'engines']
export const REACTOR_POWER = 8
/** Rules 2: hostile gun damage is stated for the old 100-hull scale; it lands scaled by kind. */
export const INCOMING_DAMAGE: Record<ShipWeaponKind, number> = { laser: 1, missile: 0.5, ion: 0, beam: 0.67 }
/** The longest single advance order; the campaign journal batches live seconds up to it. */
export const MAX_ADVANCE_SECONDS = 5
/**
 * Battle rules carried by the escort order. Rules 1 (absent) resolve every
 * shot the instant it fires and stay frozen so earlier journals replay exactly.
 * Rules 2 fly projectiles between the ships (one second; missiles two), roll
 * evasion when they arrive, and let hull hits start compartment fires.
 */
export const BATTLE_RULES = 2
export type BattleRules = 1 | 2
/** Every rules version an escort order may name; older ones stay valid so their journals load. */
export const KNOWN_BATTLE_RULES: readonly number[] = [2]
export type ShipWeaponKind = 'laser' | 'missile' | 'ion' | 'beam'
/** Seconds a projectile spends crossing between the ships under rules 2. Beams are instant. */
export const FLIGHT_SECONDS: Record<ShipWeaponKind, number> = { laser: 1, ion: 1, missile: 2, beam: 0 }
/** Chance a hull hit sets the struck compartment burning, under rules 2. */
export const FIRE_CHANCE: Record<ShipWeaponKind, number> = { laser: 10, ion: 0, missile: 35, beam: 25 }
/** A fire burns this long unless damage control puts it out, costing a compartment point every five seconds. */
export const FIRE_SECONDS = 10
/** Rules 2: the order in which hostile crews run to unattended damage. */
export const ENEMY_REPAIR_ORDER: EnemyRoomKey[] = ['weapons', 'shields', 'helm', 'engines']
/** Rules 2: a hostile crew member. They have no medical bay: at zero they are dead. */
export interface EnemyCrew { room: EnemyRoomKey; home: EnemyRoomKey; moving: number; hp: number; work: number }
export const ENEMY_CREW_HP = 4
/** Seconds a struck hostile room stays off-limits to their crew. */
export const ENEMY_CREW_CAUTION = 3
/** Fraction of charge at which a hostile gun locks its target, giving the crew warning (rules 2). */
export const AIM_AT = 0.6
/** Each hull plan's gunnery doctrine: the compartment its gunners favour three to one (rules 2). */
export const PREFERRED_TARGET: Record<EnemyLayoutId, EnemyRoomKey> = {
  raider: 'weapons', clan: 'weapons', flagship: 'weapons', spine: 'shields', order: 'shields', hauler: 'engines', alien: 'helm',
}
export interface BattleRoom { hp: number; max: number; ionUntil: number; fire?: number
  /** Rules 2, hostile rooms: the second our fire last struck it. Their crew keep out of rooms under fire. */
  hitAt?: number }
export interface Projectile { id: number; side: 'player' | 'enemy'; kind: ShipWeaponKind; target: EnemyRoomKey; damage: number; launched: number; lands: number; shot: number }
export type ImpactOutcome = 'miss' | 'shield' | 'blocked' | 'hit' | 'ion'
/** What happened during the latest simulated second, for presentation. Ids only ever increase. */
export type BattleEvent =
  | { id: number; type: 'launch'; side: 'player' | 'enemy'; kind: ShipWeaponKind; target: EnemyRoomKey; shot: number }
  | { id: number; type: 'impact'; side: 'player' | 'enemy'; kind: ShipWeaponKind; target: EnemyRoomKey; shot: number; outcome: ImpactOutcome; damage: number }
  | { id: number; type: 'fire' | 'extinguished' | 'repaired'; side: 'player' | 'enemy'; target: EnemyRoomKey }
  | { id: number; type: 'wounded' | 'down' | 'returned'; side: 'player'; target: EnemyRoomKey; crew: CrewId }
  | { id: number; type: 'enemy-crew'; side: 'enemy'; target: EnemyRoomKey; dead: boolean }
  | { id: number; type: 'enemy-ftl'; side: 'enemy'; target: EnemyRoomKey }
/** The Lodestar's bridge crew at battle stations (rules 2). */
export type CrewId = 'mori' | 'cross' | 'morozova' | 'kerr'
/** `moving`: seconds still crossing the ship. `recovery`: seconds left in the medical bay. `rest`: seconds healing. */
export interface BattleCrew { id: CrewId; room: EnemyRoomKey; moving: number; recovery: number; rest: number; hp: number; work: number }
export const CREW_HP = 4
/** Seconds a crew member spends crossing the ship. */
export const CREW_MOVE_SECONDS = 2
/** Officer-seconds to patch one compartment point, and to put out a fire. */
export const CREW_REPAIR_WORK = 10
export const CREW_FIRE_WORK = 4
/** Seconds the medical bay needs to patch up a downed officer and send them back to their station. */
export const CREW_RECOVERY_SECONDS = 20
/** Where each officer stands when battle stations sound. */
export const CREW_STATIONS: Record<CrewId, EnemyRoomKey> = { mori: 'helm', cross: 'weapons', morozova: 'shields', kerr: 'engines' }
export interface ShipWeapon { kind: ShipWeaponKind; name: string; cost: number; charge: number; period: number; damage: number; shots: number; mode: 'off' | 'hold' | 'auto'; target: EnemyRoomKey }
export interface BattleUpgrades { fireControl: boolean; ion: boolean; beam: boolean; layered: boolean; adaptive: boolean; translated: boolean; contextual: boolean; countermeasures: boolean }
export type ShipBattleResult = 'victory' | 'negotiated' | 'evaded' | 'yielded' | 'fled' | 'escaped' | 'disabled' | 'cancelled'
export interface ShipBattle {
  seed: string; locationId: string; classId: string; phase: 'contact' | 'battle' | 'report'; hailed: boolean; result: ShipBattleResult | null
  hull: number; hullMax: number; upgrades: BattleUpgrades; time: number; rolls: number; toll: number
  power: { shields: number; engines: number; weapons: number }; rooms: Record<EnemyRoomKey, BattleRoom>
  shield: number; shieldWork: number; repair: EnemyRoomKey; repairWork: number; missiles: number
  weapons: ShipWeapon[]; escape: boolean; escapeWork: number
  enemy: { hull: number; maxHull: number; shield: number; shieldWork: number; repairWork: number; rooms: Record<EnemyRoomKey, BattleRoom>; charges: number[]
    /** Rules 2: the compartment each gun has locked, chosen as it passes AIM_AT of its charge. */
    aim?: (EnemyRoomKey | null)[]
    /** Rules 2: their crew, who repair, fight fires, man the helm, and die. */
    crew?: EnemyCrew[]
    /** Rules 2: set when the battle was won by killing every one of them. */
    crewKilled?: true
    /** Rules-2 interceptions: their FTL charge, begun once their hull is badly hurt; at ENEMY_JUMP_WORK they are gone. */
    jump?: number }
  log: string[]; volley: { side: 'player' | 'enemy'; kind: ShipWeaponKind; target: EnemyRoomKey; hit: boolean; damage: number; id: number } | null; shots: number
  /** Present from rules 2; absent means the frozen rules 1. */
  rules?: BattleRules; inFlight?: Projectile[]
  /** Rules 2: the officers at stations, who man rooms, repair them and fight fires. */
  crew?: BattleCrew[]
  /** Rules 2: reactor power, including yard upgrades. */
  reactor?: number
  /** An interception on arrival from a jump (rules 2 only); absent means a station escort. */
  kind?: 'interception' | 'finale'
  events?: BattleEvent[]; eventSeq?: number
}
export type ShipOrder =
  | { type: 'hail' | 'negotiate' | 'pay' | 'evade' | 'engage' | 'cancel' }
  | { type: 'advance'; seconds: number }
  | { type: 'power'; system: 'shields' | 'engines' | 'weapons'; amount: number }
  | { type: 'weapon'; index: number; mode: 'off' | 'hold' | 'auto' }
  | { type: 'target'; index: number; room: EnemyRoomKey }
  | { type: 'fire'; index: number }
  | { type: 'repair'; room: EnemyRoomKey }
  | { type: 'crew'; id: CrewId; room: EnemyRoomKey }
  | { type: 'retreat'; active: boolean }
  | { type: 'accept-surrender' }
const room = (hp: number): BattleRoom => ({ hp, max: hp, ionUntil: 0 })
export function escortClass(seed: string, locationId: string, threat: number, rules: BattleRules = 1): ShipClass {
  // Rules 2 keep the Reaver for the rift margin; threat-2 lanes see the Carrion Jack.
  const ids = rules === 2 ? threat >= 3 ? ['carrion-jack', 'reaver'] : threat === 2 ? ['carrion-jack'] : ['rust-queen', 'magpie']
    : threat >= 2 ? ['carrion-jack', 'reaver'] : ['rust-queen', 'magpie']
  return SHIP_BY_ID[createRng(`${seed}:${locationId}:escort-class`).pick(ids)]!
}
/** What the log says at each turn of an encounter, by kind. */
const TEXT = {
  escort: {
    open: 'The survey tender is holding beside us. An armed ship crosses its departure lane and transmits a demand for payment.',
    victory: 'The hostile ship breaks apart. The tender has a clear route.',
    disabled: 'Main power fails. The tender retrieves the disabled Lodestar under emergency tow.',
    fled: 'Escape jump complete. The tender turns back with us; no contract payment.',
    paid: 'Transit payment accepted. The tender reaches its survey site.',
    evaded: 'The tender follows our wake past the interception point. Escort complete.',
    caught: 'They match our course. The tender falls behind our shields. Battle stations.',
    yielded: 'The hostile captain powers down. We accept the surrender and escort the tender through.',
    escaped: 'Their drive flares and they are gone. The tender has a clear lane.',
  },
  interception: {
    open: 'We drop out of the jump into a waiting weapons lock. The contact transmits a demand for payment.',
    victory: 'The hostile ship breaks apart. Salvage drones are already moving through the debris.',
    disabled: 'Main power fails. A passing hauler tows the dead Lodestar to the nearest station, at a price.',
    fled: 'Emergency jump complete. We lose them in the drive wake and come back out where we meant to be.',
    paid: 'Transit payment accepted. The contact peels away to wait for someone else.',
    evaded: 'We burn hard for the shadow of the primary and slip their lock.',
    caught: 'They read our burn and match it. Shields up. Battle stations.',
    yielded: 'The hostile captain powers down and offers their hold for their lives. We take the cargo and let them go.',
    escaped: 'Their drive flares and they are gone, and their hold with them.',
  },
  finale: {
    open: 'The Return Drive spins up and the rift answers. Something vast hauls itself out of the dark across our bow.',
    victory: 'The Sovereign comes apart without a sound. Nothing stands between the Lodestar and home.',
    disabled: 'Main power fails. The Sovereign leaves us drifting at the edge of the rift; the Return Drive will need another try.',
    fled: 'The Return Drive takes hold. The Sovereign, the rift and the strange sky fall away behind us.',
    paid: '', evaded: '', caught: '', escaped: '',
    yielded: 'The Sovereign powers down and lets us pass. Home is open.',
  },
}
const text = (b: ShipBattle) => TEXT[b.kind ?? 'escort']
/** Weapons a station armoury can sell, mounted in rules-2 battles beside the standard pair. */
export type ArmouryWeaponId = 'burst-laser' | 'heavy-laser' | 'twin-hellion' | 'ion-blast' | 'breach-missile'
export const ARMOURY: Record<ArmouryWeaponId, { weapon: Omit<ShipWeapon, 'charge' | 'mode' | 'target'>; price: number; blurb: string }> = {
  'burst-laser': { weapon: { kind: 'laser', name: 'Burst laser II', cost: 2, period: 12, damage: 1, shots: 3 }, price: 55, blurb: 'Three shots: strips a shield and still hits' },
  'heavy-laser': { weapon: { kind: 'laser', name: 'Heavy laser', cost: 1, period: 10, damage: 2, shots: 1 }, price: 45, blurb: 'One shot, double damage' },
  'twin-hellion': { weapon: { kind: 'missile', name: 'Twin Hellion', cost: 2, period: 17, damage: 2, shots: 2 }, price: 50, blurb: 'Two missiles at once, through any shield' },
  'ion-blast': { weapon: { kind: 'ion', name: 'Ion blast II', cost: 1, period: 9, damage: 0, shots: 2 }, price: 50, blurb: 'Two ion bolts: strips shields, then stuns a room' },
  'breach-missile': { weapon: { kind: 'missile', name: 'Breach missile', cost: 2, period: 20, damage: 4, shots: 1 }, price: 60, blurb: 'Four damage through any shield' },
}
/** At most this many bought weapons ride beside the standard pair. */
export const ARMOURY_SLOTS = 2
export function createShipBattle(seed: string, locationId: string, cls: ShipClass, hull: number, hullMax: number, upgrades: BattleUpgrades, rules: BattleRules = 1, kind?: 'interception' | 'finale', missiles = 4, armoury: ArmouryWeaponId[] = [], reactor = BASE_REACTOR): ShipBattle {
  const weapons: ShipWeapon[] = [
    { kind: 'laser', name: 'Pulse laser', cost: 1, period: 8, charge: 0, damage: 1, shots: 2, mode: 'auto', target: 'weapons' },
    { kind: 'missile', name: 'Hellion missile', cost: 1, period: 13, charge: 0, damage: 2, shots: 1, mode: 'off', target: 'weapons' },
  ]
  if (upgrades.ion) weapons.push({ kind: 'ion', name: 'Ion projector', cost: 1, period: 7, charge: 0, damage: 0, shots: 1, mode: 'off', target: 'shields' })
  if (upgrades.beam) weapons.push({ kind: 'beam', name: 'Focus beam', cost: 2, period: 15, charge: 0, damage: 3, shots: 1, mode: 'off', target: 'weapons' })
  const b: ShipBattle = { seed, locationId, classId: cls.id, phase: 'contact', hailed: false, result: null, hull, hullMax, upgrades, time: 0, rolls: 0, toll: 0,
    power: { shields: 2, engines: 2, weapons: 2 }, rooms: { helm: room(2), weapons: room(4), shields: room(4), engines: room(3) },
    shield: 1, shieldWork: 0, repair: 'weapons', repairWork: 0, missiles, weapons, escape: false, escapeWork: 0,
    enemy: { hull: cls.hull, maxHull: cls.hull, shield: cls.shields, shieldWork: 0, repairWork: 0,
      rooms: { helm: room(cls.rooms.helm), weapons: room(cls.rooms.weapons), shields: room(cls.rooms.shields), engines: room(cls.rooms.engines) }, charges: cls.guns.map(() => 0) },
    log: ['The survey tender is holding beside us. An armed ship crosses its departure lane and transmits a demand for payment.'], volley: null, shots: 0 }
  if (rules === 2) {
    b.rules = 2; b.inFlight = []; b.events = []; b.eventSeq = 0; b.enemy.aim = cls.guns.map(() => null)
    if (reactor !== BASE_REACTOR) b.reactor = reactor
    for (const id of armoury) b.weapons.push({ ...ARMOURY[id].weapon, charge: 0, mode: 'off', target: 'shields' })
    // Yard power goes to the guns, then the engines; bought guns that can be powered start on automatic.
    let spare = reactor - BASE_REACTOR
    for (const sys of ['weapons', 'engines'] as const) while (spare > 0 && b.power[sys] < (sys === 'weapons' ? 4 : 3)) { b.power[sys]++; spare-- }
    for (const w of b.weapons.slice(2)) if (w.kind !== 'missile' && weaponPower(b) + w.cost <= b.power.weapons) w.mode = 'auto'
    // They were waiting with guns half charged, and our guns open on their shields (on their guns, if they have
    // no shields): choosing the right compartment is the captain's first decision.
    b.enemy.charges = cls.guns.map((g) => Math.floor(g.time / 2))
    for (const w of b.weapons) w.target = cls.shields ? 'shields' : 'weapons'
    b.crew = (Object.keys(CREW_STATIONS) as CrewId[]).map((id) => ({ id, room: CREW_STATIONS[id], moving: 0, recovery: 0, rest: 0, hp: CREW_HP, work: 0 }))
    // The Sovereign carries a full complement, two hardened hands to every room.
    const posts: EnemyRoomKey[] = kind === 'finale' ? ['helm', 'weapons', 'shields', 'engines', 'helm', 'weapons', 'shields', 'engines']
      : cls.tier >= 2 ? ['helm', 'weapons', 'shields', 'engines'] : ['helm', 'weapons', 'shields']
    b.enemy.crew = posts.map((room) => ({ room, home: room, moving: 0, hp: kind === 'finale' ? FINALE_CREW_HP : ENEMY_CREW_HP, work: 0 }))
    if (kind) { b.kind = kind; b.log = [TEXT[kind].open] }
    // The rift has rebuilt the Sovereign around itself: half as much hull again.
    if (kind === 'finale') b.enemy.hull = b.enemy.maxHull = Math.round(cls.hull * FINALE_HULL)
    for (const r of [...Object.values(b.rooms), ...Object.values(b.enemy.rooms)]) r.fire = 0
  }
  return b
}
export const effectiveRoom = (b: ShipBattle, side: 'player' | 'enemy', key: EnemyRoomKey) => {
  const r = side === 'player' ? b.rooms[key] : b.enemy.rooms[key]
  return r.ionUntil > b.time ? 0 : r.hp
}
/** Rules 2 run a smaller reactor, so shields, engines and weapons genuinely compete. */
export const reactorPower = (b: ShipBattle) => b.rules === 2 ? b.reactor ?? BASE_REACTOR : REACTOR_POWER
/** The rules-2 reactor before any yard upgrade. */
export const BASE_REACTOR = 7
export const assignedPower = (b: ShipBattle) => b.power.shields + b.power.engines + b.power.weapons
export const weaponPower = (b: ShipBattle) => b.weapons.reduce((n, w) => n + (w.mode === 'off' ? 0 : w.cost), 0)
export const shieldCapacity = (b: ShipBattle) => Math.min(b.upgrades.layered ? 2 : 1, Math.floor(Math.min(b.power.shields, effectiveRoom(b, 'player', 'shields')) / 2))
export const enemyShieldCapacity = (b: ShipBattle) => Math.min(SHIP_BY_ID[b.classId]!.shields, Math.floor(effectiveRoom(b, 'enemy', 'shields') / 2))
export const evadeChance = (b: ShipBattle) => b.upgrades.countermeasures ? 85 : 65
/** Rules 2: whether a fit officer is standing in the compartment. Rules 1 rooms count as always manned. */
export const manned = (b: ShipBattle, room: EnemyRoomKey) => !b.crew || b.crew.some((c) => c.room === room && !c.moving && c.hp > 0)
/** The chance, in percent, that a shot at the Lodestar misses right now. Rules 2 need someone at the helm. */
export const playerEvasion = (b: ShipBattle) => effectiveRoom(b, 'player', 'helm') && manned(b, 'helm')
  ? 10 + Math.min(b.power.engines, effectiveRoom(b, 'player', 'engines')) * 7 + (b.upgrades.countermeasures ? 10 : 0) + (b.crew && manned(b, 'engines') ? 5 : 0) : 0
/** The chance, in percent, that our shot at the hostile misses right now. */
/** Rules 2: whether one of their crew stands in the compartment. Rules 1 counts every room as manned. */
export const enemyManned = (b: ShipBattle, room: EnemyRoomKey) => !b.enemy.crew || b.enemy.crew.some((c) => c.room === room && !c.moving && c.hp > 0)
export const enemyEvasion = (b: ShipBattle) => effectiveRoom(b, 'enemy', 'helm') && effectiveRoom(b, 'enemy', 'engines') && enemyManned(b, 'helm') ? SHIP_BY_ID[b.classId]!.evade : 0
export const burning = (r: BattleRoom) => (r.fire ?? 0) > 0
/** Charge gained per second by each powered player weapon. */
export const playerChargeRate = (b: ShipBattle) => (b.upgrades.fireControl ? 1.1 : 1) * (b.crew && manned(b, 'weapons') ? 1.1 : 1) * effectiveRoom(b, 'player', 'weapons') / b.rooms.weapons.max
/** Charge gained per second by each hostile gun. */
export const enemyChargeRate = (b: ShipBattle) => effectiveRoom(b, 'enemy', 'weapons') / b.enemy.rooms.weapons.max
/** Escape work a retreat needs; the finale's retreat is the Return Drive itself, far more work. */
export const escapeWorkNeeded = (b: ShipBattle) => b.kind === 'finale' ? FINALE_DRIVE_WORK : b.kind === 'interception' ? INTERCEPTION_ESCAPE_WORK : 10
/** An interceptor holds a jump lock: breaking it takes twice an escort's retreat. */
export const INTERCEPTION_ESCAPE_WORK = 20
export const FINALE_HULL = 1.5
export const FINALE_CREW_HP = 6
export const FINALE_DRIVE_WORK = 60
/** Rules-2 interceptions: below this share of hull, the hostile spins up its FTL drive. */
export const ENEMY_JUMP_AT = 0.3
/** FTL work they need; each second adds a sixth of their working engine rooms while the helm is manned (twenty seconds at full engines). */
export const ENEMY_JUMP_WORK = 10
export const enemyJumpRate = (b: ShipBattle) => enemyManned(b, 'helm') && effectiveRoom(b, 'enemy', 'helm') ? effectiveRoom(b, 'enemy', 'engines') / 6 : 0
export const surrenderAvailable = (b: ShipBattle) => b.phase === 'battle' && b.upgrades.contextual && b.enemy.hull <= b.enemy.maxHull * 0.3
export function fireLock(b: ShipBattle, index: number): string | null {
  const w = b.weapons[index]
  if (!w || !Number.isInteger(index)) return 'Unknown weapon'
  if (w.mode === 'off') return 'Power this weapon first'
  if (!effectiveRoom(b, 'player', 'weapons')) return 'Weapon compartment disabled; assign repairs'
  if (w.kind === 'missile' && b.missiles < w.shots) return b.missiles ? `Needs ${w.shots} missiles` : 'Missile magazine empty'
  return w.charge < w.period ? 'Weapon charging' : null
}
export function shipOrderLock(b: ShipBattle, a: ShipOrder): string | null {
  if (!a || typeof a !== 'object') return 'Invalid bridge order'
  if (b.phase === 'report') return 'Acknowledge the encounter report'
  if (b.phase === 'contact') {
    if (b.kind === 'finale') return a.type === 'engage' ? null : 'There is no bargaining with the Sovereign'
    if (a.type === 'hail') return b.hailed ? 'Channel already open' : null
    if (a.type === 'negotiate') return b.hailed && b.upgrades.contextual ? null : 'Hail first; requires Contextual Translation'
    if (a.type === 'pay') return b.hailed ? null : 'Hail to learn their price'
    if (a.type === 'cancel') return b.kind === 'interception' ? 'There is no declining an interception' : null
    if (['evade', 'engage'].includes(a.type)) return null
    return 'Resolve the contact first'
  }
  switch (a.type) {
    case 'advance': return Number.isInteger(a.seconds) && a.seconds >= 1 && a.seconds <= MAX_ADVANCE_SECONDS ? null : 'Advance between one and five simulation seconds'
    case 'power': {
      if (!['shields', 'engines', 'weapons'].includes(a.system) || !Number.isInteger(a.amount)) return 'Unknown power setting'
      const max = a.system === 'shields' ? b.upgrades.layered ? 4 : 2 : a.system === 'engines' ? 3 : 4
      if (a.amount < 0 || a.amount > max) return `System accepts 0–${max} power`
      if (assignedPower(b) - b.power[a.system] + a.amount > reactorPower(b)) return 'Reactor fully allocated; reduce another system first'
      return a.system === 'weapons' && a.amount < weaponPower(b) ? 'Switch off a weapon before reducing its power supply' : null
    }
    case 'weapon': {
      const w = b.weapons[a.index]
      if (!w || !Number.isInteger(a.index) || !['off', 'hold', 'auto'].includes(a.mode)) return 'Unknown weapon setting'
      return w.mode === 'off' && a.mode !== 'off' && weaponPower(b) + w.cost > b.power.weapons ? 'Allocate more reactor power to weapons first' : null
    }
    case 'target': return b.weapons[a.index] && Number.isInteger(a.index) && SHIP_ROOMS.includes(a.room) ? null : 'Select an enemy compartment'
    case 'fire': return fireLock(b, a.index)
    case 'repair': return b.crew ? 'Send a crew member to the compartment' : SHIP_ROOMS.includes(a.room) ? null : 'Unknown repair compartment'
    case 'crew': {
      const c = b.crew?.find((m) => m.id === a.id)
      if (!c || !SHIP_ROOMS.includes(a.room)) return 'Unknown crew order'
      if (c.hp <= 0) return 'In the medical bay'
      return c.room === a.room ? 'Already there' : null
    }
    case 'retreat': return typeof a.active === 'boolean' ? null : 'Invalid retreat order'
    case 'accept-surrender': return surrenderAvailable(b) ? null : 'Requires Contextual Translation and enemy hull at or below 30%'
    default: return 'Order unavailable in battle'
  }
}
function log(b: ShipBattle, text: string) { b.log.push(`${b.time}s · ${text}`); b.log = b.log.slice(-35) }
function finish(b: ShipBattle, result: ShipBattleResult, text: string) {
  b.phase = 'report'; b.result = result; log(b, text)
  if (b.inFlight) b.inFlight = []
}
function roll(b: ShipBattle, percent: number) { return createRng(`${b.seed}:roll:${b.rolls++}`).int(100) < percent }
function emit(b: ShipBattle, e: DistributiveOmit<BattleEvent, 'id'>) {
  if (!b.events) return
  b.eventSeq = (b.eventSeq ?? 0) + 1
  b.events.push({ ...e, id: b.eventSeq } as BattleEvent)
}
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never
function attack(b: ShipBattle, side: 'player' | 'enemy', kind: ShipWeaponKind, target: EnemyRoomKey, damage: number, shot = 0) {
  const to = side === 'player' ? 'enemy' : 'player'
  const rooms = to === 'player' ? b.rooms : b.enemy.rooms
  const shield = to === 'player' ? b.shield : b.enemy.shield
  const evade = to === 'player' ? playerEvasion(b) : enemyEvasion(b)
  const hit = kind === 'beam' || !roll(b, evade)
  const impact = (outcome: ImpactOutcome, dealt = 0) => emit(b, { type: 'impact', side, kind, target, shot, outcome, damage: dealt })
  b.volley = { side, kind, target, hit, damage: 0, id: ++b.shots }
  if (!hit) { log(b, `${side === 'player' ? 'Our' : 'Hostile'} ${kind} misses.`); impact('miss'); return }
  if (kind === 'beam' && shield > 0) { log(b, 'Beam blocked by shields.'); impact('blocked'); return }
  if (kind !== 'missile' && shield > 0) {
    if (to === 'player') b.shield--; else b.enemy.shield--
    if (kind === 'ion') rooms.shields.ionUntil = b.time + 6
    log(b, `${to === 'player' ? 'Lodestar' : 'Hostile'} shield absorbs ${kind}.`); impact('shield'); return
  }
  if (kind === 'ion') { rooms[target].ionUntil = b.time + 6; log(b, `${to === 'player' ? 'Our' : 'Enemy'} ${target} ionised for six seconds.`); impact('ion'); return }
  if (to === 'player' && b.rules === 2) damage = Math.round(damage * INCOMING_DAMAGE[kind])
  if (to === 'player') b.hull = Math.max(1, b.hull - damage); else b.enemy.hull = Math.max(0, b.enemy.hull - damage)
  rooms[target].hp = Math.max(0, rooms[target].hp - (kind === 'beam' ? 2 : 1))
  if (to === 'enemy' && b.rules === 2) rooms[target].hitAt = b.time
  b.volley.damage = damage
  log(b, b.rules === 2 ? to === 'player' ? `They hit our ${target}: ${damage} hull damage.` : `We hit their ${target}: ${damage} hull damage.` : `${to === 'player' ? 'Lodestar' : 'Hostile'} ${target} hit: ${damage} hull damage.`)
  impact('hit', damage)
  if (b.rules === 2 && !burning(rooms[target]) && roll(b, FIRE_CHANCE[kind])) {
    rooms[target].fire = FIRE_SECONDS
    // Whatever the officers there were doing, they start again on the fire.
    for (const c of b.crew ?? []) if (to === 'player' && c.room === target) c.work = 0
    log(b, `Fire in the ${to === 'player' ? 'Lodestar' : 'hostile'} ${target} compartment.`)
    emit(b, { type: 'fire', side: to, target })
  }
  // Rules 2: the people in the struck room. Killing their last crew member can end the fight here.
  if (to === 'player') wound(b, target); else woundEnemy(b, target)
  if (b.phase !== 'battle') return
  if (b.enemy.hull <= 0) finish(b, 'victory', text(b).victory)
  else if (b.hull <= 1) finish(b, 'disabled', text(b).disabled)
}
/** Rules 2: a shot leaves the gun now and is resolved when it arrives. */
function launch(b: ShipBattle, side: 'player' | 'enemy', kind: ShipWeaponKind, target: EnemyRoomKey, damage: number, shot: number) {
  emit(b, { type: 'launch', side, kind, target, shot })
  if (!FLIGHT_SECONDS[kind]) { attack(b, side, kind, target, damage, shot); return }
  b.eventSeq = (b.eventSeq ?? 0) + 1
  b.inFlight!.push({ id: b.eventSeq, side, kind, target, damage, launched: b.time, lands: b.time + FLIGHT_SECONDS[kind], shot })
}
function shoot(b: ShipBattle, side: 'player' | 'enemy', kind: ShipWeaponKind, target: EnemyRoomKey, damage: number, shots: number) {
  for (let j = 0; j < shots && b.phase === 'battle'; j++) {
    if (b.rules === 2) launch(b, side, kind, target, damage, j)
    else attack(b, side, kind, target, damage, j)
  }
}
function fire(b: ShipBattle, i: number) {
  const w = b.weapons[i]!
  w.charge = 0
  if (w.kind === 'missile') b.missiles -= w.shots
  shoot(b, 'player', w.kind, w.target, w.damage, w.shots)
}
/** Rules 2: fires burn down their compartment until put out or burnt out. */
function burn(b: ShipBattle, side: 'player' | 'enemy') {
  const rooms = side === 'player' ? b.rooms : b.enemy.rooms
  for (const key of SHIP_ROOMS) {
    const r = rooms[key]
    if (!burning(r)) continue
    r.fire!--
    if (r.fire! % 5 === 0) {
      if (r.hp > 0) { r.hp--; log(b, `Fire damages the ${side === 'player' ? 'Lodestar' : 'hostile'} ${key}.`) }
      if (side === 'player') wound(b, key); else woundEnemy(b, key)
    }
    if (!r.fire) emit(b, { type: 'extinguished', side, target: key })
  }
}
/** Rules 2: hostile gunners favour their doctrine's compartment, three to one. */
function enemyTarget(b: ShipBattle): EnemyRoomKey {
  // The Sovereign knows what the Return Drive needs: once it spins up, its gunners hunt our engines.
  const favourite = b.kind === 'finale' && b.escape ? 'engines' : PREFERRED_TARGET[SHIP_BY_ID[b.classId]!.layout]
  return createRng(`${b.seed}:target:${b.rolls++}`).pick([favourite, favourite, ...SHIP_ROOMS])
}
/** Rules 2: seconds until hostile gun `i` fires at its current rate, or null if it is not charging. */
export function enemyGunEta(b: ShipBattle, i: number): number | null {
  const g = SHIP_BY_ID[b.classId]!.guns[i], rate = enemyChargeRate(b)
  return g && rate > 0 ? Math.ceil((g.time - b.enemy.charges[i]!) / rate) : null
}
/** Rules 2: a hit or a fire hurts everyone standing in the compartment. */
function wound(b: ShipBattle, room: EnemyRoomKey) {
  for (const c of b.crew ?? []) {
    if (c.room !== room || c.moving || c.hp <= 0) continue
    c.hp--; c.rest = 0
    emit(b, { type: c.hp ? 'wounded' : 'down', side: 'player', target: room, crew: c.id })
    if (!c.hp) { c.recovery = CREW_RECOVERY_SECONDS; c.work = 0; log(b, `Crew down in the ${room}. They are carried to the medical bay.`) }
  }
}
/** Rules 2: a hit or a fire kills or wounds their crew in the compartment; losing all of them ends the fight. */
function woundEnemy(b: ShipBattle, room: EnemyRoomKey) {
  const crew = b.enemy.crew
  if (!crew || b.phase !== 'battle') return
  for (const c of crew) {
    if (c.room !== room || c.moving || c.hp <= 0) continue
    c.hp--
    emit(b, { type: 'enemy-crew', side: 'enemy', target: room, dead: c.hp === 0 })
    if (!c.hp) log(b, `One of their crew is killed in the ${room}.`)
  }
  if (crew.every((c) => c.hp <= 0)) { b.enemy.crewKilled = true; finish(b, 'victory', 'Their last crew member falls. The ship drifts, silent, and its holds are ours.') }
}
/** Rules 2: their crew fight fires and patch rooms where they stand, and run to the most important damage. */
function enemyCrewWork(b: ShipBattle) {
  const crew = b.enemy.crew!, rooms = b.enemy.rooms
  const needs = (k: EnemyRoomKey) => burning(rooms[k]) || rooms[k].hp < rooms[k].max
  // Nobody walks into a room our guns struck in the last few seconds.
  const underFire = (k: EnemyRoomKey) => (rooms[k].hitAt ?? -Infinity) > b.time - ENEMY_CREW_CAUTION
  // Running for it: someone has to fly. The first hand free heads for an empty helm, once it is safe, and stays there.
  const running = b.enemy.jump !== undefined
  if (running && !underFire('helm') && !crew.some((c) => c.hp > 0 && c.room === 'helm')) {
    const pilot = crew.find((c) => c.hp > 0 && !c.moving)
    if (pilot) { pilot.room = 'helm'; pilot.moving = CREW_MOVE_SECONDS; pilot.work = 0 }
  }
  for (const c of crew) {
    if (c.hp <= 0) continue
    if (c.moving) { c.moving--; continue }
    const r = rooms[c.room]
    if (!needs(c.room)) {
      c.work = 0
      if (running && c.room === 'helm') continue
      // Run to the worst unattended damage, guns first; otherwise go home.
      const target = ENEMY_REPAIR_ORDER.find((k) => needs(k) && !underFire(k) && !crew.some((o) => o !== c && o.hp > 0 && o.room === k))
      const next = target ?? (underFire(c.home) ? c.room : c.home)
      if (next !== c.room) { c.room = next; c.moving = CREW_MOVE_SECONDS }
      continue
    }
    c.work++
    if (burning(r) && c.work >= CREW_FIRE_WORK) { r.fire = 0; c.work = 0; emit(b, { type: 'extinguished', side: 'enemy', target: c.room }) }
    else if (!burning(r) && c.work >= CREW_REPAIR_WORK) { r.hp++; c.work = 0; emit(b, { type: 'repaired', side: 'enemy', target: c.room }) }
  }
}
/** Rules-2 interceptions: a badly hurt hostile runs. Breaking its engines or emptying its helm keeps it here. */
function enemyJump(b: ShipBattle) {
  if (b.kind !== 'interception' || b.enemy.hull > b.enemy.maxHull * ENEMY_JUMP_AT) return
  if (b.enemy.jump === undefined) {
    b.enemy.jump = 0; emit(b, { type: 'enemy-ftl', side: 'enemy', target: 'engines' })
    log(b, 'They are spinning up their FTL drive. Hit their engines or helm, or lose the prize.')
  }
  b.enemy.jump = Math.min(ENEMY_JUMP_WORK, b.enemy.jump + enemyJumpRate(b))
  if (b.enemy.jump >= ENEMY_JUMP_WORK) finish(b, 'escaped', text(b).escaped)
}
/** Rules 2: officers fight fires, then patch their compartment. The engineer works half again as fast. */
function crewWork(b: ShipBattle) {
  for (const c of b.crew!) {
    if (c.hp <= 0) { if (--c.recovery <= 0) { c.hp = 1; c.recovery = 0; c.moving = 0; c.rest = 0; c.room = CREW_STATIONS[c.id]; emit(b, { type: 'returned', side: 'player', target: c.room, crew: c.id }) } continue }
    if (c.moving) { c.moving--; continue }
    const r = b.rooms[c.room]
    // The wounded heal a point for every ten quiet seconds away from fire.
    if (c.hp < CREW_HP && !burning(r) && ++c.rest >= 10) { c.hp++; c.rest = 0 }
    if (!burning(r) && r.hp >= r.max) { c.work = 0; continue }
    c.work += c.id === 'kerr' ? 1.5 : 1
    if (burning(r) && c.work >= CREW_FIRE_WORK) { r.fire = 0; c.work = 0; log(b, `Fire out in the ${c.room}.`); emit(b, { type: 'extinguished', side: 'player', target: c.room }) }
    else if (!burning(r) && c.work >= CREW_REPAIR_WORK) { r.hp++; c.work = 0; emit(b, { type: 'repaired', side: 'player', target: c.room }) }
  }
}
function tick(b: ShipBattle) {
  b.time++
  if (b.events) b.events = []
  if (b.escape) {
    b.escapeWork += Math.min(b.power.engines, effectiveRoom(b, 'player', 'engines')) / 2
    if (b.escapeWork >= escapeWorkNeeded(b)) { finish(b, 'fled', text(b).fled); return }
  }
  b.shield = Math.min(b.shield, shieldCapacity(b)); b.enemy.shield = Math.min(b.enemy.shield, enemyShieldCapacity(b))
  b.shieldWork += (b.upgrades.adaptive ? 1.2 : 1) + (b.crew && manned(b, 'shields') ? 0.25 : 0)
  if (b.shieldWork >= 4) { if (b.shield < shieldCapacity(b)) b.shield++; b.shieldWork -= 4 }
  b.enemy.shieldWork++
  if (b.enemy.shieldWork >= 5) { if (b.enemy.shield < enemyShieldCapacity(b)) b.enemy.shield++; b.enemy.shieldWork = 0 }
  if (b.rules === 2) {
    burn(b, 'player'); burn(b, 'enemy')
    if (b.phase !== 'battle') { b.inFlight = []; return }
    crewWork(b); enemyCrewWork(b); enemyJump(b)
    if (b.phase !== 'battle') { b.inFlight = []; return }
    const arriving = b.inFlight!.filter((p) => p.lands <= b.time)
    b.inFlight = b.inFlight!.filter((p) => p.lands > b.time)
    for (const p of arriving) if (b.phase === 'battle') attack(b, p.side, p.kind, p.target, p.damage, p.shot)
    if (b.phase !== 'battle') { b.inFlight = []; return }
  } else {
    if (++b.repairWork >= 6) { const r = b.rooms[b.repair]; r.hp = Math.min(r.max, r.hp + 1); b.repairWork = 0 }
    if (++b.enemy.repairWork >= 12) {
      const key = SHIP_ROOMS.find((r) => b.enemy.rooms[r].hp < b.enemy.rooms[r].max)
      if (key) b.enemy.rooms[key].hp++; b.enemy.repairWork = 0
    }
  }
  const chargeRate = playerChargeRate(b)
  for (let i = 0; i < b.weapons.length && b.phase === 'battle'; i++) {
    const w = b.weapons[i]!
    if (w.mode === 'off' || (w.kind === 'missile' && b.missiles < w.shots)) continue
    w.charge = Math.min(w.period, w.charge + chargeRate)
    if (w.mode === 'auto' && !fireLock(b, i)) fire(b, i)
  }
  const cls = SHIP_BY_ID[b.classId]!
  const enemyRate = enemyChargeRate(b)
  for (let i = 0; i < cls.guns.length && b.phase === 'battle'; i++) {
    const g = cls.guns[i]!
    b.enemy.charges[i] = Math.min(g.time, b.enemy.charges[i]! + enemyRate)
    const aim = b.enemy.aim
    if (aim && !aim[i] && b.enemy.charges[i]! >= g.time * AIM_AT) aim[i] = enemyTarget(b)
    if (b.enemy.charges[i]! >= g.time) {
      b.enemy.charges[i] = 0
      const target = aim ? aim[i] ?? enemyTarget(b) : createRng(`${b.seed}:target:${b.rolls++}`).pick(SHIP_ROOMS)
      if (aim) aim[i] = null
      shoot(b, 'enemy', g.kind, target, g.dmg, g.shots)
    }
  }
}
export function reduceShipBattle(state: ShipBattle, a: ShipOrder): ShipBattle {
  if (shipOrderLock(state, a)) return state
  const b = structuredClone(state)
  switch (a.type) {
    case 'hail': b.hailed = true; b.toll = b.kind === 'interception' ? Math.round((10 + 2 * b.enemy.maxHull) * (b.upgrades.translated ? 0.6 : 1)) : b.upgrades.translated ? 8 : 15; log(b, `Their captain asks for ${b.toll} credits to ${b.kind === 'interception' ? 'let us leave the jump point' : 'clear the tender\'s route'}.${b.upgrades.contextual ? ' Our translator identifies a face-saving way to refuse.' : ''}`); break
    case 'pay': finish(b, 'negotiated', text(b).paid); break
    case 'negotiate': finish(b, 'negotiated', b.kind === 'interception' ? 'We share our survey charts of the lanes behind us. Their captain calls it a fair trade and powers down weapons.' : 'We offer a public navigation advisory. Their captain calls it sufficient courtesy and opens the lane.'); break
    case 'evade':
      if (roll(b, evadeChance(b))) finish(b, 'evaded', text(b).evaded)
      else {
        b.phase = 'battle'; log(b, text(b).caught)
        // Rules 2: a failed run hands them the opening; their guns are nearly charged.
        if (b.rules === 2) SHIP_BY_ID[b.classId]!.guns.forEach((g, i) => { b.enemy.charges[i] = Math.max(b.enemy.charges[i]!, Math.floor(g.time * 0.75)) })
      }
      break
    case 'cancel': finish(b, 'cancelled', 'We decline the escort. The tender remains safely at the station.'); break
    case 'engage': b.phase = 'battle'; log(b, 'Weapons ready. Target a compartment and manage reactor power.'); break
    case 'advance': for (let i = 0; i < a.seconds && b.phase === 'battle'; i++) tick(b); break
    case 'power': b.power[a.system] = a.amount; b.shield = Math.min(b.shield, shieldCapacity(b)); break
    case 'weapon': b.weapons[a.index]!.mode = a.mode; if (a.mode === 'off') b.weapons[a.index]!.charge = 0; break
    case 'target': b.weapons[a.index]!.target = a.room; break
    case 'fire': fire(b, a.index); break
    // Rules 2 keep the team's progress when the same compartment is chosen again.
    case 'repair': b.repairWork = 0; b.repair = a.room; break
    case 'crew': { const c = b.crew!.find((m) => m.id === a.id)!; c.room = a.room; c.moving = CREW_MOVE_SECONDS; c.work = 0; break }
    // An ordinary retreat starts over; the Return Drive keeps what it has spun up.
    case 'retreat': b.escape = a.active; if (!a.active && b.kind !== 'finale') b.escapeWork = 0; break
    case 'accept-surrender': finish(b, 'yielded', text(b).yielded); break
  }
  return b
}
