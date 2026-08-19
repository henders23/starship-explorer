import {
  buildContact,
  combatRng,
  contactChance,
  EVADE_CHANCE,
  EVADE_CLEAN_DRIVE_BONUS,
  FLEE_CHANCE,
  FLEE_SHIELDS_BONUS,
  HAIL_TOLL_CHANCE,
  hasIntelOn,
  HULL_MAX,
  playerDamage,
  RAIDER_BREAK_FRACTION,
  TOLL_FUEL,
  WRECK_SALVAGE_FUEL,
  YIELD_HULL_FRACTION,
  YIELD_TRIBUTE_FUEL,
} from '../combat/combat.js'
import { generateRoster, promoteGeneric } from '../crew/generate.js'
import { castScene } from '../encounters/templates.js'
import { MAX_ESCORTS, MAX_HANDS, STARTING_POOLS, type AwayTeam, type Officer, type OfficerRole } from '../crew/types.js'
import {
  defaultLoadouts,
  GEAR_BY_ID,
  gearGuard,
  teamHasMedkit,
  type GearSlot,
} from '../missions/gear.js'
import {
  approachesFor,
  approachOdds,
  dominantSite,
  needsDecoding,
  type Site,
} from '../missions/sites.js'
import {
  canScoop,
  cheapestLaneOut,
  DERELICT_FUEL_SALVAGE,
  FUEL_MAX,
  LONG_JUMP_RESERVE,
  routeTo,
} from '../travel/travel.js'
import { GalaxyIndex } from '../worldgen/index-galaxy.js'
import { generatePuzzle, type MysteryOptions } from '../mystery/generate.js'
import type { Clue, ClueId, ClueState, PlayerClue } from '../mystery/types.js'
import { toPlayerClue } from '../mystery/types.js'
import { COMPONENT_LABELS, PARTS_NEEDED, placeComponents } from '../research/parts.js'
import { canResearch, commsTier, jumpReady, requiredTier, TECH_BY_ID, type TechId } from '../research/tech.js'
import { createRng, type Rng } from '../rng/prng.js'
import type { SystemId } from '../worldgen/types.js'
import type { Action, GameEvent, GameState, LogEntry, Transition } from './types.js'

/**
 * The rules. `(state, action) => { state, events }`, pure and total: no I/O,
 * no React, and no randomness beyond what the seed already fixed — mission
 * dice are seeded from `(seed, missionsRun)`, so a replayed action log rolls
 * the same galaxy, the same clues, and the same casualties.
 */
export function newGame(seed: string, options?: Partial<MysteryOptions>): GameState {
  const puzzle = generatePuzzle(seed, options)
  const start = puzzle.index.system(puzzle.galaxy.start)

  return {
    seed,
    galaxy: puzzle.galaxy,
    mystery: puzzle.mystery,
    collected: [],
    clueStates: {},
    undecoded: [],
    searched: [],
    selected: puzzle.galaxy.start,
    encounter: null,
    ship: { at: puzzle.galaxy.start, fuel: FUEL_MAX, hull: HULL_MAX },
    combat: null,
    combats: 0,
    day: 0,
    driveScarred: false,
    surges: 0,
    tech: { researched: [], active: null },
    parts: { sites: placeComponents(seed, puzzle.mystery.clues), engine: 0, shield: 0 },
    roster: generateRoster(seed),
    loadouts: defaultLoadouts(),
    pools: { ...STARTING_POOLS },
    missionsRun: 0,
    promotions: 0,
    casualties: { generics: 0, officers: [] },
    jumps: [],
    outcome: 'seeking',
    log: [
      {
        id: 0,
        kind: 'arrival',
        text:
          `The anomaly closes behind us. Navigation reports we are at ${start.name}, ` +
          `and that ${start.name} is on no chart aboard this ship. Nobody knows the way home. ` +
          `Somebody out here does.`,
      },
    ],
  }
}

export function reduce(state: GameState, action: Action): Transition {
  // An interception waits for nobody: while one is playing, only combat
  // actions resolve. One guard here keeps that invariant everywhere.
  if (state.combat !== null) {
    switch (action.type) {
      case 'combatContact':
        return combatContact(state, action.choice)
      case 'combatToll':
        return combatToll(state, action.pay)
      case 'combatRound':
        return combatRound(state, action.power, action.intent)
      default:
        return { state, events: [] }
    }
  }

  switch (action.type) {
    case 'select':
      return { state: { ...state, selected: action.system }, events: [] }
    case 'travel':
      return travel(state, action.to)
    case 'scoop':
      return scoop(state)
    case 'refit':
      return refit(state)
    case 'consult':
      return consult(state)
    case 'search':
      return search(state, action.system)
    case 'runMission':
      return runMission(state, action.system, action.team, action.approach)
    case 'equip':
      return equip(state, action.role, action.slot, action.item)
    case 'startResearch':
      return startResearch(state, action.tech)
    case 'openScene':
      return openScene(state)
    case 'sceneOption':
      return sceneOption(state, action.option)
    case 'decode':
      return decode(state, action.clue)
    case 'promote':
      return promote(state, action.role)
    case 'file':
      return file(state, action.clue, action.state)
    case 'plotTheJump':
      return plotTheJump(state, action.target)
    // Combat actions only mean something while a contact is playing, and the
    // guard above owns that path; here they are no-ops.
    case 'combatContact':
    case 'combatToll':
    case 'combatRound':
      return { state, events: [] }
  }
}

/** Convenience for driving a sequence of actions, e.g. in tests or replays. */
export function reduceAll(state: GameState, actions: readonly Action[]): Transition {
  let current = state
  const events: GameEvent[] = []
  for (const action of actions) {
    const step = reduce(current, action)
    current = step.state
    events.push(...step.events)
  }
  return { state: current, events }
}

/* ------------------------------------------------------------------------ *
 * Evidence sites
 * ------------------------------------------------------------------------ */

function cluesAt(state: GameState, systemId: SystemId): Clue[] {
  return state.mystery.clues.filter(
    (clue) => clue.source.at === systemId && !state.collected.includes(clue.id),
  )
}

/** What collecting the evidence at a system involves: a walk, or a mission. */
export function sitePlan(
  state: GameState,
  systemId: SystemId,
): { site: Site | null; clueCount: number } {
  const waiting = cluesAt(state, systemId)
  return { site: dominantSite(waiting.map((c) => c.source.kind)), clueCount: waiting.length }
}

/**
 * The walk-in case: sources that hand their accounts over. Hazardous sites
 * refuse a plain search — those take an away team.
 */
