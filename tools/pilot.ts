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
import type { MysteryOptions } from '../src/engine/mystery/generate.js'
import { canScoop, FUEL_MAX, LONG_JUMP_RESERVE, nearestScoopCost, routeTo } from '../src/engine/travel/travel.js'
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
  /** The pilot ran out of ideas, legality, or the action cap mid-voyage. */
  stalled: boolean
}

/** Play a run from the seed to whatever end it reaches. */
export function pilotRun(seed: string, options?: Partial<MysteryOptions>): PilotRun {
  let state = newGame(seed, options)
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
    // No legal idea, or a move the reducer refused: the pilot is stuck.
    if (action === null || !dispatch(action)) {
      return { seed, actions, final: state, stalled: true }
    }
  }

  return { seed, actions, final: state, stalled: state.outcome === 'seeking' }
}

/** One legal action, from the current state alone. Deterministic. */
function decide(state: GameState): Action | null {
  const index = new GalaxyIndex(state.galaxy)

  // A playing interception blocks everything else, so it goes first.
  if (state.combat !== null) return decideCombat(state, index)

  // A team holding at its mid-ground decision: take the best printed odds
  // the roster can actually deliver.
  if (state.crisis !== null) {
    const usable = state.crisis.choices.filter(
      (c) => !c.needs || (state.crisis!.team.officers.includes(c.needs) && fit(state, c.needs)),
    )
    const best = [...usable].sort((a, b) => b.shift.clean - a.shift.clean)[0]
    return { type: 'crisisCall', choice: (best ?? state.crisis.choices[0]!).id }
  }

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

  // Opportunistic seamanship: riding over a gas giant with a half-empty
  // tank, fill it. Two days now beats a dry tank three systems out.
  if (canScoop(index, here) && state.ship.fuel <= 45) return { type: 'scoop' }

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

  // Fly to the nearest evidence — but never onto a leg that lands beyond
  // rescue: after arriving, the tank must still reach that system's nearest
  // pump with a surge's worth of slack (the rift can steal ten mid-leg).
  // Legs that only *arrive* are how ships strand.
  const routes = remaining
    .map((id) => ({ id, route: routeTo(index, here, id) }))
    .filter((r) => r.route !== null)
    .map((r) => ({ id: r.id, cost: effectiveCost(state, r.route!.cost) }))
    .sort((a, b) => a.cost - b.cost || (a.id < b.id ? -1 : 1))
  if (routes.length === 0) return null

  const SURGE_SLACK = 10
  const safeLeg = (id: SystemId, cost: number): boolean => {
    const after = state.ship.fuel - cost
    if (after < 2) return false
    if (canScoop(index, id)) return true
    return after >= effectiveCost(state, nearestGiantCost(index, id)) + SURGE_SLACK
  }
  const safe = routes.filter((r) => safeLeg(r.id, r.cost))
  if (safe.length > 0) return { type: 'travel', to: safe[0]!.id }

  // No safe direct leg: stage the journey — hop to a pump that brings the
  // nearest target closer, scoop there, and look again. Long routes are
  // bought in instalments, the way anyone sane crosses a desert.
  const target = routes[0]!
  const targetBase = routeTo(index, here, target.id)!.cost
  const stage = index.systems
    .filter((s) => s.id !== here && canScoop(index, s.id))
    .map((s) => ({
      id: s.id,
      cost: effectiveCost(state, routeTo(index, here, s.id)?.cost ?? Infinity),
      onward: routeTo(index, s.id, target.id)?.cost ?? Infinity,
    }))
    .filter((g) => g.cost <= state.ship.fuel - 2 && g.onward < targetBase - 2)
    .sort((a, b) => a.onward - b.onward || a.cost - b.cost || (a.id < b.id ? -1 : 1))
  if (stage.length > 0) return { type: 'travel', to: stage[0]!.id }

  // Still nothing: top the tank up and reconsider next turn.
  if (state.ship.fuel < FUEL_MAX - 4) {
    const refuel = refuelAction(state, index)
    if (refuel) return refuel
  }

  // The remaining evidence is beyond any staged route. If the way home is
  // already open, the completionist tour ends here: go home.
  if (jumpReady(state) && state.ship.fuel >= LONG_JUMP_RESERVE) {
    return { type: 'plotTheJump', target: state.mystery.gateway }
  }

  // A full tank, no stage, no way home yet: the desperate leg, eyes open.
  const affordable = routes.filter((r) => state.ship.fuel - r.cost >= 4)
  if (affordable.length > 0) return { type: 'travel', to: affordable[0]!.id }
  return refuelAction(state, index)
}

