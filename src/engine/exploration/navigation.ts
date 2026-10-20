import { GalaxyIndex } from '../worldgen/index-galaxy.js'
import type { SystemId } from '../worldgen/types.js'
import { actionLock, hasTech, reduceCampaign, travelCost, travelOrder } from './campaign.js'
import type { Campaign, CampaignAction } from './campaign.js'

/** A plotted course: every system it stops at, origin first, and the fuel it needs. */
export interface Course { path: SystemId[]; fuel: number }

/**
 * Courses from the ship's position to every reachable system, using the
 * drive as fitted now: single lanes, or two-lane slipstream jumps once
 * researched. Each jump is one campaign day, so the fewest jumps wins, then
 * the least fuel; ties break by system id so a request always plots the same
 * course. Plotting is advice for the UI; only legal travel orders move the ship.
 */
export function courseFinder(state: Campaign): (target: SystemId) => Course | null {
  const index = new GalaxyIndex(state.galaxy)
  const slipstream = hasTech(state, 'slipstream')
  const reach = (from: SystemId) => {
    const near = state.galaxy.adjacency[from] ?? []
    return slipstream ? [...new Set([...near, ...near.flatMap((mid) => state.galaxy.adjacency[mid] ?? [])])] : near
  }
  // Jumps dominate fuel: no route here needs anywhere near 10,000 fuel.
  const score = new Map<SystemId, number>([[state.at, 0]])
  const fuel = new Map<SystemId, number>([[state.at, 0]])
  const previous = new Map<SystemId, SystemId>()
  const done = new Set<SystemId>()
  while (true) {
    let current: SystemId | null = null, best = Infinity
    for (const [id, value] of score) if (!done.has(id) && (value < best || (value === best && current !== null && id < current))) { current = id; best = value }
    if (current === null) break
    done.add(current)
    for (const next of reach(current)) {
      if (done.has(next)) continue
      const cost = travelCost(state, next, current, index)
      if (cost === null) continue
      const candidate = best + 10_000 + cost
      if (candidate < (score.get(next) ?? Infinity)) { score.set(next, candidate); fuel.set(next, fuel.get(current)! + cost); previous.set(next, current) }
    }
  }
  return (target) => {
    if (!score.has(target)) return null
    const path = [target]
    while (path[0] !== state.at) path.unshift(previous.get(path[0]!)!)
    return { path, fuel: fuel.get(target)! }
  }
}

export const plotCourse = (state: Campaign, target: SystemId) => courseFinder(state)(target)

export type CourseStop = 'arrived' | 'research' | 'contact' | 'blocked'

/**
 * Follows the plotted course one legal travel order at a time, exactly as if
 * each jump had been ordered by hand. It stops early when research completes,
 * so the captain sees the result and can choose what the laboratory does next,
 * when a hostile intercepts the ship, or when a jump is refused (for example,
 * not enough fuel).
 */
export function followCourse(state: Campaign, target: SystemId, hazards = true): { state: Campaign; stop: CourseStop; reason: string | null } {
  const course = plotCourse(state, target)
  if (!course || course.path.length < 2) return { state, stop: 'blocked', reason: course ? 'The Ithaca is already here' : 'No course with the current drive' }
  let s = state
  for (const systemId of course.path.slice(1)) {
    const order: CampaignAction = hazards ? travelOrder(systemId) : { type: 'travel', systemId }
    const reason = actionLock(s, order)
    if (reason) return { state: s, stop: 'blocked', reason }
    const completed = s.research.completed.length
    s = reduceCampaign(s, order)
    if (s.shipBattle) return { state: s, stop: 'contact', reason: null }
    if (s.at !== target && s.research.completed.length > completed) return { state: s, stop: 'research', reason: null }
  }
  return { state: s, stop: 'arrived', reason: null }
}
