import type { OfficerRole } from '../crew/types.js'
import type { RegionId, SystemFeature } from '../worldgen/types.js'
import type { TechId } from '../research/tech.js'
import type { CombatRewards, EnemyClassId } from '../combat/ships.js'

/**
 * Encounters, the narrative layer.
 *
 * Every arrival can put someone — or something — on the viewscreen: traders,
 * envoys, derelicts with one lit cabin, patrols that want to see papers,
 * raiders that want everything else. An encounter is a small authored
 * dialogue graph: nodes of prose, choices with visible requirements, and
 * weighted outcomes resolved by the seeded dice. Some pay in fuel or morale;
 * the ones that matter pay in *intelligence* — data for the lab, standing
 * with the cultures that know things, and route clues handed straight to
 * the Nav Plot. Some open fire instead, and the argument continues on the
 * tactical display.
 *
 * Encounters are connected: an outcome can set flags that gate later
 * encounters, and can schedule a follow-up that hunts the ship down days
 * from now, wherever it happens to be.
 */

/** The cultures that keep score. Standing runs −3 (hunted) to +3 (favoured). */
export type CultureId = 'flotilla' | 'vekar' | 'ostrea' | 'custodian'

export const CULTURE_NAMES: Record<CultureId, string> = {
  flotilla: 'The Choral Flotillas',
  vekar: 'The Vekar Ascendancy',
  ostrea: 'The Ostrean Compact',
  custodian: 'The Gate Custodians',
}

export const CULTURE_NOTES: Record<CultureId, string> = {
  flotilla:
    'Nomad convoys who publish their charts as evolving songs. They owe nobody anything and remember everything.',
  vekar:
    'One side of the war. Disciplined, legalistic, convinced the gates are theirs by right of garrison.',
  ostrea:
    'The other side. Merchant admiralties fighting, they say, to keep the lanes open for everyone.',
  custodian:
    'The machines and orders that tend the ancient gate network. They do not negotiate. They audit.',
}

export type EncounterTag =
  | 'key'
  | 'contact'
  | 'event'
  | 'mission'
  | 'crew'
  | 'world'
  | 'derelict'
  | 'war'
  | 'bounty'
  | 'hostile'

export type Backdrop = 'space' | 'planet' | 'station' | 'derelict'

/** Conditions on where and when an encounter may fire. All optional, all AND. */
export interface EncounterWhen {
  /** Fire only in these regions. */
  regions?: RegionId[]
  /** Fire only where at least one of these features is present. */
  features?: SystemFeature[]
  /** true: only in claimed space. false: only in unclaimed space. */
  factionSpace?: boolean
  minDay?: number
  maxDay?: number
  /** Fire only once the war has intruded at least this far. */
  minWar?: number
  flagsAll?: string[]
  flagsNone?: string[]
}

/** How a run that reaches the gate can end. The Ending screen keys off this. */
export type EndingVariant = 'return' | 'coalition' | 'keeper' | 'lighthouse'

/**
 * A condition on a single result entry. When a choice resolves, entries
 * whose condition fails are dropped; if any surviving entry *has* a
 * condition, the unconditional entries drop too — the specific outcome
 * replaces the generic one, and the dice pick among what remains. This is
 * how the galaxy remembers: the same choice lands differently on a ship
 * that looted the paradise, or is hiding a defector from the inspectors.
 */
export interface ResultCond {
  flagsAll?: string[]
  flagsNone?: string[]
  standingAtLeast?: [CultureId, number]
  standingAtMost?: [CultureId, number]
  minWar?: number
  maxWar?: number
}

/**
 * A weighted result: `[weight, outcome]`, optionally `[weight, outcome,
 * condition]`. Every choice keeps at least one unconditional entry as the
 * fallback (the catalog tests enforce it).
 */
export type ResultEntry =
  | [number, EncounterOutcome]
  | [number, EncounterOutcome, ResultCond]

/** Everything a resolved choice can do to the game. All optional. */
export interface EncounterOutcome {
  /** The prose shown (and logged, first line) when this outcome lands. */
  text: string[]
  fuel?: number
  supplies?: number
  morale?: number
  /** Research data for the lab. */
  data?: number
  /** Hull repair (+) or damage (−) outside of combat. */
  hull?: number
  /** Route intelligence: this many uncollected clues handed to the plot. */
  shareClues?: number
  standing?: Partial<Record<CultureId, number>>
  /** War Pressure shift, clamped 0–10. */
  war?: number
  flagsSet?: string[]
  flagsClear?: string[]
  /** A seeded pick among fit non-captain officers is hurt. */
  injureOfficer?: boolean
  /** Generic crew lost, security first. */
  loseCrew?: number
  /** Days spent, through the same clock as everything else. */
  days?: number
  /** Battle stations: the encounter continues on the tactical display. */
  combat?: {
    enemy: EnemyClassId
    rewards?: CombatRewards
    /** If the captain withdraws, this encounter comes back for more. */
    withdrawFollowUp?: { id: string; days: [number, number] }
    /** A committed battle: the tactical display offers no withdrawal. */
    noWithdraw?: boolean
  }
  /** Schedule a connected encounter to find the ship in a few days. */
  followUp?: { id: string; days: [number, number] }
  /** Continue the dialogue at this node instead of ending the encounter. */
  goto?: string
  /** The run ends here, won: sets the 'home' outcome with this variant. */
  endRun?: EndingVariant
}

/** What a choice demands before it can be taken. Shown, never hidden. */
export interface ChoiceNeeds {
  tech?: TechId
  /** A fit officer of this role aboard. */
  officer?: OfficerRole
  standing?: [CultureId, number]
  flag?: string
}

/** What a choice costs up front, deducted before the dice roll. */
export interface ChoiceSpend {
  fuel?: number
  data?: number
  supplies?: number
}

export interface EncounterChoice {
  id: string
  label: string
  needs?: ChoiceNeeds
  spend?: ChoiceSpend
  /** Weighted outcomes; one is drawn by the seeded dice. */
  results: ResultEntry[]
}

export interface EncounterNode {
  /** Who is talking. Omitted → narration. */
  speaker?: string
  text: string[]
  choices: EncounterChoice[]
}

export interface EncounterDef {
  id: string
  title: string
  tag: EncounterTag
  /** Portrait asset path, if a character fronts the encounter. */
  portrait?: string
  backdrop: Backdrop
  culture?: CultureId
  /**
   * Random-selection weight. 0 means follow-up only: the encounter can be
   * scheduled by another encounter but never rolls on its own.
   */
  weight: number
  /** Fires at most once per campaign. Defaults to true. */
  unique?: boolean
  when?: EncounterWhen
  entry: string
  nodes: Record<string, EncounterNode>
}

/** The encounter currently holding the viewscreen. */
export interface ActiveEncounter {
  id: string
  node: string
  /** Set once a terminal choice resolves: the outcome prose, awaiting Continue. */
  outcome?: { text: string[] }
}

/** A connected encounter that has been scheduled but has not yet found the ship. */
export interface PendingFollowUp {
  id: string
  /** Earliest day it may fire. */
  notBefore: number
}
