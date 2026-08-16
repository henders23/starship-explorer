import { ENEMY_CLASSES, type CombatRewards, type PendingCombat } from '../combat/ships.js'
import { generateRoster, promoteGeneric } from '../crew/generate.js'
import { chooseEncounter, doneFlag, flagsBlock } from '../encounters/select.js'
import { encounterDef } from '../encounters/catalog.js'
import type { CultureId, EncounterChoice, EncounterOutcome, ResultCond } from '../encounters/types.js'
import {
  awayBonusFor,
  canResearch,
  hullMaxFor,
  laneCostWith,
  longJumpReserveFor,
  RESEARCH_DAYS,
  riftFuelFloor,
  riftScarsDrive,
  scoopDaysFor,
  techDef,
  type TechId,
} from '../research/tech.js'
import { MAX_ESCORTS, MAX_HANDS, STARTING_POOLS, type AwayTeam, type Officer, type OfficerRole } from '../crew/types.js'
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
  routeTo,
} from '../travel/travel.js'
import { GalaxyIndex } from '../worldgen/index-galaxy.js'
import { generatePuzzle, type MysteryOptions } from '../mystery/generate.js'
import type { Clue, ClueId, ClueState, PlayerClue } from '../mystery/types.js'
import { toPlayerClue } from '../mystery/types.js'
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
    ship: { at: puzzle.galaxy.start, fuel: FUEL_MAX },
    day: 0,
    supplies: 100,
    driveScarred: false,
    surges: 0,
    hull: 30,
    data: 0,
    unlockedTech: [],
    flags: [],
    standing: { flotilla: 0, vekar: 0, ostrea: 0, custodian: 0 },
    warPressure: 0,
    pending: [],
    encounter: null,
    encountersSeen: 0,
    recent: [],
    combat: null,
    roster: generateRoster(seed),
    pools: { ...STARTING_POOLS },
    missionsRun: 0,
    promotions: 0,
    casualties: { generics: 0, officers: [] },
    jumps: [],
    outcome: 'seeking',
    ending: null,
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
  switch (action.type) {
    case 'select':
      return { state: { ...state, selected: action.system }, events: [] }
    case 'travel':
      return travel(state, action.to)
    case 'scoop':
      return scoop(state)
    case 'resupply':
      return resupply(state)
    case 'refit':
      return refit(state)
    case 'consult':
      return consult(state)
    case 'search':
      return search(state, action.system)
    case 'runMission':
      return runMission(state, action.system, action.team, action.approach)
    case 'decode':
      return decode(state, action.clue)
    case 'promote':
      return promote(state, action.role)
    case 'file':
      return file(state, action.clue, action.state)
    case 'plotTheJump':
      return plotTheJump(state, action.target)
    case 'encounterChoose':
      return encounterChoose(state, action.choice)
    case 'encounterContinue':
      return encounterContinue(state)
    case 'research':
      return research(state, action.tech)
    case 'resolveCombat':
      return resolveCombat(state, action.result, action.hull, action.injured ?? [])
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
  if (state.combat !== null) return { state, events: [] }
  if (state.ship.at !== systemId) return { state, events: [] }
  if (state.searched.includes(systemId)) return { state, events: [] }
  if (sitePlan(state, systemId).site !== null) return { state, events: [] }

  const found = cluesAt(state, systemId)
  const searched = [...state.searched, systemId]
  const system = systemName(state, systemId)

  if (found.length === 0) {
    return {
      state: {
        ...state,
        searched,
        log: appendLog(state.log, {
          kind: 'evidence',
          text: `${system}: swept and catalogued. Nothing here that bears on the way home.`,
        }),
      },
      events: [{ type: 'nothingFound', at: systemId }],
    }
  }

  const preEvents: GameEvent[] = []
  let timed = advanceTime({ ...state, searched }, 1, preEvents)
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

  for (const clue of found) {
    clueStates[clue.id] = 'unfiled'
    if (!scienceOnTeam && needsDecoding(clue.source.kind)) {
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
  const next: GameState = {
    ...state,
    collected: [...state.collected, ...found.map((c) => c.id)],
    clueStates,
    undecoded,
    log: appendLog(state.log, { kind: 'evidence', text: logText }),
  }
  return { state: next, events }
}

/* ------------------------------------------------------------------------ *
 * Time, stores, and the Rift
 * ------------------------------------------------------------------------ */

export const SUPPLIES_MAX = 100

/** The Rift's schedule: fixed by the seed, escalating, never stored. */
export function surgeDay(seed: string, ordinal: number): number {
  let day = 0
  for (let i = 0; i <= ordinal; i++) {
    day += (i === 0 ? 12 : 9) + createRng(`${seed}:surge:${i}`).int(6)
  }
  return day
}

/**
 * The clock. Days drain supplies (and stop damage control once they run dry), heal
 * the medbay, and carry the ship across the Rift's surge schedule. Everything
 * that spends time funnels through here, so no consequence can be dodged by
 * doing something else first.
 */
function advanceTime(state: GameState, days: number, events: GameEvent[]): GameState {
  if (days <= 0 || state.outcome !== 'seeking') return state
  const day = state.day + days

  // Damage control works the calendar too — a point of hull a day — but
  // only while there is food in the hold. The crew stay loyal on empty
  // stomachs; they just stop being any good at plating over holes.
  const fedDays = Math.min(days, state.supplies)
  const hullMax = hullMaxFor(state.unlockedTech)
  let next: GameState = {
    ...state,
    day,
    hull: Math.min(hullMax, state.hull + fedDays),
    supplies: Math.max(0, state.supplies - days),
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
    next = { ...next, supplies: Math.max(0, next.supplies - loss) }
    text += `A stasis locker fails in the hold; ${loss} supplies spoil before anyone smells it.`
  } else if (tier === 2) {
    const fitOfficers = next.roster.filter((o) => o.role !== 'captain' && o.status === 'fit')
    if (fitOfficers.length > 0) {
      const hurt = rng.pick(fitOfficers)
      const duration = isFit(next.roster, 'medical') && hurt.role !== 'medical' ? 6 : 12
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
  if (state.combat !== null) return { state, events: [] }
  if (to === state.ship.at) return { state, events: [] }

  const index = new GalaxyIndex(state.galaxy)
  const route = routeTo(index, state.ship.at, to)
  if (!route) return { state, events: [] }

  const cost = travelCost(state, route.cost)
  if (cost > state.ship.fuel) return { state, events: [] }

  const from = state.ship.at
  const jumpsMade = route.path.length - 1
  let next: GameState = {
    ...state,
    ship: { at: to, fuel: state.ship.fuel - cost },
    selected: to,
    // Breaking orbit walks away from whatever was on the viewscreen.
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
  const stranded = declareIfStranded(next, index, events)
  if (stranded.state.outcome !== 'seeking') return stranded
  return maybeEncounter(stranded.state, to, stranded.events)
}

/**
 * The price of a route: drive research first, then the scarring premium.
 * Exposed so the UI prices trips exactly as the reducer will charge them.
 */
export function travelCost(state: GameState, baseCost: number): number {
  const tuned = laneCostWith(state.unlockedTech, baseCost)
  return state.driveScarred ? Math.ceil(tuned * 1.3) : tuned
}

function scoop(state: GameState): Transition {
  if (state.outcome !== 'seeking') return { state, events: [] }
  if (state.combat !== null) return { state, events: [] }
  const index = new GalaxyIndex(state.galaxy)
  if (!canScoop(index, state.ship.at)) return { state, events: [] }
  if (state.ship.fuel >= FUEL_MAX) return { state, events: [] }

  const events: GameEvent[] = [{ type: 'scooped', at: state.ship.at }]
  const days = scoopDaysFor(state.unlockedTech)
  let next: GameState = {
    ...state,
    ship: { ...state.ship, fuel: FUEL_MAX },
    log: appendLog(state.log, {
      kind: 'travel',
      text:
        `${days === 1 ? 'A day' : 'Two days'} of slow orbits through the gas giant's outer envelope ` +
        `with the scoop fields wide${days === 1 ? ' — the survey suite finds the rich seams' : ''}. ` +
        `The tank reads full for the first time in a while.`,
    }),
  }
  next = advanceTime(next, days, events)
  return idleEncounter({ state: next, events })
}

/** Where the ship can take on stores: anywhere inhabited or administered. */
export function canResupply(index: GalaxyIndex, at: SystemId): boolean {
  const system = index.system(at)
  return system.features.includes('habitable-world') || system.faction !== null
}

function resupply(state: GameState): Transition {
  if (state.outcome !== 'seeking') return { state, events: [] }
  if (state.combat !== null) return { state, events: [] }
  const index = new GalaxyIndex(state.galaxy)
  if (!canResupply(index, state.ship.at)) return { state, events: [] }
  if (state.supplies >= SUPPLIES_MAX) return { state, events: [] }

  const events: GameEvent[] = [{ type: 'resupplied' }]
  let next: GameState = {
    ...state,
    supplies: SUPPLIES_MAX,
    log: appendLog(state.log, {
      kind: 'travel',
      text:
        `Two days alongside, taking on stores. The hold smells of coffee and packing foam, ` +
        `and the damage-control rota fills back up with volunteers.`,
    }),
  }
  next = advanceTime(next, 2, events)
  return idleEncounter({ state: next, events })
}

function refit(state: GameState): Transition {
  if (state.outcome !== 'seeking') return { state, events: [] }
  if (state.combat !== null) return { state, events: [] }
  if (!state.driveScarred && state.hull >= hullMaxFor(state.unlockedTech)) return { state, events: [] }
  const index = new GalaxyIndex(state.galaxy)
  if (index.system(state.ship.at).faction === null) return { state, events: [] }

  const events: GameEvent[] = [{ type: 'refitted' }]
  let next: GameState = {
    ...state,
    driveScarred: false,
    hull: hullMaxFor(state.unlockedTech),
    log: appendLog(state.log, {
      kind: 'travel',
      text:
        `Four days in a rented cradle while yard crews who ask no questions grind the scarring ` +
        `out of the drive housings and plate over what the last fight cost. It sounds like itself again.`,
    }),
  }
  next = advanceTime(next, 4, events)
  return idleEncounter({ state: next, events })
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
  if (state.ship.fuel >= longJumpReserveFor(state.unlockedTech)) return false
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
 * uncollected thread, medical reads the medbay and the stores, security
 * counts what is left to spend.
 */
function consult(state: GameState): Transition {
  if (state.outcome !== 'seeking') return { state, events: [] }

  const lines: string[] = []
  const index = new GalaxyIndex(state.galaxy)

  {
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
            ? 'Medbay is empty'
            : medbay.map((o) => `${o.name} needs ${Math.max(0, (o.healedAfter ?? 0) - state.day)} more days`).join('; ')
        }. Stores at ${state.supplies} of ${SUPPLIES_MAX}${state.supplies === 0 ? ' — people are hungry, captain' : ''}."`,
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
  }

  return {
    state: {
      ...state,
      log: appendLog(state.log, { kind: 'bridge', text: lines.join(' ') }),
    },
    events: [{ type: 'consulted' }],
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
  if (state.combat !== null) return { state, events: [] }
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

  let next: GameState = { ...state, missionsRun }
  const preEvents: GameEvent[] = []
  next = advanceTime(next, 1, preEvents)
  if (next.outcome !== 'seeking') return { state: next, events: preEvents }

  const odds = approachOdds(approach, team, next.roster, {
    bonus: awayBonusFor(next.unlockedTech),
    starving: next.supplies <= 0,
  })
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

  for (const role of officers) {
    const target = roster.find((o) => o.role === role)!
    if (target.status !== 'fit') continue

    if (harm.officerDeath > 0 && rng.chance(harm.officerDeath)) {
      target.status = 'dead'
      events.push({ type: 'officerDied', role: target.role, name: target.name })
    } else if (rng.chance(harm.officerInjury)) {
      target.status = 'injured'
      // Days in the medbay, not missions: the wound heals on the calendar,
      // and a fit medical officer roughly halves the stay.
      target.healedAfter =
        state.day + (isFit(roster, 'medical') && target.role !== 'medical' ? 6 : 12)
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
  if (state.combat !== null) return { state, events: [] }
  const reserve = longJumpReserveFor(state.unlockedTech)
  if (state.ship.fuel < reserve) return { state, events: [] }

  const correct = target === state.mystery.gateway
  const jumps = [...state.jumps, { target, correct }]
  const name = systemName(state, target)

  if (correct) {
    // The answer was right — but the run ends at the Doorway, not on a
    // dice-less cut to black. The gate is an encounter: contested if the
    // war has been allowed to reach it, and its threshold offers every
    // ending the campaign has earned.
    const contested = state.warPressure >= 4
    return {
      state: {
        ...state,
        jumps,
        ship: { at: target, fuel: state.ship.fuel - reserve },
        selected: target,
        encounter: { id: 'doorway-home', node: contested ? 'contested' : 'threshold' },
        encountersSeen: state.encountersSeen + 1,
        log: appendLog(state.log, {
          kind: 'jump',
          text:
            `${name}. We burned the reserve and committed, and the drive holds — the rift opens ` +
            `onto the terminus, and the gate is real. ` +
            (contested
              ? `So is the war: both fleets are fighting across the approach.`
              : `The approach is clear. One more decision, and it is the last one.`),
        }),
      },
      events: [{ type: 'encounterBegan', id: 'doorway-home' }],
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

  const scarred = riftScarsDrive(state.unlockedTech)
  const fuelLeft = Math.min(state.ship.fuel - reserve, riftFuelFloor(state.unlockedTech))
  const events: GameEvent[] = [{ type: 'jumpFailed', target, attempt: jumps.length, displacedTo }]
  let next: GameState = {
    ...state,
    jumps,
    ship: { at: displacedTo, fuel: fuelLeft },
    selected: displacedTo,
    // The rift takes more than fuel — unless the stabilisers hold the door.
    driveScarred: state.driveScarred || scarred,
    log: appendLog(state.log, {
      kind: 'jump',
      text:
        `${name}. We burned the reserve and committed, and the anomaly was not there. ` +
        `The rift spat us out at ${systemName(state, displacedTo)} with ` +
        `${fuelLeft} fuel${scarred ? ' and a scarred drive' : ', the stabilisers holding'}. ` +
        `Attempt ${jumps.length}. We are still out here.`,
    }),
  }
  next = advanceTime(next, 3, events)
  if (next.outcome !== 'seeking') return { state: next, events }
  return declareIfStranded(next, index, events)
}

/* ------------------------------------------------------------------------ *
 * Encounters
 * ------------------------------------------------------------------------ */

/**
 * The arrival roll: scheduled follow-ups first, then the weighted catalog.
 * Fires only on a still-seeking ship, and marks the encounter done the
 * moment it opens so a unique can never roll twice.
 */
function maybeEncounter(
  state: GameState,
  at: SystemId,
  events: GameEvent[],
  chance?: number,
): Transition {
  // A scheduled thread the story has since closed (its flag conditions can
  // no longer pass) is quietly dropped — the hunter died, the debt was paid.
  const pruned = state.pending.filter((p) => !flagsBlock(p.id, state))
  if (pruned.length !== state.pending.length) state = { ...state, pending: pruned }

  const rng = createRng(`${state.seed}:encounter:${at}:${state.day}:${state.encountersSeen}`)
  const chosen = chooseEncounter(state, at, rng, chance)
  if (!chosen) return { state, events }

  const { def, fromPending } = chosen
  events.push({ type: 'encounterBegan', id: def.id })
  const next: GameState = {
    ...state,
    encounter: { id: def.id, node: def.entry },
    encountersSeen: state.encountersSeen + 1,
    recent: [...state.recent, { id: def.id, tag: def.tag, day: state.day }].slice(-6),
    flags: state.flags.includes(doneFlag(def.id)) ? state.flags : [...state.flags, doneFlag(def.id)],
    pending: fromPending ? state.pending.filter((p) => p.id !== def.id) : state.pending,
    log: appendLog(state.log, {
      kind: 'encounter',
      text: `${systemName(state, at)}: ${def.title}.`,
    }),
  }
  return { state: next, events }
}

/**
 * Days spent in-system are not days spent unnoticed: scooping, resupply,
 * refits and lab work all roll a quieter encounter chance, and a due
 * follow-up will find a ship that sits still just as surely as one that
 * runs.
 */
const IDLE_ENCOUNTER_CHANCE = 0.25

function idleEncounter(transition: Transition): Transition {
  const { state, events } = transition
  if (state.outcome !== 'seeking' || state.encounter || state.combat) return transition
  return maybeEncounter(state, state.ship.at, events, IDLE_ENCOUNTER_CHANCE)
}

/** Whether a choice's visible requirements are met. Shared with the UI. */
export function choiceAvailable(state: GameState, choice: EncounterChoice): boolean {
  const needs = choice.needs
  if (needs) {
    if (needs.tech && !state.unlockedTech.includes(needs.tech)) return false
    if (needs.officer && !isFit(state.roster, needs.officer)) return false
    if (needs.standing && state.standing[needs.standing[0]] < needs.standing[1]) return false
    if (needs.flag && !state.flags.includes(needs.flag)) return false
  }
  const spend = choice.spend
  if (spend) {
    if ((spend.fuel ?? 0) > state.ship.fuel) return false
    if ((spend.data ?? 0) > state.data) return false
    if ((spend.supplies ?? 0) > state.supplies) return false
  }
  return true
}

function encounterChoose(state: GameState, choiceId: string): Transition {
  if (state.outcome !== 'seeking') return { state, events: [] }
  const active = state.encounter
  if (!active || active.outcome) return { state, events: [] }
  const def = encounterDef(active.id)
  if (!def) return { state: { ...state, encounter: null }, events: [] }
  const node = def.nodes[active.node]
  if (!node) return { state: { ...state, encounter: null }, events: [] }
  const choice = node.choices.find((c) => c.id === choiceId)
  if (!choice || !choiceAvailable(state, choice)) return { state, events: [] }

  const events: GameEvent[] = [{ type: 'encounterResolved', id: def.id, choice: choice.id }]
  let next: GameState = state

  // The stake goes on the table before the dice roll.
  if (choice.spend) {
    next = {
      ...next,
      ship: { ...next.ship, fuel: next.ship.fuel - (choice.spend.fuel ?? 0) },
      data: next.data - (choice.spend.data ?? 0),
      supplies: next.supplies - (choice.spend.supplies ?? 0),
    }
  }

  const rng = createRng(
    `${state.seed}:enc-roll:${def.id}:${active.node}:${choice.id}:${state.encountersSeen}`,
  )

  // Conditional entries first: drop what the story rules out, and when a
  // specific entry survives, it replaces the generic fallbacks entirely.
  const entries = choice.results.map(([weight, outcome, cond]) => ({ weight, outcome, cond }))
  const matching = entries.filter((e) => resultCondPasses(next, e.cond))
  const pool = matching.some((e) => e.cond) ? matching.filter((e) => e.cond) : matching
  const usable = pool.length > 0 ? pool : entries.filter((e) => !e.cond)
  if (usable.length === 0) return { state, events: [] }
  const outcome = rng.weighted(usable.map((e) => [e.outcome, e.weight] as const))

  return applyOutcome(next, def.id, outcome, rng, events)
}

function resultCondPasses(state: GameState, cond: ResultCond | undefined): boolean {
  if (!cond) return true
  if (cond.flagsAll && !cond.flagsAll.every((f) => state.flags.includes(f))) return false
  if (cond.flagsNone && cond.flagsNone.some((f) => state.flags.includes(f))) return false
  if (cond.standingAtLeast && state.standing[cond.standingAtLeast[0]] < cond.standingAtLeast[1]) return false
  if (cond.standingAtMost && state.standing[cond.standingAtMost[0]] > cond.standingAtMost[1]) return false
  if (cond.minWar !== undefined && state.warPressure < cond.minWar) return false
  if (cond.maxWar !== undefined && state.warPressure > cond.maxWar) return false
  return true
}

/**
 * Lands an outcome on the ship: resources, standing, flags, casualties,
 * intelligence, follow-ups, and — last — either the next dialogue node, the
 * outcome card, or battle stations.
 */
function applyOutcome(
  state: GameState,
  encounterId: string,
  outcome: EncounterOutcome,
  rng: Rng,
  events: GameEvent[],
): Transition {
  let next = state

  if (outcome.flagsSet || outcome.flagsClear) {
    const cleared = new Set(outcome.flagsClear ?? [])
    const flags = next.flags.filter((f) => !cleared.has(f))
    for (const f of outcome.flagsSet ?? []) if (!flags.includes(f)) flags.push(f)
    next = { ...next, flags }
  }

  if (outcome.standing) {
    const standing = { ...next.standing }
    for (const [culture, delta] of Object.entries(outcome.standing) as [CultureId, number][]) {
      standing[culture] = Math.max(-3, Math.min(3, standing[culture] + delta))
      events.push({ type: 'standingShifted', culture, delta })
    }
    next = { ...next, standing }
  }

  if (outcome.war) {
    next = { ...next, warPressure: Math.max(0, Math.min(10, next.warPressure + outcome.war)) }
  }

  const hullMax = hullMaxFor(next.unlockedTech)
  next = {
    ...next,
    ship: {
      ...next.ship,
      fuel: Math.max(0, Math.min(FUEL_MAX, next.ship.fuel + (outcome.fuel ?? 0))),
    },
    supplies: Math.max(0, Math.min(SUPPLIES_MAX, next.supplies + (outcome.supplies ?? 0))),
    hull: Math.max(1, Math.min(hullMax, next.hull + (outcome.hull ?? 0))),
    data: Math.max(0, next.data + (outcome.data ?? 0)),
  }
  if (outcome.data && outcome.data > 0) events.push({ type: 'dataGained', amount: outcome.data })

  if (outcome.loseCrew) {
    let toLose = outcome.loseCrew
    let { security, crew } = next.pools
    const fromSecurity = Math.min(toLose, security)
    security -= fromSecurity
    toLose -= fromSecurity
    const fromCrew = Math.min(toLose, crew)
    crew -= fromCrew
    const lost = fromSecurity + fromCrew
    if (lost > 0) {
      events.push({ type: 'genericsLost', count: lost })
      next = {
        ...next,
        pools: { security, crew },
        casualties: { ...next.casualties, generics: next.casualties.generics + lost },
      }
    }
  }

  if (outcome.injureOfficer) {
    const fit = next.roster.filter((o) => o.role !== 'captain' && o.status === 'fit')
    if (fit.length > 0) {
      const hurt = rng.pick([...fit].sort((a, b) => (a.role < b.role ? -1 : 1)))
      const duration = isFit(next.roster, 'medical') && hurt.role !== 'medical' ? 6 : 12
      next = {
        ...next,
        roster: next.roster.map((o) =>
          o.role === hurt.role
            ? { ...o, status: 'injured' as const, healedAfter: next.day + duration }
            : o,
        ),
      }
      events.push({ type: 'officerInjured', role: hurt.role, name: hurt.name })
    }
  }

  if (outcome.followUp) {
    const [min, max] = outcome.followUp.days
    next = {
      ...next,
      pending: [
        ...next.pending.filter((p) => p.id !== outcome.followUp!.id),
        { id: outcome.followUp.id, notBefore: next.day + rng.range(min, max) },
      ],
    }
  }

  if (outcome.shareClues) {
    const shared = shareIntelligence(next, outcome.shareClues, rng, events)
    next = shared.state
    events.push(...shared.events)
    if (next.outcome !== 'seeking') return { state: { ...next, encounter: null, combat: null }, events }
  }

  if (outcome.combat) {
    const enemy = ENEMY_CLASSES[outcome.combat.enemy]
    events.push({ type: 'combatStarted', enemy: outcome.combat.enemy })
    next = {
      ...next,
      combat: {
        enemy: outcome.combat.enemy,
        seed: `${next.seed}:combat:${encounterId}:${next.encountersSeen}`,
        label: encounterDef(encounterId)?.title ?? 'Engagement',
        rewards: outcome.combat.rewards,
        withdrawFollowUp: outcome.combat.withdrawFollowUp,
        noWithdraw: outcome.combat.noWithdraw,
      } satisfies PendingCombat,
      log: appendLog(next.log, {
        kind: 'combat',
        text: `${enemy.name} commits to the attack. All hands to stations.`,
      }),
    }
  }

  if (outcome.days) {
    next = advanceTime(next, outcome.days, events)
    if (next.outcome !== 'seeking') return { state: { ...next, encounter: null, combat: null }, events }
  }

  if (outcome.endRun) {
    const target = next.jumps[next.jumps.length - 1]?.target ?? next.ship.at
    events.push({ type: 'jumpSucceeded', target })
    return {
      state: {
        ...next,
        outcome: 'home',
        ending: outcome.endRun,
        encounter: null,
        combat: null,
        log: appendLog(next.log, { kind: 'ending', text: outcome.text.join(' ') }),
      },
      events,
    }
  }

  const summary = outcome.text[0] ?? ''
  next = {
    ...next,
    encounter: outcome.goto
      ? { id: encounterId, node: outcome.goto }
      : { id: encounterId, node: next.encounter?.node ?? '', outcome: { text: outcome.text } },
    log: summary
      ? appendLog(next.log, { kind: 'encounter', text: summary })
      : next.log,
  }
  return { state: next, events }
}

/**
 * Intelligence changes hands: an uncollected clue, picked by the seeded
 * dice, arrives on the plot already legible — someone told you, and telling
 * needs no decoding. When the galaxy has nothing left to tell, the source
 * pays in data instead.
 */
function shareIntelligence(
  state: GameState,
  count: number,
  rng: Rng,
  _events: GameEvent[],
): Transition {
  let next = state
  const all: GameEvent[] = []
  for (let i = 0; i < count; i++) {
    const remaining = next.mystery.clues
      .filter((c) => !next.collected.includes(c.id))
      .sort((a, b) => (a.id < b.id ? -1 : 1))
    if (remaining.length === 0) {
      all.push({ type: 'dataGained', amount: 3 })
      next = {
        ...next,
        data: next.data + 3,
        log: appendLog(next.log, {
          kind: 'encounter',
          text: `The account offered is one the plot already holds; the teller adds technical detail instead.`,
        }),
      }
      continue
    }
    const clue = rng.pick(remaining)
    const collected = collectClues(
      next,
      [clue],
      /* handed over legible */ true,
      `Intelligence received: an account of the anomaly, passed to us directly. Filed to the plot, unassessed.`,
    )
    next = collected.state
    all.push(...collected.events)
  }
  return { state: next, events: all }
}

function encounterContinue(state: GameState): Transition {
  if (!state.encounter) return { state, events: [] }
  return { state: { ...state, encounter: null }, events: [] }
}

/* ------------------------------------------------------------------------ *
 * Ship combat resolution
 * ------------------------------------------------------------------------ */

/**
 * The battle is fought on the combat screen; its verdict re-enters the
 * rules here, as an action, so a replayed log never re-fights it. Victory
 * pays the encounter's promised rewards; withdrawal costs fuel and often
 * reschedules the hunter; defeat is the end of the ship.
 */
function resolveCombat(
  state: GameState,
  result: 'victory' | 'defeat' | 'withdrawn',
  hullLeft: number,
  injured: OfficerRole[],
): Transition {
  const combat = state.combat
  if (!combat || state.outcome !== 'seeking') return { state, events: [] }

  const enemy = ENEMY_CLASSES[combat.enemy]
  const events: GameEvent[] = [{ type: 'combatEnded', result }]
  const hullMax = hullMaxFor(state.unlockedTech)
  const hull = Math.max(0, Math.min(hullMax, Math.floor(hullLeft)))

  // Officers wounded at their stations go to the medbay on the usual
  // calendar; a fit medical officer halves everyone else's stay.
  if (injured.length > 0 && result !== 'defeat') {
    const woundedRoles = new Set(injured)
    const medicalFit =
      isFit(state.roster, 'medical') && !woundedRoles.has('medical')
    const names: string[] = []
    const roster = state.roster.map((o) => {
      if (!woundedRoles.has(o.role) || o.status !== 'fit') return o
      names.push(o.name)
      events.push({ type: 'officerInjured', role: o.role, name: o.name })
      return {
        ...o,
        status: 'injured' as const,
        healedAfter: state.day + (medicalFit && o.role !== 'medical' ? 6 : 12),
      }
    })
    if (names.length > 0) {
      state = {
        ...state,
        roster,
        log: appendLog(state.log, {
          kind: 'combat',
          text: `${names.join(' and ')} ${names.length === 1 ? 'is' : 'are'} carried from ${
            names.length === 1 ? 'their station' : 'their stations'
          } to the medbay.`,
        }),
      }
    }
  }

  if (result === 'defeat') {
    events.push({ type: 'shipDestroyed' })
    return {
      state: {
        ...state,
        hull: 0,
        combat: null,
        encounter: null,
        outcome: 'destroyed',
        log: appendLog(state.log, {
          kind: 'ending',
          text:
            `${enemy.name} walks its fire down the spine of the ship, and the Ithaca comes apart ` +
            `around her crew. The escape pods that get away carry the plot with them — a chart of ` +
            `the way home, adrift with nobody left to fly it.`,
        }),
      },
      events,
    }
  }

  if (result === 'withdrawn') {
    const fuelCost = Math.min(6, state.ship.fuel)
    let next: GameState = {
      ...state,
      hull: Math.max(1, hull),
      combat: null,
      ship: { ...state.ship, fuel: state.ship.fuel - fuelCost },
      pending: combat.withdrawFollowUp
        ? [
            ...state.pending.filter((p) => p.id !== combat.withdrawFollowUp!.id),
            {
              id: combat.withdrawFollowUp.id,
              notBefore:
                state.day +
                createRng(`${state.seed}:withdraw:${state.encountersSeen}`).range(
                  combat.withdrawFollowUp.days[0],
                  combat.withdrawFollowUp.days[1],
                ),
            },
          ]
        : state.pending,
      log: appendLog(state.log, {
        kind: 'combat',
        text:
          `The Ithaca disengages from ${enemy.name} under emergency burn — ${fuelCost} fuel spent ` +
          `running, and the matter unsettled.`,
      }),
    }
    next = advanceTime(next, 1, events)
    if (next.outcome !== 'seeking') return { state: next, events }
    return declareIfStranded(next, new GalaxyIndex(next.galaxy), events)
  }

  // Victory.
  const rewards: CombatRewards = combat.rewards ?? {}
  let next: GameState = {
    ...state,
    hull: Math.max(1, hull),
    combat: null,
    log: appendLog(state.log, {
      kind: 'combat',
      text:
        (rewards.text ?? `${enemy.name} breaks apart. The salvage teams go to work.`) +
        (rewards.fuel ? ` Recovered ${rewards.fuel} fuel` : '') +
        (rewards.data ? `${rewards.fuel ? ' and' : ' Recovered'} ${rewards.data} data` : '') +
        (rewards.fuel || rewards.data ? '.' : ''),
    }),
  }

  if (rewards.flagsSet) {
    const flags = [...next.flags]
    for (const f of rewards.flagsSet) if (!flags.includes(f)) flags.push(f)
    next = { ...next, flags }
  }
  if (rewards.standing) {
    const standing = { ...next.standing }
    for (const [culture, delta] of Object.entries(rewards.standing) as [CultureId, number][]) {
      standing[culture] = Math.max(-3, Math.min(3, standing[culture] + delta))
      events.push({ type: 'standingShifted', culture, delta })
    }
    next = { ...next, standing }
  }
  next = {
    ...next,
    ship: { ...next.ship, fuel: Math.min(FUEL_MAX, next.ship.fuel + (rewards.fuel ?? 0)) },
    data: next.data + (rewards.data ?? 0),
  }
  if (rewards.data) events.push({ type: 'dataGained', amount: rewards.data })

  if (rewards.shareClues) {
    const rng = createRng(`${next.seed}:combat-intel:${next.encountersSeen}`)
    const shared = shareIntelligence(next, rewards.shareClues, rng, events)
    next = shared.state
    events.push(...shared.events)
    if (next.outcome !== 'seeking') return { state: next, events }
  }

  // A battle fought inside a story beat hands the screen back to it — the
  // gate assault resumes at the threshold, not on the bridge.
  if (rewards.resumeEncounter) {
    return {
      state: { ...next, encounter: { id: rewards.resumeEncounter.id, node: rewards.resumeEncounter.node } },
      events,
    }
  }

  next = advanceTime(next, 1, events)
  return { state: next, events }
}

/* ------------------------------------------------------------------------ *
 * Research
 * ------------------------------------------------------------------------ */

/**
 * The lab spends data on the trees. Two days a project, a fit science
 * officer at the bench, and the effects land wherever their systems live —
 * travel prices, jump reserves, dialogue options, the combat loadout.
 */
function research(state: GameState, techId: TechId): Transition {
  if (state.outcome !== 'seeking') return { state, events: [] }
  if (state.combat !== null) return { state, events: [] }
  if (!canResearch(state.unlockedTech, techId)) return { state, events: [] }
  if (!isFit(state.roster, 'science')) return { state, events: [] }

  const def = techDef(techId)
  if (state.data < def.cost) return { state, events: [] }

  const science = officer(state.roster, 'science')!
  const events: GameEvent[] = [{ type: 'techResearched', tech: techId }]
  let next: GameState = {
    ...state,
    data: state.data - def.cost,
    unlockedTech: [...state.unlockedTech, techId],
    log: appendLog(state.log, {
      kind: 'research',
      text: `${science.name} signs off on ${def.name} after two days at the bench. ${def.flavour}`,
    }),
  }
  // New armour plating is fitted at full thickness.
  next = { ...next, hull: Math.min(hullMaxFor(next.unlockedTech), Math.max(next.hull, state.hull + (techId === 'war-armour' ? 6 : 0))) }
  next = advanceTime(next, RESEARCH_DAYS, events)
  return idleEncounter({ state: next, events })
}

/** The reserve the Long Jump currently demands, for the UI. */
export function longJumpReserve(state: GameState): number {
  return longJumpReserveFor(state.unlockedTech)
}

/**
 * Rift Echo Tomography: the chart marks the two stars where the rift
 * resonates — the gateway and the decoy, unlabeled, sorted so nothing about
 * the order gives the answer away. Null until the tech is researched.
 */
export function riftResonance(state: GameState): SystemId[] | null {
  if (!state.unlockedTech.includes('scan-triangulate')) return null
  return [state.mystery.gateway, state.mystery.decoy].sort()
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
