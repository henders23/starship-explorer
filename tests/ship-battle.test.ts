import { describe, it, expect } from 'vitest'
import { createShipBattle, reduceShipBattle, shipOrderLock, shieldCapacity, assignedPower, enemyShieldCapacity, surrenderAvailable, effectiveRoom, enemyGunEta, playerEvasion, PREFERRED_TARGET, SHIP_ROOMS } from '../src/engine/exploration/ship-battle.js'
import type { BattleEvent, BattleUpgrades, ShipBattle, ShipOrder } from '../src/engine/exploration/ship-battle.js'
import { SHIP_BY_ID } from '../src/engine/combat/ships.js'
import { actionLock, createCampaign, reduceCampaign } from '../src/engine/exploration/campaign.js'
import { loadExploration, saveExploration, EXPLORATION_SAVE_KEY } from '../src/ui/exploration-save.js'
import type { Campaign } from '../src/engine/exploration/campaign.js'
import { escortContact, runEscort, shipApply } from '../tools/ship-walkthrough.js'

const base: BattleUpgrades = { fireControl: false, ion: false, beam: false, layered: false, adaptive: false, translated: false, contextual: false, countermeasures: false }
const battle = (upgrades: Partial<BattleUpgrades> = {}, cls = 'carrion-jack') => reduceShipBattle(createShipBattle('ship-test', 'station', SHIP_BY_ID[cls]!, 100, 100, { ...base, ...upgrades }), { type: 'engage' })
function apply(b: ShipBattle, a: ShipOrder) { expect(shipOrderLock(b, a)).toBeNull(); return reduceShipBattle(b, a) }
function mem() { let raw: string | null = null; return { getItem: () => raw, setItem: (_: string, s: string) => { raw = s }, removeItem: () => { raw = null } } }
function replay(s: Campaign) { const storage = mem(); saveExploration(s, storage); expect(loadExploration(storage)).toEqual({ campaign: s, error: null }) }

