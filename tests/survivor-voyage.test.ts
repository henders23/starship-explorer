import { describe,expect,it } from 'vitest'
import { actionLock,createCampaign,reduceCampaign } from '../src/engine/exploration/campaign.js'
import type { Campaign } from '../src/engine/exploration/campaign.js'
import { createRecorderMission, initialRoster, reduceMission, tacticalLock, tileAt } from '../src/engine/tactical/mission.js'
import { savedSurvivors,survivorAccepted,recorderDeployed,recorderReport,survivorReply,nextRecorderOrder } from '../tools/survivor-walkthrough.js'
import { completeOperation } from '../tools/operation-walkthrough.js'
import { legal } from '../tools/long-relay-walkthrough.js'
import { saveExploration,loadExploration } from '../src/ui/exploration-save.js'
function replay(s:Campaign,version?:number){let raw='';const mem={getItem:()=>raw,setItem:(_:string,v:string)=>{raw=v},removeItem:()=>{}};saveExploration(s,mem);if(version)raw=JSON.stringify({...JSON.parse(raw),version});return loadExploration(mem)}
describe('Someone left behind',()=>{
 it('records only actually evacuated identities; prior journals remain exact and unnamed',()=>{
  const old=completeOperation('survivor-0','rescue').final
  expect(old.rescuedPeople).toBeUndefined();expect(replay(old,8).campaign).toEqual(old)
  const saved=savedSurvivors()
  expect(saved.rescuedPeople?.map(p=>p.name)).toEqual(saved.lastMission!.operation!.survivors.filter(s=>s.evacuated).map(s=>s.name))
  expect(replay(saved).campaign).toEqual(saved);expect(replay(saved,8).campaign).toBeNull()
  expect(reduceCampaign(old,{type:'accept-survivor',personId:'invented',stationId:old.world.locations.find(s=>s.kind==='station')!.id})).toBe(old)
 })
 it('does not record a person left outside during a partial extraction',()=>{
  let s=recorderDeployed() // take a legal rescue prefix, before its final extraction
  const index=s.actions.findIndex(a=>a.type==='tactical'&&a.order.type==='extract')
  let partial=createCampaign(s.seed)
  for(const a of s.actions.slice(0,index))partial=legal(partial,a)
  // Focused debrief fixture: only the first person is recorded as evacuated.
  partial={...partial,mission:{...partial.mission!,operation:{...partial.mission!.operation!,survivors:partial.mission!.operation!.survivors.map((p,i)=>({...p,evacuated:i===0,...(i===1?{x:9,y:6,leader:null}:{})}))}}}
  partial=legal(partial,{type:'tactical',order:{type:'extract',abandon:true}})
  partial=legal(partial,{type:'debrief'})
  expect(partial.rescuedPeople).toHaveLength(1)
  expect(partial.rescuedPeople![0]!.name).toBe(partial.lastMission!.operation!.survivors[0]!.name)
 })
 it.each([true,false])('completes evidence=%s through legal orders with one closeout and no extra site reward',recover=>{
  const report=recorderReport('survivor-0',recover)
  expect(report.mission!.outcome).toBe(recover?'success':'retreat');expect(report.mission!.rescued).toHaveLength(4)
  const debrief=legal(report,{type:'debrief'})
  expect(debrief.exploration).toEqual(report.exploration)
  expect(debrief.findings).toEqual(report.findings)
  expect(debrief.survivorArc?.result).toBe(recover?'evidence':'withdrawn')
  expect(reduceCampaign(debrief,{type:'debrief'})).toBe(debrief)
  let reply=survivorReply('survivor-0',recover),credits=reply.exploration.credits
  reply=legal(reply,{type:'close-survivor'})
  expect(reply.exploration.credits).toBe(credits+(recover?24:0));expect(reply.survivorArc?.stage).toBe('complete')
  expect(reduceCampaign(reply,{type:'close-survivor'})).toBe(reply)
  expect(reduceCampaign(reply,{type:'deploy-recorder',squad:reply.roster.slice(0,4).map(o=>o.id)})).toBe(reply)
  for(const s of [survivorAccepted(),report,debrief,reply])expect(replay(s).campaign).toEqual(s)
 })
 it('reloads active carry and rejects remote, forged and wrong-stage orders',()=>{
  let s=recorderDeployed()
  for(let i=0;i<200&&!s.mission!.recorder!.carrierId;i++)s=legal(s,{type:'tactical',order:nextRecorderOrder(s.mission!)})
  expect(s.mission!.recorder!.carrierId).toBeTruthy();expect(replay(s).campaign).toEqual(s)
  const accepted=survivorAccepted()
  expect(actionLock(accepted,{type:'close-survivor'})).toBeTruthy()
  expect(actionLock(accepted,{type:'deploy-recorder',squad:[]})).toBeTruthy()
  const remote={...survivorReply(),at:'elsewhere'}
  expect(reduceCampaign(remote,{type:'close-survivor'})).toBe(remote)
  expect(reduceCampaign(createCampaign('empty'),{type:'accept-survivor',personId:'invented',stationId:'invented'})).toEqual(createCampaign('empty'))
  expect(reduceCampaign(accepted,{type:'accept-survivor',personId:accepted.survivorArc!.survivor.id,stationId:accepted.survivorArc!.stationId})).toBe(accepted)
 })
 it('lets the player return home with the request unfinished',()=>{
  const s=survivorAccepted(),ready={...s,built:[...s.built,'return-drive' as const]}
  expect(legal(ready,{type:'return-home'}).survivorArc?.stage).toBe('accepted')
 })
 it('enforces carrier speed, drop/transfer, downed drop and alarm cadence without mutating input',()=>{
  let m=createRecorderMission('recorder-rules','s','Archive',initialRoster().slice(0,4),{})
  m.units=m.units.map((u,i)=>u.side==='hostile'?{...u,hp:0}:i===0?{...u,x:9,y:2}:i===1?{...u,x:10,y:2}:u)
  m.seen=Array.from({length:120},(_,i)=>i)
  const original=JSON.stringify(m)
  m=reduceMission(m,{type:'interact',unitId:'operative-0'})
  expect(m.recorder!.carrierId).toBe('operative-0');expect(JSON.parse(original).recorder.carrierId).toBeNull()
  expect(tacticalLock({...m,units:m.units.map(u=>u.id==='operative-0'?{...u,ap:2}:u)},{type:'move',unitId:'operative-0',x:9,y:1,sprint:true})).toContain('sprint')
  expect(tacticalLock(m,{type:'move',unitId:'operative-0',x:6,y:2})).toContain('2 tiles')
  m=reduceMission(m,{type:'drop-recorder',unitId:'operative-0'})
  expect(m.recorder!.carrierId).toBeNull()
  m=reduceMission(m,{type:'interact',unitId:'operative-1'})
  expect(m.recorder!.carrierId).toBe('operative-1')
  const alarm=m.recorder!.alarmTurn
  m=reduceMission(m,{type:'end-turn'});expect(m.recorder!.reinforcements).toBe(1)
  m=reduceMission(m,{type:'end-turn'});expect(m.recorder!.reinforcements).toBe(1)
  m=reduceMission(m,{type:'end-turn'});expect(m.recorder!.reinforcements).toBe(2);expect(m.recorder!.alarmTurn).toBe(alarm)
  m.units=m.units.map(u=>u.id==='operative-1'?{...u,hp:0}:u)
  m=reduceMission(m,{type:'end-turn'})
  expect(m.recorder!.carrierId).toBeNull();expect(m.recovered).toBe(false)
  expect(m.units.filter(u=>u.id.startsWith('recorder-reserve-'))).toHaveLength(2)
  expect(m.units.every(u=>tileAt(m,u)==='floor')).toBe(true)
 })
 it('a defeated field visit records loss honestly and pays no evidence reward',()=>{
  const s=recorderDeployed(),down={...s,mission:{...s.mission!,units:s.mission!.units.map(u=>u.side==='crew'?{...u,hp:0}:u)}}
  let lost=legal(down,{type:'tactical',order:{type:'end-turn'}})
  expect(lost.mission!.outcome).toBe('defeat')
  lost=legal(lost,{type:'debrief'});expect(lost.survivorArc?.result).toBe('lost');expect(lost.exploration.credits).toBe(s.exploration.credits)
 })
 it('completes eight distinct seeded recorder missions with no crew losses',()=>{
  for(let i=0;i<8;i++){const s=recorderReport('survivor-'+i);expect(s.mission!.outcome).toBe('success');expect(s.mission!.rescued).toHaveLength(4)}
 })
})
