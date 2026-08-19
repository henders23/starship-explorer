import type { CombatState } from '../combat/combat.js'
import type { AwayTeam, CrewPools, Officer, OfficerRole, Specialist } from '../crew/types.js'
import type { SceneInstance } from '../encounters/types.js'
import type { GearSlot, Loadouts } from '../missions/gear.js'
import type { ClueId, ClueState, Mystery } from '../mystery/types.js'
import type { ComponentKind } from '../research/parts.js'
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
  /** The scene playing right now, if any. Cast on arrival, plain data. */
  encounter: SceneInstance | null

  /** Where the ship is, what is in the tank, and what the hull can take. */
  ship: { at: SystemId; fuel: number; hull: number }
  /** Missiles in the magazine. Spent in battle, restocked at the yard. */
  ordnance: number
  /** The interception being fought, if any. Most actions wait for it. */
  combat: CombatState | null
  /** Contacts met so far; seeds each fight's dice. */
  combats: number
  /** Days since arrival. Travel, missions and repairs all spend it. */
  day: number
  /** A scarred drive burns 30% more per lane until refitted. */
  driveScarred: boolean
  /** The research track: what is known, and what the bench is working on. */
  tech: {
    researched: TechId[]
    /** Ticks down through advanceTime while the science officer is fit. */
    active: { id: TechId; daysLeft: number } | null
  }
  /** The technological track: components waiting out there, and counts held. */
  parts: {
    /** Which systems still hold components. Recovered with the evidence. */
    sites: Record<SystemId, ComponentKind[]>
    engine: number
    shield: number
  }
  /** Rift Surges endured so far; each is worse than the last. */
  surges: number

  /** The captain and department officers — the named people. */
  roster: Officer[]
  /** What each station's locker holds. Missions read this, per carrier. */
  loadouts: Loadouts
  /** The generic pools: alive counts, nothing more. */
  pools: CrewPools
  /** Specialists: waiting at stations, and signed aboard. */
  recruits: { sites: Record<SystemId, Specialist>; aboard: Specialist[] }
  /** Missions attempted, successful or not. Drives injury recovery and RNG. */
  missionsRun: number
  /** How many promotions have happened, to seed replacement names. */
  promotions: number
  /** The butcher's bill, for the epilogue. */
  casualties: { generics: number; officers: string[] }

  jumps: JumpAttempt[]
  outcome: 'seeking' | 'home' | 'lost' | 'stranded' | 'destroyed'
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
  | { type: 'refit' }
  | { type: 'consult' }
  | { type: 'search'; system: SystemId }
  | { type: 'runMission'; system: SystemId; team: AwayTeam; approach: string }
  | { type: 'equip'; role: OfficerRole; slot: GearSlot; item: string }
  /** Put the bench on a research project (replacing any active one). */
  | { type: 'startResearch'; tech: TechId }
  /** Reopen the scene at the ship's position, if content remains. */
  | { type: 'openScene' }
  /** Answer the playing scene with one of its options. */
  | { type: 'sceneOption'; option: string }
  /** The posture on contact. */
  | { type: 'combatContact'; choice: 'hail' | 'evade' | 'engage' }
  /** Answer a toll demand. */
  | { type: 'combatToll'; pay: boolean }
  /**
   * The battle simulation reporting how the engagement ended. The sim runs
   * in the UI; its outcome enters the action log here, so replays carry it.
   */
  | {
      type: 'combatResolve'
      result: 'victory' | 'driven-off' | 'yielded' | 'fled' | 'defeat'
      hullLeft: number
      missilesLeft: number
    }
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
  | { type: 'surgeStruck'; ordinal: number }
  | { type: 'refitted' }
  | { type: 'consulted' }
  | { type: 'officerRecovered'; role: OfficerRole; name: string }
  | { type: 'evidenceFound'; clues: ClueId[]; at: SystemId; undecoded: ClueId[] }
  | { type: 'nothingFound'; at: SystemId }
  | { type: 'missionResolved'; at: SystemId; outcome: 'clean' | 'messy' | 'disaster' }
  | { type: 'equipped'; role: OfficerRole; item: string }
  | { type: 'injurySpared'; role: OfficerRole; name: string }
  | { type: 'sceneOpened'; at: SystemId }
  | { type: 'sceneClosed'; at: SystemId; option: string }
  | { type: 'techStarted'; tech: TechId }
  | { type: 'techCompleted'; tech: TechId }
  | { type: 'componentRecovered'; component: ComponentKind; at: SystemId }
  | { type: 'contactMade'; at: SystemId; enemy: string }
  | {
      type: 'combatResolved'
      at: SystemId
      result: 'stood-down' | 'slipped' | 'toll-paid' | 'fled' | 'yielded' | 'driven-off' | 'destroyed-them'
    }
  | { type: 'shipDamaged'; amount: number; hull: number }
  | { type: 'shipDestroyed' }
  | { type: 'specialistJoined'; name: string; focus: Specialist['focus'] }
  | { type: 'officerImproved'; role: OfficerRole; name: string; skill: number }
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
