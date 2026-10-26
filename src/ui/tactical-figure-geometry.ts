/** Presentation-space gun mounting and shot origin. Rules still use exact tile coordinates. */
export const WEAPON_FACING_ANGLES = [150,90,30,0,-30,-90,-150,180] as const
export function weaponFacingAngle(direction:number):number {
 return WEAPON_FACING_ANGLES[(Math.round(direction)%8+8)%8]!
}
export interface ScreenPoint {x:number;y:number}
export function shotMuzzle(from:ScreenPoint,to:ScreenPoint):ScreenPoint {
 const vx=to.x-from.x,vy=to.y-from.y,len=Math.hypot(vx,vy)||1
 return {x:from.x+vx/len*22,y:from.y-31+vy/len*7}
}
export type EnemyShape='scout'|'custodian'|'sentinel'|'enforcer'
export function figureProfile(kind:EnemyShape):{shoulder:number;head:number;accent:string;silhouette:string} {
 switch(kind) {
  case 'scout':return {shoulder:12,head:7,accent:'#efcb83',silhouette:'light recon with antennae'}
  case 'sentinel':return {shoulder:19,head:9,accent:'#ec847f',silhouette:'shielded turret shoulders'}
  case 'enforcer':return {shoulder:23,head:11,accent:'#f9a47b',silhouette:'armoured heavy chest and breacher cannon'}
  case 'custodian':return {shoulder:15,head:8,accent:'#d89a78',silhouette:'standard security frame'}
 }
}
