import { pathTo, shotInfo, tacticalLock, visible, inExtraction, distance } from '../src/engine/tactical/mission.js'
import type { Mission, TacticalAction, Point } from '../src/engine/tactical/mission.js'
import { createCampaign, reduceCampaign } from '../src/engine/exploration/campaign.js'
import type { Campaign, CampaignAction } from '../src/engine/exploration/campaign.js'
import type { OperationKind } from '../src/engine/tactical/operations.js'
export function readyOperation(seed: string) {
  let s = createCampaign(seed)
  s = reduceCampaign(s,{type:'scan',tier:'survey'})
  s = reduceCampaign(s,{type:'investigate',locationId:s.world.locations.find((l) => l.name === 'The Silent Courier')!.id})
  return s
}
export function launchOperation(seed: string, kind: OperationKind) {
  const s = readyOperation(seed)
  return reduceCampaign(s,{type:'deploy-operation',locationId:s.world.locations.find((l) => l.name === 'The Silent Courier')!.id,squad:s.roster.slice(0,4).map((o) => o.id),kind})
}
/** Fixture pilot issues legal orders, never alters a campaign, and only shoots visible targets. */
export function nextOperationOrder(m: Mission, cases = 3): TacticalAction {
  const op = m.operation!, crew = m.units.filter((u) => u.side === 'crew' && u.hp > 0)
  const done = op.kind === 'rescue' ? op.survivors.every((s) => s.evacuated) : op.kind === 'salvage' ? op.crates.filter((c) => c.collected).length >= cases : m.recovered
  if (done && m.units.filter((u) => u.side === 'crew').every(inExtraction)) return {type:'extract',abandon:false}
  for (const u of crew.filter((u) => u.ap > 0)) {
    const hurt = m.units.find((t) => t.side === 'crew' && t.hp <= t.maxHp - 3 && distance(u,t) <= 1)
    if (hurt && !tacticalLock(m,{type:'heal',unitId:u.id,targetId:hurt.id})) return {type:'heal',unitId:u.id,targetId:hurt.id}
    if (!done && !tacticalLock(m,{type:'interact',unitId:u.id})) return {type:'interact',unitId:u.id}
    const targets = m.units.filter((e) => e.side === 'hostile' && visible(m,e) && !tacticalLock(m,{type:'shoot',unitId:u.id,targetId:e.id})).sort((a,b) => a.hp-b.hp || shotInfo(m,u,b).chance-shotInfo(m,u,a).chance)
    if(targets[0]) { if(u.ap === 2 && !u.aimed) return {type:'aim',unitId:u.id}; return {type:'shoot',unitId:u.id,targetId:targets[0].id} }
    if (!u.ammo) return {type:'reload',unitId:u.id}
    if (u.fired) continue
    let returning = done, goal: Point = m.objective
    if (op.kind === 'rescue') {
      const following = op.survivors.some((s) => !s.evacuated && s.leader === u.id)
      const waiting = op.survivors.filter((s) => !s.evacuated && (!s.leader || !crew.some((c) => c.id === s.leader))).sort((a,b) => distance(u,a)-distance(u,b))[0]
      returning = following || !waiting
      if(waiting) goal = waiting
    }
    if(returning) goal = {x:0,y:3 + crew.indexOf(u)}
    const downed = m.units.filter((t) => t.side === 'crew' && t.hp === 0 && !inExtraction(t)).sort((a,b) => distance(u,a)-distance(u,b))[0]
    if (downed && u.medkit) { goal = downed; returning = false }
    if(returning && u.x === goal.x && u.y === goal.y) continue
    const cells = m.seen.map((n) => ({x:n % m.width,y:Math.floor(n/m.width)}))
    const options = cells.map((p) => ({p,path:pathTo(m,u,p)})).filter((o) => o.path?.length && o.path.length <= u.move && distance(o.p,goal) < distance(u,goal)).sort((a,b) => distance(a.p,goal)-distance(b.p,goal))
    if(options[0]) return {type:'move',unitId:u.id,...options[0].p}
  }
  return {type:'end-turn'}
}
export function completeOperation(seed: string, kind: OperationKind, cases = 3) {
  let state = launchOperation(seed,kind)
  const deployed = state
  let interaction: Campaign | null = null, extraction: Campaign | null = null
  for(let i=0;i<500 && state.mission!.outcome === 'active';i++) {
    const order = nextOperationOrder(state.mission!,cases)
    if(order.type === 'interact' && !interaction) interaction = state
    if(order.type === 'extract') extraction = state
    const a: CampaignAction = {type:'tactical',order}
    const next = reduceCampaign(state,a)
    if(next === state) throw new Error(`Illegal pilot order ${JSON.stringify(a)}`)
    state = next
  }
  if (state.mission!.outcome === 'active') throw new Error(`Operation pilot stalled: ${kind}/${seed}`)
  return {deployed,interaction,extraction,report:state,final:reduceCampaign(state,{type:'debrief'})}
}
if (process.argv[1]?.endsWith('operation-walkthrough.ts')) {
  for (const kind of ['rescue','sabotage','salvage'] as const) for(let i=0;i<Number(process.argv[2] ?? 12);i++) {
    const r=completeOperation(`operation-sweep-${i}`,kind)
    console.log(JSON.stringify({kind,seed:i,outcome:r.report.mission!.outcome,turn:r.report.mission!.turn,crew:r.report.mission!.rescued.length,civilians:r.report.mission!.operation!.survivors.filter((s) => s.evacuated).length,cases:r.report.mission!.operation!.crates.filter((c) => c.collected).length}))
  }
}
