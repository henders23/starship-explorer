import { describe, expect, it } from 'vitest'
import { actionLock, carefulDays, createCampaign, fitted, fuelCapacity, hasTech, hullCapacity,
  migratePreview, recoveryDamage, reduceCampaign, researchProgress, researchRate, researchRequirements,
  salePrice, stationPrice, travelCost } from '../src/engine/exploration/campaign.js'
import type { Campaign, CampaignAction } from '../src/engine/exploration/campaign.js'
import { createCampaign as oldCampaign, reduceCampaign as oldReduce } from '../src/engine/exploration/legacy-campaign.js'
import { BRANCHES, DRIVE_SEQUENCE, PROJECT_IDS, PROJECTS } from '../src/engine/exploration/research.js'
import type { ProjectId } from '../src/engine/exploration/research.js'
import { locationsAt } from '../src/engine/exploration/v2.js'
import { loadExploration, saveExploration, EXPLORATION_SAVE_KEY } from '../src/ui/exploration-save.js'
import { apply, runReturnVoyage, visit } from '../tools/exploration-walkthrough.js'

function memory() {
  const data = new Map<string, string>()
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) }, removeItem: (key: string) => { data.delete(key) } }
}
function engineeringFixture(): Campaign {
  const state = createCampaign('engineering-lab')
  return { ...state, driveTest: 'complete', exploration: { ...state.exploration, materials: 1000, credits: 1000 },
    research: { active: null, completed: PROJECT_IDS.filter((id) => !PROJECTS[id].future), progress: {}, queue: [] } }
}
function contact(state: Campaign) {
  const station = locationsAt(state.world, state.at).find((s) => s.kind === 'station')!
  return { state: apply(state, { type: 'investigate', locationId: station.id }), station }
}

describe('research catalogue and work scheduler', () => {
  it('has 29 acyclic projects across six branches and exactly 40 base drive days', () => {
    expect(PROJECT_IDS).toHaveLength(29)
    expect(new Set(PROJECT_IDS).size).toBe(29)
    for (const branch of BRANCHES) expect(PROJECT_IDS.filter((id) => PROJECTS[id].branch === branch)).toHaveLength(branch === 'Propulsion' ? 9 : 4)
    const visitNode = (id: ProjectId, ancestors: ProjectId[] = []) => {
      expect(ancestors).not.toContain(id)
      for (const parent of PROJECTS[id].requires) { expect(PROJECT_IDS).toContain(parent); visitNode(parent, [...ancestors, id]) }
    }
    PROJECT_IDS.forEach((id) => visitNode(id))
    expect(DRIVE_SEQUENCE.reduce((sum, id) => sum + PROJECTS[id].days, 0)).toBe(40)
    expect(PROJECT_IDS.filter((id) => PROJECTS[id].future)).toHaveLength(0)
  })

  it('preserves paused work, caps the queue at three and validates reorder/removal', () => {
    let state = apply(createCampaign('queue'), { type: 'research', project: 'drive-diagnostics' })
    state = apply(state, { type: 'scan', tier: 'survey' })
    state = apply(state, { type: 'research', project: 'fuel-tanks' })
    expect(researchProgress(state, 'drive-diagnostics')).toBe(1)
    for (const project of ['drive-diagnostics', 'spectrometry', 'spatial-dynamics'] as ProjectId[]) state = apply(state, { type: 'queue', project })
    expect(actionLock(state, { type: 'queue', project: 'fuel-optimisation' })).toMatch(/full/)
    expect(reduceCampaign(state, { type: 'queue', project: 'spectrometry' })).toBe(state)
    state = apply(state, { type: 'move-queue', project: 'spatial-dynamics', direction: -1 })
    expect(state.research.queue).toEqual(['drive-diagnostics', 'spatial-dynamics', 'spectrometry'])
    state = apply(state, { type: 'pause-research' })
    expect(state.research.active).toBeNull()
    const station = locationsAt(state.world, state.at).find((s) => s.kind === 'station')!
    state = apply(state, { type: 'investigate', locationId: station.id })
    expect(state.research.active).toBe('drive-diagnostics')
    expect(researchProgress(state, 'drive-diagnostics')).toBe(2)
    state = apply(state, { type: 'unqueue', project: 'spatial-dynamics' })
    expect(state.research.queue).toEqual(['spectrometry'])
  })

  it('carries fractional laboratory work into the next ready queue entry', () => {
    const contacted = contact(createCampaign('work-overflow'))
    let state: Campaign = { ...contacted.state, built: ['automated-lab'], equipped: ['automated-lab'],
      research: { active: 'spectrometry', progress: { spectrometry: 3.5 }, completed: ['automated-lab'], queue: ['spatial-dynamics', 'fuel-optimisation'] } }
    state = apply(state, { type: 'service', locationId: contacted.station.id, service: 'contract' })
    expect(hasTech(state, 'spectrometry')).toBe(true)
    expect(state.research.active).toBe('fuel-optimisation')
    expect(researchProgress(state, 'fuel-optimisation')).toBe(3.25)
    expect(state.research.queue).toEqual(['spatial-dynamics'])
  })

  it('does not research with a discovery before the delivery action finishes', () => {
    let state = createCampaign('discovery-clock')
    state = { ...state, research: { active: null, completed: ['drive-diagnostics'], progress: {}, queue: [] } }
    state = apply(state, { type: 'queue', project: 'exotic-storage' })
    const courier = state.world.locations.find((s) => s.name === 'The Silent Courier')!
    state = apply(state, { type: 'scan', tier: 'survey' })
    state = apply(state, { type: 'investigate', locationId: courier.id })
    expect(state.research.active).toBeNull()
    state = apply(state, { type: 'recover', locationId: courier.id, approach: 'careful' })
    expect(state.research.active).toBe('exotic-storage')
    expect(researchProgress(state, 'exotic-storage')).toBe(0)
  })

  it('requires tactical research prerequisites and cannot bypass drive-test requirements', () => {
    const state = createCampaign('no-fake-tech')
    for (const id of ['plasma-ballistics', 'personal-shields'] as const) {
      expect(reduceCampaign(state, { type: 'research', project: id })).toBe(state)
      expect(actionLock(state, { type: 'queue', project: id })).toBeNull()
    }
    expect(actionLock(state, { type: 'return-home' })).toBeTruthy()
    expect(actionLock(state, { type: 'complete-drive-test', approach: 'remote' })).toBeTruthy()
    const ready = { ...engineeringFixture(), driveTest: 'idle' as const, research: { ...engineeringFixture().research, completed: ['prototype-drive'] as ProjectId[] } }
    expect(researchRequirements(ready, 'drive-stabilisation')).toMatch(/field-test/)
  })
})

