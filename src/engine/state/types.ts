import type { PendingCombat } from '../combat/ships.js'
import type { AwayTeam, CrewPools, Officer, OfficerRole } from '../crew/types.js'
import type { ActiveEncounter, CultureId, EndingVariant, PendingFollowUp } from '../encounters/types.js'
import type { ClueId, ClueState, Mystery } from '../mystery/types.js'
import type { TechId } from '../research/tech.js'
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

  /** Hull integrity, 0 to hullMaxFor(unlockedTech). Combat spends it. */
  hull: number
  /** Research data: the coin every kind of intelligence work pays in. */
  data: number
  /** Research completed, in unlock order. */
  unlockedTech: TechId[]
  /** Story flags: encounter history, promises, debts. Strings by design. */
  flags: string[]
  /** Reputation with the cultures that keep score, −3 to +3 each. */
  standing: Record<CultureId, number>
  /** How hard the interstellar war is currently intruding, 0–10. */
  warPressure: number
  /** Connected encounters scheduled to find the ship in the coming days. */
  pending: PendingFollowUp[]
  /** The encounter currently holding the viewscreen, if any. */
  encounter: ActiveEncounter | null
  /** Encounters begun so far — the RNG stream discriminator for dialogue. */
  encountersSeen: number
  /** A battle ordered but not yet resolved. Blocks most other actions. */
  combat: PendingCombat | null

  /** The captain and department officers — the named people. */
  roster: Officer[]
  /** The generic pools: alive counts, nothing more. */
  pools: CrewPools
  /** Missions attempted, successful or not. Drives injury recovery and RNG. */
  missionsRun: number
  /** How many promotions have happened, to seed replacement names. */
  promotions: number
  /** The butcher's bill, for the epilogue. */
  casualties: { generics: number; officers: string[] }

  jumps: JumpAttempt[]
  outcome: 'seeking' | 'home' | 'lost' | 'stranded' | 'mutiny' | 'destroyed'
  /** How the run ended, when the outcome is 'home': which door was chosen. */
  ending: EndingVariant | null
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
    | 'encounter'
    | 'combat'
    | 'research'
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
  | { type: 'decode'; clue: ClueId }
  | { type: 'promote'; role: Exclude<OfficerRole, 'captain'> }
  | { type: 'file'; clue: ClueId; state: ClueState }
  | { type: 'select'; system: SystemId | null }
  | { type: 'plotTheJump'; target: SystemId }
  | { type: 'encounterChoose'; choice: string }
  | { type: 'encounterContinue' }
  | { type: 'research'; tech: TechId }
  | {
      type: 'resolveCombat'
      result: 'victory' | 'defeat' | 'withdrawn'
      /** Hull remaining when the engagement ended, from the combat screen. */
      hull: number
    }

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
  | { type: 'genericsLost'; count: number }
  | { type: 'officerInjured'; role: OfficerRole; name: string }
  | { type: 'officerDied'; role: OfficerRole; name: string }
  | { type: 'captainLost' }
  | { type: 'promoted'; role: OfficerRole; name: string }
  | { type: 'clueDecoded'; clue: ClueId }
  | { type: 'clueFiled'; clue: ClueId; state: ClueState }
  | { type: 'jumpSucceeded'; target: SystemId }
  | { type: 'jumpFailed'; target: SystemId; attempt: number; displacedTo: SystemId }
  | { type: 'encounterBegan'; id: string }
  | { type: 'encounterResolved'; id: string; choice: string }
  | { type: 'dataGained'; amount: number }
  | { type: 'standingShifted'; culture: CultureId; delta: number }
  | { type: 'techResearched'; tech: TechId }
  | { type: 'combatStarted'; enemy: string }
  | { type: 'combatEnded'; result: 'victory' | 'defeat' | 'withdrawn' }
  | { type: 'shipDestroyed' }

export interface Transition {
  state: GameState
  events: GameEvent[]
}
