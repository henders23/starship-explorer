import type { FactionArchetype } from '../worldgen/types.js'

/**
 * The enemy ship catalog: classes cut from the fleet art, each with its own
 * hull, shields, evasion and battery. Classes are grouped by the faction
 * archetype that flies them (raiders fly their own), in two tiers — the
 * rift's escalation promotes contacts to the heavier tier over time.
 *
 * Damage scales: enemy guns are stated against the player's 100-point hull;
 * player weapons are stated against these hulls (a laser hit is 1).
 */

export interface EnemyGunDef {
  kind: 'laser' | 'missile' | 'ion' | 'beam'
  label: string
  /** Seconds per charge. */
  time: number
  shots: number
  /** Damage per shot, on the player's 100-point hull scale. */
  dmg: number
}

export type EnemyRoomKey = 'helm' | 'weapons' | 'shields' | 'engines'

export interface EnemyRoomBox {
  x: number
  y: number
  w: number
  h: number
}

/**
 * Interior plans (R9): each archetype's hulls arrange their compartments
 * differently, so the tactical display reads the faction at a glance.
 * Boxes are percentages of the enemy panel.
 */
export type EnemyLayoutId = 'spine' | 'raider' | 'hauler' | 'alien' | 'clan' | 'order' | 'flagship'

export const ENEMY_LAYOUTS: Record<EnemyLayoutId, Record<EnemyRoomKey, EnemyRoomBox>> = {
  /** The stacked service spine of a disciplined patrol hull. */
  spine: {
    helm: { x: 30, y: 14, w: 40, h: 10 },
    weapons: { x: 26, y: 32, w: 48, h: 12 },
    shields: { x: 26, y: 50, w: 48, h: 12 },
    engines: { x: 28, y: 70, w: 44, h: 13 },
  },
  /** Raider hulls grow by accretion; nothing lines up with anything. */
  raider: {
    helm: { x: 14, y: 16, w: 30, h: 12 },
    weapons: { x: 52, y: 28, w: 36, h: 13 },
    shields: { x: 16, y: 48, w: 32, h: 12 },
    engines: { x: 50, y: 66, w: 38, h: 14 },
  },
  /** A cargo frame under arms: small bridge, wide engineering. */
  hauler: {
    helm: { x: 38, y: 12, w: 24, h: 10 },
    weapons: { x: 62, y: 34, w: 26, h: 12 },
    shields: { x: 12, y: 34, w: 44, h: 12 },
    engines: { x: 18, y: 62, w: 64, h: 16 },
  },
  /** The polity's diamond plan, symmetric about both axes. */
  alien: {
    helm: { x: 34, y: 10, w: 32, h: 11 },
    weapons: { x: 10, y: 40, w: 32, h: 13 },
    shields: { x: 58, y: 40, w: 32, h: 13 },
    engines: { x: 34, y: 72, w: 32, h: 13 },
  },
  /** Clan patchwork: whatever fit, welded where it landed. */
  clan: {
    helm: { x: 56, y: 14, w: 34, h: 12 },
    weapons: { x: 10, y: 26, w: 34, h: 14 },
    shields: { x: 52, y: 44, w: 38, h: 12 },
    engines: { x: 12, y: 62, w: 36, h: 16 },
  },
  /** The order builds down the centreline, like a cathedral nave. */
  order: {
    helm: { x: 36, y: 10, w: 28, h: 12 },
    weapons: { x: 36, y: 30, w: 28, h: 14 },
    shields: { x: 36, y: 52, w: 28, h: 12 },
    engines: { x: 36, y: 72, w: 28, h: 13 },
  },
  /** A line warship: the gun deck runs the length of the hull. */
  flagship: {
    helm: { x: 12, y: 14, w: 26, h: 12 },
    weapons: { x: 10, y: 34, w: 80, h: 13 },
    shields: { x: 44, y: 14, w: 44, h: 12 },
    engines: { x: 24, y: 66, w: 52, h: 15 },
  },
}

/** The compartment strength every hull shipped with before R9. */
const DEFAULT_ROOMS: Record<EnemyRoomKey, number> = { helm: 2, weapons: 4, shields: 4, engines: 3 }

export interface ShipClass {
  id: string
  name: string
  sprite: string
  hull: number
  /** Shield layers, 0–2. Lasers and beams are absorbed; missiles are not. */
  shields: number
  /** Base evade percentage. */
  evade: number
  guns: EnemyGunDef[]
  tier: 1 | 2 | 3
  /** Which interior plan the tactical display draws. */
  layout: EnemyLayoutId
  /** Compartment hit points, per room. */
  rooms: Record<EnemyRoomKey, number>
}

const ship = (
  id: string,
  name: string,
  cell: number,
  tier: 1 | 2 | 3,
  hull: number,
  shields: number,
  evade: number,
  guns: EnemyGunDef[],
  layout: EnemyLayoutId,
  rooms: Record<EnemyRoomKey, number> = DEFAULT_ROOMS,
): ShipClass => ({
  id,
  name,
  sprite: `/assets/ships/enemy-${String(cell).padStart(2, '0')}.png`,
  hull,
  shields,
  evade,
  guns,
  tier,
  layout,
  rooms,
})

