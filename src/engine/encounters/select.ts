import type { Rng } from '../rng/prng.js'
import type { GameState } from '../state/types.js'
import type { StarSystem, SystemId } from '../worldgen/types.js'
import { ENCOUNTERS, encounterDef } from './catalog.js'
import type { EncounterDef, EncounterWhen } from './types.js'

/**
 * Encounter selection: who is waiting when the ship arrives.
 *
 * Scheduled follow-ups take precedence — a hunter that has your scent finds
 * you wherever you jump. Otherwise the arrival rolls against a flat chance,
 * and a weighted pick runs over every encounter whose conditions the system,
 * the calendar, the war and the story flags all satisfy. Uniques are barred
 * by their `done:` flag the moment they fire, so nothing plays twice unless
 * it was authored to.
 */

/** The chance that an arrival with no scheduled business rolls an encounter. */
export const ENCOUNTER_CHANCE = 0.55

export function doneFlag(id: string): string {
  return `done:${id}`
}

function passesWhen(when: EncounterWhen | undefined, state: GameState, system: StarSystem): boolean {
  if (!when) return true
  if (when.regions && !when.regions.includes(system.region)) return false
  if (when.features && !when.features.some((f) => system.features.includes(f))) return false
  if (when.factionSpace !== undefined && (system.faction !== null) !== when.factionSpace) return false
  if (when.minDay !== undefined && state.day < when.minDay) return false
  if (when.maxDay !== undefined && state.day > when.maxDay) return false
  if (when.minWar !== undefined && state.warPressure < when.minWar) return false
  if (when.flagsAll && !when.flagsAll.every((f) => state.flags.includes(f))) return false
  if (when.flagsNone && when.flagsNone.some((f) => state.flags.includes(f))) return false
  return true
}

/**
 * True when an encounter's *flag* conditions can no longer pass — the signal
 * that a scheduled thread has been closed by later events (the Echo killed,
 * the debt settled). Location and calendar conditions never block: a hunter
 * that has not found you yet is not a dead thread.
 */
export function flagsBlock(id: string, state: GameState): boolean {
  const def = encounterDef(id)
  if (!def?.when) return false
  const { flagsAll, flagsNone } = def.when
  if (flagsAll && !flagsAll.every((f) => state.flags.includes(f))) return true
  if (flagsNone && flagsNone.some((f) => state.flags.includes(f))) return true
  return false
}

export function eligibleHere(def: EncounterDef, state: GameState, system: StarSystem): boolean {
  if (def.weight <= 0) return false
  if ((def.unique ?? true) && state.flags.includes(doneFlag(def.id))) return false
  return passesWhen(def.when, state, system)
}

/**
 * The encounter this arrival produces, if any. Pure: draws only from the
 * supplied rng. Follow-ups fire the moment they are due and their own
 * conditions (if any) pass; among several due, the earliest scheduled wins,
 * ties broken by id so replays agree.
 */
export function chooseEncounter(
  state: GameState,
  at: SystemId,
  rng: Rng,
): { def: EncounterDef; fromPending: boolean } | null {
  const system = state.galaxy.systems.find((s) => s.id === at)
  if (!system) return null

  const due = state.pending
    .filter((p) => p.notBefore <= state.day)
    .sort((a, b) => a.notBefore - b.notBefore || (a.id < b.id ? -1 : 1))
  for (const p of due) {
    const def = encounterDef(p.id)
    if (def && passesWhen(def.when, state, system)) return { def, fromPending: true }
  }

  if (!rng.chance(ENCOUNTER_CHANCE)) return null

  const pool = ENCOUNTERS.filter((def) => eligibleHere(def, state, system))
  if (pool.length === 0) return null
  const def = rng.weighted(pool.map((def) => [def, def.weight] as const))
  return { def, fromPending: false }
}
