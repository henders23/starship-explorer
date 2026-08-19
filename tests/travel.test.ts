import { describe, expect, it } from 'vitest'
import { newGame, reduce, isStranded } from '../src/engine/state/reducer.js'
import type { GameState } from '../src/engine/state/types.js'
import {
  canScoop,
  cheapestLaneOut,
  DERELICT_FUEL_SALVAGE,
  FUEL_MAX,
  laneCost,
  LONG_JUMP_RESERVE,
  routeTo,
} from '../src/engine/travel/travel.js'
import { GalaxyIndex } from '../src/engine/worldgen/index-galaxy.js'

const SEED = 'travel-tests'

function fresh(): { state: GameState; index: GalaxyIndex } {
  // Rift tech pre-built: this suite is about fuel and lanes, not the tracks.
  const state: GameState = {
    ...newGame(SEED),
    tech: { researched: ['rift-drive', 'rift-shield'], active: null },
  }
  return { state, index: new GalaxyIndex(state.galaxy) }
}

describe('routes', () => {
  it('starts with a full tank at the arrival point', () => {
    const { state } = fresh()
    expect(state.ship).toEqual({ at: state.galaxy.start, fuel: FUEL_MAX, hull: 100 })
  })

  it('plots the same route for the same request, and prices it as its lanes', () => {
    const { state, index } = fresh()
    const target = index.systems[index.systems.length - 1]!.id
    const a = routeTo(index, state.galaxy.start, target)
    const b = routeTo(index, state.galaxy.start, target)
    expect(a).toEqual(b)
    expect(a).not.toBeNull()

    let total = 0
    for (let i = 1; i < a!.path.length; i++) {
      // Every step must be an actual lane, and the cost must be their sum.
      expect(index.neighbours(a!.path[i - 1]!)).toContain(a!.path[i]!)
      total += laneCost(index, a!.path[i - 1]!, a!.path[i]!)
    }
    expect(a!.cost).toBe(total)
  })

  it('never plots a costlier route than a direct lane', () => {
    const { state, index } = fresh()
    for (const neighbour of index.neighbours(state.galaxy.start)) {
      const route = routeTo(index, state.galaxy.start, neighbour)!
      expect(route.cost).toBeLessThanOrEqual(laneCost(index, state.galaxy.start, neighbour))
    }
  })
})

describe('travel', () => {
  it('moves the ship, spends fuel, and logs the trip', () => {
    const { state, index } = fresh()
    const neighbour = index.neighbours(state.galaxy.start)[0]!
    const cost = laneCost(index, state.galaxy.start, neighbour)

    const { state: after, events } = reduce(state, { type: 'travel', to: neighbour })
    expect(after.ship.at).toBe(neighbour)
    expect(after.ship.fuel).toBe(FUEL_MAX - cost)
    expect(after.selected).toBe(neighbour)
    expect(events[0]).toMatchObject({ type: 'traveled', to: neighbour, fuelSpent: cost })
  })

  it('refuses a trip the tank cannot cover', () => {
    const { state, index } = fresh()
    const neighbour = index.neighbours(state.galaxy.start)[0]!
    const broke: GameState = { ...state, ship: { ...state.ship, fuel: 1, hull: 100 } }
    expect(reduce(broke, { type: 'travel', to: neighbour }).state).toBe(broke)
  })

  it('refuses to travel to where it already is', () => {
    const { state } = fresh()
    expect(reduce(state, { type: 'travel', to: state.ship.at }).state).toBe(state)
  })

  it('gates evidence collection on presence', () => {
    const { state } = fresh()
    const elsewhere = state.mystery.clues.find((c) => c.source.at !== state.ship.at)!
    const { state: after } = reduce(state, { type: 'search', system: elsewhere.source.at })
    expect(after).toBe(state)
  })
})

describe('scooping', () => {
  it('refills the tank at a gas giant, and only there', () => {
    const { state, index } = fresh()
    const giant = index.systems.find((s) => s.features.includes('gas-giant'))!
    const barren = index.systems.find((s) => !s.features.includes('gas-giant'))!

    const atGiant: GameState = { ...state, ship: { at: giant.id, fuel: 10, hull: 100 } }
    const { state: full, events } = reduce(atGiant, { type: 'scoop' })
    expect(full.ship.fuel).toBe(FUEL_MAX)
    expect(events).toEqual([{ type: 'scooped', at: giant.id }])

    const atBarren: GameState = { ...state, ship: { at: barren.id, fuel: 10, hull: 100 } }
    expect(reduce(atBarren, { type: 'scoop' }).state).toBe(atBarren)
  })

  it('does nothing with a full tank', () => {
    const { state, index } = fresh()
    const giant = index.systems.find((s) => s.features.includes('gas-giant'))!
    const atGiant: GameState = { ...state, ship: { at: giant.id, fuel: FUEL_MAX, hull: 100 } }
    expect(reduce(atGiant, { type: 'scoop' }).state).toBe(atGiant)
  })
})