function search(state: GameState, systemId: SystemId): Transition {
  if (state.outcome !== 'seeking') return { state, events: [] }
  if (state.ship.at !== systemId) return { state, events: [] }
  if (state.searched.includes(systemId)) return { state, events: [] }
  if (sitePlan(state, systemId).site !== null) return { state, events: [] }

  const found = cluesAt(state, systemId)
  const searched = [...state.searched, systemId]
  const system = systemName(state, systemId)
  // Searching resolves whatever scene was waiting on this system.
  const encounter = state.encounter?.at === systemId ? null : state.encounter

  if (found.length === 0) {
    return {
      state: {
        ...state,
        searched,
        encounter,
        log: appendLog(state.log, {
          kind: 'evidence',
          text: `${system}: swept and catalogued. Nothing here that bears on the way home.`,
        }),
      },
      events: [{ type: 'nothingFound', at: systemId }],
    }
  }

  const preEvents: GameEvent[] = []
  let timed = advanceTime({ ...state, searched, encounter }, 1, preEvents)
  if (timed.outcome !== 'seeking') return { state: timed, events: preEvents }
  const collected = collectClues(
    timed,
    found,
    /* decoded because nothing here needs decoding */ true,
    `${system}: ${found.length === 1 ? 'one account' : `${found.length} accounts`} of the anomaly ` +
      `recovered without incident. Filed to the plot, unassessed.`,
  )
  return { state: collected.state, events: [...preEvents, ...collected.events] }
}

function collectClues(
  state: GameState,
  found: Clue[],
  scienceOnTeam: boolean,
  logText: string,
): Transition {
  const clueStates = { ...state.clueStates }
  const undecoded = [...state.undecoded]
  const undecodedNow: ClueId[] = []
  const tier = commsTier(state)

  for (const clue of found) {
    clueStates[clue.id] = 'unfiled'
    // Two ways to hold something you cannot read: an artefact that came back
    // without the science officer on the ground, or any source whose language
    // is beyond the ship's translation matrix.
    const rawArtefact = !scienceOnTeam && needsDecoding(clue.source.kind)
    const untranslated = requiredTier(clue.source.kind) > tier
    if (rawArtefact || untranslated) {
      undecoded.push(clue.id)
      undecodedNow.push(clue.id)
    }
  }

  const events: GameEvent[] = [
    {
      type: 'evidenceFound',
      clues: found.map((c) => c.id),
      at: found[0]!.source.at,
      undecoded: undecodedNow,
    },
  ]
  let next: GameState = {
    ...state,
    collected: [...state.collected, ...found.map((c) => c.id)],
    clueStates,
    undecoded,
    log: appendLog(state.log, { kind: 'evidence', text: logText }),
  }

  // A site that yields its evidence yields whatever component waited with
  // it — the technological track advances through the same scenes.
  const systemId = found[0]!.source.at
  const waiting = next.parts.sites[systemId]
  if (waiting && waiting.length > 0) {
    const sites = { ...next.parts.sites }
    delete sites[systemId]
    let { engine, shield } = next.parts
    let log = next.log
    for (const kind of waiting) {
      if (kind === 'engine') engine += 1
      else shield += 1
      const count = kind === 'engine' ? engine : shield
      events.push({ type: 'componentRecovered', component: kind, at: systemId })
      log = appendLog(log, {
        kind: 'evidence',
        text:
          `${systemName(state, systemId)}: a ${COMPONENT_LABELS[kind]} is crated and aboard — ` +
          `${count} of ${PARTS_NEEDED[kind]}.` +
          (count === PARTS_NEEDED[kind]
            ? ` That is the last piece: the ${kind === 'engine' ? 'Rift Drive' : 'Rift Shielding'} can be built.`
            : ''),
      })
    }
    next = { ...next, parts: { sites, engine, shield }, log }
  }

  return { state: next, events }
}

/* ------------------------------------------------------------------------ *
 * Research
 * ------------------------------------------------------------------------ */

/** The medbay stay an injury earns today, given the doctor and the tech. */
function injuryDuration(state: GameState, roster: readonly Officer[], hurtRole: OfficerRole): number {
  const doctored = isFit(roster, 'medical') && hurtRole !== 'medical'
  const protocols = state.tech.researched.includes('trauma-protocols')
  return doctored ? (protocols ? 4 : 6) : protocols ? 8 : 12
}

/** With Rift Telemetry researched, the bridge knows the next surge's day. */
export function surgeForecast(state: GameState): number | null {
  if (!state.tech.researched.includes('rift-telemetry')) return null
  return surgeDay(state.seed, state.surges)
}

/**
 * Put the bench on a project. Starting a new project abandons the old one's
 * progress — the officer says so on the bench before you do it.
 */
function startResearch(state: GameState, techId: TechId): Transition {
  if (state.outcome !== 'seeking') return { state, events: [] }
  if (!canResearch(state, techId)) return { state, events: [] }
  if (!officer(state.roster, 'science')) return { state, events: [] }

  const node = TECH_BY_ID[techId]!
  return {
    state: {
      ...state,
      tech: { ...state.tech, active: { id: techId, daysLeft: node.days } },
      log: appendLog(state.log, {
        kind: 'crew',
        text: `The bench takes up ${node.name} — ${node.days} days of the science officer's time.`,
      }),
    },
    events: [{ type: 'techStarted', tech: techId }],
  }
}

/* ------------------------------------------------------------------------ *
 * Ship-to-ship combat
 * ------------------------------------------------------------------------ */

/** Close the fight and let the interrupted arrival play its scene. */
function endCombat(
  state: GameState,
  result: 'stood-down' | 'slipped' | 'toll-paid' | 'fled' | 'yielded' | 'driven-off' | 'destroyed-them',
  events: GameEvent[],
): GameState {
  events.push({ type: 'combatResolved', at: state.combat!.at, result })
  let next: GameState = { ...state, combat: null }
  const scene = castScene(next, next.ship.at)
  if (scene) {
    next = { ...next, encounter: scene }
    events.push({ type: 'sceneOpened', at: next.ship.at })
  }
  return next
}

/** The enemy's volley; halved when the reactor is on the shields. */
function enemyVolley(state: GameState, events: GameEvent[], shielded: boolean): GameState {
  const combat = state.combat!
  const damage = shielded ? Math.ceil(combat.enemy.guns / 2) : combat.enemy.guns
  const hull = Math.max(0, state.ship.hull - damage)
  events.push({ type: 'shipDamaged', amount: damage, hull })
  let next: GameState = { ...state, ship: { ...state.ship, hull } }

  if (hull <= 0) {
    events.push({ type: 'shipDestroyed' })
    next = {
      ...next,
      combat: null,
      outcome: 'destroyed',
      log: appendLog(next.log, {
        kind: 'ending',
        text:
          `${combat.enemy.name} finds the reactor housing, and the Indefatigable comes apart ` +
          `over ${systemName(next, combat.at)}. The plot on the Nav board goes with her. ` +
          `Nobody is coming to read it.`,
      }),
    }
  }
  return next
}

