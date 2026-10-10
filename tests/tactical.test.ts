import { describe, it, expect } from 'vitest'
import { createMission, initialRoster, lineOfSight, pathTo, reduceMission, shotInfo, tacticalLock, visible } from '../src/engine/tactical/mission.js'
import type { Mission, TacticalAction } from '../src/engine/tactical/mission.js'
import { actionLock, createCampaign, reduceCampaign } from '../src/engine/exploration/campaign.js'
import type { Campaign } from '../src/engine/exploration/campaign.js'
import { completeBoarding, deployBoarding } from '../tools/tactical-walkthrough.js'
import { EXPLORATION_SAVE_KEY, loadExploration, saveExploration } from '../src/ui/exploration-save.js'

const mission = () => createMission('tactical-unit', 'site', 'Silent Courier', initialRoster().slice(0, 4), 0)
function apply(m: Mission, a: TacticalAction) { expect(tacticalLock(m, a)).toBeNull(); return reduceMission(m, a) }
function storage() { let raw: string | null = null; return { getItem: () => raw, setItem: (_: string, v: string) => { raw = v }, removeItem: () => { raw = null } } }
function roundtrip(s: Campaign) { const mem = storage(); expect(saveExploration(s, mem)).toBe(true); expect(loadExploration(mem)).toEqual({ campaign: s, error: null }) }

