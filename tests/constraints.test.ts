import { beforeAll, describe, expect, it } from 'vitest'
import {
  admits,
  admitsSystem,
  candidates,
  constraintKey,
  countCandidates,
  describeConstraint,
  satisfies,
} from '../src/engine/mystery/constraints.js'
import { findContradictions } from '../src/engine/mystery/deduce.js'
import { generatePuzzle, type Puzzle } from '../src/engine/mystery/generate.js'
import type { Constraint } from '../src/engine/mystery/types.js'

let puzzle: Puzzle

beforeAll(() => {
  puzzle = generatePuzzle('constraint-tests')
})

describe('constraint evaluation', () => {
  it('agrees between the predicate and the compiled bitmask', () => {
    const { index, mystery } = puzzle
    for (const clue of mystery.clues) {
      const byPredicate = index.systems
        .filter((s) => satisfies(clue.constraint, s, index))
        .map((s) => s.id)
      expect(candidates([clue.constraint], index)).toEqual(byPredicate)
      expect(admits(clue.constraint, index)).toBe(byPredicate.length)
      expect(countCandidates([clue.constraint], index)).toBe(byPredicate.length)
    }
  })

  it('intersects correctly across many constraints', () => {
    const { index, mystery } = puzzle
    const constraints = mystery.clues.slice(0, 6).map((c) => c.constraint)
    const expected = index.systems
      .filter((s) => constraints.every((c) => satisfies(c, s, index)))
      .map((s) => s.id)
    expect(candidates(constraints, index)).toEqual(expected)
    expect(countCandidates(constraints, index)).toBe(expected.length)
  })

  it('answers single-system membership consistently with the full list', () => {
    const { index, mystery } = puzzle
    const constraints = mystery.clues.slice(0, 5).map((c) => c.constraint)
    const list = new Set(candidates(constraints, index))
    for (const system of index.systems) {
      expect(admitsSystem(constraints, system.id, index)).toBe(list.has(system.id))
    }
  })

  it('gives structurally identical constraints the same key', () => {
    const a: Constraint = { kind: 'proximity', of: 'sys-004', op: 'within', jumps: 3 }
    const b: Constraint = { kind: 'proximity', of: 'sys-004', op: 'within', jumps: 3 }
    const c: Constraint = { kind: 'proximity', of: 'sys-004', op: 'within', jumps: 4 }
    expect(constraintKey(a)).toBe(constraintKey(b))
    expect(constraintKey(a)).not.toBe(constraintKey(c))
  })

  it('describes every constraint kind it can produce', () => {
    const { index, mystery } = puzzle
    const kinds = new Set(mystery.clues.map((c) => c.constraint.kind))
    expect(kinds.size).toBeGreaterThan(1)
    for (const clue of mystery.clues) {
      const text = describeConstraint(clue.constraint, index)
      expect(text.length).toBeGreaterThan(0)
      expect(text).not.toContain('undefined')
    }
  })

  it('never reports a system as lying in a direction from itself', () => {
    const { index } = puzzle
    for (const system of index.systems.slice(0, 20)) {
      for (const dir of ['coreward', 'rimward', 'spinward', 'trailing'] as const) {
        expect(satisfies({ kind: 'direction', of: system.id, dir }, system, index)).toBe(false)
      }
    }
  })
})

describe('contradiction detection', () => {
  it('reports only sets that really are unsatisfiable', () => {
    const { index, mystery } = puzzle
    for (const contradiction of findContradictions(mystery.clues, index, 3)) {
      const clues = contradiction.clues.map((id) => mystery.clues.find((c) => c.id === id)!)
      expect(countCandidates(clues.map((c) => c.constraint), index)).toBe(0)
    }
  })

  it('reports only minimal sets, so the player is pointed at the liar', () => {
    const { index, mystery } = puzzle
    for (const contradiction of findContradictions(mystery.clues, index, 3)) {
      const clues = contradiction.clues.map((id) => mystery.clues.find((c) => c.id === id)!)
      // Every proper subset must still be satisfiable, or this set is not minimal.
      for (let i = 0; i < clues.length; i++) {
        const subset = clues.filter((_, j) => j !== i)
        if (subset.length === 0) continue
        expect(countCandidates(subset.map((c) => c.constraint), index)).toBeGreaterThan(0)
      }
    }
  })

  it('finds no contradiction among the honest clues alone', () => {
    const { index, mystery } = puzzle
    const truths = mystery.clues.filter((c) => c.truth === 'true')
    expect(findContradictions(truths, index, 3)).toEqual([])
  })
})
