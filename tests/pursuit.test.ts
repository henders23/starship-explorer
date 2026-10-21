import { describe, expect, it } from 'vitest'
import { actionLock, contractPay, createCampaign, FINALE_RECOVERY_HULL, interceptionRisk, reduceCampaign, RIFT_GRACE, RIFT_HULL_TOLL, riftDepth, riftDistance, rifted, riftReaches, riftRim } from '../src/engine/exploration/campaign.js'
import type { Campaign } from '../src/engine/exploration/campaign.js'
import { BASE_REACTOR, createShipBattle, ENEMY_JUMP_WORK, escapeWorkNeeded, INTERCEPTION_ESCAPE_WORK, reduceShipBattle } from '../src/engine/exploration/ship-battle.js'
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
    for (let i = 0; i < 3; i++) { const before = t.exploration.credits; t = reduceCampaign(t, { type: 'service', locationId: station.id, service: 'contract' }); pays.push(t.exploration.credits - before) }
    expect(pays).toEqual([18, 12, 6])
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

describe('round-five review fixes', () => {
  it('lets the crew patch the hull anywhere, slowly, from the stores', () => {
    const s = reduceCampaign(createCampaign('patch'), { type: 'begin' })
    const hurt = { ...s, hull: 50, exploration: { ...s.exploration, materials: 20 } }
    const patched = reduceCampaign(hurt, { type: 'field-repair' })
    expect(patched.hull).toBe(62); expect(patched.exploration.materials).toBe(14); expect(patched.day).toBe(s.day + 2)
    expect(actionLock(s, { type: 'field-repair' })).toMatch(/intact/)
    expect(actionLock({ ...hurt, exploration: { ...hurt.exploration, materials: 2 } }, { type: 'field-repair' })).toMatch(/materials/)
  })
  it('keeps the Return Drive spun up when the captain pauses it', () => {
    let b = reduceShipBattle(createShipBattle('pause', 'sys', SHIP_BY_ID['sovereign']!, 100, 100, base, 2, 'finale'), { type: 'engage' })
    b = reduceShipBattle(b, { type: 'retreat', active: true })
    b = reduceShipBattle(b, { type: 'advance', seconds: 4 })
    const spun = b.escapeWork
    expect(spun).toBeGreaterThan(0)
    b = reduceShipBattle(b, { type: 'retreat', active: false })
    expect(b.escapeWork).toBe(spun)
  })
})

describe('round-six pacing', () => {
  it('spares the outer rim, so the front always leaves somewhere to run', () => {
    const s = reduceCampaign(createCampaign('rim'), { type: 'begin' })
    const late = { ...s, day: 1000 }
    const outer = s.galaxy.systems.filter((x) => Number.isFinite(riftDistance(s, x.id))).sort((a, b) => riftDistance(s, b.id) - riftDistance(s, a.id))[0]!
    expect(riftDepth(late)).toBe(riftRim(s))
    expect(rifted(late, outer.id)).toBe(false); expect(riftReaches(s, outer.id)).toBeNull()
  })
  it('lets the rift finish a hardcore voyage, and only that', () => {
    let s = reduceCampaign(reduceCampaign(createCampaign('rift-death'), { type: 'begin' }), { type: 'hardcore' })
    s = { ...s, day: RIFT_GRACE + 1, hull: 3 }
    const dead = reduceCampaign(s, { type: 'scan', tier: 'survey' })
    expect(dead.outcome).toBe('lost'); expect(dead.lostToRift).toBe(true); expect(dead.hull).toBe(0)
    const soft = reduceCampaign({ ...s, hardcore: undefined }, { type: 'scan', tier: 'survey' })
    expect(soft.outcome).toBe('exploring'); expect(soft.hull).toBe(1)
  })
  it('makes an interception retreat a real jump: twice the work, and fuel', () => {
    const b = createShipBattle('lock', 'sys', SHIP_BY_ID['rust-queen']!, 100, 100, base, 2, 'interception')
    expect(escapeWorkNeeded(b)).toBe(INTERCEPTION_ESCAPE_WORK)
    expect(escapeWorkNeeded({ ...b, kind: undefined })).toBe(10)
  })
})

