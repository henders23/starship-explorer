import type { GalaxyIndex } from '../worldgen/index-galaxy.js'
import type { SystemId } from '../worldgen/types.js'

/**
 * Travel and the fuel clock, M1.
 *
 * Fuel is the master clock (DESIGN §5.2). Every lane costs fuel by length,
 * long lanes disproportionately so; the tank refills at gas giants; the Long
 * Jump takes a fixed reserve on top of getting anywhere. There is no turn
 * limit — the pressure is that every detour, every retried mission and every
 * wrong commitment is paid for out of the same tank that gets you home.
 */

export const FUEL_MAX = 80
/** The Long Jump is a rift transit, not lane travel: flat, and steep. */
export const LONG_JUMP_RESERVE = 30
/** A clean or costly sweep of a derelict drains its tanks too. */
export const DERELICT_FUEL_SALVAGE = 8

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

/**
 * Cheapest fuel cost from one system to every system it can reach. The same
 * Dijkstra as `routeTo`, run once and kept — the chart needs the whole field
 * at once to show which stars the tank can still reach, and ninety separate
 * route plots per render is ninety times the work for the same answer.
 */
export function costsFrom(index: GalaxyIndex, from: SystemId): Map<SystemId, number> {
  const dist = new Map<SystemId, number>([[from, 0]])
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
    if (current === null) return dist
    done.add(current)

    for (const neighbour of index.neighbours(current)) {
      if (done.has(neighbour)) continue
      const candidate = best + laneCost(index, current, neighbour)
      if (candidate < (dist.get(neighbour) ?? Infinity)) dist.set(neighbour, candidate)
    }
  }
}

/** Gas giants are the pumps of this galaxy: free fuel, if you can get there. */
export function canScoop(index: GalaxyIndex, at: SystemId): boolean {
  return index.system(at).features.includes('gas-giant')
}

/** The cheapest single lane out of a system; Infinity at a dead end. */
export function cheapestLaneOut(index: GalaxyIndex, at: SystemId): number {
  let best = Infinity
  for (const neighbour of index.neighbours(at)) {
    best = Math.min(best, laneCost(index, at, neighbour))
  }
  return best
}
