import { readyOperation, nextOperationOrder } from './operation-walkthrough.js'
import { legal, jumpTo, contact } from './long-relay-walkthrough.js'
import { relayLaneDistance } from '../src/engine/exploration/arcs.js'
import { distance, inExtraction, pathTo, tacticalLock, visible, shotInfo } from '../src/engine/tactical/mission.js'
import type { Mission, TacticalAction, Point } from '../src/engine/tactical/mission.js'
import type { Campaign } from '../src/engine/exploration/campaign.js'
export function savedSurvivors(seed='survivor-0'):Campaign {
 let s=readyOperation(seed)
 s=legal(s,{type:'deploy-operation',kind:'rescue',variant:1,rememberSurvivors:true,locationId:s.world.locations.find(l=>l.name==='The Silent Courier')!.id,squad:s.roster.slice(0,4).map(o=>o.id)})
 for(let i=0;i<500&&s.mission!.outcome==='active';i++)s=legal(s,{type:'tactical',order:nextOperationOrder(s.mission!)})
 if(s.mission!.outcome!=='success')throw Error('Rescue failed: '+seed)
 return legal(s,{type:'debrief'})
}
export function survivorAccepted(seed='survivor-0'):Campaign {
 let s=savedSurvivors(seed)
 const station=s.world.locations.filter(l=>l.kind==='station').sort((a,b)=>relayLaneDistance(s.galaxy,s.at,a.systemId)-relayLaneDistance(s.galaxy,s.at,b.systemId))[0]!
 s=contact(jumpTo(s,station.systemId),station.id)
 return legal(s,{type:'accept-survivor',personId:s.rescuedPeople![0]!.id,stationId:station.id})
}
export function recorderReady(seed='survivor-0'):Campaign {
 let s=survivorAccepted(seed),site=s.world.locations.find(l=>l.id===s.survivorArc!.destinationId)!
 s=contact(jumpTo(s,site.systemId),site.id)
 while(s.roster.filter(o=>!o.dead&&o.injuredUntil<=s.day).length<4)s=legal(s,{type:'rest-team'})
 return s
}
export function recorderDeployed(seed='survivor-0'):Campaign {
 const s=recorderReady(seed)
 return legal(s,{type:'deploy-recorder',squad:s.roster.filter(o=>!o.dead&&o.injuredUntil<=s.day).slice(0,4).map(o=>o.id)})
}
/** Only legal visible actions; no campaign/health edits, resources or teleports. */
export function nextRecorderOrder(m:Mission):TacticalAction {
 const crew=m.units.filter(u=>u.side==='crew'&&u.hp>0),r=m.recorder!
 if(m.recovered&&m.units.filter(u=>u.side==='crew').every(inExtraction))return {type:'extract',abandon:false}
 for(const u of crew.filter(u=>u.ap>0)){
  const hurt=m.units.find(t=>t.side==='crew'&&t.hp<=t.maxHp-3&&distance(t,u)<=1)
  if(hurt&&!tacticalLock(m,{type:'heal',unitId:u.id,targetId:hurt.id}))return {type:'heal',unitId:u.id,targetId:hurt.id}
  if(!r.carrierId&&!tacticalLock(m,{type:'interact',unitId:u.id}))return {type:'interact',unitId:u.id}
  const targets=m.units.filter(e=>e.side==='hostile'&&visible(m,e)&&!tacticalLock(m,{type:'shoot',unitId:u.id,targetId:e.id})).sort((a,b)=>a.hp-b.hp||shotInfo(m,u,b).chance-shotInfo(m,u,a).chance)
  if(targets[0]){if(u.ap===2&&!u.aimed)return {type:'aim',unitId:u.id};return {type:'shoot',unitId:u.id,targetId:targets[0].id}}
  if(!u.ammo)return {type:'reload',unitId:u.id}
  if(u.fired)continue
  let goal:Point=r.carrierId?{x:0,y:3+crew.indexOf(u)}:r.position
  const down=m.units.find(t=>t.side==='crew'&&t.hp===0&&!inExtraction(t))
  if(down&&u.medkit)goal=down
  const remaining=(p:Point)=>pathTo({...m,units:m.units.filter(t=>t.id===u.id||t.x!==goal.x||t.y!==goal.y)}, {...u,...p},goal,false)?.length??(distance(p,goal)===0?0:999)
  const current=remaining(u)
  const options=m.seen.map(n=>({x:n%m.width,y:Math.floor(n/m.width)}))
   .filter(p=>!tacticalLock(m,{type:'move',unitId:u.id,...p})).map(p=>({p,n:remaining(p)})).filter(o=>o.n<current).sort((a,b)=>a.n-b.n)
  if(options[0])return {type:'move',unitId:u.id,...options[0].p}
 }
 return {type:'end-turn'}
}
export function recorderReport(seed='survivor-0',recover=true):Campaign {
 let s=recorderDeployed(seed)
 if(!recover)s=legal(s,{type:'tactical',order:{type:'extract',abandon:false}})
 else for(let i=0;i<500&&s.mission!.outcome==='active';i++)s=legal(s,{type:'tactical',order:nextRecorderOrder(s.mission!)})
 if(s.mission!.outcome==='active')throw Error('Recorder pilot stalled: '+seed)
 return s
}
export function survivorReply(seed='survivor-0',recover=true):Campaign {
 let s=legal(recorderReport(seed,recover),{type:'debrief'})
 const station=s.world.locations.find(l=>l.id===s.survivorArc!.stationId)!
 return jumpTo(s,station.systemId)
}
if(process.argv[1]?.endsWith('survivor-walkthrough.ts'))for(let i=0;i<8;i++){
 const s=recorderReport('survivor-'+i)
 console.log(JSON.stringify({seed:i,outcome:s.mission!.outcome,turn:s.mission!.turn,crew:s.mission!.rescued.length,orders:s.actions.length}))
}