describe('tactical rules', () => {
  it('generates deterministic maps with an accessible objective and six named operatives', () => {
    expect(mission()).toEqual(mission()); expect(initialRoster()).toHaveLength(6)
    const m = mission(); m.units = [m.units[0]!]
    expect(pathTo(m, m.units[0]!, m.objective, false)?.length).toBeGreaterThan(0)
    expect(visible(m, { x: 11, y: 9 })).toBe(false)
    expect(m.seen).not.toContain(119)
  })
  it('validates AP, paths, walls, unseen tiles and distinct units without mutation', () => {
    const m = mission(), original = structuredClone(m), u = m.units[0]!
    const n = apply(m, { type: 'move', unitId: u.id, x: 3, y: 3 })
    expect(n.units[0]!.ap).toBe(1); expect(m).toEqual(original)
    for (const a of [
      { type: 'move', unitId: u.id, x: 3, y: 2 }, { type: 'move', unitId: u.id, x: 11, y: 9 },
      { type: 'move', unitId: u.id, x: 1, y: 4 }, { type: 'move', unitId: u.id, x: -1, y: 3 },
      { type: 'move', unitId: u.id, x: 3.5, y: 3 }, { type: 'move', unitId: 'sentry-0', x: 5, y: 4 },
    ] as TacticalAction[]) expect(reduceMission(m, a)).toBe(m)
    expect(reduceMission(n, { type: 'move', unitId: u.id, x: 2, y: 3, sprint: true })).toBe(n)
  })
  it('blocks sight through bulkheads and diagonal cracks; cover and aim show exact modifiers', () => {
    const m = mission(); m.tiles = m.tiles.map(() => 'floor')
    const a = { ...m.units[0]!, x: 2, y: 4 }, b = { ...m.units[4]!, x: 6, y: 4 }
    expect(shotInfo(m, a, b).chance).toBe(75)
    m.tiles[4 * 12 + 5] = 'half'; expect(shotInfo(m, a, b).chance).toBe(55)
    expect(shotInfo(m, { ...a, aimed: true }, b).chance).toBe(75)
    expect(shotInfo(m, { ...a, x: 8 }, b).cover).toBe(0)
    m.tiles[4 * 12 + 5] = 'wall'; expect(lineOfSight(m, a, b)).toBe(false)
    m.tiles[1] = 'wall'; expect(lineOfSight(m, { x: 0, y: 0 }, { x: 2, y: 2 })).toBe(false)
  })
  it('enforces ammo and one shot per turn; RNG replay produces identical results', () => {
    const m = mission(), u = m.units[0]!, t = m.units[4]!
    const a: TacticalAction = { type: 'shoot', unitId: u.id, targetId: t.id }
    const n = apply(m, a)
    expect(n).toEqual(reduceMission(m, a)); expect(n.rolls).toBe(1)
    expect(n.units[0]!.ammo).toBe(u.ammo - 1)
    expect(reduceMission(n, a)).toBe(n)
    const empty = structuredClone(m); empty.units[0]!.ammo = 0
    expect(reduceMission(empty, a)).toBe(empty)
    expect(apply(empty, { type: 'reload', unitId: u.id }).units[0]!.ammo).toBe(u.magazine)
  })
  it('triggers overwatch once during hostile movement and resets AP only after the enemy turn', () => {
    let m = mission(); m.tiles = m.tiles.map(() => 'floor'); m.units = [m.units[0]!, { ...m.units[4]!, x: 10, y: 3 }]
    m = apply(m, { type: 'overwatch', unitId: m.units[0]!.id })
    expect(m.units[0]!.ap).toBe(1)
    const n = apply(m, { type: 'end-turn' })
    expect(n.units[0]!.ammo).toBe(3); expect(n.units[0]!.overwatch).toBe(false)
    expect(n.units[0]!.ap).toBe(2); expect(n.turn).toBe(2)
    expect(n.log.some((s) => s.startsWith('Mara Chen →'))).toBe(true)
  })
  it('revives downed crew with no immediate AP and spends a medkit once', () => {
    const m = mission(); m.units[0]!.hp = 0
    const n = apply(m, { type: 'heal', unitId: m.units[1]!.id, targetId: m.units[0]!.id })
    expect(n.units[0]!.hp).toBe(3); expect(n.units[0]!.ap).toBe(0); expect(n.units[1]!.medkit).toBe(false)
    expect(reduceMission(n, { type: 'heal', unitId: m.units[1]!.id, targetId: m.units[0]!.id })).toBe(n)
    expect(apply(n, { type: 'end-turn' }).units[0]!.ap).toBe(2)
  })
  it('requires explicit consent for losses and allows downed crew to be pulled into extraction', () => {
    const m = mission(); m.units[0]!.hp = 0; m.units[0]!.x = 2; m.units[0]!.y = 4
    expect(tacticalLock(m, { type: 'extract', abandon: false })).toBeTruthy()
    const n = apply(m, { type: 'evacuate', unitId: m.units[1]!.id, targetId: m.units[0]!.id })
    const done = apply(n, { type: 'extract', abandon: false })
    expect(done.rescued).toHaveLength(4); expect(done.outcome).toBe('retreat')
    expect(reduceMission(done, { type: 'end-turn' })).toBe(done)
    const lost = apply(m, { type: 'extract', abandon: true })
    expect(lost.rescued).not.toContain(m.units[0]!.id)
  })
  it('rejects invalid orders, dead actors and targeting your own crew', () => {
    const m = mission()
    for (const a of [null, { type: 'unknown' }, { type: 'move' }, { type: 'extract' }, { type: 'shoot', unitId: 'operative-0', targetId: 'operative-1' }])
      expect(reduceMission(m, a as TacticalAction)).toBe(m)
    m.units[0]!.hp = 0
    expect(reduceMission(m, { type: 'aim', unitId: 'operative-0' })).toBe(m)
  })
})

