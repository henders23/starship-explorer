import type { GalaxyIndex } from '../worldgen/index-galaxy.js'
import type { SystemId } from '../worldgen/types.js'
import { admitsSystem, candidates, countCandidates } from './constraints.js'
import type { ClueFacts, ClueId, Contradiction } from './types.js'

/**
 * The player-facing side of the mystery. Everything here works only from
 * clues and the galaxy. It is typed against `ClueFacts`, which has no `truth`
 * field at all, so leaking the answer here is a compile error rather than a
 * code-review question.
 */

/** Systems still consistent with every clue the player currently trusts. */
export function candidatesFor(clues: readonly ClueFacts[], index: GalaxyIndex): SystemId[] {
  return candidates(
    clues.filter((c) => c.state === 'trusted').map((c) => c.constraint),
    index,
  )
}

/** Systems consistent with an arbitrary set of clues, regardless of state. */
export function candidatesForAll(clues: readonly ClueFacts[], index: GalaxyIndex): SystemId[] {
  return candidates(clues.map((c) => c.constraint), index)
}

/** How many systems a set of clues admits, without materialising the list. */
export function countCandidatesForAll(clues: readonly ClueFacts[], index: GalaxyIndex): number {
  return countCandidates(clues.map((c) => c.constraint), index)
}

/** Whether a specific system survives a set of clues. */
export function admitsFor(clues: readonly ClueFacts[], systemId: SystemId, index: GalaxyIndex): boolean {
  return admitsSystem(clues.map((c) => c.constraint), systemId, index)
}

/**
 * Minimal sets of clues that cannot all be true at once. "Minimal" matters:
 * reporting a five-clue conflict tells the player nothing, whereas a pair that
 * cannot coexist points straight at a liar.
 *
 * Bounded to small sets because that is what a player can actually reason
 * about, and because the search is exponential.
 */
export function findContradictions(
  clues: readonly ClueFacts[],
  index: GalaxyIndex,
  maxSize = 3,
): Contradiction[] {
  const found: Contradiction[] = []
  const conflicting = new Set<string>()

  const keyOf = (ids: ClueId[]) => ids.slice().sort().join('|')

  // A set is only worth testing if none of its proper subsets already conflict.
  const containsKnownConflict = (ids: ClueId[]): boolean => {
    for (const key of conflicting) {
      const subset = key.split('|')
      if (subset.length < ids.length && subset.every((id) => ids.includes(id))) return true
    }
    return false
  }

  const test = (subset: ClueFacts[]): void => {
    const ids = subset.map((c) => c.id)
    if (containsKnownConflict(ids)) return
    if (countCandidatesForAll(subset, index) === 0) {
      conflicting.add(keyOf(ids))
      found.push({ clues: ids })
    }
  }

  for (let size = 1; size <= Math.min(maxSize, clues.length); size++) {
    forEachCombination(clues, size, test)
  }

  return found
}

function forEachCombination<T>(
  items: readonly T[],
  size: number,
  visit: (combination: T[]) => void,
): void {
  const combination: T[] = []
  const walk = (start: number): void => {
    if (combination.length === size) {
      visit([...combination])
      return
    }
    for (let i = start; i < items.length; i++) {
      combination.push(items[i]!)
      walk(i + 1)
      combination.pop()
    }
  }
  walk(0)
}

/**
 * A greedy lower bound on how many of these clues are needed to isolate a
 * single system. Used by the generator to size the evidence pool, and by the
 * UI to tell the player roughly how close their trusted set is to decisive.
 */
export function greedyMinimalSubset<T extends ClueFacts>(
  clues: readonly T[],
  index: GalaxyIndex,
): T[] {
  const chosen: T[] = []
  const remaining = [...clues]
  let current = index.systems.map((s) => s.id)

  while (current.length > 1 && remaining.length > 0) {
    let best: { clue: T; at: number; size: number } | null = null

    for (let i = 0; i < remaining.length; i++) {
      const clue = remaining[i]!
      const size = countCandidatesForAll([...chosen, clue], index)
      if (size === 0) continue
      if (best === null || size < best.size) best = { clue, at: i, size }
    }

    if (best === null || best.size >= current.length) break
    chosen.push(best.clue)
    remaining.splice(best.at, 1)
    current = candidatesForAll(chosen, index)
  }

  return chosen
}

/**
 * How many clues, drawn in the given order, are needed before the candidate
 * set is down to `target` or fewer. `Infinity` if the order never gets there.
 */
export function cluesToNarrow(
  ordered: readonly ClueFacts[],
  index: GalaxyIndex,
  target: number,
): number {
  const filed: ClueFacts[] = []
  for (let i = 0; i < ordered.length; i++) {
    filed.push(ordered[i]!)
    if (countCandidatesForAll(filed, index) <= target) return i + 1
  }
  return Infinity
}

/**
 * Two clues corroborate when independent sources assert the same constraint.
 * The generator only ever plants corroborating pairs for true clues, so a
 * corroborated clue is safe to trust — this is the player's reward for
 * gathering redundant evidence instead of merely sufficient evidence.
 */
export function corroboratedIds(clues: readonly ClueFacts[]): Set<ClueId> {
  const out = new Set<ClueId>()
  for (const clue of clues) {
    if (clue.corroborates.length > 0) {
      out.add(clue.id)
      for (const other of clue.corroborates) out.add(other)
    }
  }
  return out
}