function combatContact(state: GameState, choice: 'hail' | 'evade' | 'engage'): Transition {
  const combat = state.combat
  if (!combat || combat.phase !== 'contact' || state.outcome !== 'seeking') return { state, events: [] }

  const index = new GalaxyIndex(state.galaxy)
  const events: GameEvent[] = []
  const rng = combatRng(state, `contact:${choice}`)

  if (choice === 'hail') {
    if (hasIntelOn(state, index, combat.enemy.faction)) {
      let next: GameState = {
        ...state,
        log: appendLog(state.log, {
          kind: 'travel',
          text:
            `You read them their own patrol schedule back over the wideband. A long pause, and ` +
            `${combat.enemy.name} alters course away. Knowing things is a weapon that never needs reloading.`,
        }),
      }
      return { state: endCombat(next, 'stood-down', events), events }
    }
    if (rng.chance(HAIL_TOLL_CHANCE)) {
      return {
        state: {
          ...state,
          combat: { ...combat, phase: 'toll' },
          log: appendLog(state.log, {
            kind: 'travel',
            text: `They answer the hail with a number: ${combat.toll} fuel, and the lane is yours.`,
          }),
        },
        events,
      }
    }
    // The hail is answered with a firing solution.
    let next: GameState = {
      ...state,
      combat: { ...combat, phase: 'battle' },
      log: appendLog(state.log, {
        kind: 'travel',
        text: `The only answer is a target lock. ${combat.enemy.name} opens fire.`,
      }),
    }
    next = enemyVolley(next, events, false)
    return { state: next, events }
  }

  if (choice === 'evade') {
    const chance = EVADE_CHANCE + (state.driveScarred ? 0 : EVADE_CLEAN_DRIVE_BONUS)
    if (rng.chance(chance)) {
      const next: GameState = {
        ...state,
        log: appendLog(state.log, {
          kind: 'travel',
          text: `Hard burn through the shadow of the outer worlds, and the intercept solution falls apart. They lose us.`,
        }),
      }
      return { state: endCombat(next, 'slipped', events), events }
    }
    let next: GameState = {
      ...state,
      combat: { ...combat, phase: 'battle' },
      log: appendLog(state.log, {
        kind: 'travel',
        text: `The burn is not enough — they cut the corner and hold the lock. ${combat.enemy.name} opens fire.`,
      }),
    }
    next = enemyVolley(next, events, false)
    return { state: next, events }
  }

  // Engage: battle on your terms — the first volley is yours.
  return {
    state: {
      ...state,
      combat: { ...combat, phase: 'battle' },
      log: appendLog(state.log, {
        kind: 'travel',
        text: `Guns run out, power to the mounts. The bridge goes quiet the way it does before weather.`,
      }),
    },
    events,
  }
}

function combatToll(state: GameState, pay: boolean): Transition {
  const combat = state.combat
  if (!combat || combat.phase !== 'toll' || state.outcome !== 'seeking') return { state, events: [] }
  const events: GameEvent[] = []

  if (pay) {
    if (state.ship.fuel <= combat.toll) return { state, events: [] }
    const next: GameState = {
      ...state,
      ship: { ...state.ship, fuel: state.ship.fuel - combat.toll },
      log: appendLog(state.log, {
        kind: 'travel',
        text: `${combat.toll} fuel crosses the gap in a drop pod, and ${combat.enemy.name} lets the lane open. Cheaper than the alternative.`,
      }),
    }
    return { state: endCombat(next, 'toll-paid', events), events }
  }

  let next: GameState = {
    ...state,
    combat: { ...combat, phase: 'battle' },
    log: appendLog(state.log, {
      kind: 'travel',
      text: `You decline to be taxed. ${combat.enemy.name} opens fire.`,
    }),
  }
  next = enemyVolley(next, events, false)
  return { state: next, events }
}

function combatRound(
  state: GameState,
  power: 'guns' | 'shields',
  intent: 'fire' | 'flee',
): Transition {
  const combat = state.combat
  if (!combat || combat.phase !== 'battle' || state.outcome !== 'seeking') return { state, events: [] }

  const index = new GalaxyIndex(state.galaxy)
  const events: GameEvent[] = []
  const rng = combatRng(state, `round:${combat.round}:${power}:${intent}`)
  const shielded = power === 'shields'

  if (intent === 'flee') {
    if (rng.chance(FLEE_CHANCE + (shielded ? FLEE_SHIELDS_BONUS : 0))) {
      const next: GameState = {
        ...state,
        log: appendLog(state.log, {
          kind: 'travel',
          text: `The drive answers when it matters. The Indefatigable breaks the lock and runs, and ${combat.enemy.name} does not follow.`,
        }),
      }
      return { state: endCombat(next, 'fled', events), events }
    }
    let next = enemyVolley(state, events, shielded)
    if (next.outcome !== 'seeking') return { state: next, events }
    next = {
      ...next,
      combat: { ...next.combat!, round: combat.round + 1 },
      log: appendLog(next.log, {
        kind: 'travel',
        text: `The break fails — they anticipate the vector and hold on. The exchange costs us.`,
      }),
    }
    return { state: next, events }
  }

  // Fire. Power to the shields trades weight of shot for protection.
  const volley = Math.round(playerDamage(state, state.roster) * (shielded ? 0.6 : 1))
  const enemyHull = Math.max(0, combat.enemy.hull - volley)
  let next: GameState = { ...state, combat: { ...combat, enemy: { ...combat.enemy, hull: enemyHull } } }

  if (enemyHull <= 0) {
    const salvaged = Math.min(FUEL_MAX - next.ship.fuel, WRECK_SALVAGE_FUEL)
    next = {
      ...next,
      ship: { ...next.ship, fuel: next.ship.fuel + salvaged },
      log: appendLog(next.log, {
        kind: 'travel',
        text:
          `${combat.enemy.name} comes apart under the last volley. The wreck gives up ` +
          `${salvaged} fuel, and nothing else it knew.`,
      }),
    }
    events.push({ type: 'fuelSalvaged', amount: salvaged })
    return { state: endCombat(next, 'destroyed-them', events), events }
  }

  // The well-informed take surrenders; raiders just break and run.
  if (
    combat.enemy.faction !== null &&
    enemyHull <= combat.enemy.hullMax * YIELD_HULL_FRACTION &&
    hasIntelOn(state, index, combat.enemy.faction)
  ) {
    const tribute = Math.min(FUEL_MAX - next.ship.fuel, YIELD_TRIBUTE_FUEL)
    next = {
      ...next,
      ship: { ...next.ship, fuel: next.ship.fuel + tribute },
      log: appendLog(next.log, {
        kind: 'travel',
        text:
          `Hulled and listing, they strike their colours — to a captain who knows exactly whose ` +
          `patrol they missed and why. ${tribute} fuel in tribute buys their withdrawal.`,
      }),
    }
    events.push({ type: 'fuelSalvaged', amount: tribute })
    return { state: endCombat(next, 'yielded', events), events }
  }

  if (
    combat.enemy.faction === null &&
    enemyHull <= combat.enemy.hullMax * RAIDER_BREAK_FRACTION &&
    rng.chance(0.5)
  ) {
    next = {
      ...next,
      log: appendLog(next.log, {
        kind: 'travel',
        text: `Raiders fight for profit, and this stopped being profitable. They break and burn for the dark.`,
      }),
    }
    return { state: endCombat(next, 'driven-off', events), events }
  }

  next = enemyVolley(next, events, shielded)
  if (next.outcome !== 'seeking') return { state: next, events }
  next = { ...next, combat: { ...next.combat!, round: combat.round + 1 } }
  return { state: next, events }
}

