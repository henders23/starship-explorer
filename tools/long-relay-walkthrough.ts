import { actionLock, createCampaign, reduceCampaign } from '../src/engine/exploration/campaign.js'
import type { Campaign, CampaignAction } from '../src/engine/exploration/campaign.js'
import { relayLaneDistance } from '../src/engine/exploration/arcs.js'

export function legal(state:Campaign, action:CampaignAction):Campaign {
  const lock=actionLock(state,action)
  if(lock)throw new Error(action.type+': '+lock)
  const next=reduceCampaign(state,action)
  if(next===state)throw new Error('Ignored legal action: '+action.type)
  return next
}
export function lanePath(state:Campaign,to:string):string[] {
  const q:string[][]=[[state.at]],seen=new Set([state.at])
  for(let i=0;i<q.length;i++){
    const path=q[i]!,last=path[path.length-1]!
    if(last===to)return path.slice(1)
    for(const id of state.galaxy.adjacency[last]??[])if(!seen.has(id)){seen.add(id);q.push([...path,id])}
  }
  throw new Error('Disconnected galaxy: '+to)
}
export function jumpTo(state:Campaign,to:string):Campaign {
  for(const systemId of lanePath(state,to)){
    let action:CampaignAction={type:'travel',systemId}
    if(actionLock(state,action))state=legal(state,{type:'emergency-fuel'})
    state=legal(state,action)
  }
  return state
}
export function contact(state:Campaign,siteId:string):Campaign {
  const site=state.world.locations.find((s)=>s.id===siteId)
  if(!site || site.systemId!==state.at)throw new Error('Cannot contact remote site')
  if(!state.exploration.statuses[site.id])state=legal(state,{type:'scan',tier:'survey'})
  if(state.exploration.statuses[site.id]==='detected')state=legal(state,{type:'investigate',locationId:site.id})
  if(!['investigated','resolved'].includes(state.exploration.statuses[site.id]??''))throw new Error('Site unavailable')
  return state
}
export function acceptedRelay(seed='relay-browser'):Campaign {
  let state=createCampaign(seed)
  const courier=state.world.locations.find((s)=>s.name==='The Silent Courier')!
  state=legal(state,{type:'scan',tier:'survey'})
  state=legal(state,{type:'investigate',locationId:courier.id})
  state=legal(state,{type:'story',locationId:courier.id,choiceId:'carry'})
  const stations=state.world.locations.filter((s)=>s.kind==='station'&&s.systemId!==state.at)
    .map((site)=>({site,hops:relayLaneDistance(state.galaxy,state.at,site.systemId)}))
    .filter((x)=>Number.isFinite(x.hops)).sort((a,b)=>a.hops-b.hops)
  const origin=stations[0]?.site
  if(!origin)throw new Error('No reachable station')
  state=jumpTo(state,origin.systemId)
  state=contact(state,origin.id)
  state=legal(state,{type:'deliver-letters',locationId:origin.id})
  return legal(state,{type:'start-arc',arcId:'long-relay',locationId:origin.id})
}
export function relayDecisionReady(seed='relay-browser'):Campaign {
  let state=acceptedRelay(seed)
  const dest=state.world.locations.find((s)=>s.id===state.relayArc!.destinationStationId)!
  state=jumpTo(state,dest.systemId)
  return contact(state,dest.id)
}
export function relayReplyReady(seed='relay-browser', approach:'repair'|'local-copy'='repair'):Campaign {
  let state=relayDecisionReady(seed)
  state=legal(state,{type:'arc-choice',arcId:'long-relay',beatId:'relay',choiceId:approach})
  const origin=state.world.locations.find((s)=>s.id===state.relayArc!.originStationId)!
  return jumpTo(state,origin.systemId)
}
