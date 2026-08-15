import { describe, expect, it } from 'vitest'
import { ENDING_VARIANTS, epilogueLines } from '../src/engine/encounters/epilogue.js'
import { newGame, reduce } from '../src/engine/state/reducer.js'
import type { GameState } from '../src/engine/state/types.js'

const SEED = 'finale-tests'

/** A ship parked at the gateway's doorstep with the reserve in the tank. */
function atTheBrink(overrides?: Partial<GameState>): GameState {
  const state = newGame(SEED)
  return { ...state, ship: { ...state.ship, fuel: 80 }, ...overrides }
}

function jumpHome(state: GameState) {
  return reduce(state, { type: 'plotTheJump', target: state.mystery.gateway })
}

describe('the doorway', () => {
  it('a correct jump opens the Doorway instead of cutting to black', () => {
    const state = atTheBrink()
    const { state: next } = jumpHome(state)
    expect(next.outcome).toBe('seeking')
    expect(next.encounter).toEqual({ id: 'doorway-home', node: 'threshold' })
    expect(next.ship.fuel).toBe(80 - 30)
    expect(next.jumps).toEqual([{ target: state.mystery.gateway, correct: true }])
  })

  it('a war allowed to reach the gate contests the approach', () => {
    const { state: next } = jumpHome(atTheBrink({ warPressure: 5 }))
    expect(next.encounter?.node).toBe('contested')
  })

  it('taking everyone home ends the run, won, as the plain return', () => {
    const opened = jumpHome(atTheBrink()).state
    const { state: next, events } = reduce(opened, { type: 'encounterChoose', choice: 'return' })
    expect(next.outcome).toBe('home')
    expect(next.ending).toBe('return')
    expect(next.encounter).toBeNull()
    expect(events.some((e) => e.type === 'jumpSucceeded')).toBe(true)
  })

  it('the earned endings are gated on what the ship actually did', () => {
    const opened = jumpHome(atTheBrink()).state

    // No convoy friendship, no custodian trust: both doors locked.
    expect(reduce(opened, { type: 'encounterChoose', choice: 'coalition' }).state).toBe(opened)
    expect(reduce(opened, { type: 'encounterChoose', choice: 'keeper' }).state).toBe(opened)

    const earned = jumpHome(
      atTheBrink({ flags: ['convoy-friend'], standing: { flotilla: 0, vekar: 0, ostrea: 0, custodian: 2 } }),
    ).state
    const coalition = reduce(earned, { type: 'encounterChoose', choice: 'coalition' }).state
    expect(coalition.ending).toBe('coalition')
    const keeper = reduce(earned, { type: 'encounterChoose', choice: 'keeper' }).state
    expect(keeper.ending).toBe('keeper')

    // The lighthouse asks nothing but the nerve.
    const lighthouse = reduce(opened, { type: 'encounterChoose', choice: 'lighthouse' }).state
    expect(lighthouse.ending).toBe('lighthouse')
  })

  it('relationships open the contested gate without a shot', () => {
    const opened = jumpHome(
      atTheBrink({ warPressure: 6, standing: { flotilla: 0, vekar: 1, ostrea: 0, custodian: 0 } }),
    ).state
    expect(opened.encounter?.node).toBe('contested')
    const { state: next } = reduce(opened, { type: 'encounterChoose', choice: 'vekar-passage' })
    expect(next.encounter?.node).toBe('threshold')
    expect(next.combat).toBeNull()
  })

  it('punching through is a committed battle that resumes at the threshold', () => {
    const opened = jumpHome(atTheBrink({ warPressure: 6 })).state
    const { state: fighting } = reduce(opened, { type: 'encounterChoose', choice: 'punch' })
    expect(fighting.combat?.enemy).toBe('warship')
    expect(fighting.combat?.noWithdraw).toBe(true)

    const cleared = reduce(fighting, { type: 'encounterContinue' }).state
    const { state: after } = reduce(cleared, { type: 'resolveCombat', result: 'victory', hull: 14 })
    expect(after.outcome).toBe('seeking')
    expect(after.encounter).toEqual({ id: 'doorway-home', node: 'threshold' })

    const home = reduce(after, { type: 'encounterChoose', choice: 'return' }).state
    expect(home.outcome).toBe('home')
  })

  it('losing the gate battle is still the end of the ship', () => {
    const opened = jumpHome(atTheBrink({ warPressure: 6 })).state
    const fighting = reduce(opened, { type: 'encounterChoose', choice: 'punch' }).state
    const cleared = reduce(fighting, { type: 'encounterContinue' }).state
    const { state: lost } = reduce(cleared, { type: 'resolveCombat', result: 'defeat', hull: 0 })
    expect(lost.outcome).toBe('destroyed')
  })
})

describe('the epilogue', () => {
  it('remembers the campaign: flags and standings become lines', () => {
    const bare = newGame(SEED)
    expect(epilogueLines(bare)).toEqual([])

    const storied: GameState = {
      ...bare,
      flags: ['defector-safe', 'gannet-friend', 'echo-dead', 'letters-sent'],
      standing: { flotilla: 2, vekar: 0, ostrea: 0, custodian: 0 },
    }
    const lines = epilogueLines(storied)
    expect(lines.length).toBe(5)
    expect(lines.some((l) => l.includes('Vess'))).toBe(true)
    expect(lines.some((l) => l.includes('Gannet'))).toBe(true)
    expect(lines.some((l) => l.includes('letters'))).toBe(true)
  })

  it('mutually exclusive threads never both fire', () => {
    const bare = newGame(SEED)
    const safe: GameState = { ...bare, flags: ['defector-aboard', 'defector-safe'] }
    const lines = epilogueLines(safe)
    expect(lines.filter((l) => l.includes('Vess')).length).toBe(1)
  })

  it('every ending variant has its screen text', () => {
    for (const variant of ['return', 'coalition', 'keeper', 'lighthouse'] as const) {
      expect(ENDING_VARIANTS[variant].headline.length).toBeGreaterThan(0)
      expect(ENDING_VARIANTS[variant].body.length).toBeGreaterThan(0)
    }
  })
})
