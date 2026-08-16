import { describe, expect, it } from 'vitest'
import { encounterDef } from '../src/engine/encounters/catalog.js'
import { friendsOfTheShip, openThreads } from '../src/engine/encounters/journal.js'
import { chooseEncounter, doneFlag, shapedWeight } from '../src/engine/encounters/select.js'
import { createRng } from '../src/engine/rng/prng.js'
import { newGame, reduce } from '../src/engine/state/reducer.js'
import type { GameState } from '../src/engine/state/types.js'

const SEED = 'journal-tests'

function fresh(): GameState {
  return { ...newGame(SEED), data: 50 }
}

describe('the journal', () => {
  it('opens a thread when its flags open, and closes it when the story does', () => {
    const bare = fresh()
    expect(openThreads(bare)).toEqual([])

    const indebted: GameState = { ...bare, flags: ['oracle-debt'] }
    expect(openThreads(indebted).some((t) => t.includes('Oracle'))).toBe(true)

    const hunted: GameState = { ...bare, flags: ['defector-aboard'] }
    expect(openThreads(hunted).some((t) => t.includes('retrieval orders stand'))).toBe(true)

    const safe: GameState = { ...bare, flags: ['defector-aboard', 'defector-safe'] }
    const lines = openThreads(safe)
    expect(lines.some((t) => t.includes('INFEASIBLE'))).toBe(true)
    expect(lines.some((t) => t.includes('retrieval orders stand'))).toBe(false)
  })

  it('keeps the friends ledger', () => {
    const bare = fresh()
    expect(friendsOfTheShip(bare)).toEqual([])
    const storied: GameState = { ...bare, flags: ['admiral-friend', 'convoy-friend'] }
    expect(friendsOfTheShip(storied).length).toBe(2)
  })
})

describe('pacing', () => {
  it('boosts a story mid-sentence and cools recent repeats', () => {
    const bare = fresh()
    const parallax2 = encounterDef('parallax-2')!
    // Continuing the parallax programme outweighs its flat weight.
    const staged: GameState = { ...bare, flags: ['parallax-1'] }
    expect(shapedWeight(parallax2, staged)).toBeGreaterThan(parallax2.weight)

    const trader = encounterDef('gasbag-trader')!
    const justSeen: GameState = {
      ...bare,
      recent: [{ id: 'gasbag-trader', tag: 'contact', day: 3 }],
    }
    expect(shapedWeight(trader, justSeen)).toBeLessThan(trader.weight)

    const otherContact = encounterDef('song-map')!
    expect(shapedWeight(otherContact, justSeen)).toBeLessThan(otherContact.weight)
  })

  it('idle days in-system can roll an encounter — a due hunter finds a sitting ship', () => {
    const base = fresh()
    const giant = base.galaxy.systems.find((s) => s.features.includes('gas-giant'))!
    const state: GameState = {
      ...base,
      day: 20,
      ship: { at: giant.id, fuel: 10 },
      pending: [{ id: 'friendly-pirate', notBefore: 15 }],
    }
    const { state: next } = reduce(state, { type: 'scoop' })
    expect(next.encounter?.id).toBe('friendly-pirate')
    expect(next.pending).toEqual([])
  })

  it('records recents, capped, newest last', () => {
    const state = fresh()
    let current: GameState = { ...state }
    // Force six encounters through the reducer roll by seeding pendings.
    for (let i = 0; i < 3; i++) {
      current = {
        ...current,
        day: current.day + 10,
        pending: [{ id: 'friendly-pirate', notBefore: 0 }],
        flags: current.flags.filter((f) => f !== doneFlag('friendly-pirate')),
        encounter: null,
      }
      const neighbour = current.galaxy.adjacency[current.ship.at]![0]!
      current = reduce({ ...current, ship: { ...current.ship, fuel: 80 } }, { type: 'travel', to: neighbour }).state
    }
    expect(current.recent.length).toBeGreaterThanOrEqual(3)
    expect(current.recent.length).toBeLessThanOrEqual(6)
    expect(current.recent[current.recent.length - 1]!.id).toBe('friendly-pirate')
  })

  it('selection with shaped weights stays deterministic', () => {
    const state: GameState = {
      ...fresh(),
      recent: [{ id: 'song-map', tag: 'contact', day: 2 }],
    }
    const a = chooseEncounter(state, state.galaxy.start, createRng('p'))
    const b = chooseEncounter(state, state.galaxy.start, createRng('p'))
    expect(a?.def.id).toBe(b?.def.id)
  })
})
