import type { ClueId, ClueState, Mystery } from '../mystery/types.js'
import type { Galaxy, SystemId } from '../worldgen/types.js'

/**
 * The Milestone 2 slice of game state: enough to gather evidence, reason about
 * it, and commit to a jump. Travel, fuel and crew arrive in M1/M3 and will
 * extend this rather than replace it.
 *
 * The whole object is serialisable — no class instances, no functions — so
 * save/load is `JSON.stringify` and replay is a seed plus an action log.
 */
export interface GameState {
  seed: string
  galaxy: Galaxy
  /**
   * Includes the answer. Components are never handed this directly; the store
   * exposes `PlayerClue`s and derived selectors instead.
   */
  mystery: Mystery
  /** Evidence the player has actually picked up. */
  collected: ClueId[]
  /** The player's own call on each clue: unfiled, trusted, or doubted. */
  clueStates: Record<ClueId, ClueState>
  /** Systems whose evidence has been taken, so sites do not repeat. */
  searched: SystemId[]
  /** The system currently under inspection on the chart. */
  selected: SystemId | null
  jumps: JumpAttempt[]
  outcome: 'seeking' | 'home'
  log: LogEntry[]
}

export interface JumpAttempt {
  target: SystemId
  correct: boolean
}

export interface LogEntry {
  id: number
  kind: 'arrival' | 'evidence' | 'filing' | 'contradiction' | 'jump' | 'ending'
  text: string
}

export type Action =
  | { type: 'search'; system: SystemId }
  | { type: 'file'; clue: ClueId; state: ClueState }
  | { type: 'select'; system: SystemId | null }
  | { type: 'plotTheJump'; target: SystemId }

/**
 * Events describe what happened, so the UI can narrate and animate without the
 * reducer knowing anything about presentation. The captain's log falls out of
 * this for free.
 */
export type GameEvent =
  | { type: 'evidenceFound'; clues: ClueId[]; at: SystemId }
  | { type: 'nothingFound'; at: SystemId }
  | { type: 'clueFiled'; clue: ClueId; state: ClueState }
  | { type: 'jumpSucceeded'; target: SystemId }
  | { type: 'jumpFailed'; target: SystemId; attempt: number }

export interface Transition {
  state: GameState
  events: GameEvent[]
}
