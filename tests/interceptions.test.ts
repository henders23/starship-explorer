import { describe, expect, it } from 'vitest'
import { actionLock, createCampaign, ESCORT_MISSILES, interceptionSpoils, interceptor, MAGAZINE_CAPACITY, ORDNANCE_PRICE, reduceCampaign, STARTING_MISSILES, travelOrder } from '../src/engine/exploration/campaign.js'
import { escortContact } from '../tools/ship-walkthrough.js'
import type { Campaign } from '../src/engine/exploration/campaign.js'
import { followCourse } from '../src/engine/exploration/navigation.js'
import { REGIONAL_THREAT } from '../src/engine/exploration/v2.js'
import { EXPLORATION_SAVE_KEY, loadExploration, saveExploration } from '../src/ui/exploration-save.js'

function mem() { let raw: string | null = null; return { getItem: () => raw, setItem: (_: string, s: string) => { raw = s }, removeItem: () => { raw = null } } }
/** Flies toward the far rim until something is waiting at the end of a jump. */
function intercepted(prefix: string): Campaign {
  for (let i = 0; i < 80; i++) {
    const s = createCampaign(`${prefix}-${i}`)
    const target = [...s.galaxy.systems].sort((a, b) => b.r - a.r || a.id.localeCompare(b.id))[0]!
    const result = followCourse(s, target.id)
    if (result.stop === 'contact') return result.state
  }
  throw new Error('No interception found')
}
const order = (s: Campaign, o: object) => { const a = { type: 'ship-order', order: o } as const; expect(actionLock(s, a as never)).toBeNull(); return reduceCampaign(s, a as never) }

describe('interceptions on arrival', () => {
  it('happen only on hazardous jumps, never in the shallows, and stay deterministic', () => {
    const s = intercepted('intercept-a')
    const system = s.galaxy.systems.find((x) => x.id === s.at)!
    expect(REGIONAL_THREAT[system.region]).toBeGreaterThan(0)
    expect(s.shipBattle).toMatchObject({ kind: 'interception', phase: 'contact', rules: 2, locationId: s.at })
    expect(s.log.at(-1)).toMatch(/Hostile contact/)
    const plain = { ...s, shipBattle: null, actions: [] }
    expect(interceptor({ ...plain, hull: 24 })).toBeNull()
    const storage = mem(); saveExploration(s, storage)
    expect(loadExploration(storage)).toEqual({ campaign: s, error: null })
  })
  it('cannot be declined, and blocks the voyage until resolved', () => {
    const s = intercepted('intercept-b')
    expect(actionLock(s, { type: 'ship-order', order: { type: 'cancel' } })).toMatch(/no declining/)
    const away = s.galaxy.adjacency[s.at]![0]!
    expect(actionLock(s, travelOrder(away))).toMatch(/Resolve the ship encounter/)
  })
  it('pays salvage for a kill, costs no campaign day and leaves escorts untouched', () => {
    let s = intercepted('intercept-c')
    const before = { ...s.exploration }, day = s.day
    s = order(s, { type: 'engage' })
    s = order(s, { type: 'weapon', index: 1, mode: 'auto' })
    for (let i = 0; i < 200 && s.shipBattle!.phase === 'battle'; i++) s = order(s, { type: 'advance', seconds: 5 })
    const result = s.shipBattle!.result
    s = reduceCampaign(s, { type: 'ship-debrief' })
    expect(s.shipBattle).toBeNull(); expect(s.escortCompleted).toEqual([])
    if (result === 'victory') {
      expect(s.exploration.materials).toBeGreaterThanOrEqual(before.materials + 10); expect(s.exploration.credits).toBeGreaterThanOrEqual(before.credits + 22); expect(s.day).toBe(day)
    } else expect(['disabled', 'fled']).toContain(result)
  })
  it('rejects hazardous travel inside journals older than save version 11', () => {
    const s = intercepted('intercept-d'), storage = mem(); saveExploration(s, storage)
    const old = JSON.parse(storage.getItem()!); old.version = 10; storage.setItem(EXPLORATION_SAVE_KEY, JSON.stringify(old))
    expect(loadExploration(storage).error).toBeTruthy()
    expect(actionLock(createCampaign('x'), { type: 'travel', systemId: 'sys-000', hazards: 2 as 1 })).toBe('Unknown travel rules')
  })
  it('lets plain travel orders (older journals) fly without interceptions', () => {
    const s = createCampaign('intercept-plain')
    const [target] = [...s.galaxy.systems].sort((a, b) => b.r - a.r)
    const result = followCourse(s, target!.id, false)
    expect(result.state.shipBattle).toBeNull()
  })
})

describe('the Hellion magazine', () => {
  it('starts stocked, is spent in rules-2 battles and restocked by salvage or the armourer', () => {
    let s = intercepted('magazine-a')
    expect(s.shipBattle!.missiles).toBe(s.missiles)
    s = order(s, { type: 'engage' }); s = order(s, { type: 'weapon', index: 1, mode: 'auto' })
    for (let i = 0; i < 200 && s.shipBattle!.phase === 'battle'; i++) s = order(s, { type: 'advance', seconds: 5 })
    const battle = s.shipBattle!, spoils = interceptionSpoils(battle)
    expect(battle.missiles).toBeLessThan(STARTING_MISSILES)
    s = reduceCampaign(s, { type: 'ship-debrief' })
    expect(s.missiles).toBe(Math.min(MAGAZINE_CAPACITY, battle.missiles + (spoils?.missiles ?? 0)))
    expect(interceptionSpoils(battle)).toEqual(spoils)
  })
  it('sells two missiles at a contacted station, up to the magazine capacity', () => {
    let s = createCampaign('magazine-b')
    const station = s.world.locations.find((l) => l.systemId === s.at && l.kind === 'station')!
    s = reduceCampaign(s, { type: 'investigate', locationId: station.id })
    const credits = s.exploration.credits
    s = reduceCampaign(s, { type: 'service', locationId: station.id, service: 'ordnance' })
    expect(s.missiles).toBe(STARTING_MISSILES + 2); expect(s.exploration.credits).toBe(credits - ORDNANCE_PRICE)
    expect(actionLock({ ...s, missiles: MAGAZINE_CAPACITY }, { type: 'service', locationId: station.id, service: 'ordnance' })).toBe('Magazine full')
  })
  it('keeps escort missiles only when the escort is flown, not declined', () => {
    const contact = escortContact('magazine-c')
    expect(contact.shipBattle!.missiles).toBe(contact.missiles + ESCORT_MISSILES)
    let declined = reduceCampaign(contact, { type: 'ship-order', order: { type: 'cancel' } })
    declined = reduceCampaign(declined, { type: 'ship-debrief' })
    expect(declined.missiles).toBe(contact.missiles)
    const legacy = escortContact('magazine-d', 1)
    expect(legacy.shipBattle!.missiles).toBe(4)
  })
})