/* ------------------------------------------------------------------------ *
 * Scenes
 * ------------------------------------------------------------------------ */

/**
 * Reopen the scene at the ship's position — the way back in after standing
 * off, or the way in at the arrival system where no travel ever fired one.
 */
function openScene(state: GameState): Transition {
  if (state.outcome !== 'seeking' || state.encounter !== null) return { state, events: [] }
  const scene = castScene(state, state.ship.at)
  if (!scene) return { state, events: [] }
  return {
    state: { ...state, encounter: scene },
    events: [{ type: 'sceneOpened', at: state.ship.at }],
  }
}

/**
 * Answer the playing scene. Options carry their whole effect as data, so
 * this is the single place dialogue touches the rules: dismiss and mission
 * merely close the scene (the mission goes on to `runMission`); collect
 * spends the option's days and fuel and takes the evidence.
 */
function sceneOption(state: GameState, optionId: string): Transition {
  const scene = state.encounter
  if (!scene || state.outcome !== 'seeking') return { state, events: [] }
  const option = scene.options.find((o) => o.id === optionId)
  if (!option) return { state, events: [] }
  if (option.needs && !isFit(state.roster, option.needs)) return { state, events: [] }

  const events: GameEvent[] = [{ type: 'sceneClosed', at: scene.at, option: optionId }]
  const closed: GameState = { ...state, encounter: null }

  if (option.effect.kind === 'dismiss' || option.effect.kind === 'mission') {
    return { state: closed, events }
  }

  // Collect: the walk-in path, on the terms this option named.
  const { days, fuel = 0 } = option.effect
  if (state.ship.at !== scene.at) return { state, events: [] }
  if (sitePlan(state, scene.at).site !== null) return { state, events: [] }
  // A fuel-priced option must leave something in the tank.
  if (fuel > 0 && state.ship.fuel <= fuel) return { state, events: [] }

  const found = cluesAt(state, scene.at)
  if (found.length === 0) return { state: closed, events }

  let next: GameState = {
    ...closed,
    ship: { ...closed.ship, fuel: closed.ship.fuel - fuel },
    searched: [...closed.searched, scene.at],
  }
  next = advanceTime(next, days, events)
  if (next.outcome !== 'seeking') return { state: next, events }

  const system = systemName(next, scene.at)
  const collected = collectClues(
    next,
    found,
    /* nothing on a walk-in needs field decoding */ true,
    `${system}: ${found.length === 1 ? 'one account' : `${found.length} accounts`} of the anomaly ` +
      `secured${fuel > 0 ? ` for ${fuel} fuel` : ''}. Filed to the plot, unassessed.`,
  )
  return { state: collected.state, events: [...events, ...collected.events] }
}

/* ------------------------------------------------------------------------ *
 * Time and the Rift
 * ------------------------------------------------------------------------ */

/** The Rift's schedule: fixed by the seed, escalating, never stored. */
export function surgeDay(seed: string, ordinal: number): number {
  let day = 0
  for (let i = 0; i <= ordinal; i++) {
    day += (i === 0 ? 12 : 9) + createRng(`${seed}:surge:${i}`).int(6)
  }
  return day
}

/**
 * The clock. Days heal the medbay and carry the ship across the Rift's surge
 * schedule. Everything that spends time funnels through here, so no
 * consequence can be dodged by doing something else first.
 */
function advanceTime(state: GameState, days: number, events: GameEvent[]): GameState {
  if (days <= 0 || state.outcome !== 'seeking') return state
  const day = state.day + days
  let next: GameState = { ...state, day }

  // The bench works while the ship flies: an active project ticks down for
  // every day the science officer is fit to work it.
  if (next.tech.active && isFit(next.roster, 'science')) {
    const daysLeft = next.tech.active.daysLeft - days
    if (daysLeft > 0) {
      next = { ...next, tech: { ...next.tech, active: { ...next.tech.active, daysLeft } } }
    } else {
      const completed = next.tech.active.id
      const science = officer(next.roster, 'science')!
      events.push({ type: 'techCompleted', tech: completed })
      next = {
        ...next,
        tech: { researched: [...next.tech.researched, completed], active: null },
        log: appendLog(next.log, {
          kind: 'crew',
          text: `${science.name} signs off on ${TECH_BY_ID[completed]!.name}. ${TECH_BY_ID[completed]!.effect}.`,
        }),
      }
    }
  }

  // The medbay discharges by the calendar, not by the mission counter.
  const recovered = next.roster.filter(
    (o) => o.status === 'injured' && (o.healedAfter ?? Infinity) <= day,
  )
  if (recovered.length > 0) {
    next = {
      ...next,
      roster: next.roster.map((o) =>
        o.status === 'injured' && (o.healedAfter ?? Infinity) <= day
          ? { ...o, status: 'fit' as const, healedAfter: undefined }
          : o,
      ),
      log: appendLog(next.log, {
        kind: 'crew',
        text: `${recovered.map((o) => o.name).join(' and ')} ${
          recovered.length === 1 ? 'is' : 'are'
        } discharged from the medbay, fit for duty.`,
      }),
    }
    for (const o of recovered) events.push({ type: 'officerRecovered', role: o.role, name: o.name })
  }

  // The Rift keeps pushing, and it pushes harder every time.
  while (next.outcome === 'seeking' && surgeDay(next.seed, next.surges) <= next.day) {
    next = applySurge(next, events)
  }

  return next
}

