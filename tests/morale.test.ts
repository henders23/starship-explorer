import { describe, expect, it } from 'vitest'
import {
  moraleBand,
  newGame,
  reduce,
  reduceAll,
  surgeDay,
  SUPPLIES_MAX,
  volunteerCap,
} from '../src/engine/state/reducer.js'
import type { Action, GameState } from '../src/engine/state/types.js'
import { GalaxyIndex } from '../src/engine/worldgen/index-galaxy.js'

const SEED = 'morale-tests'

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

  it('drains a supply point per day, and hunger bleeds morale instead', () => {
    const { state, index } = fresh()
    const after = run(state, hop(state, index))
    expect(after.supplies).toBe(state.supplies - 1)

    const starving: GameState = { ...state, supplies: 0 }
    const hungry = run(starving, hop(starving, index))
    expect(hungry.supplies).toBe(0)
    expect(hungry.morale).toBeLessThan(starving.morale)
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

describe('morale and the mutiny', () => {
  it('bands are monotone and complete', () => {
    expect(moraleBand(80)).toBe('steady')
    expect(moraleBand(64)).toBe('uneasy')
    expect(moraleBand(39)).toBe('fractious')
    expect(moraleBand(24)).toBe('mutinous')
  })

  it('a fractious crew volunteers fewer generics, and the reducer enforces it', () => {
    const { state } = fresh()
    const surly: GameState = { ...state, morale: 30 }
    expect(volunteerCap(surly)).toBe(2)

    const hazard = surly.mystery.clues.find((c) => c.source.kind === 'derelict-log')
    if (!hazard) return
    const placed: GameState = { ...surly, ship: { at: hazard.source.at, fuel: 999 } }
    const refused = reduce(placed, {
      type: 'runMission',
      system: hazard.source.at,
      team: { captain: false, officers: [], escorts: 4, hands: 0 },
      approach: 'breach',
    })
    expect(refused.state).toBe(placed)
  })

  it('is two-stage: hitting Mutinous arms the fuse, the next loss fires it', () => {
    const { state, index } = fresh()
    // Hungry and already at the edge: each travelled day bleeds 2 morale.
    const onEdge: GameState = { ...state, morale: 26, supplies: 0 }

    const armed = run(onEdge, hop(onEdge, index))
    expect(armed.morale).toBeLessThan(25)
    expect(armed.mutinyArmed).toBe(true)
    expect(armed.outcome).toBe('seeking')
    expect(armed.log.some((l) => l.text.includes('wardroom'))).toBe(true)

    const taken = run(armed, hop(armed, index))
    expect(taken.outcome).toBe('mutiny')
    expect(taken.log[taken.log.length - 1]!.kind).toBe('ending')

    // A mutinied ship accepts no further orders.
    expect(reduce(taken, hop(taken, index)).state).toBe(taken)
  })

  it('recovering above the line stands the crew down', () => {
    const { state, index } = fresh()
    const armed: GameState = { ...state, morale: 24, mutinyArmed: true, supplies: 100 }
    // Resupply is worth +3 — but we are full; collect evidence instead.
    const social = armed.mystery.clues.find(
      (c) => !['derelict-log', 'ruins-tablet', 'prisoner', 'listening-post'].includes(c.source.kind),
    )!
    const placed: GameState = { ...armed, ship: { at: social.source.at, fuel: 999 } }
    const after = run(placed, { type: 'search', system: social.source.at })
    expect(after.morale).toBeGreaterThanOrEqual(25)
    expect(after.mutinyArmed).toBe(false)
    void index
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
    let current: GameState = { ...state, day: firstSurge - 1, supplies: 100 }
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
      supplies: 100,
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

describe('stores', () => {
  it('resupplies at inhabited or administered systems, for two days and a lift', () => {
    const { state, index } = fresh()
    const port = index.systems.find(
      (s) => s.features.includes('habitable-world') || s.faction !== null,
    )!
    const low: GameState = { ...state, supplies: 20, morale: 50, ship: { at: port.id, fuel: 50 } }

    const { state: after, events } = reduce(low, { type: 'resupply' })
    expect(after.supplies).toBe(SUPPLIES_MAX - 2) // filled, then two days alongside
    expect(after.day).toBe(low.day + 2)
    expect(after.morale).toBeGreaterThan(low.morale)
    expect(events.some((e) => e.type === 'resupplied')).toBe(true)

    // Nowhere to buy from in an empty system.
    const nowhere = index.systems.find(
      (s) => !s.features.includes('habitable-world') && s.faction === null,
    )!
    const adrift: GameState = { ...low, ship: { at: nowhere.id, fuel: 50 } }
    expect(reduce(adrift, { type: 'resupply' }).state).toBe(adrift)
  })
})

describe('consulting the bridge', () => {
  it('gives working answers from each fit officer', () => {
    const { state } = fresh()
    const { state: after, events } = reduce(state, { type: 'consult' })
    expect(events).toEqual([{ type: 'consulted' }])

    const entry = after.log[after.log.length - 1]!
    expect(entry.kind).toBe('bridge')
    // Science points somewhere real; medical reads the stores.
    expect(entry.text).toContain('thread')
    expect(entry.text).toContain('Stores at')
  })

  it('gets nothing from a mutinous crew', () => {
    const { state } = fresh()
    const surly: GameState = { ...state, morale: 20 }
    const after = run(surly, { type: 'consult' })
    const entry = after.log[after.log.length - 1]!
    expect(entry.text).toContain('Nothing to add')
  })
})
