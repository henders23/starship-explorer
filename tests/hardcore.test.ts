import { describe, expect, it } from 'vitest'
import { actionLock, createCampaign, interceptor, reduceCampaign, travelOrder, WRECK_HULL } from '../src/engine/exploration/campaign.js'
import { loadExploration, saveExploration, EXPLORATION_SAVE_KEY } from '../src/ui/exploration-save.js'
import { escortContact, shipApply } from '../tools/ship-walkthrough.js'

function mem() { let raw: string | null = null; return { getItem: () => raw, setItem: (_: string, s: string) => { raw = s }, removeItem: () => { raw = null } } }

describe('hardcore voyages', () => {
  it('can only be chosen as the voyage\'s first order, and replays', () => {
    const s = reduceCampaign(createCampaign('hc-a'), { type: 'hardcore' })
    expect(s.hardcore).toBe(true); expect(s.actions).toEqual([{ type: 'hardcore' }])
    expect(actionLock(s, { type: 'hardcore' })).toMatch(/before the voyage/)
    const later = reduceCampaign(createCampaign('hc-b'), travelOrder(createCampaign('hc-b').galaxy.adjacency[createCampaign('hc-b').at]![0]!))
    expect(actionLock({ ...later, shipBattle: null, signal: undefined }, { type: 'hardcore' })).toMatch(/before the voyage/)
    const storage = mem(); saveExploration(s, storage)
    expect(loadExploration(storage)).toEqual({ campaign: s, error: null })
    const old = JSON.parse(storage.getItem()!); old.version = 10; storage.setItem(EXPLORATION_SAVE_KEY, JSON.stringify(old))
    expect(loadExploration(storage).error).toBeTruthy()
  })
  it('ends the voyage when the ship is lost, instead of a tow home', () => {
    let s = escortContact('hc-lost')
    s = { ...s, hardcore: true, hull: 2, shipBattle: { ...s.shipBattle!, hull: 2 } }
    s = shipApply(s, { type: 'ship-order', order: { type: 'engage' } })
    s = shipApply(s, { type: 'ship-order', order: { type: 'power', system: 'shields', amount: 0 } })
    for (let i = 0; i < 60 && s.shipBattle!.phase === 'battle'; i++) s = shipApply(s, { type: 'ship-order', order: { type: 'advance', seconds: 5 } })
    expect(s.shipBattle!.result).toBe('disabled')
    s = shipApply(s, { type: 'ship-debrief' })
    expect(s.outcome).toBe('lost'); expect(s.hull).toBe(0)
    expect(actionLock(s, travelOrder(s.galaxy.adjacency[s.at]![0]!))).toMatch(/lost/)
  })
  it('shows a wreck no mercy', () => {
    const s = createCampaign('hc-wreck')
    let hits = 0
    for (const sys of s.galaxy.systems) for (let d = 1; d < 40; d += 6) if (interceptor({ ...s, hardcore: true, hull: WRECK_HULL, at: sys.id, day: d })) hits++
    expect(hits).toBeGreaterThan(0)
  })
})
