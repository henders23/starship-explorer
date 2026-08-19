import { describe, expect, it } from 'vitest'
import {
  buildContact,
  contactChance,
  CONTACT_GRACE_DAYS,
  hasIntelOn,
  playerDamage,
  TOLL_FUEL,
} from '../src/engine/combat/combat.js'
import type { CombatState } from '../src/engine/combat/combat.js'
import { createRng } from '../src/engine/rng/prng.js'
import { newGame, reduce, reduceAll } from '../src/engine/state/reducer.js'
import type { Action, GameState } from '../src/engine/state/types.js'
import { GalaxyIndex } from '../src/engine/worldgen/index-galaxy.js'

const SEED = 'combat-tests'

const run = (from: GameState, ...actions: Action[]) => reduceAll(from, actions).state

/** A hand-built interception, for testing resolution without travel RNG. */
function inCombat(state: GameState, overrides?: Partial<CombatState['enemy']>): GameState {
  const index = new GalaxyIndex(state.galaxy)
  const rng = createRng('test-contact')
  const enemy = { ...buildContact(rng, state, state.ship.at, index), ...overrides }
  return {
    ...state,
    combats: state.combats + 1,
    combat: { at: state.ship.at, enemy, phase: 'contact', round: 0, toll: TOLL_FUEL },
  }
}

describe('contacts', () => {
  it('holds fire through the grace days and in the quiet regions', () => {
    const state = newGame(SEED)
    expect(state.day).toBeLessThan(CONTACT_GRACE_DAYS)
    for (const region of ['shallows', 'trade-reach', 'xenoline', 'cinder-belt', 'rift-margin'] as const) {
      expect(contactChance(state, region)).toBe(0)
    }
    const later: GameState = { ...state, day: 20 }
    expect(contactChance(later, 'shallows')).toBe(0)
    expect(contactChance(later, 'rift-margin')).toBeGreaterThan(0)
    // The rift escalates space too.
    const surged: GameState = { ...later, surges: 3 }
    expect(contactChance(surged, 'cinder-belt')).toBeGreaterThan(contactChance(later, 'cinder-belt'))
  })

  it('locks every other action while the interception plays', () => {
    const state = inCombat(newGame(SEED))
    const index = new GalaxyIndex(state.galaxy)
    const neighbour = index.neighbours(state.ship.at)[0]!
    expect(reduce(state, { type: 'travel', to: neighbour }).state).toBe(state)
    expect(reduce(state, { type: 'consult' }).state).toBe(state)
    expect(reduce(state, { type: 'plotTheJump', target: state.mystery.gateway }).state).toBe(state)
  })
})

