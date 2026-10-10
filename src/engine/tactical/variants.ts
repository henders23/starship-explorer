import { createRng } from '../rng/prng.js'
import type { Point } from './mission.js'
import type { OperationKind } from './operations.js'

export type DeckVariant = 1 | 2 | 3
export const siteVariant = (seed: string, locationId: string): DeckVariant => (1 + createRng(`${seed}:${locationId}:deck`).int(3)) as DeckVariant
export const DECK_NAMES: Record<OperationKind, [string, string, string]> = {
  rescue: ['Medical annex', 'Quarantine wing', 'Survey habitat'],
  sabotage: ['Relay hall', 'Signal gallery', 'Control spine'],
  salvage: ['Cargo hold', 'Freight interchange', 'Maintenance stores'],
}
export const DECK_NOTES: Record<OperationKind, [string, string, string]> = {
  rescue: ['Two sheltered wards share a central approach.', 'The wards open on opposite sides of a divided deck.', 'The survivors are separated at the far corners. Split the team or escort them one at a time.'],
  sabotage: ['An open approach leads to the guarded uplink.', 'The uplink sits across a reversed service gallery.', 'A service partition divides the approach. The uplink is beyond the eastern opening.'],
  salvage: ['Cargo gets progressively farther from the shuttle.', 'Cases are spread across the freight lanes. Keep the exit clear.', 'The last case is beyond the maintenance bays. The first can be secured from the near aisle.'],
}
export const VARIANT_LAYOUTS: Record<OperationKind, { walls: number[][]; cover: number[][]; objective: Point; targets: Point[] }> = {
  rescue: { walls:[[5,2],[6,2],[7,2],[5,7],[6,7],[7,7],[9,4],[9,5]],cover:[[4,4],[6,5],[8,3]],objective:{x:7,y:1},targets:[{x:7,y:1},{x:9,y:8}] },
  sabotage: { walls:[[6,0],[6,1],[6,2],[6,7],[6,8],[6,9],[9,1],[10,1],[9,8],[10,8]],cover:[[4,3],[7,5],[8,6]],objective:{x:10,y:4},targets:[] },
  salvage: { walls:[[6,0],[6,1],[6,2],[5,6],[6,6],[7,6],[9,6],[9,7]],cover:[[4,4],[7,3],[8,8]],objective:{x:5,y:2},targets:[{x:5,y:2},{x:8,y:4},{x:10,y:8}] },
}
/** Separate RNG stream; a retry keeps the same people and never changes combat rolls. */
export function survivorNames(seed: string, locationId: string): [string, string] {
  const first = ['Nadia', 'Emil', 'Sana', 'Ivo', 'Mei', 'Anwar', 'Ruth', 'Luca', 'Yara', 'Jules', 'Ada', 'Samir']
  const last = ['Sato', 'Osei', 'Varga', 'Navarro', 'Basu', 'Lind', 'Farouk', 'Silva', 'Kim', 'Adebayo', 'Singh', 'Keane']
  const rng = createRng(`${seed.replace(/:boarding:\d+$/, '')}:${locationId}:survivors`)
  const a = rng.int(first.length), b = rng.int(last.length)
  return [`Dr ${first[a]} ${last[b]}`, `${first[(a + 1 + rng.int(first.length - 1)) % first.length]} ${last[(b + 1 + rng.int(last.length - 1)) % last.length]}`]
}
