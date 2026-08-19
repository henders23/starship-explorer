import { describe, expect, it } from 'vitest'
import {
  battleParams,
  buildContact,
  contactChance,
  CONTACT_GRACE_DAYS,
  enemyClass,
  hasIntelOn,
  ORDNANCE_MAX,
  TOLL_FUEL,
  type CombatEnemy,
} from '../src/engine/combat/combat.js'
import { classPool, ENEMY_LAYOUTS, SHIP_BY_ID, SHIP_CLASSES } from '../src/engine/combat/ships.js'
import { createRng } from '../src/engine/rng/prng.js'
import { newGame, reduce, reduceAll } from '../src/engine/state/reducer.js'
import type { Action, GameState } from '../src/engine/state/types.js'
import { GalaxyIndex } from '../src/engine/worldgen/index-galaxy.js'

const SEED = 'combat-tests'

const run = (from: GameState, ...actions: Action[]) => reduceAll(from, actions).state

/** A hand-built interception at the ship's position, for testing resolution. */
function inCombat(state: GameState, enemy?: Partial<CombatEnemy>): GameState {
  const index = new GalaxyIndex(state.galaxy)
  const rng = createRng('test-contact')
  const built = buildContact(rng, state, state.ship.at, index)
  return {
    ...state,
    combats: state.combats + 1,
    combat: { at: state.ship.at, enemy: { ...built, ...enemy }, phase: 'contact', toll: TOLL_FUEL },
  }
}

/** Same, already at battle stations. */
function inBattle(state: GameState, enemy?: Partial<CombatEnemy>): GameState {
  const s = inCombat(state, enemy)
  return { ...s, combat: { ...s.combat!, phase: 'battle' } }
}

describe('the catalog', () => {
  it('every class has art, guns, and a sane statline', () => {
    for (const cls of SHIP_CLASSES) {
      expect(cls.sprite).toMatch(/^\/assets\/ships\/enemy-\d\d\.png$/)
      expect(cls.guns.length).toBeGreaterThan(0)
      expect(cls.hull).toBeGreaterThan(0)
      expect(cls.shields).toBeGreaterThanOrEqual(0)
      expect(cls.shields).toBeLessThanOrEqual(2)
    }
  })

  it('every archetype fields tier-1 ships, and tier 2 only under escalation', () => {
    for (const archetype of ['raider', 'militant-patrol', 'mercantile-combine', 'xenophobic-polity', 'scavenger-clan', 'monastic-order'] as const) {
      const early = classPool(archetype, 1)
      expect(early.length).toBeGreaterThan(0)
      expect(early.every((s) => s.tier === 1)).toBe(true)
      expect(classPool(archetype, 2).length).toBeGreaterThanOrEqual(early.length)
    }
  })

  it('every class carries an interior plan, and archetypes read differently', () => {
    for (const cls of SHIP_CLASSES) {
      const plan = ENEMY_LAYOUTS[cls.layout]
      expect(plan).toBeDefined()
      for (const key of ['helm', 'weapons', 'shields', 'engines'] as const) {
        expect(plan[key].w).toBeGreaterThan(0)
        expect(cls.rooms[key]).toBeGreaterThan(0)
      }
    }
    // The faction families do not all share one plan any more.
    expect(new Set(SHIP_CLASSES.map((c) => c.layout)).size).toBeGreaterThanOrEqual(5)
  })

  it('the flagship is tier 3: every navy holds it back until deep escalation', () => {
    const flagship = SHIP_BY_ID['sovereign']!
    expect(flagship.tier).toBe(3)
    expect(flagship.layout).toBe('flagship')
    for (const archetype of ['militant-patrol', 'mercantile-combine', 'xenophobic-polity', 'scavenger-clan', 'monastic-order'] as const) {
      expect(classPool(archetype, 2).some((s) => s.id === 'sovereign')).toBe(false)
      expect(classPool(archetype, 3).some((s) => s.id === 'sovereign')).toBe(true)
    }
    // Raiders never field it: theirs is a business, not a navy.
    expect(classPool('raider', 3).some((s) => s.id === 'sovereign')).toBe(false)
  })

  it('contacts pick a class deterministically and name faction ships properly', () => {
    const state = newGame(SEED)
    const index = new GalaxyIndex(state.galaxy)
    const factionSystem = index.systems.find((s) => s.faction !== null)!
    const a = buildContact(createRng('x'), state, factionSystem.id, index)
    const b = buildContact(createRng('x'), state, factionSystem.id, index)
    expect(a).toEqual(b)
    expect(a.faction).toBe(factionSystem.faction)
    expect(enemyClass(a)).toBe(SHIP_BY_ID[a.classId])
    expect(a.name).toContain(' of ')

    const wild = index.systems.find((s) => s.faction === null)!
    const raider = buildContact(createRng('x'), state, wild.id, index)
    expect(raider.faction).toBeNull()
    expect(enemyClass(raider).tier).toBe(1)
  })
})

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

  it('engage goes to battle stations; toll can be paid or refused into battle', () => {
    const state = inCombat(newGame(SEED))
    const engaged = run(state, { type: 'combatContact', choice: 'engage' })
    expect(engaged.combat?.phase).toBe('battle')

    const atToll: GameState = { ...state, combat: { ...state.combat!, phase: 'toll' } }
    const paid = run(atToll, { type: 'combatToll', pay: true })
    expect(paid.combat).toBeNull()
    expect(paid.ship.fuel).toBe(state.ship.fuel - TOLL_FUEL)
    const refused = run(atToll, { type: 'combatToll', pay: false })
    expect(refused.combat?.phase).toBe('battle')

    const broke: GameState = { ...atToll, ship: { ...atToll.ship, fuel: TOLL_FUEL } }
    expect(reduce(broke, { type: 'combatToll', pay: true }).state).toBe(broke)
  })
})

