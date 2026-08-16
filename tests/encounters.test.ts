import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ENCOUNTERS, encounterDef } from '../src/engine/encounters/catalog.js'
import { chooseEncounter, doneFlag, ENCOUNTER_CHANCE } from '../src/engine/encounters/select.js'
import { createRng } from '../src/engine/rng/prng.js'
import { newGame, reduce } from '../src/engine/state/reducer.js'
import type { GameState } from '../src/engine/state/types.js'

const SEED = 'encounter-tests'

/** A fresh game with plenty of stores, so spends never block a test choice. */
function rich(): GameState {
  const state = newGame(SEED)
  return { ...state, data: 50, supplies: 100 }
}

/** Puts a specific encounter on the viewscreen, as the arrival roll would. */
function withEncounter(state: GameState, id: string, node?: string): GameState {
  const def = encounterDef(id)
  if (!def) throw new Error(`no such encounter: ${id}`)
  return { ...state, encounter: { id, node: node ?? def.entry } }
}

describe('the catalog', () => {
  it('has unique ids and valid weights', () => {
    const ids = new Set(ENCOUNTERS.map((e) => e.id))
    expect(ids.size).toBe(ENCOUNTERS.length)
    for (const def of ENCOUNTERS) expect(def.weight).toBeGreaterThanOrEqual(0)
  })

  it('every entry node exists and every goto stays inside the graph', () => {
    for (const def of ENCOUNTERS) {
      expect(def.nodes[def.entry], `${def.id} entry`).toBeDefined()
      for (const [nodeId, node] of Object.entries(def.nodes)) {
        expect(node.choices.length, `${def.id}:${nodeId} choices`).toBeGreaterThan(0)
        for (const choice of node.choices) {
          expect(choice.results.length, `${def.id}:${nodeId}:${choice.id}`).toBeGreaterThan(0)
          const total = choice.results.reduce((a, [w]) => a + w, 0)
          expect(total, `${def.id}:${nodeId}:${choice.id} weights`).toBeGreaterThan(0)
          for (const [, outcome] of choice.results) {
            if (outcome.goto) expect(def.nodes[outcome.goto], `${def.id} goto ${outcome.goto}`).toBeDefined()
          }
        }
      }
    }
  })

  it('every choice keeps an unconditional fallback entry', () => {
    for (const def of ENCOUNTERS) {
      for (const [nodeId, node] of Object.entries(def.nodes)) {
        for (const choice of node.choices) {
          const unconditional = choice.results.filter((r) => r[2] === undefined)
          expect(unconditional.length, `${def.id}:${nodeId}:${choice.id}`).toBeGreaterThan(0)
        }
      }
    }
  })

  it('every follow-up id resolves to a defined encounter', () => {
    for (const def of ENCOUNTERS) {
      for (const node of Object.values(def.nodes)) {
        for (const choice of node.choices) {
          for (const [, outcome] of choice.results) {
            if (outcome.followUp) expect(encounterDef(outcome.followUp.id), `${def.id} -> ${outcome.followUp.id}`).toBeDefined()
            if (outcome.combat?.withdrawFollowUp) {
              expect(
                encounterDef(outcome.combat.withdrawFollowUp.id),
                `${def.id} -> withdraw ${outcome.combat.withdrawFollowUp.id}`,
              ).toBeDefined()
            }
          }
        }
      }
    }
  })

  it('every portrait referenced exists on disk', () => {
    for (const def of ENCOUNTERS) {
      if (!def.portrait) continue
      const path = join(process.cwd(), 'public', def.portrait)
      expect(existsSync(path), `${def.id}: ${def.portrait}`).toBe(true)
    }
  })
})

