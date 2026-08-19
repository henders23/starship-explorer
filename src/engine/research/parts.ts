import type { Clue } from '../mystery/types.js'
import { createRng } from '../rng/prng.js'

/**
 * The technological track's raw material: rift-drive and rift-shield
 * components, placed at worldgen and carried home by the same scenes that
 * deliver evidence.
 *
 * Placement rides on clue-bearing systems on purpose: the mystery's
 * solvability contract already proves every clue site is reachable inside
 * the fuel budget, so components inherit reachability instead of needing
 * their own proof. Recovery happens wherever evidence collection happens —
 * a site that yields its clues yields its component — and a disaster that
 * recovers nothing leaves the component in place with the evidence.
 */

export type ComponentKind = 'engine' | 'shield'

export const PARTS_NEEDED: Record<ComponentKind, number> = { engine: 2, shield: 2 }

export const COMPONENT_LABELS: Record<ComponentKind, string> = {
  engine: 'drive core segment',
  shield: 'shield lattice segment',
}

/**
 * Deterministic placement: engine components prefer wreck and trade systems,
 * shield components prefer ruins and old installations, and no system holds
 * more than one unless the galaxy is too small to avoid it.
 */
export function placeComponents(
  seed: string,
  clues: readonly Clue[],
): Record<string, ComponentKind[]> {
  const kindsBySystem = new Map<string, Set<string>>()
  for (const clue of clues) {
    const set = kindsBySystem.get(clue.source.at) ?? new Set<string>()
    set.add(clue.source.kind)
    kindsBySystem.set(clue.source.at, set)
  }
  const systems = [...kindsBySystem.keys()].sort()
  const rng = createRng(`${seed}:parts`)
  const shuffled = rng.shuffle(systems)

  const prefers = (kind: ComponentKind, id: string): boolean => {
    const source = kindsBySystem.get(id)!
    return kind === 'engine'
      ? source.has('derelict-log') || source.has('alien-trader')
      : source.has('ruins-tablet') || source.has('listening-post')
  }

  const sites: Record<string, ComponentKind[]> = {}
  const queue: ComponentKind[] = ['engine', 'shield', 'engine', 'shield']
  for (const kind of queue) {
    const empty = (id: string) => !(id in sites)
    const pick =
      shuffled.find((id) => empty(id) && prefers(kind, id)) ??
      shuffled.find(empty) ??
      // Too few distinct systems: stack rather than strand the run.
      shuffled.reduce((a, b) => ((sites[a]?.length ?? 0) <= (sites[b]?.length ?? 0) ? a : b))
    sites[pick] = [...(sites[pick] ?? []), kind]
  }
  return sites
}
