import { pathTo, shotInfo, tacticalLock, visible, interactionLabel } from '../engine/tactical/mission.js'
import type { Mission, Point, TacticalAction } from '../engine/tactical/mission.js'

/** Presentation only: use known routes and currently visible enemies, never hidden threats. */
export function movementPreview(m: Mission, unitId: string, destination: Point, sprint: boolean) {
  const unit = m.units.find((u) => u.id === unitId && u.side === 'crew')
  const cost = sprint ? 2 : 1
  const lock = tacticalLock(m,{type:'move',unitId,...destination,sprint})
  const path = unit ? pathTo(m,unit,destination) : null
  if (!unit || lock) return {lock,path,cost,remainingAP:null,threats:[],heat:0}
  const projected = {...unit,...destination,aimed:false}
  const threats = m.units.filter((e) => e.side === 'hostile' && e.hp > 0 && visible(m,e))
    .map((e) => ({id:e.id,name:e.name,...shotInfo(m,e,projected)})).filter((e) => e.possible)
  const heat = m.operation?.kind === 'salvage' && destination.x >= 4 && m.turn >= 4 ? m.turn >= 7 ? 2 : 1 : 0
  return {lock,path,cost,remainingAP:unit.ap-cost,threats,heat}
}

export function orderFeedback(before: Mission, after: Mission, action: TacticalAction): { title: string; details: string[] } | null {
  if (before === after) return null
  const unit = 'unitId' in action ? before.units.find((u)=>u.id===action.unitId) : undefined
  let title = action.type === 'end-turn' ? 'Enemy turn resolved' : action.type === 'move' ? `${unit?.name} moved to ${action.x+1},${action.y+1}` : action.type === 'interact' ? interactionLabel(before) : action.type === 'shoot' ? after.lastShot?.hit ? 'Shot hit' : 'Shot missed' : action.type === 'heal' ? 'Medkit used' : action.type === 'aim' ? 'Aim set for this turn' : action.type === 'reload' ? 'Magazine reloaded' : action.type === 'overwatch' ? 'Overwatch set' : action.type === 'evacuate' ? 'Operative pulled aboard' : 'Extraction confirmed'
  const details: string[] = []
  for(const now of after.units) {
    const old=before.units.find((u)=>u.id===now.id)
    if(!old || (now.side === 'hostile' && !visible(before,old) && !visible(after,now)))continue
    const health=now.hp-old.hp, shield=(now.shield??0)-(old.shield??0)
    const changes=[health ? `${health>0?'+':'−'}${Math.abs(health)} health` : '',shield ? `${shield>0?'+':'−'}${Math.abs(shield)} shield` : ''].filter(Boolean)
    if(changes.length)details.push(`${now.name}: ${changes.join(', ')}${now.hp===0 ? now.side==='crew' ? ' — downed' : ' — disabled' : ''}.`)
  }
  for(const s of after.operation?.survivors??[])if(s.evacuated && !before.operation?.survivors.find((v)=>v.id===s.id)?.evacuated)details.push(`${s.name} is safely aboard.`)
  if(action.type==='move')details.push(`${action.sprint?2:1} AP spent. ${after.units.find((u)=>u.id===action.unitId)?.ap} AP left.`)
  if(action.type==='end-turn') {
    const shots=after.rolls-before.rolls
    details.unshift(`${shots} shot${shots===1?'':'s'} exchanged. ${after.outcome==='active'?`Turn ${after.turn}: your team can act.`:'The mission has ended.'}`)
  }
  if(action.type==='interact') {
    if(after.operation?.kind==='sabotage')details.push('Uplink disabled. One reserve arrives next enemy turn.')
    else if(after.operation?.kind==='salvage')details.push(`${after.operation.crates.filter((c)=>c.collected).length}/3 cases secured. You can extract now.`)
    else if(after.operation?.kind==='rescue') {
      const follower=after.operation.survivors.find((s)=>s.leader===action.unitId && !s.evacuated)
      if(follower)details.push(`${follower.name} is following ${unit?.name}. Lead them to the shuttle.`)
    } else details.push('Core secured. Return to the shuttle.')
  }
  if(action.type==='shoot' && !after.lastShot?.hit)details.push('Ammunition and AP were spent. The target took no damage.')
  if(after.outcome==='defeat')title='Team incapacitated'
  return {title,details}
}
