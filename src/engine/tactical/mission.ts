import { createRng } from '../rng/prng.js'

export type Role = 'assault' | 'recon' | 'engineer' | 'medic' | 'heavy'
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
  ap: number; ammo: number; magazine: number; damage: number; move: number; aimed: boolean; fired: boolean; overwatch: boolean; medkit: boolean
}
export interface Mission {
  seed: string; locationId: string; name: string; width: number; height: number; tiles: Tile[]
  objective: Point; recovered: boolean; units: TacticalUnit[]; seen: number[]; turn: number; rolls: number
  lastShot: { from: Point; to: Point; hit: boolean; damage: number } | null
  outcome: 'active' | 'success' | 'retreat' | 'defeat'; rescued: string[]; log: string[]
}
export type TacticalAction =
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
export function createMission(seed: string, locationId: string, name: string, squad: Operative[], threat: number): Mission {
  const width = 12, height = 10, tiles: Tile[] = Array.from({ length: width * height }, () => 'floor')
  // Two layouts share a clear central corridor and safe shuttle approach.
  const alternate = createRng(seed).int(2) === 1
  for (const [x, y] of [[3, 2], [4, 2], [7, 2], [8, 2], [3, 7], [4, 7], [7, 7], [8, 7]]) tiles[y! * width + x!] = 'wall'
  for (const [x, y] of (alternate ? [[4, 3], [6, 6], [8, 4], [9, 6]] : [[4, 6], [6, 3], [8, 6], [9, 4]])) tiles[y! * width + x!] = 'half'
  const units: TacticalUnit[] = squad.map((o, i) => {
    const maxHp = { assault: 10, recon: 8, engineer: 9, medic: 9, heavy: 11 }[o.role]
    const magazine = o.role === 'heavy' ? 3 : 4
    return { ...o, x: 1, y: i + 3, side: 'crew', hp: maxHp, maxHp, ap: 2, ammo: magazine, magazine,
      damage: o.role === 'heavy' ? 4 : 3, move: o.role === 'recon' ? 5 : 4, aimed: false, fired: false, overwatch: false, medkit: true }
  })
  for (let i = 0; i < Math.min(4, 2 + threat); i++) units.push({ id: `sentry-${i}`, name: `Custodian ${i + 1}`, role: 'assault', side: 'hostile',
    x: i === 0 ? 6 : 9 + i % 2, y: [4, 5, 3, 6][i]!, hp: 5 + Math.min(threat, 2), maxHp: 5 + Math.min(threat, 2), ap: 2, ammo: 4, magazine: 4,
    damage: 2, move: 3, aimed: false, fired: false, overwatch: false, medkit: false })
  return reveal({ seed, locationId, name, width, height, tiles, objective: { x: 10, y: 5 }, recovered: false,
    units, seen: [], turn: 1, rolls: 0, lastShot: null, outcome: 'active', rescued: [],
    log: [`${squad[0]!.name}: “The custodians are still running. Take the core, then back to the shuttle. We don’t need to clear the whole ship.”`] })
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
      const path = pathTo(m, u, action)
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
    case 'interact': return m.recovered ? 'Core already secured' : distance(u, m.objective) > (u.role === 'engineer' ? 2 : 1) || !lineOfSight(m, u, m.objective) ? 'Move next to the core (engineer: within two tiles)' : null
    case 'heal': {
      const t = m.units.find((unit) => unit.id === action.targetId && unit.side === 'crew')
      return !u.medkit ? 'Medkit spent' : !t || t.hp >= t.maxHp || distance(u, t) > 1 ? 'Choose an injured adjacent operative or yourself' : null
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
  if (hit) target.hp = Math.max(0, target.hp - shooter.damage)
  m.log.push(`${shooter.name} → ${target.name}: ${hit ? `${shooter.damage} damage${target.hp === 0 ? target.side === 'crew' ? ' · DOWNED' : ' · disabled' : ''}` : 'miss'} (${info.chance}%).`)
}
function enemyTurn(m: Mission) {
  for (const enemy of m.units.filter((u) => u.side === 'hostile' && u.hp > 0)) {
    const targets = livingCrew(m).sort((a, b) => distance(enemy, a) - distance(enemy, b))
    if (!targets.length) break
    enemy.fired = false
    if (!enemy.ammo) { enemy.ammo = enemy.magazine; m.log.push(`${enemy.name} reloads.`); continue }
    let target = targets.find((u) => shotInfo(m, enemy, u).possible)
    if (!target) {
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
  if (!livingCrew(m).length) { m.outcome = 'defeat'; m.log.push('No operative can reach the shuttle. The boarding team is lost. Remote recovery remains possible.'); return }
  m.turn++
  for (const u of livingCrew(m)) { u.ap = 2; u.fired = false; u.aimed = false; u.overwatch = false }
  m.log.push(`Turn ${m.turn}. Your team has two action points each.`)
}
export function reduceMission(state: Mission, action: TacticalAction): Mission {
  if (tacticalLock(state, action)) return state
  let m: Mission = { ...state, units: state.units.map((u) => ({ ...u })), log: [...state.log] }
  if (action.type === 'end-turn') enemyTurn(m)
  else if (action.type === 'extract') {
    m.rescued = m.units.filter((u) => u.side === 'crew' && inExtraction(u)).map((u) => u.id)
    m.outcome = m.recovered ? 'success' : 'retreat'
    m.log.push(m.recovered ? 'Core secured. Shuttle returning to the Ithaca.' : 'Team withdrawn. The site can be approached again or surveyed remotely.')
  } else {
    const u = m.units.find((unit) => unit.id === action.unitId)!
    u.ap -= action.type === 'move' && action.sprint ? 2 : 1
    if (action.type === 'move') { u.x = action.x; u.y = action.y; u.aimed = false; u.overwatch = false }
    if (action.type === 'shoot') fire(m, u, m.units.find((unit) => unit.id === action.targetId)!)
    if (action.type === 'aim') u.aimed = true
    if (action.type === 'overwatch') u.overwatch = true
    if (action.type === 'reload') u.ammo = u.magazine
    if (action.type === 'interact') { m.recovered = true; m.log.push(`${u.name}: “Core is secure. Let’s get everyone out.”`) }
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
  m = reveal(m); m.log = m.log.slice(-60)
  return m
}
