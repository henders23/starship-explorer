import { describe, expect, it } from 'vitest'
import {
  COMBAT_STATIONS,
  ENEMY_CLASSES,
  helmEvadeBonus,
  playerWeaponsFor,
  weaponsChargeBoost,
} from '../src/engine/combat/ships.js'
import { newGame, reduce } from '../src/engine/state/reducer.js'
import type { GameState } from '../src/engine/state/types.js'

const SEED = 'combat-tests'

function inBattle(overrides?: Partial<GameState>): GameState {
  const state = newGame(SEED)
  return {
    ...state,
    hull: 30,
    combat: {
      enemy: 'corsair',
      seed: `${SEED}:combat:test`,
      label: 'Test engagement',
      rewards: { fuel: 6, data: 3, shareClues: 1 },
      withdrawFollowUp: { id: 'corsair-ambush', days: [3, 6] },
    },
    ...overrides,
  }
}

describe('the loadout', () => {
  it('grows with the warfare tree', () => {
    expect(playerWeaponsFor([]).map((w) => w.kind)).toEqual(['laser', 'missile'])
    expect(playerWeaponsFor(['war-ion']).map((w) => w.kind)).toEqual(['laser', 'missile', 'ion'])
    expect(playerWeaponsFor(['war-ion', 'war-beam']).map((w) => w.kind)).toEqual([
      'laser',
      'missile',
      'ion',
      'beam',
    ])
  })

  it('defines every enemy class the encounters can order', () => {
    for (const cls of Object.values(ENEMY_CLASSES)) {
      expect(cls.hull).toBeGreaterThan(0)
      expect(cls.guns.length).toBeGreaterThan(0)
      expect(cls.shields).toBeGreaterThanOrEqual(0)
      expect(cls.shields).toBeLessThanOrEqual(2)
    }
  })
})

describe('battle stations', () => {
  it('defines a station per officer, with the passive medbay last', () => {
    expect(COMBAT_STATIONS.map((s) => s.role)).toEqual(['captain', 'security', 'science', 'medical'])
    expect(COMBAT_STATIONS.find((s) => s.role === 'medical')?.room).toBeNull()
    expect(helmEvadeBonus(3)).toBeGreaterThan(helmEvadeBonus(1))
    expect(weaponsChargeBoost(5)).toBeGreaterThan(weaponsChargeBoost(1))
    expect(weaponsChargeBoost(1)).toBeGreaterThan(1)
  })

  it('wounds taken at stations reach the medbay through the verdict', () => {
    const state = inBattle()
    const { state: next, events } = reduce(state, {
      type: 'resolveCombat',
      result: 'victory',
      hull: 20,
      injured: ['science'],
    })
    const science = next.roster.find((o) => o.role === 'science')!
    expect(science.status).toBe('injured')
    // A fit medical officer halves the stay: 6 days from the resolution day.
    expect(science.healedAfter).toBe(state.day + 6)
    expect(events.some((e) => e.type === 'officerInjured' && e.role === 'science')).toBe(true)
    expect(next.log.some((l) => l.text.includes('medbay'))).toBe(true)
  })

  it('a wounded medical officer means everyone heals the slow way', () => {
    const state = inBattle()
    const { state: next } = reduce(state, {
      type: 'resolveCombat',
      result: 'withdrawn',
      hull: 12,
      injured: ['medical', 'captain'],
    })
    expect(next.roster.find((o) => o.role === 'medical')?.healedAfter).toBe(state.day + 12)
    expect(next.roster.find((o) => o.role === 'captain')?.healedAfter).toBe(state.day + 12)
  })
})

describe('resolution', () => {
  it('is a no-op without a battle to resolve', () => {
    const state = newGame(SEED)
    expect(reduce(state, { type: 'resolveCombat', result: 'victory', hull: 20 }).state).toBe(state)
  })

  it('victory pays the promised rewards, keeps the surviving hull, and costs a day', () => {
    const state = inBattle({ ship: { at: newGame(SEED).ship.at, fuel: 40 } })
    const { state: next, events } = reduce(state, { type: 'resolveCombat', result: 'victory', hull: 21 })
    expect(next.combat).toBeNull()
    // A day of repairs follows the fight: 21 surviving +1.
    expect(next.hull).toBe(22)
    expect(next.ship.fuel).toBe(46)
    expect(next.data).toBe(3)
    expect(next.collected.length).toBe(1)
    expect(next.day).toBe(state.day + 1)
    expect(events.some((e) => e.type === 'combatEnded' && e.result === 'victory')).toBe(true)
  })

  it('withdrawal costs fuel and reschedules the hunter', () => {
    const state = inBattle({ ship: { at: newGame(SEED).ship.at, fuel: 40 } })
    const { state: next } = reduce(state, { type: 'resolveCombat', result: 'withdrawn', hull: 12 })
    expect(next.combat).toBeNull()
    expect(next.ship.fuel).toBe(34)
    const pending = next.pending.find((p) => p.id === 'corsair-ambush')!
    expect(pending.notBefore).toBeGreaterThanOrEqual(state.day + 3)
    expect(pending.notBefore).toBeLessThanOrEqual(state.day + 6)
  })

  it('defeat is the end of the ship', () => {
    const state = inBattle()
    const { state: next, events } = reduce(state, { type: 'resolveCombat', result: 'defeat', hull: 0 })
    expect(next.outcome).toBe('destroyed')
    expect(next.hull).toBe(0)
    expect(events.some((e) => e.type === 'shipDestroyed')).toBe(true)
    // The ending is final: nothing reduces past it.
    const after = reduce(next, { type: 'resolveCombat', result: 'victory', hull: 10 }).state
    expect(after).toBe(next)
  })

  it('resolution is replay-safe: the outcome rides the action, not the dice', () => {
    const state = inBattle()
    const a = reduce(state, { type: 'resolveCombat', result: 'victory', hull: 17 })
    const b = reduce(state, { type: 'resolveCombat', result: 'victory', hull: 17 })
    expect(a.state).toEqual(b.state)
  })
})
