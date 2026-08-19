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
  tier: 1 | 2
}

const ship = (
  id: string,
  name: string,
  cell: number,
  tier: 1 | 2,
  hull: number,
  shields: number,
  evade: number,
  guns: EnemyGunDef[],
): ShipClass => ({
  id,
  name,
  sprite: `/assets/ships/enemy-${String(cell).padStart(2, '0')}.png`,
  hull,
  shields,
  evade,
  guns,
  tier,
})

const laser = (time: number, shots: number, dmg: number): EnemyGunDef => ({ kind: 'laser', label: 'LASER', time, shots, dmg })
const missile = (time: number, dmg: number): EnemyGunDef => ({ kind: 'missile', label: 'MISSILE', time, shots: 1, dmg })
const ion = (time: number): EnemyGunDef => ({ kind: 'ion', label: 'ION', time, shots: 1, dmg: 0 })
const beam = (time: number, dmg: number): EnemyGunDef => ({ kind: 'beam', label: 'BEAM', time, shots: 1, dmg })

export const SHIP_CLASSES: ShipClass[] = [
  // Raiders — fast, cheap, and fond of missiles. They break when it stops paying.
  ship('rust-queen', 'the Rust Queen', 25, 1, 16, 0, 12, [laser(9, 2, 3)]),
  ship('carrion-jack', 'the Carrion Jack', 24, 1, 18, 1, 10, [laser(10, 2, 3), missile(16, 6)]),
  ship('reaver', 'KHR-77 Reaver', 9, 2, 24, 1, 14, [laser(9, 2, 3), missile(14, 7)]),
  // Militant patrol — disciplined gunnery behind real shields.
  ship('lance-cutter', 'a Lance-class cutter', 2, 1, 20, 1, 8, [laser(8, 2, 3), laser(12, 1, 4)]),
  ship('warden', 'a Warden-class corvette', 5, 2, 28, 2, 8, [laser(8, 2, 4), missile(15, 7)]),
  // Mercantile combine — armed haulers that would rather be paid than fight.
  ship('toll-barque', 'a combine toll barque', 16, 1, 18, 1, 5, [laser(10, 2, 3)]),
  ship('ledger', 'the Standing Ledger', 12, 2, 22, 2, 6, [laser(9, 2, 3), ion(11)]),
  // Xenophobic polity — strange hulls, stranger weapons.
  ship('silent-blade', 'a polity blade', 10, 1, 20, 1, 16, [ion(9), laser(10, 2, 3)]),
  ship('umbra', 'the Umbra', 13, 2, 26, 2, 12, [beam(16, 8), laser(10, 2, 3)]),
  // Scavenger clans — held together with spite and salvaged ordnance.
  ship('magpie', 'a clan magpie', 26, 1, 16, 0, 10, [laser(11, 2, 3), missile(18, 6)]),
  ship('tithe', 'the Tithe', 32, 2, 22, 1, 10, [missile(12, 7), laser(11, 2, 3)]),
  // Monastic order — pale, ornate, and surprisingly well armed.
  ship('cantor', 'an order cantor', 3, 1, 18, 2, 8, [laser(9, 2, 3)]),
  ship('reliquary', 'the Reliquary', 28, 2, 24, 2, 8, [ion(10), laser(9, 2, 4)]),
]

export const SHIP_BY_ID: Record<string, ShipClass> = Object.fromEntries(
  SHIP_CLASSES.map((s) => [s.id, s]),
)

/** Which classes each archetype flies. Raiders are the null-faction pool. */
const ARCHETYPE_POOLS: Record<FactionArchetype | 'raider', string[]> = {
  raider: ['rust-queen', 'carrion-jack', 'reaver'],
  'militant-patrol': ['lance-cutter', 'warden'],
  'mercantile-combine': ['toll-barque', 'ledger'],
  'xenophobic-polity': ['silent-blade', 'umbra'],
  'scavenger-clan': ['magpie', 'tithe'],
  'monastic-order': ['cantor', 'reliquary'],
}

/** The classes an archetype can field at the given escalation. */
export function classPool(archetype: FactionArchetype | 'raider', maxTier: 1 | 2): ShipClass[] {
  const pool = ARCHETYPE_POOLS[archetype].map((id) => SHIP_BY_ID[id]!)
  const eligible = pool.filter((s) => s.tier <= maxTier)
  return eligible.length > 0 ? eligible : pool
}
