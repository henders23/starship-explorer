/** Full-run validator using only accepted public engine actions. No state edits or resource grants. */
import { actionLock, createCampaign, hasTech, reduceCampaign, travelCost } from '../src/engine/exploration/campaign.js'
import type { Campaign, CampaignAction } from '../src/engine/exploration/campaign.js'
import { locationsAt } from '../src/engine/exploration/v2.js'
import { GalaxyIndex } from '../src/engine/worldgen/index-galaxy.js'
import { routeTo } from '../src/engine/travel/travel.js'

export function apply(state: Campaign, action: CampaignAction): Campaign {
  const lock = actionLock(state, action)
  if (lock) throw new Error(`${action.type}: ${lock} on day ${state.day}`)
  return reduceCampaign(state, action)
}
export function visit(state: Campaign, target: string): Campaign {
  const index = new GalaxyIndex(state.galaxy)
  for (let guard = 0; state.at !== target && guard < 1000; guard++) {
    const path = routeTo(index, state.at, target)!.path
    const next = path[1]!
    if (state.fuel < travelCost(state, next)!) {
      if (!actionLock(state, { type: 'emergency-fuel' })) { state = apply(state, { type: 'emergency-fuel' }); continue }
      const affordable = state.galaxy.adjacency[state.at]!.find((id) => !actionLock(state, { type: 'travel', systemId: id }))!
      state = apply(state, { type: 'travel', systemId: affordable })
    } else state = apply(state, { type: 'travel', systemId: next })
  }
  if (state.at !== target) throw new Error('Navigation did not converge')
  return state
}
export function runReturnVoyage(seed: string, route: 'exploration' | 'archives' = 'exploration', missedPerKind = 0) {
  let state = createCampaign(seed)
  const station = locationsAt(state.world, state.at).find((s) => s.kind === 'station')!
  const courier = state.world.locations.find((s) => s.name === 'The Silent Courier')!
  const step = (action: CampaignAction) => { state = apply(state, action) }
  const workUntil = (predicate: () => boolean) => {
    state = visit(state, station.systemId)
    if (state.exploration.statuses[station.id] === 'detected') step({ type: 'investigate', locationId: station.id })
    for (let guard = 0; !predicate() && guard < 100; guard++) step({ type: 'service', locationId: station.id, service: 'contract' })
    if (!predicate()) throw new Error('Campaign progression stalled')
  }
  step({ type: 'research', project: 'drive-diagnostics' })
  step({ type: 'queue', project: 'exotic-storage' })
  step({ type: 'queue', project: 'spatial-dynamics' })
  step({ type: 'queue', project: 'prototype-drive' })
  step({ type: 'scan', tier: 'survey' })
  step({ type: 'investigate', locationId: courier.id })
  step({ type: 'recover', locationId: courier.id, approach: 'careful' })
  if (route === 'archives') {
    step({ type: 'research', project: 'trade-language' })
    workUntil(() => hasTech(state, 'trade-language'))
    step({ type: 'research', project: 'contextual-translation' })
    workUntil(() => hasTech(state, 'contextual-translation'))
    step({ type: 'archive', locationId: station.id, kind: 'spatial-observation' })
    const second = state.world.locations.filter((s) => s.kind === 'station' && s.systemId !== station.systemId)
      .sort((a, b) => new GalaxyIndex(state.galaxy).jumps(state.at, a.systemId) - new GalaxyIndex(state.galaxy).jumps(state.at, b.systemId))[0]!
    state = visit(state, second.systemId)
    step({ type: 'investigate', locationId: second.id })
    step({ type: 'archive', locationId: second.id, kind: 'alien-propulsion' })
    if (!hasTech(state, 'exotic-storage')) step({ type: 'research', project: 'exotic-storage' })
  } else {
    const skip = new Set(['spatial-observation', 'alien-propulsion'].flatMap((kind) => state.world.locations.filter((s) => s.discovery === kind).slice(0, missedPerKind).map((s) => s.id)))
    for (let count = 0; count < 2; count++) {
      const index = new GalaxyIndex(state.galaxy)
      const source = state.world.locations.filter((s) => ['spatial-observation', 'alien-propulsion'].includes(s.discovery ?? '') && !state.exploration.claimed.includes(s.id) && !skip.has(s.id))
        .sort((a, b) => index.jumps(state.at, a.systemId) - index.jumps(state.at, b.systemId))[0]!
      state = visit(state, source.systemId)
      if (!state.scans[state.at]) step({ type: 'scan', tier: 'survey' })
      step({ type: 'investigate', locationId: source.id })
      step({ type: 'recover', locationId: source.id, approach: 'careful' })
    }
  }
  workUntil(() => hasTech(state, 'prototype-drive') && state.exploration.materials >= 25 && state.exploration.credits >= 50)
  step({ type: 'build', blueprint: 'prototype-drive' })
  const beforeTest = state
  step({ type: 'queue', project: 'drive-stabilisation' })
  step({ type: 'begin-drive-test' })
  const duringTest = state
  step({ type: 'complete-drive-test', approach: 'remote' })
  const afterTest = state
  workUntil(() => hasTech(state, 'drive-stabilisation') && state.exploration.materials >= 60 && state.exploration.credits >= 150)
  step({ type: 'build', blueprint: 'return-drive' })
  // Construction does not end the game, and departure works away from the build site.
  const target = state.galaxy.adjacency[state.at]![0]!
  state = visit(state, target)
  const beforeReturn = state
  step({ type: 'return-home' })
  return { state, beforeTest, duringTest, afterTest, beforeReturn }
}
if (process.argv[1]?.endsWith('exploration-walkthrough.ts')) {
  const count = Math.min(100, Math.max(1, Number(process.argv[2]) || 20))
  const records = Array.from({ length: count }, (_, i) => {
    const route = i % 2 ? 'archives' : 'exploration'
    const { state } = runReturnVoyage(`return-sweep-${i}`, route, i % 4 === 0 ? 2 : 0)
    return { seed: state.seed, route, day: state.day, systems: state.visited.length, projects: state.research.completed.length, outcome: state.outcome }
  })
  console.log(JSON.stringify({ campaigns: records.length, allReturned: records.every((r) => r.outcome === 'home'), records }, null, 2))
}
