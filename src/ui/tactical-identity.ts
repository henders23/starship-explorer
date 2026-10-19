import type { Operative, TacticalUnit } from '../engine/tactical/mission.js'

/** Distinct, existing human face artworks give the boarding roster continuity. */
const FIRST_ROSTER_FACES = [
  '/assets/portraits/15_victoria_lin.png',     // Mara Chen: assault
  '/assets/portraits/16_darius_cole.png',      // Idris Okonkwo: recon
  '/assets/portraits/13_maria_sanchez.png',    // Sofia Reyes: engineer
  '/assets/portraits/21_lucas_haines.png',     // Elias Noor: medic
  '/assets/portraits/20_kiara_n_dala.png',     // Anika Rao: heavy
  '/assets/portraits/23_oliver_petrov.png',    // Tomás Vega: assault
] as const
const RECRUIT_FACES = [
  '/assets/portraits/04_talia_ryder.png', '/assets/portraits/10_insu_park.png',
  '/assets/portraits/12_jacob_ryland.png', '/assets/portraits/17_benjamin_taylor.png',
  '/assets/portraits/22_tessa_nguyen.png', '/assets/portraits/25_adrian_bishop.png',
  '/assets/portraits/24_amelia_york.png', '/assets/portraits/27_thomas_grey.png',
] as const
export function operativePortrait(operative: Pick<Operative,'id'>):string {
  const original=/^operative-(\d+)$/.exec(operative.id)
  if(original) return FIRST_ROSTER_FACES[Number(original[1])%FIRST_ROSTER_FACES.length]!
  const recruit=/^recruit-(\d+)$/.exec(operative.id)
  return RECRUIT_FACES[recruit?Number(recruit[1])%RECRUIT_FACES.length:0]!
}
export type EnemyVisual = 'scout'|'custodian'|'enforcer'|'sentinel'
export interface EnemyStyle {kind:EnemyVisual;name:string;accent:string;size:number}
export function enemyAppearance(u:Pick<TacticalUnit,'id'|'side'>):EnemyStyle {
  const id=u.id
  if(id.includes('reserve')||id.includes('heavy'))return {kind:'enforcer',name:'Armoured enforcer',accent:'#f69b73',size:1.13}
  const match=/(?:sentry-|custodian-)(\d+)/.exec(id)
  const number=match?Number(match[1]):id.includes('watch')?2:0
  switch(number%3){
    case 0:return {kind:'custodian',name:'Patrol custodian',accent:'#efaa82',size:1}
    case 1:return {kind:'scout',name:'Signal tracker',accent:'#e4c17a',size:.92}
    default:return {kind:'sentinel',name:'Security sentinel',accent:'#ed8278',size:1.07}
  }
}
export function gunName(u:Pick<TacticalUnit,'role'|'weapon'>):string {
 if(u.weapon==='plasma')return u.role==='heavy'?'Plasma support cannon':'Plasma carbine'
 return {assault:'AR-7 assault rifle',recon:'Scout carbine',engineer:'Compact service rifle',medic:'Personal defence carbine',heavy:'Bastion support cannon'}[u.role]
}
