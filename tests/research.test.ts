import { describe, expect, it } from 'vitest'
import {
  hullMaxFor,
  laneCostWith,
  longJumpReserveFor,
  riftFuelFloor,
  riftScarsDrive,
  scoopDaysFor,
  TECHS,
  techDef,
} from '../src/engine/research/tech.js'
import { longJumpReserve, newGame, reduce, riftResonance, travelCost } from '../src/engine/state/reducer.js'
import type { GameState } from '../src/engine/state/types.js'

const SEED = 'research-tests'

function fresh(): GameState {
  return { ...newGame(SEED), data: 100 }
}

describe('the trees', () => {
  it('every prerequisite is a defined tech in the same tree', () => {
    for (const def of TECHS) {
      if (def.requires) {
        const parent = techDef(def.requires)
        expect(parent.tree).toBe(def.tree)
      }
    }
  })
})

describe('the research action', () => {
  it('spends data, unlocks the node, and costs two days at the bench', () => {
    const state = fresh()
    const { state: next, events } = reduce(state, { type: 'research', tech: 'drive-injectors' })
    expect(next.unlockedTech).toContain('drive-injectors')
    expect(next.data).toBe(100 - techDef('drive-injectors').cost)
    expect(next.day).toBe(state.day + 2)
    expect(events.some((e) => e.type === 'techResearched')).toBe(true)
  })

  it('refuses without the data, the prerequisite, or a fit science officer', () => {
    const broke: GameState = { ...fresh(), data: 1 }
    expect(reduce(broke, { type: 'research', tech: 'drive-injectors' }).state).toBe(broke)

    const noPrereq = fresh()
    expect(reduce(noPrereq, { type: 'research', tech: 'drive-rift' }).state).toBe(noPrereq)

    const state = fresh()
    const noScience: GameState = {
      ...state,
      roster: state.roster.map((o) => (o.role === 'science' ? { ...o, status: 'dead' as const } : o)),
    }
    expect(reduce(noScience, { type: 'research', tech: 'drive-injectors' }).state).toBe(noScience)
  })

  it('never unlocks the same node twice', () => {
    const once = reduce(fresh(), { type: 'research', tech: 'scan-survey' }).state
    const twice = reduce(once, { type: 'research', tech: 'scan-survey' }).state
    expect(twice).toBe(once)
  })
})

describe('the effects', () => {
  it('resonant injectors price lanes 15% cheaper, before the scarring premium', () => {
    expect(laneCostWith([], 20)).toBe(20)
    expect(laneCostWith(['drive-injectors'], 20)).toBe(17)

    const state = fresh()
    const tuned: GameState = { ...state, unlockedTech: ['drive-injectors'] }
    expect(travelCost(tuned, 20)).toBe(17)
    const scarred: GameState = { ...tuned, driveScarred: true }
    expect(travelCost(scarred, 20)).toBe(Math.ceil(17 * 1.3))
  })

  it('drive research steps the Long Jump reserve down and tames the rift', () => {
    expect(longJumpReserveFor([])).toBe(30)
    expect(longJumpReserveFor(['drive-injectors', 'drive-rift'])).toBe(24)
    expect(longJumpReserveFor(['drive-injectors', 'drive-rift', 'drive-gate'])).toBe(20)
    expect(riftScarsDrive([])).toBe(true)
    expect(riftScarsDrive(['drive-rift'])).toBe(false)
    expect(riftFuelFloor([])).toBe(25)
    expect(riftFuelFloor(['drive-gate'])).toBe(40)

    const state = fresh()
    expect(longJumpReserve(state)).toBe(30)
    expect(longJumpReserve({ ...state, unlockedTech: ['drive-rift'] })).toBe(24)
  })

  it('the survey suite halves scoop time', () => {
    expect(scoopDaysFor([])).toBe(2)
    expect(scoopDaysFor(['scan-survey'])).toBe(1)
  })

  it('armour raises the hull ceiling and the fitting fills the new plate', () => {
    expect(hullMaxFor([])).toBe(30)
    expect(hullMaxFor(['war-armour'])).toBe(36)

    const state: GameState = { ...fresh(), unlockedTech: ['war-ion'] }
    const { state: next } = reduce(state, { type: 'research', tech: 'war-armour' })
    expect(next.hull).toBe(36)
  })

  it('rift tomography names the resonant pair — and only after research', () => {
    const state = fresh()
    expect(riftResonance(state)).toBeNull()

    const seen = riftResonance({
      ...state,
      unlockedTech: ['scan-survey', 'scan-recon', 'scan-triangulate'],
    })
    expect(seen).not.toBeNull()
    expect(seen).toHaveLength(2)
    expect(seen).toContain(state.mystery.gateway)
    expect(seen).toContain(state.mystery.decoy)
    // Sorted, so the order never whispers which is which.
    expect(seen).toEqual([...seen!].sort())
  })
})
