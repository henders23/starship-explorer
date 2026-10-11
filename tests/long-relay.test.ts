import { describe,expect,it } from 'vitest'
import { createCampaign, actionLock, reduceCampaign } from '../src/engine/exploration/campaign.js'
import { relayDestination, relayLaneDistance } from '../src/engine/exploration/arcs.js'
import { acceptedRelay, relayDecisionReady, relayReplyReady, legal } from '../tools/long-relay-walkthrough.js'
import { EXPLORATION_SAVE_KEY, loadExploration, saveExploration } from '../src/ui/exploration-save.js'
import type { Campaign, CampaignAction } from '../src/engine/exploration/campaign.js'
function saveAndLoad(state:Campaign,version?:number) {
  let raw=''
  const memory={getItem:()=>raw,setItem:(_key:string,value:string)=>{raw=value},removeItem:()=>{}}
  saveExploration(state,memory)
  if(version!==undefined)raw=JSON.stringify({...JSON.parse(raw),version})
  return loadExploration(memory)
}
describe('The Long Relay optional mission',()=>{
  it('does not alter unaccepted legacy voyages and chooses deterministic reachable destinations',()=>{
    for(let i=0;i<25;i++){
      const seed='relay-galaxy-'+i,unaccepted=createCampaign(seed)
      expect('relayArc' in unaccepted).toBe(false)
      const origin=unaccepted.world.locations.find(s=>s.kind==='station')!
      const first=relayDestination(unaccepted.galaxy,unaccepted.world,seed,origin.id)
      expect(first).toBe(relayDestination(unaccepted.galaxy,unaccepted.world,seed,origin.id))
      if(first){
        const target=unaccepted.world.locations.find(s=>s.id===first)!
        expect(target.systemId).not.toBe(origin.systemId)
        expect(Number.isFinite(relayLaneDistance(unaccepted.galaxy,origin.systemId,target.systemId))).toBe(true)
      }
    }
  })
  it.each(['repair','local-copy'] as const)('completes %s with exactly-once cost, time and credits',approach=>{
    let state=relayDecisionReady('long-relay-'+approach)
    const arc=state.relayArc!,remaining=state.exploration.materials,day=state.day,credits=state.exploration.credits
    const action:CampaignAction={type:'arc-choice',arcId:'long-relay',beatId:'relay',choiceId:approach}
    state=legal(state,action)
    expect(state.relayArc?.approach).toBe(approach)
    expect(state.relayArc?.stage).toBe('relay-resolved')
    expect(state.day).toBe(day+(approach==='repair'?2:3))
    expect(state.exploration.materials).toBe(remaining-(approach==='repair'?5:0))
    expect(state.exploration.credits).toBe(credits)
    expect(reduceCampaign(state,action)).toBe(state)
    expect(saveAndLoad(state).campaign).toEqual(state)
    state=relayReplyReady('long-relay-'+approach,approach)
    const before=state.exploration.credits
    const finish:CampaignAction={type:'arc-choice',arcId:'long-relay',beatId:'reply',choiceId:'acknowledge'}
    state=legal(state,finish)
    expect(state.relayArc?.stage).toBe('complete')
    expect(state.exploration.credits).toBe(before+20)
    expect(state.relayArc?.records.map(x=>x.beatId)).toEqual(['start','relay','reply'])
    expect(reduceCampaign(state,finish)).toBe(state)
    expect(saveAndLoad(state).campaign).toEqual(state)
    expect(saveAndLoad(state,7).campaign).toBeNull()
  })
  it('rejects forged actions, wrong stage, remote actions and insufficient repair supplies',()=>{
    const accepted=acceptedRelay('relay-denials'),arc=accepted.relayArc!
    const start:CampaignAction={type:'start-arc',arcId:'long-relay',locationId:arc.originStationId}
    expect(reduceCampaign(accepted,start)).toBe(accepted)
    const relay:CampaignAction={type:'arc-choice',arcId:'long-relay',beatId:'relay',choiceId:'repair'}
    expect(reduceCampaign(accepted,relay)).toBe(accepted)
    expect(reduceCampaign(createCampaign('relay-denials'),relay)).toEqual(createCampaign('relay-denials'))
    const ready=relayDecisionReady('relay-denials')
    expect(reduceCampaign({...ready,exploration:{...ready.exploration,materials:0}},relay)).toEqual({...ready,exploration:{...ready.exploration,materials:0}})
    const wrong={...relay,choiceId:'other'} as CampaignAction
    expect(reduceCampaign(ready,wrong)).toBe(ready)
    const wrongArc={...relay,arcId:'else'} as CampaignAction
    expect(reduceCampaign(ready,wrongArc)).toBe(ready)
    const finish:CampaignAction={type:'arc-choice',arcId:'long-relay',beatId:'reply',choiceId:'acknowledge'}
    expect(reduceCampaign(ready,finish)).toBe(ready)
    const noFunds={...ready,exploration:{...ready.exploration,materials:0,credits:0}}
    expect(actionLock(noFunds,{...relay,choiceId:'local-copy'})).toBeNull()
  })
  it('records the completed mission after reloading, permits finishing the main game without replying',()=>{
    let state=relayDecisionReady('relay-deferral')
    const still=saveAndLoad(state).campaign!
    expect(still.relayArc).toEqual(state.relayArc)
    expect(state.relayArc?.stage).toBe('accepted')
    state=legal(state,{type:'arc-choice',arcId:'long-relay',beatId:'relay',choiceId:'local-copy'})
    const remote=state.relayArc!
    expect(actionLock(state,{type:'arc-choice',arcId:'long-relay',beatId:'reply',choiceId:'acknowledge'})).not.toBeNull()
    expect(remote.approach).toBe('local-copy')
    const mockReadyToReturn:Campaign={...state,built:[...state.built,'return-drive']}
    const atHome=reduceCampaign(mockReadyToReturn,{type:'return-home'})
    expect(atHome.outcome).toBe('home')
    expect(atHome.relayArc?.stage).toBe('relay-resolved')
  })
})
