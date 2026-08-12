import { createRng } from '../rng/prng.js'
import type { GalaxyIndex } from '../worldgen/index-galaxy.js'
import type { SystemId } from '../worldgen/types.js'
import {
  admitsFor,
  candidatesForAll,
  cluesToNarrow,
  countCandidatesForAll,
  greedyMinimalSubset,
} from './deduce.js'
import { constraintKey } from './constraints.js'
import type { Clue, Mystery } from './types.js'

/**
 * The solvability contract from DESIGN §4.2.
 *
 * Worldgen is cheap and broken runs are not, so the generator proves each
 * puzzle against these before handing it over, and rerolls if it cannot.
 * `proveMystery` is deliberately independent of the code that builds the
 * puzzle: it re-derives everything from the clues and the galaxy, so a bug in
 * the generator shows up as a failed proof rather than a bad game.
 */
export interface ProofOptions {
  /** No subset of true clues this size or smaller may be too decisive. */
  maxSubsetSize: number
  /** …where "too decisive" means leaving fewer than this many candidates. */
  minCandidatesForSubset: number
  /** A shortlist means this many candidates or fewer. */
  shortlistSize: number
  /** Mean clues a randomly-ordered player needs to reach a shortlist. */
  maxMeanCluesToShortlist: number
  /** Worst case over sampled orderings. */
  maxWorstCluesToShortlist: number
  /** How many random orderings to sample when measuring the above. */
  orderingSamples: number
  minFalseClues: number
  maxFalseClues: number
  /** A lie must be catchable by combining it with at most this many truths. */
  maxDetectionWitness: number
  /** A decoy must look plausible: it satisfies at least this fraction of truths. */
  minDecoyPlausibility: number
  /** True clues available, as a multiple of the minimum needed to solve. */
  minRedundancy: number
  /** Jumps a greedy evidence-gathering tour may take before it is unaffordable. */
  maxTourJumps: number
}

export const DEFAULT_PROOF_OPTIONS: ProofOptions = {
  maxSubsetSize: 3,
  minCandidatesForSubset: 4,
  shortlistSize: 3,
  maxMeanCluesToShortlist: 8,
  maxWorstCluesToShortlist: 12,
  orderingSamples: 64,
  minFalseClues: 2,
  maxFalseClues: 4,
  maxDetectionWitness: 2,
  minDecoyPlausibility: 0.5,
  minRedundancy: 1.6,
  maxTourJumps: 60,
}

export interface ProofStats {
  systemCount: number
  trueClueCount: number
  falseClueCount: number
  /** Candidates admitted by the full set of true clues. Must be exactly 1. */
  finalCandidates: number
  /** Smallest ≤maxSubsetSize subset's candidate count, across all such subsets. */
  tightestSmallSubset: number
  meanCluesToShortlist: number
  worstCluesToShortlist: number
  greedyMinimumClues: number
  redundancy: number
  decoyPlausibility: number
  /** Size of the smallest set of truths that exposes each lie. */
  detectionWitnessSizes: number[]
  tourJumps: number
}

export interface ProofReport {
  ok: boolean
  failures: string[]
  stats: ProofStats
}

/**
 * A stable identity for a puzzle, used to seed the proof's own sampling.
 *
 * The "not a slog" clause measures how many clues a player needs when they
 * arrive in an arbitrary order, which means sampling orderings. If that
 * sampling used caller-supplied randomness the proof would not be a property
 * of the puzzle at all: the generator could accept a puzzle that an
 * independent re-prover then rejects, and the contract would mean nothing.
 * Deriving the stream from the puzzle's own content makes `proveMystery` a
 * pure function of what it is proving.
 */
function proofSeed(mystery: Mystery): string {
  const clues = mystery.clues
    .map((c) => `${c.id}:${c.truth}:${constraintKey(c.constraint)}`)
    .sort()
    .join('|')
  return `proof:${mystery.gateway}:${mystery.decoy}:${clues}`
}

