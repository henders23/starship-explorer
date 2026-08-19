import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { epilogueLines } from '../src/engine/state/epilogue.js'
import { newGame, reduceAll } from '../src/engine/state/reducer.js'
import type { Action, GameState } from '../src/engine/state/types.js'

/**
 * The epilogue rulebook (R9): endings show the lines the run earned, keyed
 * on facts the state already keeps. These tests pin that lines appear only
 * when earned, and that a finished run earns a real epilogue.
 */
const base = newGame('epilogue-tests')

describe('the rulebook', () => {
  it('a fresh run has no epilogue to speak of', () => {
    expect(epilogueLines(base)).toEqual([])
  })

  it('a bloodless voyage records it first', () => {
    const survived: GameState = { ...base, day: 40 }
    const lines = epilogueLines(survived)
    expect(lines[0]).toContain('Nobody died out here')
  })

  it('casualties silence the bloodless line and losses get named', () => {
    const bled: GameState = {
      ...base,
      day: 40,
      casualties: { generics: 3, officers: ['Lt. Ada Novak'] },
    }
    expect(epilogueLines(bled).some((l) => l.includes('Nobody died'))).toBe(false)
  })

  it('promoted officers who held the station are remembered', () => {
    const roster = base.roster.map((o) =>
      o.role === 'science' ? { ...o, origin: 'promoted' as const } : o,
    )
    const lines = epilogueLines({ ...base, roster })
    const science = roster.find((o) => o.role === 'science')!
    expect(lines.some((l) => l.includes(science.name) && l.includes('duty roster'))).toBe(true)
  })

  it('unread artefacts and wasted reserves each earn their line', () => {
    const clue = base.mystery.clues[0]!
    const scarred: GameState = {
      ...base,
      collected: [clue.id],
      undecoded: [clue.id],
      jumps: [{ target: base.mystery.decoy, correct: false }],
    }
    const lines = epilogueLines(scarred)
    expect(lines.some((l) => l.includes('never read'))).toBe(true)
    expect(lines.some((l) => l.includes('reserve burned once'))).toBe(true)
  })

  it('a complete plot earns the completionist line', () => {
    const all: GameState = { ...base, collected: base.mystery.clues.map((c) => c.id) }
    expect(epilogueLines(all).some((l) => l.includes('on the plot'))).toBe(true)
  })
})

describe('a finished run', () => {
  it('the golden runs come home with an epilogue worth reading', () => {
    const fixture = JSON.parse(
      readFileSync(join(import.meta.dirname, 'fixtures', 'golden', 'golden-1.json'), 'utf8'),
    ) as { seed: string; actions: Action[] }
    const { state } = reduceAll(newGame(fixture.seed), fixture.actions)
    expect(state.outcome).toBe('home')
    expect(epilogueLines(state).length).toBeGreaterThanOrEqual(2)
  })
})
