import { describe, expect, it } from 'vitest'
import { contactChance, HULL_MAX, ORDNANCE_MAX } from '../src/engine/combat/combat.js'
import { castTransit } from '../src/engine/encounters/transit.js'
import { newGame, reduceAll } from '../src/engine/state/reducer.js'
import type { Action, GameState } from '../src/engine/state/types.js'
import { FUEL_MAX, laneCost, routeTo } from '../src/engine/travel/travel.js'
import { GalaxyIndex } from '../src/engine/worldgen/index-galaxy.js'

/**
 * Per-jump danger and transit events (R11). A journey is flown lane by lane:
 * every lane rolls against the region it enters, and a system the course is
 * only crossing can turn up something worth a day. Anything that happens
 * stops the ship where it happened.
 */
const run = (from: GameState, ...actions: Action[]) => reduceAll(from, actions).state

/** A ship well past the grace days, with a full tank and a surged rift. */
function underWay(seed: string, surges = 3): { state: GameState; index: GalaxyIndex } {
  const base = newGame(seed)
  return {
    state: { ...base, day: 40, surges, ship: { ...base.ship, fuel: FUEL_MAX } },
    index: new GalaxyIndex(base.galaxy),
  }
}

/** The longest route the chart offers from the ship's position. */
function longRoute(state: GameState, index: GalaxyIndex) {
  return index.systems
    .map((s) => routeTo(index, state.ship.at, s.id))
    .filter((r): r is NonNullable<typeof r> => r !== null && r.path.length > 3)
    .sort((a, b) => b.path.length - a.path.length)[0]
}

describe('danger, priced per jump', () => {
  it('rolls against the region entered, not the destination', () => {
    const { state } = underWay('transit-rates')
    // The Shallows stay silent; the Margin is the most dangerous crossing.
    expect(contactChance(state, 'shallows')).toBe(0)
    expect(contactChance(state, 'rift-margin')).toBeGreaterThan(contactChance(state, 'trade-reach'))
    expect(contactChance(state, 'cinder-belt')).toBeGreaterThan(contactChance(state, 'trade-reach'))
  })

  it('a long haul is interrupted somewhere along it, and stops where it happened', () => {
    for (let i = 0; i < 30; i++) {
      const { state, index } = underWay(`transit-cut-${i}`)
      const route = longRoute(state, index)
      if (!route) continue
      const target = route.path[route.path.length - 1]!
      const after = run(state, { type: 'travel', to: target })
      if (after.ship.at === target) continue // this one flew clean; try another

      // Stopped short: on the plotted course, having paid only for the lanes
      // actually crossed, with the chart still pointing at the destination.
      expect(route.path).toContain(after.ship.at)
      expect(after.ship.fuel).toBeGreaterThan(state.ship.fuel - route.cost)
      expect(after.selected).toBe(target)
      // Something caused it: an interception or a find, never silence.
      expect(after.combat !== null || after.encounter !== null).toBe(true)
      return
    }
    throw new Error('no long haul was ever interrupted across 30 seeds')
  })

  it('the grace days are still silent, however far the ship flies', () => {
    for (let i = 0; i < 12; i++) {
      const base = newGame(`transit-grace-${i}`)
      const index = new GalaxyIndex(base.galaxy)
      const state: GameState = { ...base, ship: { ...base.ship, fuel: FUEL_MAX } }
      const route = longRoute(state, index)
      if (!route) continue
      const after = run(state, { type: 'travel', to: route.path[route.path.length - 1]! })
      expect(after.combat).toBeNull()
    }
  })

  it('charges only the lanes it actually crossed', () => {
    const { state, index } = underWay('transit-fuel')
    const route = longRoute(state, index)!
    const target = route.path[route.path.length - 1]!
    const after = run(state, { type: 'travel', to: target })

    const flown = route.path.slice(0, route.path.indexOf(after.ship.at) + 1)
    let base = 0
    for (let i = 1; i < flown.length; i++) base += laneCost(index, flown[i - 1]!, flown[i]!)
    expect(state.ship.fuel - after.ship.fuel).toBe(base)
    // One day per lane crossed, whatever else the transit turned up.
    expect(after.day).toBeGreaterThanOrEqual(state.day + flown.length - 1)
  })
})

