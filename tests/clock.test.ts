import { describe, expect, it } from 'vitest'
import { newGame, reduce, reduceAll, surgeDay } from '../src/engine/state/reducer.js'
import type { Action, GameState } from '../src/engine/state/types.js'
import { GalaxyIndex } from '../src/engine/worldgen/index-galaxy.js'

const SEED = 'clock-tests'

const run = (from: GameState, ...actions: Action[]) => reduceAll(from, actions).state

function fresh(): { state: GameState; index: GalaxyIndex } {
  const state = newGame(SEED)
  return { state, index: new GalaxyIndex(state.galaxy) }
}

/** A one-lane hop the ship can afford, for advancing the clock a day. */
function hop(state: GameState, index: GalaxyIndex): Action {
  const neighbour = index.neighbours(state.ship.at)[0]!
  return { type: 'travel', to: neighbour }
}

describe('the day clock', () => {
  it('travel costs a day per jump, scooping two', () => {
    const { state, index } = fresh()
    const neighbour = index.neighbours(state.galaxy.start)[0]!
    const after = run(state, { type: 'travel', to: neighbour })
    expect(after.day).toBe(state.day + 1)

    const giant = index.systems.find((s) => s.features.includes('gas-giant'))!
    const atGiant: GameState = { ...state, ship: { at: giant.id, fuel: 10 } }
    expect(run(atGiant, { type: 'scoop' }).day).toBe(atGiant.day + 2)
  })
})

describe('the medbay', () => {
  it('discharges the wounded when their day comes, not before', () => {
    const { state, index } = fresh()
    const healDay = state.day + 3
    const wounded: GameState = {
      ...state,
      roster: state.roster.map((o) =>
        o.role === 'security' ? { ...o, status: 'injured' as const, healedAfter: healDay } : o,
      ),
    }

    // Two days pass: still in the medbay.
    let current = run(wounded, hop(wounded, index))
    expect(current.roster.find((o) => o.role === 'security')?.status).toBe('injured')

    // Walk single hops (recomputed each time) until the discharge day.
    for (let guard = 0; guard < 8 && current.day < healDay; guard++) {
      current = run(current, hop(current, index))
    }
    const chief = current.roster.find((o) => o.role === 'security')!
    expect(current.day).toBeGreaterThanOrEqual(healDay)
    expect(chief.status).toBe('fit')
    expect(chief.healedAfter).toBeUndefined()
  })

  it('keeps an injured officer off away teams for the whole stay', () => {
    const { state } = fresh()
    const wounded: GameState = {
      ...state,
      roster: state.roster.map((o) =>
        o.role === 'science' ? { ...o, status: 'injured' as const, healedAfter: state.day + 9 } : o,
      ),
    }
    const site = wounded.mystery.clues.find((c) => c.source.kind === 'ruins-tablet')
    if (!site) return
    const placed: GameState = { ...wounded, ship: { at: site.source.at, fuel: 999 } }
    const refused = reduce(placed, {
      type: 'runMission',
      system: site.source.at,
      team: { captain: false, officers: ['science'], escorts: 0, hands: 0 },
      approach: 'survey',
    })
    expect(refused.state).toBe(placed)
  })
})

describe('the Rift surges', () => {
  it('keeps a deterministic, strictly increasing schedule per seed', () => {
    const days = [0, 1, 2, 3, 4].map((n) => surgeDay(SEED, n))
    for (let i = 1; i < days.length; i++) expect(days[i]!).toBeGreaterThan(days[i - 1]!)
    expect(days).toEqual([0, 1, 2, 3, 4].map((n) => surgeDay(SEED, n)))
    expect(surgeDay('other-seed', 0)).not.toBe(NaN)
  })

  it('fires when the clock crosses the threshold, and never twice', () => {
    const { state, index } = fresh()
    const firstSurge = surgeDay(SEED, 0)

    // Walk the clock right up to the eve of the surge.
    let current: GameState = { ...state, day: firstSurge - 1 }
    expect(current.surges).toBe(0)

    current = run(current, hop(current, index))
    expect(current.day).toBe(firstSurge)
    expect(current.surges).toBe(1)
    expect(current.log.some((l) => l.kind === 'surge')).toBe(true)

    // The next day does not re-fire the same surge.
    const again = run(current, hop(current, index))
    expect(again.surges).toBe(1)
  })

  it('escalates: the fourth surge scars the drive', () => {
    const { state, index } = fresh()
    let current: GameState = {
      ...state,
      day: surgeDay(SEED, 3) - 1,
      surges: 3,
      driveScarred: false,
    }
    current = run(current, hop(current, index))
    expect(current.surges).toBe(4)
    expect(current.driveScarred).toBe(true)
  })
})

describe('the scarred drive and the yard', () => {
  it('charges the 30% premium and the refit clears it', () => {
    const { state, index } = fresh()
    const factionSystem = index.systems.find((s) => s.faction !== null)!
    const scarred: GameState = {
      ...state,
      driveScarred: true,
      ship: { at: factionSystem.id, fuel: 60 },
    }

    const neighbour = index.neighbours(factionSystem.id)[0]!
    const clean: GameState = { ...scarred, driveScarred: false }
    const scarredSpend = 60 - run(scarred, { type: 'travel', to: neighbour }).ship.fuel
    const cleanSpend = 60 - run(clean, { type: 'travel', to: neighbour }).ship.fuel
    expect(scarredSpend).toBe(Math.ceil(cleanSpend * 1.3))

    const refitted = run(scarred, { type: 'refit' })
    expect(refitted.driveScarred).toBe(false)
    expect(refitted.day).toBe(scarred.day + 4)

    // Refits happen in faction yards only.
    const nowhere = index.systems.find((s) => s.faction === null)!
    const adrift: GameState = { ...scarred, ship: { at: nowhere.id, fuel: 60 } }
    expect(reduce(adrift, { type: 'refit' }).state).toBe(adrift)
  })
})

describe('consulting the bridge', () => {
  it('gives working answers from each fit officer', () => {
    const { state } = fresh()
    const { state: after, events } = reduce(state, { type: 'consult' })
    expect(events).toEqual([{ type: 'consulted' }])

    const entry = after.log[after.log.length - 1]!
    expect(entry.kind).toBe('bridge')
    // Science points somewhere real; medical reads the medbay.
    expect(entry.text).toContain('thread')
    expect(entry.text).toContain('Medbay')
  })
})
