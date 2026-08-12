/**
 * Seeded, deterministic pseudo-random number generation.
 *
 * The entire engine draws randomness from here and never from `Math.random`,
 * so that a seed plus an action log always replays to an identical state.
 * An `Rng` is a mutable cursor over a stream; `fork` derives an independent
 * stream so that adding a draw in one subsystem cannot shift the numbers
 * another subsystem sees.
 */

export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number
  /** Uniform integer in [0, maxExclusive). */
  int(maxExclusive: number): number
  /** Uniform integer in [min, max], inclusive both ends. */
  range(min: number, max: number): number
  /** Uniform float in [min, max). */
  float(min: number, max: number): number
  /** True with the given probability. */
  chance(probability: number): boolean
  /** Uniform choice from a non-empty array. */
  pick<T>(items: readonly T[]): T
  /** Choice from `[item, weight]` pairs; weights need not sum to 1. */
  weighted<T>(entries: readonly (readonly [T, number])[]): T
  /** A new array, Fisher-Yates shuffled. Does not mutate the input. */
  shuffle<T>(items: readonly T[]): T[]
  /** Up to `count` distinct items, sampled without replacement. */
  sample<T>(items: readonly T[], count: number): T[]
  /** An independent stream derived from this one's current position. */
  fork(label: string): Rng
}

/** FNV-1a, for turning a string seed into a 32-bit integer. */
export function hashString(input: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

export function toSeed(seed: number | string): number {
  return typeof seed === 'number' ? Math.abs(Math.trunc(seed)) >>> 0 : hashString(seed)
}

export function createRng(seed: number | string): Rng {
  let state = toSeed(seed) || 0x9e3779b9

  // mulberry32 — small, fast, and statistically fine for game purposes.
  const next = (): number => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const rng: Rng = {
    next,

    int(maxExclusive) {
      if (maxExclusive <= 0) return 0
      return Math.floor(next() * maxExclusive)
    },

    range(min, max) {
      if (max < min) [min, max] = [max, min]
      return min + Math.floor(next() * (max - min + 1))
    },

    float(min, max) {
      return min + next() * (max - min)
    },

    chance(probability) {
      return next() < probability
    },

    pick(items) {
      if (items.length === 0) throw new Error('rng.pick: empty array')
      return items[Math.floor(next() * items.length)]!
    },

    weighted(entries) {
      if (entries.length === 0) throw new Error('rng.weighted: empty array')
      let total = 0
      for (const [, weight] of entries) total += Math.max(0, weight)
      if (total <= 0) return entries[0]![0]
      let roll = next() * total
      for (const [item, weight] of entries) {
        roll -= Math.max(0, weight)
        if (roll < 0) return item
      }
      return entries[entries.length - 1]![0]
    },

    shuffle(items) {
      const out = [...items]
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1))
        ;[out[i], out[j]] = [out[j]!, out[i]!]
      }
      return out
    },

    sample(items, count) {
      return rng.shuffle(items).slice(0, Math.max(0, count))
    },

    fork(label) {
      return createRng((hashString(label) ^ Math.floor(next() * 0xffffffff)) >>> 0)
    },
  }

  return rng
}