function applySurge(state: GameState, events: GameEvent[]): GameState {
  const ordinal = state.surges
  const rng = createRng(`${state.seed}:surge-effect:${ordinal}`)
  const tier = Math.min(ordinal, 3)
  events.push({ type: 'surgeStruck', ordinal })

  let next: GameState = { ...state, surges: ordinal + 1 }
  let text = `Rift Surge. The light outside goes briefly wrong and every instrument aboard files a complaint. `

  if (tier === 0) {
    const loss = 8
    next = { ...next, ship: { ...next.ship, fuel: Math.max(0, next.ship.fuel - loss) } }
    text += `Turbulence in the fuel manifolds vents ${loss} fuel before the seals catch.`
  } else if (tier === 1) {
    const loss = 15
    next = { ...next, ship: { ...next.ship, fuel: Math.max(0, next.ship.fuel - loss) } }
    text += `A coolant loop lets go along the drive spine; purging it costs ${loss} fuel.`
  } else if (tier === 2) {
    const fitOfficers = next.roster.filter((o) => o.role !== 'captain' && o.status === 'fit')
    if (fitOfficers.length > 0) {
      const hurt = rng.pick(fitOfficers)
      const duration = injuryDuration(next, next.roster, hurt.role)
      next = {
        ...next,
        roster: next.roster.map((o) =>
          o.role === hurt.role
            ? { ...o, status: 'injured' as const, healedAfter: next.day + duration }
            : o,
        ),
      }
      events.push({ type: 'officerInjured', role: hurt.role, name: hurt.name })
      text += `A conduit lets go on the bridge; ${hurt.name} is carried to the medbay.`
    } else {
      next = { ...next, ship: { ...next.ship, fuel: Math.max(0, next.ship.fuel - 10) } }
      text += `A conduit lets go; the repairs cost 10 fuel.`
    }
  } else {
    next = { ...next, driveScarred: true }
    text += `The drive screams for four seconds and does not sound the same afterwards. It will burn hot until refitted.`
  }

  return { ...next, log: appendLog(next.log, { kind: 'surge', text }) }
}

/* ------------------------------------------------------------------------ *
 * Travel and fuel
 * ------------------------------------------------------------------------ */

function travel(state: GameState, to: SystemId): Transition {
  if (state.outcome !== 'seeking') return { state, events: [] }
  if (to === state.ship.at) return { state, events: [] }

  const index = new GalaxyIndex(state.galaxy)
  const route = routeTo(index, state.ship.at, to)
  if (!route) return { state, events: [] }

  // A scarred drive runs hot: the same lanes, 30% more fuel.
  const cost = state.driveScarred ? Math.ceil(route.cost * 1.3) : route.cost
  if (cost > state.ship.fuel) return { state, events: [] }

  const from = state.ship.at
  const jumpsMade = route.path.length - 1
  let next: GameState = {
    ...state,
    ship: { ...state.ship, at: to, fuel: state.ship.fuel - cost },
    selected: to,
    // Breaking orbit walks away from whatever was playing there.
    encounter: null,
    log: appendLog(state.log, {
      kind: 'travel',
      text:
        `${systemName(state, to)}: arrived, ${jumpsMade} ` +
        `${jumpsMade === 1 ? 'jump' : 'jumps'}, ${cost} fuel spent` +
        `${state.driveScarred ? ' (the scarred drive ran hot)' : ''}. ` +
        `${state.ship.fuel - cost} in the tank.`,
    }),
  }

  const events: GameEvent[] = [{ type: 'traveled', from, to, fuelSpent: cost }]
  next = advanceTime(next, jumpsMade, events)
  if (next.outcome !== 'seeking') return { state: next, events }

  const strandCheck = declareIfStranded(next, index, events)
  if (strandCheck.state.outcome !== 'seeking') return strandCheck
  next = strandCheck.state

  // The dangerous regions intercept, once the early grace days are spent.
  // A contact pre-empts the arrival scene; whatever waited here plays after.
  const roll = createRng(`${state.seed}:contact:${next.day}:${to}`)
  const chance = contactChance(next, index.system(to).region)
  if (chance > 0 && roll.chance(chance)) {
    const enemy = buildContact(roll, next, to, index)
    next = {
      ...next,
      combats: next.combats + 1,
      combat: { at: to, enemy, phase: 'contact', round: 0, toll: TOLL_FUEL },
      log: appendLog(next.log, {
        kind: 'travel',
        text: `${systemName(next, to)}: an intercept course on the boards — ${enemy.name}. They have seen us.`,
      }),
    }
    events.push({ type: 'contactMade', at: to, enemy: enemy.name })
    return { state: next, events }
  }

  // Arrival is where things happen: a system holding content opens its scene
  // at once. Empty and exhausted systems stay quiet — silence keeps meaning.
  const scene = castScene(next, to)
  if (scene) {
    next = { ...next, encounter: scene }
    events.push({ type: 'sceneOpened', at: to })
  }
  return { state: next, events }
}

/** The scarred-drive premium, exposed so the UI prices trips honestly. */
export function travelCost(state: GameState, baseCost: number): number {
  return state.driveScarred ? Math.ceil(baseCost * 1.3) : baseCost
}

function scoop(state: GameState): Transition {
  if (state.outcome !== 'seeking') return { state, events: [] }
  const index = new GalaxyIndex(state.galaxy)
  if (!canScoop(index, state.ship.at)) return { state, events: [] }
  if (state.ship.fuel >= FUEL_MAX) return { state, events: [] }

  const events: GameEvent[] = [{ type: 'scooped', at: state.ship.at }]
  let next: GameState = {
    ...state,
    ship: { ...state.ship, fuel: FUEL_MAX },
    log: appendLog(state.log, {
      kind: 'travel',
      text:
        `Two days of slow orbits through the gas giant's outer envelope with the scoop fields ` +
        `wide. The tank reads full for the first time in a while.`,
    }),
  }
  next = advanceTime(next, 2, events)
  return { state: next, events }
}

function refit(state: GameState): Transition {
  if (state.outcome !== 'seeking') return { state, events: [] }
  if (!state.driveScarred && state.ship.hull >= HULL_MAX) return { state, events: [] }
  const index = new GalaxyIndex(state.galaxy)
  if (index.system(state.ship.at).faction === null) return { state, events: [] }

  const battered = state.ship.hull < HULL_MAX
  const events: GameEvent[] = [{ type: 'refitted' }]
  let next: GameState = {
    ...state,
    driveScarred: false,
    ship: { ...state.ship, hull: HULL_MAX },
    log: appendLog(state.log, {
      kind: 'travel',
      text:
        `Four days in a rented cradle while yard crews who ask no questions ` +
        (state.driveScarred && battered
          ? `grind the scarring out of the drive housings and plate over the battle damage. She sounds like herself again.`
          : battered
            ? `cut out the burned plating and weld in new. The hull reads whole again.`
            : `grind the scarring out of the drive housings. It sounds like itself again.`),
    }),
  }
  next = advanceTime(next, 4, events)
  return { state: next, events }
}

/**
 * The loss condition (ROADMAP M1): stranded is not "low on fuel", it is
 * "no move remains". No lane affordable, nothing to scoop here, the Long
 * Jump out of reach, and no derelict left at this system whose tanks a
 * mission could still drain. Detected on the transition that causes it, so
 * the ending lands the moment the trap closes rather than one click later.
 */
export function isStranded(state: GameState, index: GalaxyIndex): boolean {
  if (state.outcome !== 'seeking') return false
  if (canScoop(index, state.ship.at)) return false
  if (state.ship.fuel >= LONG_JUMP_RESERVE) return false
  if (state.ship.fuel >= cheapestLaneOut(index, state.ship.at)) return false

  // A derelict here could still be drained for fuel by an away mission.
  const derelictHere = cluesAt(state, state.ship.at).some(
    (c) => c.source.kind === 'derelict-log',
  )
  return !derelictHere
}

