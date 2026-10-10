import { describe, expect, it } from 'vitest'
import { createRng } from '../src/engine/rng/prng.js'
import { generateGalaxy } from '../src/engine/worldgen/galaxy.js'
import {
  generateExplorationWorld, initialExplorationState, locationsAt, reduceExploration,
} from '../src/engine/exploration/v2.js'

const galaxy = generateGalaxy(createRng('explore-galaxy'))
const world = generateExplorationWorld('explore-v2', galaxy)

describe('exploration-v2 foundation', () => {
  it('generates stable, unique location IDs for the same seed and galaxy', () => {
    expect(generateExplorationWorld('explore-v2', galaxy)).toEqual(world)
    expect(new Set(world.locations.map((site) => site.id)).size).toBe(world.locations.length)
    expect(world.locations.every((site) => galaxy.systems.some((system) => system.id === site.systemId))).toBe(true)
  })

  it('provides three distinct, independent systems for each mandatory science category', () => {
    for (const discovery of ['exotic-energy', 'spatial-observation', 'alien-propulsion']) {
      const sources = world.locations.filter((location) => location.discovery === discovery)
      expect(sources.length).toBeGreaterThanOrEqual(3)
      expect(new Set(sources.map((site) => site.systemId)).size).toBeGreaterThanOrEqual(3)
    }
  })

  it('supplies an accessible starting station and recoverable materials', () => {
    const sites = locationsAt(world, galaxy.start)
    expect(sites.some((site) => site.kind === 'station' && site.services.includes('refuel'))).toBe(true)
    expect(sites.some((site) => site.kind === 'resource-field' && (site.reward?.materials ?? 0) > 0)).toBe(true)
  })

  it('uses tiered scanning and rejects remote scans', () => {
    const starting = initialExplorationState()
    const remote = galaxy.systems.find((system) => system.id !== galaxy.start)!.id
    expect(reduceExploration(starting, world, { type: 'scan', systemId: remote, tier: 'deep' }, galaxy.start)).toBe(starting)
    const passive = reduceExploration(starting, world, { type: 'scan', systemId: galaxy.start, tier: 'passive' }, galaxy.start)
    expect(locationsAt(world, galaxy.start).filter((location) => location.scanTier === 'passive')
      .every((location) => passive.statuses[location.id] === 'detected')).toBe(true)
    expect(locationsAt(world, galaxy.start).filter((location) => location.scanTier === 'survey')
      .every((location) => !passive.statuses[location.id])).toBe(true)
  })

  it('enforces scan, investigate, resolve sequence and pays a reward once', () => {
    const site = locationsAt(world, galaxy.start).find((location) => location.kind === 'resource-field')!
    const initial = initialExplorationState()
    const resolve = { type: 'resolve' as const, locationId: site.id }
    expect(reduceExploration(initial, world, resolve, galaxy.start)).toBe(initial)
    const scanned = reduceExploration(initial, world, { type: 'scan', systemId: galaxy.start, tier: 'survey' }, galaxy.start)
    const investigated = reduceExploration(scanned, world, { type: 'investigate', locationId: site.id }, galaxy.start)
    const rewarded = reduceExploration(investigated, world, resolve, galaxy.start)
    expect(rewarded.materials).toBe(initial.materials + site.reward!.materials)
    expect(rewarded.statuses[site.id]).toBe('resolved')
    expect(rewarded.claimed).toContain(site.id)
    expect(reduceExploration(rewarded, world, resolve, galaxy.start)).toBe(rewarded)
    expect(JSON.parse(JSON.stringify(rewarded))).toEqual(rewarded)
  })

  it('does not modify state when attempting actions in a different system', () => {
    const initial = initialExplorationState()
    const site = world.locations.find((loc) => loc.systemId !== galaxy.start)!
    expect(reduceExploration(initial, world, { type: 'investigate', locationId: site.id }, galaxy.start)).toBe(initial)
  })
})
