import { ReportImage } from './ReportImage.js'
import { CrewLine } from './crew-presence.js'
import type { Campaign, CampaignAction } from '../engine/exploration/campaign.js'
import { actionLock } from '../engine/exploration/campaign.js'
import { survivorSummary } from '../engine/exploration/survivor-arc.js'
import { relayLaneDistance } from '../engine/exploration/arcs.js'

export function SurvivorObjective({state,onLocate}:{state:Campaign;onLocate:(id:string)=>void}){
 const arc=state.survivorArc,person=state.rescuedPeople?.[0]
 if(arc?.stage==='complete'||(!arc&&!person))return null
 const site=arc?state.world.locations.find(s=>s.id===(arc.stage==='accepted'?arc.destinationId:arc.stationId)):null
 return <article className="relay-objective" aria-label="Active voyage Someone left behind"><span className="exp-eyebrow">SURVIVOR VOYAGE / SOMEONE LEFT BEHIND</span>
 <h3>{arc?arc.stage==='accepted'?'Follow the last signal':`Report to ${arc.survivor.name}`:`${person!.name} has a request`}</h3>
 <p>{arc?survivorSummary(arc):'Visit a contacted station to hear from the surveyor you brought aboard. There is no deadline.'}</p>
 {site&&<><p><strong>{site.name}</strong> · {site.systemId===state.at?'In this system':`${relayLaneDistance(state.galaxy,state.at,site.systemId)} jump lanes away`}</p><button className="exp-button" onClick={()=>onLocate(site.systemId)}>Locate survivor objective</button><small>{site.systemId===state.at?'Open this location in the system view to continue.':'Travel through connected systems. Contact remains available.'}</small></>}
 </article>
}
export function SurvivorStation({state,siteId,dispatch}:{state:Campaign;siteId:string;dispatch:(a:CampaignAction)=>void}){
 const arc=state.survivorArc,person=arc?.survivor??state.rescuedPeople?.[0]
 if(!person){return state.completedOperations.some(o=>o.kind==='rescue')?<small>Earlier rescue logs recorded counts only. Named follow-up requests become available after your next rescue.</small>:null}
 if(arc&&(arc.stage!=='returned'||arc.stationId!==siteId))return null
 const action:CampaignAction=arc?{type:'close-survivor'}:{type:'accept-survivor',personId:person.id,stationId:siteId}
 const lock=actionLock(state,action)
 return <section className="relay-conversation" aria-label="Someone left behind"><span className="exp-eyebrow">OPTIONAL / SOMEONE LEFT BEHIND</span><span className="relay-speaker">{person.name} · rescued surveyor</span>
 <h3>{arc?'What we brought back':'One signal we never answered'}</h3>
 <ReportImage eventId="survivor" compact />
 <CrewLine person="cross" compact>{arc ? 'We brought our team home with the answer we could carry. I hope it helps.' : 'We have a choice. We can follow that signal, but bringing everyone back matters more than the recorder.'}</CrewLine>
 {!arc?<><p>“I remember your shuttle door closing. I thought that would be the moment I could stop listening.” {person.name} puts a field log on the table. “My team sent one last signal from another installation. Their recorder may still have it.”</p><p>“I want to know what happened. But I am not asking you to trade four people for an answer. Go and look. If it is too much, come back and tell me.”</p><small>Optional boarding mission · carry a fragile recorder or withdraw · 24 credits for recovered evidence, no payment for withdrawal · no deadline.</small></>:
 arc.result==='evidence'?<><p>“Play it again. From the part where she says the beacon is on.” The recording is clear: security had marked the evacuation signal as hostile. The field team had been trying to warn the next shuttle.</p><p>{person.name} closes the log. “We thought they had stopped trying. They were still trying to get someone else home.” The station issues a beacon warning to visiting crews.</p><small>24 credits once · the warning is preserved in your voyage record. This does not disable custodians at other sites.</small></>:
 arc.result==='lost'?<p>{person.name} listens without interrupting. “I asked you for an answer. I did not want more names added to the question.” The recorder remains behind. The lost operatives remain in the crew record.</p>:<><p>“You left it there?” {person.name} looks away, then back. “I wish you had found a way. I also meant what I said about bringing your people home.”</p><p>The recording remains at the site. The captain makes no new promise. There is no payment, and no further attempt in this voyage.</p></>}
 <button className="exp-button" disabled={!!lock} title={lock??undefined} onClick={()=>dispatch(action)}>{arc?'Acknowledge the survivor':'Follow the field team’s signal'}</button>{lock&&<small>{lock}</small>}
 </section>
}
export function SurvivorArchive({state}:{state:Campaign}){
 const arc=state.survivorArc
 if(!arc)return null
 return <article className="exp-finding"><span className="exp-eyebrow">SURVIVOR VOYAGE / {arc.survivor.name}</span><h3>Someone left behind</h3><p>{survivorSummary(arc)}</p><ol>{arc.records.map((r,i)=><li key={i}>Day {r.day}: {r.event}</li>)}</ol></article>
}