describe('boarding campaign integration and migration', () => {
  it('blocks ship actions during boarding and preserves mission state through saves', () => {
    const s = deployBoarding('boarding-save')
    roundtrip(s)
    for (const a of [{ type: 'scan', tier: 'deep' }, { type: 'rest-team' }, { type: 'return-home' }, { type: 'begin-drive-test' }, { type: 'debrief' }] as const)
      expect(reduceCampaign(s, a)).toBe(s)
    const n = reduceCampaign(s, { type: 'tactical', order: { type: 'end-turn' } })
    roundtrip(n); expect(n.day).toBe(s.day)
  })
  it('completes twelve seeded missions using only legal orders; rewards and debrief occur once', () => {
    for (let i = 0; i < 12; i++) {
      const run = completeBoarding(`boarding-sweep-${i}`)
      expect(run.report.mission?.outcome).toBe('success'); expect(run.report.mission?.rescued).toHaveLength(4)
      expect(run.final.findings.some((f) => f.kind === 'exotic-energy')).toBe(true)
      expect(run.final.day).toBe(run.deployed.day + 1)
      expect(run.final.exploration.claimed).toContain(run.deployed.mission!.locationId)
      expect(reduceCampaign(run.final, { type: 'debrief' })).toBe(run.final)
      expect(reduceCampaign(run.final, { type: 'deploy', locationId: run.deployed.mission!.locationId, squad: run.deployed.roster.slice(0, 4).map((o) => o.id) })).toBe(run.final)
      roundtrip(run.report); roundtrip(run.final)
    }
  })
  it('retreat leaves science available, records deaths, and permits recovery and recruitment', () => {
    let s = deployBoarding('boarding-retreat')
    const site = s.mission!.locationId
    s = reduceCampaign(s, { type: 'tactical', order: { type: 'move', unitId: 'operative-0', x: 2, y: 3 } })
    s = reduceCampaign(s, { type: 'tactical', order: { type: 'extract', abandon: true } })
    s = reduceCampaign(s, { type: 'debrief' })
    expect(s.roster[0]!.dead).toBe(true); expect(s.findings).toHaveLength(0)
    expect(s.exploration.statuses[site]).toBe('investigated'); roundtrip(s)
    s = reduceCampaign(s, { type: 'recover', locationId: site, approach: 'careful' })
    expect(s.findings).toHaveLength(1)
    const station = s.world.locations.find((l) => l.systemId === s.at && l.kind === 'station')!
    s = reduceCampaign(s, { type: 'investigate', locationId: station.id })
    const before = s.exploration.credits
    s = reduceCampaign(s, { type: 'recruit', locationId: station.id })
    expect(s.roster.at(-1)!.name).toBe('Leila Haddad'); expect(s.exploration.credits).toBe(before - 20)
    expect(s.roster.filter((o) => !o.dead)).toHaveLength(6); roundtrip(s)
  })
  it('makes wounds persistent, enables free medical rest and applies Trauma Protocols', () => {
    for (const trauma of [false, true]) {
      let s = deployBoarding('boarding-injury')
      s = { ...s, mission: structuredClone(s.mission) }
      s.mission!.units[0]!.hp = 1
      if (trauma) s = { ...s, research: { ...s.research, completed: ['trauma-protocols'] } }
      s = reduceCampaign(s, { type: 'tactical', order: { type: 'extract', abandon: false } })
      s = reduceCampaign(s, { type: 'debrief' })
      expect(s.roster[0]!.injuredUntil - s.day).toBe(trauma ? 2 : 4)
      const ids = s.roster.slice(0, 4).map((o) => o.id)
      expect(actionLock(s, { type: 'deploy', locationId: s.lastMission!.locationId, squad: ids })).toContain('healthy')
      while (s.roster[0]!.injuredUntil > s.day) s = reduceCampaign(s, { type: 'rest-team' })
      expect(actionLock(s, { type: 'deploy', locationId: s.lastMission!.locationId, squad: ids })).toBeNull()
    }
  })
  it('records a total squad loss without ending the voyage or blocking replacement funding', () => {
    let s = deployBoarding('boarding-defeat')
    s = { ...s, mission: structuredClone(s.mission) }; s.mission!.units.filter((u) => u.side === 'crew').forEach((u) => { u.hp = 0 })
    s = reduceCampaign(s, { type: 'tactical', order: { type: 'end-turn' } })
    expect(s.mission!.outcome).toBe('defeat')
    s = reduceCampaign(s, { type: 'debrief' })
    expect(s.roster.filter((o) => o.dead)).toHaveLength(4); expect(s.outcome).toBe('exploring')
    expect(actionLock(s, { type: 'recover', locationId: s.lastMission!.locationId, approach: 'careful' })).toBeNull()
  })
  it('migrates version-2 journals additively and preserves the original bytes until save', () => {
    let old = createCampaign('old-research-save')
    old = reduceCampaign(old, { type: 'research', project: 'drive-diagnostics' })
    old = reduceCampaign(old, { type: 'scan', tier: 'survey' })
    const mem = storage(), raw = JSON.stringify({ version: 2, ruleset: old.ruleset, seed: old.seed, legacyActions: null, actions: old.actions })
    mem.setItem(EXPLORATION_SAVE_KEY, raw)
    expect(loadExploration(mem)).toEqual({ campaign: old, error: null }); expect(mem.getItem()).toBe(raw)
    expect(old.roster).toEqual(initialRoster())
    saveExploration(old, mem); expect(JSON.parse(mem.getItem()!).version).toBe(5)
  })
})
