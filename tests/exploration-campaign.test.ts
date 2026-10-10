import { describe, expect, it } from 'vitest'
import { actionLock, createCampaign, reduceCampaign, travelCost } from '../src/engine/exploration/campaign.js'
import type { Campaign, CampaignAction } from '../src/engine/exploration/campaign.js'
import { locationsAt } from '../src/engine/exploration/v2.js'
import { EXPLORATION_SAVE_KEY, loadExploration, saveExploration } from '../src/ui/exploration-save.js'

const initial = createCampaign('exploration-playable')
function act(state: Campaign, action: CampaignAction) {
  expect(actionLock(state, action)).toBeNull()
  const next = reduceCampaign(state, action)
  expect(next).not.toBe(state)
  return next
}
function recoverCourier(state: Campaign): Campaign {
  const courier = state.world.locations.find((s) => s.name === 'The Silent Courier')!
  state = act(state, { type: 'scan', tier: 'survey' })
  state = act(state, { type: 'investigate', locationId: courier.id })
  return act(state, { type: 'recover', locationId: courier.id, approach: 'careful' })
}
function storage() {
  const data = new Map<string, string>()
  return { getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value) }, removeItem: (key: string) => { data.delete(key) } }
}

describe('playable exploration campaign', () => {
  it('completes discovery → research → install → deep scan through gameplay', () => {
    let state = act(initial, { type: 'research', project: 'spectrometry' })
    state = recoverCourier(state)
    expect(state.research.completed).toContain('spectrometry')
    expect(state.findings).toHaveLength(1)
    expect(state.findings[0]?.kind).toBe('exotic-energy')
    state = act(state, { type: 'research', project: 'deep-survey' })
    // Four out-and-back expeditions advance science, preserving the first site.
    const neighbour = state.galaxy.adjacency[state.at]![0]!
    for (let i = 0; i < 4; i++) {
      if (state.fuel < travelCost(state, neighbour)!) state = act(state, { type: 'emergency-fuel' })
      state = act(state, { type: 'travel', systemId: neighbour })
      if (state.fuel < travelCost(state, initial.at)!) state = act(state, { type: 'emergency-fuel' })
      state = act(state, { type: 'travel', systemId: initial.at })
    }
    expect(state.research.completed).toContain('deep-survey')
    expect(state.deepArray).toBe(false)
    state = act(state, { type: 'install-array' })
    expect(state.exploration.materials).toBe(6)
    expect(state.exploration.credits).toBe(25)
    state = act(state, { type: 'scan', tier: 'deep' })
    expect(locationsAt(state.world, state.at).every((s) => state.exploration.statuses[s.id])).toBe(true)
    expect(state.findings).toHaveLength(1)
    expect(state.exploration.statuses[state.findings[0]!.locationId]).toBe('resolved')
  })

  it('rejects remote interactions, repeated rewards, impossible jumps and locked technology without charging time', () => {
    const state = recoverCourier(initial)
    const bad: CampaignAction[] = [
      { type: 'scan', tier: 'survey' }, { type: 'scan', tier: 'deep' }, { type: 'install-array' },
      { type: 'recover', locationId: state.findings[0]!.locationId, approach: 'careful' },
      { type: 'investigate', locationId: state.world.locations.find((s) => s.systemId !== state.at)!.id },
      { type: 'travel', systemId: 'missing' }, { type: 'travel', systemId: state.at },
      { type: 'research', project: 'deep-survey' }, { type: 'emergency-fuel' },
    ]
    for (const action of bad) expect(reduceCampaign(state, action)).toBe(state)
    expect(state.day).toBe(4)
  })

  it('keeps station services available on return and enforces affordability', () => {
    const station = locationsAt(initial.world, initial.at).find((s) => s.kind === 'station')!
    const service: CampaignAction = { type: 'service', locationId: station.id, service: 'sell' }
    expect(reduceCampaign(initial, service)).toBe(initial)
    let state = act(initial, { type: 'investigate', locationId: station.id })
    const neighbour = state.galaxy.adjacency[state.at]![0]!
    state = act(state, { type: 'travel', systemId: neighbour })
    expect(reduceCampaign(state, service)).toBe(state)
    state = act(state, { type: 'travel', systemId: initial.at })
    state = act(state, service)
    expect(state.exploration.materials).toBe(16)
    expect(state.exploration.credits).toBe(92)
    for (let i = 0; i < 4; i++) state = act(state, service)
    expect(reduceCampaign(state, service)).toBe(state)
    state = act(state, { type: 'service', locationId: station.id, service: 'refuel' })
    expect(state.fuel).toBe(80)
    expect(reduceCampaign(state, { type: 'service', locationId: station.id, service: 'refuel' })).toBe(state)
  })

  it('preserves immutable state and makes rapid retrieval damage explicit', () => {
    const original = JSON.stringify(initial)
    const hazardous = initial.world.locations.find((s) => s.threat > 0 && !s.services.length)!
    let state = { ...initial, at: hazardous.systemId, deepArray: true }
    state = act(state, { type: 'scan', tier: 'deep' })
    state = act(state, { type: 'investigate', locationId: hazardous.id })
    const careful = act(state, { type: 'recover', locationId: hazardous.id, approach: 'careful' })
    const rapid = act(state, { type: 'recover', locationId: hazardous.id, approach: 'rapid' })
    expect(careful.hull).toBe(100)
    expect(rapid.hull).toBe(100 - hazardous.threat * 4)
    expect(careful.exploration).toEqual(rapid.exploration)
    expect(careful.day).toBe(rapid.day + 1)
    expect(JSON.stringify(initial)).toBe(original)
  })

  it('tracks distinct sources of the same discovery instead of collapsing them', () => {
    let state = initial
    for (const site of initial.world.locations.filter((s) => s.discovery === 'spatial-observation').slice(0, 2)) {
      state = { ...state, at: site.systemId, deepArray: true }
      state = act(state, { type: 'scan', tier: 'deep' })
      state = act(state, { type: 'investigate', locationId: site.id })
      state = act(state, { type: 'recover', locationId: site.id, approach: 'careful' })
    }
    expect(state.findings).toHaveLength(2)
    expect(state.findings[0]!.locationId).not.toBe(state.findings[1]!.locationId)
  })

  it('always offers a fuel recovery route with empty stores', () => {
    const state = { ...initial, fuel: 0, exploration: { ...initial.exploration, materials: 0, credits: 0 } }
    const recovered = act(state, { type: 'emergency-fuel' })
    expect(recovered.day).toBe(3)
    expect(recovered.galaxy.adjacency[state.at]!.some((id) => !actionLock(recovered, { type: 'travel', systemId: id }))).toBe(true)
    expect(recovered.exploration).toEqual(state.exploration)
  })

  it('guarantees accessible opening science and distributed essential sources across 40 galaxies', () => {
    for (let i = 0; i < 40; i++) {
      const state = createCampaign(`exploration-sweep-${i}`)
      const starter = locationsAt(state.world, state.at)
      expect(starter.some((s) => s.discovery === 'exotic-energy' && s.scanTier === 'survey' && s.threat === 0)).toBe(true)
      for (const kind of ['exotic-energy', 'spatial-observation', 'alien-propulsion']) {
        const sources = state.world.locations.filter((s) => s.discovery === kind)
        expect(new Set(sources.map((s) => s.systemId)).size).toBeGreaterThanOrEqual(3)
        expect(new Set(sources.map((s) => state.galaxy.systems.find((system) => system.id === s.systemId)!.region)).size).toBeGreaterThan(1)
      }
    }
  })
})

