import type { GalaxyIndex } from '../worldgen/index-galaxy.js'
import type { StarSystem, SystemId } from '../worldgen/types.js'
import { FEATURE_NAMES, REGION_NAMES, STAR_NAMES } from '../worldgen/types.js'
import type { Constraint } from './types.js'

/**
 * Dead zones around a reference system, so that "coreward of X" never turns on
 * a difference of half a light year. A clue the player cannot act on
 * confidently is a bug, not a subtlety.
 */
const RADIAL_MARGIN = 35
const ANGULAR_MARGIN = 0.035

export function satisfies(
  constraint: Constraint,
  system: StarSystem,
  index: GalaxyIndex,
): boolean {
  switch (constraint.kind) {
    case 'direction': {
      if (system.id === constraint.of) return false
      const ref = index.system(constraint.of)
      switch (constraint.dir) {
        case 'coreward':
          return system.r < ref.r - RADIAL_MARGIN
        case 'rimward':
          return system.r > ref.r + RADIAL_MARGIN
        case 'spinward':
          return system.theta > ref.theta + ANGULAR_MARGIN
        case 'trailing':
          return system.theta < ref.theta - ANGULAR_MARGIN
      }
      return false
    }

    case 'proximity': {
      const d = index.jumps(constraint.of, system.id)
      return constraint.op === 'within' ? d <= constraint.jumps : d > constraint.jumps
    }

    case 'starType': {
      const match = system.star === constraint.is
      return constraint.negated ? !match : match
    }

    case 'contains': {
      const match = system.features.includes(constraint.feature)
      return constraint.negated ? !match : match
    }

    case 'adjacency': {
      const match = index.bordersFaction(system.id, constraint.faction)
      return constraint.negated ? !match : match
    }

    case 'region': {
      const match = system.region === constraint.is
      return constraint.negated ? !match : match
    }

    case 'isolation': {
      const degree = index.degree(system.id)
      return constraint.op === 'atMost' ? degree <= constraint.lanes : degree >= constraint.lanes
    }

    case 'anomaly':
      return system.features.includes('rift-echo')
  }
}

/* ------------------------------------------------------------------------ *
 * Satisfaction masks
 *
 * Generation intersects candidate sets millions of times — every offered clue
 * is tested against every pair and trio already chosen — so evaluating
 * predicates system-by-system is far too slow to run the property tests the
 * contract depends on. Instead each constraint is compiled once into a bitmask
 * over systems, and intersection becomes a word-wise AND.
 *
 * The cache hangs off the `GalaxyIndex` in a `WeakMap`, so callers get the
 * speedup transparently and masks are collected with the galaxy they describe.
 * ------------------------------------------------------------------------ */

interface MaskCache {
  words: number
  full: Uint32Array
  /** Structural cache, so two equivalent constraints share one mask. */
  byKey: Map<string, Uint32Array>
  /**
   * Identity cache. Selection re-tests the same constraint objects hundreds of
   * thousands of times, and building a structural key for each lookup costs
   * more than the intersection it guards — so resolve by object first.
   */
  byObject: WeakMap<Constraint, Uint32Array>
}

const maskCaches = new WeakMap<GalaxyIndex, MaskCache>()

function cacheFor(index: GalaxyIndex): MaskCache {
  let cache = maskCaches.get(index)
  if (cache) return cache

  const count = index.systems.length
  const words = Math.ceil(count / 32) || 1
  const full = new Uint32Array(words)
  for (let i = 0; i < count; i++) full[i >>> 5]! |= 1 << (i & 31)

  cache = { words, full, byKey: new Map(), byObject: new WeakMap() }
  maskCaches.set(index, cache)
  return cache
}

/** The set of systems satisfying a constraint, as a bitmask. Cached two ways. */
export function maskFor(constraint: Constraint, index: GalaxyIndex): Uint32Array {
  const cache = cacheFor(index)

  const byObject = cache.byObject.get(constraint)
  if (byObject) return byObject

  const key = constraintKey(constraint)
  const cached = cache.byKey.get(key)
  if (cached) {
    cache.byObject.set(constraint, cached)
    return cached
  }

  const mask = new Uint32Array(cache.words)
  const systems = index.systems
  for (let i = 0; i < systems.length; i++) {
    if (satisfies(constraint, systems[i]!, index)) mask[i >>> 5]! |= 1 << (i & 31)
  }
  cache.byKey.set(key, mask)
  cache.byObject.set(constraint, mask)
  return mask
}

function popcount(value: number): number {
  let v = value - ((value >>> 1) & 0x55555555)
  v = (v & 0x33333333) + ((v >>> 2) & 0x33333333)
  return Math.imul((v + (v >>> 4)) & 0x0f0f0f0f, 0x01010101) >>> 24
}

/**
 * How many systems satisfy all the given constraints. Allocation-free beyond
 * the mask lookup, because this is the innermost loop of generation.
 */
