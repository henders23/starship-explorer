import { describe, expect, it } from 'vitest'
import { countCandidates } from '../src/engine/mystery/constraints.js'
import {
  candidatesForAll,
  countCandidatesForAll,
  findContradictions,
} from '../src/engine/mystery/deduce.js'
import { generatePuzzle } from '../src/engine/mystery/generate.js'
import { proveMystery, smallestWitness } from '../src/engine/mystery/proof.js'
import { createRng } from '../src/engine/rng/prng.js'
import type { Clue } from '../src/engine/mystery/types.js'

/**
 * The single most valuable test in the project (DESIGN §12.3): every seed must
 * produce a puzzle that is solvable, non-trivial, falsifiable and affordable.
 * A generated puzzle that fails any of these is a run the player cannot win —
 * or can win without thinking — and no amount of downstream polish recovers it.
 *
 * Defaults to a few hundred seeds so it stays usable in a normal test run; set
 * MYSTERY_SEEDS=10000 for the full sweep before a release.
 */
const SEED_COUNT = Number(process.env.MYSTERY_SEEDS ?? 400)

describe(`the solvability contract holds across ${SEED_COUNT} seeds`, () => {
  const rng = createRng('contract-sweep')
  const seeds = Array.from({ length: SEED_COUNT }, () => `contract-${rng.int(1e9)}`)

  it('generates a contract-satisfying puzzle for every seed', () => {
    const failures: string[] = []

    for (const seed of seeds) {
      try {
        const puzzle = generatePuzzle(seed)

        // Re-prove independently rather than trusting the report the generator
        // handed back — this is what makes the test a check on the generator
        // and not merely a check on its own bookkeeping.
        const reproof = proveMystery(puzzle.mystery, puzzle.index)
        if (!reproof.ok) failures.push(`${seed}: ${reproof.failures.join('; ')}`)
      } catch (error) {
        failures.push(`${seed}: threw — ${(error as Error).message}`)
      }
    }

    expect(failures.slice(0, 10)).toEqual([])
    expect(failures).toHaveLength(0)
  })
})

describe('generated puzzle invariants', () => {
  const seeds = ['voyager', 'indefatigable', 'long-way-home', 'seed-4', 'seed-5']

  it('resolves the true clues to exactly the Gateway', () => {
    for (const seed of seeds) {
      const { index, mystery } = generatePuzzle(seed)
      const truths = mystery.clues.filter((c) => c.truth === 'true')
      expect(candidatesForAll(truths, index)).toEqual([mystery.gateway])
    }
  })

  it('never lets a small subset of clues give the answer away', () => {
    for (const seed of seeds) {
      const { index, mystery } = generatePuzzle(seed)
      const truths = mystery.clues.filter((c) => c.truth === 'true')
      for (let i = 0; i < truths.length; i++) {
        expect(countCandidatesForAll([truths[i]!], index)).toBeGreaterThanOrEqual(4)
        for (let j = i + 1; j < truths.length; j++) {
          expect(countCandidatesForAll([truths[i]!, truths[j]!], index)).toBeGreaterThanOrEqual(4)
        }
      }
    }
  })

  it('makes every lie catchable by cross-checking honest evidence', () => {
    for (const seed of seeds) {
      const { index, mystery } = generatePuzzle(seed)
      const truths = mystery.clues.filter((c) => c.truth === 'true')
      const lies = mystery.clues.filter((c) => c.truth === 'false')

      expect(lies.length).toBeGreaterThanOrEqual(2)
      for (const lie of lies) {
        // Excludes the Gateway (so it is genuinely misleading)…
        expect(candidatesForAll([lie], index)).not.toContain(mystery.gateway)
        // …and can be exposed with at most two honest clues.
        expect(smallestWitness(lie, truths, index, 2)).not.toBeNull()
      }
    }
  })

  it('points every lie at the decoy, so a deceived player lands somewhere plausible', () => {
    for (const seed of seeds) {
      const { index, mystery } = generatePuzzle(seed)
      const lies = mystery.clues.filter((c) => c.truth === 'false')
      expect(candidatesForAll(lies, index)).toContain(mystery.decoy)
      expect(mystery.decoy).not.toBe(mystery.gateway)
    }
  })

  it('only ever corroborates true clues', () => {
    for (const seed of seeds) {
      const { mystery } = generatePuzzle(seed)
      for (const clue of mystery.clues) {
        if (clue.corroborates.length === 0) continue
        expect(clue.truth).toBe('true')
        for (const otherId of clue.corroborates) {
          const other = mystery.clues.find((c) => c.id === otherId)!
          expect(other.truth).toBe('true')
          // Corroboration must be mutual and from an independent source.
          expect(other.corroborates).toContain(clue.id)
          expect(other.source.kind).not.toBe(clue.source.kind)
        }
      }
    }
  })

  it('gives the player something to read for every clue', () => {
    for (const seed of seeds) {
      const { mystery } = generatePuzzle(seed)
      for (const clue of mystery.clues) {
        expect(clue.prose).not.toContain('{claim}')
        expect(clue.prose.length).toBeGreaterThan(20)
        expect(clue.source.attribution.length).toBeGreaterThan(0)
        expect(clue.state).toBe('unfiled')
      }
    }
  })

  it('places every clue somewhere the ship can actually reach', () => {
    for (const seed of seeds) {
      const { index, mystery, galaxy } = generatePuzzle(seed)
      for (const clue of mystery.clues) {
        expect(index.has(clue.source.at)).toBe(true)
        expect(Number.isFinite(index.jumps(galaxy.start, clue.source.at))).toBe(true)
      }
    }
  })

  it('is deterministic: the same seed yields the identical puzzle', () => {
    for (const seed of seeds.slice(0, 3)) {
      const a = generatePuzzle(seed)
      const b = generatePuzzle(seed)
      expect(b.mystery).toEqual(a.mystery)
      expect(b.galaxy).toEqual(a.galaxy)
    }
  })
})