describe('deterministic ship simulation', () => {
  it('keeps orders immutable and reproduces tick batches, shots and room damage', () => {
    const b = battle(), copy = structuredClone(b)
    const batched = apply(b, { type: 'advance', seconds: 5 })
    let steps = b; for (let i = 0; i < 5; i++) steps = apply(steps, { type: 'advance', seconds: 1 })
    expect(batched).toEqual(steps); expect(b).toEqual(copy)
    expect(reduceShipBattle(b, { type: 'advance', seconds: 5 })).toEqual(batched)
    let x = b, y = structuredClone(b)
    for (let i = 0; i < 8; i++) { x = apply(x, { type: 'advance', seconds: 5 }); y = apply(y, { type: 'advance', seconds: 5 }) }
    expect(x).toEqual(y); expect(x.shots).toBeGreaterThan(0)
  })
  it('enforces the reactor budget, hardware limits, modes and ammo', () => {
    let b = battle({ ion: true, beam: true })
    b = apply(b, { type: 'weapon', index: 1, mode: 'hold' })
    expect(shipOrderLock(b, { type: 'weapon', index: 2, mode: 'auto' })).toContain('Allocate')
    expect(shipOrderLock(b, { type: 'power', system: 'weapons', amount: 1 })).toContain('Switch off')
    b = apply(b, { type: 'power', system: 'weapons', amount: 4 }); expect(assignedPower(b)).toBe(8)
    expect(reduceShipBattle(b, { type: 'power', system: 'engines', amount: 3 })).toBe(b)
    expect(reduceShipBattle(b, { type: 'power', system: 'shields', amount: 4 })).toBe(b)
    expect(reduceShipBattle(b, { type: 'fire', index: 0 })).toBe(b)
    b.missiles = 0; b.weapons[1]!.charge = 13
    expect(reduceShipBattle(b, { type: 'fire', index: 1 })).toBe(b)
    for (const a of [null, { type: 'advance', seconds: -1 }, { type: 'advance', seconds: 1.2 }, { type: 'advance', seconds: 6 }, { type: 'power', system: 'hull', amount: 9 }, { type: 'target', index: 0, room: 'bad' }, { type: 'fire', index: 0.5 }]) expect(reduceShipBattle(b, a as ShipOrder)).toBe(b)
  })
  it('applies actual researched weapon and shield improvements', () => {
    const normal = apply(battle(), { type: 'advance', seconds: 5 })
    const fast = apply(battle({ fireControl: true }), { type: 'advance', seconds: 5 })
    expect(fast.weapons[0]!.charge).toBeCloseTo(normal.weapons[0]!.charge * 1.1)
    let layered = apply(battle({ layered: true }), { type: 'power', system: 'shields', amount: 4 })
    expect(shieldCapacity(layered)).toBe(2)
    layered.shield = 0; layered = apply(layered, { type: 'advance', seconds: 4 }); expect(layered.shield).toBe(1)
    const regular = battle({ layered: true }), adaptive = battle({ layered: true, adaptive: true })
    for (const b of [regular, adaptive]) { b.power.shields = 4; b.shield = 0; b.weapons[0]!.mode = 'off'; b.enemy.rooms.weapons.hp = 0 }
    let a = apply(adaptive, { type: 'advance', seconds: 5 }), r = apply(regular, { type: 'advance', seconds: 5 })
    a = apply(a, { type: 'advance', seconds: 2 }); r = apply(r, { type: 'advance', seconds: 2 })
    expect(a.shield).toBe(2); expect(r.shield).toBe(1)
  })
  it('blocks beams with shields, bypasses shields with missiles, and ionises compartments', () => {
    let b = battle({ ion: true, beam: true })
    b.power.weapons = 4; b.weapons[0]!.mode = 'off'; b.weapons[1]!.mode = 'hold'; b.weapons[1]!.charge = 13
    b.enemy.rooms.helm.hp = 0 // eliminate evade to isolate weapon rules
    const hull = b.enemy.hull
    b = apply(b, { type: 'fire', index: 1 }); expect(b.enemy.hull).toBe(hull - 2); expect(b.enemy.shield).toBe(1); expect(b.missiles).toBe(3)
    b.weapons[3]!.mode = 'hold'; b.weapons[3]!.charge = 15
    b = apply(b, { type: 'fire', index: 3 }); expect(b.enemy.hull).toBe(hull - 2)
    b.weapons[3]!.mode = 'off'; b.weapons[2]!.mode = 'hold'; b.weapons[2]!.charge = 7
    b = apply(b, { type: 'fire', index: 2 }); expect(b.enemy.shield).toBe(0); expect(enemyShieldCapacity(b)).toBe(0)
    b.weapons[2]!.charge = 7; b.weapons[2]!.target = 'weapons'
    b = apply(b, { type: 'fire', index: 2 }); expect(effectiveRoom(b, 'enemy', 'weapons')).toBe(0)
    b.weapons[3]!.mode = 'hold'; b.weapons[3]!.charge = 15
    b = apply(b, { type: 'fire', index: 3 }); expect(b.enemy.hull).toBe(hull - 5)
  })
  it('repairs selected compartments and requires working engines for retreat', () => {
    let b = battle(); b.rooms.engines.hp = 0
    b = apply(b, { type: 'retreat', active: true })
    b = apply(b, { type: 'advance', seconds: 5 }); expect(b.escapeWork).toBe(0)
    b = apply(b, { type: 'repair', room: 'engines' })
    b = apply(b, { type: 'advance', seconds: 5 }); b = apply(b, { type: 'advance', seconds: 1 })
    expect(b.rooms.engines.hp).toBeGreaterThan(0)
    for (let i = 0; i < 20 && b.phase === 'battle'; i++) b = apply(b, { type: 'advance', seconds: 5 })
    expect(b.result).toBe('fled')
    expect(reduceShipBattle(b, { type: 'advance', seconds: 1 })).toBe(b)
  })
  it('permits translated surrender only at the advertised hull threshold', () => {
    let b = battle({ contextual: true }); expect(surrenderAvailable(b)).toBe(false)
    b.enemy.hull = 5; expect(surrenderAvailable(b)).toBe(true)
    b = apply(b, { type: 'accept-surrender' }); expect(b.result).toBe('yielded')
    const noLanguage = battle(); noLanguage.enemy.hull = 1
    expect(reduceShipBattle(noLanguage, { type: 'accept-surrender' })).toBe(noLanguage)
  })
})

