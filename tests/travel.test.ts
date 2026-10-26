import { describe, expect, it } from 'vitest'
import { createRng } from '../src/engine/rng/prng.js'
import { laneCost, routeTo } from '../src/engine/travel/travel.js'
import { generateGalaxy } from '../src/engine/worldgen/galaxy.js'
import { GalaxyIndex } from '../src/engine/worldgen/index-galaxy.js'

const galaxy = generateGalaxy(createRng('travel-tests'))
const index = new GalaxyIndex(galaxy)

describe('routes', () => {
  it('plots the same route for the same request, and prices it as its lanes', () => {
    const target = index.systems[index.systems.length - 1]!.id
    const a = routeTo(index, galaxy.start, target)
    const b = routeTo(index, galaxy.start, target)
    expect(a).toEqual(b)
    expect(a).not.toBeNull()

    let total = 0
    for (let i = 1; i < a!.path.length; i++) {
      // Every step must be an actual lane, and the cost must be their sum.
      expect(index.neighbours(a!.path[i - 1]!)).toContain(a!.path[i]!)
      total += laneCost(index, a!.path[i - 1]!, a!.path[i]!)
    }
    expect(a!.cost).toBe(total)
  })

  it('never plots a costlier route than a direct lane', () => {
    for (const neighbour of index.neighbours(galaxy.start)) {
      const route = routeTo(index, galaxy.start, neighbour)!
      expect(route.cost).toBeLessThanOrEqual(laneCost(index, galaxy.start, neighbour))
    }
  })
})