/**
 * A proof that always passes is worse than no proof, because it is trusted.
 * These deliberately corrupt a good puzzle and require the contract to notice.
 */
describe('the proof rejects broken puzzles', () => {
  const build = () => generatePuzzle('mutation-tests')

  it('rejects a puzzle whose clues do not isolate the Gateway', () => {
    const { index, mystery } = build()
    const truths = mystery.clues.filter((c) => c.truth === 'true')
    // Drop honest clues until the answer is ambiguous.
    const broken = {
      ...mystery,
      clues: [...truths.slice(0, 2), ...mystery.clues.filter((c) => c.truth === 'false')],
    }
    expect(countCandidatesForAll(broken.clues.filter((c) => c.truth === 'true'), index))
      .toBeGreaterThan(1)

    const report = proveMystery(broken, index)
    expect(report.ok).toBe(false)
    expect(report.failures.join(' ')).toContain('solvable')
  })

  it('rejects a puzzle where one clue gives the answer away', () => {
    const { index, mystery } = build()
    const giveaway: Clue = {
      ...mystery.clues[0]!,
      id: 'clue-giveaway',
      constraint: { kind: 'proximity', of: mystery.gateway, op: 'within', jumps: 0 },
      truth: 'true',
    }
    expect(countCandidates([giveaway.constraint], index)).toBe(1)

    const report = proveMystery({ ...mystery, clues: [...mystery.clues, giveaway] }, index)
    expect(report.ok).toBe(false)
    expect(report.failures.join(' ')).toContain('non-trivial')
  })

  it('rejects a puzzle with no lies in it', () => {
    const { index, mystery } = build()
    const honest = { ...mystery, clues: mystery.clues.filter((c) => c.truth === 'true') }
    const report = proveMystery(honest, index)
    expect(report.ok).toBe(false)
    expect(report.failures.join(' ')).toContain('falsifiable')
  })

  it('rejects a lie that cannot be caught', () => {
    const { index, mystery } = build()
    const truths = mystery.clues.filter((c) => c.truth === 'true')
    // A lie consistent with every honest clue leaves no contradiction to find.
    const uncatchable: Clue = {
      ...mystery.clues[0]!,
      id: 'clue-uncatchable',
      constraint: { kind: 'proximity', of: mystery.gateway, op: 'beyond', jumps: 0 },
      truth: 'false',
    }
    expect(smallestWitness(uncatchable, truths, index, 2)).toBeNull()

    const report = proveMystery(
      { ...mystery, clues: [...mystery.clues, uncatchable] },
      index,
    )
    expect(report.ok).toBe(false)
  })

  it('rejects a puzzle whose evidence sits somewhere unreachable', () => {
    const { index, mystery } = build()
    const stranded = {
      ...mystery,
      clues: mystery.clues.map((clue, i) =>
        i === 0 ? { ...clue, source: { ...clue.source, at: 'sys-does-not-exist' } } : clue,
      ),
    }
    const report = proveMystery(stranded, index)
    expect(report.ok).toBe(false)
    expect(report.failures.join(' ')).toContain('reachable')
  })
})

describe('the Nav Plot exposes the liars', () => {
  it('surfaces a contradiction for a player who trusts everything', () => {
    for (const seed of ['voyager', 'indefatigable', 'long-way-home']) {
      const { index, mystery } = generatePuzzle(seed)
      const contradictions = findContradictions(mystery.clues, index, 3)
      expect(contradictions.length).toBeGreaterThan(0)

      // Every reported conflict must implicate at least one actual lie, or the
      // detector would be sending the player after honest witnesses.
      for (const contradiction of contradictions) {
        const involved = contradiction.clues.map((id) => mystery.clues.find((c) => c.id === id)!)
        expect(involved.some((c) => c.truth === 'false')).toBe(true)
      }
    }
  })
})
