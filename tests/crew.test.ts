import { describe, expect, it } from 'vitest'
import { generateRoster, promoteGeneric } from '../src/engine/crew/generate.js'
import type { AwayTeam } from '../src/engine/crew/types.js'
import {
  approachesFor,
  approachOdds,
  dominantSite,
  needsDecoding,
  siteForKind,
} from '../src/engine/missions/sites.js'
import { newGame, reduce, reduceAll, sitePlan, usableClues, vacancies } from '../src/engine/state/reducer.js'
import type { Action, GameState } from '../src/engine/state/types.js'

const run = (from: GameState, ...actions: Action[]) => reduceAll(from, actions).state

/**
 * Test-only relocation: put the ship at the site with a full-enough tank.
 * These suites are about crew and missions, not fuel; travel has its own.
 */
const at = (from: GameState, system: string): GameState => ({
  ...from,
  ship: { at: system, fuel: 999, hull: 100 },
})

/** First system holding evidence behind the given hazard filter. */
function hazardousSystem(state: GameState): string | null {
  for (const system of new Set(state.mystery.clues.map((c) => c.source.at))) {
    if (sitePlan(state, system).site !== null) return system
  }
  return null
}

function missionAction(
  state: GameState,
  system: string,
  team: AwayTeam,
  preferNeeds = true,
): Action {
  const { site } = sitePlan(state, system)
  if (!site) throw new Error(`${system} is not hazardous`)
  const approaches = approachesFor(site)
  const approach =
    (preferNeeds
      ? approaches.find((a) => a.needs !== null && team.officers.includes(a.needs))
      : null) ?? approaches.find((a) => a.needs === null)!
  return { type: 'runMission', system, team, approach: approach.id }
}

describe('the roster', () => {
  it('generates a captain and three officers, deterministically per seed', () => {
    const a = generateRoster('some-seed')
    const b = generateRoster('some-seed')
    expect(a).toEqual(b)
    expect(a.map((o) => o.role)).toEqual(['captain', 'security', 'science', 'medical'])
    for (const officer of a) {
      expect(officer.status).toBe('fit')
      expect(officer.skill).toBe(3)
      expect(officer.origin).toBe('founding')
    }
    expect(generateRoster('other-seed')).not.toEqual(a)
  })

  it('starts the generic pools at 12 and 12', () => {
    const state = newGame('crew-pools')
    expect(state.pools).toEqual({ crew: 12, security: 12 })
  })

  it('names promoted generics deterministically and starts them weaker', () => {
    const first = promoteGeneric('seed', 'science', 0)
    expect(first).toEqual(promoteGeneric('seed', 'science', 0))
    expect(first.skill).toBe(2)
    expect(first.origin).toBe('promoted')
    expect(promoteGeneric('seed', 'science', 1).name).not.toBe(first.name)
  })
})

describe('sites', () => {
  it('maps hostile sources to sites and social sources to walks', () => {
    expect(siteForKind('derelict-log')?.type).toBe('derelict')
    expect(siteForKind('ruins-tablet')?.type).toBe('ruins')
    expect(siteForKind('prisoner')?.type).toBe('holdout')
    expect(siteForKind('listening-post')?.type).toBe('listening-post')
    expect(siteForKind('alien-trader')).toBeNull()
    expect(siteForKind('faction-archive')).toBeNull()
    expect(siteForKind('castaway')).toBeNull()
    expect(siteForKind('crew-memory')).toBeNull()
  })

  it('lets the most dangerous evidence set the terms for a mixed cache', () => {
    expect(dominantSite(['alien-trader', 'listening-post', 'derelict-log'])?.type).toBe('derelict')
    expect(dominantSite(['crew-memory', 'castaway'])).toBeNull()
  })

  it('prices every approach as a distribution that sums to 100', () => {
    const roster = generateRoster('odds-seed')
    const teams: AwayTeam[] = [
      { captain: false, officers: [], escorts: 0, hands: 0 },
      { captain: true, officers: ['security', 'science', 'medical'], escorts: 4, hands: 4 },
    ]
    for (const type of ['derelict', 'ruins', 'holdout', 'listening-post'] as const) {
      for (const approach of approachesFor(siteForKind === null ? (null as never) : { type, label: '', description: '' })) {
        for (const team of teams) {
          const odds = approachOdds(approach, team, roster)
          expect(odds.clean + odds.messy + odds.disaster).toBe(100)
          expect(odds.clean).toBeLessThanOrEqual(95)
          expect(odds.disaster).toBeGreaterThanOrEqual(2)
        }
      }
    }
  })

  it('improves the odds for a stronger team, and never past the cap', () => {
    const roster = generateRoster('odds-seed')
    const site = siteForKind('derelict-log')!
    const approach = approachesFor(site)[0]!
    const alone = approachOdds(approach, { captain: false, officers: [], escorts: 0, hands: 0 }, roster)
    const heavy = approachOdds(
      approach,
      { captain: true, officers: ['security', 'science', 'medical'], escorts: 4, hands: 4 },
      roster,
    )
    expect(heavy.clean).toBeGreaterThan(alone.clean)
    expect(heavy.disaster).toBeLessThanOrEqual(alone.disaster)
  })
})

