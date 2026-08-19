/**
 * The pilot: a deterministic scripted player for the golden-replay recorder.
 *
 * It drives a run through the real reducer with ordinary actions only — no
 * state surgery, no teleports — so the log it produces is exactly what a
 * player could have entered, and replaying it from the seed lands on the
 * same final state byte for byte.
 *
 * It plays with the answer key open (clues are filed by their actual truth,
 * the Long Jump goes to the actual gateway): the job is to exercise the
 * systems and finish runs, not to prove the deduction fair — the mystery
 * contract suite owns that. An honest-deduction bot is R10 playtest work.
 */
import { hasIntelOn, HULL_MAX } from '../src/engine/combat/combat.js'
import type { OfficerRole } from '../src/engine/crew/types.js'
import { approachesFor } from '../src/engine/missions/sites.js'
import { canResearch, commsTier, jumpReady, requiredTier, type TechId } from '../src/engine/research/tech.js'
import {
  evidenceSites,
  newGame,
  reduce,
  sitePlan,
  vacancies,
} from '../src/engine/state/reducer.js'
import type { Action, GameState } from '../src/engine/state/types.js'
import { canScoop, FUEL_MAX, LONG_JUMP_RESERVE, routeTo } from '../src/engine/travel/travel.js'
import { GalaxyIndex } from '../src/engine/worldgen/index-galaxy.js'
import type { SystemId } from '../src/engine/worldgen/types.js'

const MAX_ACTIONS = 800
const RESEARCH_PRIORITY: TechId[] = [
  'comms-1',
  'comms-2',
  'rift-drive',
  'rift-shield',
  'trauma-protocols',
  'rift-telemetry',
  'fire-control',
]

export interface PilotRun {
  seed: string
  actions: Action[]
  final: GameState
}

/** Play a full run from the seed. Returns null if the pilot cannot finish. */
export function pilotRun(seed: string): PilotRun | null {
  let state = newGame(seed)
  const actions: Action[] = []

  const dispatch = (action: Action): boolean => {
    const next = reduce(state, action).state
    if (next === state) return false // The reducer refused it: an illegal move.
    state = next
    actions.push(action)
    return true
  }

  for (let step = 0; step < MAX_ACTIONS; step++) {
    if (state.outcome !== 'seeking') break
    const action = decide(state)
    if (action === null) return null // Stuck with no legal idea: seed fails.
    if (!dispatch(action)) return null // The pilot believed an illegal move.
  }

  if (state.outcome !== 'home') return null
  return { seed, actions, final: state }
}

/** One legal action, from the current state alone. Deterministic. */
function decide(state: GameState): Action | null {
  const index = new GalaxyIndex(state.galaxy)

  // A playing interception blocks everything else, so it goes first.
  if (state.combat !== null) return decideCombat(state, index)

  // Answer the playing scene: sign recruits, take walk-in evidence, else close.
  if (state.encounter !== null) return decideScene(state)

  // Refill emptied chairs before they are missed on the next mission.
  const vacant = vacancies(state)
  if (vacant.length > 0) return { type: 'promote', role: vacant[0]! }

  // Read what the bench can currently read.
  if (fit(state, 'science')) {
    const decodable = state.undecoded.find((id) => {
      const clue = state.mystery.clues.find((c) => c.id === id)!
      return requiredTier(clue.source.kind) <= commsTier(state)
    })
    if (decodable) return { type: 'decode', clue: decodable }
  }

  // Keep the bench busy: translation first, the rift projects when their
  // components are aboard, quality-of-life after.
  if (state.tech.active === null && fit(state, 'science')) {
    const next = RESEARCH_PRIORITY.find((id) => canResearch(state, id))
    if (next) return { type: 'startResearch', tech: next }
  }

  // File readable clues by their truth (see the header note on the open key).
  for (const id of state.collected) {
    if (state.undecoded.includes(id)) continue
    const clue = state.mystery.clues.find((c) => c.id === id)!
    const wanted = clue.truth === 'true' ? 'trusted' : 'doubted'
    if ((state.clueStates[id] ?? 'unfiled') !== wanted) {
      return { type: 'file', clue: id, state: wanted }
    }
  }

  // Work the system under the keel before flying anywhere.
  const here = state.ship.at
  const hasEvidenceHere = evidenceSites(state).has(here)
  if (hasEvidenceHere) {
    const { site } = sitePlan(state, here)
    if (site === null) return { type: 'search', system: here }
    return missionAction(state, here)
  }

  // A scarred drive taxes every lane; a yard fixes it while time passes.
  if (state.driveScarred && index.system(here).faction !== null && state.ship.fuel > 20) {
    return { type: 'refit' }
  }

  const remaining = [...evidenceSites(state)].sort()
  if (remaining.length === 0) {
    // Everything is gathered. Finish research, top up, and go home.
    if (jumpReady(state)) {
      if (state.ship.fuel >= LONG_JUMP_RESERVE) {
        return { type: 'plotTheJump', target: state.mystery.gateway }
      }
      return refuelAction(state, index)
    }
    // Waiting on the bench: spend days without spending the run.
    return passTimeAction(state, index)
  }

  // Fly to the nearest remaining evidence, keeping fuel above the floor.
  const routes = remaining
    .map((id) => ({ id, route: routeTo(index, here, id) }))
    .filter((r) => r.route !== null)
    .map((r) => ({ id: r.id, cost: effectiveCost(state, r.route!.cost) }))
    .sort((a, b) => a.cost - b.cost || (a.id < b.id ? -1 : 1))
  if (routes.length === 0) return null

  const target = routes[0]!
  const fuelAfter = state.ship.fuel - target.cost
  // Top up before a leg that would land under the reserve, when we can.
  if (fuelAfter < LONG_JUMP_RESERVE && canScoop(index, here) && state.ship.fuel < FUEL_MAX) {
    return { type: 'scoop' }
  }
  if (target.cost <= state.ship.fuel && fuelAfter >= 4) {
    return { type: 'travel', to: target.id }
  }
  return refuelAction(state, index)
}

