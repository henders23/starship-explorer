import { describe, expect, it } from 'vitest'
import { actionLock, createCampaign, reduceCampaign } from '../src/engine/exploration/campaign.js'
import type { Campaign, CampaignAction } from '../src/engine/exploration/campaign.js'
import { EXPLORATION_SAVE_KEY, MAX_JOURNAL_ACTIONS, loadExploration, saveExploration } from '../src/ui/exploration-save.js'
import { escortContact, shipApply } from '../tools/ship-walkthrough.js'

function mem() { let raw: string | null = null; return { getItem: () => raw, setItem: (_: string, s: string) => { raw = s }, removeItem: () => { raw = null } } }
const second: CampaignAction = { type: 'ship-order', order: { type: 'advance', seconds: 1 } }
const envelope = (s: Campaign, actions: unknown[]) => JSON.stringify({ version: 9, ruleset: s.ruleset, seed: s.seed, legacyActions: null, actions })

/** Plays a battle the way the live clock does: one second per order, with orders between. */
function liveBattle(seed: string, rules: 1 | 2) {
  let s = shipApply(escortContact(seed, rules), { type: 'ship-order', order: { type: 'engage' } })
  const start = s.actions.length
  for (let i = 0; i < 7; i++) s = shipApply(s, second)
  s = shipApply(s, { type: 'ship-order', order: { type: 'power', system: 'engines', amount: 3 } })
  for (let i = 0; i < 13 && s.shipBattle!.phase === 'battle'; i++) s = shipApply(s, second)
  return { s, start }
}

describe('expedition journal length', () => {
  it('journals consecutive battle seconds together and replays to the identical voyage', () => {
    const { s, start } = liveBattle('journal-live', 2)
    expect(s.shipBattle!.time).toBe(20)
    // 7 seconds → 5 + 2; one power order; 13 seconds → 5 + 5 + 3.
    expect(s.actions.slice(start).map((a) => a.type === 'ship-order' && a.order.type === 'advance' ? a.order.seconds : 'order'))
      .toEqual([5, 2, 'order', 5, 5, 3])
    const storage = mem(); expect(saveExploration(s, storage)).toBe(true)
    expect(loadExploration(storage)).toEqual({ campaign: s, error: null })
  })
  it('loads journals written one second at a time by earlier builds, unchanged in outcome', () => {
    // Earlier builds wrote escorts without a rules field: they replay under rules 1.
    const { s, start } = liveBattle('journal-old', 1)
    const contact = s.actions.slice(0, start)
    const old: CampaignAction[] = [...contact, ...Array<CampaignAction>(7).fill(second), { type: 'ship-order', order: { type: 'power', system: 'engines', amount: 3 } }, ...Array<CampaignAction>(13).fill(second)]
    const storage = mem(); storage.setItem(EXPLORATION_SAVE_KEY, envelope(s, old))
    expect(loadExploration(storage)).toEqual({ campaign: s, error: null })
  })
  it('only batches advances, and never past the order limit', () => {
    let s = shipApply(escortContact('journal-limit'), { type: 'ship-order', order: { type: 'engage' } })
    s = shipApply(s, { type: 'ship-order', order: { type: 'advance', seconds: 4 } })
    s = shipApply(s, { type: 'ship-order', order: { type: 'advance', seconds: 2 } })
    expect(s.actions.slice(-2)).toEqual([{ type: 'ship-order', order: { type: 'advance', seconds: 4 } }, { type: 'ship-order', order: { type: 'advance', seconds: 2 } }])
    expect(s.log.at(-1)).toMatch(/^Day \d+ · /)
  })
  it('resumes journals far beyond the old 10,000-action limit, in linear time', () => {
    const s = createCampaign('journal-long')
    const station = s.world.locations.find((l) => l.systemId === s.at && l.kind === 'station')!
    const contract = { type: 'service', locationId: station.id, service: 'contract' }
    const storage = mem(); storage.setItem(EXPLORATION_SAVE_KEY, envelope(s, [{ type: 'investigate', locationId: station.id }, ...Array(MAX_JOURNAL_ACTIONS - 1).fill(contract)]))
    const started = performance.now()
    const loaded = loadExploration(storage)
    // Quadratic replay took about twelve seconds here; linear replay takes well under one.
    expect(performance.now() - started).toBeLessThan(5000)
    expect(loaded.error).toBeNull()
    expect(loaded.campaign!.actions).toHaveLength(MAX_JOURNAL_ACTIONS)
    expect(loaded.campaign!.day).toBe(1 + 3 * (MAX_JOURNAL_ACTIONS - 1))
  })
  it('reports an autosave failure rather than writing a journal the loader would refuse', () => {
    const s = createCampaign('journal-ceiling'), storage = mem()
    expect(saveExploration(s, storage)).toBe(true)
    const kept = storage.getItem()
    const tooLong = { ...s, actions: Array<CampaignAction>(MAX_JOURNAL_ACTIONS + 1).fill({ type: 'scan', tier: 'survey' }) }
    expect(saveExploration(tooLong, storage)).toBe(false)
    expect(storage.getItem()).toBe(kept)
    storage.setItem(EXPLORATION_SAVE_KEY, envelope(s, tooLong.actions))
    expect(loadExploration(storage).campaign).toBeNull()
  })
})

describe('station recovery', () => {
  it('rejects recovery expeditions at stations, which only offer services', () => {
    let s = createCampaign('station-recover')
    const station = s.world.locations.find((l) => l.systemId === s.at && l.kind === 'station')!
    s = reduceCampaign(s, { type: 'investigate', locationId: station.id })
    for (const approach of ['careful', 'rapid'] as const) {
      const recover: CampaignAction = { type: 'recover', locationId: station.id, approach }
      expect(actionLock(s, recover)).toMatch(/services/)
      expect(reduceCampaign(s, recover)).toBe(s)
    }
    expect(actionLock(s, { type: 'service', locationId: station.id, service: 'contract' })).toBeNull()
  })
})

describe('pre-release saves', () => {
  it.each([11, 12])('keeps a version-%i save unchanged and says it cannot be replayed', (version) => {
    const s = createCampaign('pre-release')
    const raw = JSON.stringify({ version, ruleset: s.ruleset, seed: s.seed, legacyActions: null, actions: [] })
    const storage = mem(); storage.setItem(EXPLORATION_SAVE_KEY, raw)
    expect(loadExploration(storage)).toEqual({ campaign: null, error: expect.stringMatching(/pre-release/) })
    expect(storage.getItem()).toBe(raw)
  })
})
