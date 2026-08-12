/**
 * The crew model, M3 scope.
 *
 * Four named characters — the captain (the player) and three department
 * officers — above two pools of generic personnel who are deliberately
 * numbers only: no names, no portraits, no individual stats. A generic
 * becomes a person the moment one is promoted to fill a dead officer's
 * chair, which is the game's continuity mechanic: the ship keeps a science
 * officer, but not *that* science officer, and the difference shows.
 */

export type OfficerRole = 'captain' | 'security' | 'science' | 'medical'

export type OfficerStatus = 'fit' | 'injured' | 'dead'

export interface Officer {
  role: OfficerRole
  /** Full styled name, e.g. "Dr. Ilsa Reven". Generated per seed. */
  name: string
  /** 1–5. Founding officers start at 3; promoted replacements at 2. */
  skill: number
  status: OfficerStatus
  /** For injured officers: fit again once missionsRun reaches this. */
  healedAfter?: number
  /** Promoted officers were generics once, and the epilogue remembers it. */
  origin: 'founding' | 'promoted'
}

/** The generic pools. Alive counts only — that is the whole model. */
export interface CrewPools {
  /** General crew. The promotion pool. */
  crew: number
  /** Security staff. Escort duty on away missions. */
  security: number
}

/** An away team, chosen per mission. */
export interface AwayTeam {
  /** The captain leads in person. A bonus, and a way to lose everything. */
  captain: boolean
  /** Department officers along, by role. */
  officers: Exclude<OfficerRole, 'captain'>[]
  /** Generic security escorts, 0–4. They absorb harm first. */
  escorts: number
  /** Generic crew hands, 0–4. Extra hands, and the next layer of harm. */
  hands: number
}

export const STARTING_POOLS: CrewPools = { crew: 12, security: 12 }

export const MAX_ESCORTS = 4
export const MAX_HANDS = 4
