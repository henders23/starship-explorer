import { createRng } from '../rng/prng.js'
import type { Point } from './mission.js'
import type { OperationKind } from './operations.js'

export type DeckVariant = 1 | 2 | 3 | 4 | 5
export const siteVariant = (seed: string, locationId: string): DeckVariant => (1 + createRng(`${seed}:${locationId}:deck`).int(5)) as DeckVariant
export const DECK_NAMES: Record<OperationKind, [string,string,string,string,string]> = {
  rescue: ['Medical annex', 'Quarantine wing', 'Survey habitat', 'Isolation ward', 'Evacuation theatre'],
  sabotage: ['Relay hall', 'Signal gallery', 'Control spine', 'Power junction', 'Broadcast array'],
  salvage: ['Cargo hold', 'Freight interchange', 'Maintenance stores', 'Ore refinery', 'Coolant loading dock'],
}
export const DECK_NOTES: Record<OperationKind, [string, string, string]> = {
  rescue: ['Two sheltered wards share a central approach.', 'The wards open on opposite sides of a divided deck.', 'The survivors are separated at the far corners. Split the team or escort them one at a time.', 'Four isolation cells surround a service spine. Find the survivors beyond the shutters.', 'A large evacuation bay has crossing aisles and exposed medical stations.'],
  sabotage: ['An open approach leads to the guarded uplink.', 'The uplink sits across a reversed service gallery.', 'A service partition divides the approach. The uplink is beyond the eastern opening.', 'The power junction has offset machinery and a heavily guarded centre.', 'The broadcast array wraps around multiple exposed access aisles.'],
  salvage: ['Cargo gets progressively farther from the shuttle.', 'Cases are spread across the freight lanes. Keep the exit clear.', 'The last case is beyond the maintenance bays. The first can be secured from the near aisle.', 'Refinery machinery narrows the paths to three valuable cases.', 'The coolant bay has long exposed avenues and staggered blast shields.'],
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

/** Two new authored floor plans per contract; never overwrite legacy plans 1-3. */
export const EXTENDED_LAYOUTS: Record<OperationKind, [{ walls:number[][];cover:number[][];objective:Point;targets:Point[] },{ walls:number[][];cover:number[][];objective:Point;targets:Point[] }]> = {
 rescue:[
  {walls:[[4,1],[4,2],[4,7],[4,8],[7,1],[7,2],[7,7],[7,8],[9,5]],cover:[[3,4],[5,5],[8,4]],objective:{x:8,y:3},targets:[{x:8,y:3},{x:9,y:6}]},
  {walls:[[4,2],[4,3],[7,6],[7,7],[9,1],[9,2],[5,8]],cover:[[3,6],[6,3],[8,5]],objective:{x:7,y:3},targets:[{x:7,y:3},{x:9,y:7}]},
 ],
 sabotage:[
  {walls:[[4,1],[4,2],[5,7],[6,7],[8,1],[8,2],[8,7],[8,8]],cover:[[4,5],[6,3],[7,6]],objective:{x:10,y:5},targets:[]},
  {walls:[[3,1],[3,2],[6,2],[6,3],[9,7],[9,8],[7,6]],cover:[[4,4],[7,4],[8,6]],objective:{x:10,y:4},targets:[]},
 ],
 salvage:[
  {walls:[[4,1],[4,2],[7,5],[7,6],[9,2],[9,3]],cover:[[3,5],[6,4],[8,7]],objective:{x:5,y:3},targets:[{x:5,y:3},{x:8,y:4},{x:10,y:7}]},
  {walls:[[5,2],[5,3],[8,4],[8,5],[10,7],[10,8]],cover:[[4,6],[6,3],[9,5]],objective:{x:4,y:4},targets:[{x:4,y:4},{x:7,y:3},{x:10,y:5}]},
 ],
}
