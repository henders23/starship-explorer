import { describe, expect, it } from 'vitest'
import { VOYAGE_OPTIONS, voyageLengthOf } from '../src/engine/state/modes.js'
import { newGame } from '../src/engine/state/reducer.js'

/**
 * The short galaxy (R10): the first-run mode is the same game under the
 * same solvability contract, in roughly half the sky. Generation succeeding
 * IS the contract holding — generatePuzzle throws when it cannot prove the
 * puzzle — so these tests mostly pin size, determinism, and classification.
 */
describe('the short sky', () => {
  it('generates a proven-solvable galaxy of about half the standard size', () => {
    for (let i = 0; i < 6; i++) {
      const state = newGame(`modes-short-${i}`, VOYAGE_OPTIONS.short)
      expect(state.galaxy.systems.length).toBeGreaterThanOrEqual(40)
      expect(state.galaxy.systems.length).toBeLessThanOrEqual(60)
      expect(state.mystery.clues.length).toBeGreaterThan(0)
    }
  })

  it('is deterministic per seed, and a different sky from the standard one', () => {
    const a = newGame('modes-det', VOYAGE_OPTIONS.short)
    const b = newGame('modes-det', VOYAGE_OPTIONS.short)
    expect(a).toEqual(b)

    const standard = newGame('modes-det')
    expect(standard.galaxy.systems.length).not.toBe(a.galaxy.systems.length)
  })

  it('classifies a running galaxy back to its length', () => {
    const short = newGame('modes-classify', VOYAGE_OPTIONS.short)
    const standard = newGame('modes-classify')
    expect(voyageLengthOf(short.galaxy)).toBe('short')
    expect(voyageLengthOf(standard.galaxy)).toBe('standard')
  })
})