describe('construction and fitted effects', () => {
  it('charges once, respects slots and retains constructed modules when unfitted', () => {
    let state = engineeringFixture()
    const before = JSON.stringify(state)
    state = apply(state, { type: 'build', blueprint: 'deep-survey' })
    state = apply(state, { type: 'build', blueprint: 'automated-lab' })
    expect(researchRate(state)).toBe(1.25)
    state = apply(state, { type: 'build', blueprint: 'fuel-recycling' })
    expect(state.built).toContain('fuel-recycling')
    expect(fitted(state, 'fuel-recycling')).toBe(false)
    expect(actionLock(state, { type: 'equip', blueprint: 'fuel-recycling' })).toMatch(/slots/)
    const materials = state.exploration.materials
    expect(reduceCampaign(state, { type: 'build', blueprint: 'deep-survey' })).toBe(state)
    state = apply(state, { type: 'unequip', blueprint: 'automated-lab' })
    state = apply(state, { type: 'equip', blueprint: 'fuel-recycling' })
    expect(state.exploration.materials).toBe(materials)
    expect(state.built).toContain('automated-lab')
    expect(researchRate(state)).toBe(1)
    expect(JSON.stringify(engineeringFixture())).toBe(before)
  })

  it('applies tank, injector, hull and recycling effects only after construction', () => {
    let state = engineeringFixture()
    const target = state.galaxy.adjacency[state.at]![0]!
    const originalCost = travelCost({ ...state, research: { ...state.research, completed: [] } }, target)!
    expect(fuelCapacity(state)).toBe(80)
    state = apply(state, { type: 'build', blueprint: 'fuel-optimisation' })
    expect(travelCost(state, target)).toBe(Math.ceil(originalCost * 0.85))
    state = apply(state, { type: 'build', blueprint: 'fuel-tanks' })
    state = apply(state, { type: 'build', blueprint: 'composite-hull' })
    expect(fuelCapacity(state)).toBe(100)
    expect(hullCapacity(state)).toBe(120)
    expect(state.hull).toBe(120)
    expect(actionLock(state, { type: 'unequip', blueprint: 'composite-hull' })).toBeTruthy()
    state = apply(state, { type: 'build', blueprint: 'fuel-recycling' })
    state = apply(state, { type: 'recycle-fuel' })
    expect(state.fuel).toBe(95)
    state = apply(state, { type: 'unequip', blueprint: 'fuel-tanks' })
    expect(state.fuel).toBe(80)
    state = apply(state, { type: 'equip', blueprint: 'fuel-tanks' })
    expect(state.fuel).toBe(80)
  })

  it('gives research useful travel, survey and field-equipment consequences', () => {
    let state = engineeringFixture()
    const index = new GalaxyIndexForTest(state)
    const second = state.galaxy.systems.find((s) => index.distance(s.id) === 2)!
    expect(travelCost(state, second.id)).not.toBeNull()
    expect(travelCost({ ...state, research: { ...state.research, completed: [] } }, second.id)).toBeNull()
    state = apply(state, { type: 'scan', tier: 'survey' })
    const adjacentStation = state.world.locations.find((s) => state.galaxy.adjacency[state.at]!.includes(s.systemId) && s.scanTier === 'passive')
    if (adjacentStation) expect(state.exploration.statuses[adjacentStation.id]).toBe('detected')
    state = apply(state, { type: 'build', blueprint: 'deep-survey' })
    state = apply(state, { type: 'scan', tier: 'deep' })
    const remote = state.world.locations.filter((s) => index.distance(s.systemId) <= 2 && s.scanTier !== 'deep')
    expect(remote.every((s) => state.exploration.statuses[s.id])).toBe(true)
    state = apply(state, { type: 'build', blueprint: 'countermeasures' })
    const derelict = state.world.locations.find((s) => s.kind === 'derelict' && s.threat > 0)!
    expect(recoveryDamage(state, derelict)).toBe(0)
    state = apply(state, { type: 'build', blueprint: 'field-engineering' })
    state = { ...state, at: derelict.systemId }
    if (!state.scans[state.at]) state = apply(state, { type: 'scan', tier: 'deep' })
    state = apply(state, { type: 'investigate', locationId: derelict.id })
    const materials = state.exploration.materials
    state = apply(state, { type: 'recover', locationId: derelict.id, approach: 'rapid' })
    expect(state.exploration.materials - materials).toBe(derelict.reward!.materials + 4)
    state = apply(state, { type: 'build', blueprint: 'recon-drones' })
    expect(carefulDays(state)).toBe(2)
    state = apply(state, { type: 'unequip', blueprint: 'field-engineering' })
    state = apply(state, { type: 'equip', blueprint: 'recon-drones' })
    expect(carefulDays(state)).toBe(1)
  })
})
import { GalaxyIndex } from '../src/engine/worldgen/index-galaxy.js'
class GalaxyIndexForTest {
  index: GalaxyIndex; origin: string
  constructor(state: Campaign) { this.index = new GalaxyIndex(state.galaxy); this.origin = state.at }
  distance(id: string) { return this.index.jumps(this.origin, id) }
}

