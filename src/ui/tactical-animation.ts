import type { Mission, Point, TacticalUnit } from '../engine/tactical/mission.js'
import { pathTo, tileAt } from '../engine/tactical/mission.js'
export type Pose = 'idle'|'walk'|'sprint'|'aim'|'fire'|'hit'|'fall'|'interact'|'cover'|'reload'
export const FRAMES: Record<Pose, readonly [number,number,number]> = {
  idle:[0,1,1],walk:[1,8,12],sprint:[9,8,16],aim:[17,1,1],fire:[18,4,14],hit:[22,3,10],fall:[25,4,8],interact:[29,4,8],cover:[33,1,1],reload:[34,4,8],
}
/** Rig faces +Z at zero. Board x maps to world X; board y maps to world Z. */
export function facing(from:Point,to:Point,fallback=2):number {
  if(from.x===to.x&&from.y===to.y)return fallback
  return (Math.round(Math.atan2(to.x-from.x,to.y-from.y)/(Math.PI/4))+8)%8
}
export function restPose(m:Mission,u:TacticalUnit):Pose {
  if(u.hp<=0)return 'fall'
  if(u.aimed||u.overwatch)return 'aim'
  return [{x:u.x-1,y:u.y},{x:u.x+1,y:u.y},{x:u.x,y:u.y-1},{x:u.x,y:u.y+1}].some(p=>['half','wall'].includes(tileAt(m,p)))?'cover':'idle'
}
export function reaction(before:TacticalUnit,u:TacticalUnit):Pose|null {
  if(u.hp<before.hp || (u.shield??0)<(before.shield??0))return u.hp===0?'fall':'hit'
  if(u.ammo<before.ammo)return 'fire'
  if(u.ammo>before.ammo)return 'reload'
  if((u.x!==before.x||u.y!==before.y))return null
  if(u.ap<before.ap && !u.aimed&&!u.overwatch)return 'interact'
  return null
}
export function routeBetween(before:Mission,from:TacticalUnit,to:TacticalUnit):Point[] {
  if(from.x===to.x&&from.y===to.y)return []
  // Never draw an invented straight-line route through solid cover.
  const path=pathTo(before,from,to,false)
  return path?.length?[{x:from.x,y:from.y},...path]:[]
}
export function poseFrame(pose:Pose,elapsed:number,loop=false):number {
  const [first,count,fps]=FRAMES[pose],step=Math.floor(Math.max(0,elapsed)*fps/1000)
  return first+(loop?step%count:Math.min(count-1,step))
}
