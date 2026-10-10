import { createRng } from '../rng/prng.js'
import { laneCost } from '../travel/travel.js'
import { generateGalaxy } from '../worldgen/galaxy.js'
import { GalaxyIndex } from '../worldgen/index-galaxy.js'
import type { Galaxy, SystemId } from '../worldgen/types.js'
import { generateExplorationWorld, initialExplorationState, reduceExploration } from './v2.js'
import type { DiscoveryKind, ExplorationLocation, ExplorationState, ExplorationWorld, ScanTier } from './v2.js'
import { PROJECTS, PROJECT_IDS, SLOT_LIMITS, blueprintFor, buildName } from './research.js'
import type { BuildId, ProjectId } from './research.js'
import type { Campaign as LegacyCampaign, CampaignAction as LegacyAction } from './legacy-campaign.js'

export interface Finding { locationId: string; kind: DiscoveryKind; day: number; systemId?: string; sourceName?: string }
export interface Campaign {
  ruleset: 'exploration-v2'
  seed: string; galaxy: Galaxy; world: ExplorationWorld; at: SystemId; visited: SystemId[]
  scans: Record<SystemId, ScanTier>; exploration: ExplorationState; findings: Finding[]
  day: number; fuel: number; hull: number
  research: { active: ProjectId | null; progress: Partial<Record<ProjectId, number>>; completed: ProjectId[]; queue: ProjectId[] }
  built: BuildId[]; equipped: BuildId[]; deepArray: boolean
  driveTest: 'idle' | 'calibrating' | 'complete'
  outcome: 'exploring' | 'home'
  /** Version-1 prefix is replayed with the frozen preview reducer before migration. */
  legacyActions: LegacyAction[] | null
  actions: CampaignAction[]; log: string[]
}
export type CampaignAction =
  | { type: 'travel'; systemId: SystemId }
  | { type: 'scan'; tier: 'survey' | 'deep' }
  | { type: 'investigate'; locationId: string }
  | { type: 'recover'; locationId: string; approach: 'careful' | 'rapid' }
  | { type: 'service'; locationId: string; service: 'refuel' | 'repair' | 'sell' | 'buy' | 'contract' }
  | { type: 'archive'; locationId: string; kind: DiscoveryKind }
  | { type: 'emergency-fuel' } | { type: 'recycle-fuel' }
  | { type: 'research' | 'queue' | 'unqueue'; project: ProjectId }
  | { type: 'move-queue'; project: ProjectId; direction: -1 | 1 }
  | { type: 'pause-research' }
  | { type: 'install-array' }
  | { type: 'build' | 'equip' | 'unequip'; blueprint: BuildId }
  | { type: 'begin-drive-test' } | { type: 'abort-drive-test' }
  | { type: 'complete-drive-test'; approach: 'remote' | 'shielded' }
  | { type: 'return-home' }

