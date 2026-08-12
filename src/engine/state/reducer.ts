import { generateRoster, promoteGeneric } from '../crew/generate.js'
import { MAX_ESCORTS, MAX_HANDS, STARTING_POOLS, type AwayTeam, type Officer, type OfficerRole } from '../crew/types.js'
import {
  approachesFor,
  approachOdds,
  dominantSite,
  needsDecoding,
  type Site,
} from '../missions/sites.js'
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
    roster: generateRoster(seed),
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
  switch (action.type) {
    case 'select':
      return { state: { ...state, selected: action.system }, events: [] }
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

  return collectClues(
    { ...state, searched },
    found,
    /* decoded because nothing here needs decoding */ true,
    `${system}: ${found.length === 1 ? 'one account' : `${found.length} accounts`} of the anomaly ` +
      `recovered without incident. Filed to the plot, unassessed.`,
  )
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

  return {
    state: {
      ...state,
      collected: [...state.collected, ...found.map((c) => c.id)],
      clueStates,
      undecoded,
      log: appendLog(state.log, { kind: 'evidence', text: logText }),
    },
    events: [
      {
        type: 'evidenceFound',
        clues: found.map((c) => c.id),
        at: found[0]!.source.at,
        undecoded: undecodedNow,
      },
    ],
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

/** Validates a team against the roster and pools. Returns null if illegal. */
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
  next = recoverInjured(next)

  const odds = approachOdds(approach, team, next.roster)
  const roll = rng.next() * 100
  const outcome: 'clean' | 'messy' | 'disaster' =
    roll < odds.clean ? 'clean' : roll < odds.clean + odds.messy ? 'messy' : 'disaster'

  const system = systemName(state, systemId)
  const events: GameEvent[] = [{ type: 'missionResolved', at: systemId, outcome }]

  if (outcome === 'clean') {
    const found = cluesAt(next, systemId)
    next = { ...next, searched: [...next.searched, systemId] }
    const collected = collectClues(
      next,
      found,
      team.officers.includes('science'),
      `${system} — ${site.label.toLowerCase()}: the team is back aboard, all counted. ` +
        `${found.length === 1 ? 'One account' : `${found.length} accounts`} of the anomaly recovered.`,
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
      target.healedAfter =
        state.missionsRun + (isFit(roster, 'medical') && target.role !== 'medical' ? 2 : 4)
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

/** Officers heal on a mission clock, faster when the medbay has its doctor. */
function recoverInjured(state: GameState): GameState {
  const roster = state.roster.map((o) =>
    o.status === 'injured' && (o.healedAfter ?? Infinity) <= state.missionsRun
      ? { ...o, status: 'fit' as const, healedAfter: undefined }
      : o,
  )
  return { ...state, roster }
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
  return {
    state: {
      ...state,
      undecoded: state.undecoded.filter((id) => id !== clueId),
      log: appendLog(state.log, {
        kind: 'crew',
        text: `${science.name} works the artefact over until it gives. Another account, legible at last.`,
      }),
    },
    events: [{ type: 'clueDecoded', clue: clueId }],
  }
}

function promote(state: GameState, role: Exclude<OfficerRole, 'captain'>): Transition {
  const vacant = officer(state.roster, role)
  if (!vacant || vacant.status !== 'dead') return { state, events: [] }
  if (state.pools.crew <= 0) return { state, events: [] }

  const replacement = promoteGeneric(state.seed, role, state.promotions)
  const roster = state.roster.map((o) => (o.role === role ? replacement : o))

  return {
    state: {
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
    },
    events: [{ type: 'promoted', role, name: replacement.name }],
  }
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

  return {
    state: {
      ...state,
      jumps,
      log: appendLog(state.log, {
        kind: 'jump',
        text:
          `${name}. We burned the reserve and committed, and the anomaly was not there. ` +
          `The drive is scarred and the crew have done the arithmetic on what that cost. ` +
          `Attempt ${jumps.length}. We are still out here.`,
      }),
    },
    events: [{ type: 'jumpFailed', target, attempt: jumps.length }],
  }
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
