import type { OfficerRole } from '../crew/types.js'
import type { SystemId } from '../worldgen/types.js'

/**
 * Scenes: the game's delivery mechanism.
 *
 * A scene is cast — deterministically, from the seed and the system — when
 * the ship arrives somewhere holding content. It plays as dialogue between
 * people the player knows (and sometimes a figure they don't), and ends in
 * options whose effects are ordinary reducer actions. A scene instance is
 * plain data: beats and options are resolved to strings at casting time, so
 * the whole thing serialises with the rest of the state and replays exactly.
 */

export interface SceneBeat {
  /** A roster role, 'figure' for the scene's outside party, null to narrate. */
  speaker: OfficerRole | 'figure' | null
  text: string
}

export type SceneOptionEffect =
  /** Walk-in evidence: collect it, spending days and (optionally) fuel. */
  | { kind: 'collect'; days: number; fuel?: number }
  /** A defended site: open away-team planning. The mission does the rest. */
  | { kind: 'mission' }
  /** Sign the specialist waiting here aboard. A day of orientation. */
  | { kind: 'recruit' }
  /** Stand off. The scene can be reopened from the system inspector. */
  | { kind: 'dismiss' }

export interface SceneOption {
  id: string
  label: string
  /** Shown under the label: what this costs or risks. */
  detail?: string
  /** A fit officer this option needs; shown, and enforced by the reducer. */
  needs?: OfficerRole
  effect: SceneOptionEffect
}

export interface SceneFigure {
  name: string
  /** What they are, e.g. "Trader" — shown where a station label would be. */
  label: string
  /** A face, when the figure has one (recruits do). */
  portrait?: string
}

export interface SceneInstance {
  at: SystemId
  /** Which template family produced this, for tests and debugging. */
  templateId: string
  figure: SceneFigure | null
  beats: SceneBeat[]
  options: SceneOption[]
}