export function createCampaign(seed: string): Campaign {
  const galaxy = generateGalaxy(createRng(seed)); galaxy.seed = seed
  const generated = generateExplorationWorld(seed, galaxy)
  // All mandatory scientific sources are reachable with baseline survey instruments.
  // The unchanged generator is retained for exact replay of earlier preview saves.
  const world = { ...generated, locations: generated.locations.map((site) => ({ ...site,
    scanTier: site.discovery && site.scanTier === 'deep' ? 'survey' as const : site.scanTier,
    reward: site.reward ?? (site.kind === 'station' ? undefined : {
      materials: site.kind === 'ruins' ? 10 : site.kind === 'world' ? 6 : site.kind === 'anomaly' ? 2 : 4,
      credits: site.kind === 'anomaly' ? 30 : site.kind === 'signal' || site.kind === 'ruins' ? 25 : 20,
    }),
  })) }
  const exploration = reduceExploration(initialExplorationState(), world,
    { type: 'scan', systemId: galaxy.start, tier: 'passive' }, galaxy.start)
  return { ruleset: 'exploration-v2', seed, galaxy, world, at: galaxy.start, visited: [galaxy.start],
    scans: {}, exploration, findings: [], day: 0, fuel: 80, hull: 100,
    research: { active: null, progress: {}, completed: [], queue: [] },
    built: [], equipped: [], deepArray: false, driveTest: 'idle', outcome: 'exploring',
    legacyActions: null, actions: [],
    log: ['Morozova: “The way home is something we can build. Start Drive Diagnostics while we investigate the Silent Courier.”'] }
}
export function migratePreview(old: LegacyCampaign): Campaign {
  const fresh = createCampaign(old.seed)
  let exploration = old.exploration
  for (const id of old.visited) {
    exploration = reduceExploration(exploration, fresh.world,
      { type: 'scan', systemId: id, tier: old.scans[id] ?? 'passive' }, id)
  }
  return { ...fresh, at: old.at, visited: old.visited, scans: old.scans, exploration,
    findings: old.findings, day: old.day, fuel: old.fuel, hull: old.hull,
    research: { ...old.research, queue: [] }, deepArray: old.deepArray,
    built: old.deepArray ? ['deep-survey'] : [], equipped: old.deepArray ? ['deep-survey'] : [],
    legacyActions: old.actions, log: [...old.log.slice(-48), 'Research expansion ready. Your voyage, discoveries and completed sensor work have been preserved.'] }
}
export const hasTech = (s: Campaign, id: ProjectId) => s.research.completed.includes(id)
export const fitted = (s: Campaign, id: BuildId) => s.equipped.includes(id)
export const fuelCapacity = (s: Campaign) => fitted(s, 'fuel-tanks') ? 100 : 80
export const hullCapacity = (s: Campaign) => fitted(s, 'composite-hull') ? 120 : 100
export const researchRate = (s: Campaign) => fitted(s, 'automated-lab') ? 1.25 : 1
export const researchProgress = (s: Campaign, id: ProjectId) => s.research.progress[id] ?? 0
export const stationPrice = (s: Campaign) => hasTech(s, 'trade-language') ? 8 : 10
export const salePrice = (s: Campaign) => hasTech(s, 'trade-language') ? 15 : 12
export function recoveryDamage(state: Campaign, site: ExplorationLocation): number {
  return fitted(state, 'countermeasures') && ['ruins', 'derelict'].includes(site.kind) ? 0 : site.threat * 4
}
export const carefulDays = (s: Campaign) => fitted(s, 'recon-drones') ? 1 : 2
export function travelCost(state: Campaign, target: SystemId): number | null {
  const adjacent = state.galaxy.adjacency[state.at] ?? []
  const index = new GalaxyIndex(state.galaxy)
  let base: number
  if (adjacent.includes(target)) base = laneCost(index, state.at, target)
  else {
    if (target === state.at || !index.has(target) || !hasTech(state, 'slipstream')) return null
    const paths = adjacent.filter((mid) => state.galaxy.adjacency[mid]?.includes(target))
    if (!paths.length) return null
    base = Math.ceil(Math.min(...paths.map((mid) => laneCost(index, state.at, mid) + laneCost(index, mid, target))) * 0.75)
  }
  return Math.max(1, Math.ceil(base * (fitted(state, 'fuel-optimisation') ? 0.85 : 1)))
}
export function researchRequirements(state: Campaign, id: ProjectId): string | null {
  const project = PROJECTS[id]
  if (!project || !Object.hasOwn(PROJECTS, id)) return 'Unknown project'
  if (project.future) return project.future
  const missing = project.requires.filter((p) => !hasTech(state, p))
  if (missing.length) return `Requires ${missing.map((p) => PROJECTS[p].name).join(', ')}`
  if (project.discovery === 'any' && !state.findings.length) return 'Requires a recovered scientific discovery'
  if (project.discovery === 'exotic' && !state.findings.some((f) => f.kind === 'exotic-energy')) return 'Requires an exotic-energy discovery'
  if (project.discovery === 'spatial' && new Set(state.findings.filter((f) => f.kind === 'spatial-observation' || f.kind === 'alien-propulsion').map((f) => f.locationId.split(':archive:')[0])).size < 2)
    return 'Requires two independent spatial or propulsion sources (one per station archive)'
  if (id === 'drive-stabilisation' && state.driveTest !== 'complete') return 'Construct and field-test the prototype first'
  return null
}
export function researchLock(state: Campaign, project: ProjectId): string | null {
  if (hasTech(state, project)) return 'Research complete'
  if (state.research.active === project) return 'Already researching'
  return researchRequirements(state, project)
}
export function buildLock(state: Campaign, id: BuildId): string | null {
  const blueprint = blueprintFor(id)
  if (!blueprint) return 'No construction blueprint'
  if (state.built.includes(id)) return 'Already constructed'
  if (!hasTech(state, id === 'return-drive' ? 'drive-stabilisation' : id)) return 'Complete the associated research first'
  if (state.exploration.materials < blueprint.materials || state.exploration.credits < blueprint.credits)
    return `Requires ${blueprint.materials} materials and ${blueprint.credits} credits`
  return null
}
export function equipLock(state: Campaign, id: BuildId): string | null {
  if (!state.built.includes(id)) return 'Construct this upgrade first'
  if (fitted(state, id)) return 'Already fitted'
  const blueprint = blueprintFor(id)
  if (!blueprint) return 'No equipment blueprint'
  if (state.equipped.filter((item) => blueprintFor(item)?.slot === blueprint.slot).length >= SLOT_LIMITS[blueprint.slot])
    return `All ${blueprint.slot} slots are occupied; unfit another module first`
  return null
}
const discoveryKinds: DiscoveryKind[] = ['exotic-energy', 'spatial-observation', 'alien-propulsion']
function contacted(state: Campaign, id: string) {
  return state.world.locations.find((s) => s.id === id && s.kind === 'station' &&
    ['investigated', 'resolved'].includes(state.exploration.statuses[id] ?? ''))
}