function decideCombat(state: GameState, index: GalaxyIndex): Action {
  const combat = state.combat!
  if (combat.phase === 'contact') {
    // Intelligence ends it bloodlessly; otherwise try to slip the intercept.
    if (hasIntelOn(state, index, combat.enemy.faction)) {
      return { type: 'combatContact', choice: 'hail' }
    }
    return { type: 'combatContact', choice: 'evade' }
  }
  if (combat.phase === 'toll') {
    return { type: 'combatToll', pay: state.ship.fuel > combat.toll + 10 }
  }
  // Battle. The sim is presentation; the pilot reports a costly escape. The
  // engine clamps the report either way.
  return {
    type: 'combatResolve',
    result: 'fled',
    hullLeft: Math.max(20, state.ship.hull - 15),
    missilesLeft: Math.max(0, state.ordnance - 2),
  }
}

function decideScene(state: GameState): Action {
  const scene = state.encounter!
  const usable = scene.options.filter((o) => !o.needs || fit(state, o.needs))

  // The threshold: commit the transit and end the voyage.
  const transit = usable.find((o) => o.effect.kind === 'transit')
  if (transit) return { type: 'sceneOption', option: transit.id }

  const recruit = usable.find((o) => o.effect.kind === 'recruit')
  if (recruit && state.recruits.sites[scene.at]) return { type: 'sceneOption', option: recruit.id }

  const collect = usable.find(
    (o) =>
      o.effect.kind === 'collect' &&
      (o.effect.fuel === undefined || state.ship.fuel > o.effect.fuel + 8),
  )
  if (collect && state.ship.at === scene.at) return { type: 'sceneOption', option: collect.id }

  // Close it by whatever remains; missions and searches reopen the site path.
  const close = usable.find((o) => o.effect.kind === 'dismiss' || o.effect.kind === 'mission')
  return { type: 'sceneOption', option: (close ?? usable[0] ?? scene.options[0]!).id }
}

function missionAction(state: GameState, system: SystemId): Action {
  const { site } = sitePlan(state, system)
  const team = {
    captain: false,
    officers: (['science', 'security', 'medical'] as const).filter((role) => fit(state, role)),
    escorts: Math.min(4, state.pools.security),
    hands: 0,
  }
  // The best odds an approach offers, given who is actually on the shuttle.
  const approaches = approachesFor(site!)
    .filter((a) => a.needs === null || team.officers.includes(a.needs as never))
    .sort((a, b) => b.clean - a.clean)
  return { type: 'runMission', system, team, approach: approaches[0]!.id }
}

/** Get fuel: scoop here, or fly to the nearest gas giant and scoop there. */
function refuelAction(state: GameState, index: GalaxyIndex): Action | null {
  const here = state.ship.at
  if (canScoop(index, here) && state.ship.fuel < FUEL_MAX) return { type: 'scoop' }

  const scoopable = index.systems
    .filter((s) => s.id !== here && canScoop(index, s.id))
    .map((s) => ({ id: s.id, route: routeTo(index, here, s.id) }))
    .filter((r) => r.route !== null)
    .map((r) => ({ id: r.id, cost: effectiveCost(state, r.route!.cost) }))
    .filter((r) => r.cost <= state.ship.fuel)
    .sort((a, b) => a.cost - b.cost || (a.id < b.id ? -1 : 1))
  if (scoopable.length > 0) return { type: 'travel', to: scoopable[0]!.id }
  return null
}

/** Spend days waiting on the bench without burning the run down. */
function passTimeAction(state: GameState, index: GalaxyIndex): Action | null {
  const here = state.ship.at
  if (canScoop(index, here) && state.ship.fuel < FUEL_MAX) return { type: 'scoop' }
  if (
    (state.driveScarred || state.ship.hull < HULL_MAX) &&
    index.system(here).faction !== null &&
    state.ship.fuel > 15
  ) {
    return { type: 'refit' }
  }
  // A round trip down the cheapest lane: days pass, little fuel burns.
  const neighbours = index
    .neighbours(here)
    .map((id) => ({ id, cost: effectiveCost(state, routeTo(index, here, id)?.cost ?? Infinity) }))
    .filter((n) => n.cost <= state.ship.fuel - LONG_JUMP_RESERVE)
    .sort((a, b) => a.cost - b.cost || (a.id < b.id ? -1 : 1))
  if (neighbours.length > 0) return { type: 'travel', to: neighbours[0]!.id }
  return null
}

function effectiveCost(state: GameState, base: number): number {
  return state.driveScarred ? Math.ceil(base * 1.3) : base
}

function fit(state: GameState, role: OfficerRole): boolean {
  return state.roster.some((o) => o.role === role && o.status === 'fit')
}

