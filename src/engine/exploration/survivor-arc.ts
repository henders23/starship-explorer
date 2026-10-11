import type { Campaign } from './campaign.js'
import { relayLaneDistance } from './arcs.js'
export interface RescuedPerson { id:string; name:string; rescueSiteId:string; day:number }
export interface SurvivorArc {
  version:1; survivor:RescuedPerson; stationId:string; destinationId:string
  stage:'accepted'|'returned'|'complete'; result:'evidence'|'withdrawn'|'lost'|null
  records:{event:string;day:number}[]
}
export type SurvivorAction =
 | {type:'accept-survivor';personId:string;stationId:string}
 | {type:'deploy-recorder';squad:string[]}
 | {type:'close-survivor'}
export function recorderDestination(s:Campaign,person:RescuedPerson):string|null {
  return s.world.locations.filter(site=>['derelict','ruins'].includes(site.kind)&&site.scanTier!=='deep'&&site.id!==person.rescueSiteId)
    .map(site=>({site,hops:relayLaneDistance(s.galaxy,s.at,site.systemId)})).filter(x=>Number.isFinite(x.hops))
    .sort((a,b)=>a.hops-b.hops||a.site.id.localeCompare(b.site.id))[0]?.site.id??null
}
export function survivorSummary(arc:SurvivorArc):string {
  if(arc.stage==='accepted')return `${arc.survivor.name} asked us to recover the field team’s recorder. Its contents may explain why their evacuation failed.`
  if(arc.result==='evidence')return 'The recorder reached the shuttle. It preserves the team’s final warning: the security system misidentified their rescue beacon.'
  if(arc.result==='lost')return 'The boarding team was lost. The recorder remains at the site; we must tell the survivor what happened.'
  return 'We withdrew without the recorder. The team’s last signal remains unanswered, but no further attempt is promised.'
}