/** Cached per galaxy: the sweep asks for these thousands of times. */
const giantDistCache = new WeakMap<object, Map<SystemId, number>>()
function nearestGiantCost(index: GalaxyIndex, from: SystemId): number {
  let cache = giantDistCache.get(index.galaxy)
  if (!cache) {
    cache = new Map()
    giantDistCache.set(index.galaxy, cache)
  }
  const known = cache.get(from)
  if (known !== undefined) return known
  const best = nearestScoopCost(index, from)
  cache.set(from, best)
  return best
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

  // A transit find: take it when the ship actually wants what it offers.
  const salvage = usable.find((o) => {
    if (o.effect.kind !== 'salvage') return false
    const { fuel = 0, ordnance = 0, hull = 0, research = 0 } = o.effect
    if (fuel > 0 && state.ship.fuel <= FUEL_MAX - fuel) return true
    if (ordnance > 0 && state.ordnance < 8) return true
    if (hull > 0 && state.ship.hull < 90) return true
    return research > 0 && state.tech.active !== null
  })
  if (salvage) return { type: 'sceneOption', option: salvage.id }

  const recruit = usable.find((o) => o.effect.kind === 'recruit')
  if (recruit && state.recruits.sites[scene.at]) return { type: 'sceneOption', option: recruit.id }

  // Collect on the cheapest terms the tank prefers: below 45 fuel, days are
  // cheaper than fuel; above, the priced fast lane is fine.
  const collects = usable.filter(
    (o) =>
      o.effect.kind === 'collect' &&
      (o.effect.fuel === undefined || state.ship.fuel > o.effect.fuel + 8),
  )
  const free = collects.find((o) => o.effect.kind === 'collect' && !o.effect.fuel)
  const collect = state.ship.fuel < 45 ? (free ?? collects[0]) : collects[0]
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

/**
 * Get fuel: scoop here, fly to the nearest reachable gas giant — or, when
 * no giant is in range, board the nearest reachable derelict: its tanks are
 * the engine's designed escape valve for exactly this trap.
 */
function refuelAction(state: GameState, index: GalaxyIndex): Action | null {
  const here = state.ship.at
  if (canScoop(index, here) && state.ship.fuel < FUEL_MAX) return { type: 'scoop' }

  const reach = (ids: string[]): string | null => {
    const routed = ids
      .filter((id) => id !== here)
      .map((id) => ({ id, route: routeTo(index, here, id) }))
      .filter((r) => r.route !== null)
      .map((r) => ({ id: r.id, cost: effectiveCost(state, r.route!.cost) }))
      .filter((r) => r.cost <= state.ship.fuel)
      .sort((a, b) => a.cost - b.cost || (a.id < b.id ? -1 : 1))
    return routed[0]?.id ?? null
  }

  const giant = reach(index.systems.filter((s) => canScoop(index, s.id)).map((s) => s.id))
  if (giant) return { type: 'travel', to: giant }

  const derelicts = state.mystery.clues
    .filter((c) => c.source.kind === 'derelict-log' && !state.collected.includes(c.id))
    .map((c) => c.source.at)
    .filter((id) => !state.searched.includes(id))
  const wreck = reach(derelicts)
  if (wreck === here && sitePlan(state, here).site !== null) return missionAction(state, here)
  if (wreck) return { type: 'travel', to: wreck }
  return null
}

/** Spend days waiting on the bench without spending the run. */
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
  // Ride toward a gas giant: the trip passes the days and the scoop pays
  // the fuel back with interest.
  const refuel = refuelAction(state, index)
  if (refuel) return refuel
  // Full tank, nothing to fix: burn lanes to burn days. Fuel spent here
  // comes back at the next giant; days are what the bench needs.
  const neighbours = index
    .neighbours(here)
    .map((id) => ({ id, cost: effectiveCost(state, routeTo(index, here, id)?.cost ?? Infinity) }))
    .filter((n) => n.cost <= state.ship.fuel - 10)
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

