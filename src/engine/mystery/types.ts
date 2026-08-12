import type { FactionId, RegionId, StarType, SystemFeature, SystemId } from '../worldgen/types.js'

/**
 * A predicate over star systems. Every clue in the game is one of these plus
 * some authored prose; the player's candidate set is every system satisfying
 * all the constraints they currently trust.
 */
export type Constraint =
  | { kind: 'direction'; of: SystemId; dir: 'coreward' | 'rimward' | 'spinward' | 'trailing' }
  | { kind: 'proximity'; of: SystemId; op: 'within' | 'beyond'; jumps: number }
  | { kind: 'starType'; is: StarType; negated: boolean }
  | { kind: 'contains'; feature: SystemFeature; negated: boolean }
  | { kind: 'adjacency'; faction: FactionId; negated: boolean }
  | { kind: 'region'; is: RegionId; negated: boolean }
  | { kind: 'isolation'; op: 'atMost' | 'atLeast'; lanes: number }
  | { kind: 'anomaly' }

export type ClueId = string

export type ClueSourceKind =
  | 'crew-memory'
  | 'alien-trader'
  | 'derelict-log'
  | 'ruins-tablet'
  | 'prisoner'
  | 'faction-archive'
  | 'listening-post'
  | 'castaway'

export interface ClueSource {
  kind: ClueSourceKind
  /** Where in the galaxy this evidence is found. */
  at: SystemId
  /** How the player is told it was come by. */
  attribution: string
}

/** What the player may do with a clue on the Nav Plot. */
export type ClueState = 'unfiled' | 'trusted' | 'doubted'

export interface Clue {
  id: ClueId
  constraint: Constraint
  /** Authored, source-flavoured phrasing shown to the player. */
  prose: string
  source: ClueSource
  /** Hidden from the player. Never expose this through the UI layer. */
  truth: 'true' | 'false'
  /** Shown to the player, derived from source reputation. Deliberately noisy. */
  confidence: number
  /** Other clues asserting the same thing from an independent source. */
  corroborates: ClueId[]
  state: ClueState
}

export interface Mystery {
  /** The system that is actually the way home. Hidden from the player. */
  gateway: SystemId
  /** The system a player who trusts the lies will convince themselves of. */
  decoy: SystemId
  clues: Clue[]
}

/** A set of clues that cannot all be true at once, and is minimal in that. */
export interface Contradiction {
  clues: ClueId[]
}