function declareIfStranded(
  state: GameState,
  index: GalaxyIndex,
  events: GameEvent[],
): Transition {
  if (!isStranded(state, index)) return { state, events }
  return {
    state: {
      ...state,
      outcome: 'stranded',
      log: appendLog(state.log, {
        kind: 'ending',
        text:
          `The tank will not carry us to any star on the chart, and there is nothing here to ` +
          `scoop, drain or trade. The ship is sound. The crew are alive. Neither of those things ` +
          `is going to change what this is. Entries in this log may become intermittent.`,
      }),
    },
    events: [...events, { type: 'strandedDeclared' }],
  }
}

/* ------------------------------------------------------------------------ *
 * The bridge
 * ------------------------------------------------------------------------ */

/**
 * Consult the Bridge (DESIGN §7.2): each fit officer gives a working opinion.
 * It is a real instrument, not flavour — science points at the nearest
 * uncollected thread, medical reads the medbay docket, security counts what
 * is left to spend.
 */
function consult(state: GameState): Transition {
  if (state.outcome !== 'seeking') return { state, events: [] }

  const lines: string[] = []
  const index = new GalaxyIndex(state.galaxy)

  const science = state.roster.find((o) => o.role === 'science')
  if (science?.status === 'fit') {
    const remaining = [...evidenceSites(state)]
      .map((id) => ({ id, jumps: index.jumps(state.ship.at, id) }))
      .filter((s) => Number.isFinite(s.jumps))
      .sort((a, b) => a.jumps - b.jumps)
    lines.push(
      remaining.length === 0
        ? `${science.name}: "Every thread we know of has been pulled, captain. It comes down to the plot now."`
        : `${science.name}: "Nearest unexamined thread is ${systemName(state, remaining[0]!.id)}, ` +
          `${remaining[0]!.jumps} ${remaining[0]!.jumps === 1 ? 'jump' : 'jumps'} out. ` +
          `${remaining.length - 1} more beyond it."`,
    )
  }

  const medical = state.roster.find((o) => o.role === 'medical')
  if (medical?.status === 'fit') {
    const medbay = state.roster.filter((o) => o.status === 'injured')
    lines.push(
      `${medical.name}: "${
        medbay.length === 0
          ? 'Medbay is empty, and I would like to keep it that way'
          : medbay.map((o) => `${o.name} needs ${Math.max(0, (o.healedAfter ?? 0) - state.day)} more days`).join('; ')
      }."`,
    )
  }

  const security = state.roster.find((o) => o.role === 'security')
  if (security?.status === 'fit') {
    lines.push(
      `${security.name}: "${state.pools.security} security staff and ${state.pools.crew} crew still ` +
      `on the boards. They will go where you send them."`,
    )
  }

  if (lines.length === 0) {
    lines.push(`The bridge stations are empty or their officers are in the medbay. The ship keeps its own counsel.`)
  }

  return {
    state: {
      ...state,
      log: appendLog(state.log, { kind: 'bridge', text: lines.join(' ') }),
    },
    events: [{ type: 'consulted' }],
  }
}

/**
 * Issue an item from the locker. Free and instant — kit is preparation, not
 * a spend — but it goes through the reducer because missions read it there.
 */
function equip(state: GameState, role: OfficerRole, slot: GearSlot, itemId: string): Transition {
  const item = GEAR_BY_ID[itemId]
  if (!item || item.slot !== slot) return { state, events: [] }
  if (!state.roster.some((o) => o.role === role)) return { state, events: [] }
  if (state.loadouts[role][slot] === itemId) return { state, events: [] }

  return {
    state: {
      ...state,
      loadouts: { ...state.loadouts, [role]: { ...state.loadouts[role], [slot]: itemId } },
    },
    events: [{ type: 'equipped', role, item: itemId }],
  }
}

/* ------------------------------------------------------------------------ *
 * Away missions
 * ------------------------------------------------------------------------ */

function officer(roster: readonly Officer[], role: OfficerRole): Officer | undefined {
  return roster.find((o) => o.role === role)
}

function isFit(roster: readonly Officer[], role: OfficerRole): boolean {
  return officer(roster, role)?.status === 'fit'
}

/** Validates a team against the roster and the pools. */
function legalTeam(state: GameState, team: AwayTeam): AwayTeam | null {
  if (team.escorts < 0 || team.escorts > Math.min(MAX_ESCORTS, state.pools.security)) return null
  if (team.hands < 0 || team.hands > Math.min(MAX_HANDS, state.pools.crew)) return null
  if (new Set(team.officers).size !== team.officers.length) return null
  for (const role of team.officers) {
    if (!isFit(state.roster, role)) return null
  }
  if (team.captain && !isFit(state.roster, 'captain')) return null
  return team
}

