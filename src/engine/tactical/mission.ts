import type { Operation, OperationKind } from './operations.js'
import { DECK_NAMES, DECK_NOTES, VARIANT_LAYOUTS, survivorNames } from './variants.js'
import type { DeckVariant } from './variants.js'
import { OPERATION_BRIEFINGS } from './operations.js'
import { createRng } from '../rng/prng.js'

export type Role = 'assault' | 'recon' | 'engineer' | 'medic' | 'heavy'
export interface OperativeLoadout { weapon: 'standard' | 'plasma'; gadget: 'medkit' | 'shield' }
export const DEFAULT_LOADOUT: OperativeLoadout = { weapon: 'standard', gadget: 'medkit' }
export interface Operative { id: string; name: string; role: Role; injuredUntil: number; dead: boolean; missions: number; xp: number }
export const ROLE_NOTES: Record<Role, string> = {
  assault: 'Rifle · 3 damage · 10 health', recon: 'Scout · moves 5 tiles · 8 health',
  engineer: 'Can recover the core from 2 tiles away · 9 health', medic: 'Medkit restores 5 health · 9 health', heavy: 'Cannon · 4 damage · 3-round magazine · 11 health',
}
export function initialRoster(): Operative[] {
  return ([['Mara Chen', 'assault'], ['Idris Okonkwo', 'recon'], ['Sofia Reyes', 'engineer'], ['Elias Noor', 'medic'], ['Anika Rao', 'heavy'], ['Tomás Vega', 'assault']] as [string, Role][])
    .map(([name, role], i) => ({ id: `operative-${i}`, name, role, injuredUntil: 0, dead: false, missions: 0, xp: 0 }))
}
export function recruitOperative(index: number): Operative {
  const first = ['Leila', 'Jun', 'Priya', 'Mateo', 'Amina', 'Alex', 'Nia', 'Owen']
  const last = ['Haddad', 'Park', 'Singh', 'Costa', 'Diallo', 'Novak', 'Mensah', 'Price']
  return { id: `recruit-${index}`, name: `${first[index % 8]} ${last[Math.floor(index / 8) % 8]}${index >= 64 ? ` ${Math.floor(index / 64) + 1}` : ''}`,
    role: (['assault', 'medic', 'recon', 'engineer', 'heavy'] as const)[index % 5]!, injuredUntil: 0, dead: false, missions: 0, xp: 0 }
}
export interface Point { x: number; y: number }
export type Tile = 'floor' | 'half' | 'wall'
export interface TacticalUnit extends Point {
  id: string; name: string; role: Role; side: 'crew' | 'hostile'; hp: number; maxHp: number
  shield?: number; weapon?: OperativeLoadout['weapon']
  ap: number; ammo: number; magazine: number; damage: number; move: number; aimed: boolean; fired: boolean; overwatch: boolean; medkit: boolean
}
export interface Mission {
  recorder?: { position:Point; carrierId:string|null; alarmTurn:number|null; reinforcements:number }
  operation?: Operation
  seed: string; locationId: string; name: string; width: number; height: number; tiles: Tile[]
  objective: Point; recovered: boolean; units: TacticalUnit[]; seen: number[]; turn: number; rolls: number
  lastShot: { from: Point; to: Point; hit: boolean; damage: number } | null
  outcome: 'active' | 'success' | 'retreat' | 'defeat'; rescued: string[]; log: string[]
}
export type TacticalAction =
  | { type: 'drop-recorder'; unitId:string }
  | { type: 'move'; unitId: string; x: number; y: number; sprint?: boolean }
  | { type: 'shoot'; unitId: string; targetId: string }
  | { type: 'aim' | 'overwatch' | 'reload' | 'interact'; unitId: string }
  | { type: 'heal'; unitId: string; targetId: string }
  | { type: 'evacuate'; unitId: string; targetId: string }
  | { type: 'end-turn' }
  | { type: 'extract'; abandon: boolean }
export const distance = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
export const inExtraction = (p: Point) => p.x <= 1 && p.y >= 3 && p.y <= 6
export const tileAt = (m: Mission, p: Point): Tile => m.tiles[p.y * m.width + p.x] ?? 'wall'
export const inside = (m: Mission, p: Point) => Number.isInteger(p.x) && Number.isInteger(p.y) && p.x >= 0 && p.y >= 0 && p.x < m.width && p.y < m.height
const neighbours = (p: Point): Point[] => [{ x: p.x - 1, y: p.y }, { x: p.x + 1, y: p.y }, { x: p.x, y: p.y - 1 }, { x: p.x, y: p.y + 1 }]
const livingCrew = (m: Mission) => m.units.filter((u) => u.side === 'crew' && u.hp > 0)