describe('selection', () => {
  it('is deterministic for the same state and seed', () => {
    const state = rich()
    const at = state.galaxy.start
    const a = chooseEncounter(state, at, createRng('roll'))
    const b = chooseEncounter(state, at, createRng('roll'))
    expect(a?.def.id).toBe(b?.def.id)
  })

  it('never picks a done unique or a weight-0 encounter at random', () => {
    const base = rich()
    const state: GameState = {
      ...base,
      flags: ENCOUNTERS.filter((e) => e.unique !== false).map((e) => doneFlag(e.id)),
    }
    for (let i = 0; i < 40; i++) {
      const roll = chooseEncounter(state, state.galaxy.start, createRng(`round:${i}`))
      if (roll) expect(roll.def.unique).toBe(false)
    }
  })

  it('fires a due follow-up ahead of any random roll', () => {
    const base = rich()
    const state: GameState = {
      ...base,
      day: 20,
      pending: [{ id: 'friendly-pirate', notBefore: 18 }],
    }
    // Even an rng that would decline the random roll must yield the pending.
    const roll = chooseEncounter(state, state.galaxy.start, createRng('any'))
    expect(roll?.def.id).toBe('friendly-pirate')
    expect(roll?.fromPending).toBe(true)
  })

  it('holds a follow-up that is not yet due', () => {
    const base = rich()
    const state: GameState = { ...base, day: 5, pending: [{ id: 'friendly-pirate', notBefore: 30 }] }
    for (let i = 0; i < 20; i++) {
      const roll = chooseEncounter(state, state.galaxy.start, createRng(`i${i}`))
      expect(roll?.def.id).not.toBe('friendly-pirate')
    }
  })

  it('rolls encounters at roughly the configured chance across arrivals', () => {
    const state = rich()
    let fired = 0
    const rounds = 200
    for (let i = 0; i < rounds; i++) {
      if (chooseEncounter(state, state.galaxy.start, createRng(`c${i}`))) fired++
    }
    expect(fired / rounds).toBeGreaterThan(ENCOUNTER_CHANCE - 0.15)
    expect(fired / rounds).toBeLessThan(ENCOUNTER_CHANCE + 0.15)
  })
})