describe('away missions', () => {
  const SEED = 'crew-missions'

  it('resolves deterministically: same state, same action, same result', () => {
    const state = newGame(SEED)
    const system = hazardousSystem(state)
    if (!system) return
    const placed = at(state, system)
    const team: AwayTeam = { captain: false, officers: ['security'], escorts: 2, hands: 0 }
    const action = missionAction(placed, system, team)
    const a = reduce(placed, action)
    const b = reduce(placed, action)
    expect(a.state).toEqual(b.state)
    expect(a.events).toEqual(b.events)
  })

  it('rejects illegal teams, wrong approaches, and acting from a distance', () => {
    const state = newGame(SEED)
    const system = hazardousSystem(state)
    if (!system) return
    const placed = at(state, system)

    // More escorts than the pool holds.
    const bloated: AwayTeam = { captain: false, officers: [], escorts: 99, hands: 0 }
    expect(reduce(placed, missionAction(placed, system, bloated, false)).state).toBe(placed)

    // An approach whose specialist is not on the team.
    const { site } = sitePlan(placed, system)!
    const gated = approachesFor(site!).find((a) => a.needs !== null)
    if (gated) {
      const { state: after } = reduce(placed, {
        type: 'runMission',
        system,
        team: { captain: false, officers: [], escorts: 0, hands: 0 },
        approach: gated.id,
      })
      expect(after).toBe(placed)
    }

    // A mission at a system the ship is not at.
    if (state.ship.at !== system) {
      const team: AwayTeam = { captain: false, officers: [], escorts: 0, hands: 0 }
      expect(reduce(state, missionAction(state, system, team, false)).state).toBe(state)
    }
  })

  it('under fire, generics die before officers, and the pools shrink to match', () => {
    // Run missions across seeds until one goes wrong, then check the ledger.
    for (let i = 0; i < 60; i++) {
      const seedState = newGame(`redshirts-${i}`)
      const system = hazardousSystem(seedState)
      if (!system) continue
      const state = at(seedState, system)
      const team: AwayTeam = { captain: false, officers: ['security'], escorts: 4, hands: 2 }
      const { state: after, events } = reduce(state, missionAction(state, system, team, false))

      const lost = events.find((e) => e.type === 'genericsLost')
      const officerHarm = events.some((e) => e.type === 'officerDied' || e.type === 'officerInjured')

      if (lost && 'count' in lost) {
        const poolLoss = 24 - after.pools.crew - after.pools.security
        expect(poolLoss).toBe(lost.count)
        expect(after.casualties.generics).toBe(lost.count)
        // With six generics along, harm should not have reached the roster
        // unless the generics were hit first — dead officers with an intact
        // pool would mean the ladder is upside down.
        if (officerHarm) expect(lost.count).toBeGreaterThan(0)
        return
      }
    }
    // Sixty clean missions in a row would itself be a bug in the odds.
    throw new Error('no mission ever went wrong across 60 seeds')
  })

  it('a disaster recovers nothing and leaves the site collectable', () => {
    for (let i = 0; i < 120; i++) {
      const seedState = newGame(`disaster-${i}`)
      const system = hazardousSystem(seedState)
      if (!system) continue
      const state = at(seedState, system)
      const team: AwayTeam = { captain: false, officers: [], escorts: 0, hands: 0 }
      const { state: after, events } = reduce(state, missionAction(state, system, team, false))
      const resolved = events.find((e) => e.type === 'missionResolved')
      if (resolved && 'outcome' in resolved && resolved.outcome === 'disaster') {
        expect(after.collected).toEqual([])
        expect(after.searched).not.toContain(system)
        // And the retry can still succeed later.
        expect(sitePlan(after, system).site).not.toBeNull()
        return
      }
    }
    throw new Error('no disaster across 120 seeds — odds are miscalibrated')
  })

  it('kills officers eventually, opens the vacancy, and promotion fills it', () => {
    for (let i = 0; i < 200; i++) {
      let state = newGame(`officer-death-${i}`)
      const system = hazardousSystem(state)
      if (!system) continue
      state = at(state, system)

      // Send officers with no generic shield, repeatedly, until one dies.
      for (let attempt = 0; attempt < 20 && state.outcome === 'seeking'; attempt++) {
        if (state.searched.includes(system)) break
        const fitOfficers = (['security', 'science', 'medical'] as const).filter((r) =>
          state.roster.some((o) => o.role === r && o.status === 'fit'),
        )
        if (fitOfficers.length === 0) break
        const team: AwayTeam = { captain: false, officers: fitOfficers, escorts: 0, hands: 0 }
        state = run(state, missionAction(state, system, team, false))

        const dead = state.roster.find((o) => o.role !== 'captain' && o.status === 'dead')
        if (dead) {
          const role = dead.role as 'security' | 'science' | 'medical'
          expect(vacancies(state)).toContain(role)
          expect(state.casualties.officers).toContain(dead.name)

          const crewBefore = state.pools.crew
          const promoted = run(state, { type: 'promote', role })
          const replacement = promoted.roster.find((o) => o.role === role)!
          expect(replacement.status).toBe('fit')
          expect(replacement.skill).toBe(2)
          expect(replacement.origin).toBe('promoted')
          expect(replacement.name).not.toBe(dead.name)
          expect(promoted.pools.crew).toBe(crewBefore - 1)
          expect(vacancies(promoted)).not.toContain(role)

          // Promoting into an occupied chair must refuse.
          expect(run(promoted, { type: 'promote', role })).toEqual(promoted)
          return
        }
      }
    }
    throw new Error('no officer death across 200 seeds — disaster harm is miscalibrated')
  })

  it('can cost the captain everything', () => {
    for (let i = 0; i < 300; i++) {
      let state = newGame(`captain-${i}`)
      const system = hazardousSystem(state)
      if (!system) continue
      state = at(state, system)
      for (let attempt = 0; attempt < 15 && state.outcome === 'seeking'; attempt++) {
        if (state.searched.includes(system)) break
        const team: AwayTeam = { captain: true, officers: [], escorts: 0, hands: 0 }
        state = run(state, missionAction(state, system, team, false))
      }
      if (state.outcome === 'lost') {
        expect(state.roster.find((o) => o.role === 'captain')?.status).toBe('dead')
        // A lost ship accepts no further orders.
        const after = run(state, { type: 'plotTheJump', target: state.mystery.gateway })
        expect(after.outcome).toBe('lost')
        return
      }
    }
    throw new Error('captain survived 300 seeds of solo disasters — captainDeath never fires')
  })
})

