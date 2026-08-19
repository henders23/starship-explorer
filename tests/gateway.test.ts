import { describe, expect, it } from 'vitest'
import { newGame, reduce, reduceAll } from '../src/engine/state/reducer.js'
import type { Action, GameState } from '../src/engine/state/types.js'
import { GalaxyIndex } from '../src/engine/worldgen/index-galaxy.js'

/**
 * The finale is a place (R9, docs/specs/doorway-home.md): the correct Long
 * Jump arrives at the gateway threshold and plays a scene; its commit
 * option performs the transit. This suite pins the arrival, the commit,
 * the stand-off, and the way back in.
 */
const run = (from: GameState, ...actions: Action[]) => reduceAll(from, actions).state

/** A run one decision from home: both rift projects built, reserve aboard. */
function atTheBrink(seed: string): GameState {
  const state = newGame(seed)
  return { ...state, tech: { researched: ['rift-drive', 'rift-shield'], active: null } }
}

describe('the doorway', () => {
  it('a correct jump arrives at the threshold instead of ending the run', () => {
    const state = atTheBrink('gateway-arrival')
    const { state: arrived, events } = reduce(state, {
      type: 'plotTheJump',
      target: state.mystery.gateway,
    })

    expect(arrived.outcome).toBe('seeking')
    expect(arrived.ship.at).toBe(state.mystery.gateway)
    expect(arrived.encounter?.templateId).toBe('gateway')
    expect(arrived.encounter?.options.map((o) => o.id)).toEqual(['commit', 'hold'])
    expect(events.some((e) => e.type === 'jumpSucceeded')).toBe(true)
    expect(events.some((e) => e.type === 'sceneOpened')).toBe(true)
  })

  it('the commit option performs the transit and ends the voyage home', () => {
    const state = atTheBrink('gateway-commit')
    const home = run(
      state,
      { type: 'plotTheJump', target: state.mystery.gateway },
      { type: 'sceneOption', option: 'commit' },
    )
    expect(home.outcome).toBe('home')
    expect(home.encounter).toBeNull()
    expect(home.log[home.log.length - 1]!.kind).toBe('ending')
  })

  it('holding at the threshold keeps the voyage alive, and openScene returns', () => {
    const state = atTheBrink('gateway-hold')
    const held = run(
      state,
      { type: 'plotTheJump', target: state.mystery.gateway },
      { type: 'sceneOption', option: 'hold' },
    )
    expect(held.outcome).toBe('seeking')
    expect(held.encounter).toBeNull()

    const back = run(held, { type: 'openScene' })
    expect(back.encounter?.templateId).toBe('gateway')
  })

  it('the door, once found, stays found: travel away and the threshold recasts on return', () => {
    const state = atTheBrink('gateway-return')
    const held = run(
      state,
      { type: 'plotTheJump', target: state.mystery.gateway },
      { type: 'sceneOption', option: 'hold' },
    )

    const index = new GalaxyIndex(held.galaxy)
    const neighbour = index.neighbours(held.ship.at)[0]
    if (!neighbour) return
    const away = run({ ...held, ship: { ...held.ship, fuel: 999 } }, { type: 'travel', to: neighbour })
    expect(away.ship.at).toBe(neighbour)

    const returned = run(away, { type: 'travel', to: held.ship.at })
    // A contact can pre-empt the arrival scene; the threshold is what plays
    // once the sky is clear, and openScene always brings it back.
    if (returned.combat === null) {
      expect(returned.encounter?.templateId).toBe('gateway')
    }
  })

  it('a second Long Jump is refused once the door is found', () => {
    const state = atTheBrink('gateway-refuse')
    const held = run(
      state,
      { type: 'plotTheJump', target: state.mystery.gateway },
      { type: 'sceneOption', option: 'hold' },
    )
    const again = reduce(held, { type: 'plotTheJump', target: held.mystery.decoy })
    expect(again.state).toBe(held)
  })

  it('the transit option is refused anywhere but the gateway scene', () => {
    const state = atTheBrink('gateway-forge')
    // Forge a non-gateway scene answer with the transit id: must be a no-op.
    const forged = reduce(state, { type: 'sceneOption', option: 'commit' })
    expect(forged.state).toBe(state)
  })

  it('a wrong jump still displaces, scars, and can be retried', () => {
    const state = atTheBrink('gateway-wrong')
    const { state: wrong } = reduce(state, { type: 'plotTheJump', target: state.mystery.decoy })
    expect(wrong.jumps).toEqual([{ target: state.mystery.decoy, correct: false }])
    if (wrong.outcome === 'seeking') {
      expect(wrong.driveScarred).toBe(true)
      expect(wrong.ship.at).not.toBe(state.mystery.decoy)
    }
  })
})
