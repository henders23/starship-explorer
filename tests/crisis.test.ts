import { describe, expect, it } from 'vitest'
import { CRISIS_PENALTY, shiftOdds } from '../src/engine/missions/crisis.js'
import { approachesFor, approachOdds } from '../src/engine/missions/sites.js'
import { newGame, reduce, reduceAll, sitePlan } from '../src/engine/state/reducer.js'
import type { Action, GameState } from '../src/engine/state/types.js'

/**
 * Mid-mission choice nodes (R9): some missions hold at an authored decision.
 * The crisis blocks everything, the printed shifts are the rolled shifts,
 * needs-gated choices demand their officer, and the resolution rides the
 * existing harm ladder.
 */
const run = (from: GameState, ...actions: Action[]) => reduceAll(from, actions).state

const at = (from: GameState, system: string): GameState => ({
  ...from,
  ship: { at: system, fuel: 999, hull: 100 },
})

function hazardousSystems(state: GameState): string[] {
  const systems = new Set(state.mystery.clues.map((c) => c.source.at))
  return [...systems].filter((s) => sitePlan(state, s).site !== null)
}

/** Launch missions across seeds until one holds at a crisis. */
function findCrisis(): { placed: GameState; held: GameState } {
  for (let i = 0; i < 40; i++) {
    const state = newGame(`crisis-hunt-${i}`)
    for (const system of hazardousSystems(state)) {
      const placed = at(state, system)
      const { site } = sitePlan(placed, system)!
      const approach = approachesFor(site!).find((a) => a.needs === null)!
      const held = run(placed, {
        type: 'runMission',
        system,
        team: { captain: false, officers: ['security', 'science', 'medical'], escorts: 4, hands: 0 },
        approach: approach.id,
      })
      if (held.crisis) return { placed, held }
    }
  }
  throw new Error('no crisis fired across 40 seeds — the chance is broken')
}

describe('the crisis', () => {
  const { held } = findCrisis()

  it('holds the whole ship: nothing but the call resolves', () => {
    expect(held.crisis).not.toBeNull()
    // Travel, research, scenes — all refused while the team holds.
    expect(reduce(held, { type: 'travel', to: held.galaxy.systems[0]!.id }).state).toBe(held)
    expect(reduce(held, { type: 'startResearch', tech: 'comms-1' }).state).toBe(held)
    expect(reduce(held, { type: 'scoop' }).state).toBe(held)
  })

  it('carries the crisis penalty in its standing odds', () => {
    const crisis = held.crisis!
    // The stated odds are the committed odds with the penalty applied — the
    // clean chance dropped, the disaster chance rose.
    expect(crisis.odds.clean + crisis.odds.messy + crisis.odds.disaster).toBe(100)
    expect(CRISIS_PENALTY.clean).toBeLessThan(0)
  })

  it('resolves down the ladder on the call, and the crisis clears', () => {
    const crisis = held.crisis!
    const press = crisis.choices.find((c) => !c.needs)!
    const { state: after, events } = reduce(held, { type: 'crisisCall', choice: press.id })

    expect(after.crisis).toBeNull()
    expect(events.some((e) => e.type === 'missionResolved')).toBe(true)
  })

  it('a slow choice spends its printed day', () => {
    const crisis = held.crisis!
    const slow = crisis.choices.find((c) => c.days > 0 && !c.needs)
    if (!slow) return
    const after = run(held, { type: 'crisisCall', choice: slow.id })
    expect(after.day).toBeGreaterThanOrEqual(held.day + slow.days)
  })

  it('refuses a needs-gated call when the officer is not on the team', () => {
    const crisis = held.crisis!
    const gated = crisis.choices.find((c) => c.needs)
    if (!gated) return
    const shorthanded: GameState = {
      ...held,
      crisis: { ...crisis, team: { ...crisis.team, officers: [] } },
    }
    expect(reduce(shorthanded, { type: 'crisisCall', choice: gated.id }).state).toBe(shorthanded)
  })

  it('refuses an unknown choice and a call with no crisis standing', () => {
    expect(reduce(held, { type: 'crisisCall', choice: 'nonsense' }).state).toBe(held)
    const calm = newGame('crisis-calm')
    expect(reduce(calm, { type: 'crisisCall', choice: 'press' }).state).toBe(calm)
  })

  it('replays exactly: the same log holds and resolves the same way', () => {
    const seedRun = (): GameState => {
      const state = newGame('crisis-hunt-0')
      const systems = hazardousSystems(state)
      let current = at(state, systems[0]!)
      const { site } = sitePlan(current, systems[0]!)
      const approach = approachesFor(site!).find((a) => a.needs === null)!
      current = run(current, {
        type: 'runMission',
        system: systems[0]!,
        team: { captain: false, officers: ['security'], escorts: 2, hands: 0 },
        approach: approach.id,
      })
      if (current.crisis) {
        current = run(current, { type: 'crisisCall', choice: current.crisis.choices[0]!.id })
      }
      return current
    }
    expect(seedRun()).toEqual(seedRun())
  })
})

describe('the arithmetic', () => {
  it('shifted odds always sum to one hundred and never go negative', () => {
    const state = newGame('crisis-odds')
    for (const system of hazardousSystems(state)) {
      const { site } = sitePlan(state, system)
      for (const approach of approachesFor(site!)) {
        const base = approachOdds(
          approach,
          { captain: false, officers: ['security', 'science', 'medical'], escorts: 4, hands: 0 },
          state.roster,
          state.loadouts,
        )
        for (const shift of [CRISIS_PENALTY, { clean: 12, disaster: -8 }, { clean: 8, disaster: -6 }]) {
          const shifted = shiftOdds(base, shift)
          expect(shifted.clean + shifted.messy + shifted.disaster).toBe(100)
          expect(shifted.clean).toBeGreaterThanOrEqual(0)
          expect(shifted.messy).toBeGreaterThanOrEqual(0)
          expect(shifted.disaster).toBeGreaterThanOrEqual(0)
        }
      }
    }
  })
})
