import { describe, expect, it } from 'vitest'
import { actionLock, boardingLoadoutCost, createCampaign, reduceCampaign } from '../src/engine/exploration/campaign.js'
import type { Campaign, CampaignAction } from '../src/engine/exploration/campaign.js'
import { createMission, initialRoster, reduceMission, tacticalLock } from '../src/engine/tactical/mission.js'
import { loadExploration, saveExploration } from '../src/ui/exploration-save.js'
import { preparedTeam } from '../tools/loadout-walkthrough.js'
import { nextBoardingOrder } from '../tools/tactical-walkthrough.js'
const act = (s: Campaign, a: CampaignAction) => { expect(actionLock(s, a)).toBeNull(); return reduceCampaign(s, a) }
function equip(s: Campaign) {
  return act(s, { type: 'loadout', operativeId: s.roster[0]!.id, weapon: 'plasma', gadget: 'shield' })
}
const deployment = (s: Campaign): CampaignAction => ({ type: 'deploy', locationId: s.world.locations.find((l) => l.name === 'The Silent Courier')!.id, squad: s.roster.slice(0, 4).map((o) => o.id) })
function storage(s: Campaign) {
  let raw = ''
  const mem = { getItem: () => raw, setItem: (_: string, v: string) => { raw = v }, removeItem: () => {} }
  saveExploration(s, mem); return mem
}
describe('operative field equipment', () => {
  it('requires research, rejects unknown/dead operatives, and cannot change equipment mid-mission', () => {
    const fresh = createCampaign('gear-locks')
    const order = { type: 'loadout', operativeId: 'operative-0', weapon: 'plasma', gadget: 'shield' } as const
    expect(reduceCampaign(fresh, order)).toBe(fresh)
    const ready = preparedTeam()
    expect(reduceCampaign(ready, { ...order, operativeId: 'not-crew' })).toBe(ready)
    const dead = { ...ready, roster: ready.roster.map((o) => ({ ...o, dead: true })) }
    expect(reduceCampaign(dead, order)).toBe(dead)
    expect(reduceCampaign(ready, { ...order, weapon: 'hacked' } as unknown as CampaignAction)).toBe(ready)
    const deployed = act(equip(ready), deployment(ready))
    expect(reduceCampaign(deployed, { ...order, weapon: 'standard', gadget: 'medkit' })).toBe(deployed)
  })
  it('charges once per deployment, respects squad selection and denies unaffordable deployment', () => {
    const ready = preparedTeam(), geared = equip(ready), ids = ready.roster.slice(0, 4).map((o) => o.id)
    expect(geared.exploration.materials).toBe(ready.exploration.materials)
    expect(boardingLoadoutCost(geared, ids)).toBe(4)
    expect(boardingLoadoutCost(geared, ids.slice(1))).toBe(0)
    const poor = { ...geared, exploration: { ...geared.exploration, materials: 3 } }
    expect(reduceCampaign(poor, deployment(poor))).toBe(poor)
    const deployed = act(geared, deployment(geared)), unit = deployed.mission!.units[0]!
    expect(deployed.exploration.materials).toBe(geared.exploration.materials - 4)
    expect(unit).toMatchObject({ damage: 5, magazine: 2, ammo: 2, shield: 4, medkit: false })
    expect(reduceCampaign(deployed, deployment(deployed))).toBe(deployed)
    const standard = act(poor, { type: 'loadout', operativeId: ids[0]!, weapon: 'standard', gadget: 'medkit' })
    expect(actionLock(standard, deployment(standard))).toBeNull()
  })
  it('replays equipment, consumed resources, active combat and depleted shields exactly', () => {
    let state = act(equip(preparedTeam('gear-replay')), deployment(preparedTeam('gear-replay')))
    for (let i = 0; i < 5; i++) state = act(state, { type: 'tactical', order: { type: 'end-turn' } })
    const mem = storage(state)
    expect(loadExploration(mem).campaign).toEqual(state)
    mem.setItem('', JSON.stringify({ ...JSON.parse(mem.getItem()), version: 4 }))
    expect(loadExploration(mem).campaign).toBeNull()
  })
  it('shields absorb damage before health, do not recharge, and replace the medkit', () => {
    let m = createMission('shield-overflow', 'test', 'Test', initialRoster().slice(0, 4), 0, { 'operative-0': { weapon: 'standard', gadget: 'shield' } })
    m = { ...m, tiles: m.tiles.map(() => 'floor'), units: m.units.map((u, i) => i === 0 ? { ...u, x: 1, y: 3 } : i === 4 ? { ...u, x: 4, y: 3, damage: 7 } : { ...u, hp: 0 }) }
    const original = JSON.stringify(m)
    for (let i = 0; i < 10 && m.units[0]!.shield === 4; i++) m = reduceMission(m, { type: 'end-turn' })
    expect(m.units[0]).toMatchObject({ shield: 0, hp: 7, medkit: false })
    expect(m.log.some((line) => line.includes('4 absorbed'))).toBe(true)
    expect(tacticalLock(m, { type: 'heal', unitId: 'operative-0', targetId: 'operative-0' })).toBe('No medkit equipped')
    expect(JSON.parse(original).units[0].shield).toBe(4)
    m.units[4]!.damage = 1
    const next = reduceMission(m, { type: 'end-turn' })
    expect(next.units[0]!.shield).toBe(0)
  })
  it('keeps standard and empty loadouts equivalent to the baseline configuration', () => {
    const args = ['old-mission', 'site', 'Old mission', initialRoster().slice(0, 4), 2] as const
    expect(createMission(...args, {})).toEqual(createMission(...args))
    expect(createMission(...args, { 'operative-0': { weapon: 'standard', gadget: 'medkit' } })).toEqual(createMission(...args))
  })
  it('completes equipped missions across 12 seeds using legal orders and keeps survivors', () => {
    for (let i = 0; i < 12; i++) {
      let s = equip(preparedTeam(`equipped-sweep-${i}`))
      s = act(s, deployment(s))
      for (let n = 0; n < 300 && s.mission!.outcome === 'active'; n++) {
        const order = nextBoardingOrder(s.mission!)
        if (!order) break
        s = act(s, { type: 'tactical', order })
      }
      expect(s.mission!.outcome).toBe('success')
      expect(s.mission!.rescued).toHaveLength(4)
      s = act(s, { type: 'debrief' })
      expect(s.roster.every((o) => !o.dead)).toBe(true)
    }
  })
})