describe('escort campaign integration', () => {
  it('completes twenty legal seeded escorts with persistent, single-payment reports and replay', () => {
    for (let i = 0; i < 20; i++) {
      const r = runEscort(`escort-sweep-${i}`)
      expect(r.report.shipBattle!.result).toBe('victory'); expect(r.final.hull).toBe(r.report.shipBattle!.hull)
      expect(r.final.exploration.materials).toBe(r.contact.exploration.materials + 12)
      expect(r.final.exploration.credits).toBe(r.contact.exploration.credits + 35)
      expect(r.final.day).toBe(r.contact.day + 1); expect(r.final.escortCompleted).toContain(r.contact.shipBattle!.locationId)
      expect(reduceCampaign(r.final, { type: 'ship-debrief' })).toBe(r.final)
      expect(reduceCampaign(r.final, { type: 'escort', locationId: r.contact.shipBattle!.locationId })).toBe(r.final)
      replay(r.battle); replay(r.nearEnd); replay(r.report); replay(r.final)
    }
  })
  it('blocks other gameplay during contact and battle, including forged outcome reports', () => {
    const s = escortContact('escort-lock')
    for (const a of [{ type: 'rest-team' }, { type: 'ship-debrief' }, { type: 'return-home' }, { type: 'research', project: 'spectrometry' }, { type: 'combatResolve', outcome: 'victory' }] as const) expect(reduceCampaign(s, a as never)).toBe(s)
    expect(reduceCampaign(createCampaign('no-contact'), { type: 'ship-order', order: { type: 'engage' } }).shipBattle).toBeNull()
  })
  it('charges passage exactly once and keeps refusal cost-free', () => {
    let s = escortContact('paid-escort')
    const credits = s.exploration.credits
    s = shipApply(s, { type: 'ship-order', order: { type: 'hail' } })
    s = shipApply(s, { type: 'ship-order', order: { type: 'pay' } }); expect(s.exploration.credits).toBe(credits - 15)
    expect(reduceCampaign(s, { type: 'ship-order', order: { type: 'pay' } })).toBe(s)
    replay(s); s = shipApply(s, { type: 'ship-debrief' }); expect(s.exploration.credits).toBe(credits + 3)
    let declined = escortContact('declined-escort'), day = declined.day
    declined = shipApply(declined, { type: 'ship-order', order: { type: 'cancel' } })
    declined = shipApply(declined, { type: 'ship-debrief' }); expect(declined.day).toBe(day); expect(declined.escortCompleted).toEqual([])
  })
  it('uses fitted weapons, researched shields and translation without mandatory combat', () => {
    let s = createCampaign('ship-upgrades')
    s = { ...s, research: { ...s.research, completed: ['ion-projector', 'layered-shields', 'fire-control', 'contextual-translation', 'trade-language'] }, built: ['ion-projector'] }
    const station = s.world.locations.find((l) => l.systemId === s.at && l.kind === 'station')!
    s = shipApply(s, { type: 'investigate', locationId: station.id })
    let stored = shipApply(s, { type: 'escort', locationId: station.id }); expect(stored.shipBattle!.weapons).toHaveLength(2)
    s = shipApply(s, { type: 'equip', blueprint: 'ion-projector' }); s = shipApply(s, { type: 'escort', locationId: station.id })
    expect(s.shipBattle!.weapons).toHaveLength(3); expect(s.shipBattle!.upgrades.layered).toBe(true)
    s = shipApply(s, { type: 'ship-order', order: { type: 'hail' } }); expect(s.shipBattle!.toll).toBe(8)
    s = shipApply(s, { type: 'ship-order', order: { type: 'negotiate' } }); expect(s.shipBattle!.result).toBe('negotiated')
    expect(s.exploration.credits).toBe(stored.exploration.credits)
  })
  it('makes evasion deterministic across reload and supports both outcomes', () => {
    const results = new Set<string>()
    for (let i = 0; i < 30; i++) {
      const s = escortContact(`evade-${i}`), next = shipApply(s, { type: 'ship-order', order: { type: 'evade' } })
      expect(next).toEqual(reduceCampaign(s, { type: 'ship-order', order: { type: 'evade' } })); results.add(next.shipBattle!.phase)
      replay(next)
    }
    expect(results).toEqual(new Set(['battle', 'report']))
  })
  it('keeps disabled ships recoverable with honest hull and bounded recovery costs', () => {
    let s = escortContact('disabled-escort')
    s = { ...s, hull: 2, shipBattle: { ...s.shipBattle!, hull: 2 } }
    s = shipApply(s, { type: 'ship-order', order: { type: 'engage' } })
    s = shipApply(s, { type: 'ship-order', order: { type: 'weapon', index: 0, mode: 'off' } })
    s = shipApply(s, { type: 'ship-order', order: { type: 'power', system: 'shields', amount: 0 } })
    for (let i = 0; i < 30 && s.shipBattle!.phase === 'battle'; i++) s = shipApply(s, { type: 'ship-order', order: { type: 'advance', seconds: 5 } })
    expect(s.shipBattle!.result).toBe('disabled'); expect(s.hull).toBe(1)
    const station = s.shipBattle!.locationId, day = s.day
    s = { ...s, exploration: { ...s.exploration, credits: 0, materials: 0 } }
    s = shipApply(s, { type: 'ship-debrief' }); expect(s.day).toBe(day + 3); expect(s.exploration.credits).toBe(0); expect(s.exploration.materials).toBe(0)
    expect(s.outcome).toBe('exploring'); expect(actionLock(s, { type: 'escort', locationId: station })).toContain('Repair')
    s = shipApply(s, { type: 'service', locationId: station, service: 'contract' })
    s = shipApply(s, { type: 'service', locationId: station, service: 'repair' }); expect(s.hull).toBe(21)
  })
  it('loads v3 saves without changing prior balances or actions and rejects new orders in old envelopes', () => {
    const storage = mem(), initial = createCampaign('old-boarding-era')
    const raw = JSON.stringify({ version: 3, ruleset: initial.ruleset, seed: initial.seed, legacyActions: null, actions: [] })
    storage.setItem(EXPLORATION_SAVE_KEY, raw)
    expect(loadExploration(storage)).toEqual({ campaign: initial, error: null }); expect(storage.getItem()).toBe(raw)
    const newer = escortContact('newer'); saveExploration(newer, storage)
    const tampered = JSON.parse(storage.getItem()!); tampered.version = 3; storage.setItem(EXPLORATION_SAVE_KEY, JSON.stringify(tampered))
    expect(loadExploration(storage).error).toBeTruthy()
  })
})

