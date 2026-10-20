import { describe, expect, it } from 'vitest'
import { actionLock, createCampaign, reduceCampaign } from '../src/engine/exploration/campaign.js'
import type { Campaign } from '../src/engine/exploration/campaign.js'
import { escapeWorkNeeded, FINALE_HULL } from '../src/engine/exploration/ship-battle.js'
import { SHIP_BY_ID } from '../src/engine/combat/ships.js'

const ready = (seed: string, hardcore = false): Campaign => {
  let s = reduceCampaign(createCampaign(seed), { type: 'begin' })
  if (hardcore) s = reduceCampaign(s, { type: 'hardcore' })
  return { ...s, built: [...s.built, 'return-drive'] }
}
const order = (s: Campaign, o: object) => reduceCampaign(s, { type: 'ship-order', order: o } as never)

describe('the way home', () => {
  it('draws the Ashen Sovereign, which cannot be paid, outrun or declined', () => {
    const s = reduceCampaign(ready('finale-a'), { type: 'return-home', finale: 1 })
    expect(s.outcome).toBe('exploring')
    expect(s.shipBattle).toMatchObject({ kind: 'finale', classId: 'sovereign', phase: 'contact', rules: 2 })
    expect(s.shipBattle!.enemy.maxHull).toBe(Math.round(SHIP_BY_ID.sovereign!.hull * FINALE_HULL))
    for (const o of [{ type: 'hail' }, { type: 'pay' }, { type: 'evade' }, { type: 'cancel' }]) expect(actionLock(s, { type: 'ship-order', order: o } as never)).toMatch(/Sovereign/)
    expect(actionLock(s, { type: 'return-home', finale: 2 as 1 })).toBeTruthy()
  })
  it('goes home when the Return Drive takes hold', () => {
    let s = order(reduceCampaign(ready('finale-b'), { type: 'return-home', finale: 1 }), { type: 'engage' })
    s = order(s, { type: 'power', system: 'engines', amount: 3 }); s = order(s, { type: 'retreat', active: true })
    for (let i = 0; i < 300 && s.shipBattle!.phase === 'battle'; i++) s = order(s, { type: 'advance', seconds: 1 })
    expect(['fled', 'disabled']).toContain(s.shipBattle!.result)
    expect(s.shipBattle!.time).toBeGreaterThanOrEqual(escapeWorkNeeded(s.shipBattle!) / 1.5)
    const result = s.shipBattle!.result
    s = reduceCampaign(s, { type: 'ship-debrief' })
    expect(s.shipBattle).toBeNull()
    expect(s.outcome).toBe(result === 'fled' ? 'home' : 'exploring')
  })
  it('leaves a beaten Lodestar adrift to try again, or lost on a hardcore voyage', () => {
    const beaten = (s: Campaign): Campaign => ({ ...s, shipBattle: { ...s.shipBattle!, phase: 'report', result: 'disabled', hull: 0 } })
    const normal = reduceCampaign(beaten(order(reduceCampaign(ready('finale-c'), { type: 'return-home', finale: 1 }), { type: 'engage' })), { type: 'ship-debrief' })
    expect(normal.outcome).toBe('exploring'); expect(normal.hull).toBe(1); expect(actionLock(normal, { type: 'return-home', finale: 1 })).toBeNull()
    const hard = reduceCampaign(beaten(order(reduceCampaign(ready('finale-d', true), { type: 'return-home', finale: 1 }), { type: 'engage' })), { type: 'ship-debrief' })
    expect(hard.outcome).toBe('lost')
  })
  it('keeps old journals going straight home', () => {
    expect(reduceCampaign(ready('finale-e'), { type: 'return-home' }).outcome).toBe('home')
  })
})