/** One validator supplies disabled reasons to the UI and enforces every engine action. */
export function actionLock(state: Campaign, action: CampaignAction): string | null {
  if (!action || typeof action !== 'object') return 'Invalid action'
  if (state.outcome === 'home') return 'This voyage has returned home'
  if (state.driveTest === 'calibrating' && !['complete-drive-test', 'abort-drive-test'].includes(action.type)) return 'Finish or abort the prototype test first'
  switch (action.type) {
    case 'travel': {
      const cost = travelCost(state, action.systemId)
      if (cost === null) return 'Select a connected system, or research Slipstream Navigation for two-lane travel'
      return state.fuel < cost ? `Requires ${cost} fuel` : null
    }
    case 'scan':
      if (!['survey', 'deep'].includes(action.tier)) return 'Unknown scan tier'
      if (action.tier === 'deep' && !state.deepArray) return 'Research and fit the Deep Survey Array first'
      return state.scans[state.at] === 'deep' || state.scans[state.at] === action.tier ? 'Survey complete' : null
    case 'investigate': case 'recover': {
      const site = state.world.locations.find((s) => s.id === action.locationId && s.systemId === state.at)
      if (!site) return 'This location is in another system'
      if (action.type === 'recover' && !['careful', 'rapid'].includes(action.approach)) return 'Unknown recovery approach'
      if (state.exploration.statuses[site.id] !== (action.type === 'investigate' ? 'detected' : 'investigated')) return 'Scan and investigate first, or this expedition is already complete'
      if (action.type === 'recover' && action.approach === 'rapid' && state.hull <= recoveryDamage(state, site)) return 'Hull too weak; use remote investigation'
      return null
    }
    case 'service': {
      const station = contacted(state, action.locationId)
      if (!station || station.systemId !== state.at) return 'Establish contact with a local station first'
      if (!['refuel', 'repair', 'sell', 'buy', 'contract'].includes(action.service)) return 'Unknown station service'
      if (action.service === 'contract') return null
      if (action.service === 'sell') return state.exploration.materials < 4 ? 'Requires 4 materials' : null
      if (action.service === 'buy') return state.exploration.credits < 18 ? 'Requires 18 credits' : null
      if (action.service === 'refuel' && state.fuel >= fuelCapacity(state)) return 'Fuel tanks full'
      if (action.service === 'repair' && state.hull >= hullCapacity(state)) return 'Hull fully repaired'
      if (state.exploration.credits < stationPrice(state)) return `Requires ${stationPrice(state)} credits`
      return action.service === 'repair' && state.exploration.materials < 5 ? 'Requires 5 materials' : null
    }
    case 'archive': {
      const station = contacted(state, action.locationId)
      if (!station) return 'Establish contact with this station first'
      if (!hasTech(state, 'contextual-translation')) return 'Requires Contextual Translation'
      if (station.systemId !== state.at && !hasTech(state, 'relay-network')) return 'Visit this station or research the Diplomatic Relay Network'
      if (!discoveryKinds.includes(action.kind)) return 'Unknown archive subject'
      if (state.findings.some((f) => f.locationId === `${station.id}:archive:${action.kind}`)) return 'This record is already in the archive'
      if (action.kind !== 'exotic-energy' && state.findings.some((f) => f.kind !== 'exotic-energy' && f.locationId.startsWith(`${station.id}:archive:`)))
        return 'This station’s spatial archive is already aboard; seek another independent source'
      return state.exploration.credits < 30 ? 'Requires 30 credits' : null
    }
    case 'emergency-fuel':
      return state.galaxy.adjacency[state.at]!.some((id) => travelCost(state, id)! <= state.fuel) ? 'A jump is still affordable' : null
    case 'recycle-fuel':
      if (!fitted(state, 'fuel-recycling')) return 'Fit an Emergency Fuel Recycler first'
      if (state.fuel >= fuelCapacity(state)) return 'Fuel tanks full'
      return state.exploration.materials < 3 ? 'Requires 3 materials' : null
    case 'research': return researchLock(state, action.project)
    case 'queue':
      if (!PROJECT_IDS.includes(action.project)) return 'Unknown project'
      if (PROJECTS[action.project].future) return PROJECTS[action.project].future!
      if (hasTech(state, action.project) || state.research.active === action.project || state.research.queue.includes(action.project)) return 'Already completed, active or queued'
      return state.research.queue.length >= 3 ? 'Research queue is full (three projects)' : null
    case 'unqueue': return state.research.queue.includes(action.project) ? null : 'Not queued'
    case 'move-queue': {
      const index = state.research.queue.indexOf(action.project)
      return index < 0 || ![-1, 1].includes(action.direction) || index + action.direction < 0 || index + action.direction >= state.research.queue.length ? 'Cannot move this queue entry' : null
    }
    case 'pause-research': return state.research.active ? null : 'No active project'
    case 'install-array': return buildLock(state, 'deep-survey')
    case 'build': return buildLock(state, action.blueprint)
    case 'equip': return equipLock(state, action.blueprint)
    case 'unequip':
      if (!fitted(state, action.blueprint)) return 'Not fitted'
      return ['drive', 'hull'].includes(blueprintFor(action.blueprint)!.slot) ? 'Permanent installation' : null
    case 'begin-drive-test':
      if (!state.built.includes('prototype-drive')) return 'Construct the prototype first'
      if (state.driveTest === 'complete') return 'Prototype already tested'
      return state.scans[state.at] ? null : 'Survey this system before a field test'
    case 'abort-drive-test': return state.driveTest === 'calibrating' ? null : 'No test in progress'
    case 'complete-drive-test':
      if (state.driveTest !== 'calibrating') return 'Begin the prototype test first'
      if (!['remote', 'shielded'].includes(action.approach)) return 'Unknown test approach'
      return action.approach === 'shielded' && state.hull <= 10 ? 'Requires more than 10 hull; use the remote test' : null
    case 'return-home': return state.built.includes('return-drive') ? null : 'Construct the final Return Drive first'
    default: return 'Unknown action'
  }
}

