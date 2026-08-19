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
  /** Full styled name, e.g. "Dr. Isabella Corelli". Cast per seed. */
  name: string
  /** Asset path of the officer's portrait. Absent only in pre-portrait saves. */
  portrait?: string
  /** 1–5. Founding officers start at 3; promoted replacements at 2. */
  skill: number
  /** Experience toward the next skill point; rises through use. */
  xp: number
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

/** Skill caps at 5; the next point costs three contributions per level held. */
export const SKILL_MAX = 5
export const xpToNextSkill = (skill: number): number => skill * 3

/**
 * A recruited specialist: a named, portraited person with one focus, hired
 * through a scene at a station. Their bonuses are flat and always on.
 */
export type SpecialistFocus = 'gunnery' | 'research' | 'comms'

export interface Specialist {
  name: string
  portrait?: string
  focus: SpecialistFocus
}

export const FOCUS_LABELS: Record<SpecialistFocus, string> = {
  gunnery: 'Gunner',
  research: 'Researcher',
  comms: 'Linguist',
}

export const FOCUS_EFFECTS: Record<SpecialistFocus, string> = {
  gunnery: '+3 damage per volley in ship combat',
  research: 'Research projects take a day less',
  comms: 'The bench decodes without spending a day',
}