describe('archives, economy and complete voyages', () => {
  it('supports remote archive records without remote physical services or duplicate science', () => {
    const setup = contact(engineeringFixture())
    let state = apply(setup.state, { type: 'archive', locationId: setup.station.id, kind: 'spatial-observation' })
    expect(actionLock(state, { type: 'archive', locationId: setup.station.id, kind: 'alien-propulsion' })).toMatch(/independent source/)
    expect(stationPrice(state)).toBe(8)
    expect(salePrice(state)).toBe(15)
    const target = state.galaxy.adjacency[state.at]![0]!
    state = visit(state, target)
    state = apply(state, { type: 'archive', locationId: setup.station.id, kind: 'exotic-energy' })
    expect(state.findings).toHaveLength(2)
    expect(actionLock(state, { type: 'service', locationId: setup.station.id, service: 'refuel' })).toBeTruthy()
    expect(actionLock(state, { type: 'archive', locationId: setup.station.id, kind: 'exotic-energy' })).toBeTruthy()
  })

  it('restores materials and credits from zero, without a profitable buy/sell loop', () => {
    const setup = contact(createCampaign('empty-stores'))
    let state = { ...setup.state, exploration: { ...setup.state.exploration, credits: 0, materials: 0 } }
    state = apply(state, { type: 'service', locationId: setup.station.id, service: 'contract' })
    expect(state.exploration.materials).toBe(8)
    expect(state.exploration.credits).toBe(18)
    const credits = state.exploration.credits
    state = apply(state, { type: 'service', locationId: setup.station.id, service: 'buy' })
    state = apply(state, { type: 'service', locationId: setup.station.id, service: 'sell' })
    expect(state.exploration.credits).toBeLessThan(credits)
  })

  it('finishes 20 seeded campaigns using exploration or archives, including missed science sources', () => {
    for (let i = 0; i < 20; i++) {
      const route = i % 2 ? 'archives' : 'exploration'
      const run = runReturnVoyage(`return-sweep-${i}`, route, i % 4 === 0 ? 2 : 0)
      expect(run.state.outcome).toBe('home')
      expect(run.state.exploration.materials).toBeGreaterThanOrEqual(0)
      expect(run.state.exploration.credits).toBeGreaterThanOrEqual(0)
      expect(run.beforeReturn.outcome).toBe('exploring')
      if (route === 'exploration') expect(run.state.research.completed).toHaveLength(5)
      expect(run.duringTest.driveTest).toBe('calibrating')
      expect(researchProgress(run.afterTest, 'drive-stabilisation')).toBe(0)
      for (const action of [{ type: 'emergency-fuel' }, { type: 'return-home' }, { type: 'begin-drive-test' }] as CampaignAction[])
        expect(reduceCampaign(run.state, action)).toBe(run.state)
      const storage = memory(); expect(saveExploration(run.state, storage)).toBe(true)
      expect(loadExploration(storage).campaign).toEqual(run.state)
    }
  })

  it('saves during the field test, permits safe abort and prevents travel while calibrating', () => {
    const run = runReturnVoyage('prototype-scene')
    expect(actionLock(run.duringTest, { type: 'travel', systemId: run.duringTest.galaxy.adjacency[run.duringTest.at]![0]! })).toMatch(/prototype test/)
    const storage = memory(); saveExploration(run.duringTest, storage)
    const resumed = loadExploration(storage).campaign!
    expect(resumed).toEqual(run.duringTest)
    let state = apply(resumed, { type: 'abort-drive-test' })
    expect(state.built).toContain('prototype-drive')
    state = apply(state, { type: 'begin-drive-test' })
    state = apply(state, { type: 'complete-drive-test', approach: 'shielded' })
    expect(state.hull).toBe(resumed.hull - 10)
    expect(state.driveTest).toBe('complete')
    expect(reduceCampaign(state, { type: 'complete-drive-test', approach: 'remote' })).toBe(state)
  })
})

