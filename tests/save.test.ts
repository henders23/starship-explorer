import { describe, expect, it } from 'vitest'
import { newGame } from '../src/engine/state/reducer.js'
import { SAVE_VERSION, hasSave, loadSave, persist, type StorageLike } from '../src/ui/save.js'

function fakeStorage(entries: Record<string, string> = {}): StorageLike & { data: Map<string, string> } {
  const data = new Map(Object.entries(entries))
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  }
}

const LEGACY_KEY = 'starship-explorer-save-v1'
const KEY = 'starship-explorer-save'

describe('save versioning', () => {
  it('round-trips a save through the current envelope', () => {
    const storage = fakeStorage()
    const state = newGame('save-roundtrip')
    persist(state, storage)

    const envelope = JSON.parse(storage.data.get(KEY)!)
    expect(envelope.version).toBe(SAVE_VERSION)

    const loaded = loadSave(storage)
    expect(loaded).toEqual(state)
    expect(hasSave(storage)).toBe(true)
  })

  it('returns null with empty storage', () => {
    const storage = fakeStorage()
    expect(loadSave(storage)).toBeNull()
    expect(hasSave(storage)).toBe(false)
  })

  it('adopts a legacy bare-state save and rewrites it under the new key', () => {
    const storage = fakeStorage()
    const state = newGame('legacy-adoption')
    storage.data.set(LEGACY_KEY, JSON.stringify(state))

    const loaded = loadSave(storage)
    expect(loaded).toEqual(state)
    expect(storage.data.has(LEGACY_KEY)).toBe(false)
    expect(JSON.parse(storage.data.get(KEY)!).version).toBe(SAVE_VERSION)
  })

  it('discards unparseable saves', () => {
    const storage = fakeStorage({ [KEY]: '{not json' })
    expect(loadSave(storage)).toBeNull()

    const legacyBad = fakeStorage({ [LEGACY_KEY]: '{not json' })
    expect(loadSave(legacyBad)).toBeNull()
    expect(legacyBad.data.has(LEGACY_KEY)).toBe(false)
  })

  it('archives a save from a newer client instead of deleting it', () => {
    const storage = fakeStorage()
    const future = { version: SAVE_VERSION + 1, state: { some: 'future shape' } }
    storage.data.set(KEY, JSON.stringify(future))

    expect(loadSave(storage)).toBeNull()
    expect(storage.data.has(KEY)).toBe(false)
    const archived = storage.data.get(`starship-explorer-save-archived-v${SAVE_VERSION + 1}`)
    expect(JSON.parse(archived!)).toEqual(future)
  })

  it('migrates a v2 envelope forward, gaining the crisis field', () => {
    const storage = fakeStorage()
    const state = newGame('save-v2-migration')
    const { crisis: _dropped, ...v2State } = state
    storage.data.set(KEY, JSON.stringify({ version: 2, state: v2State }))

    const loaded = loadSave(storage)
    expect(loaded).not.toBeNull()
    expect(loaded!.crisis).toBeNull()
    expect(loaded!.seed).toBe('save-v2-migration')
    expect(JSON.parse(storage.data.get(KEY)!).version).toBe(SAVE_VERSION)
  })

  it('archives an old save whose shape no longer fits, rather than crashing', () => {
    const storage = fakeStorage()
    // A structurally alien pre-envelope save: parseable, wrong shape.
    storage.data.set(LEGACY_KEY, JSON.stringify({ morale: 7, supplies: 12 }))

    expect(loadSave(storage)).toBeNull()
    expect(storage.data.has(LEGACY_KEY)).toBe(false)
    expect(storage.data.has('starship-explorer-save-archived-v1')).toBe(true)
  })
})