function runMission(
  state: GameState,
  systemId: SystemId,
  team: AwayTeam,
  approachId: string,
): Transition {
  if (state.outcome !== 'seeking') return { state, events: [] }
  if (state.ship.at !== systemId) return { state, events: [] }
  if (state.searched.includes(systemId)) return { state, events: [] }

  const { site } = sitePlan(state, systemId)
  if (!site) return { state, events: [] }
  if (!legalTeam(state, team)) return { state, events: [] }

  const approach = approachesFor(site).find((a) => a.id === approachId)
  if (!approach) return { state, events: [] }
  if (approach.needs && !team.officers.includes(approach.needs)) return { state, events: [] }

  // One mission, one stream: every draw comes from a seed fixed by how many
  // missions have gone before, so replays land the same way.
  const missionsRun = state.missionsRun + 1
  const rng = createRng(`${state.seed}:mission:${missionsRun}:${systemId}`)

  let next: GameState = {
    ...state,
    missionsRun,
    // Launching the shuttle resolves whatever scene was waiting here.
    encounter: state.encounter?.at === systemId ? null : state.encounter,
  }
  const preEvents: GameEvent[] = []
  next = advanceTime(next, 1, preEvents)
  if (next.outcome !== 'seeking') return { state: next, events: preEvents }

  const odds = approachOdds(approach, team, next.roster, next.loadouts)
  const roll = rng.next() * 100
  const outcome: 'clean' | 'messy' | 'disaster' =
    roll < odds.clean ? 'clean' : roll < odds.clean + odds.messy ? 'messy' : 'disaster'

  const system = systemName(state, systemId)
  const events: GameEvent[] = [...preEvents, { type: 'missionResolved', at: systemId, outcome }]

  if (outcome === 'clean') {
    const found = cluesAt(next, systemId)
    next = { ...next, searched: [...next.searched, systemId] }
    const salvage = applyDerelictSalvage(next, site, events)
    next = salvage
    const collected = collectClues(
      next,
      found,
      team.officers.includes('science'),
      `${system} — ${site.label.toLowerCase()}: the team is back aboard, all counted. ` +
        `${found.length === 1 ? 'One account' : `${found.length} accounts`} of the anomaly recovered.` +
        (site.type === 'derelict' ? ` The wreck's tanks gave up ${DERELICT_FUEL_SALVAGE} fuel.` : ''),
    )
    return { state: collected.state, events: [...events, ...collected.events] }
  }

  // Harm falls on the team from the bottom of the ladder up: escorts, then
  // hands, then officers, then — only in disaster, only if leading — you.
  const harm = outcome === 'messy'
    ? { genericDeaths: 1 + (rng.chance(0.4) ? 1 : 0), officerInjury: 0.2, officerDeath: 0, captainDeath: 0 }
    : { genericDeaths: 2 + rng.int(2), officerInjury: 0.45, officerDeath: 0.25, captainDeath: 0.2 }

  const applied = applyHarm(next, team, harm, rng, events)
  next = applied

  if (next.outcome === 'lost') {
    return {
      state: {
        ...next,
        log: appendLog(next.log, {
          kind: 'ending',
          text:
            `${system} — ${site.label.toLowerCase()}: the team does not come back, and neither do you. ` +
            `The ship keeps station for three days, and then somebody else decides what happens next.`,
        }),
      },
      events,
    }
  }

  if (outcome === 'messy') {
    // Hurt, but the job got done.
    const found = cluesAt(next, systemId)
    next = { ...next, searched: [...next.searched, systemId] }
    next = applyDerelictSalvage(next, site, events)
    const collected = collectClues(
      next,
      found,
      team.officers.includes('science') && isFit(next.roster, 'science'),
      `${system} — ${site.label.toLowerCase()}: the evidence is aboard, and it was paid for. ` +
        casualtyLine(state, next),
    )
    return { state: collected.state, events: [...events, ...collected.events] }
  }

  // Disaster: the team pulls out with nothing. The site remains — the
  // evidence must stay collectable or the puzzle can silently become
  // unwinnable, which the solvability contract exists to prevent.
  return {
    state: {
      ...next,
      log: appendLog(next.log, {
        kind: 'mission',
        text:
          `${system} — ${site.label.toLowerCase()}: it went wrong almost at once. The team pulled ` +
          `out with nothing. ${casualtyLine(state, next)}`,
      }),
    },
    events,
  }
}

/** A swept derelict's tanks are worth draining — occasionally decisively so. */
function applyDerelictSalvage(state: GameState, site: Site, events: GameEvent[]): GameState {
  if (site.type !== 'derelict') return state
  events.push({ type: 'fuelSalvaged', amount: DERELICT_FUEL_SALVAGE })
  return {
    ...state,
    ship: { ...state.ship, fuel: Math.min(FUEL_MAX, state.ship.fuel + DERELICT_FUEL_SALVAGE) },
  }
}

interface Harm {
  genericDeaths: number
  officerInjury: number
  officerDeath: number
  captainDeath: number
}

function applyHarm(
  state: GameState,
  team: AwayTeam,
  harm: Harm,
  rng: Rng,
  events: GameEvent[],
): GameState {
  let { crew, security } = state.pools
  let genericDeaths = Math.min(harm.genericDeaths, team.escorts + team.hands)

  // The medical officer's quiet, always-on value: one death becomes a story
  // about a near thing instead.
  if (team.officers.includes('medical') && isFit(state.roster, 'medical') && genericDeaths > 0) {
    genericDeaths -= 1
  }

  let lostEscorts = Math.min(genericDeaths, team.escorts)
  let lostHands = Math.min(genericDeaths - lostEscorts, team.hands)
  security -= Math.min(lostEscorts, security)
  crew -= Math.min(lostHands, crew)
  if (lostEscorts + lostHands > 0) events.push({ type: 'genericsLost', count: lostEscorts + lostHands })

  let roster = state.roster.map((o) => ({ ...o }))
  const officers = [...state.roster]
    .filter((o) => o.role !== 'captain' && team.officers.includes(o.role as Exclude<OfficerRole, 'captain'>))
    .map((o) => o.role)

  // A trauma kit in someone's pack turns one officer injury into a close call.
  let medkitCharge = teamHasMedkit(team, state.roster, state.loadouts)

  for (const role of officers) {
    const target = roster.find((o) => o.role === role)!
    if (target.status !== 'fit') continue

    // Armour is real: what this officer wears comes off their injury roll.
    const injuryChance = Math.max(0, harm.officerInjury - gearGuard(state.loadouts, role) / 100)

    if (harm.officerDeath > 0 && rng.chance(harm.officerDeath)) {
      target.status = 'dead'
      events.push({ type: 'officerDied', role: target.role, name: target.name })
    } else if (rng.chance(injuryChance)) {
      if (medkitCharge) {
        medkitCharge = false
        events.push({ type: 'injurySpared', role: target.role, name: target.name })
        continue
      }
      target.status = 'injured'
      // Days in the medbay, not missions: the wound heals on the calendar;
      // a fit medical officer roughly halves the stay, and trauma protocols
      // shorten it further.
      target.healedAfter = state.day + injuryDuration(state, roster, target.role)
      events.push({ type: 'officerInjured', role: target.role, name: target.name })
    }
  }

  let outcome = state.outcome
  if (team.captain && harm.captainDeath > 0 && rng.chance(harm.captainDeath)) {
    const captain = roster.find((o) => o.role === 'captain')!
    captain.status = 'dead'
    events.push({ type: 'captainLost' })
    outcome = 'lost'
  }

  const officerDeaths = roster
    .filter((o) => o.status === 'dead' && state.roster.find((p) => p.role === o.role)?.status !== 'dead')
    .map((o) => o.name)

  return {
    ...state,
    roster,
    pools: { crew, security },
    outcome,
    casualties: {
      generics: state.casualties.generics + lostEscorts + lostHands,
      officers: [...state.casualties.officers, ...officerDeaths],
    },
  }
}

function casualtyLine(before: GameState, after: GameState): string {
  const generics = after.casualties.generics - before.casualties.generics
  const officers = after.casualties.officers.slice(before.casualties.officers.length)
  const injured = after.roster.filter(
    (o) => o.status === 'injured' && before.roster.find((p) => p.role === o.role)?.status === 'fit',
  )

  const parts: string[] = []
  if (officers.length > 0) parts.push(`${officers.join(' and ')} did not make it back`)
  if (generics > 0) parts.push(`${generics} of the crew ${generics === 1 ? 'was' : 'were'} lost`)
  if (injured.length > 0) parts.push(`${injured.map((o) => o.name).join(' and ')} came back on a stretcher`)
  if (parts.length === 0) return 'Everyone came back.'
  return parts.join('; ') + '.'
}

/* ------------------------------------------------------------------------ *
 * Decoding, promotion, filing
 * ------------------------------------------------------------------------ */

/**
 * A fit science officer can sit down with a recovered artefact and turn it
 * into something the Nav Plot can use. No officer, no reading it — losing
 * your specialist is a strategic wound, not a stat change.
 */