describe('round-six review fixes', () => {
  it('keeps the Sovereign on our engines while the drive is paused part-way', () => {
    let b = reduceShipBattle(createShipBattle('doctrine', 'sys', SHIP_BY_ID['sovereign']!, 100, 100, base, 2, 'finale'), { type: 'engage' })
    b = reduceShipBattle(reduceShipBattle(b, { type: 'retreat', active: true }), { type: 'advance', seconds: 3 })
    b = reduceShipBattle(b, { type: 'retreat', active: false })
    let aims: string[] = []
    for (let i = 0; i < 40 && b.phase === 'battle'; i++) { b = reduceShipBattle(b, { type: 'advance', seconds: 1 }); aims = aims.concat((b.enemy.aim ?? []).filter((a): a is NonNullable<typeof a> => !!a)) }
    expect(aims.length).toBeGreaterThan(0)
    expect(aims.filter((a) => a === 'engines').length).toBeGreaterThan(aims.length / 2)
  })
  it('refuses an emergency jump from an interception without the fuel for it', () => {
    const s = reduceCampaign(createCampaign('dry'), { type: 'begin' })
    const b = reduceShipBattle(createShipBattle('dry', 'sys', SHIP_BY_ID['rust-queen']!, 100, 100, base, 2, 'interception'), { type: 'engage' })
    expect(actionLock({ ...s, fuel: 1, shipBattle: b }, { type: 'ship-order', order: { type: 'retreat', active: true } })).toMatch(/fuel/)
    expect(actionLock({ ...s, fuel: 5, shipBattle: b }, { type: 'ship-order', order: { type: 'retreat', active: true } })).toBeNull()
  })
  it('warns a wreck that the rift will hunt it', () => {
    const s = reduceCampaign(createCampaign('wreck-warn'), { type: 'begin' })
    expect(interceptionRisk({ ...s, day: RIFT_GRACE + 1, hull: 5 }, s.galaxy.start)).toMatch(/Rift-touched.*wreck or not/)
  })
})

describe('round-seven pacing', () => {
  it('always spares at least two stations from the rift', () => {
    for (const seed of ['spare-a', 'spare-b', 'spare-c', 'spare-d']) {
      const s = { ...reduceCampaign(createCampaign(seed), { type: 'begin' }), day: 5000 }
      const alive = s.world.locations.filter((l) => l.kind === 'station' && Number.isFinite(riftDistance(s, l.systemId)) && !rifted(s, l.systemId))
      expect(alive.length).toBeGreaterThanOrEqual(2)
    }
  })
  it('surges fire through the engine room as the Return Drive spins up', () => {
    let b = reduceShipBattle(createShipBattle('surge', 'sys', SHIP_BY_ID['sovereign']!, 100, 100, base, 2, 'finale'), { type: 'engage' })
    b = reduceShipBattle(b, { type: 'power', system: 'engines', amount: 3 })
    b = reduceShipBattle(b, { type: 'retreat', active: true })
    for (let i = 0; i < 20 && b.phase === 'battle'; i++) b = reduceShipBattle(b, { type: 'advance', seconds: 1 })
    expect(b.log.some((l) => /rift surge/.test(l))).toBe(true)
  })
  it('lets a beaten Lodestar drift behind the drive field, untouched by the rift', () => {
    let s = reduceCampaign(createCampaign('shelter'), { type: 'begin' })
    s = { ...s, built: [...s.built, 'return-drive'], day: RIFT_GRACE + 1 }
    s = reduceCampaign(s, { type: 'return-home', finale: 1 })
    s = { ...s, shipBattle: { ...s.shipBattle!, phase: 'report', result: 'disabled', hull: 0 } }
    expect(reduceCampaign(s, { type: 'ship-debrief' }).hull).toBe(FINALE_RECOVERY_HULL)
  })
})
