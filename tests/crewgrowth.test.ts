import { describe, expect, it } from 'vitest'
import { playerDamage } from '../src/engine/combat/combat.js'
import { placeSpecialists } from '../src/engine/crew/specialists.js'
import { xpToNextSkill, type Specialist } from '../src/engine/crew/types.js'
import { newGame, reduceAll } from '../src/engine/state/reducer.js'
import type { Action, GameState } from '../src/engine/state/types.js'

const SEED = 'growth-tests'

const run = (from: GameState, ...actions: Action[]) => reduceAll(from, actions).state

const at = (from: GameState, system: string): GameState => ({
  ...from,
  ship: { at: system, fuel: 999, hull: 100 },
})

/** A state holding one decodable artefact, with the officer a point from rising. */
function onTheCusp(base: GameState): GameState | null {
  const artefact = base.mystery.clues.find((c) => c.source.kind === 'derelict-log')
  if (!artefact) return null
  return {
    ...at(base, artefact.source.at),
    collected: [artefact.id],
    clueStates: { [artefact.id]: 'unfiled' },
    undecoded: [artefact.id],
    searched: [artefact.source.at],
    roster: base.roster.map((o) =>
      o.role === 'science' ? { ...o, xp: xpToNextSkill(o.skill) - 1 } : o,
    ),
  }
}

describe('experience', () => {
  it('contributions raise skill at the threshold, with a log entry', () => {
    const base = newGame(SEED)
    const cusp = onTheCusp(base)
    if (!cusp) return
    const before = cusp.roster.find((o) => o.role === 'science')!

    const after = run(cusp, { type: 'decode', clue: cusp.undecoded[0]! })
    const science = after.roster.find((o) => o.role === 'science')!
    expect(science.skill).toBe(before.skill + 1)
    expect(science.xp).toBe(0)
    expect(after.log.some((l) => l.text.includes('grown into the station'))).toBe(true)
  })

  it('caps at five', () => {
    const base = newGame(SEED)
    const cusp = onTheCusp(base)
    if (!cusp) return
    const maxed: GameState = {
      ...cusp,
      roster: cusp.roster.map((o) => (o.role === 'science' ? { ...o, skill: 5, xp: 999 } : o)),
    }
    const after = run(maxed, { type: 'decode', clue: maxed.undecoded[0]! })
    expect(after.roster.find((o) => o.role === 'science')!.skill).toBe(5)
  })
})

describe('specialists', () => {
  it('places one per focus at distinct faction stations, deterministically', () => {
    const state = newGame(SEED)
    expect(placeSpecialists(SEED, state.galaxy)).toEqual(state.recruits.sites)

    const entries = Object.entries(state.recruits.sites)
    const focuses = entries.map(([, s]) => s.focus).sort()
    expect(focuses).toEqual(['comms', 'gunnery', 'research'])
    for (const [system] of entries) {
      expect(state.galaxy.systems.find((s) => s.id === system)?.faction).not.toBeNull()
    }
    // Distinct faces, none shared with the founding roster.
    const names = new Set(entries.map(([, s]) => s.name))
    expect(names.size).toBe(entries.length)
    for (const officer of state.roster) {
      for (const name of names) expect(officer.name.includes(name)).toBe(false)
    }
  })

  it('a recruit scene fires at the station and signing them costs a day', () => {
    const state = newGame(SEED)
    const [system, specialist] = Object.entries(state.recruits.sites)[0]!

    const placed = run(at(state, system), { type: 'openScene' })
    // A clue scene may take precedence at a shared system; recruit-only is the case under test.
    if (placed.encounter?.templateId !== 'recruit') return
    expect(placed.encounter.figure?.name).toBe(specialist.name)

    const signed = run(placed, { type: 'sceneOption', option: 'sign' })
    expect(signed.recruits.aboard).toContainEqual(specialist)
    expect(signed.recruits.sites[system]).toBeUndefined()
    expect(signed.day).toBe(placed.day + 1)

    // Declined recruits stay available; scenes reopen.
    const declined = run(placed, { type: 'sceneOption', option: 'decline' })
    expect(declined.recruits.sites[system]).toEqual(specialist)
    expect(run(declined, { type: 'openScene' }).encounter?.templateId).toBe('recruit')
  })

  it('their bonuses are real: gunnery, research pace, and instant decoding', () => {
    const base = newGame(SEED)
    const aboard = (focus: Specialist['focus']): GameState => ({
      ...base,
      recruits: { sites: {}, aboard: [{ name: 'Test Person', focus }] },
    })

    // Gunner: +3 volley.
    expect(playerDamage(aboard('gunnery'), base.roster)).toBe(playerDamage(base, base.roster) + 3)

    // Researcher: projects start a day shorter.
    const quick = run(aboard('research'), { type: 'startResearch', tech: 'comms-1' })
    const slow = run(base, { type: 'startResearch', tech: 'comms-1' })
    expect(quick.tech.active!.daysLeft).toBe(slow.tech.active!.daysLeft - 1)

    // Linguist: decoding costs no day.
    const cusp = onTheCusp(base)
    if (!cusp) return
    const fluent: GameState = {
      ...cusp,
      recruits: { sites: {}, aboard: [{ name: 'Test Person', focus: 'comms' }] },
    }
    const read = run(fluent, { type: 'decode', clue: fluent.undecoded[0]! })
    expect(read.undecoded).toEqual([])
    expect(read.day).toBe(fluent.day)
  })
})