function startQueued(state: Campaign, knowledge = state): Campaign {
  if (state.research.active) return state
  const project = state.research.queue.find((id) => !hasTech(state, id) && !researchRequirements({ ...state, findings: knowledge.findings, driveTest: knowledge.driveTest }, id))
  return project ? { ...state, research: { ...state.research, active: project, queue: state.research.queue.filter((id) => id !== project) } } : state
}
function advanceResearch(state: Campaign, work: number, knowledge: Campaign): { state: Campaign; messages: string[] } {
  const messages: string[] = []
  let next = startQueued(state, knowledge)
  while (work > 0 && next.research.active) {
    const id = next.research.active
    const take = Math.min(work, PROJECTS[id].days - researchProgress(next, id))
    const progress = researchProgress(next, id) + take
    work -= take
    const complete = progress >= PROJECTS[id].days
    next = { ...next, research: { ...next.research, active: complete ? null : id,
      progress: { ...next.research.progress, [id]: progress },
      completed: complete ? [...next.research.completed, id] : next.research.completed } }
    if (complete) { messages.push(`Research complete: ${PROJECTS[id].name}.`); next = startQueued(next, knowledge) }
  }
  return { state: startQueued(next), messages }
}
function fitUpgrade(state: Campaign, id: BuildId): Campaign {
  if (equipLock(state, id)) return state
  return { ...state, equipped: [...state.equipped, id], hull: state.hull + (id === 'composite-hull' ? 20 : 0) }
}