describe('battle parameters', () => {
  it('derive weapons from research, pace from crew, ammo from the magazine', () => {
    const base = newGame(SEED)
    const index = new GalaxyIndex(base.galaxy)
    const plain = battleParams(base, index)
    expect(plain.hull).toBe(100)
    expect(plain.missiles).toBe(ORDNANCE_MAX)
    expect(plain.hasIon).toBe(false)
    expect(plain.hasBeam).toBe(false)

    const armed: GameState = {
      ...base,
      tech: { researched: ['fire-control', 'ion-disruptor', 'focus-beam'], active: null },
      recruits: { sites: {}, aboard: [{ name: 'T', focus: 'gunnery' }] },
    }
    const kitted = battleParams(armed, index)
    expect(kitted.hasIon).toBe(true)
    expect(kitted.hasBeam).toBe(true)
    expect(kitted.chargeMult).toBeCloseTo(1.35)
  })
})

describe('battle resolution', () => {
  it('victory persists the hull and the magazine, and pays salvage', () => {
    const state = inBattle({ ...newGame(SEED), ship: { ...newGame(SEED).ship, fuel: 50 } })
    const { state: after, events } = reduce(state, {
      type: 'combatResolve', result: 'victory', hullLeft: 61, missilesLeft: 4,
    })
    expect(after.combat).toBeNull()
    expect(after.ship.hull).toBe(61)
    expect(after.ordnance).toBe(4)
    expect(after.ship.fuel).toBe(58)
    expect(events.some((e) => e.type === 'combatResolved' && e.result === 'destroyed-them')).toBe(true)
    // Gunnery experience for a fight fought and won.
    expect(after.roster.find((o) => o.role === 'security')!.xp).toBeGreaterThan(0)
  })

  it('defeat is the end of everything', () => {
    const state = inBattle(newGame(SEED))
    const after = run(state, { type: 'combatResolve', result: 'defeat', hullLeft: 0, missilesLeft: 2 })
    expect(after.outcome).toBe('destroyed')
    expect(after.ship.hull).toBe(0)
    expect(after.log[after.log.length - 1]!.kind).toBe('ending')
    expect(reduce(after, { type: 'consult' }).state).toBe(after)
  })

  it('clamps whatever the sim reports', () => {
    const state = inBattle(newGame(SEED))
    const after = run(state, { type: 'combatResolve', result: 'fled', hullLeft: 900, missilesLeft: 99 })
    expect(after.ship.hull).toBe(100)
    expect(after.ordnance).toBe(ORDNANCE_MAX)
  })

  it('a yield without intelligence settles as a plain victory', () => {
    const base = newGame(SEED)
    const state = inBattle(base, { faction: 'made-up-faction' })
    const { events } = reduce(state, {
      type: 'combatResolve', result: 'yielded', hullLeft: 80, missilesLeft: 5,
    })
    expect(events.some((e) => e.type === 'combatResolved' && e.result === 'destroyed-them')).toBe(true)
  })

  it('resolve is refused outside the battle phase', () => {
    const state = inCombat(newGame(SEED))
    expect(
      reduce(state, { type: 'combatResolve', result: 'victory', hullLeft: 80, missilesLeft: 5 }).state,
    ).toBe(state)
  })
})

describe('intelligence', () => {
  function informed(base: GameState): { state: GameState; faction: string } | null {
    const index = new GalaxyIndex(base.galaxy)
    for (const clue of base.mystery.clues) {
      const faction = index.system(clue.source.at).faction
      if (faction) return { state: { ...base, collected: [clue.id] }, faction }
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
    const state = inCombat(found.state, { faction: found.faction })
    const after = run(state, { type: 'combatContact', choice: 'hail' })
    expect(after.combat).toBeNull()
    expect(after.ship.hull).toBe(100)
    expect(after.log.some((l) => l.text.includes('alters course away'))).toBe(true)
  })

  it('a legal yield pays tribute and grants gunnery experience', () => {
    const base = newGame(SEED)
    const found = informed(base)
    if (!found) return
    const state = inBattle({ ...found.state, ship: { ...found.state.ship, fuel: 40 } }, { faction: found.faction })
    const { state: after, events } = reduce(state, {
      type: 'combatResolve', result: 'yielded', hullLeft: 70, missilesLeft: 8,
    })
    expect(after.combat).toBeNull()
    expect(after.ship.fuel).toBe(48)
    expect(events.some((e) => e.type === 'combatResolved' && e.result === 'yielded')).toBe(true)
  })
})

describe('the yard', () => {
  it('restocks the magazine with the refit', () => {
    const base = newGame(SEED)
    const index = new GalaxyIndex(base.galaxy)
    const yard = index.systems.find((s) => s.faction !== null)!
    const spent: GameState = {
      ...base,
      ship: { at: yard.id, fuel: 60, hull: 55 },
      ordnance: 2,
    }
    const after = run(spent, { type: 'refit' })
    expect(after.ship.hull).toBe(100)
    expect(after.ordnance).toBe(ORDNANCE_MAX)
  })
})
