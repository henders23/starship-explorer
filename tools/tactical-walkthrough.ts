import { pathTo, shotInfo, tacticalLock, visible, inExtraction, distance } from '../src/engine/tactical/mission.js'
import type { Mission, TacticalAction } from '../src/engine/tactical/mission.js'
import { createCampaign, reduceCampaign } from '../src/engine/exploration/campaign.js'
import type { Campaign, CampaignAction } from '../src/engine/exploration/campaign.js'

export function deployBoarding(seed: string): Campaign {
  let state = createCampaign(seed)
  const apply = (action: CampaignAction) => { const next = reduceCampaign(state, action); if (next === state) throw new Error(`Rejected ${JSON.stringify(action)}`); state = next }
  apply({ type: 'scan', tier: 'survey' })
  const site = state.world.locations.find((s) => s.systemId === state.at && s.kind === 'derelict' && s.discovery === 'exotic-energy')!
  apply({ type: 'investigate', locationId: site.id })
  apply({ type: 'deploy', locationId: site.id, squad: state.roster.slice(0, 4).map((o) => o.id) })
  return state
}
/** A deliberately simple pilot uses only visible threats and legal public orders. */
export function nextBoardingOrder(m: Mission): TacticalAction {
  const crew = m.units.filter((u) => u.side === 'crew' && u.hp > 0)
  if (m.recovered && m.units.filter((u) => u.side === 'crew').every(inExtraction)) return { type: 'extract', abandon: false }
  for (const u of crew.filter((unit) => unit.ap > 0)) {
    const interact: TacticalAction = { type: 'interact', unitId: u.id }
    if (!tacticalLock(m, interact)) return interact
    const hurt = m.units.find((unit) => unit.side === 'crew' && unit.hp <= unit.maxHp - 3 && distance(unit, u) <= 1)
    if (hurt && !tacticalLock(m, { type: 'heal', unitId: u.id, targetId: hurt.id })) return { type: 'heal', unitId: u.id, targetId: hurt.id }
    const targets = m.units.filter((e) => e.side === 'hostile' && e.hp > 0 && visible(m, e) && !tacticalLock(m, { type: 'shoot', unitId: u.id, targetId: e.id }))
      .sort((a, b) => a.hp - b.hp || shotInfo(m, u, b).chance - shotInfo(m, u, a).chance)
    if (targets[0]) {
      if (u.ap === 2 && !u.aimed) return { type: 'aim', unitId: u.id }
      return { type: 'shoot', unitId: u.id, targetId: targets[0].id }
    }
    if (!u.ammo) return { type: 'reload', unitId: u.id }
    // Waiting after firing avoids exposing a wounded unit just to spend an AP.
    if (u.fired) continue
    if (m.recovered && inExtraction(u)) continue
    const goal = m.recovered ? { x: 0, y: 3 + crew.indexOf(u) } : m.objective
    const options = m.seen.map((n) => ({ x: n % m.width, y: Math.floor(n / m.width) }))
      .map((p) => ({ p, path: pathTo(m, u, p) }))
      .filter((v) => v.path?.length && v.path.length <= u.move && distance(v.p, goal) < distance(u, goal))
      .sort((a, b) => distance(a.p, goal) - distance(b.p, goal))
    if (options[0]) return { type: 'move', unitId: u.id, ...options[0].p }
  }
  return { type: 'end-turn' }
}
export function completeBoarding(seed: string) {
  let state = deployBoarding(seed)
  const deployed = state
  let extraction: Campaign | null = null
  for (let i = 0; i < 600 && state.mission?.outcome === 'active'; i++) {
    const order = nextBoardingOrder(state.mission)
    if (order.type === 'extract') extraction = state
    const next = reduceCampaign(state, { type: 'tactical', order })
    if (next === state) throw new Error(`Pilot issued illegal order: ${JSON.stringify(order)}`)
    state = next
  }
  if (state.mission?.outcome === 'active') throw new Error(`Pilot stalled: ${seed}`)
  return { deployed, extraction, report: state, final: reduceCampaign(state, { type: 'debrief' }) }
}
if (process.argv[1]?.endsWith('tactical-walkthrough.ts')) {
  const count = Number(process.argv[2] ?? 12)
  for (let i = 0; i < count; i++) {
    const run = completeBoarding(`boarding-sweep-${i}`)
    console.log(JSON.stringify({ seed: i, outcome: run.report.mission?.outcome, turns: run.report.mission?.turn, survivors: run.report.mission?.rescued.length, actions: run.final.actions.length }))
  }
}