export function reduceCampaign(state: Campaign, action: CampaignAction): Campaign {
  if (actionLock(state, action)) return state
  let next: Campaign = { ...state, exploration: { ...state.exploration }, actions: [...state.actions, action] }
  let days = 0, message = ''
  switch (action.type) {
    case 'travel': {
      const system = state.galaxy.systems.find((s) => s.id === action.systemId)!
      next.at = system.id; next.fuel -= travelCost(state, system.id)!; days = 1
      next.visited = state.visited.includes(system.id) ? state.visited : [...state.visited, system.id]
      next.exploration = reduceExploration(next.exploration, state.world, { type: 'scan', systemId: next.at, tier: 'passive' }, next.at)
      message = `Arrived at ${system.name}. Passive sensors have catalogued the obvious contacts.`
      break
    }
    case 'scan': {
      const before = Object.keys(state.exploration.statuses).length
      next.exploration = reduceExploration(state.exploration, state.world, { type: 'scan', tier: action.tier, systemId: state.at }, state.at)
      next.scans = { ...state.scans, [state.at]: action.tier }; days = 1
      const index = new GalaxyIndex(state.galaxy)
      const reach = action.tier === 'deep' ? 2 : hasTech(state, 'triangulation') ? 1 : 0
      for (const system of state.galaxy.systems) if (system.id !== state.at && index.jumps(state.at, system.id) <= reach)
        next.exploration = reduceExploration(next.exploration, state.world, { type: 'scan', tier: action.tier === 'deep' ? 'survey' : 'passive', systemId: system.id }, system.id)
      const count = Object.keys(next.exploration.statuses).length - before
      message = `${action.tier === 'deep' ? 'Deep scan' : 'System survey'} complete: ${count} new ${count === 1 ? 'contact' : 'contacts'}${reach ? ` within ${reach} jump lanes` : ''}.`
      break
    }
    case 'investigate': {
      const site = state.world.locations.find((s) => s.id === action.locationId)!
      next.exploration = reduceExploration(state.exploration, state.world, action, state.at); days = 1
      message = site.kind === 'station' ? `Docking permission received from ${site.name}. Services remain available on return.` : `Investigation of ${site.name} complete. Choose an approach or return later.`
      break
    }
    case 'recover': {
      const site = state.world.locations.find((s) => s.id === action.locationId)!
      next.exploration = reduceExploration(state.exploration, state.world, { type: 'resolve', locationId: site.id }, state.at)
      days = action.approach === 'careful' ? carefulDays(state) : 1
      const damage = action.approach === 'rapid' ? recoveryDamage(state, site) : 0
      const bonus = action.approach === 'rapid' && fitted(state, 'field-engineering') && ['ruins', 'derelict'].includes(site.kind) ? 4 : 0
      next.exploration = { ...next.exploration, materials: next.exploration.materials + bonus }; next.hull -= damage
      if (site.discovery) next.findings = [...state.findings, { locationId: site.id, kind: site.discovery, day: state.day + days }]
      message = `Expedition complete: ${site.name}. Recovered ${(site.reward?.materials ?? 0) + bonus} materials and ${site.reward?.credits ?? 0} credits. ${site.discovery ? 'Scientific discovery archived. ' : ''}${damage ? `Hull damage: −${damage}.` : 'Everyone returned safely.'}`
      break
    }
    case 'service': {
      days = action.service === 'contract' ? 3 : 1
      if (action.service === 'contract') {
        next.exploration.materials += 8; next.exploration.credits += 18
        message = 'Station survey contract completed: 8 materials and 18 credits. The exchange has further work available.'
      } else if (action.service === 'sell') {
        next.exploration.materials -= 4; next.exploration.credits += salePrice(state)
        message = `Sold 4 materials for ${salePrice(state)} credits.`
      } else if (action.service === 'buy') {
        next.exploration.materials += 4; next.exploration.credits -= 18
        message = 'Bought 4 materials for 18 credits.'
      } else {
        next.exploration.credits -= stationPrice(state)
        if (action.service === 'refuel') {
          next.fuel = Math.min(fuelCapacity(state), state.fuel + 20)
          message = `Station tender supplied ${next.fuel - state.fuel} fuel for ${stationPrice(state)} credits.`
        } else {
          next.exploration.materials -= 5; next.hull = Math.min(hullCapacity(state), state.hull + 20)
          message = `Yard repairs restored ${next.hull - state.hull} hull.`
        }
      }
      break
    }
    case 'archive': {
      const station = contacted(state, action.locationId)!
      next.exploration.credits -= 30; days = 1
      next.findings = [...state.findings, { locationId: `${station.id}:archive:${action.kind}`, kind: action.kind,
        day: state.day + 1, sourceName: `${station.name} · scientific archive`, systemId: station.systemId }]
      message = `Acquired ${action.kind.replaceAll('-', ' ')} records from ${station.name}. A new independent scientific source is aboard.`
      break
    }
    case 'emergency-fuel': {
      const longest = Math.max(...state.galaxy.adjacency[state.at]!.map((id) => travelCost(state, id)!))
      next.fuel = Math.min(fuelCapacity(state), Math.max(10, longest)); days = 3
      message = 'Three days collecting trace hydrogen. The ship can reach a neighbouring system again.'
      break
    }
    case 'recycle-fuel':
      next.exploration.materials -= 3; next.fuel = Math.min(fuelCapacity(state), state.fuel + 15); days = 1
      message = `Recycled 3 materials into ${next.fuel - state.fuel} fuel.`; break
    case 'research':
      next.research = { ...state.research, active: action.project, queue: state.research.queue.filter((id) => id !== action.project) }
      message = `Laboratory assigned to ${PROJECTS[action.project].name}. Previous work is preserved.`; break
    case 'queue':
      next.research = { ...state.research, queue: [...state.research.queue, action.project] }
      message = `Queued ${PROJECTS[action.project].name}. Blocked projects wait for their prerequisites.`; break
    case 'unqueue':
      next.research = { ...state.research, queue: state.research.queue.filter((id) => id !== action.project) }
      message = `Removed ${PROJECTS[action.project].name} from the queue. Work is preserved.`; break
    case 'move-queue': {
      const queue = [...state.research.queue], index = queue.indexOf(action.project), target = index + action.direction
      ;[queue[index], queue[target]] = [queue[target]!, queue[index]!]
      next.research = { ...state.research, queue }; message = 'Research queue reordered.'; break
    }
    case 'pause-research':
      next.research = { ...state.research, active: null }; message = 'Active research paused. All work is preserved.'; break
    case 'install-array': case 'build': {
      const id = action.type === 'install-array' ? 'deep-survey' : action.blueprint
      const cost = blueprintFor(id)!
      next.exploration.materials -= cost.materials; next.exploration.credits -= cost.credits
      next.built = [...state.built, id]; next = fitUpgrade(next, id); days = 1
      message = `${buildName(id)} constructed.${fitted(next, id) ? ' Fitted and ready.' : ' Stored aboard; free a slot to fit it.'}`; break
    }
    case 'equip': next = fitUpgrade(next, action.blueprint); message = `${buildName(action.blueprint)} fitted.`; break
    case 'unequip':
      next.equipped = state.equipped.filter((id) => id !== action.blueprint)
      next.fuel = Math.min(next.fuel, fuelCapacity(next))
      message = `${buildName(action.blueprint)} stored aboard. No materials lost.${next.fuel < state.fuel ? ' Fuel beyond standard tank capacity was vented.' : ''}`; break
    case 'begin-drive-test':
      next.driveTest = 'calibrating'; message = 'Morozova: “The prototype is holding a field. We can map it with remote probes, or make a shorter shielded pass. Your decision, Captain.”'; break
    case 'abort-drive-test': next.driveTest = 'idle'; message = 'Prototype powered down safely. We can test it again in any surveyed system.'; break
    case 'complete-drive-test':
      next.driveTest = 'complete'; days = action.approach === 'remote' ? 2 : 1
      if (action.approach === 'shielded') next.hull -= 10
      message = 'The probe returns with matching timestamps. For the first time, the crew sees a route home. Prototype test complete; Drive Stabilisation is now possible.'; break
    case 'return-home':
      next.outcome = 'home'; message = 'The stars settle into familiar positions. The Ithaca has returned home.'; break
  }
  next.day += days
  if (days) {
    const advanced = advanceResearch(next, days * researchRate(state), state); next = advanced.state
    if (advanced.messages.length) message += ` ${advanced.messages.join(' ')}`
  } else if (action.type !== 'pause-research') next = startQueued(next)
  next.deepArray = fitted(next, 'deep-survey')
  return { ...next, log: [...state.log.slice(-49), `Day ${next.day} · ${message}`] }
}