describe('exploration saves and deterministic replay', () => {
  it('resumes exactly and never modifies the original campaign save', () => {
    const memory = storage()
    memory.setItem('starship-explorer-save', 'legacy voyage unchanged')
    const state = recoverCourier(act(initial, { type: 'research', project: 'spectrometry' }))
    expect(saveExploration(state, memory)).toBe(true)
    expect(loadExploration(memory)).toEqual({ campaign: state, error: null })
    expect(memory.getItem('starship-explorer-save')).toBe('legacy voyage unchanged')
    const loaded = loadExploration(memory).campaign!
    expect(reduceCampaign(loaded, { type: 'recover', locationId: loaded.findings[0]!.locationId, approach: 'careful' })).toBe(loaded)
  })

  it('retains malformed, future-version and illegal-action saves without crashing', () => {
    const memory = storage()
    for (const raw of ['{', JSON.stringify({ version: 7, ruleset: 'exploration-v2' }),
      JSON.stringify({ version: 1, ruleset: 'exploration-v2', seed: 'test', actions: [{ type: 'install-array' }] }),
      JSON.stringify({ version: 1, ruleset: 'exploration-v2', seed: 'test', actions: [null] })]) {
      memory.setItem(EXPLORATION_SAVE_KEY, raw)
      expect(loadExploration(memory).campaign).toBeNull()
      expect(loadExploration(memory).error).toBeTruthy()
      expect(memory.getItem(EXPLORATION_SAVE_KEY)).toBe(raw)
    }
  })

  it('reports storage failures', () => {
    expect(saveExploration(initial, { ...storage(), setItem: () => { throw new Error('Quota') } })).toBe(false)
    expect(loadExploration({ ...storage(), getItem: () => { throw new Error('Unavailable') } }).error).toBeTruthy()
  })
})
