import { describe, expect, it } from 'vitest'
import { actionLock, armouryStock, createCampaign, REACTOR_UPGRADES, ESCORT_MISSILES, EVADE_FUEL, WRECK_HULL, interceptionSpoils, interceptor, MAGAZINE_CAPACITY, ORDNANCE_PRICE, reduceCampaign, STARTING_MISSILES, travelOrder } from '../src/engine/exploration/campaign.js'
import { escortContact } from '../tools/ship-walkthrough.js'
import { ARMOURY, createShipBattle, reactorPower, reduceShipBattle } from '../src/engine/exploration/ship-battle.js'
import type { ArmouryWeaponId } from '../src/engine/exploration/ship-battle.js'
import { SHIP_BY_ID } from '../src/engine/combat/ships.js'
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
    expect(interceptor({ ...plain, hull: WRECK_HULL })).toBeNull()
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
    for (let i = 0; i < 400 && s.shipBattle!.phase === 'battle'; i++) {
      // When they spin up their drive, everything goes into their engines.
      if (s.shipBattle!.enemy.jump !== undefined && s.shipBattle!.weapons[0]!.target !== 'engines') for (const index of [0, 1]) s = order(s, { type: 'target', index, room: 'engines' })
      s = order(s, { type: 'advance', seconds: 1 })
    }
    const result = s.shipBattle!.result
    s = reduceCampaign(s, { type: 'ship-debrief' })
    expect(s.shipBattle).toBeNull(); expect(s.escortCompleted).toEqual([])
    if (result === 'victory') {
      expect(s.exploration.materials).toBeGreaterThanOrEqual(before.materials + 7); expect(s.exploration.credits).toBeGreaterThanOrEqual(before.credits + 15); expect(s.day).toBe(day)
    } else expect(['disabled', 'fled', 'escaped']).toContain(result)
  })
  it('rejects hazardous travel inside journals older than save version 21', () => {
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
    // Retreating from an escort cannot farm the station's missiles either.
    let fled = reduceCampaign(contact, { type: 'ship-order', order: { type: 'engage' } })
    fled = reduceCampaign(fled, { type: 'ship-order', order: { type: 'retreat', active: true } })
    for (let i = 0; i < 40 && fled.shipBattle!.phase === 'battle'; i++) fled = reduceCampaign(fled, { type: 'ship-order', order: { type: 'advance', seconds: 5 } })
    if (fled.shipBattle!.result === 'fled') expect(reduceCampaign(fled, { type: 'ship-debrief' }).missiles).toBeLessThanOrEqual(contact.missiles)
    const legacy = escortContact('magazine-d', 1)
    expect(legacy.shipBattle!.missiles).toBe(4)
  })
})

describe('interception pressure', () => {
  it('burns fuel to break a lock, whether or not it works', () => {
    const s = intercepted('evade-fuel')
    const next = reduceCampaign(s, { type: 'ship-order', order: { type: 'evade' } })
    expect(next.fuel).toBe(s.fuel - EVADE_FUEL)
    expect(actionLock({ ...s, fuel: EVADE_FUEL - 1 }, { type: 'ship-order', order: { type: 'evade' } })).toMatch(/fuel/)
  })
  it('leaves only near-wrecks alone', () => {
    const s = { ...intercepted('wreck'), shipBattle: null }
    expect(interceptor({ ...s, hull: WRECK_HULL })).toBeNull()
  })
})

