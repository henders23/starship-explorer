import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { stateHash } from '../src/engine/state/hash.js'
import { newGame, reduceAll } from '../src/engine/state/reducer.js'
import type { Action, GameState } from '../src/engine/state/types.js'

/**
 * The golden-replay harness (R8, promised in M0): complete recorded runs,
 * replayed from the seed through the real reducer, pinned by final-state
 * hash. If this suite fails, engine behaviour changed — worldgen, mystery
 * generation, mission dice, combat pricing, the clock, anything. If the
 * change was intended (a balance pass), regenerate with `npm run
 * golden:record`, commit the new fixtures, and say why in the commit. If it
 * was not intended, this suite just caught a regression nothing else did.
 */
const FIXTURE_DIR = join(import.meta.dirname, 'fixtures', 'golden')

interface GoldenFixture {
  seed: string
  hash: string
  outcome: GameState['outcome']
  day: number
  actionCount: number
  cluesCollected: number
  jumps: number
  casualties: GameState['casualties']
  actions: Action[]
}

const fixtures = readdirSync(FIXTURE_DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(FIXTURE_DIR, f), 'utf8')) as GoldenFixture)

describe('golden replays', () => {
  it('has fixtures to replay', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(3)
  })

  for (const fixture of fixtures) {
    it(`${fixture.seed}: ${fixture.actionCount} actions land on ${fixture.hash}`, () => {
      const { state } = reduceAll(newGame(fixture.seed), fixture.actions)

      // The headline facts first, so a mismatch names what actually moved
      // before the hash line says only "something did".
      expect(state.outcome).toBe(fixture.outcome)
      expect(state.day).toBe(fixture.day)
      expect(state.collected.length).toBe(fixture.cluesCollected)
      expect(state.jumps.length).toBe(fixture.jumps)
      expect(state.casualties).toEqual(fixture.casualties)

      expect(stateHash(state)).toBe(fixture.hash)
    })
  }

  it('every recorded action was accepted by the reducer', () => {
    // A refused action returns the same state reference; a log that contains
    // one is recording dead weight and hiding a pilot bug.
    for (const fixture of fixtures) {
      let state = newGame(fixture.seed)
      for (const action of fixture.actions) {
        const next = reduceAll(state, [action]).state
        expect(next, `${fixture.seed}: refused ${JSON.stringify(action)}`).not.toBe(state)
        state = next
      }
    }
  })
})