const laser = (time: number, shots: number, dmg: number): EnemyGunDef => ({ kind: 'laser', label: 'LASER', time, shots, dmg })
const missile = (time: number, dmg: number): EnemyGunDef => ({ kind: 'missile', label: 'MISSILE', time, shots: 1, dmg })
const ion = (time: number): EnemyGunDef => ({ kind: 'ion', label: 'ION', time, shots: 1, dmg: 0 })
const beam = (time: number, dmg: number): EnemyGunDef => ({ kind: 'beam', label: 'BEAM', time, shots: 1, dmg })

export const SHIP_CLASSES: ShipClass[] = [
  // Raiders — fast, cheap, and fond of missiles. They break when it stops paying.
  ship('rust-queen', 'the Rust Queen', 25, 1, 16, 0, 12, [laser(9, 2, 3)], 'raider'),
  ship('carrion-jack', 'the Carrion Jack', 24, 1, 18, 1, 10, [laser(10, 2, 3), missile(16, 6)], 'raider'),
  ship('reaver', 'KHR-77 Reaver', 9, 2, 24, 1, 14, [laser(9, 2, 3), missile(14, 7)], 'raider'),
  // Militant patrol — disciplined gunnery behind real shields.
  ship('lance-cutter', 'a Lance-class cutter', 2, 1, 20, 1, 8, [laser(8, 2, 3), laser(12, 1, 4)], 'spine'),
  ship('warden', 'a Warden-class corvette', 5, 2, 28, 2, 8, [laser(8, 2, 4), missile(15, 7)], 'spine'),
  // Mercantile combine — armed haulers that would rather be paid than fight.
  ship('toll-barque', 'a combine toll barque', 16, 1, 18, 1, 5, [laser(10, 2, 3)], 'hauler'),
  ship('ledger', 'the Standing Ledger', 12, 2, 22, 2, 6, [laser(9, 2, 3), ion(11)], 'hauler'),
  // Xenophobic polity — strange hulls, stranger weapons.
  ship('silent-blade', 'a polity blade', 10, 1, 20, 1, 16, [ion(9), laser(10, 2, 3)], 'alien'),
  ship('umbra', 'the Umbra', 13, 2, 26, 2, 12, [beam(16, 8), laser(10, 2, 3)], 'alien'),
  // Scavenger clans — held together with spite and salvaged ordnance.
  ship('magpie', 'a clan magpie', 26, 1, 16, 0, 10, [laser(11, 2, 3), missile(18, 6)], 'clan'),
  ship('tithe', 'the Tithe', 32, 2, 22, 1, 10, [missile(12, 7), laser(11, 2, 3)], 'clan'),
  // Monastic order — pale, ornate, and surprisingly well armed.
  ship('cantor', 'an order cantor', 3, 1, 18, 2, 8, [laser(9, 2, 3)], 'order'),
  ship('reliquary', 'the Reliquary', 28, 2, 24, 2, 8, [ion(10), laser(9, 2, 4)], 'order'),
  // The tier-3 capstone (R9): the heaviest thing any faction keeps in
  // reserve, brought out only once the rift has made everyone desperate.
  ship(
    'sovereign', 'the Ashen Sovereign', 7, 3, 34, 2, 10,
    [beam(14, 8), laser(8, 2, 4), missile(15, 7)],
    'flagship',
    { helm: 3, weapons: 6, shields: 6, engines: 4 },
  ),
]

export const SHIP_BY_ID: Record<string, ShipClass> = Object.fromEntries(
  SHIP_CLASSES.map((s) => [s.id, s]),
)

/** Which classes each archetype flies. Raiders are the null-faction pool;
 * the flagship is the reserve every real navy keeps, raiders excepted. */
const ARCHETYPE_POOLS: Record<FactionArchetype | 'raider', string[]> = {
  raider: ['rust-queen', 'carrion-jack', 'reaver'],
  'militant-patrol': ['lance-cutter', 'warden', 'sovereign'],
  'mercantile-combine': ['toll-barque', 'ledger', 'sovereign'],
  'xenophobic-polity': ['silent-blade', 'umbra', 'sovereign'],
  'scavenger-clan': ['magpie', 'tithe', 'sovereign'],
  'monastic-order': ['cantor', 'reliquary', 'sovereign'],
}

/** The classes an archetype can field at the given escalation. */
export function classPool(archetype: FactionArchetype | 'raider', maxTier: 1 | 2 | 3): ShipClass[] {
  const pool = ARCHETYPE_POOLS[archetype].map((id) => SHIP_BY_ID[id]!)
  const eligible = pool.filter((s) => s.tier <= maxTier)
  return eligible.length > 0 ? eligible : pool
}