describe('version-1 preview migration', () => {
  it('replays old rules exactly, preserves work/resources, then saves new actions as a v2 continuation', () => {
    let old = oldCampaign('migration-preview')
    old = oldReduce(old, { type: 'research', project: 'spectrometry' })
    old = oldReduce(old, { type: 'scan', tier: 'survey' })
    const courier = old.world.locations.find((s) => s.name === 'The Silent Courier')!
    old = oldReduce(old, { type: 'investigate', locationId: courier.id })
    old = oldReduce(old, { type: 'recover', locationId: courier.id, approach: 'careful' })
    old = oldReduce(old, { type: 'research', project: 'deep-survey' })
    for (let i = 0; i < 8; i++) old = oldReduce(old, { type: 'travel', systemId: old.galaxy.adjacency[old.at]![0]! })
    old = oldReduce(old, { type: 'install-array' })
    const storage = memory()
    const raw = JSON.stringify({ version: 1, ruleset: old.ruleset, seed: old.seed, actions: old.actions })
    storage.setItem(EXPLORATION_SAVE_KEY, raw)
    const migrated = loadExploration(storage).campaign!
    expect(migrated).toEqual(migratePreview(old))
    expect(migrated.day).toBe(old.day)
    expect(migrated.exploration.materials).toBe(old.exploration.materials)
    expect(migrated.exploration.credits).toBe(old.exploration.credits)
    expect(migrated.research.completed).toEqual(old.research.completed)
    expect(fitted(migrated, 'deep-survey')).toBe(true)
    expect(storage.getItem(EXPLORATION_SAVE_KEY)).toBe(raw)
    const continued = apply(migrated, { type: 'research', project: 'drive-diagnostics' })
    saveExploration(continued, storage)
    expect(JSON.parse(storage.getItem(EXPLORATION_SAVE_KEY)!).version).toBe(5)
    expect(loadExploration(storage).campaign).toEqual(continued)
  })
})
