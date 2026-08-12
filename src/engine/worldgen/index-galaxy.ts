import type { Galaxy, StarSystem, SystemId } from './types.js'

/**
 * Derived, read-only views over a `Galaxy`. Built once and passed around so
 * that constraint evaluation — which runs over every system many thousands of
 * times during generation — never recomputes graph distances.
 */
export class GalaxyIndex {
  readonly galaxy: Galaxy
  private readonly byId: Map<SystemId, StarSystem>
  private readonly ordinals: Map<SystemId, number>
  private readonly distances: Map<SystemId, Map<SystemId, number>>

  constructor(galaxy: Galaxy) {
    this.galaxy = galaxy
    this.byId = new Map(galaxy.systems.map((s) => [s.id, s]))
    this.ordinals = new Map(galaxy.systems.map((s, i) => [s.id, i]))
    this.distances = new Map()
  }

  /** Position of a system in `systems`, which is also its bit in a mask. */
  ordinal(id: SystemId): number {
    const ordinal = this.ordinals.get(id)
    if (ordinal === undefined) throw new Error(`Unknown system: ${id}`)
    return ordinal
  }

  get systems(): StarSystem[] {
    return this.galaxy.systems
  }

  system(id: SystemId): StarSystem {
    const system = this.byId.get(id)
    if (!system) throw new Error(`Unknown system: ${id}`)
    return system
  }

  has(id: SystemId): boolean {
    return this.byId.has(id)
  }

  neighbours(id: SystemId): SystemId[] {
    return this.galaxy.adjacency[id] ?? []
  }

  degree(id: SystemId): number {
    return this.neighbours(id).length
  }

  /** Jump distance in lanes traversed; `Infinity` if unreachable. */
  jumps(from: SystemId, to: SystemId): number {
    return this.distancesFrom(from).get(to) ?? Infinity
  }

  /** Breadth-first distances from a system to all others, memoised. */
  distancesFrom(origin: SystemId): Map<SystemId, number> {
    const cached = this.distances.get(origin)
    if (cached) return cached

    const dist = new Map<SystemId, number>([[origin, 0]])
    let frontier: SystemId[] = [origin]
    let depth = 0
    while (frontier.length > 0) {
      depth++
      const next: SystemId[] = []
      for (const current of frontier) {
        for (const neighbour of this.neighbours(current)) {
          if (!dist.has(neighbour)) {
            dist.set(neighbour, depth)
            next.push(neighbour)
          }
        }
      }
      frontier = next
    }

    this.distances.set(origin, dist)
    return dist
  }

  /** True when every system is reachable from every other. */
  isConnected(): boolean {
    if (this.systems.length === 0) return true
    const first = this.systems[0]!
    return this.distancesFrom(first.id).size === this.systems.length
  }

  factionName(id: string): string {
    return this.galaxy.factions.find((f) => f.id === id)?.name ?? 'an unknown power'
  }

  /** Systems in or adjacent to a faction's claimed space. */
  bordersFaction(systemId: SystemId, factionId: string): boolean {
    if (this.system(systemId).faction === factionId) return true
    return this.neighbours(systemId).some((n) => this.system(n).faction === factionId)
  }
}
