import { createRng } from '../rng/prng.js'
import type { Galaxy } from '../worldgen/types.js'
import type { ExplorationWorld } from './v2.js'

/** Optional journal state. Existing voyages have no arc field until opt-in. */
export type RelayStage = 'accepted' | 'relay-resolved' | 'complete'
export type RelayApproach = 'repair' | 'local-copy'
export interface RelayArc {
  version: 1
  id: 'long-relay'
  originStationId: string
  destinationStationId: string
  stage: RelayStage
  approach: RelayApproach | null
  records: { beatId: 'start' | 'relay' | 'reply'; choiceId: string; day: number }[]
}
export type RelayAction =
  | { type: 'start-arc'; arcId: 'long-relay'; locationId: string }
  | { type: 'arc-choice'; arcId: 'long-relay'; beatId: 'relay'; choiceId: RelayApproach }
  | { type: 'arc-choice'; arcId: 'long-relay'; beatId: 'reply'; choiceId: 'acknowledge' }

/** Stable lane count, independent of exploration scan state or combat RNG. */
export function relayLaneDistance(galaxy: Galaxy, from: string, to: string): number {
  if (from === to) return 0
  const seen = new Set([from])
  const queue: {id: string; distance: number}[] = [{id:from, distance:0}]
  for (let i=0; i<queue.length; i++) {
    const current=queue[i]!
    for (const neighbour of galaxy.adjacency[current.id] ?? []) {
      if (seen.has(neighbour)) continue
      if (neighbour === to) return current.distance+1
      seen.add(neighbour)
      queue.push({id:neighbour,distance:current.distance+1})
    }
  }
  return Infinity
}

/** Choose a reachable station in a different system, favouring a nearby hop.
 * One isolated selector never advances world or encounter generators. */
export function relayDestination(galaxy: Galaxy, world: ExplorationWorld, seed: string, originStationId: string): string | null {
  const origin=world.locations.find((s)=>s.id===originStationId && s.kind==='station')
  if (!origin) return null
  const choices=world.locations.filter((s)=>s.kind==='station' && s.systemId!==origin.systemId)
    .map((s)=>({site:s,distance:relayLaneDistance(galaxy,origin.systemId,s.systemId)}))
    .filter((c)=>Number.isFinite(c.distance)).sort((a,b)=>a.distance-b.distance || a.site.id.localeCompare(b.site.id))
  if (!choices.length) return null
  // Prefer one to three lanes. Fall back gracefully in sparse galaxies.
  const short=choices.filter((c)=>c.distance<=3)
  const pool=short.length?short:choices.filter((c)=>c.distance===choices[0]!.distance)
  return pool[createRng(seed+':'+originStationId+':long-relay-v1').int(pool.length)]!.site.id
}

export const RELAY_DIALOGUE = {
  start: {
    speaker: 'Edda Sol · station keeper',
    heading: 'An answer is waiting',
    text: 'Edda taps the edge of the message terminal. “One of those letters found its people. But the reply cannot reach the next relay: the line has been down for months. Most captains say they will carry it when they come this way again. You actually came this way.”',
    followup: '“It is a long errand for one message,” she says. “But Tarek Sen will be expecting it. I promised him someone would answer.”',
  },
  relay: {
    speaker: 'Tarek Sen · survey technician',
    heading: 'The broken link',
    text: 'Tarek reads the letter twice before looking up. “I thought the message had been lost with everyone else.” Outside his workshop, the repeater stands dark, its power bus damaged. He has a personal reply ready, but his neighbours are still cut off from the wider network.',
    followup: '“You can repair that relay,” he says. “Give me a minute before you put my answer on it. Or carry this copy yourself, and let the rest wait until we have the parts.”',
  },
  reply: {
    speaker: 'Edda Sol · station keeper',
    heading: 'What came back',
    repair: 'Edda sees the restored link before she sees the Lodestar. “The weather station has come back online. And the school. Tarek sent a few words for the family — not many, but enough.” She pauses. “You mended more than the message.”',
    'local-copy': 'Edda opens the sealed private reply. “Tarek was right not to trust that damaged network. His family can read these words without wondering who else saw them.” She keeps the letter in her hands. “The relay is still dark. At least we know what needs doing.”',
  },
} as const

export function relaySummary(arc: RelayArc): string {
  if (arc.stage==='accepted') return 'A private message is waiting at another station. The relay there is damaged.'
  if (arc.stage==='relay-resolved') return arc.approach==='repair'
    ? 'The shared relay is restored. Carry Tarek’s reply back to Edda.'
    : 'Tarek’s private copy is aboard. Carry it back to Edda; the wider relay remains damaged.'
  return arc.approach==='repair'
    ? 'The line is restored, and Tarek’s answer reached its family.'
    : 'Tarek’s private reply reached its family; the shared relay still needs repair.'
}
