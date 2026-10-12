import { describe, expect, it } from 'vitest'
import { createCampaign, reduceCampaign, travelCost } from '../src/engine/exploration/campaign.js'
import type { Campaign } from '../src/engine/exploration/campaign.js'
import { courseFinder, followCourse, plotCourse } from '../src/engine/exploration/navigation.js'
import { loadExploration, saveExploration } from '../src/ui/exploration-save.js'

function mem() { let raw: string | null = null; return { getItem: () => raw, setItem: (_: string, s: string) => { raw = s }, removeItem: () => { raw = null } } }
function hops(s: Campaign) {
  const depth = new Map([[s.at, 0]]), queue = [s.at]
  for (let i = 0; i < queue.length; i++) for (const n of s.galaxy.adjacency[queue[i]!] ?? []) if (!depth.has(n)) { depth.set(n, depth.get(queue[i]!)! + 1); queue.push(n) }
  return depth
}
/** Least fuel among the fewest-jump lane routes, by dynamic programming over jump layers. */
function cheapestShortest(s: Campaign) {
  const depth = hops(s), best = new Map([[s.at, 0]])
  for (const id of [...depth.keys()].sort((a, b) => depth.get(a)! - depth.get(b)!)) for (const n of s.galaxy.adjacency[id] ?? [])
    if (depth.get(n) === depth.get(id)! + 1) best.set(n, Math.min(best.get(n) ?? Infinity, best.get(id)! + travelCost(s, n, id)!))
  return best
}
function farthest(s: Campaign) { const depth = hops(s); return [...depth.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]! }
const withResearch = (s: Campaign, ...completed: Campaign['research']['completed']) => ({ ...s, research: { ...s.research, completed: [...s.research.completed, ...completed] } })

describe('plotted courses', () => {
  it('plots the fewest jumps, then the least fuel, along legal lanes to every system', () => {
    const s = createCampaign('nav-plot'), find = courseFinder(s), depth = hops(s), cheapest = cheapestShortest(s)
    for (const system of s.galaxy.systems) {
      const course = find(system.id)!
      expect(course.path[0]).toBe(s.at); expect(course.path.at(-1)).toBe(system.id)
      expect(course.path.length - 1).toBe(depth.get(system.id))
      expect(course.fuel).toBe(cheapest.get(system.id))
      course.path.slice(1).forEach((id, i) => expect(s.galaxy.adjacency[course.path[i]!]).toContain(id))
    }
    expect(plotCourse(s, s.at)).toEqual({ path: [s.at], fuel: 0 })
    expect(plotCourse(s, 'no-such-system')).toBeNull()
  })
  it('uses two-lane slipstream jumps once researched', () => {
    const s = createCampaign('nav-slipstream'), [target, lanes] = farthest(s)
    const course = plotCourse(withResearch(s, 'slipstream'), target)!
    expect(course.path.length - 1).toBe(Math.ceil(lanes / 2))
  })
})

describe('following a course', () => {
  it('flies the whole route as ordinary travel orders that replay exactly', () => {
    const s = createCampaign('nav-follow'), [target, lanes] = farthest(s), course = plotCourse(s, target)!
    expect(lanes).toBeGreaterThan(3)
    const result = followCourse(s, target)
    expect(result.stop).toBe('arrived')
    expect(result.state.at).toBe(target)
    expect(result.state.day).toBe(s.day + lanes)
    expect(result.state.fuel).toBe(s.fuel - course.fuel)
    expect(result.state.actions).toEqual(course.path.slice(1).map((systemId) => ({ type: 'travel', systemId })))
    expect(result.state.visited).toEqual(expect.arrayContaining(course.path))
    const storage = mem(); saveExploration(result.state, storage)
    expect(loadExploration(storage)).toEqual({ campaign: result.state, error: null })
  })
  it('pauses where research completes so the captain can choose what comes next', () => {
    let s = reduceCampaign(createCampaign('nav-research'), { type: 'research', project: 'drive-diagnostics' })
    const [target, lanes] = farthest(s)
    expect(lanes).toBeGreaterThan(4)
    const result = followCourse(s, target)
    expect(result.stop).toBe('research')
    expect(result.state.research.completed).toContain('drive-diagnostics')
    expect(result.state.at).toBe(plotCourse(s, target)!.path[4])
    s = followCourse(result.state, target).state
    expect(s.at).toBe(target)
  })
  it('stops before a jump it cannot afford and explains why', () => {
    const s = createCampaign('nav-fuel'), [target] = farthest(s), course = plotCourse(s, target)!
    const first = travelCost(s, course.path[1]!)!
    const low = { ...s, fuel: first }
    const result = followCourse(low, target)
    expect(result.stop).toBe('blocked')
    expect(result.reason).toMatch(/fuel/)
    expect(result.state.at).toBe(course.path[1])
    expect(followCourse(s, s.at)).toMatchObject({ stop: 'blocked', state: s })
  })
})
