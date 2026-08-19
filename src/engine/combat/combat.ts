import { createRng, type Rng } from '../rng/prng.js'
import type { GameState } from '../state/types.js'
import type { GalaxyIndex } from '../worldgen/index-galaxy.js'
import type { RegionId, SystemId } from '../worldgen/types.js'
import { classPool, SHIP_BY_ID, type ShipClass } from './ships.js'

/**
 * Ship-to-ship combat, rebuilt FTL-style.
 *
 * The split of responsibilities keeps the engine pure: contacts, ship-class
 * selection, posture dialogue (hail, toll, evade) and every reward are
 * deterministic engine rules — while the battle itself is a real-time
 * simulation run by the UI (rooms, power, weapon charge, shields), whose
 * *outcome* comes back as an ordinary logged action (`combatResolve`). A
 * seed plus an action log still replays exactly: the battle's result is in
 * the log the way every other player decision is.
 *
 * Intelligence remains the premium currency: collected evidence out of a
 * faction's own space lets a hail end the interception before it starts,
 * and takes a hurt patrol's surrender mid-battle.
 */

export const HULL_MAX = 100
export const ORDNANCE_MAX = 10

export interface CombatEnemy {
  /** Key into the ship catalog. */
  classId: string
  name: string
  /** The claiming faction, or null for raiders. Raiders never yield. */
  faction: string | null
}

export interface CombatState {
  at: SystemId
  enemy: CombatEnemy
  phase: 'contact' | 'toll' | 'battle'
  /** The toll demanded on a hail that met a mercenary mood. */
  toll: number
}

/**
 * Where space has teeth, priced **per jump** (R11).
 *
 * Danger used to be rolled once per journey, against the destination's
 * region — which made a six-jump haul through the Margin mechanically safer
 * per lane than a single hop, and left most of a run's flying hours empty.
 * Now every lane crossed rolls against the region it carries the ship into,
 * so the chart is a standing question: the short cut through the Cinder
 * Belt, or the long way round through the Shallows.
 *
 * The Shallows stay silent by design — the arrival region is where a
 * captain learns the game, and silence there keeps meaning something.
 */
const CONTACT_CHANCE: Record<RegionId, number> = {
  shallows: 0,
  'trade-reach': 0.06,
  xenoline: 0.11,
  'cinder-belt': 0.13,
  'rift-margin': 0.17,
}

/** The first days are for learning the game, not fighting it. */
export const CONTACT_GRACE_DAYS = 12

/**
 * The chance that crossing one lane into `region` draws an interception.
 *
 * The rift's escalation *scales* the danger a region already has rather
 * than adding to it, so the Shallows stay silent however bad things get.
 * A sector needs one corner a battered ship can retreat into; without it,
 * "go somewhere quiet and finish the research" stops being a move.
 */
export function contactChance(state: GameState, region: RegionId): number {
  if (state.day < CONTACT_GRACE_DAYS) return 0
  return Math.min(0.26, CONTACT_CHANCE[region] * (1 + state.surges * 0.12))
}

/** Cast the intercepting ship: archetype by claim, tier by escalation. */
export function buildContact(rng: Rng, state: GameState, at: SystemId, index: GalaxyIndex): CombatEnemy {
  const system = index.system(at)
  const faction = system.faction
  const archetype = faction
    ? state.galaxy.factions.find((f) => f.id === faction)?.archetype ?? 'militant-patrol'
    : 'raider'
  // The heavier hulls come out once the rift has surged twice; the
  // flagships, only when it has surged enough to frighten navies.
  const maxTier: 1 | 2 | 3 = state.surges >= 4 ? 3 : state.surges >= 2 ? 2 : 1
  const shipClass = rng.pick(classPool(archetype, maxTier))
  return {
    classId: shipClass.id,
    name: faction
      ? `${shipClass.name} of ${index.factionName(faction)}`
      : shipClass.name,
    faction,
  }
}

export function enemyClass(enemy: CombatEnemy): ShipClass {
  return SHIP_BY_ID[enemy.classId] ?? SHIP_BY_ID['rust-queen']!
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

/**
 * Everything the battle simulation needs from the campaign, derived
 * deterministically here so the sim stays presentation. Weapons come from
 * research, pace from the gunner and the security chief, ammunition from
 * the magazine, and the hull is the hull — damage taken in battle persists.
 */
export interface BattleParams {
  hull: number
  hullMax: number
  /** The magazine going in; what is left comes back via combatResolve. */
  missiles: number
  /** Weapon charge-rate multiplier (fire control, gunner specialists). */
  chargeMult: number
  /** Percentage points shaved off the enemy's evade (gunnery skill). */
  accuracy: number
  /** Attack craft in the launch bay for this engagement. */
  drones: number
  hasIon: boolean
  hasBeam: boolean
  /** A yield is on the table: faction enemy + intelligence held. */
  intel: boolean
}

export function battleParams(state: GameState, index: GalaxyIndex): BattleParams {
  const gunnery = state.roster.find((o) => o.role === 'security' && o.status === 'fit')?.skill ?? 0
  const gunners = state.recruits.aboard.filter((s) => s.focus === 'gunnery').length
  const faction = state.combat?.enemy.faction ?? null
  return {
    hull: state.ship.hull,
    hullMax: HULL_MAX,
    missiles: state.ordnance,
    chargeMult:
      1 + (state.tech.researched.includes('fire-control') ? 0.2 : 0) + 0.15 * gunners,
    accuracy: Math.max(0, gunnery - 2) * 3,
    drones: 8,
    hasIon: state.tech.researched.includes('ion-disruptor'),
    hasBeam: state.tech.researched.includes('focus-beam'),
    intel: hasIntelOn(state, index, faction),
  }
}

/** Odds shown on the posture buttons — and used by the dice. */
export const EVADE_CHANCE = 0.6
export const EVADE_CLEAN_DRIVE_BONUS = 0.1
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