describe('what the lanes turn up', () => {
  it('casts deterministically, or not at all', () => {
    const { state, index } = underWay('transit-cast')
    for (const system of index.systems.slice(0, 20)) {
      expect(castTransit(state, system)).toEqual(castTransit(state, system))
    }
  })

  it('offers a day of work and a way to press on', () => {
    for (let i = 0; i < 60; i++) {
      const { state, index } = underWay(`transit-find-${i}`)
      const hurt: GameState = { ...state, ship: { ...state.ship, fuel: 30, hull: 60 }, ordnance: 2 }
      for (const system of index.systems) {
        const find = castTransit(hurt, system)
        if (!find) continue
        expect(find.templateId.startsWith('transit-')).toBe(true)
        expect(find.beats.length).toBeGreaterThan(0)
        expect(find.options.some((o) => o.effect.kind === 'salvage')).toBe(true)
        expect(find.options.some((o) => o.effect.kind === 'dismiss')).toBe(true)
        return
      }
    }
    throw new Error('no transit find cast across 60 seeds')
  })

  it('working a find spends its day and pays its clamped gain', () => {
    const { state, index } = underWay('transit-work')
    const hurt: GameState = { ...state, ship: { ...state.ship, fuel: 20, hull: 50 }, ordnance: 1 }
    for (const system of index.systems) {
      const find = castTransit(hurt, system)
      if (!find) continue
      const salvage = find.options.find((o) => o.effect.kind === 'salvage')!
      const effect = salvage.effect as { days: number; fuel?: number; ordnance?: number; hull?: number }
      const playing: GameState = { ...hurt, ship: { ...hurt.ship, at: system.id }, encounter: find }

      const after = run(playing, { type: 'sceneOption', option: salvage.id })
      expect(after.encounter).toBeNull()
      expect(after.day).toBe(playing.day + effect.days)
      expect(after.ship.fuel).toBe(playing.ship.fuel + (effect.fuel ?? 0))
      expect(after.ship.hull).toBe(Math.min(HULL_MAX, playing.ship.hull + (effect.hull ?? 0)))
      expect(after.ordnance).toBe(Math.min(ORDNANCE_MAX, playing.ordnance + (effect.ordnance ?? 0)))
      return
    }
    throw new Error('no transit find cast to work')
  })

  it('never pays past the ship’s limits', () => {
    const { state, index } = underWay('transit-clamp')
    const full: GameState = {
      ...state,
      ship: { ...state.ship, fuel: FUEL_MAX, hull: HULL_MAX },
      ordnance: ORDNANCE_MAX,
    }
    for (const system of index.systems) {
      const find = castTransit(full, system)
      if (!find) continue
      const salvage = find.options.find((o) => o.effect.kind === 'salvage')
      if (!salvage) continue
      const playing: GameState = { ...full, ship: { ...full.ship, at: system.id }, encounter: find }
      const after = run(playing, { type: 'sceneOption', option: salvage.id })
      expect(after.ship.fuel).toBeLessThanOrEqual(FUEL_MAX)
      expect(after.ship.hull).toBeLessThanOrEqual(HULL_MAX)
      expect(after.ordnance).toBeLessThanOrEqual(ORDNANCE_MAX)
      return
    }
  })

  it('pressing on costs nothing but the chance', () => {
    const { state, index } = underWay('transit-press')
    const hurt: GameState = { ...state, ship: { ...state.ship, fuel: 30, hull: 60 }, ordnance: 2 }
    for (const system of index.systems) {
      const find = castTransit(hurt, system)
      if (!find) continue
      const press = find.options.find((o) => o.effect.kind === 'dismiss')!
      const playing: GameState = { ...hurt, ship: { ...hurt.ship, at: system.id }, encounter: find }
      const after = run(playing, { type: 'sceneOption', option: press.id })
      expect(after.encounter).toBeNull()
      expect(after.day).toBe(playing.day)
      expect(after.ship.fuel).toBe(playing.ship.fuel)
      return
    }
  })

  it('replays exactly: the same course finds the same things', () => {
    const { state, index } = underWay('transit-replay')
    const route = longRoute(state, index)!
    const target = route.path[route.path.length - 1]!
    expect(run(state, { type: 'travel', to: target })).toEqual(
      run(state, { type: 'travel', to: target }),
    )
  })
})
