import { describe, expect, it } from 'vitest'
import { castScene } from '../src/engine/encounters/templates.js'
import { newGame, reduce, reduceAll, sitePlan } from '../src/engine/state/reducer.js'
import type { Action, GameState } from '../src/engine/state/types.js'
import { GalaxyIndex } from '../src/engine/worldgen/index-galaxy.js'

const SEED = 'encounter-tests'

const run = (from: GameState, ...actions: Action[]) => reduceAll(from, actions).state

/** Teleport helper, as in the other suites: these tests are not about fuel. */
const at = (from: GameState, system: string): GameState => ({
  ...from,
  ship: { at: system, fuel: 999 },
})

function socialSystem(state: GameState): string {
  const clue = state.mystery.clues.find((c) => sitePlan(state, c.source.at).site === null)!
  return clue.source.at
}

function hazardousSystem(state: GameState): string | null {
  for (const clue of state.mystery.clues) {
    if (sitePlan(state, clue.source.at).site !== null) return clue.source.at
  }
  return null
}

describe('casting', () => {
  it('is deterministic: same state, same system, same scene', () => {
    const state = newGame(SEED)
    const system = socialSystem(state)
    expect(castScene(state, system)).toEqual(castScene(state, system))
  })

  it('stays quiet where there is nothing: empty, searched, or swept systems', () => {
    const state = newGame(SEED)
    const empty = state.galaxy.systems.find(
      (s) => !state.mystery.clues.some((c) => c.source.at === s.id),
    )!
    expect(castScene(state, empty.id)).toBeNull()

    const system = socialSystem(state)
    const searched: GameState = { ...state, searched: [system] }
    expect(castScene(searched, system)).toBeNull()
  })

  it('gives hazardous systems a mission option and social systems collect options', () => {
    const state = newGame(SEED)

    const social = castScene(state, socialSystem(state))!
    expect(social.options.some((o) => o.effect.kind === 'collect')).toBe(true)
    expect(social.options.some((o) => o.effect.kind === 'mission')).toBe(false)
    expect(social.options.some((o) => o.effect.kind === 'dismiss')).toBe(true)

    const hazard = hazardousSystem(state)
    if (hazard) {
      const scene = castScene(state, hazard)!
      expect(scene.options.some((o) => o.effect.kind === 'mission')).toBe(true)
      expect(scene.options.some((o) => o.effect.kind === 'collect')).toBe(false)
    }
  })
})

describe('arrival', () => {
  it('opens the scene when the ship reaches a system with content', () => {
    const state = newGame(SEED)
    const index = new GalaxyIndex(state.galaxy)
    const system = socialSystem(state)
    // Park next door so a single real travel lands on the content.
    const neighbour = index.neighbours(system)[0]!
    const placed = at(state, neighbour)

    const { state: after, events } = reduce(placed, { type: 'travel', to: system })
    expect(after.encounter?.at).toBe(system)
    expect(events.some((e) => e.type === 'sceneOpened')).toBe(true)
  })

  it('breaking orbit walks away from the playing scene', () => {
    const state = newGame(SEED)
    const index = new GalaxyIndex(state.galaxy)
    const system = socialSystem(state)
    const opened = run(at(state, system), { type: 'openScene' })
    expect(opened.encounter).not.toBeNull()

    const away = index.neighbours(system).find(
      (n) => !state.mystery.clues.some((c) => c.source.at === n),
    )
    if (!away) return
    const left = run(opened, { type: 'travel', to: away })
    expect(left.encounter).toBeNull()
  })
})

describe('answering', () => {
  it('collect takes the evidence on the option’s terms: days, fuel, closure', () => {
    const state = newGame(SEED)
    const system = socialSystem(state)
    const placed = run(at(state, system), { type: 'openScene' })
    const scene = placed.encounter!
    const collect = scene.options.find((o) => o.effect.kind === 'collect')!
    const effect = collect.effect as { kind: 'collect'; days: number; fuel?: number }

    const { state: after, events } = reduce(placed, { type: 'sceneOption', option: collect.id })
    expect(after.encounter).toBeNull()
    expect(after.searched).toContain(system)
    expect(after.collected.length).toBeGreaterThan(0)
    expect(after.day).toBe(placed.day + effect.days)
    expect(after.ship.fuel).toBe(placed.ship.fuel - (effect.fuel ?? 0))
    expect(events.some((e) => e.type === 'sceneClosed')).toBe(true)
    expect(events.some((e) => e.type === 'evidenceFound')).toBe(true)
  })

  it('a fuel-priced option is refused when it would drain the tank', () => {
    const state = newGame(SEED)
    // Find a scene with a fuel-priced option, across a few seeds if needed.
    for (const seed of [SEED, 'enc-2', 'enc-3', 'enc-4']) {
      const fresh = newGame(seed)
      const system = socialSystem(fresh)
      const placed = run(at(fresh, system), { type: 'openScene' })
      const priced = placed.encounter?.options.find(
        (o) => o.effect.kind === 'collect' && (o.effect.fuel ?? 0) > 0,
      )
      if (!priced) continue
      const broke: GameState = { ...placed, ship: { ...placed.ship, fuel: 2 } }
      expect(reduce(broke, { type: 'sceneOption', option: priced.id }).state).toBe(broke)
      return
    }
    void state
    throw new Error('no fuel-priced option found across seeds')
  })

  it('dismiss closes the scene and openScene brings it back', () => {
    const state = newGame(SEED)
    const system = socialSystem(state)
    const placed = run(at(state, system), { type: 'openScene' })
    const dismiss = placed.encounter!.options.find((o) => o.effect.kind === 'dismiss')!

    const closed = run(placed, { type: 'sceneOption', option: dismiss.id })
    expect(closed.encounter).toBeNull()
    expect(closed.searched).not.toContain(system)

    const reopened = run(closed, { type: 'openScene' })
    expect(reopened.encounter?.at).toBe(system)
  })

  it('the mission option closes the scene and leaves the site runnable', () => {
    const state = newGame(SEED)
    const hazard = hazardousSystem(state)
    if (!hazard) return
    const placed = run(at(state, hazard), { type: 'openScene' })
    const mission = placed.encounter!.options.find((o) => o.effect.kind === 'mission')!

    const ready = run(placed, { type: 'sceneOption', option: mission.id })
    expect(ready.encounter).toBeNull()
    expect(sitePlan(ready, hazard).site).not.toBeNull()
  })

  it('replays exactly: the same action log plays the same conversations', () => {
    const state = newGame(SEED)
    const system = socialSystem(state)
    const actions: Action[] = [{ type: 'openScene' }]
    const a = reduceAll(at(state, system), actions)
    const b = reduceAll(at(state, system), actions)
    expect(a.state).toEqual(b.state)
    expect(a.state.encounter?.beats).toEqual(b.state.encounter?.beats)
  })
})
