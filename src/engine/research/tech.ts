import type { ClueSourceKind } from '../mystery/types.js'
import type { GameState } from '../state/types.js'

/**
 * The research track: understanding, bought with the science officer's days.
 *
 * Projects cost days of a fit science officer's time and tick down as the
 * calendar advances — research runs in the background while the ship flies.
 * Understanding is gated by time and crew only, never by findable materials,
 * so no seed can strand a run unable to read the only evidence remaining.
 * The two rift projects are the exception by design: they are visible from
 * day one and locked until their components are found (R3).
 */

export type TechId =
  | 'comms-1'
  | 'comms-2'
  | 'rift-telemetry'
  | 'trauma-protocols'
  | 'rift-drive'
  | 'rift-shield'

export interface TechNode {
  id: TechId
  name: string
  /** Days of a fit science officer's time. */
  days: number
  requires: TechId[]
  /** Unbuildable until a later milestone unlocks it (R3: components). */
  locked?: boolean
  /** What it is, in the officer's voice — the pitch shown on the bench. */
  pitch: string
  /** The rule it changes, stated plainly. */
  effect: string
}

export const TECH_TREE: TechNode[] = [
  {
    id: 'comms-1',
    name: 'Translation Matrix I',
    days: 4,
    requires: [],
    pitch:
      '“Half of what this sector says to us, we cannot read. Give me four days and the wideband corpus, and I will have a working matrix for the trade pidgins.”',
    effect: 'Trader accounts and signal loops become decodable',
  },
  {
    id: 'comms-2',
    name: 'Translation Matrix II',
    days: 6,
    requires: ['comms-1'],
    pitch:
      '“The ruin scripts are older and stranger — the first matrix only circles them. Six more days, and inscriptions start meaning things.”',
    effect: 'Ruin inscriptions become decodable',
  },
  {
    id: 'rift-telemetry',
    name: 'Rift Telemetry',
    days: 4,
    requires: [],
    pitch:
      '“The rift is not random, Captain — it builds. Let me instrument the hull and I will tell you when the next surge is coming, to the day.”',
    effect: 'The next Rift Surge is forecast on the bridge',
  },
  {
    id: 'trauma-protocols',
    name: 'Trauma Protocols',
    days: 5,
    requires: [],
    pitch:
      '“The doctor and I have been comparing notes on rift-space wound care. Five days of lab time turns those notes into protocol.”',
    effect: 'Medbay stays run 4 days with the doctor, 8 without',
  },
  {
    id: 'rift-drive',
    name: 'Rift Drive',
    days: 8,
    requires: [],
    locked: true,
    pitch:
      '“The drive we have cannot make the return transit — nothing sold in this sector can. It will have to be built, and it starts with finding the pieces.”',
    effect: 'Required for the Long Jump · awaiting recovered components',
  },
  {
    id: 'rift-shield',
    name: 'Rift Shielding',
    days: 8,
    requires: [],
    locked: true,
    pitch:
      '“The anomaly took the hull apart at the seams on the way in, and we were lucky. Going back through unshielded is not a plan, it is a eulogy.”',
    effect: 'Required for the Long Jump · awaiting recovered components',
  },
]

export const TECH_BY_ID: Record<string, TechNode> = Object.fromEntries(
  TECH_TREE.map((node) => [node.id, node]),
)

/**
 * What each source kind demands of the translation matrix before the bench
 * can decode it. Human sources need nothing; the alien ones are the reason
 * comms research exists.
 */
const TRANSLATION_TIER: Partial<Record<ClueSourceKind, number>> = {
  'alien-trader': 1,
  'listening-post': 1,
  'ruins-tablet': 2,
}

export function requiredTier(kind: ClueSourceKind): number {
  return TRANSLATION_TIER[kind] ?? 0
}

/** The ship's current translation tier, from completed comms research. */
export function commsTier(state: GameState): number {
  if (state.tech.researched.includes('comms-2')) return 2
  if (state.tech.researched.includes('comms-1')) return 1
  return 0
}

export function isResearched(state: GameState, id: TechId): boolean {
  return state.tech.researched.includes(id)
}

/** Whether a project can be started right now (locks, prerequisites, dupes). */
export function canResearch(state: GameState, id: TechId): boolean {
  const node = TECH_BY_ID[id]
  if (!node || node.locked) return false
  if (state.tech.researched.includes(id)) return false
  if (state.tech.active?.id === id) return false
  return node.requires.every((req) => state.tech.researched.includes(req))
}
