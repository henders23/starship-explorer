import type { GameState } from './types.js'

/**
 * A canonical fingerprint of a game state, for the golden-replay harness:
 * a fixture pins `stateHash(replayedFinalState)`, so any change to the
 * rules, the content, or the numbers that alters where a recorded run lands
 * fails CI instead of shipping silently. Balance changes regenerate the
 * fixtures deliberately (`npm run golden:record`).
 *
 * The hash is FNV-1a 64-bit over key-sorted JSON — dependency-free and
 * identical in the browser and node. It is a regression pin, not a
 * cryptographic commitment.
 */
export function stateHash(state: GameState): string {
  return fnv1a64(canonicalJson(state))
}

/** JSON.stringify with object keys sorted at every level. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`)
  return `{${entries.join(',')}}`
}

function fnv1a64(input: string): string {
  let hash = 0xcbf29ce484222325n
  const prime = 0x100000001b3n
  const mask = 0xffffffffffffffffn
  for (let i = 0; i < input.length; i++) {
    hash ^= BigInt(input.charCodeAt(i))
    hash = (hash * prime) & mask
  }
  return hash.toString(16).padStart(16, '0')
}
