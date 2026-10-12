import type { Campaign, CampaignAction } from '../engine/exploration/campaign.js'
import { actionLock } from '../engine/exploration/campaign.js'
import { RELAY_DIALOGUE, relaySummary, relayLaneDistance } from '../engine/exploration/arcs.js'
import './long-relay.css'

const station=(state:Campaign,id:string)=>state.world.locations.find((s)=>s.id===id)
export function LongRelayObjective({state,onLocate}:{state:Campaign;onLocate:(id:string)=>void}) {
  const arc=state.relayArc
  if(!arc || arc.stage==='complete')return null
  const location=station(state,arc.stage==='accepted'?arc.destinationStationId:arc.originStationId)
  if(!location)return null
  const here=state.at===location.systemId
  const contacted=['investigated','resolved'].includes(state.exploration.statuses[location.id]??'')
  const hops=relayLaneDistance(state.galaxy,state.at,location.systemId)
  return <article className="relay-objective" aria-label="Active voyage The Long Relay" data-testid="relay-objective">
    <span className="exp-eyebrow">ACTIVE VOYAGE / THE LONG RELAY</span>
    <h3>{arc.stage==='accepted'?'Reach Tarek Sen':'Return to Edda Sol'}</h3>
    <p>{relaySummary(arc)}</p>
    <p className="relay-destination"><strong>{location.name}</strong>
      <small>{here?contacted?'Contact established':'Contact the station next':String(hops)+' jump lanes from here'}</small></p>
    {!here?<button className="exp-button" onClick={()=>onLocate(location.systemId)}>Locate on chart</button>:
      <small>{contacted?'Open this station to continue the mission.':'Investigate this station to establish contact.'}</small>}
  </article>
}

export function LongRelayStation({state,siteId,dispatch}:{state:Campaign;siteId:string;dispatch:(action:CampaignAction)=>void}) {
  const arc=state.relayArc
  if(!state.lettersDelivered&&!arc)return null
  const location=station(state,siteId)
  if(!location || location.kind!=='station')return null
  if(arc && siteId!==arc.originStationId && siteId!==arc.destinationStationId)return null
  if(!arc&&state.at===state.galaxy.start)return null
  if(arc&&arc.stage==='complete')return null
  if(arc&&arc.stage==='accepted'&&siteId!==arc.destinationStationId)return null
  if(arc&&arc.stage==='relay-resolved'&&siteId!==arc.originStationId)return null
  const start=!arc, finish=arc?.stage==='relay-resolved'
  const heading=start?RELAY_DIALOGUE.start:finish?RELAY_DIALOGUE.reply:RELAY_DIALOGUE.relay
  const text=start?RELAY_DIALOGUE.start.text:finish?RELAY_DIALOGUE.reply[arc!.approach!]:RELAY_DIALOGUE.relay.text
  const choice=(action:CampaignAction,label:string,details:string)=>{
    const lock=actionLock(state,action)
    return <div className="relay-choice" key={label}><button className="exp-button" disabled={!!lock}
      title={lock??undefined} onClick={()=>dispatch(action)}>{label}</button><small>{lock??details}</small></div>
  }
  return <section className="relay-conversation" aria-label="The Long Relay" data-testid="relay-conversation">
    <span className="exp-eyebrow">OPTIONAL MISSION / THE LONG RELAY</span>
    <span className="relay-speaker">{heading.speaker}</span><h3>{heading.heading}</h3>
    <p>{text}</p>
    {!finish&&<p>{start?RELAY_DIALOGUE.start.followup:RELAY_DIALOGUE.relay.followup}</p>}
    {start&&choice({type:'start-arc',arcId:'long-relay',locationId:siteId},'Carry Edda’s message','Accept · no time or materials · no deadline')}
    {!start&&!finish&&<>
      {choice({type:'arc-choice',arcId:'long-relay',beatId:'relay',choiceId:'repair'},'Repair the shared relay','2 days · 5 materials · restores public communication')}
      {choice({type:'arc-choice',arcId:'long-relay',beatId:'relay',choiceId:'local-copy'},'Carry a private copy','3 days · no materials · public relay stays damaged')}
    </>}
    {finish&&choice({type:'arc-choice',arcId:'long-relay',beatId:'reply',choiceId:'acknowledge'},'Give Edda the reply','No days · +20 credits · concludes the mission')}
    <small>Leave the station to defer. You can return later without losing progress.</small>
  </section>
}

export function LongRelayArchive({state}:{state:Campaign}) {
  const arc=state.relayArc
  if(!arc)return null
  return <article className="exp-finding relay-archive" aria-label="Long Relay captain’s record">
    <span className="exp-eyebrow">SIDE VOYAGE / CAPTAIN’S RECORD</span><h3>The Long Relay</h3>
    <p>{relaySummary(arc)}</p><ol>{arc.records.map((r)=><li key={r.beatId}>
      Day {r.day}: {r.beatId==='start'?'Edda entrusted us with a reply':r.beatId==='reply'?'Edda received Tarek’s answer':r.choiceId==='repair'?'Restored the public communications relay':'Carried a private reply'}
    </li>)}</ol>
  </article>
}
