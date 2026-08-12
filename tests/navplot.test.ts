import { beforeEach, describe, expect, it } from 'vitest'
import { candidatesFor, findContradictions } from '../src/engine/mystery/deduce.js'
import { evidenceSites, heldClues, newGame, reduce, reduceAll } from '../src/engine/state/reducer.js'
import type { Action, GameState } from '../src/engine/state/types.js'
import { GalaxyIndex } from '../src/engine/worldgen/index-galaxy.js'

const SEED = 'navplot-tests'

let state: GameState
let index: GalaxyIndex

beforeEach(() => {
  state = newGame(SEED)
  index = new GalaxyIndex(state.galaxy)
})

/** Drives the reducer, returning only the resulting state. */
const run = (from: GameState, ...actions: Action[]) => reduceAll(from, actions).state

/** Sweeps every system holding evidence, as a player eventually would. */
function gatherEverything(from: GameState): GameState {
  let current = from
  for (const site of new Set(current.mystery.clues.map((c) => c.source.at))) {
    current = run(current, { type: 'search', system: site })
  }
  return current
}

describe('starting a game', () => {
  it('begins at the arrival point with nothing in hand', () => {
    expect(state.collected).toEqual([])
    expect(state.searched).toEqual([])
    expect(state.outcome).toBe('seeking')
    expect(state.selected).toBe(state.galaxy.start)
    expect(state.log).toHaveLength(1)
  })

  it('rules nothing out until something is trusted', () => {
    expect(candidatesFor(heldClues(state), index)).toHaveLength(index.systems.length)
  })

  it('is serialisable, so save/load is JSON round-tripping', () => {
    const revived = JSON.parse(JSON.stringify(state)) as GameState
    expect(revived).toEqual(state)
  })
})

describe('searching for evidence', () => {
  it('collects the clues held at a system', () => {
    const site = state.mystery.clues[0]!.source.at
    const expected = state.mystery.clues.filter((c) => c.source.at === site).map((c) => c.id)

    const { state: after, events } = reduce(state, { type: 'search', system: site })

    expect(after.collected).toEqual(expect.arrayContaining(expected))
    expect(after.searched).toContain(site)
    expect(events).toContainEqual({ type: 'evidenceFound', clues: expected, at: site })
    for (const id of expected) expect(after.clueStates[id]).toBe('unfiled')
  })

  it('reports honestly when a system holds nothing', () => {
    const barren = index.systems.find(
      (s) => !state.mystery.clues.some((c) => c.source.at === s.id),
    )!
    const { state: after, events } = reduce(state, { type: 'search', system: barren.id })

    expect(after.collected).toEqual([])
    expect(after.searched).toContain(barren.id)
    expect(events).toEqual([{ type: 'nothingFound', at: barren.id }])
  })

  it('does not yield the same evidence twice', () => {
    const site = state.mystery.clues[0]!.source.at
    const once = run(state, { type: 'search', system: site })
    const twice = run(once, { type: 'search', system: site })
    expect(twice.collected).toEqual(once.collected)
    expect(twice.log).toHaveLength(once.log.length)
  })

  it('empties the site list once everything is swept', () => {
    expect(evidenceSites(state).size).toBeGreaterThan(0)
    expect(evidenceSites(gatherEverything(state)).size).toBe(0)
  })
})

describe('filing evidence', () => {
  it('narrows the field as accounts are trusted, and widens it again on doubt', () => {
    let current = gatherEverything(state)
    const first = heldClues(current)[0]!

    const before = candidatesFor(heldClues(current), index).length
    current = run(current, { type: 'file', clue: first.id, state: 'trusted' })
    const trusted = candidatesFor(heldClues(current), index).length
    expect(trusted).toBeLessThan(before)

    current = run(current, { type: 'file', clue: first.id, state: 'doubted' })
    expect(candidatesFor(heldClues(current), index)).toHaveLength(before)
  })

  it('refuses to file evidence the player does not hold', () => {
    const unheld = state.mystery.clues[0]!.id
    const { state: after, events } = reduce(state, {
      type: 'file',
      clue: unheld,
      state: 'trusted',
    })
    expect(after).toBe(state)
    expect(events).toEqual([])
  })
})

/**
 * The point of the whole screen: trusting everything must collapse the plot,
 * and the contradiction detector must give the player a way back out.
 */
describe('the deduction', () => {
  it('is solvable — trusting only the honest accounts isolates the Gateway', () => {
    let current = gatherEverything(state)
    for (const clue of current.mystery.clues) {
      if (clue.truth === 'true') {
        current = run(current, { type: 'file', clue: clue.id, state: 'trusted' })
      }
    }
    expect(candidatesFor(heldClues(current), index)).toEqual([current.mystery.gateway])
  })

  it('collapses when the player trusts the lies too, and says which clues conflict', () => {
    let current = gatherEverything(state)
    for (const clue of current.mystery.clues) {
      current = run(current, { type: 'file', clue: clue.id, state: 'trusted' })
    }

    const held = heldClues(current)
    expect(candidatesFor(held, index)).toHaveLength(0)

    const contradictions = findContradictions(
      held.filter((c) => c.state === 'trusted'),
      index,
      3,
    )
    expect(contradictions.length).toBeGreaterThan(0)

    // Every conflict must implicate a real lie, or the panel sends the player
    // after honest witnesses.
    const lies = new Set(current.mystery.clues.filter((c) => c.truth === 'false').map((c) => c.id))
    for (const contradiction of contradictions) {
      expect(contradiction.clues.some((id) => lies.has(id))).toBe(true)
    }
  })
})

describe('the Long Jump', () => {
  it('ends the game when the player is right', () => {
    const { state: after, events } = reduce(state, {
      type: 'plotTheJump',
      target: state.mystery.gateway,
    })
    expect(after.outcome).toBe('home')
    expect(events).toEqual([{ type: 'jumpSucceeded', target: state.mystery.gateway }])
  })

  it('is survivable when the player is wrong — the search stays open', () => {
    const wrong = state.mystery.decoy
    const { state: after, events } = reduce(state, { type: 'plotTheJump', target: wrong })

    expect(after.outcome).toBe('seeking')
    expect(after.jumps).toEqual([{ target: wrong, correct: false }])
    expect(events).toEqual([{ type: 'jumpFailed', target: wrong, attempt: 1 }])

    // And a second attempt is still possible.
    const again = reduce(after, { type: 'plotTheJump', target: after.mystery.gateway })
    expect(again.state.outcome).toBe('home')
  })

  it('accepts no further orders once the ship is home', () => {
    const home = run(state, { type: 'plotTheJump', target: state.mystery.gateway })
    const after = run(home, { type: 'plotTheJump', target: state.mystery.decoy })
    expect(after.jumps).toHaveLength(1)
  })
})

/**
 * The boundary that keeps the answer out of the UI. `heldClues` is what every
 * component consumes, and it must not carry the answer key at all — not merely
 * "not read it".
 */
describe('the player view', () => {
  it('strips the answer key from every clue handed to the UI', () => {
    const current = gatherEverything(state)
    const held = heldClues(current)
    expect(held.length).toBeGreaterThan(0)
    for (const clue of held) {
      expect(clue).not.toHaveProperty('truth')
      expect(Object.keys(clue)).not.toContain('truth')
    }
  })

  it('shows only evidence actually collected', () => {
    expect(heldClues(state)).toEqual([])
    const site = state.mystery.clues[0]!.source.at
    const after = run(state, { type: 'search', system: site })
    expect(heldClues(after).map((c) => c.id).sort()).toEqual(after.collected.slice().sort())
  })
})
