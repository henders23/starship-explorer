import { describe, expect, it } from 'vitest'
import { actionLock, createCampaign, interceptionRisk, interceptor, reduceCampaign, RIFT_GRACE, RIFT_PACE, riftDepth, riftDistance, rifted, riftReaches, travelOrder } from '../src/engine/exploration/campaign.js'
import type { Campaign } from '../src/engine/exploration/campaign.js'
import { loadExploration, saveExploration } from '../src/ui/exploration-save.js'

function mem() { let raw: string | null = null; return { getItem: () => raw, setItem: (_: string, s: string) => { raw = s }, removeItem: () => { raw = null } } }
/** A voyage whose first jump was hazard-aware and quiet, back at the start's station system. */
function opened(prefix: string): Campaign {
  for (let i = 0; i < 100; i++) {
    let s = createCampaign(`${prefix}-${i}`)
    const station = s.world.locations.find((l) => l.systemId === s.at && l.kind === 'station')!
    s = reduceCampaign(s, { type: 'investigate', locationId: station.id })
    const away = s.galaxy.adjacency[s.at]![0]!
    s = reduceCampaign(s, travelOrder(away))
    if (s.shipBattle || s.signal) continue
    s = reduceCampaign(s, { type: 'travel', systemId: s.galaxy.start })
    if (!s.shipBattle && !s.signal) return s
  }
  throw new Error('No quiet opening found')
}

describe('the rift front', () => {
  it('starts its clock at the first hazard-aware jump and never for plain travel', () => {
    const plain = reduceCampaign(createCampaign('rift-plain'), { type: 'travel', systemId: createCampaign('rift-plain').galaxy.adjacency[createCampaign('rift-plain').at]![0]! })
    expect(plain.rift).toBeUndefined(); expect(riftDepth(plain)).toBe(-1)
    const s = opened('rift-a')
    expect(s.rift).toEqual({ from: 1 }) // contacting the station took the first day
    expect(riftReaches(s, s.galaxy.start)).toBe(1 + RIFT_GRACE)
    expect(rifted(s, s.galaxy.start)).toBe(false)
    const storage = mem(); saveExploration(s, storage); expect(loadExploration(storage)).toEqual({ campaign: s, error: null })
  })
  it('swallows one jump-ring every pace, evacuating stations and filling space with heavy hulls', () => {
    const s = opened('rift-b'), station = s.world.locations.find((l) => l.systemId === s.galaxy.start && l.kind === 'station')!
    expect(actionLock(s, { type: 'service', locationId: station.id, service: 'contract' })).toBeNull()
    const later: Campaign = { ...s, day: s.rift!.from + RIFT_GRACE + RIFT_PACE }
    expect(riftDepth(later)).toBe(1)
    expect(rifted(later, s.galaxy.start)).toBe(true)
    for (const n of s.galaxy.adjacency[s.galaxy.start]!) expect(rifted(later, n)).toBe(riftDistance(later, n) <= 1)
    expect(actionLock(later, { type: 'service', locationId: station.id, service: 'contract' })).toMatch(/evacuated/)
    expect(interceptionRisk(later, s.galaxy.start)).toMatch(/Rift-touched/)
    let hits = 0
    for (let d = 0; d < 60; d++) { const hostile = interceptor({ ...later, day: later.day + d }); if (hostile) { hits++; expect(hostile.tier).toBe(2) } }
    expect(hits).toBeGreaterThan(15)
  })
})
