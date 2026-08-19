import { describe, expect, it } from 'vitest'
import { commsTier, requiredTier } from '../src/engine/research/tech.js'
import { newGame, reduce, reduceAll, surgeForecast, surgeDay } from '../src/engine/state/reducer.js'
import type { Action, GameState } from '../src/engine/state/types.js'
import { GalaxyIndex } from '../src/engine/worldgen/index-galaxy.js'

const SEED = 'research-tests'

const run = (from: GameState, ...actions: Action[]) => reduceAll(from, actions).state

const at = (from: GameState, system: string): GameState => ({
  ...from,
  ship: { at: system, fuel: 999 },
})

function hop(state: GameState, index: GalaxyIndex): Action {
  const neighbour = index.neighbours(state.ship.at)[0]!
  return { type: 'travel', to: neighbour }
}

/** Walk the clock n days via single hops. */
function walk(state: GameState, index: GalaxyIndex, days: number): GameState {
  let current = state
  const until = state.day + days
  for (let guard = 0; guard < days * 3 && current.day < until; guard++) {
    current = run(current, hop(current, index))
    if (current.outcome !== 'seeking') break
  }
  return current
}

describe('the bench', () => {
  it('starts a project, ticks it down in the background, and completes it', () => {
    const state = newGame(SEED)
    const index = new GalaxyIndex(state.galaxy)

    const { state: started, events } = reduce(state, { type: 'startResearch', tech: 'comms-1' })
    expect(started.tech.active).toEqual({ id: 'comms-1', daysLeft: 4 })
    expect(events).toEqual([{ type: 'techStarted', tech: 'comms-1' }])

    const done = walk(started, index, 4)
    expect(done.tech.researched).toContain('comms-1')
    expect(done.tech.active).toBeNull()
    expect(commsTier(done)).toBe(1)
    expect(done.log.some((l) => l.text.includes('Translation Matrix I'))).toBe(true)
  })

  it('pauses while the science officer is unfit', () => {
    const state = newGame(SEED)
    const index = new GalaxyIndex(state.galaxy)
    const started = run(state, { type: 'startResearch', tech: 'comms-1' })
    const benched: GameState = {
      ...started,
      roster: started.roster.map((o) =>
        o.role === 'science' ? { ...o, status: 'injured' as const, healedAfter: 999 } : o,
      ),
    }
    const later = walk(benched, index, 3)
    expect(later.tech.active?.daysLeft).toBe(4)
  })

  it('enforces prerequisites and locks', () => {
    const state = newGame(SEED)
    // comms-2 before comms-1: refused.
    expect(reduce(state, { type: 'startResearch', tech: 'comms-2' }).state).toBe(state)
    // The rift projects are locked until their components exist.
    expect(reduce(state, { type: 'startResearch', tech: 'rift-drive' }).state).toBe(state)
    expect(reduce(state, { type: 'startResearch', tech: 'rift-shield' }).state).toBe(state)
    // A researched project cannot be researched again.
    const knew: GameState = { ...state, tech: { researched: ['comms-1'], active: null } }
    expect(reduce(knew, { type: 'startResearch', tech: 'comms-1' }).state).toBe(knew)
  })
})

describe('translation', () => {
  it('alien accounts arrive unreadable below their tier and decode is refused', () => {
    const state = newGame(SEED)
    const alien = state.mystery.clues.find((c) => requiredTier(c.source.kind) === 1 &&
      ['alien-trader'].includes(c.source.kind))
    if (!alien) return

    const placed = run(at(state, alien.source.at), { type: 'openScene' })
    const collect = placed.encounter?.options.find(
      (o) => o.effect.kind === 'collect' && (o.effect.fuel ?? 0) === 0,
    )
    if (!collect) return
    const after = run(placed, { type: 'sceneOption', option: collect.id })

    expect(after.collected).toContain(alien.id)
    expect(after.undecoded).toContain(alien.id)
    // The bench cannot force it below tier.
    expect(reduce(after, { type: 'decode', clue: alien.id }).state).toBe(after)
    // Filing is locked while unreadable.
    const refused = run(after, { type: 'file', clue: alien.id, state: 'trusted' })
    expect(refused.clueStates[alien.id]).toBe('unfiled')
  })

  it('research opens the way: comms-1 makes the same account decodable', () => {
    const state = newGame(SEED)
    const alien = state.mystery.clues.find((c) => requiredTier(c.source.kind) === 1)
    if (!alien) return

    const holding: GameState = {
      ...at(state, alien.source.at),
      collected: [alien.id],
      clueStates: { [alien.id]: 'unfiled' },
      undecoded: [alien.id],
      searched: [alien.source.at],
    }
    // Below tier: refused. At tier: a day of bench time reads it.
    expect(reduce(holding, { type: 'decode', clue: alien.id }).state).toBe(holding)
    const fluent: GameState = { ...holding, tech: { researched: ['comms-1'], active: null } }
    const read = run(fluent, { type: 'decode', clue: alien.id })
    expect(read.undecoded).not.toContain(alien.id)
    expect(read.day).toBe(fluent.day + 1)
  })
})

describe('the other projects', () => {
  it('rift telemetry forecasts the next surge to the day', () => {
    const state = newGame(SEED)
    expect(surgeForecast(state)).toBeNull()
    const instrumented: GameState = { ...state, tech: { researched: ['rift-telemetry'], active: null } }
    expect(surgeForecast(instrumented)).toBe(surgeDay(SEED, 0))
  })

  it('trauma protocols shorten the medbay stay', () => {
    // Drive the clock into surge ordinal 2 (the officer-injury surge) with
    // and without the protocols, and compare the stays.
    const base = newGame(SEED)
    const index = new GalaxyIndex(base.galaxy)
    const eve = (extra: Partial<GameState>): GameState => ({
      ...base,
      ...extra,
      day: surgeDay(SEED, 2) - 1,
      surges: 2,
    })

    const plain = run(eve({}), hop(eve({}), index))
    const treated0 = eve({ tech: { researched: ['trauma-protocols'], active: null } })
    const treated = run(treated0, hop(treated0, index))

    const hurtPlain = plain.roster.find((o) => o.status === 'injured')
    const hurtTreated = treated.roster.find((o) => o.status === 'injured')
    if (!hurtPlain || !hurtTreated) return // this seed's surge cost fuel instead
    const stayPlain = (hurtPlain.healedAfter ?? 0) - plain.day
    const stayTreated = (hurtTreated.healedAfter ?? 0) - treated.day
    expect([6, 12]).toContain(stayPlain)
    expect([4, 8]).toContain(stayTreated)
    expect(stayTreated).toBeLessThan(stayPlain)
  })
})
