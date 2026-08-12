import { describe, expect, it } from 'vitest'
import { createRng, hashString } from '../src/engine/rng/prng.js'

describe('seeded rng', () => {
  it('produces the same stream for the same seed', () => {
    const a = createRng('indefatigable')
    const b = createRng('indefatigable')
    const drawsA = Array.from({ length: 64 }, () => a.next())
    const drawsB = Array.from({ length: 64 }, () => b.next())
    expect(drawsA).toEqual(drawsB)
  })

  it('produces different streams for different seeds', () => {
    const a = Array.from({ length: 32 }, createRng('alpha').next)
    const b = Array.from({ length: 32 }, createRng('beta').next)
    expect(a).not.toEqual(b)
  })

  it('accepts numeric and string seeds interchangeably', () => {
    expect(createRng(hashString('x')).next()).toBe(createRng('x').next())
  })

  it('stays within bounds', () => {
    const rng = createRng('bounds')
    for (let i = 0; i < 5000; i++) {
      expect(rng.next()).toBeGreaterThanOrEqual(0)
      expect(rng.next()).toBeLessThan(1)
      expect(rng.int(7)).toBeLessThan(7)
      const r = rng.range(3, 9)
      expect(r).toBeGreaterThanOrEqual(3)
      expect(r).toBeLessThanOrEqual(9)
    }
  })

  it('shuffles without dropping or duplicating items', () => {
    const rng = createRng('shuffle')
    const source = Array.from({ length: 50 }, (_, i) => i)
    const shuffled = rng.shuffle(source)
    expect(shuffled).toHaveLength(source.length)
    expect([...shuffled].sort((a, b) => a - b)).toEqual(source)
    expect(source[0]).toBe(0) // input untouched
  })

  it('forks deterministically from the same seed and position', () => {
    const first = createRng('fork')
    const second = createRng('fork')
    first.next()
    second.next()
    expect(first.fork('combat').next()).toBe(second.fork('combat').next())
  })

  it('forks different streams for different labels', () => {
    const parent = createRng('fork')
    const combat = parent.fork('combat').next()
    const replay = createRng('fork')
    const worldgen = replay.fork('worldgen').next()
    expect(combat).not.toBe(worldgen)
  })

  it('respects weights', () => {
    const rng = createRng('weights')
    let heads = 0
    for (let i = 0; i < 10_000; i++) {
      if (rng.weighted([['h', 9], ['t', 1]] as const) === 'h') heads++
    }
    expect(heads).toBeGreaterThan(8_500)
    expect(heads).toBeLessThan(9_500)
  })
})