export function proveMystery(
  mystery: Mystery,
  index: GalaxyIndex,
  options: Partial<ProofOptions> = {},
): ProofReport {
  const opts = { ...DEFAULT_PROOF_OPTIONS, ...options }
  const rng = createRng(proofSeed(mystery))
  const failures: string[] = []

  const trueClues = mystery.clues.filter((c) => c.truth === 'true')
  const falseClues = mystery.clues.filter((c) => c.truth === 'false')

  // ---- Solvable ---------------------------------------------------------
  const finalSet = candidatesForAll(trueClues, index)
  if (finalSet.length !== 1 || finalSet[0] !== mystery.gateway) {
    failures.push(
      `solvable: the true clues admit ${finalSet.length} systems (want exactly the Gateway)`,
    )
  }

  // ---- Non-trivial ------------------------------------------------------
  const tightest = tightestSubset(trueClues, index, opts.maxSubsetSize)
  if (tightest < opts.minCandidatesForSubset) {
    failures.push(
      `non-trivial: some subset of ≤${opts.maxSubsetSize} clues narrows to ${tightest} ` +
        `(want ≥${opts.minCandidatesForSubset})`,
    )
  }

  // ---- Not a slog -------------------------------------------------------
  const lengths: number[] = []
  for (let i = 0; i < opts.orderingSamples; i++) {
    lengths.push(cluesToNarrow(rng.shuffle(trueClues), index, opts.shortlistSize))
  }
  const finite = lengths.filter(Number.isFinite)
  const mean = finite.length > 0 ? finite.reduce((a, b) => a + b, 0) / finite.length : Infinity
  const worst = lengths.reduce((a, b) => Math.max(a, b), 0)
  if (finite.length < lengths.length) {
    failures.push('not-a-slog: some clue orderings never reach a shortlist')
  } else if (mean > opts.maxMeanCluesToShortlist) {
    failures.push(
      `not-a-slog: ${mean.toFixed(1)} clues needed on average to reach a shortlist ` +
        `(want ≤${opts.maxMeanCluesToShortlist})`,
    )
  } else if (worst > opts.maxWorstCluesToShortlist) {
    failures.push(
      `not-a-slog: worst ordering needs ${worst} clues (want ≤${opts.maxWorstCluesToShortlist})`,
    )
  }

  // ---- Falsifiable ------------------------------------------------------
  if (falseClues.length < opts.minFalseClues || falseClues.length > opts.maxFalseClues) {
    failures.push(
      `falsifiable: ${falseClues.length} false clues (want ${opts.minFalseClues}–${opts.maxFalseClues})`,
    )
  }

  const witnessSizes: number[] = []
  for (const lie of falseClues) {
    // A lie the player can never catch is a trap, not a puzzle.
    const witness = smallestWitness(lie, trueClues, index, opts.maxDetectionWitness)
    if (witness === null) {
      failures.push(`falsifiable: clue ${lie.id} cannot be caught with ≤${opts.maxDetectionWitness} truths`)
      witnessSizes.push(Infinity)
    } else {
      witnessSizes.push(witness)
    }

    // And a lie that is obviously a lie is not doing any work either.
    if (admitsFor([lie], mystery.gateway, index)) {
      failures.push(`falsifiable: clue ${lie.id} is marked false but admits the Gateway`)
    }
  }

  const decoyPlausibility =
    trueClues.length === 0
      ? 0
      : trueClues.filter((c) => admitsFor([c], mystery.decoy, index)).length /
        trueClues.length
  if (falseClues.length > 0 && decoyPlausibility < opts.minDecoyPlausibility) {
    failures.push(
      `falsifiable: the decoy only satisfies ${(decoyPlausibility * 100).toFixed(0)}% of the truths ` +
        `(want ≥${(opts.minDecoyPlausibility * 100).toFixed(0)}%)`,
    )
  }
  if (falseClues.length > 0 && !admitsFor(falseClues, mystery.decoy, index)) {
    failures.push('falsifiable: the false clues do not all point at the decoy')
  }

  // ---- Reachable --------------------------------------------------------
  const greedyMinimum = greedyMinimalSubset(trueClues, index).length
  const redundancy = greedyMinimum === 0 ? 0 : trueClues.length / greedyMinimum
  if (redundancy < opts.minRedundancy) {
    failures.push(
      `reachable: only ${redundancy.toFixed(2)}× redundancy in the evidence ` +
        `(want ≥${opts.minRedundancy}×)`,
    )
  }

  const unreachable = mystery.clues.filter(
    (c) => !Number.isFinite(index.jumps(index.galaxy.start, c.source.at)),
  )
  if (unreachable.length > 0) {
    failures.push(`reachable: ${unreachable.length} clue sources cannot be reached from the start`)
  }

  const tour = greedyEvidenceTour(mystery, index)
  if (!Number.isFinite(tour)) {
    failures.push('reachable: no gathering route collects enough evidence to solve')
  } else if (tour > opts.maxTourJumps) {
    failures.push(`reachable: the shortest gathering route is ${tour} jumps (want ≤${opts.maxTourJumps})`)
  }

  return {
    ok: failures.length === 0,
    failures,
    stats: {
      systemCount: index.systems.length,
      trueClueCount: trueClues.length,
      falseClueCount: falseClues.length,
      finalCandidates: finalSet.length,
      tightestSmallSubset: tightest,
      meanCluesToShortlist: mean,
      worstCluesToShortlist: worst,
      greedyMinimumClues: greedyMinimum,
      redundancy,
      decoyPlausibility,
      detectionWitnessSizes: witnessSizes,
      tourJumps: tour,
    },
  }
}