describe('decoding', () => {
  const SEED = 'decode-tests'

  /** Full translation matrix: these tests are about the science chair, not comms. */
  const freshDecodeState = (): GameState => ({
    ...newGame(SEED),
    tech: { researched: ['comms-1', 'comms-2'], active: null },
  })

  /** A hazardous site holding decode-required evidence. */
  function artefactSystem(state: GameState): string | null {
    for (const clue of state.mystery.clues) {
      if (needsDecoding(clue.source.kind) && sitePlan(state, clue.source.at).site !== null) {
        return clue.source.at
      }
    }
    return null
  }

  function collectWithoutScience(state: GameState, system: string): GameState {
    let current = at(state, system)
    for (let attempt = 0; attempt < 30 && !current.searched.includes(system); attempt++) {
      const team: AwayTeam = { captain: false, officers: ['security'], escorts: 4, hands: 0 }
      current = run(current, missionAction(current, system, team, false))
      if (current.outcome !== 'seeking') throw new Error('run ended while gathering')
    }
    return current
  }

  it('returns artefacts unread when science stays aboard, and locks filing', () => {
    const state = freshDecodeState()
    const system = artefactSystem(state)
    if (!system) return
    const after = collectWithoutScience(state, system)

    const artefacts = after.collected.filter((id) => after.undecoded.includes(id))
    expect(artefacts.length).toBeGreaterThan(0)

    // Unreadable evidence cannot be filed…
    const refused = run(after, { type: 'file', clue: artefacts[0]!, state: 'trusted' })
    expect(refused.clueStates[artefacts[0]!]).toBe('unfiled')
    // …and does not reach the Nav Plot's reasoning at all.
    expect(usableClues(after).map((c) => c.id)).not.toContain(artefacts[0])
  })

  it('a fit science officer decodes; a dead one leaves the plot dark', () => {
    const state = freshDecodeState()
    const system = artefactSystem(state)
    if (!system) return
    const after = collectWithoutScience(state, system)
    const artefact = after.collected.find((id) => after.undecoded.includes(id))
    if (!artefact) return

    // Alive: decoding works and filing opens up.
    const decoded = run(after, { type: 'decode', clue: artefact })
    expect(decoded.undecoded).not.toContain(artefact)
    const filed = run(decoded, { type: 'file', clue: artefact, state: 'trusted' })
    expect(filed.clueStates[artefact]).toBe('trusted')

    // Dead: the artefact stays dark. This is the strategic wound.
    const bereft: GameState = {
      ...after,
      roster: after.roster.map((o) =>
        o.role === 'science' ? { ...o, status: 'dead' as const } : o,
      ),
    }
    expect(run(bereft, { type: 'decode', clue: artefact }).undecoded).toContain(artefact)
  })

  it('science on the ground means nothing arrives undecoded', () => {
    const state = freshDecodeState()
    const system = artefactSystem(state)
    if (!system) return
    let current = at(state, system)
    for (let attempt = 0; attempt < 30 && !current.searched.includes(system); attempt++) {
      const team: AwayTeam = { captain: false, officers: ['security', 'science'], escorts: 4, hands: 0 }
      current = run(current, missionAction(current, system, team, false))
    }
    expect(current.undecoded).toEqual([])
  })
})

