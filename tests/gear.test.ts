import { describe, expect, it } from 'vitest'
import { generateRoster } from '../src/engine/crew/generate.js'
import type { AwayTeam } from '../src/engine/crew/types.js'
import {
  defaultLoadouts,
  GEAR,
  GEAR_BONUS_MAX,
  GEAR_BONUS_MIN,
  gearCleanBonus,
  gearGuard,
  teamHasMedkit,
} from '../src/engine/missions/gear.js'
import { approachesFor, approachOdds, siteForKind } from '../src/engine/missions/sites.js'
import { newGame, reduce } from '../src/engine/state/reducer.js'

const FULL_TEAM: AwayTeam = { captain: true, officers: ['security', 'science', 'medical'], escorts: 0, hands: 0 }

describe('the locker', () => {
  it('issues standard kit to every station on day one', () => {
    const state = newGame('gear-defaults')
    expect(state.loadouts).toEqual(defaultLoadouts())
    for (const officer of state.roster) {
      const loadout = state.loadouts[officer.role]
      expect(GEAR.find((g) => g.id === loadout.primary)?.slot).toBe('primary')
      expect(GEAR.find((g) => g.id === loadout.armour)?.slot).toBe('armour')
      expect(GEAR.find((g) => g.id === loadout.equipment)?.slot).toBe('equipment')
    }
  })

  it('equips through the reducer and refuses nonsense', () => {
    const state = newGame('gear-equip')

    const { state: after, events } = reduce(state, {
      type: 'equip', role: 'security', slot: 'primary', item: 'stunner',
    })
    expect(after.loadouts.security.primary).toBe('stunner')
    expect(after.loadouts.security.armour).toBe(state.loadouts.security.armour)
    expect(events).toEqual([{ type: 'equipped', role: 'security', item: 'stunner' }])

    // Unknown item, wrong slot, and a re-issue of the same item all no-op.
    expect(reduce(state, { type: 'equip', role: 'security', slot: 'primary', item: 'banana' }).state).toBe(state)
    expect(reduce(state, { type: 'equip', role: 'security', slot: 'armour', item: 'pulse' }).state).toBe(state)
    expect(reduce(after, { type: 'equip', role: 'security', slot: 'primary', item: 'stunner' }).state).toBe(after)
  })

  it('gear shifts mission odds, and the shift is capped', () => {
    const roster = generateRoster('gear-odds')
    const loadouts = defaultLoadouts()
    const site = siteForKind('derelict-log')!

    for (const approach of approachesFor(site)) {
      const bonus = gearCleanBonus(approach, FULL_TEAM, roster, loadouts)
      expect(bonus).toBeGreaterThanOrEqual(GEAR_BONUS_MIN)
      expect(bonus).toBeLessThanOrEqual(GEAR_BONUS_MAX)

      const bare = approachOdds(approach, FULL_TEAM, roster, 100)
      const kitted = approachOdds(approach, FULL_TEAM, roster, 100, loadouts)
      expect(kitted.clean + kitted.messy + kitted.disaster).toBe(100)
      // The kitted odds differ from the bare odds by exactly the gear bonus,
      // unless the 95-clean cap absorbed part of it.
      if (kitted.clean < 95) expect(kitted.clean - bare.clean).toBe(bonus)
    }
  })

  it('a benched officer contributes no gear', () => {
    // A small team, so the bonus cap cannot mask the missing kit.
    const team: AwayTeam = { captain: false, officers: ['science'], escorts: 0, hands: 0 }
    const roster = generateRoster('gear-bench').map((o) =>
      o.role === 'science' ? { ...o, status: 'injured' as const } : o,
    )
    const site = siteForKind('ruins-tablet')!
    const finesse = approachesFor(site).find((a) => a.needs === 'science')!
    const loadouts = defaultLoadouts()
    const withScience = gearCleanBonus(finesse, team, generateRoster('gear-bench'), loadouts)
    const without = gearCleanBonus(finesse, team, roster, loadouts)
    expect(without).toBeLessThan(withScience)
  })

  it('armour guards its wearer and the medkit rides with the medical officer', () => {
    const loadouts = defaultLoadouts()
    expect(gearGuard(loadouts, 'captain')).toBe(15)
    expect(gearGuard(loadouts, 'science')).toBe(6)

    const roster = generateRoster('gear-medkit')
    expect(teamHasMedkit({ captain: false, officers: ['medical'], escorts: 0, hands: 0 }, roster, loadouts)).toBe(true)
    expect(teamHasMedkit({ captain: false, officers: ['security'], escorts: 0, hands: 0 }, roster, loadouts)).toBe(false)
  })
})