describe('station armouries', () => {
  it('sell the stocked weapon onto a free hardpoint and mount it in rules-2 battles', () => {
    let s = createCampaign('armoury-a')
    const station = s.world.locations.find((l) => l.systemId === s.at && l.kind === 'station')!
    s = reduceCampaign(s, { type: 'investigate', locationId: station.id })
    const stock = armouryStock(s.seed, station.id), id = stock[0]!, other = (Object.keys(ARMOURY) as ArmouryWeaponId[]).find((w) => !stock.includes(w))!
    expect(new Set(stock).size).toBe(2)
    expect(actionLock(s, { type: 'buy-weapon', locationId: station.id, weapon: other })).toMatch(/does not stock/)
    expect(actionLock({ ...s, exploration: { ...s.exploration, credits: 10 } }, { type: 'buy-weapon', locationId: station.id, weapon: id })).toMatch(/credits/)
    s = { ...s, exploration: { ...s.exploration, credits: 200 } }
    s = reduceCampaign(s, { type: 'buy-weapon', locationId: station.id, weapon: id })
    expect(s.armoury).toEqual([id]); expect(s.exploration.credits).toBe(200 - ARMOURY[id].price)
    expect(actionLock(s, { type: 'buy-weapon', locationId: station.id, weapon: id })).toBe('Already mounted')
    const escort = reduceCampaign(s, { type: 'escort', locationId: station.id, rules: 2 })
    expect(escort.shipBattle!.weapons.map((w) => w.name)).toContain(ARMOURY[id].weapon.name)
    const legacy = reduceCampaign(s, { type: 'escort', locationId: station.id })
    expect(legacy.shipBattle!.weapons.map((w) => w.name)).not.toContain(ARMOURY[id].weapon.name)
    const sold = reduceCampaign(s, { type: 'sell-weapon', locationId: station.id, weapon: id })
    expect(sold.armoury).toEqual([]); expect(sold.exploration.credits).toBe(s.exploration.credits + Math.floor(ARMOURY[id].price / 2))
  })
  it('upgrades the reactor at a yard, one point at a time, up to ten', () => {
    let s = createCampaign('yard-a')
    const station = s.world.locations.find((l) => l.systemId === s.at && l.kind === 'station')!
    s = reduceCampaign(s, { type: 'investigate', locationId: station.id })
    expect(actionLock(s, { type: 'upgrade-reactor', locationId: station.id })).toMatch(/materials/)
    s = { ...s, exploration: { ...s.exploration, materials: 500, credits: 500 } }
    for (let i = 0; i < REACTOR_UPGRADES - 1; i++) s = reduceCampaign(s, { type: 'upgrade-reactor', locationId: station.id })
    // Nine power fills every system until layered shields can take a fourth point.
    expect(actionLock(s, { type: 'upgrade-reactor', locationId: station.id })).toMatch(/Layered Shields/)
    s = { ...s, research: { ...s.research, completed: [...s.research.completed, 'layered-shields'] } }
    s = reduceCampaign(s, { type: 'upgrade-reactor', locationId: station.id })
    expect(s.reactorUpgrades).toBe(REACTOR_UPGRADES)
    expect(actionLock(s, { type: 'upgrade-reactor', locationId: station.id })).toMatch(/limit/)
    const escort = reduceCampaign(s, { type: 'escort', locationId: station.id, rules: 2 })
    expect(reactorPower(escort.shipBattle!)).toBe(10)
  })
  it('fires a Twin Hellion as two missiles, and only with two in the magazine', () => {
    let b = reduceShipBattle(createShipBattle('twin', 'st', SHIP_BY_ID['rust-queen']!, 100, 100,
      { fireControl: false, ion: false, beam: false, layered: false, adaptive: false, translated: false, contextual: false, countermeasures: false }, 2, undefined, 3, ['twin-hellion']), { type: 'engage' })
    const twin = b.weapons.findIndex((w) => w.name === 'Twin Hellion')
    b = { ...b, power: { ...b.power, weapons: 3 }, weapons: b.weapons.map((w, i) => i === twin ? { ...w, mode: 'hold' as const, charge: w.period } : { ...w, mode: 'off' as const }) }
    b = reduceShipBattle(b, { type: 'fire', index: twin })
    expect(b.missiles).toBe(1); expect(b.inFlight).toHaveLength(2)
    b = { ...b, weapons: b.weapons.map((w, i) => i === twin ? { ...w, charge: w.period } : w) }
    expect(reduceShipBattle(b, { type: 'fire', index: twin })).toBe(b)
  })
})