/** The smallest candidate count produced by any subset of size 1..maxSize. */
function tightestSubset(clues: readonly Clue[], index: GalaxyIndex, maxSize: number): number {
  let tightest = Infinity
  const combination: Clue[] = []

  const walk = (start: number, size: number): void => {
    if (combination.length === size) {
      tightest = Math.min(tightest, countCandidatesForAll(combination, index))
      return
    }
    for (let i = start; i < clues.length; i++) {
      combination.push(clues[i]!)
      walk(i + 1, size)
      combination.pop()
    }
  }

  for (let size = 1; size <= Math.min(maxSize, clues.length); size++) walk(0, size)
  return tightest === Infinity ? index.systems.length : tightest
}

/**
 * The fewest true clues that, combined with `lie`, produce an empty candidate
 * set — which is exactly what the Nav Plot's contradiction detector surfaces.
 * Returns null if no witness that small exists.
 */
export function smallestWitness(
  lie: Clue,
  trueClues: readonly Clue[],
  index: GalaxyIndex,
  maxSize: number,
): number | null {
  for (let size = 1; size <= maxSize; size++) {
    const combination: Clue[] = []
    let found = false

    const walk = (start: number): void => {
      if (found) return
      if (combination.length === size) {
        if (countCandidatesForAll([lie, ...combination], index) === 0) found = true
        return
      }
      for (let i = start; i < trueClues.length && !found; i++) {
        combination.push(trueClues[i]!)
        walk(i + 1)
        combination.pop()
      }
    }

    walk(0)
    if (found) return size
  }
  return null
}

/**
 * How far a captain must actually fly to gather enough honest evidence,
 * flying nearest-source-first from the start. This is the check that stops the
 * generator producing a puzzle that is solvable in principle and unaffordable
 * in practice.
 */
export function greedyEvidenceTour(mystery: Mystery, index: GalaxyIndex): number {
  const trueClues = mystery.clues.filter((c) => c.truth === 'true')
  const remaining = new Set(trueClues.map((c) => c.id))
  const collected: Clue[] = []
  let position: SystemId = index.galaxy.start
  let jumps = 0

  while (remaining.size > 0) {
    if (collected.length > 0 && countCandidatesForAll(collected, index) === 1) break

    let best: { clue: Clue; distance: number } | null = null
    for (const clue of trueClues) {
      if (!remaining.has(clue.id)) continue
      const d = index.jumps(position, clue.source.at)
      if (!Number.isFinite(d)) continue
      if (best === null || d < best.distance) best = { clue, distance: d }
    }
    if (best === null) return Infinity

    jumps += best.distance
    position = best.clue.source.at

    // Anything else waiting at this system comes for free.
    for (const clue of trueClues) {
      if (remaining.has(clue.id) && clue.source.at === position) {
        remaining.delete(clue.id)
        collected.push(clue)
      }
    }
  }

  return countCandidatesForAll(collected, index) === 1 ? jumps : Infinity
}
