import type { AwayTeam, CrewPools, Officer, OfficerRole } from '../crew/types.js'
import type { GearSlot, Loadouts } from '../missions/gear.js'
import type { ClueId, ClueState, Mystery } from '../mystery/types.js'
import type { Galaxy, SystemId } from '../worldgen/types.js'

/**
 * The M2+M3 slice of game state: gather evidence with a crew that can be
 * hurt doing it, reason about the evidence, and commit to a jump. Travel and
 * fuel arrive in M1 and will extend this rather than replace it.
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
  /** Artefacts recovered without a science officer: held, but unreadable. */
  undecoded: ClueId[]
  /** Systems whose evidence has been taken, so sites do not repeat. */
  searched: SystemId[]
  /** The system currently under inspection on the chart. */
  selected: SystemId | null

  /** Where the ship is and what is in the tank. Everything else orbits this. */
  ship: { at: SystemId; fuel: number }
  /** Days since arrival. Travel, missions and repairs all spend it. */
  day: number
  /** Ship-wide morale, 0–100. Bands: see MORALE_BANDS in the reducer. */
  morale: number
  /** True once morale has hit Mutinous: the next loss takes the ship. */
  mutinyArmed: boolean
  /** Stores, 0–100. Drains a point a day; at zero, morale bleeds instead. */
  supplies: number
  /** A scarred drive burns 30% more per lane until refitted. */
  driveScarred: boolean
  /** Rift Surges endured so far; each is worse than the last. */
  surges: number

  /** The captain and department officers — the named people. */
  roster: Officer[]
  /** What each station's locker holds. Missions read this, per carrier. */
  loadouts: Loadouts
  /** The generic pools: alive counts, nothing more. */
  pools: CrewPools
  /** Missions attempted, successful or not. Drives injury recovery and RNG. */
  missionsRun: number
  /** How many promotions have happened, to seed replacement names. */
  promotions: number
  /** The butcher's bill, for the epilogue. */
  casualties: { generics: number; officers: string[] }

  jumps: JumpAttempt[]
  outcome: 'seeking' | 'home' | 'lost' | 'stranded' | 'mutiny'
  log: LogEntry[]
}

export interface JumpAttempt {
  target: SystemId
  correct: boolean
}

export interface LogEntry {
  id: number
  kind:
    | 'arrival'
    | 'travel'
    | 'evidence'
    | 'mission'
    | 'crew'
    | 'bridge'
    | 'surge'
    | 'filing'
    | 'contradiction'
    | 'jump'
    | 'ending'
  text: string
}

export type Action =
  | { type: 'travel'; to: SystemId }
  | { type: 'scoop' }
  | { type: 'resupply' }
  | { type: 'refit' }
  | { type: 'consult' }
  | { type: 'search'; system: SystemId }
  | { type: 'runMission'; system: SystemId; team: AwayTeam; approach: string }
  | { type: 'equip'; role: OfficerRole; slot: GearSlot; item: string }
  | { type: 'decode'; clue: ClueId }
  | { type: 'promote'; role: Exclude<OfficerRole, 'captain'> }
  | { type: 'file'; clue: ClueId; state: ClueState }
  | { type: 'select'; system: SystemId | null }
  | { type: 'plotTheJump'; target: SystemId }

/**
 * Events describe what happened, so the UI can narrate and animate without the
 * reducer knowing anything about presentation. The captain's log falls out of
 * this for free.
 */
export type GameEvent =
  | { type: 'traveled'; from: SystemId; to: SystemId; fuelSpent: number }
  | { type: 'scooped'; at: SystemId }
  | { type: 'fuelSalvaged'; amount: number }
  | { type: 'strandedDeclared' }
  | { type: 'moraleShifted'; delta: number; morale: number }
  | { type: 'surgeStruck'; ordinal: number }
  | { type: 'resupplied' }
  | { type: 'refitted' }
  | { type: 'consulted' }
  | { type: 'mutinyDeclared' }
  | { type: 'officerRecovered'; role: OfficerRole; name: string }
  | { type: 'evidenceFound'; clues: ClueId[]; at: SystemId; undecoded: ClueId[] }
  | { type: 'nothingFound'; at: SystemId }
  | { type: 'missionResolved'; at: SystemId; outcome: 'clean' | 'messy' | 'disaster' }
  | { type: 'equipped'; role: OfficerRole; item: string }
  | { type: 'injurySpared'; role: OfficerRole; name: string }
  | { type: 'genericsLost'; count: number }
  | { type: 'officerInjured'; role: OfficerRole; name: string }
  | { type: 'officerDied'; role: OfficerRole; name: string }
  | { type: 'captainLost' }
  | { type: 'promoted'; role: OfficerRole; name: string }
  | { type: 'clueDecoded'; clue: ClueId }
  | { type: 'clueFiled'; clue: ClueId; state: ClueState }
  | { type: 'jumpSucceeded'; target: SystemId }
  | { type: 'jumpFailed'; target: SystemId; attempt: number; displacedTo: SystemId }

export interface Transition {
  state: GameState
  events: GameEvent[]
}
