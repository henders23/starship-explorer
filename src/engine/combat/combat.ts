import type { Officer } from '../crew/types.js'
import { createRng, type Rng } from '../rng/prng.js'
import type { GameState } from '../state/types.js'
import type { GalaxyIndex } from '../worldgen/index-galaxy.js'
import type { RegionId, SystemId } from '../worldgen/types.js'

/**
 * Ship-to-ship combat, R5 scope: legible, turn-based, and avoidable.
 *
 * Contacts are seeded interceptions in the dangerous regions once the early
 * grace period ends. Every fight opens with a posture choice — hail, evade,
 * engage — and every number the resolution uses is printed on the buttons.
 * Destroying the enemy is enough; there is no boarding and no capture. What
 * intelligence buys is the bloodless endings: a faction the player holds
 * collected evidence on stands down when hailed and yields when hurt.
 */

export const HULL_MAX = 100

export interface EnemyShip {
  name: string
  /** The claiming faction, or null for raiders. Raiders never yield. */
  faction: string | null
  hull: number
  hullMax: number
  /** Damage per volley. */
  guns: number
}

export interface CombatState {
  at: SystemId
  enemy: EnemyShip
  phase: 'contact' | 'toll' | 'battle'
  round: number
  /** The toll demanded on a hail that met a mercenary mood. */
  toll: number
}

/** Where space has teeth. The Shallows and the Trade Reach stay quiet. */
const CONTACT_CHANCE: Record<RegionId, number> = {
  shallows: 0,
  'trade-reach': 0.08,
  xenoline: 0.15,
  'cinder-belt': 0.2,
  'rift-margin': 0.25,
}

/** The first days are for learning the game, not fighting it. */
export const CONTACT_GRACE_DAYS = 12

export function contactChance(state: GameState, region: RegionId): number {
  if (state.day < CONTACT_GRACE_DAYS) return 0
  return Math.min(0.35, CONTACT_CHANCE[region] + state.surges * 0.02)
}

const RAIDER_NAMES = ['the Rust Queen', 'the Tithe', 'the Half-Life', 'the Cinder Jack', 'the Lean Year']

/** Cast the intercepting ship for a system, escalating with the rift. */
export function buildContact(rng: Rng, state: GameState, at: SystemId, index: GalaxyIndex): EnemyShip {
  const system = index.system(at)
  const faction = system.faction
  const hullMax = 30 + rng.int(30) + state.surges * 3
  return {
    name: faction
      ? `a patrol cutter of ${index.factionName(faction)}`
      : `a raider — ${rng.pick(RAIDER_NAMES)}`,
    faction,
    hull: hullMax,
    hullMax,
    guns: 6 + rng.int(6) + Math.min(4, state.surges),
  }
}

/**
 * Intelligence: collected evidence sourced from a faction's own space. It is
 * the premium currency here too — it opens the bloodless endings.
 */
export function hasIntelOn(state: GameState, index: GalaxyIndex, faction: string | null): boolean {
  if (!faction) return false
  return state.mystery.clues.some(
    (clue) =>
      state.collected.includes(clue.id) && index.system(clue.source.at).faction === faction,
  )
}

/** The ship's volley: the security officer's gunnery plus fire control. */
export function playerDamage(state: GameState, roster: readonly Officer[]): number {
  const gunnery = roster.find((o) => o.role === 'security' && o.status === 'fit')?.skill ?? 0
  const refit = state.tech.researched.includes('fire-control') ? 4 : 0
  return 8 + 2 * Math.max(0, gunnery - 2) + refit
}

/** Odds shown on the buttons — and used by the dice. */
export const EVADE_CHANCE = 0.6
export const EVADE_CLEAN_DRIVE_BONUS = 0.1
export const FLEE_CHANCE = 0.55
export const FLEE_SHIELDS_BONUS = 0.15
export const HAIL_TOLL_CHANCE = 0.5
export const YIELD_HULL_FRACTION = 0.3
export const RAIDER_BREAK_FRACTION = 0.2
export const TOLL_FUEL = 5
export const WRECK_SALVAGE_FUEL = 8
export const YIELD_TRIBUTE_FUEL = 8

/** The per-decision RNG stream: seeded by how many contacts came before. */
export function combatRng(state: GameState, step: string): Rng {
  return createRng(`${state.seed}:combat:${state.combats}:${step}`)
}
