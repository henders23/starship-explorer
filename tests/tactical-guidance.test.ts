import { describe, expect, it } from 'vitest'
import { createOperation, initialRoster, reduceMission, visible } from '../src/engine/tactical/mission.js'
import { movementPreview, orderFeedback } from '../src/ui/tactical-guidance.js'
import { sceneOrder } from '../src/ui/tactical-scene.js'

function scene() {
  const m=createOperation('guidance','site','Deck',initialRoster().slice(0,4),0,{},'salvage')
  m.tiles=Array.from({length:120},()=>'floor');m.seen=Array.from({length:120},(_,i)=>i)
  m.units[0]={...m.units[0]!,x:4,y:4}
  m.units[4]={...m.units[4]!,x:8,y:4}
  m.units[5]={...m.units[5]!,x:11,y:0,name:'Unseen sentinel'}
  return m
}
describe('tactical guidance',()=>{
  it('shows directional cover and AP cost without revealing hidden guards or changing the mission',()=>{
    const m=scene();m.tiles[4*12+6]='half'
    const before=JSON.stringify(m)
    const preview=movementPreview(m,'operative-0',{x:5,y:4},false)
    expect(preview).toMatchObject({lock:null,cost:1,remainingAP:1})
    expect(preview.threats).toHaveLength(1)
    expect(preview.threats[0]).toMatchObject({id:'sentry-0',cover:20,chance:55})
    expect(JSON.stringify(preview)).not.toContain('Unseen sentinel')
    expect(JSON.stringify(m)).toBe(before)
  })
  it('does not preview a guard that the proposed move would newly reveal',()=>{
    const m=scene();m.units[4]!.hp=0;m.units[5]={...m.units[5]!,x:9,y:0}
    expect(visible(m,m.units[5]!)).toBe(false)
    expect(movementPreview(m,'operative-0',{x:5,y:3},false).threats).toEqual([])
    const after=reduceMission(m,{type:'move',unitId:'operative-0',x:5,y:3})
    expect(visible(after,after.units[5]!)).toBe(true)
  })
  it('refuses blocked, occupied, unexplored, out-of-bounds and unaffordable routes',()=>{
    const m=scene();m.tiles[4*12+5]='wall'
    for(const p of [{x:5,y:4},{x:8,y:4},{x:12,y:4},{x:-1,y:3}])expect(movementPreview(m,'operative-0',p,false).lock).toBeTruthy()
    m.seen=m.seen.filter(i=>i!==3*12+4)
    expect(movementPreview(m,'operative-0',{x:4,y:3},false).lock).toBeTruthy()
    m.units[0]!.ap=1
    const sprint=movementPreview(m,'operative-0',{x:3,y:4},true)
    expect(sprint).toMatchObject({cost:2,remainingAP:null,threats:[]})
    expect(sprint.lock).toContain('2 AP')
  })
  it('forecasts exact heat thresholds and zero AP after sprinting',()=>{
    const m=scene();m.units[0]!.shield=4
    for(const [turn,heat] of [[3,0],[4,1],[7,2]]) {
      m.turn=turn!
      expect(movementPreview(m,'operative-0',{x:5,y:4},true)).toMatchObject({heat,cost:2,remainingAP:0})
      expect(movementPreview(m,'operative-0',{x:3,y:4},false).heat).toBe(0)
    }
  })
  it('reports actual shield loss separately from health loss and explains misses',()=>{
    let hits=0,misses=0
    for(let i=0;i<20;i++) {
      const m=scene();m.seed=`feedback-${i}`;m.units[4]!.shield=2
      const order={type:'shoot' as const,unitId:'operative-0',targetId:'sentry-0'}
      const after=reduceMission(m,order),feedback=orderFeedback(m,after,order)!
      if(after.lastShot!.hit){hits++;expect(feedback.title).toBe('Shot hit');expect(feedback.details).toContain('Custodian 1: −1 health, −2 shield.')}
      else {misses++;expect(feedback.title).toBe('Shot missed');expect(feedback.details.join(' ')).toContain('target took no damage')}
    }
    expect(hits).toBeGreaterThan(0);expect(misses).toBeGreaterThan(0)
  })
  it('reports heat damage, shots exchanged and incapacitation on enemy turns',()=>{
    const m=scene();m.turn=7;m.units.forEach(u=>{if(u.side==='hostile')u.hp=0});m.units[0]!.hp=1
    const after=reduceMission(m,{type:'end-turn'}),feedback=orderFeedback(m,after,{type:'end-turn'})!
    expect(feedback.details).toContain('Mara Chen: −1 health — downed.')
    expect(feedback.details[0]).toContain('0 shots exchanged. Turn 8')
    expect(orderFeedback(m,m,{type:'end-turn'})).toBeNull()
  })
  it('reports movement costs and guides the newly assigned civilian',()=>{
    const m=createOperation('escort','s','Rescue',initialRoster().slice(0,4),0,{},'rescue')
    m.units[0]={...m.units[0]!,x:7,y:3}
    const action={type:'interact' as const,unitId:'operative-0'},after=reduceMission(m,action)
    expect(orderFeedback(m,after,action)!.details.join(' ')).toContain('Dr Imani Hale is following Mara Chen')
    const move={type:'move' as const,unitId:'operative-0',x:7,y:4},moved=reduceMission(after,move)
    expect(orderFeedback(after,moved,move)!.details).toContain('1 AP spent. 0 AP left.')
  })
})
describe('tactical depth',()=>{
  it('draws figures behind nearer obstacles, with stable ordering and no hidden enemies',()=>{
    const m=scene();m.units[0]={...m.units[0]!,x:3,y:1};m.tiles[2*12+3]='wall';m.seen=m.seen.filter(i=>i!==9*12+11);m.tiles[9*12+11]='wall'
    const before=JSON.stringify(m),order=sceneOrder(m),ids=order.map(i=>i.id)
    expect(ids.indexOf('operative-0')).toBeLessThan(ids.indexOf('obstacle-27'))
    expect(ids).not.toContain('sentry-1');expect(ids).not.toContain('obstacle-119')
    expect(sceneOrder(m)).toEqual(order);expect(JSON.stringify(m)).toBe(before)
    for(let i=1;i<order.length;i++)expect(order[i]!.p.x+order[i]!.p.y).toBeGreaterThanOrEqual(order[i-1]!.p.x+order[i-1]!.p.y)
  })
})