describe('choosing', () => {
  it('applies a deterministic outcome: data, flags, and the outcome card', () => {
    const state = withEncounter(rich(), 'bounty-broker')
    const { state: next } = reduce(state, { type: 'encounterChoose', choice: 'take' })
    expect(next.flags).toContain('gannet-contract')
    expect(next.pending.some((p) => p.id === 'friendly-pirate')).toBe(true)
    expect(next.encounter?.outcome?.text.length).toBeGreaterThan(0)
    const pending = next.pending.find((p) => p.id === 'friendly-pirate')!
    expect(pending.notBefore).toBeGreaterThanOrEqual(state.day + 4)
    expect(pending.notBefore).toBeLessThanOrEqual(state.day + 9)
  })

  it('spends the stake before the roll and refuses what the ship cannot pay', () => {
    const broke: GameState = { ...withEncounter(rich(), 'navigation-oracle'), data: 2 }
    const refused = reduce(broke, { type: 'encounterChoose', choice: 'pay-data' })
    expect(refused.state).toBe(broke)

    const solvent = withEncounter(rich(), 'navigation-oracle')
    const { state: next } = reduce(solvent, { type: 'encounterChoose', choice: 'pay-data' })
    // 8 spent, 2 back from the outcome.
    expect(next.data).toBe(solvent.data - 8 + 2)
    expect(next.collected.length).toBe(1)
  })

  it('locks choices behind tech, officers and standing', () => {
    const state = withEncounter(rich(), 'song-map')
    const locked = reduce(state, { type: 'encounterChoose', choice: 'notation' })
    expect(locked.state).toBe(state)

    const learned: GameState = { ...state, unlockedTech: ['comms-semantic', 'comms-choral'] }
    const { state: next } = reduce(learned, { type: 'encounterChoose', choice: 'notation' })
    expect(next.collected.length).toBe(1)
    expect(next.standing.flotilla).toBe(1)
  })

  it('hands shared intelligence to the plot, legible', () => {
    const state = withEncounter(
      { ...rich(), flags: ['parallax-1', 'parallax-2'] },
      'parallax-3',
    )
    const { state: next, events } = reduce(state, { type: 'encounterChoose', choice: 'hold' })
    expect(next.collected.length).toBe(2)
    expect(next.undecoded.length).toBe(0)
    expect(next.data).toBe(state.data + 6)
    expect(next.flags).toContain('parallax-3')
    expect(events.some((e) => e.type === 'evidenceFound')).toBe(true)
  })

  it('sends hostile outcomes to battle stations and blocks travel until resolved', () => {
    const state = withEncounter(rich(), 'echo-hunt')
    const { state: next } = reduce(state, { type: 'encounterChoose', choice: 'fight' })
    expect(next.combat?.enemy).toBe('echo')

    const cleared = reduce(next, { type: 'encounterContinue' })
    expect(cleared.state.encounter).toBeNull()
    expect(cleared.state.combat?.enemy).toBe('echo')

    const neighbour = cleared.state.galaxy.adjacency[cleared.state.ship.at]![0]!
    const blocked = reduce(cleared.state, { type: 'travel', to: neighbour })
    expect(blocked.state.ship.at).toBe(cleared.state.ship.at)
  })

  it('continue closes the outcome card', () => {
    const state = withEncounter(rich(), 'bounty-broker')
    const chosen = reduce(state, { type: 'encounterChoose', choice: 'refuse' }).state
    expect(chosen.encounter?.outcome).toBeDefined()
    const done = reduce(chosen, { type: 'encounterContinue' }).state
    expect(done.encounter).toBeNull()
  })

  it('conditional results read the story: the paradise verdict differs by conduct', () => {
    const base = rich()

    const respected = withEncounter({ ...base, flags: ['paradise-respected'] }, 'paradise-test')
    const a = reduce(respected, { type: 'encounterChoose', choice: 'finding' }).state
    expect(a.collected.length).toBe(1)
    expect(a.standing.custodian).toBe(1)

    const looted = withEncounter({ ...base, flags: ['paradise-looted'] }, 'paradise-test')
    const b = reduce(looted, { type: 'encounterChoose', choice: 'finding' }).state
    expect(b.collected.length).toBe(0)
    expect(b.standing.custodian).toBe(-1)
    expect(b.supplies).toBe(looted.supplies - 20)

    // Neither flag: the unconditional fallback fires.
    const neither = withEncounter(base, 'paradise-test')
    const c = reduce(neither, { type: 'encounterChoose', choice: 'finding' }).state
    expect(c.standing.custodian).toBe(0)
    expect(c.data).toBe(base.data + 2)
  })

  it('the inspection finds the defector when the defector is aboard', () => {
    const state = withEncounter({ ...rich(), flags: ['defector-aboard'] }, 'neutrality-inspection')
    const { state: next } = reduce(state, { type: 'encounterChoose', choice: 'submit' })
    expect(next.flags).not.toContain('defector-aboard')
    expect(next.ship.fuel).toBe(Math.min(80, state.ship.fuel + 8))
    expect(next.standing.vekar).toBe(1)
  })

  it('prunes scheduled threads the story has since closed', () => {
    const base = rich()
    const state: GameState = {
      ...base,
      day: 20,
      flags: ['echo-dead'],
      pending: [{ id: 'echo-hunt', notBefore: 10 }],
    }
    const neighbour = state.galaxy.adjacency[state.ship.at]![0]!
    const { state: next } = reduce(state, { type: 'travel', to: neighbour })
    expect(next.pending.some((p) => p.id === 'echo-hunt')).toBe(false)
    expect(next.encounter?.id).not.toBe('echo-hunt')
  })

  it('replays identically: same seed, same choice, same result', () => {
    const state = withEncounter(rich(), 'song-map')
    const a = reduce(state, { type: 'encounterChoose', choice: 'verse' })
    const b = reduce(state, { type: 'encounterChoose', choice: 'verse' })
    expect(a.state).toEqual(b.state)
  })
})