function decode(state: GameState, clueId: ClueId): Transition {
  if (!state.undecoded.includes(clueId)) return { state, events: [] }
  if (!isFit(state.roster, 'science')) return { state, events: [] }

  // Language before labour: below the required translation tier, the bench
  // can stare at it all day and get nothing. Research is the way through.
  const clue = state.mystery.clues.find((c) => c.id === clueId)
  if (clue && requiredTier(clue.source.kind) > commsTier(state)) return { state, events: [] }

  const science = officer(state.roster, 'science')!
  const events: GameEvent[] = [{ type: 'clueDecoded', clue: clueId }]
  let next: GameState = {
    ...state,
    undecoded: state.undecoded.filter((id) => id !== clueId),
    log: appendLog(state.log, {
      kind: 'crew',
      text: `${science.name} works the artefact over for a day until it gives. Another account, legible at last.`,
    }),
  }
  next = advanceTime(next, 1, events)
  return { state: next, events }
}

function promote(state: GameState, role: Exclude<OfficerRole, 'captain'>): Transition {
  const vacant = officer(state.roster, role)
  if (!vacant || vacant.status !== 'dead') return { state, events: [] }
  if (state.pools.crew <= 0) return { state, events: [] }

  const replacement = promoteGeneric(state.seed, role, state.promotions)
  const roster = state.roster.map((o) => (o.role === role ? replacement : o))
  const events: GameEvent[] = [{ type: 'promoted', role, name: replacement.name }]

  let next: GameState = {
    ...state,
    roster,
    pools: { ...state.pools, crew: state.pools.crew - 1 },
    promotions: state.promotions + 1,
    log: appendLog(state.log, {
      kind: 'crew',
      text:
        `${replacement.name} steps up from the ranks to take the ${role} station. ` +
        `Yesterday they were a number on a duty roster. Today the ship needs them to be more.`,
    }),
  }
  return { state: next, events }
}

function file(state: GameState, clueId: ClueId, clueState: ClueState): Transition {
  if (!state.collected.includes(clueId)) return { state, events: [] }
  if (state.undecoded.includes(clueId)) return { state, events: [] }
  if (state.clueStates[clueId] === clueState) return { state, events: [] }

  return {
    state: { ...state, clueStates: { ...state.clueStates, [clueId]: clueState } },
    events: [{ type: 'clueFiled', clue: clueId, state: clueState }],
  }
}

/* ------------------------------------------------------------------------ *
 * The Long Jump
 * ------------------------------------------------------------------------ */

function plotTheJump(state: GameState, target: SystemId): Transition {
  if (state.outcome !== 'seeking') return { state, events: [] }
  if (state.ship.fuel < LONG_JUMP_RESERVE) return { state, events: [] }
  // The transit takes all three tracks: the place, the engine, the shield.
  if (!jumpReady(state)) return { state, events: [] }

  const correct = target === state.mystery.gateway
  const jumps = [...state.jumps, { target, correct }]
  const name = systemName(state, target)

  if (correct) {
    return {
      state: {
        ...state,
        jumps,
        outcome: 'home',
        log: appendLog(state.log, {
          kind: 'ending',
          text:
            `${name}. The drive holds, the light goes wrong, and then the stars ahead are ` +
            `stars we have names for. We are in charted space. We are going home.`,
        }),
      },
      events: [{ type: 'jumpSucceeded', target }],
    }
  }

  // Wrong. The rift takes its price and throws the ship somewhere far from
  // where it thought it was going (DESIGN §4.5): the reserve is gone, the
  // tank is nearly dry, and the chart has to be replotted from a strange sky.
  const index = new GalaxyIndex(state.galaxy)
  const rng = createRng(`${state.seed}:longjump:${jumps.length}`)
  const distances = index.distancesFrom(target)
  const farSystems = index.systems
    .filter((s) => (distances.get(s.id) ?? 0) >= 5 && s.id !== target)
    .map((s) => s.id)
    .sort()
  const displacedTo = farSystems.length > 0 ? rng.pick(farSystems) : state.ship.at

  const events: GameEvent[] = [{ type: 'jumpFailed', target, attempt: jumps.length, displacedTo }]
  let next: GameState = {
    ...state,
    jumps,
    ship: { ...state.ship, at: displacedTo, fuel: Math.min(state.ship.fuel - LONG_JUMP_RESERVE, 25) },
    selected: displacedTo,
    // The rift takes more than fuel: the drive is scarred until a refit.
    driveScarred: true,
    log: appendLog(state.log, {
      kind: 'jump',
      text:
        `${name}. We burned the reserve and committed, and the anomaly was not there. ` +
        `The rift spat us out at ${systemName(state, displacedTo)} with ` +
        `${Math.min(state.ship.fuel - LONG_JUMP_RESERVE, 25)} fuel and a scarred drive. ` +
        `Attempt ${jumps.length}. We are still out here.`,
    }),
  }
  next = advanceTime(next, 3, events)
  if (next.outcome !== 'seeking') return { state: next, events }
  return declareIfStranded(next, index, events)
}

/* ------------------------------------------------------------------------ */

function appendLog(log: readonly LogEntry[], entry: Omit<LogEntry, 'id'>): LogEntry[] {
  return [...log, { ...entry, id: (log[log.length - 1]?.id ?? -1) + 1 }]
}

function systemName(state: GameState, id: SystemId): string {
  return state.galaxy.systems.find((s) => s.id === id)?.name ?? id
}

/* ------------------------------------------------------------------------ *
 * Selectors — the sanctioned view of state for the UI.
 * ------------------------------------------------------------------------ */

/**
 * The clues the player holds, with the answer key stripped and their filing
 * state applied. This is the only clue list any component should ever see.
 */
export function heldClues(state: GameState): PlayerClue[] {
  return state.mystery.clues
    .filter((clue) => state.collected.includes(clue.id))
    .map((clue) => ({ ...toPlayerClue(clue), state: state.clueStates[clue.id] ?? 'unfiled' }))
}

/** Only the clues the Nav Plot may reason with: held and readable. */
export function usableClues(state: GameState): PlayerClue[] {
  return heldClues(state).filter((c) => !state.undecoded.includes(c.id))
}

/** Systems that still hold evidence the player has not swept. */
export function evidenceSites(state: GameState): Set<SystemId> {
  const sites = new Set<SystemId>()
  for (const clue of state.mystery.clues) {
    if (!state.collected.includes(clue.id)) sites.add(clue.source.at)
  }
  for (const searched of state.searched) sites.delete(searched)
  return sites
}

/** Roles whose chair is empty and whose replacement is available. */
export function vacancies(state: GameState): Exclude<OfficerRole, 'captain'>[] {
  return state.roster
    .filter((o) => o.role !== 'captain' && o.status === 'dead')
    .map((o) => o.role as Exclude<OfficerRole, 'captain'>)
    .filter(() => state.pools.crew > 0)
}
