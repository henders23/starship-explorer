import { generatePuzzle, type MysteryOptions } from '../mystery/generate.js'
import type { ClueId, ClueState, PlayerClue } from '../mystery/types.js'
import { toPlayerClue } from '../mystery/types.js'
import type { SystemId } from '../worldgen/types.js'
import type { Action, GameEvent, GameState, LogEntry, Transition } from './types.js'

/**
 * The rules. `(state, action) => { state, events }`, pure and total: no I/O, no
 * randomness beyond what the seed already fixed, no React. If a number is
 * computed in a component instead of here, that is a bug.
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
    searched: [],
    selected: puzzle.galaxy.start,
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

function search(state: GameState, systemId: SystemId): Transition {
  if (state.outcome !== 'seeking') return { state, events: [] }
  if (state.searched.includes(systemId)) return { state, events: [] }

  const found = state.mystery.clues
    .filter((clue) => clue.source.at === systemId && !state.collected.includes(clue.id))
    .map((clue) => clue.id)

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

  const clueStates = { ...state.clueStates }
  for (const id of found) clueStates[id] = 'unfiled'

  return {
    state: {
      ...state,
      searched,
      collected: [...state.collected, ...found],
      clueStates,
      log: appendLog(state.log, {
        kind: 'evidence',
        text:
          `${system}: ${found.length === 1 ? 'one account' : `${found.length} accounts`} ` +
          `of the anomaly recovered. Filed to the plot, unassessed.`,
      }),
    },
    events: [{ type: 'evidenceFound', clues: found, at: systemId }],
  }
}

function file(state: GameState, clueId: ClueId, clueState: ClueState): Transition {
  if (!state.collected.includes(clueId)) return { state, events: [] }
  if (state.clueStates[clueId] === clueState) return { state, events: [] }

  return {
    state: { ...state, clueStates: { ...state.clueStates, [clueId]: clueState } },
    events: [{ type: 'clueFiled', clue: clueId, state: clueState }],
  }
}

/**
 * The commit. Getting it wrong is survivable — the game over is running out of
 * the means to keep looking, never the guess itself (DESIGN §4.5) — so a failed
 * jump costs and scars but always leaves the search open.
 */
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

/** Systems that still hold evidence the player has not swept. */
export function evidenceSites(state: GameState): Set<SystemId> {
  const sites = new Set<SystemId>()
  for (const clue of state.mystery.clues) {
    if (!state.collected.includes(clue.id)) sites.add(clue.source.at)
  }
  for (const searched of state.searched) sites.delete(searched)
  return sites
}
