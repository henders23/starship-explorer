import { describe, expect, it } from 'vitest'
import { createOperation, initialRoster, reduceMission, tacticalLock, inExtraction, pathTo, operationReward } from '../src/engine/tactical/mission.js'
import type { Mission, TacticalAction } from '../src/engine/tactical/mission.js'
import { OPERATION_KINDS } from '../src/engine/tactical/operations.js'
import type { OperationKind } from '../src/engine/tactical/operations.js'
import { reduceCampaign, actionLock } from '../src/engine/exploration/campaign.js'
import { saveExploration, loadExploration } from '../src/ui/exploration-save.js'
import { completeOperation, launchOperation, readyOperation, nextOperationOrder } from '../tools/operation-walkthrough.js'
const mission = (kind: OperationKind) => createOperation('adversarial','site','Test',initialRoster().slice(0,4),0,{},kind)
const quiet = (m: Mission) => ({...m, units:m.units.map((u) => u.side === 'hostile' ? {...u,hp:0} : u)})
const act = (m: Mission, a: TacticalAction) => { expect(tacticalLock(m,a)).toBeNull(); return reduceMission(m,a) }
function replay(s: ReturnType<typeof launchOperation>, version = 6) {
  let raw = ''; const mem={getItem:()=>raw,setItem:(_:string,v:string)=>{raw=v},removeItem:()=>{}}
  saveExploration(s,mem); raw=JSON.stringify({...JSON.parse(raw),version}); return loadExploration(mem)
}
describe('distinct boarding operations', () => {
  it('provides three connected layouts, reachable targets and a clear exit', () => {
    const layouts=new Set<string>()
    for(const kind of OPERATION_KINDS) {
      const m=mission(kind); layouts.add(JSON.stringify(m.tiles))
      const goals=kind === 'rescue' ? m.operation!.survivors : kind === 'salvage' ? m.operation!.crates : [m.objective]
      for(const goal of goals) expect(pathTo(m,m.units[0]!,goal,false)?.length).toBeGreaterThan(0)
      expect(m.units.filter((u)=>u.side==='crew').every(inExtraction)).toBe(true)
    }
    expect(layouts.size).toBe(3)
  })
  it('escorts step by step, never mutates the source, and boards at the shuttle edge', () => {
    let m=quiet(mission('rescue'))
    m.units[0]={...m.units[0]!,x:7,y:3}; m.seen=Array.from({length:120},(_,i)=>i)
    const original=JSON.stringify(m)
    m=act(m,{type:'interact',unitId:'operative-0'})
    expect(m.operation!.survivors[0]!.leader).toBe('operative-0')
    m=act(m,{type:'move',unitId:'operative-0',x:7,y:4})
    m=act(m,{type:'end-turn'})
    m=act(m,{type:'move',unitId:'operative-0',x:3,y:4})
    expect(m.operation!.survivors[0]).toMatchObject({x:4,y:4,evacuated:false})
    expect(JSON.parse(original).operation.survivors[0].leader).toBeNull()
    m=act(m,{type:'end-turn'})
    m=act(m,{type:'move',unitId:'operative-0',x:0,y:3,sprint:true})
    expect(m.operation!.survivors[0]!.evacuated).toBe(true)
    expect(m.recovered).toBe(true)
    expect(tacticalLock(m,{type:'extract',abandon:false})).toContain('civilians')
  })
  it('allows another operative to pick up a downed escort’s survivor', () => {
    let m=quiet(mission('rescue')); m.units[0]={...m.units[0]!,x:7,y:3}
    m=act(m,{type:'interact',unitId:'operative-0'})
    m.units[0]={...m.units[0]!,hp:0}; m.units[1]={...m.units[1]!,x:8,y:4}
    m=act(m,{type:'interact',unitId:'operative-1'})
    expect(m.operation!.survivors[0]!.leader).toBe('operative-1')
  })
  it('does not remotely collect objectives or overwrite a living escort', () => {
    for(const kind of OPERATION_KINDS) {
      const m=mission(kind)
      expect(reduceMission(m,{type:'interact',unitId:'operative-0'})).toBe(m)
    }
    let m=quiet(mission('rescue')); m.units[0]={...m.units[0]!,x:7,y:3}
    m=act(m,{type:'interact',unitId:'operative-0'})
    m.units[1]={...m.units[1]!,x:8,y:4}
    expect(reduceMission(m,{type:'interact',unitId:'operative-1'})).toBe(m)
  })
  it('sabotage turns holding guards into pursuers and spawns just one reserve', () => {
    let m=mission('sabotage')
    m.units=m.units.map((u)=>u.side==='crew'?{...u,x:0}:u)
    const original=m.units.filter((u)=>u.side==='hostile').map((u)=>({x:u.x,y:u.y}))
    m=act(m,{type:'end-turn'})
    expect(m.units.filter((u)=>u.side==='hostile').map((u)=>({x:u.x,y:u.y}))).toEqual(original)
    m.units[2]={...m.units[2]!,x:8,y:5}; m=act(m,{type:'interact',unitId:'operative-2'})
    expect(m.operation!.alarm).toBe(true); expect(m.units.filter((u)=>u.side==='hostile').every((u)=>u.move===4)).toBe(true)
    expect(tacticalLock(m,{type:'interact',unitId:'operative-2'})).toBeTruthy()
    for(let i=0;i<2;i++)m=act(m,{type:'end-turn'})
    expect(m.units.filter((u)=>u.id==='reserve')).toHaveLength(1)
  })
  it('heat starts on the stated turn, bypasses shields, intensifies and spares the exit corridor', () => {
    let m=quiet(mission('salvage')); m.turn=3
    m.units[0]={...m.units[0]!,x:4,y:4,shield:4}; m.units[1]={...m.units[1]!,x:3,y:4}
    m=act(m,{type:'end-turn'}); expect(m.units[0]!.hp).toBe(10)
    m=act(m,{type:'end-turn'}); expect(m.units[0]).toMatchObject({hp:9,shield:4}); expect(m.units[1]!.hp).toBe(8)
    m.turn=7; m=act(m,{type:'end-turn'}); expect(m.units[0]!.hp).toBe(7)
  })
  it('heat incapacitation ends a mission instead of leaving an unplayable turn', () => {
    let m=quiet(mission('salvage')); m.turn=4; m.units=m.units.map((u)=>u.side==='crew'?{...u,x:4,hp:1}:u)
    m=act(m,{type:'end-turn'}); expect(m.outcome).toBe('defeat'); expect(operationReward(m)).toEqual({materials:0,credits:0})
  })
  it('one case permits extraction; cases cannot be collected twice', () => {
    let m=quiet(mission('salvage')); m.units[0]={...m.units[0]!,x:5,y:3}
    m=act(m,{type:'interact',unitId:'operative-0'})
    expect(m.recovered).toBe(true)
    expect(reduceMission(m,{type:'interact',unitId:'operative-0'})).toBe(m)
    m.units[0]={...m.units[0]!,x:1,y:3}
    m=act(m,{type:'extract',abandon:false}); expect(operationReward(m)).toEqual({materials:5,credits:8})
  })
  it('gates deployment by site/squad/type and rejects old-envelope operation orders', () => {
    const s=readyOperation('ops-gates'), site=s.world.locations.find((l)=>l.name==='The Silent Courier')!
    expect(actionLock(s,{type:'deploy-operation',locationId:site.id,squad:s.roster.slice(0,4).map((o)=>o.id),kind:'fake' as OperationKind})).toBeTruthy()
    expect(replay(launchOperation('ops-gates','rescue'),5).campaign).toBeNull()
    expect(replay(s,5).campaign).toEqual(s)
  })
  it('preserves active objective progress, debriefs once and closes successful sites', () => {
    for(const kind of OPERATION_KINDS) {
      const r=completeOperation('operation-sweep-0',kind)
      expect(replay(r.interaction!).campaign).toEqual(r.interaction)
      expect(replay(r.extraction!).campaign).toEqual(r.extraction)
      expect(replay(r.report).campaign).toEqual(r.report)
      expect(replay(r.final).campaign).toEqual(r.final)
      expect(r.final.completedOperations).toHaveLength(1)
      expect(reduceCampaign(r.final,{type:'debrief'})).toBe(r.final)
      expect(reduceCampaign(r.final,r.deployed.actions.at(-1)!)).toBe(r.final)
      const bonus=operationReward(r.report.mission!), site=r.final.world.locations.find((l)=>l.name==='The Silent Courier')!
      expect(r.final.exploration.materials-r.deployed.exploration.materials).toBe(site.reward!.materials+bonus.materials)
      expect(r.final.exploration.credits-r.deployed.exploration.credits).toBe(site.reward!.credits+bonus.credits)
    }
  })
  it('withdrawal pays nothing and leaves a remote-recovery route available', () => {
    for(const kind of OPERATION_KINDS) {
      const s=launchOperation('withdraw-ops',kind)
      const report=reduceCampaign(s,{type:'tactical',order:{type:'extract',abandon:true}})
      const next=reduceCampaign(report,{type:'debrief'})
      expect(next.exploration.materials).toBe(s.exploration.materials)
      expect(next.completedOperations).toHaveLength(0)
      expect(actionLock(next,{type:'recover',locationId:s.mission!.locationId,approach:'careful'})).toBeNull()
    }
  })
  it('partial rescue pays only for the person evacuated and requires explicit abandonment', () => {
    let m=quiet(mission('rescue')); m.operation!.survivors[0]!.evacuated=true; m.recovered=true
    expect(reduceMission(m,{type:'extract',abandon:false})).toBe(m)
    m=act(m,{type:'extract',abandon:true})
    expect(operationReward(m)).toEqual({materials:3,credits:15})
  })
  it('completes 36 full legal campaigns with objectives and four crew returned', () => {
    for(const kind of OPERATION_KINDS) for(let i=0;i<12;i++) {
      const r=completeOperation(`operation-sweep-${i}`,kind)
      expect(r.report.mission!.outcome,`${kind}/${i}`).toBe('success')
      expect(r.report.mission!.rescued,`${kind}/${i}`).toHaveLength(4)
      if(kind==='rescue')expect(r.final.completedOperations[0]!.survivors).toBe(2)
      if(kind==='salvage')expect(r.final.completedOperations[0]!.cases).toBe(3)
    }
  })
  it('offers a shorter, lower-reward salvage route with less thermal exposure', () => {
    const short=completeOperation('operation-sweep-0','salvage',1), full=completeOperation('operation-sweep-0','salvage',3)
    expect(short.report.mission!.outcome).toBe('success')
    expect(short.report.actions.length).toBeLessThan(full.report.actions.length)
    expect(short.report.mission!.turn).toBeLessThanOrEqual(full.report.mission!.turn)
    expect(short.final.exploration.materials).toBeLessThan(full.final.exploration.materials)
    expect(short.report.mission!.units.filter((u)=>u.side==='crew').reduce((n,u)=>n+u.hp,0)).toBeGreaterThanOrEqual(full.report.mission!.units.filter((u)=>u.side==='crew').reduce((n,u)=>n+u.hp,0))
  })
  it('keeps maximum-threat operations survivable with standard equipment', () => {
    for(const kind of OPERATION_KINDS) for(let i=0;i<12;i++) {
      let m=createOperation(`hard-${i}`,'hard-site','Hard test',initialRoster().slice(0,4),2,{},kind)
      for(let n=0;n<300 && m.outcome==='active';n++)m=act(m,nextOperationOrder(m))
      expect(m.outcome,`${kind}/${i}`).toBe('success')
      expect(m.rescued,`${kind}/${i}`).toHaveLength(4)
    }
  })
})
