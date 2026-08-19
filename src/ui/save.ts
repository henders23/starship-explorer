import type { GameState } from '../engine/state/types.js'

/**
 * Save versioning policy (R8).
 *
 * Every save is wrapped in an envelope carrying an integer schema version.
 * On load:
 *
 *  - Same version: shallow shape check, then resume.
 *  - Older version: the migration chain in `MIGRATIONS` is applied step by
 *    step. A version with no written migration is archived unaltered under
 *    its own key and the game starts fresh — a save is never crashed on and
 *    never silently deleted.
 *  - Newer version (a rolled-back client): archived, start fresh.
 *  - Unparseable or mis-shapen: discarded; there is nothing to preserve.
 *
 * Any commit that changes the shape of `GameState` such that an old save no
 * longer satisfies it MUST bump `SAVE_VERSION`, and SHOULD add a migration
 * from the previous version where one is cheap. The golden-replay fixtures
 * pin engine behaviour; this envelope pins the other half — that a player's
 * long run survives a deploy.
 */
export const SAVE_VERSION = 2

const SAVE_KEY = 'starship-explorer-save'
/** The pre-envelope key: a bare GameState, written by builds up to R7. */
const LEGACY_V1_KEY = 'starship-explorer-save-v1'
const archiveKey = (version: number) => `starship-explorer-save-archived-v${version}`

/** The subset of `Storage` the save system touches, so tests can fake it. */
export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

interface SaveEnvelope {
  version: number
  state: GameState
}

/**
 * Migrations from version n to n+1, applied in sequence until the save
 * reaches `SAVE_VERSION`. Each takes the older state shape (typed as
 * unknown; it predates the current `GameState`) and returns the next one.
 */
const MIGRATIONS: Record<number, (state: unknown) => unknown> = {}

/**
 * The shape check is deliberately shallow — enough to reject a save whose
 * schema predates the fields the reducer will immediately dereference,
 * without enumerating the whole state tree.
 */
function looksLikeCurrentState(parsed: GameState | null | undefined): parsed is GameState {
  return (
    typeof parsed?.seed === 'string' &&
    !!parsed.galaxy?.systems &&
    !!parsed.tech &&
    !!parsed.recruits &&
    !!parsed.parts &&
    typeof parsed.ship?.hull === 'number' &&
    typeof parsed.ordnance === 'number'
  )
}

function readEnvelope(storage: StorageLike): SaveEnvelope | null {
  // Builds up to R7 wrote a bare state under the v1 key. Adopt it once as a
  // version-1 envelope so the migration path below handles it like any other
  // old save, then retire the old key.
  const legacy = storage.getItem(LEGACY_V1_KEY)
  if (legacy !== null && storage.getItem(SAVE_KEY) === null) {
    try {
      const state = JSON.parse(legacy) as GameState
      storage.removeItem(LEGACY_V1_KEY)
      return { version: 1, state }
    } catch {
      storage.removeItem(LEGACY_V1_KEY)
      return null
    }
  }

  const raw = storage.getItem(SAVE_KEY)
  if (raw === null) return null
  try {
    const parsed = JSON.parse(raw) as SaveEnvelope
    if (typeof parsed?.version !== 'number' || parsed.state === undefined) return null
    return parsed
  } catch {
    return null
  }
}

function archive(storage: StorageLike, envelope: SaveEnvelope): void {
  try {
    storage.setItem(archiveKey(envelope.version), JSON.stringify(envelope))
    storage.removeItem(SAVE_KEY)
  } catch {
    // Storage full: the stale save simply stays where it was.
  }
}

/** Load the current save, migrating or archiving older ones per the policy. */
export function loadSave(storage: StorageLike): GameState | null {
  const envelope = readEnvelope(storage)
  if (envelope === null) return null

  if (envelope.version > SAVE_VERSION) {
    archive(storage, envelope)
    return null
  }

  let { version } = envelope
  let state: unknown = envelope.state
  while (version < SAVE_VERSION) {
    // The v1 bare state and the v2 envelope carry the same shape, so the
    // first step is an identity unless a later schema change writes one.
    const migrate = MIGRATIONS[version] ?? (version === 1 ? (s: unknown) => s : null)
    if (migrate === null) {
      archive(storage, envelope)
      return null
    }
    state = migrate(state)
    version += 1
  }

  const candidate = state as GameState
  if (!looksLikeCurrentState(candidate)) {
    archive(storage, envelope)
    return null
  }

  // Rewrite migrated saves in the current envelope so the chain runs once.
  if (envelope.version < SAVE_VERSION) persist(candidate, storage)
  return candidate
}

export function persist(state: GameState, storage: StorageLike): void {
  try {
    const envelope: SaveEnvelope = { version: SAVE_VERSION, state }
    storage.setItem(SAVE_KEY, JSON.stringify(envelope))
  } catch {
    // Storage full or unavailable: the game plays on, unsaved.
  }
}

/** Whether a resumable voyage is waiting in storage. */
export function hasSave(storage: StorageLike): boolean {
  return loadSave(storage) !== null
}
