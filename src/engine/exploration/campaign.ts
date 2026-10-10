import { createRng } from '../rng/prng.js'
import { laneCost } from '../travel/travel.js'
import { generateGalaxy } from '../worldgen/galaxy.js'
import { GalaxyIndex } from '../worldgen/index-galaxy.js'
import type { Galaxy, SystemId } from '../worldgen/types.js'
import {
  generateExplorationWorld, initialExplorationState, locationsAt, reduceExploration,
} from './v2.js'
import type { DiscoveryKind, ExplorationState, ExplorationWorld, ScanTier } from './v2.js'

/** Small, playable ruleset boundary. Never reads or mutates a legacy voyage. */
export type SensorProject = 'spectrometry' | 'deep-survey'
export const SENSOR_PROJECTS: Record<SensorProject, { name: string; days: number; effect: string }> = {
  spectrometry: { name: 'Planetary Spectrometry', days: 4,
    effect: 'Identify scientific signatures at detected sites before investigating.' },
  'deep-survey': { name: 'Deep Survey Array', days: 8,
    effect: 'Unlock an array refit that reveals buried ruins and faint anomalies.' },
}
export interface Finding { locationId: string; kind: DiscoveryKind; day: number }
export interface Campaign {
  ruleset: 'exploration-v2'
  seed: string
  galaxy: Galaxy
  world: ExplorationWorld
  at: SystemId
  visited: SystemId[]
  scans: Record<SystemId, ScanTier>
  exploration: ExplorationState
  findings: Finding[]
  day: number
  fuel: number
  hull: number
  research: { active: SensorProject | null; progress: Record<SensorProject, number>; completed: SensorProject[] }
  deepArray: boolean
  actions: CampaignAction[]
  log: string[]
}
export type CampaignAction =
  | { type: 'travel'; systemId: SystemId }
  | { type: 'scan'; tier: 'survey' | 'deep' }
  | { type: 'investigate'; locationId: string }
  | { type: 'recover'; locationId: string; approach: 'careful' | 'rapid' }
  | { type: 'service'; locationId: string; service: 'refuel' | 'repair' | 'sell' }
  | { type: 'emergency-fuel' }
  | { type: 'research'; project: SensorProject }
  | { type: 'install-array' }

export function createCampaign(seed: string): Campaign {
  const galaxy = generateGalaxy(createRng(seed))
  galaxy.seed = seed
  const world = generateExplorationWorld(seed, galaxy)
  const exploration = reduceExploration(initialExplorationState(), world,
    { type: 'scan', systemId: galaxy.start, tier: 'passive' }, galaxy.start)
  return {
    ruleset: 'exploration-v2', seed, galaxy, world, at: galaxy.start, visited: [galaxy.start],
    scans: {}, exploration, findings: [], day: 0, fuel: 80, hull: 100,
    research: { active: null, progress: { spectrometry: 0, 'deep-survey': 0 }, completed: [] },
    deepArray: false, actions: [],
    log: ['Morozova: “A courier is drifting nearby. Survey the system; its power cell may teach us how to read this sky.”'],
  }
}
export function travelCost(state: Campaign, target: SystemId): number | null {
  if (!state.galaxy.adjacency[state.at]?.includes(target)) return null
  return laneCost(new GalaxyIndex(state.galaxy), state.at, target)
}
export function researchLock(state: Campaign, project: SensorProject): string | null {
  if (state.research.completed.includes(project)) return 'Research complete'
  if (state.research.active === project) return 'Already researching'
  if (project === 'deep-survey') {
    if (!state.research.completed.includes('spectrometry')) return 'Requires Planetary Spectrometry'
    if (state.findings.length === 0) return 'Requires a recovered scientific discovery'
  }
  return null
}

/** One validator supplies both visible disabled reasons and reducer enforcement. */
export function actionLock(state: Campaign, action: CampaignAction): string | null {
  switch (action.type) {
    case 'travel': {
      const cost = travelCost(state, action.systemId)
      if (cost === null) return 'Select a system connected by one jump lane'
      return state.fuel < cost ? `Requires ${cost} fuel` : null
    }
    case 'scan':
      if (action.tier !== 'survey' && action.tier !== 'deep') return 'Unknown scan tier'
      if (action.tier === 'deep' && !state.deepArray) return 'Research and install the Deep Survey Array first'
      return state.scans[state.at] === 'deep' || state.scans[state.at] === action.tier ? 'Survey complete' : null
    case 'investigate':
    case 'recover': {
      const site = state.world.locations.find((location) => location.id === action.locationId && location.systemId === state.at)
      if (!site) return 'This location is in another system'
      if (action.type === 'recover' && !['careful', 'rapid'].includes(action.approach)) return 'Unknown recovery approach'
      if (state.exploration.statuses[site.id] !== (action.type === 'investigate' ? 'detected' : 'investigated'))
        return 'Scan and investigate this location first, or its expedition is already complete'
      if (action.type === 'recover' && action.approach === 'rapid' && state.hull <= site.threat * 4)
        return 'Hull too weak for a rapid expedition; use remote investigation'
      return null
    }
    case 'service': {
      const station = locationsAt(state.world, state.at).find((site) => site.id === action.locationId)
      if (!station || !['investigated', 'resolved'].includes(state.exploration.statuses[station.id] ?? ''))
        return 'Establish contact with this station first'
      const required = action.service === 'sell' ? 'trade' : action.service
      if (!station.services.includes(required)) return 'Service unavailable here'
      if (action.service === 'sell') return state.exploration.materials < 4 ? 'Requires 4 materials' : null
      if (action.service === 'refuel' && state.fuel === 80) return 'Fuel tanks full'
      if (action.service === 'repair' && state.hull === 100) return 'Hull fully repaired'
      if (state.exploration.credits < 10) return 'Requires 10 credits'
      return action.service === 'repair' && state.exploration.materials < 5 ? 'Requires 5 materials' : null
    }
    case 'emergency-fuel': {
      const costs = (state.galaxy.adjacency[state.at] ?? []).map((id) => travelCost(state, id)!)
      return costs.some((cost) => cost <= state.fuel) ? 'A jump is still affordable' : null
    }
    case 'research':
      return Object.hasOwn(SENSOR_PROJECTS, action.project) ? researchLock(state, action.project) : 'Unknown project'
    case 'install-array':
      if (state.deepArray) return 'Array already installed'
      if (!state.research.completed.includes('deep-survey')) return 'Complete Deep Survey Array research first'
      return state.exploration.materials < 20 || state.exploration.credits < 65 ? 'Requires 20 materials and 65 credits' : null
    default: return 'Unknown action'
  }
}