describe('injury and recovery', () => {
  it('injured officers sit out and return fit after the healing clock', () => {
    for (let i = 0; i < 120; i++) {
      let state = newGame(`injury-${i}`)
      const system = hazardousSystem(state)
      if (!system) continue
      state = at(state, system)

      for (let attempt = 0; attempt < 12 && state.outcome === 'seeking'; attempt++) {
        if (state.searched.includes(system)) break
        const team: AwayTeam = { captain: false, officers: ['security'], escorts: 0, hands: 0 }
        if (state.roster.find((o) => o.role === 'security')?.status !== 'fit') break
        state = run(state, missionAction(state, system, team, false))

        const hurt = state.roster.find((o) => o.role === 'security' && o.status === 'injured')
        if (hurt) {
          // Medbay stays are measured in days now, and the doctor matters.
          expect(hurt.healedAfter).toBeGreaterThan(state.day)
          expect([6, 12]).toContain((hurt.healedAfter ?? 0) - (state.day - 0))

          // An injured officer cannot be sent down.
          const refused = reduce(state, {
            type: 'runMission',
            system,
            team: { captain: false, officers: ['security'], escorts: 0, hands: 0 },
            approach: 'breach',
          })
          expect(refused.state).toBe(state)
          return
        }
      }
    }
    throw new Error('no injury across 120 seeds')
  })
})
