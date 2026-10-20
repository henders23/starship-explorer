import { describe, expect, it } from 'vitest'
import { actionLock, createCampaign, reduceCampaign } from '../src/engine/exploration/campaign.js'
import type { Campaign, CampaignAction } from '../src/engine/exploration/campaign.js'
import { EXPLORATION_SAVE_KEY, EXPLORATION_SAVE_VERSION, loadExploration, saveExploration } from '../src/ui/exploration-save.js'

function mem() { let raw: string | null = null; return { getItem: () => raw, setItem: (_: string, s: string) => { raw = s }, removeItem: () => { raw = null } } }
function act(s: Campaign, a: CampaignAction) { expect(actionLock(s, a)).toBeNull(); return reduceCampaign(s, a) }
const on: CampaignAction = { type: 'auto-research', enabled: true }
/** Spends campaign days with station contracts until the lab's active project changes. */
function workUntilIdle(s: Campaign) {
  const station = s.world.locations.find((l) => l.systemId === s.at && l.kind === 'station')!
  if (s.exploration.statuses[station.id] === 'detected') s = act(s, { type: 'investigate', locationId: station.id })
  const project = s.research.active
  while (s.research.active === project) s = act(s, { type: 'service', locationId: station.id, service: 'contract' })
  return s
}
function recoverExotic(s: Campaign) {
  const site = s.world.locations.find((l) => l.systemId === s.at && l.discovery === 'exotic-energy')!
  if (!s.exploration.statuses[site.id]) s = act(s, { type: 'scan', tier: 'survey' })
  if (s.exploration.statuses[site.id] === 'detected') s = act(s, { type: 'investigate', locationId: site.id })
  return act(s, { type: 'recover', locationId: site.id, approach: 'careful' })
}

describe('automatic route-home research', () => {
  it('is off unless the captain turns it on, so earlier journals keep their idle laboratory', () => {
    let s = act(createCampaign('auto-off'), { type: 'research', project: 'drive-diagnostics' })
    expect(s.autoResearch).toBeUndefined()
    s = workUntilIdle(s)
    expect(s.research.completed).toContain('drive-diagnostics')
    expect(s.research.active).toBeNull()
  })
  it('starts the next drive project, waits for its discovery, then continues by itself', () => {
    let s = act(createCampaign('auto-on'), on)
    expect(s.autoResearch).toBe(true)
    expect(s.research.active).toBe('drive-diagnostics')
    s = workUntilIdle(s)
    // Exotic Energy Storage needs an exotic-energy discovery, so the lab waits.
    expect(s.research.active).toBeNull()
    s = recoverExotic(s)
    expect(s.research.active).toBe('exotic-storage')
  })
  it('lets queued projects go first', () => {
    let s = act(createCampaign('auto-queue'), { type: 'queue', project: 'spectrometry' })
    expect(s.research.active).toBe('spectrometry')
    s = act({ ...s, research: { ...s.research, active: null, queue: ['spectrometry'] } }, on)
    expect(s.research.active).toBe('spectrometry')
  })
  it('continues with Drive Stabilisation as soon as the field test completes', () => {
    const base = createCampaign('auto-stabilise')
    let s: Campaign = { ...base, research: { ...base.research, completed: ['drive-diagnostics', 'exotic-storage', 'spatial-dynamics', 'prototype-drive'] },
      built: ['prototype-drive'], scans: { [base.at]: 'survey' } }
    s = act(s, on)
    expect(s.research.active).toBeNull()
    s = act(s, { type: 'begin-drive-test' })
    s = act(s, { type: 'complete-drive-test', approach: 'remote' })
    expect(s.research.active).toBe('drive-stabilisation')
  })
  it('treats a pause as an order and switches automation off', () => {
    let s = act(createCampaign('auto-pause'), on)
    s = act(s, { type: 'pause-research' })
    expect(s.autoResearch).toBeUndefined()
    expect(s.log.at(-1)).toContain('Automatic route-home research is off')
    s = act(s, { type: 'scan', tier: 'survey' })
    expect(s.research.active).toBeNull()
  })
  it('rejects repeated and malformed settings, and can be switched off', () => {
    let s = act(createCampaign('auto-locks'), on)
    expect(actionLock(s, on)).toMatch(/Already/)
    expect(actionLock(s, { type: 'auto-research', enabled: 'yes' } as never)).toMatch(/Invalid/)
    s = act(s, { type: 'auto-research', enabled: false })
    expect(s.autoResearch).toBeUndefined()
    expect(actionLock(s, { type: 'auto-research', enabled: false })).toMatch(/already off/)
  })
  it('saves in the current version and refuses the order inside older envelopes', () => {
    const s = workUntilIdle(act(createCampaign('auto-save'), on)), storage = mem()
    saveExploration(s, storage)
    expect(JSON.parse(storage.getItem()!).version).toBe(EXPLORATION_SAVE_VERSION)
    expect(loadExploration(storage)).toEqual({ campaign: s, error: null })
    const old = JSON.parse(storage.getItem()!); old.version = 9
    storage.setItem(EXPLORATION_SAVE_KEY, JSON.stringify(old))
    expect(loadExploration(storage).campaign).toBeNull()
  })
})