/** Immutable deterministic action journal; invalid actions cannot spend time or resources. */
export function reduceCampaign(state: Campaign, action: CampaignAction): Campaign {
  if (actionLock(state, action)) return state
  let next: Campaign = { ...state, exploration: { ...state.exploration }, actions: [...state.actions, action] }
  let days = 0
  let message = ''
  switch (action.type) {
    case 'travel': {
      const system = state.galaxy.systems.find((s) => s.id === action.systemId)!
      next.at = system.id
      next.fuel -= travelCost(state, system.id)!
      next.visited = state.visited.includes(system.id) ? state.visited : [...state.visited, system.id]
      next.exploration = reduceExploration(next.exploration, state.world,
        { type: 'scan', systemId: next.at, tier: 'passive' }, next.at)
      days = 1
      message = `Arrived at ${system.name}. Passive sensors have catalogued the obvious contacts.`
      break
    }
    case 'scan': {
      next.exploration = reduceExploration(state.exploration, state.world,
        { type: 'scan', tier: action.tier, systemId: state.at }, state.at)
      next.scans = { ...state.scans, [state.at]: action.tier }
      days = 1
      const count = Object.keys(next.exploration.statuses).length - Object.keys(state.exploration.statuses).length
      message = `${action.tier === 'deep' ? 'Deep scan' : 'System survey'} complete: ${count} new ${count === 1 ? 'contact' : 'contacts'}.`
      break
    }
    case 'investigate': {
      const site = state.world.locations.find((s) => s.id === action.locationId)!
      next.exploration = reduceExploration(state.exploration, state.world, action, state.at)
      days = 1
      message = site.kind === 'station' ? `Docking permission received from ${site.name}. Services remain available on return.`
        : `Investigation of ${site.name} complete. Choose an expedition approach or leave it for later.`
      break
    }
    case 'recover': {
      const site = state.world.locations.find((s) => s.id === action.locationId)!
      next.exploration = reduceExploration(state.exploration, state.world,
        { type: 'resolve', locationId: site.id }, state.at)
      days = action.approach === 'careful' ? 2 : 1
      const damage = action.approach === 'rapid' ? site.threat * 4 : 0
      next.hull -= damage
      if (site.discovery) next.findings = [...state.findings, { locationId: site.id, kind: site.discovery, day: state.day + days }]
      message = `Expedition complete: ${site.name}. ${site.reward ? `Recovered ${site.reward.materials} materials and ${site.reward.credits} credits. ` : ''}${site.discovery ? 'Scientific discovery archived. ' : ''}${damage ? `Shuttle retrieval damaged the hull: −${damage}.` : 'Everyone returned safely.'}`
      break
    }
    case 'service':
      days = 1
      if (action.service === 'sell') {
        next.exploration.materials -= 4
        next.exploration.credits += 12
        message = 'Station exchange: sold 4 materials for 12 credits.'
      } else {
        next.exploration.credits -= 10
        if (action.service === 'refuel') {
          next.fuel = Math.min(80, state.fuel + 20)
          message = `Station tender supplied ${next.fuel - state.fuel} fuel for 10 credits.`
        } else {
          next.exploration.materials -= 5
          next.hull = Math.min(100, state.hull + 20)
          message = `Yard repairs restored ${next.hull - state.hull} hull.`
        }
      }
      break
    case 'emergency-fuel': {
      // Slow stellar-hydrogen collection always restores at least one legal jump.
      // Available only when stranded; no credits or materials are required.
      const cheapest = Math.min(...state.galaxy.adjacency[state.at]!.map((id) => travelCost(state, id)!))
      next.fuel = Math.min(80, Math.max(10, cheapest))
      days = 3
      message = 'Three days collecting trace hydrogen. The ship can reach a neighbouring system again.'
      break
    }
    case 'research':
      next.research = { ...state.research, active: action.project }
      message = `Laboratory assigned to ${SENSOR_PROJECTS[action.project].name}. Previous work is preserved.`
      break
    case 'install-array':
      next.deepArray = true
      next.exploration.materials -= 20
      next.exploration.credits -= 65
      days = 1
      message = 'Deep Survey Array installed. Faint anomalies and buried installations are now within reach.'
      break
  }
  next.day += days
  if (days && next.research.active) {
    const id = next.research.active
    const progress = Math.min(SENSOR_PROJECTS[id].days, next.research.progress[id] + days)
    const complete = progress === SENSOR_PROJECTS[id].days
    next.research = { active: complete ? null : id,
      progress: { ...next.research.progress, [id]: progress },
      completed: complete ? [...next.research.completed, id] : next.research.completed }
    if (complete) message += ` Research complete: ${SENSOR_PROJECTS[id].name}.`
  }
  next = { ...next, log: [...state.log.slice(-49), `Day ${next.day} · ${message}`] }
  return next
}