/** Supercover ray: diagonal cracks between two solid tiles do not permit shots. */
export function lineOfSight(m: Mission, a: Point, b: Point): boolean {
  let x = a.x, y = a.y
  const dx = b.x - a.x, dy = b.y - a.y, nx = Math.abs(dx), ny = Math.abs(dy), sx = Math.sign(dx), sy = Math.sign(dy)
  let ix = 0, iy = 0
  while (ix < nx || iy < ny) {
    const d = (1 + 2 * ix) * ny - (1 + 2 * iy) * nx
    if (d === 0) {
      if (tileAt(m, { x: x + sx, y }) === 'wall' || tileAt(m, { x, y: y + sy }) === 'wall') return false
      x += sx; y += sy; ix++; iy++
    } else if (d < 0) { x += sx; ix++ } else { y += sy; iy++ }
    if ((x !== b.x || y !== b.y) && tileAt(m, { x, y }) === 'wall') return false
  }
  return true
}
export const visible = (m: Mission, p: Point) => livingCrew(m).some((u) => distance(u, p) <= 7 && lineOfSight(m, u, p))
function reveal(m: Mission): Mission {
  const seen = new Set(m.seen)
  for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) if (visible(m, { x, y })) seen.add(y * m.width + x)
  return { ...m, seen: [...seen].sort((a, b) => a - b) }
}
export function pathTo(m: Mission, unit: TacticalUnit, target: Point, knownOnly = true): Point[] | null {
  if (!inside(m, target) || tileAt(m, target) !== 'floor') return null
  const key = (p: Point) => p.y * m.width + p.x
  const queue: Point[][] = [[{ x: unit.x, y: unit.y }]], seen = new Set([key(unit)])
  for (let i = 0; i < queue.length; i++) {
    const path = queue[i]!, p = path.at(-1)!
    if (p.x === target.x && p.y === target.y) return path.slice(1)
    for (const q of neighbours(p)) {
      if (!inside(m, q) || seen.has(key(q)) || tileAt(m, q) !== 'floor' ||
        (knownOnly && !m.seen.includes(key(q))) || m.units.some((u) => u.id !== unit.id && u.hp > 0 && u.x === q.x && u.y === q.y)) continue
      seen.add(key(q)); queue.push([...path, q])
    }
  }
  return null
}
/** Cover only protects the side facing the attacker; walls block rays as well. */
export function coverAgainst(m: Mission, target: Point, attacker: Point): number {
  const dx = attacker.x - target.x, dy = attacker.y - target.y
  const face = Math.abs(dx) >= Math.abs(dy) ? { x: target.x + Math.sign(dx), y: target.y } : { x: target.x, y: target.y + Math.sign(dy) }
  return tileAt(m, face) === 'wall' ? 40 : tileAt(m, face) === 'half' ? 20 : 0
}
export function shotInfo(m: Mission, shooter: TacticalUnit, target: TacticalUnit) {
  const range = distance(shooter, target), cover = coverAgainst(m, target, shooter), rangePenalty = Math.max(0, range - 4) * 5, aim = shooter.aimed ? 20 : 0
  return { chance: Math.max(10, Math.min(95, 75 - cover - rangePenalty + aim)), cover, rangePenalty, aim,
    possible: range <= 7 && lineOfSight(m, shooter, target) && target.hp > 0 && shooter.hp > 0 }
}
export function createMission(seed: string, locationId: string, name: string, squad: Operative[], threat: number, loadouts: Record<string, OperativeLoadout> = {}): Mission {
  const width = 12, height = 10, tiles: Tile[] = Array.from({ length: width * height }, () => 'floor')
  // Two layouts share a clear central corridor and safe shuttle approach.
  const alternate = createRng(seed).int(2) === 1
  for (const [x, y] of [[3, 2], [4, 2], [7, 2], [8, 2], [3, 7], [4, 7], [7, 7], [8, 7]]) tiles[y! * width + x!] = 'wall'
  for (const [x, y] of (alternate ? [[4, 3], [6, 6], [8, 4], [9, 6]] : [[4, 6], [6, 3], [8, 6], [9, 4]])) tiles[y! * width + x!] = 'half'
  const units: TacticalUnit[] = squad.map((o, i) => {
    const maxHp = { assault: 10, recon: 8, engineer: 9, medic: 9, heavy: 11 }[o.role]
    const gear = loadouts[o.id] ?? DEFAULT_LOADOUT
    const magazine = gear.weapon === 'plasma' ? 2 : o.role === 'heavy' ? 3 : 4
    return { ...o, x: 1, y: i + 3, side: 'crew', hp: maxHp, maxHp, ap: 2, ammo: magazine, magazine,
      damage: (o.role === 'heavy' ? 4 : 3) + (gear.weapon === 'plasma' ? 2 : 0), move: o.role === 'recon' ? 5 : 4, aimed: false, fired: false, overwatch: false, medkit: gear.gadget === 'medkit',
      ...(gear.weapon === 'plasma' ? { weapon: gear.weapon } : {}), ...(gear.gadget === 'shield' ? { shield: 4 } : {}) }
  })
  for (let i = 0; i < Math.min(4, 2 + threat); i++) units.push({ id: `sentry-${i}`, name: `Custodian ${i + 1}`, role: 'assault', side: 'hostile',
    x: i === 0 ? 6 : 9 + i % 2, y: [4, 5, 3, 6][i]!, hp: 5 + Math.min(threat, 2), maxHp: 5 + Math.min(threat, 2), ap: 2, ammo: 4, magazine: 4,
    damage: 2, move: 3, aimed: false, fired: false, overwatch: false, medkit: false })
  return reveal({ seed, locationId, name, width, height, tiles, objective: { x: 10, y: 5 }, recovered: false,
    units, seen: [], turn: 1, rolls: 0, lastShot: null, outcome: 'active', rescued: [],
    log: [`${squad[0]!.name}: “The custodians are still running. Take the core, then back to the shuttle. We don’t need to clear the whole ship.”`] })
}
/** New operations are opt-in through a separate campaign action; legacy missions stay exact. */
export function createOperation(seed: string, locationId: string, name: string, squad: Operative[], threat: number, loadouts: Record<string, OperativeLoadout>, kind: OperationKind, variant?: DeckVariant): Mission {
  if (variant) {
    const m = createOperation(seed, locationId, name, squad, threat, loadouts, kind)
    m.operation!.variant = variant
    const names = survivorNames(seed, locationId)
    m.operation!.survivors.forEach((s,i) => { s.name = names[i]! })
    if (variant === 2) {
      m.tiles = Array.from({length:120},(_,i) => m.tiles[(9 - Math.floor(i / 12)) * 12 + i % 12]!)
      m.units.forEach((u) => { u.y = 9 - u.y })
      m.objective = {...m.objective,y:9 - m.objective.y}
      for (const p of [...m.operation!.survivors,...m.operation!.crates]) p.y = 9 - p.y
    }
    if (variant === 3) {
      const layout = VARIANT_LAYOUTS[kind]
      m.tiles = Array.from({length:120},() => 'floor')
      for (const [x,y] of layout.walls) m.tiles[y! * 12 + x!] = 'wall'
      for (const [x,y] of layout.cover) m.tiles[y! * 12 + x!] = 'half'
      const rearGuard = m.units.find((u) => u.id === 'sentry-3')
      if (rearGuard) rearGuard.y = 7
      m.objective = {...layout.objective}
      for (const [i,p] of [...m.operation!.survivors,...m.operation!.crates].entries()) Object.assign(p,layout.targets[i])
    }
    m.log.push(`${DECK_NAMES[kind][variant - 1]}. ${DECK_NOTES[kind][variant - 1]}`)
    return reveal({...m,seen:[]})
  }
  const base = createMission(seed, locationId, name, squad, threat, loadouts)
  const layouts: Record<OperationKind, { walls: number[][]; cover: number[][]; objective: Point }> = {
    rescue: { walls: [[6,2],[7,2],[8,2],[6,7],[7,7],[8,7],[4,0],[4,1],[4,8],[4,9]], cover: [[4,3],[4,6],[8,5]], objective: {x:8,y:3} },
    sabotage: { walls: [[5,0],[5,1],[5,2],[5,7],[5,8],[5,9],[9,2],[10,2],[9,7],[10,7]], cover: [[4,4],[7,3],[7,6]], objective: {x:10,y:5} },
    salvage: { walls: [[5,1],[6,1],[7,1],[6,6],[7,6],[8,6],[3,8],[4,8]], cover: [[4,5],[7,3],[9,4]], objective: {x:5,y:3} },
  }
  const layout = layouts[kind], tiles: Tile[] = Array.from({length:base.width * base.height}, () => 'floor')
  for (const [x,y] of layout.walls) tiles[y! * base.width + x!] = 'wall'
  for (const [x,y] of layout.cover) tiles[y! * base.width + x!] = 'half'
  const units = base.units.map((u) => u.side === 'hostile' ? {...u, x: u.id === 'sentry-0' ? 6 : 10, y: [4,6,3,8][Number(u.id.at(-1))]!} : u)
  return reveal({...base, tiles, units, seen: [], objective: layout.objective,
    operation: {kind, alarm:false, reinforcement:false,
      survivors: kind === 'rescue' ? [{id:'survivor-0',name:'Dr Imani Hale',x:8,y:3,leader:null,evacuated:false},{id:'survivor-1',name:'Tarin Voss',x:9,y:6,leader:null,evacuated:false}] : [],
      crates: kind === 'salvage' ? [{x:5,y:3,collected:false},{x:8,y:5,collected:false},{x:10,y:7,collected:false}] : []},
    log:[OPERATION_BRIEFINGS[kind].voice]})
}
/** Separate opt-in contract; no changes to any historical operation journal. */
export function createRecorderMission(seed:string, locationId:string, name:string, squad:Operative[], loadouts:Record<string,OperativeLoadout>):Mission {
  const m=createMission(seed,locationId,name,squad,0,loadouts)
  m.tiles=Array.from({length:120},()=> 'floor')
  for(const [x,y] of [[4,1],[5,1],[6,1],[4,7],[5,7],[6,7],[8,3],[8,4],[8,6]])m.tiles[y!*12+x!]='wall'
  for(const [x,y] of [[3,3],[5,5],[7,2],[9,7]])m.tiles[y!*12+x!]='half'
  m.objective={x:9,y:2};m.recorder={position:{...m.objective},carrierId:null,alarmTurn:null,reinforcements:0}
  m.units.filter(u=>u.side==='hostile').forEach((u,i)=>{u.x=7+i*3;u.y=4+i;u.name=i?'Archive custodian':'Watch custodian'})
  m.log=['Sofia: “The recorder has a broken shock mount. Carry it gently: two tiles per action, no sprint. Lifting it wakes two reserve units, one every two enemy turns. We can leave it and withdraw.”']
  return reveal({...m,seen:[]})
}
function updateRecorder(m:Mission) {
  const r=m.recorder;if(!r)return
  const carrier=m.units.find(u=>u.id===r.carrierId)
  if(carrier){r.position={x:carrier.x,y:carrier.y};if(carrier.hp<=0){r.carrierId=null;m.log.push('Recorder dropped beside the downed carrier. Another operative can recover it.')}}
  m.objective={...r.position}
  m.recovered=!!r.carrierId&&!!carrier&&carrier.hp>0&&inExtraction(carrier)
}
export function operationReward(m: Mission): { materials: number; credits: number } {
  if (!m.operation || m.outcome !== 'success') return {materials:0,credits:0}
  const count = m.operation.kind === 'rescue' ? m.operation.survivors.filter((s) => s.evacuated).length : m.operation.crates.filter((c) => c.collected).length
  return m.operation.kind === 'sabotage' ? {materials:8,credits:20} : {materials:count * (m.operation.kind === 'rescue' ? 3 : 5), credits:count * (m.operation.kind === 'rescue' ? 15 : 8)}
}
export function operationStatus(m: Mission): string {
  const op = m.operation
  if(m.recorder){
    const r=m.recorder,carrier=m.units.find(u=>u.id===r.carrierId)
    if(m.outcome!=='active')return m.outcome==='success'?'Recorder and evidence safely aboard. Report to the survivor at the station.':'The recorder remains behind. Report honestly to the survivor at the station.'
    return `${r.carrierId?`${carrier!.name} carries the recorder: 2 tiles per AP, no sprint.`:'Reach the amber recorder; recover it or withdraw.'} ${r.alarmTurn===null?'Security reserves wake when it is lifted.':`${r.reinforcements}/2 security reserves deployed; a reserve arrives every two enemy turns after pickup.`} Bring the carrier into the shuttle zone, then extract.`
  }
  if (!op) return m.recovered ? 'Core secured. Bring the team to the teal shuttle zone.' : 'Reach the amber core and recover it. Killing every custodian is optional.'
  if (m.outcome !== 'active') {
    if (op.kind === 'rescue') return `${op.survivors.filter((s) => s.evacuated).length}/2 civilians reached the shuttle. ${op.survivors.filter((s) => !s.evacuated).map((s) => s.name).join(' and ')}${op.survivors.some((s) => !s.evacuated) ? ' remained outside.' : 'Both surveyors are safely aboard.'}`
    if (op.kind === 'sabotage') return op.alarm ? 'The security uplink is disabled. The operation has ended.' : 'The team withdrew with the uplink still active.'
    return `${op.crates.filter((c) => c.collected).length}/3 cases secured during the operation. ${m.outcome === 'success' ? 'The shuttle is clear of the thermal surge.' : 'No cargo reward was recovered.'}`
  }
  if (op.kind === 'rescue') return `${op.survivors.filter((s) => s.evacuated).length}/2 survivors aboard. Guide each survivor, then lead them into the shuttle zone.`
  if (op.kind === 'sabotage') return op.alarm ? `Uplink disabled. Guards are pursuing. ${op.reinforcement ? 'Reserve custodian deployed.' : 'One reserve arrives next enemy turn.'} Extract the team.` : 'Disable the amber security uplink. Guards hold position until sabotage.'
  return `${op.crates.filter((c) => c.collected).length}/3 cases recovered. ${m.turn < 4 ? `Heat starts after ${4 - m.turn + 1} enemy turns.` : `End-turn heat: ${m.turn < 7 ? 1 : 2} health beyond column 4.`} Extract with any cargo; columns 1–4 are safe.`
}
function rescueTarget(m: Mission, u: TacticalUnit) {
  return m.operation?.survivors.find((s) => !s.evacuated && s.leader !== u.id && distance(u,s) <= 1 && lineOfSight(m,u,s) &&
    !m.operation!.survivors.some((other) => !other.evacuated && other.leader === u.id) &&
    (!s.leader || !m.units.some((leader) => leader.id === s.leader && leader.hp > 0)))
}
function salvageTarget(m: Mission, u: TacticalUnit) {
  return m.operation?.crates.find((c) => !c.collected && distance(u,c) <= (u.role === 'engineer' ? 2 : 1) && lineOfSight(m,u,c))
}
export function interactionLabel(m: Mission): string {
  return m.recorder ? 'Lift recorder' : m.operation?.kind === 'rescue' ? 'Guide survivor' : m.operation?.kind === 'sabotage' ? 'Disable uplink' : m.operation?.kind === 'salvage' ? 'Collect cargo case' : 'Recover core'
}
function updateOperation(m: Mission) {
  const op = m.operation
  if (!op) return
  if (op.kind === 'rescue') {
    for (const s of op.survivors) if (!s.evacuated && s.leader && (inExtraction(s) || m.units.some((u) => u.id === s.leader && u.hp > 0 && inExtraction(u) && distance(u,s) <= 1 && lineOfSight(m,u,s)))) { s.evacuated = true; m.log.push(`${s.name}: “I can see the shuttle. Thank you.” Survivor evacuated.`) }
    m.recovered = op.survivors.some((s) => s.evacuated)
    const waiting = op.survivors.find((s) => !s.evacuated && !s.leader) ?? op.survivors.find((s) => !s.evacuated)
    if (waiting) m.objective = {x:waiting.x,y:waiting.y}
  }
  if (op.kind === 'salvage') {
    m.recovered = op.crates.some((c) => c.collected)
    const next = op.crates.find((c) => !c.collected)
    if (next) m.objective = {x:next.x,y:next.y}
  }
}
export function extractionLosses(m: Mission): TacticalUnit[] {
  return m.units.filter((u) => u.side === 'crew' && !inExtraction(u))
}
export function tacticalLock(m: Mission, action: TacticalAction): string | null {
  if (!action || typeof action !== 'object') return 'Invalid order'
  if (m.outcome !== 'active') return 'Mission complete'
  if (action.type === 'end-turn') return null
  if (action.type === 'extract') {
    if (!livingCrew(m).some(inExtraction)) return 'A conscious operative must reach the shuttle zone'
    if (typeof action.abandon !== 'boolean') return 'Confirm extraction order'
    if (m.operation?.kind === 'rescue' && m.operation.survivors.some((s) => !s.evacuated) && !action.abandon) return 'Confirm departure with civilians still outside'
    return extractionLosses(m).length && !action.abandon ? 'Some operatives are outside the shuttle zone' : null
  }
  if (!('unitId' in action)) return 'Unknown order'
  const u = m.units.find((unit) => unit.id === action.unitId && unit.side === 'crew')
  if (!u || u.hp <= 0) return 'Select a conscious operative'
  const cost = action.type === 'move' && action.sprint ? 2 : 1
  if (u.ap < cost) return `Requires ${cost} AP`
  switch (action.type) {
    case 'move': {
      if (action.sprint !== undefined && typeof action.sprint !== 'boolean') return 'Invalid movement order'
      if(m.recorder?.carrierId===u.id && action.sprint)return 'Recorder is fragile: carrier cannot sprint'
      const path = pathTo(m, u, action)
      if(m.recorder?.carrierId===u.id && path && path.length>2)return 'Recorder carrier can move only 2 tiles per AP'
      return !path?.length || path.length > u.move * cost ? 'Choose a reachable, explored floor tile' : null
    }
    case 'shoot': {
      const t = m.units.find((unit) => unit.id === action.targetId && unit.side === 'hostile')
      if (u.fired) return 'One shot per turn'
      if (!u.ammo) return 'Reload first'
      return !t || !visible(m, t) || !shotInfo(m, u, t).possible ? 'Target must be visible, in range and in line of sight' : null
    }
    case 'aim': return u.aimed || u.fired ? 'Aim before firing; aim does not stack' : null
    case 'reload': return u.ammo === u.magazine ? 'Magazine full' : null
    case 'overwatch': return u.fired || u.overwatch || !u.ammo ? 'Requires ammunition and an unused shot' : null
    case 'drop-recorder': return m.recorder?.carrierId===u.id ? null : 'This operative is not carrying the recorder'
    case 'interact':
      if(m.recorder)return m.recorder.carrierId ? 'The recorder already has a carrier' : distance(u,m.recorder.position)>1||!lineOfSight(m,u,m.recorder.position) ? 'Stand beside the recorder' : null
      if (m.operation?.kind === 'rescue') return rescueTarget(m,u) ? null : 'Reach an unescorted survivor with an operative who is not already escorting'
      if (m.operation?.kind === 'salvage') return salvageTarget(m,u) ? null : 'Reach an uncollected case (engineer: within two tiles)'
      return m.recovered ? 'Core already secured' : distance(u, m.objective) > (u.role === 'engineer' ? 2 : 1) || !lineOfSight(m, u, m.objective) ? 'Move next to the core (engineer: within two tiles)' : null
    case 'heal': {
      const t = m.units.find((unit) => unit.id === action.targetId && unit.side === 'crew')
      return !u.medkit ? u.shield !== undefined ? 'No medkit equipped' : 'Medkit spent' : !t || t.hp >= t.maxHp || distance(u, t) > 1 ? 'Choose an injured adjacent operative or yourself' : null
    }
    case 'evacuate': {
      const t = m.units.find((unit) => unit.id === action.targetId && unit.side === 'crew')
      return !t || t.hp > 0 || distance(u, t) > 1 || !inExtraction(u) ? 'Stand in the shuttle zone beside a downed operative to pull them aboard' : null
    }
    default: return 'Unknown order'
  }
}
function fire(m: Mission, shooter: TacticalUnit, target: TacticalUnit) {
  const info = shotInfo(m, shooter, target)
  const hit = createRng(`${m.seed}:shot:${m.rolls++}`).int(100) < info.chance
  m.lastShot = { from: { x: shooter.x, y: shooter.y }, to: { x: target.x, y: target.y }, hit, damage: shooter.damage }
  shooter.ammo--; shooter.fired = true; shooter.overwatch = false; shooter.aimed = false
  const absorbed = hit ? Math.min(target.shield ?? 0, shooter.damage) : 0
  if (hit) {
    if (target.shield !== undefined) target.shield -= absorbed
    target.hp = Math.max(0, target.hp - (shooter.damage - absorbed))
  }
  if (absorbed) m.log.push(`${target.name}’s shield absorbs ${absorbed}; ${target.shield} shield remaining.`)
  m.log.push(`${shooter.name} → ${target.name}: ${hit ? `${shooter.damage - absorbed} damage${absorbed ? ` + ${absorbed} absorbed` : ''}${target.hp === 0 ? target.side === 'crew' ? ' · DOWNED' : ' · disabled' : ''}` : 'miss'} (${info.chance}%).`)
}
function enemyTurn(m: Mission) {
  const r=m.recorder
  if(r&&r.alarmTurn!==null&&r.reinforcements<2&&m.turn-r.alarmTurn>=r.reinforcements*2){
    const spawn=[{x:11,y:1},{x:11,y:8},{x:10,y:0}].find(p=>tileAt(m,p)==='floor'&&!m.units.some(u=>u.hp>0&&u.x===p.x&&u.y===p.y))
    if(spawn){m.units.push({id:`recorder-reserve-${r.reinforcements}`,name:'Archive reserve',role:'heavy',side:'hostile',...spawn,hp:5,maxHp:5,ap:2,ammo:4,magazine:4,damage:2,move:3,aimed:false,fired:false,overwatch:false,medkit:false});r.reinforcements++;m.log.push(`Archive reserve ${r.reinforcements}/2 entered from the far airlock.`)}
  }
  if (m.operation?.kind === 'sabotage' && m.operation.alarm && !m.operation.reinforcement) {
    const spawn = [{x:11,y:0},{x:11,y:9},{x:10,y:0}].find((p) => !m.units.some((u) => u.hp > 0 && u.x === p.x && u.y === p.y))
    if (spawn) {
      m.units.push({id:'reserve',name:'Reserve custodian',role:'assault',side:'hostile',...spawn,hp:5,maxHp:5,ap:2,ammo:4,magazine:4,damage:2,move:4,aimed:false,fired:false,overwatch:false,medkit:false})
      m.operation.reinforcement = true; m.log.push('Sofia: “Reserve unit on the deck. Do not stop to fight it unless we have to.”')
    }
  }
  for (const enemy of m.units.filter((u) => u.side === 'hostile' && u.hp > 0)) {
    const targets = livingCrew(m).sort((a, b) => distance(enemy, a) - distance(enemy, b))
    if (!targets.length) break
    enemy.fired = false
    if (!enemy.ammo) { enemy.ammo = enemy.magazine; m.log.push(`${enemy.name} reloads.`); continue }
    let target = targets.find((u) => shotInfo(m, enemy, u).possible)
    if (!target && !(m.operation?.kind === 'sabotage' && !m.operation.alarm)) {
      const nearest = targets[0]!
      const approaches = neighbours(nearest).map((p) => pathTo(m, enemy, p, false)).filter((p): p is Point[] => !!p?.length).sort((a, b) => a.length - b.length)
      for (const p of (approaches[0] ?? []).slice(0, enemy.move)) {
        enemy.x = p.x; enemy.y = p.y
        for (const watcher of livingCrew(m).filter((u) => u.overwatch && u.ammo && !u.fired)) {
          if (enemy.hp > 0 && shotInfo(m, watcher, enemy).possible) fire(m, watcher, enemy)
        }
        if (enemy.hp <= 0) break
      }
      target = livingCrew(m).find((u) => shotInfo(m, enemy, u).possible)
    }
    if (enemy.hp > 0 && target) fire(m, enemy, target)
  }
  if (m.operation?.kind === 'salvage' && m.turn >= 4) {
    const damage = m.turn >= 7 ? 2 : 1
    for (const u of livingCrew(m).filter((u) => u.x >= 4)) u.hp = Math.max(0,u.hp - damage)
    m.log.push(`Thermal surge: exposed operatives beyond column 4 take ${damage} health damage. The exit corridor stays safe.`)
  }
  if (!livingCrew(m).length) { m.outcome = 'defeat'; m.log.push('No operative can reach the shuttle. The boarding team is lost. Remote recovery remains possible.'); return }
  m.turn++
  for (const u of livingCrew(m)) { u.ap = 2; u.fired = false; u.aimed = false; u.overwatch = false }
  m.log.push(`Turn ${m.turn}. Your team has two action points each.`)
}
export function reduceMission(state: Mission, action: TacticalAction): Mission {
  if (tacticalLock(state, action)) return state
  let m: Mission = { ...state, ...(state.recorder?{recorder:{...state.recorder,position:{...state.recorder.position}}}:{}), units: state.units.map((u) => ({ ...u })), log: [...state.log], ...(state.operation ? {operation: {...state.operation, survivors:state.operation.survivors.map((s) => ({...s})), crates:state.operation.crates.map((c) => ({...c}))}} : {}) }
  if (action.type === 'end-turn') enemyTurn(m)
  else if (action.type === 'extract') {
    m.rescued = m.units.filter((u) => u.side === 'crew' && inExtraction(u)).map((u) => u.id)
    m.outcome = m.recovered ? 'success' : 'retreat'
    if(m.recorder)m.log.push(operationStatus(m))
    else if (m.operation) m.log.push(`${operationStatus(m)} ${m.recovered ? 'Operation complete.' : 'Withdrawal without a reward.'}`)
    else m.log.push(m.recovered ? 'Core secured. Shuttle returning to the Ithaca.' : 'Team withdrawn. The site can be approached again or surveyed remotely.')
  } else {
    const u = m.units.find((unit) => unit.id === action.unitId)!
    u.ap -= action.type === 'move' && action.sprint ? 2 : 1
    if (action.type === 'move') {
      if (m.operation?.kind === 'rescue') for (const step of pathTo(m,u,action)!) {
        for (const s of m.operation.survivors.filter((s) => !s.evacuated && s.leader === u.id)) { s.x = u.x; s.y = u.y }
        u.x = step.x; u.y = step.y; updateOperation(m)
      }
      u.x = action.x; u.y = action.y; u.aimed = false; u.overwatch = false
    }
    if (action.type === 'shoot') fire(m, u, m.units.find((unit) => unit.id === action.targetId)!)
    if (action.type === 'aim') u.aimed = true
    if (action.type === 'overwatch') u.overwatch = true
    if (action.type === 'reload') u.ammo = u.magazine
    if(action.type==='drop-recorder'){m.recorder!.carrierId=null;m.recorder!.position={x:u.x,y:u.y};m.log.push(`${u.name} sets the recorder down. It can be handed to an adjacent operative.`)}
    if (action.type === 'interact') {
      if(m.recorder){m.recorder.carrierId=u.id;m.recorder.alarmTurn??=m.turn;m.log.push(`${u.name} lifts the recorder. Security alarm active. Carrier cannot sprint; move two tiles per AP.`)}
      else if (m.operation?.kind === 'rescue') { const s = rescueTarget(m,u)!; s.leader = u.id; m.log.push(`${u.name}: “${s.name}, stay behind me. We are taking you home.”`) }
      else if (m.operation?.kind === 'salvage') { salvageTarget(m,u)!.collected = true; m.log.push(`${u.name}: “Case secured. We can leave now, or push for the next one.”`) }
      else if (m.operation?.kind === 'sabotage') { m.recovered = true; m.operation.alarm = true; for (const e of m.units.filter((u) => u.side === 'hostile')) e.move = 4; m.log.push('Sofia: “Uplink down. They are coming. Back to the shuttle!”') }
      else { m.recovered = true; m.log.push(`${u.name}: “Core is secure. Let’s get everyone out.”`) }
    }
    if (action.type === 'heal') {
      const t = m.units.find((unit) => unit.id === action.targetId)!
      const wasDown = t.hp === 0
      t.hp = Math.min(t.maxHp, t.hp + (u.role === 'medic' ? 5 : 3)); u.medkit = false
      if (wasDown) { t.ap = 0; t.overwatch = false }
      m.log.push(`${u.name} treats ${t.name}. ${wasDown ? 'Revived; can act next turn.' : `${t.hp}/${t.maxHp} health.`}`)
    }
    if (action.type === 'evacuate') {
      const t = m.units.find((unit) => unit.id === action.targetId)!
      t.x = u.x; t.y = u.y; m.log.push(`${u.name} pulls ${t.name} into the shuttle zone.`)
    }
  }
  updateRecorder(m); updateOperation(m); m = reveal(m); m.log = m.log.slice(-60)
  return m
}