describe('resolution', () => {
  it('is deterministic: the same fight fought the same way lands the same way', () => {
    const state = inCombat(newGame(SEED))
    const actions: Action[] = [
      { type: 'combatContact', choice: 'engage' },
      { type: 'combatRound', power: 'guns', intent: 'fire' },
      { type: 'combatRound', power: 'shields', intent: 'fire' },
    ]
    const a = reduceAll(state, actions)
    const b = reduceAll(state, actions)
    expect(a.state).toEqual(b.state)
    expect(a.events).toEqual(b.events)
  })

  it('fights to the wreck: volleys land, shields halve, destruction salvages', () => {
    const base = newGame(SEED)
    const state = inCombat(base, { hull: 10, hullMax: 40, guns: 6 })
    const engaged = run(state, { type: 'combatContact', choice: 'engage' })

    const volley = playerDamage(engaged, engaged.roster)
    expect(volley).toBeGreaterThanOrEqual(8)

    const won = run(engaged, { type: 'combatRound', power: 'guns', intent: 'fire' })
    expect(won.combat).toBeNull()
    expect(won.ship.fuel).toBeGreaterThan(Math.min(engaged.ship.fuel, 72)) // wreck salvage
    expect(won.log.some((l) => l.text.includes('comes apart'))).toBe(true)
  })

  it('shields halve the answering volley', () => {
    const base = newGame(SEED)
    const tough = inCombat(base, { hull: 500, hullMax: 500, guns: 10 })
    const engaged = run(tough, { type: 'combatContact', choice: 'engage' })

    const exposed = run(engaged, { type: 'combatRound', power: 'guns', intent: 'fire' })
    const covered = run(engaged, { type: 'combatRound', power: 'shields', intent: 'fire' })
    expect(100 - exposed.ship.hull).toBe(10)
    expect(100 - covered.ship.hull).toBe(5)
  })

  it('can end the run: a hulled ship is lost with all hands', () => {
    const base = newGame(SEED)
    const doomed: GameState = {
      ...inCombat(base, { hull: 500, hullMax: 500, guns: 60 }),
      ship: { ...base.ship, hull: 20 },
    }
    const engaged = run(doomed, { type: 'combatContact', choice: 'engage' })
    const after = run(engaged, { type: 'combatRound', power: 'guns', intent: 'fire' })
    expect(after.outcome).toBe('destroyed')
    expect(after.combat).toBeNull()
    expect(after.log[after.log.length - 1]!.kind).toBe('ending')
    // A destroyed ship accepts no further orders.
    expect(reduce(after, { type: 'consult' }).state).toBe(after)
  })

  it('paying the toll costs fuel and ends it; an empty tank cannot pay', () => {
    const base = newGame(SEED)
    const state: GameState = {
      ...inCombat(base),
      combat: { ...inCombat(base).combat!, phase: 'toll' },
    }
    const paid = run(state, { type: 'combatToll', pay: true })
    expect(paid.combat).toBeNull()
    expect(paid.ship.fuel).toBe(base.ship.fuel - TOLL_FUEL)

    const broke: GameState = { ...state, ship: { ...state.ship, fuel: TOLL_FUEL } }
    expect(reduce(broke, { type: 'combatToll', pay: true }).state).toBe(broke)
  })
})

describe('intelligence', () => {
  /** A state holding collected evidence from inside the enemy's space. */
  function informed(base: GameState): { state: GameState; faction: string } | null {
    const index = new GalaxyIndex(base.galaxy)
    for (const clue of base.mystery.clues) {
      const faction = index.system(clue.source.at).faction
      if (faction) {
        return { state: { ...base, collected: [clue.id] }, faction }
      }
    }
    return null
  }

  it('reads intelligence off collected evidence from a faction\'s space', () => {
    const base = newGame(SEED)
    const index = new GalaxyIndex(base.galaxy)
    const found = informed(base)
    if (!found) return
    expect(hasIntelOn(found.state, index, found.faction)).toBe(true)
    expect(hasIntelOn(base, index, found.faction)).toBe(false)
    expect(hasIntelOn(found.state, index, null)).toBe(false)
  })

  it('a hail backed by intelligence ends the interception without a shot', () => {
    const base = newGame(SEED)
    const found = informed(base)
    if (!found) return
    const state = inCombat(found.state, { faction: found.faction } as never)
    const after = run(state, { type: 'combatContact', choice: 'hail' })
    expect(after.combat).toBeNull()
    expect(after.ship.hull).toBe(100)
    expect(after.log.some((l) => l.text.includes('alters course away'))).toBe(true)
  })

  it('a hurt patrol yields to the informed', () => {
    const base = newGame(SEED)
    const found = informed(base)
    if (!found) return
    const state = inCombat(found.state, {
      faction: found.faction,
      hull: 12,
      hullMax: 100,
      guns: 6,
    } as never)
    const engaged = run(state, { type: 'combatContact', choice: 'engage' })
    const after = run(engaged, { type: 'combatRound', power: 'guns', intent: 'fire' })
    expect(after.combat).toBeNull()
    expect(
      after.log.some((l) => l.text.includes('strike their colours')) ||
        after.log.some((l) => l.text.includes('comes apart')),
    ).toBe(true)
  })
})