export function countCandidates(
  constraints: readonly Constraint[],
  index: GalaxyIndex,
): number {
  const cache = cacheFor(index)
  if (constraints.length === 0) return index.systems.length

  const masks: Uint32Array[] = []
  for (const constraint of constraints) masks.push(maskFor(constraint, index))

  let count = 0
  for (let w = 0; w < cache.words; w++) {
    let acc = cache.full[w]!
    for (let m = 0; m < masks.length && acc !== 0; m++) acc &= masks[m]![w]!
    if (acc !== 0) count += popcount(acc)
  }
  return count
}

/** Whether a system satisfies all the given constraints, via the masks. */
export function admitsSystem(
  constraints: readonly Constraint[],
  systemId: SystemId,
  index: GalaxyIndex,
): boolean {
  const ordinal = index.ordinal(systemId)
  const word = ordinal >>> 5
  const bit = 1 << (ordinal & 31)
  for (const constraint of constraints) {
    if ((maskFor(constraint, index)[word]! & bit) === 0) return false
  }
  return true
}

/** Every system satisfying all of the given constraints. */
export function candidates(
  constraints: readonly Constraint[],
  index: GalaxyIndex,
): SystemId[] {
  if (constraints.length === 0) return index.systems.map((s) => s.id)

  const cache = cacheFor(index)
  const masks: Uint32Array[] = []
  for (const constraint of constraints) masks.push(maskFor(constraint, index))

  const out: SystemId[] = []
  const systems = index.systems
  for (let w = 0; w < cache.words; w++) {
    let acc = cache.full[w]!
    for (let m = 0; m < masks.length && acc !== 0; m++) acc &= masks[m]![w]!
    while (acc !== 0) {
      const bit = acc & -acc
      const ordinal = (w << 5) + (31 - Math.clz32(bit >>> 0))
      out.push(systems[ordinal]!.id)
      acc ^= bit
    }
  }
  return out
}

/** How many systems a single constraint admits. Used to reject weak or decisive clues. */
export function admits(constraint: Constraint, index: GalaxyIndex): number {
  const mask = maskFor(constraint, index)
  let count = 0
  for (let w = 0; w < mask.length; w++) count += popcount(mask[w]!)
  return count
}

/** Structural identity, so duplicate constraints can be detected and corroborated. */
export function constraintKey(constraint: Constraint): string {
  switch (constraint.kind) {
    case 'direction':
      return `direction:${constraint.of}:${constraint.dir}`
    case 'proximity':
      return `proximity:${constraint.of}:${constraint.op}:${constraint.jumps}`
    case 'starType':
      return `starType:${constraint.is}:${constraint.negated}`
    case 'contains':
      return `contains:${constraint.feature}:${constraint.negated}`
    case 'adjacency':
      return `adjacency:${constraint.faction}:${constraint.negated}`
    case 'region':
      return `region:${constraint.is}:${constraint.negated}`
    case 'isolation':
      return `isolation:${constraint.op}:${constraint.lanes}`
    case 'anomaly':
      return 'anomaly'
  }
}

/** Plain-language rendering, used as the backbone of authored clue prose. */
export function describeConstraint(constraint: Constraint, index: GalaxyIndex): string {
  switch (constraint.kind) {
    case 'direction':
      return `lies ${constraint.dir} of ${index.system(constraint.of).name}`
    case 'proximity':
      return constraint.op === 'within'
        ? `lies within ${constraint.jumps} ${plural(constraint.jumps, 'jump')} of ${index.system(constraint.of).name}`
        : `lies more than ${constraint.jumps} ${plural(constraint.jumps, 'jump')} from ${index.system(constraint.of).name}`
    case 'starType':
      return constraint.negated
        ? `is not ${STAR_NAMES[constraint.is]}`
        : `is ${STAR_NAMES[constraint.is]}`
    case 'contains':
      return constraint.negated
        ? `has no ${bare(FEATURE_NAMES[constraint.feature])}`
        : `has ${FEATURE_NAMES[constraint.feature]}`
    case 'adjacency':
      return constraint.negated
        ? `does not border ${index.factionName(constraint.faction)}`
        : `borders ${index.factionName(constraint.faction)}`
    case 'region':
      return constraint.negated
        ? `does not lie in ${REGION_NAMES[constraint.is]}`
        : `lies somewhere in ${REGION_NAMES[constraint.is]}`
    case 'isolation':
      return constraint.op === 'atMost'
        ? `has no more than ${constraint.lanes} jump ${plural(constraint.lanes, 'lane')}`
        : `has at least ${constraint.lanes} jump ${plural(constraint.lanes, 'lane')}`
    case 'anomaly':
      return 'carries the same rift echo as the anomaly that took us'
  }
}

function plural(n: number, word: string): string {
  return n === 1 ? word : `${word}s`
}

/** Strips the leading article, for phrasings like "has no gas giant". */
function bare(phrase: string): string {
  return phrase.replace(/^(a|an|the) /, '')
}