describe('rules 2: projectiles, flight time and fires', () => {
  const v2 = (upgrades: Partial<BattleUpgrades> = {}, cls = 'carrion-jack') => reduceShipBattle(createShipBattle('ship-v2', 'station', SHIP_BY_ID[cls]!, 100, 100, { ...base, ...upgrades }, 2), { type: 'engage' })
  const quiet = (b: ShipBattle) => { b.enemy.rooms.weapons.hp = 0; b.enemy.rooms.helm.hp = 0; b.enemy.shield = 0; return b }
  it('flies lasers for one second and resolves them on arrival', () => {
    let b = quiet(v2()); b.weapons[0]!.mode = 'hold'; b.weapons[0]!.charge = 8
    const hull = b.enemy.hull
    b = apply(b, { type: 'fire', index: 0 })
    expect(b.inFlight).toHaveLength(2); expect(b.enemy.hull).toBe(hull)
    expect(b.events!.filter((e) => e.type === 'launch').map((e) => e.type === 'launch' && e.shot)).toEqual([0, 1])
    b = apply(b, { type: 'advance', seconds: 1 })
    expect(b.inFlight).toHaveLength(0); expect(b.enemy.hull).toBe(hull - 2)
    expect(b.events!.filter((e) => e.type === 'impact' && e.outcome === 'hit')).toHaveLength(2)
  })
  it('gives missiles a two-second flight and beams none', () => {
    let b = quiet(v2({ beam: true })); b.power.weapons = 4; b.weapons[0]!.mode = 'off'; b.weapons[1]!.mode = 'hold'; b.weapons[1]!.charge = 13
    const hull = b.enemy.hull
    b = apply(b, { type: 'fire', index: 1 }); b = apply(b, { type: 'advance', seconds: 1 })
    expect(b.enemy.hull).toBe(hull); expect(b.inFlight).toHaveLength(1)
    b = apply(b, { type: 'advance', seconds: 1 }); expect(b.enemy.hull).toBe(hull - 2)
    b.weapons[1]!.mode = 'off'; b.weapons[2]!.mode = 'hold'; b.weapons[2]!.charge = 15
    b = apply(b, { type: 'fire', index: 2 }); expect(b.enemy.hull).toBe(hull - 5); expect(b.inFlight).toHaveLength(0)
  })
  it('lets fires burn compartments until the crew in the room puts them out', () => {
    let b = quiet(v2()); b.weapons.forEach((w) => { w.mode = 'off' })
    b.rooms.shields.fire = 10; b.rooms.engines.fire = 10
    b = apply(b, { type: 'crew', id: 'kerr', room: 'helm' })
    b = apply(b, { type: 'advance', seconds: 4 })
    expect(b.rooms.shields.fire).toBe(0); expect(b.rooms.shields.hp).toBe(4)
    expect(b.events!.some((e) => e.type === 'extinguished' && e.target === 'shields')).toBe(true)
    b = apply(b, { type: 'advance', seconds: 1 })
    expect(b.rooms.engines.fire).toBe(5); expect(b.rooms.engines.hp).toBe(2)
    b = apply(b, { type: 'advance', seconds: 5 })
    expect(b.rooms.engines.fire).toBe(0); expect(b.rooms.engines.hp).toBe(1)
    expect(b.events!.some((e) => e.type === 'extinguished' && e.target === 'engines')).toBe(true)
  })
  it('mans stations: the helm needs an officer, moves take time, crew repair where they stand', () => {
    let b = quiet(v2()); b.weapons.forEach((w) => { w.mode = 'off' })
    const evade = playerEvasion(b)
    expect(evade).toBeGreaterThan(0)
    expect(shipOrderLock(b, { type: 'repair', room: 'helm' })).toMatch(/crew/)
    b = apply(b, { type: 'crew', id: 'mori', room: 'weapons' })
    expect(playerEvasion(b)).toBe(0)
    b = apply(b, { type: 'advance', seconds: 2 }); expect(b.crew!.find((c) => c.id === 'mori')!.moving).toBe(0)
    b.rooms.weapons.hp = 2
    b = apply(b, { type: 'advance', seconds: 5 }); b = apply(b, { type: 'advance', seconds: 5 })
    expect(b.rooms.weapons.hp).toBe(4) // Cross and Mori each patch a point in ten seconds
    b = apply(b, { type: 'crew', id: 'mori', room: 'helm' }); b = apply(b, { type: 'advance', seconds: 2 })
    expect(playerEvasion(b)).toBe(evade)
  })
  it('wounds the crew in a struck room and sends the downed to the medical bay', () => {
    let b = v2(); const cross = () => b.crew!.find((c) => c.id === 'cross')!
    cross().hp = 1; b.shield = 0; b.rooms.helm.hp = 0; b.weapons.forEach((w) => { w.mode = 'off' })
    for (let t = 0; t < 60 && cross().hp > 0; t++) b = apply(b, { type: 'advance', seconds: 1 })
    expect(cross().hp).toBe(0); expect(shipOrderLock(b, { type: 'crew', id: 'cross', room: 'helm' })).toMatch(/medical/)
    for (let t = 0; t < 20; t++) b = apply(b, { type: 'advance', seconds: 1 })
    expect(cross().hp).toBeGreaterThan(0); expect(cross().room).toBe('weapons')
  })
  it('starts fires from hull hits, deterministically', () => {
    let fires = 0
    for (let i = 0; i < 12; i++) {
      let b = reduceShipBattle(createShipBattle(`fire-${i}`, 'station', SHIP_BY_ID['carrion-jack']!, 100, 100, base, 2), { type: 'engage' })
      b = apply(b, { type: 'weapon', index: 1, mode: 'auto' })
      let again = structuredClone(b)
      for (let t = 0; t < 60 && b.phase === 'battle'; t++) {
        b = apply(b, { type: 'advance', seconds: 1 }); again = apply(again, { type: 'advance', seconds: 1 })
        fires += b.events!.filter((e) => e.type === 'fire').length
      }
      expect(b).toEqual(again)
    }
    expect(fires).toBeGreaterThan(0)
  })
  it('batches seconds identically with projectiles in flight and numbers events monotonically', () => {
    let b = v2(); b = apply(b, { type: 'weapon', index: 1, mode: 'auto' })
    let steps = b; for (let i = 0; i < 25 && steps.phase === 'battle'; i++) steps = apply(steps, { type: 'advance', seconds: 1 })
    let batched = b; for (let i = 0; i < 5; i++) batched = apply(batched, { type: 'advance', seconds: 5 })
    expect(batched).toEqual(steps)
    const ids = steps.events!.map((e) => e.id); expect([...ids].sort((x, y) => x - y)).toEqual(ids)
  })
  it('locks a hostile gun on a compartment before it fires, and fires there', () => {
    let b = v2({}, 'rust-queen'); b.weapons[0]!.mode = 'off'
    const gun = SHIP_BY_ID['rust-queen']!.guns[0]!
    while (b.enemy.charges[0]! < gun.time * 0.6 - 1e-9) { expect(b.enemy.aim![0]).toBeNull(); b = apply(b, { type: 'advance', seconds: 1 }) }
    const locked = b.enemy.aim![0]!
    expect(SHIP_ROOMS).toContain(locked); expect(enemyGunEta(b, 0)).toBeGreaterThan(0)
    while (!b.events!.some((e) => e.type === 'launch' && e.side === 'enemy')) b = apply(b, { type: 'advance', seconds: 1 })
    expect(b.events!.find((e) => e.type === 'launch' && e.side === 'enemy')!.target).toBe(locked)
    expect(b.enemy.aim![0]).toBeNull()
  })
  it('follows each hull plan\'s gunnery doctrine', () => {
    const hits: Record<string, number> = {}
    for (let i = 0; i < 60; i++) {
      let b = reduceShipBattle(createShipBattle(`doctrine-${i}`, 'station', SHIP_BY_ID['rust-queen']!, 100, 100, base, 2), { type: 'engage' }); b.weapons[0]!.mode = 'off'
      let launch: BattleEvent | undefined
      for (let t = 0; t < 12 && !launch; t++) { b = apply(b, { type: 'advance', seconds: 1 }); launch = b.events!.find((e) => e.type === 'launch' && e.side === 'enemy') }
      if (launch?.type === 'launch') hits[launch.target] = (hits[launch.target] ?? 0) + 1
    }
    expect(hits[PREFERRED_TARGET.raider]).toBeGreaterThan(Math.max(...SHIP_ROOMS.filter((k) => k !== PREFERRED_TARGET.raider).map((k) => hits[k] ?? 0)))
  })
  it('opens with their guns half charged and ours aimed at their shields', () => {
    const b = v2()
    SHIP_BY_ID['carrion-jack']!.guns.forEach((g, j) => expect(b.enemy.charges[j]).toBe(Math.floor(g.time / 2)))
    expect(b.weapons.map((w) => w.target)).toEqual(['shields', 'shields'])
  })
  it('scales incoming hull damage by weapon kind', () => {
    let b = v2({}, 'carrion-jack'); b.shield = 0; b.rooms.helm.hp = 0; b.weapons[0]!.mode = 'off'
    while (!b.events!.some((e) => e.type === 'impact' && e.side === 'enemy' && e.outcome === 'hit')) b = apply(b, { type: 'advance', seconds: 1 })
    const hit = b.events!.find((e) => e.type === 'impact' && e.side === 'enemy' && e.outcome === 'hit')!
    // Carrion Jack: laser 3 lands in full, missile 6 lands halved.
    expect(hit.type === 'impact' && hit.damage).toBe(3)
  })
  it('gives the hostile nearly charged guns after a failed evasion', () => {
    for (let i = 0; i < 30; i++) {
      const b = reduceShipBattle(createShipBattle(`run-${i}`, 'station', SHIP_BY_ID['carrion-jack']!, 100, 100, base, 2), { type: 'evade' })
      if (b.phase !== 'battle') continue
      SHIP_BY_ID['carrion-jack']!.guns.forEach((g, j) => expect(b.enemy.charges[j]).toBe(Math.floor(g.time * 0.75)))
      return
    }
    throw new Error('Every evasion succeeded')
  })
  it('runs a seven-point reactor and gets their guns back first', () => {
    let b = v2(); expect(shipOrderLock(b, { type: 'power', system: 'engines', amount: 3 })).toBeNull()
    b = apply(b, { type: 'power', system: 'engines', amount: 3 })
    expect(shipOrderLock(b, { type: 'power', system: 'shields', amount: 1 })).toBeNull()
    expect(reduceShipBattle(b, { type: 'power', system: 'weapons', amount: 3 })).toBe(b)
    b = quiet(v2()); b.enemy.rooms.weapons.hp = 1; b.enemy.rooms.weapons.max = 4; b.enemy.rooms.engines.hp = 1; b.weapons.forEach((w) => { w.mode = 'off' })
    b = apply(b, { type: 'advance', seconds: 5 }); b = apply(b, { type: 'advance', seconds: 3 })
    expect(b.enemy.rooms.weapons.hp).toBe(2); expect(b.enemy.rooms.engines.hp).toBe(1)
  })
  it('keeps rules-1 battles free of projectiles and fires', () => {
    let b = battle(); b = apply(b, { type: 'advance', seconds: 5 }); b = apply(b, { type: 'advance', seconds: 5 })
    expect(b.rules).toBeUndefined(); expect(b.inFlight).toBeUndefined(); expect(b.events).toBeUndefined()
  })
  it('rejects rules-2 escorts in journals written before save version 11', () => {
    const s = escortContact('rules-gate'), storage = mem(); saveExploration(s, storage)
    const old = JSON.parse(storage.getItem()!); old.version = 10; storage.setItem(EXPLORATION_SAVE_KEY, JSON.stringify(old))
    expect(loadExploration(storage).error).toBeTruthy()
    const legacy = escortContact('rules-gate', 1); saveExploration(legacy, storage)
    const ok = JSON.parse(storage.getItem()!); ok.version = 10; storage.setItem(EXPLORATION_SAVE_KEY, JSON.stringify(ok))
    expect(loadExploration(storage).campaign!.shipBattle!.rules).toBeUndefined()
    expect(actionLock({ ...legacy, shipBattle: null }, { type: 'escort', locationId: legacy.shipBattle!.locationId, rules: 3 as 2 })).toBe('Unknown battle rules')
  })
})
