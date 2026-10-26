import type { GalaxyIndex } from '../worldgen/index-galaxy.js'
import type { SystemId } from '../worldgen/types.js'

/**
 * Lane travel: what a jump between neighbouring systems costs, and the
 * cheapest route across the lanes between any two systems.
 */

/**
 * Lane cost by length. The floor of 2 keeps even short hops from being free.
 *
 * The divisor is the exchange rate between light years and the tank, and it
 * is set against the shape of the sector: when the sector was reshaped into a
 * long wedge the crossing grew by about sixty per cent in jumps, so the rate
 * eased from 22 to 33 to keep a voyage across it costing what it always did.
 * Long lanes still cost disproportionately more than short ones.
 */
export function laneCost(index: GalaxyIndex, a: SystemId, b: SystemId): number {
  const from = index.system(a)
  const to = index.system(b)
  return Math.max(2, Math.ceil(Math.hypot(from.x - to.x, from.y - to.y) / 33))
}

export interface Route {
  /** Systems visited, including origin and destination. */
  path: SystemId[]
  /** Total fuel, summed over lanes. */
  cost: number
}

/**
 * Cheapest route by fuel over the lane graph. Dijkstra with deterministic
 * tie-breaking (by system id), so the same request always plots the same
 * course — routes are part of replayable state transitions.
 */
export function routeTo(index: GalaxyIndex, from: SystemId, to: SystemId): Route | null {
  if (from === to) return { path: [from], cost: 0 }

  const dist = new Map<SystemId, number>([[from, 0]])
  const prev = new Map<SystemId, SystemId>()
  const done = new Set<SystemId>()

  while (true) {
    let current: SystemId | null = null
    let best = Infinity
    for (const [id, d] of dist) {
      if (done.has(id)) continue
      if (d < best || (d === best && current !== null && id < current)) {
        best = d
        current = id
      }
    }
    if (current === null) return null
    if (current === to) break
    done.add(current)

    for (const neighbour of index.neighbours(current)) {
      if (done.has(neighbour)) continue
      const candidate = best + laneCost(index, current, neighbour)
      if (candidate < (dist.get(neighbour) ?? Infinity)) {
        dist.set(neighbour, candidate)
        prev.set(neighbour, current)
      }
    }
  }

  const path: SystemId[] = [to]
  while (path[0] !== from) path.unshift(prev.get(path[0]!)!)
  return { path, cost: dist.get(to)! }
}
