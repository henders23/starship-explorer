import { describe, expect, it } from 'vitest'
import { PARTS_NEEDED, placeComponents } from '../src/engine/research/parts.js'
import { jumpReady } from '../src/engine/research/tech.js'
import { newGame, reduce, reduceAll, sitePlan } from '../src/engine/state/reducer.js'
import type { Action, GameState } from '../src/engine/state/types.js'

/**
 * The extended solvability contract: every run can finish all three tracks.
 * The navigational track has its own proven contract (mystery-contract);
 * this suite proves the technological track inherits it — components sit
 * only on clue-bearing systems, which the existing contract proves reachable
 * within the fuel budget — and that the recovery and gating rules hold.
 * Seed count is env-tunable like the mystery sweep.
 */
const SEEDS = Number(process.env.THREETRACK_SEEDS ?? 200)

const run = (from: GameState, ...actions: Action[]) => reduceAll(from, actions).state

const at = (from: GameState, system: string): GameState => ({
  ...from,
  ship: { at: system, fuel: 999, hull: 100 },
})

describe('component placement', () => {
  it('places every needed component on a reachable clue system, across seeds', () => {
    for (let i = 0; i < SEEDS; i++) {
      const state = newGame(`threetrack-${i}`)
      const clueSystems = new Set(state.mystery.clues.map((c) => c.source.at))
      const placed = Object.entries(state.parts.sites)

      const counts = { engine: 0, shield: 0 }
      for (const [system, kinds] of placed) {
        expect(clueSystems.has(system)).toBe(true)
        for (const kind of kinds) counts[kind] += 1
      }
      expect(counts.engine).toBe(PARTS_NEEDED.engine)
      expect(counts.shield).toBe(PARTS_NEEDED.shield)
    }
  })

  it('is deterministic per seed', () => {
    const a = newGame('threetrack-det')
    const b = newGame('threetrack-det')
    expect(a.parts).toEqual(b.parts)
    expect(placeComponents('x', a.mystery.clues)).toEqual(placeComponents('x', a.mystery.clues))
  })
})

describe('component recovery', () => {
  /** Collect a system's evidence by whatever path it demands. */
  function collectAt(state: GameState, system: string): GameState {
    let current = at(state, system)
    if (sitePlan(current, system).site === null) {
      return run(current, { type: 'search', system })
    }
    for (let attempt = 0; attempt < 40 && !current.searched.includes(system); attempt++) {
      const fit = (['security', 'science', 'medical'] as const).filter((role) =>
        current.roster.some((o) => o.role === role && o.status === 'fit'),
      )
      current = run(current, {
        type: 'runMission',
        system,
        team: { captain: false, officers: fit, escorts: Math.min(4, current.pools.security), hands: 0 },
        approach: sitePlan(current, system).site!.type === 'derelict' ? 'breach'
          : sitePlan(current, system).site!.type === 'ruins' ? 'dig'
          : sitePlan(current, system).site!.type === 'holdout' ? 'rush' : 'rip',
      })
      // A mission can stand at its mid-ground decision; press on regardless.
      if (current.crisis) {
        const press = current.crisis.choices.find((c) => !c.needs)!
        current = run(current, { type: 'crisisCall', choice: press.id })
      }
      if (current.outcome !== 'seeking') break
    }
    return current
  }

  it('a site that yields its evidence yields its component', () => {
    const state = newGame('threetrack-recovery')
    const [system, kinds] = Object.entries(state.parts.sites)[0]!
    const after = collectAt(state, system)
    if (after.outcome !== 'seeking') return

    expect(after.parts.sites[system]).toBeUndefined()
    const total = after.parts.engine + after.parts.shield
    expect(total).toBe(kinds.length)
    expect(after.log.some((l) => l.text.includes('crated and aboard'))).toBe(true)
  })

  it('collecting every component site completes both tracks', () => {
    for (let i = 0; i < 8; i++) {
      let state = newGame(`threetrack-full-${i}`)
      for (const system of Object.keys(state.parts.sites)) {
        state = collectAt(state, system)
        if (state.outcome !== 'seeking') break
      }
      if (state.outcome !== 'seeking') continue
      expect(state.parts.engine).toBe(PARTS_NEEDED.engine)
      expect(state.parts.shield).toBe(PARTS_NEEDED.shield)
      return
    }
    throw new Error('no seed survived collecting all component sites')
  })
})

describe('the gate', () => {
  it('refuses the Long Jump until both rift projects are built', () => {
    const state = newGame('threetrack-gate')
    expect(jumpReady(state)).toBe(false)
    expect(reduce(state, { type: 'plotTheJump', target: state.mystery.gateway }).state).toBe(state)

    const halfway: GameState = {
      ...state,
      tech: { researched: ['rift-drive'], active: null },
    }
    expect(reduce(halfway, { type: 'plotTheJump', target: state.mystery.gateway }).state).toBe(halfway)

    const ready: GameState = {
      ...state,
      tech: { researched: ['rift-drive', 'rift-shield'], active: null },
    }
    expect(jumpReady(ready)).toBe(true)
    // The correct jump arrives at the threshold; the transit ends the run.
    const arrived = run(ready, { type: 'plotTheJump', target: state.mystery.gateway })
    expect(arrived.outcome).toBe('seeking')
    expect(arrived.encounter?.templateId).toBe('gateway')
    const home = run(arrived, { type: 'sceneOption', option: 'commit' })
    expect(home.outcome).toBe('home')
  })

  it('rift projects stay unresearchable until their components are aboard', () => {
    const state = newGame('threetrack-lock')
    expect(reduce(state, { type: 'startResearch', tech: 'rift-drive' }).state).toBe(state)

    const stocked: GameState = {
      ...state,
      parts: { ...state.parts, engine: PARTS_NEEDED.engine },
    }
    const started = reduce(stocked, { type: 'startResearch', tech: 'rift-drive' }).state
    expect(started.tech.active?.id).toBe('rift-drive')
  })
})