describe('the Long Jump under the fuel clock', () => {
  it('is refused without the reserve', () => {
    const { state } = fresh()
    const broke: GameState = { ...state, ship: { ...state.ship, fuel: LONG_JUMP_RESERVE - 1, hull: 100 } }
    expect(reduce(broke, { type: 'plotTheJump', target: state.mystery.gateway }).state).toBe(broke)
  })

  it('a wrong guess displaces the ship far from the target with a near-dry tank', () => {
    const { state, index } = fresh()
    const wrong = state.mystery.decoy
    const { state: after, events } = reduce(state, { type: 'plotTheJump', target: wrong })

    expect(after.outcome).toBe('seeking')
    expect(after.ship.at).not.toBe(wrong)
    expect(index.jumps(wrong, after.ship.at)).toBeGreaterThanOrEqual(5)
    expect(after.ship.fuel).toBeLessThanOrEqual(25)
    expect(events[0]).toMatchObject({ type: 'jumpFailed', displacedTo: after.ship.at })

    // Deterministic: the same wrong guess lands in the same strange sky.
    const again = reduce(state, { type: 'plotTheJump', target: wrong })
    expect(again.state.ship.at).toBe(after.ship.at)
  })
})

describe('derelict salvage', () => {
  it('draining a swept derelict adds fuel', () => {
    // Probe seeds until a clean/messy derelict mission lands, then check fuel.
    for (let i = 0; i < 80; i++) {
      const state = newGame(`salvage-${i}`)
      const derelict = state.mystery.clues.find((c) => c.source.kind === 'derelict-log')
      if (!derelict) continue
      const placed: GameState = { ...state, ship: { at: derelict.source.at, fuel: 40, hull: 100 } }
      const { state: after, events } = reduce(placed, {
        type: 'runMission',
        system: derelict.source.at,
        team: { captain: false, officers: ['security'], escorts: 4, hands: 0 },
        approach: 'cutting',
      })
      const salvaged = events.find((e) => e.type === 'fuelSalvaged')
      if (salvaged) {
        expect(after.ship.fuel).toBe(Math.min(FUEL_MAX, 40 + DERELICT_FUEL_SALVAGE))
        return
      }
    }
    throw new Error('no successful derelict mission across 80 seeds')
  })
})

describe('stranding — the long silence', () => {
  /**
   * A place to die quietly: no gas giant, no derelict evidence, and at least
   * one lane in (so the ship can legitimately arrive there broke).
   */
  function quietGrave(state: GameState, index: GalaxyIndex): string | null {
    for (const system of index.systems) {
      if (system.features.includes('gas-giant')) continue
      if (
        state.mystery.clues.some(
          (c) =>
            c.source.at === system.id &&
            c.source.kind === 'derelict-log' &&
            !state.collected.includes(c.id),
        )
      )
        continue
      if (index.neighbours(system.id).length > 0) return system.id
    }
    return null
  }

  it('declares the ending on the transition that closes the trap', () => {
    const { state, index } = fresh()
    const grave = quietGrave(state, index)
    expect(grave).not.toBeNull()

    const neighbour = index.neighbours(grave!)[0]!
    const cost = laneCost(index, neighbour, grave!)

    // Arrive with exactly the lane's cost: the tank hits zero on arrival.
    const doomed: GameState = { ...state, ship: { at: neighbour, fuel: cost, hull: 100 } }
    const { state: after, events } = reduce(doomed, { type: 'travel', to: grave! })

    expect(after.ship.at).toBe(grave)
    expect(after.ship.fuel).toBe(0)
    expect(after.outcome).toBe('stranded')
    expect(events.some((e) => e.type === 'strandedDeclared')).toBe(true)
    expect(after.log[after.log.length - 1]!.kind).toBe('ending')

    // A stranded ship accepts no further orders.
    expect(reduce(after, { type: 'travel', to: neighbour }).state).toBe(after)
    expect(reduce(after, { type: 'plotTheJump', target: state.mystery.gateway }).state).toBe(after)
  })

  it('is not stranded wherever fuel, a scoop, a lane or the rift remains', () => {
    const { state, index } = fresh()

    // Full tank at the start: obviously not stranded.
    expect(isStranded(state, index)).toBe(false)

    // Broke, but at a gas giant: the scoop is the way out.
    const giant = index.systems.find((s) => s.features.includes('gas-giant'))!
    expect(
      isStranded({ ...state, ship: { at: giant.id, fuel: 0, hull: 100 } }, index),
    ).toBe(false)

    // Holding the Long Jump reserve: the rift is always an option.
    const grave = quietGrave(state, index)!
    expect(
      isStranded({ ...state, ship: { at: grave, fuel: LONG_JUMP_RESERVE, hull: 100 } }, index),
    ).toBe(false)

    // Enough for the cheapest lane out: still moving.
    const lane = cheapestLaneOut(index, grave)
    if (Number.isFinite(lane) && lane < LONG_JUMP_RESERVE) {
      expect(isStranded({ ...state, ship: { at: grave, fuel: lane, hull: 100 } }, index)).toBe(false)
    }
  })

  it('counts an uncollected derelict here as a way out', () => {
    const { state, index } = fresh()
    const derelict = state.mystery.clues.find((c) => c.source.kind === 'derelict-log')
    if (!derelict) return
    const site = index.system(derelict.source.at)
    if (site.features.includes('gas-giant')) return // scoop already saves it
    expect(
      isStranded({ ...state, ship: { at: site.id, fuel: 0, hull: 100 } }, index),
    ).toBe(false)
  })
})

describe('scoop helpers', () => {
  it('canScoop matches the gas-giant feature exactly', () => {
    const { index } = fresh()
    for (const system of index.systems) {
      expect(canScoop(index, system.id)).toBe(system.features.includes('gas-giant'))
    }
  })
})
