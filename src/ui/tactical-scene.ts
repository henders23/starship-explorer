import type { Mission, Point } from '../engine/tactical/mission.js'
import { visible } from '../engine/tactical/mission.js'
import { depth } from './isometric.js'
export interface SceneItem { id: string; kind:'obstacle'|'unit'|'survivor'|'crate'|'objective'; p:Point; index:number }
/** Back-to-front geometry. Status marks are rendered in a separate, unobscured layer. */
export function sceneOrder(m: Mission): SceneItem[] {
  const items:SceneItem[]=[]
  m.tiles.forEach((tile,index)=>{if(tile!=='floor' && m.seen.includes(index))items.push({id:`obstacle-${index}`,kind:'obstacle',p:{x:index%m.width,y:Math.floor(index/m.width)},index})})
  if((!m.operation || m.operation.kind==='sabotage') && m.seen.includes(m.objective.y*m.width+m.objective.x))items.push({id:'objective',kind:'objective',p:m.objective,index:0})
  m.operation?.survivors.forEach((s,index)=>{if(!s.evacuated)items.push({id:s.id,kind:'survivor',p:s,index})})
  m.operation?.crates.forEach((p,index)=>items.push({id:`crate-${index}`,kind:'crate',p,index}))
  m.units.forEach((u,index)=>{if(u.side==='crew'||visible(m,u))items.push({id:u.id,kind:'unit',p:u,index})})
  return items.sort((a,b)=>depth(a.p)-depth(b.p)||a.p.x-b.p.x)
}
