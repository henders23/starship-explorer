import { describe, expect, it } from 'vitest'
import { actionLock, contractPay, createCampaign, reduceCampaign, RIFT_GRACE, RIFT_HULL_TOLL, rifted, riftReaches } from '../src/engine/exploration/campaign.js'
import type { Campaign } from '../src/engine/exploration/campaign.js'
import { BASE_REACTOR, createShipBattle, ENEMY_JUMP_WORK, reduceShipBattle } from '../src/engine/exploration/ship-battle.js'
import type { BattleUpgrades, ShipBattle } from '../src/engine/exploration/ship-battle.js'
import { SHIP_BY_ID } from '../src/engine/combat/ships.js'
import { loadExploration, saveExploration } from '../src/ui/exploration-save.js'

function mem() { let raw: string | null = null; return { getItem: () => raw, setItem: (_: string, s: string) => { raw = s }, removeItem: () => { raw = null } } }
const base: BattleUpgrades = { fireControl: false, ion: false, beam: false, layered: false, adaptive: false, translated: false, contextual: false, countermeasures: false }
const contacted = (s: Campaign) => {
  const station = s.world.locations.find((l) => l.systemId === s.at && l.kind === 'station')!
  return { s: reduceCampaign(s, { type: 'investigate', locationId: station.id }), station }
}

describe('a voyage begun under the rift', () => {
  it('starts the rift clock on day zero, before any jump, and replays', () => {
    const s = reduceCampaign(createCampaign('begin-a'), { type: 'begin' })
    expect(s.rift).toEqual({ from: 0 }); expect(riftReaches(s, s.galaxy.start)).toBe(RIFT_GRACE)
    expect(s.log.at(-1)).toMatch(new RegExp(`day ${RIFT_GRACE}`))
    expect(actionLock(s, { type: 'begin' })).toMatch(/already begun/)
    expect(actionLock(s, { type: 'hardcore' })).toBeNull()
    const storage = mem(); saveExploration(s, storage); expect(loadExploration(storage)).toEqual({ campaign: s, error: null })
  })
  it('pays less for each contract taken at the same station, and full rates without the rift', () => {
    const { s, station } = contacted(reduceCampaign(createCampaign('begin-b'), { type: 'begin' }))
    const pays: number[] = []
    let t = s
    for (let i = 0; i < 4; i++) { const before = t.exploration.credits; t = reduceCampaign(t, { type: 'service', locationId: station.id, service: 'contract' }); pays.push(t.exploration.credits - before) }
    expect(pays).toEqual([18, 12, 6, 4])
    expect(contractPay(t, station.id)).toEqual({ materials: 2, credits: 4 })
    const legacy = contacted(createCampaign('begin-b')).s
    expect(contractPay({ ...legacy, contracts: { [station.id]: 5 } }, station.id)).toEqual({ materials: 8, credits: 18 })
  })
  it('tears at the hull for each day spent inside it, never below one', () => {
    const { s } = contacted(reduceCampaign(createCampaign('begin-c'), { type: 'begin' }))
    const inside: Campaign = { ...s, day: RIFT_GRACE }
    expect(rifted(inside, inside.at)).toBe(true)
    const scanned = reduceCampaign(inside, { type: 'scan', tier: 'survey' })
    expect(scanned.day).toBe(inside.day + 1); expect(scanned.hull).toBe(inside.hull - RIFT_HULL_TOLL)
    const frail = reduceCampaign({ ...inside, hull: 2 }, { type: 'scan', tier: 'survey' })
    expect(frail.hull).toBe(1); expect(frail.log.at(-1)).toMatch(/rift tears/)
  })
})

describe('a beaten interceptor runs', () => {
  const intercept = (cls = 'rust-queen', reactor = BASE_REACTOR) => reduceShipBattle(createShipBattle('run', 'sys', SHIP_BY_ID[cls]!, 100, 100, base, 2, 'interception', 6, ['heavy-laser'], reactor), { type: 'engage' })
  const tick = (b: ShipBattle, n: number) => { for (let i = 0; i < n && b.phase === 'battle'; i++) b = reduceShipBattle(b, { type: 'advance', seconds: 1 }); return b }
  it('spins up its drive below 30% hull and escapes unless its engines or helm are broken', () => {
    let b = intercept()
    b = { ...b, power: { ...b.power, weapons: 0 }, weapons: b.weapons.map((w) => ({ ...w, mode: 'off' as const })), enemy: { ...b.enemy, hull: 4, charges: b.enemy.charges.map(() => 0) } }
    b = tick(b, 1)
    expect(b.enemy.jump).toBeGreaterThan(0); expect(b.events!.some((e) => e.type === 'enemy-ftl')).toBe(true)
    b = tick(b, 60)
    expect(b.result).toBe('escaped')
    let held = intercept()
    held = { ...held, power: { ...held.power, weapons: 0 }, weapons: held.weapons.map((w) => ({ ...w, mode: 'off' as const })),
      enemy: { ...held.enemy, hull: 4, rooms: { ...held.enemy.rooms, engines: { ...held.enemy.rooms.engines, hp: 0 } } } }
    held = tick(held, 5)
    expect(held.enemy.jump).toBe(0); expect(held.phase).toBe('battle')
    expect(ENEMY_JUMP_WORK).toBeGreaterThan(0)
  })
  it('asks a toll scaled to its hull, and opens on guns when they carry no shields', () => {
    const light = reduceShipBattle(createShipBattle('toll', 'sys', SHIP_BY_ID['rust-queen']!, 100, 100, base, 2, 'interception'), { type: 'hail' })
    const heavy = reduceShipBattle(createShipBattle('toll', 'sys', SHIP_BY_ID['reaver']!, 100, 100, base, 2, 'interception'), { type: 'hail' })
    expect(light.toll).toBe(42); expect(heavy.toll).toBe(58)
    expect(light.weapons.every((w) => w.target === 'weapons')).toBe(true)
    expect(heavy.weapons.every((w) => w.target === 'shields')).toBe(true)
  })
  it('spends yard power on the guns and switches on bought guns it can power', () => {
    const b = intercept('rust-queen', BASE_REACTOR + 2)
    expect(b.power.weapons).toBe(4)
    expect(b.weapons.find((w) => w.name === 'Heavy laser')!.mode).toBe('auto')
  })
})

describe('the rift toll', () => {
  it('counts only the days actually spent inside the rift', () => {
    let s = reduceCampaign(createCampaign('toll-days'), { type: 'begin' })
    const station = s.world.locations.find((l) => l.systemId === s.at && l.kind === 'station')!
    s = reduceCampaign({ ...s, day: RIFT_GRACE - 3 }, { type: 'investigate', locationId: station.id })
    expect(s.day).toBe(RIFT_GRACE - 2)
    const t = reduceCampaign(s, { type: 'service', locationId: station.id, service: 'contract' })
    expect(t.day).toBe(RIFT_GRACE + 1); expect(t.hull).toBe(s.hull - 2 * RIFT_HULL_TOLL)
  })
})
