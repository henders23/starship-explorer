import { createRng } from '../rng/prng.js'
import type { Galaxy, RegionId, StarSystem, SystemId } from '../worldgen/types.js'

/** Isolated v2 foundation: no dependency on the v1 evidence/mystery. */
export type LocationKind =
  | 'station' | 'world' | 'ruins' | 'derelict' | 'resource-field'
  | 'anomaly' | 'outpost' | 'signal'

export type EncounterKind =
  | 'exploration' | 'ruins' | 'salvage' | 'hub' | 'alien-contact'
  | 'hostile' | 'distress'

export type DiscoveryKind = 'exotic-energy' | 'spatial-observation' | 'alien-propulsion'
export type ScanTier = 'passive' | 'survey' | 'deep'
export type LocationStatus = 'undetected' | 'detected' | 'investigated' | 'resolved'
export type ServiceKind = 'trade' | 'refuel' | 'repair' | 'recruit'

export interface ExplorationLocation {
  id: string
  systemId: SystemId
  kind: LocationKind
  encounter: EncounterKind
  name: string
  scanTier: ScanTier
  threat: 0 | 1 | 2 | 3
  discovery?: DiscoveryKind
  services: ServiceKind[]
  /** One-time reward: never paid again after resolution. */
  reward?: { materials: number; credits: number }
}

export interface ExplorationWorld {
  seed: string
  locations: ExplorationLocation[]
}

export interface ExplorationState {
  /** One record per known location. Absence means undetected. */
  statuses: Record<string, Exclude<LocationStatus, 'undetected'>>
  claimed: string[]
  discoveries: DiscoveryKind[]
  materials: number
  credits: number
}

export type ExplorationAction =
  | { type: 'scan'; systemId: SystemId; tier: ScanTier }
  | { type: 'investigate'; locationId: string }
  | { type: 'resolve'; locationId: string }

const REGIONAL_THREAT: Record<RegionId, 0 | 1 | 2 | 3> = {
  shallows: 0, 'trade-reach': 1, 'cinder-belt': 2, xenoline: 2, 'rift-margin': 3,
}
const TIER_ORDER: Record<ScanTier, number> = { passive: 0, survey: 1, deep: 2 }

export function initialExplorationState(): ExplorationState {
  return { statuses: {}, claimed: [], discoveries: [], materials: 20, credits: 80 }
}

export function locationsAt(world: ExplorationWorld, systemId: SystemId): ExplorationLocation[] {
  return world.locations.filter((location) => location.systemId === systemId)
}

function makeLocation(
  system: StarSystem,
  localIndex: number,
  kind: LocationKind,
  scanTier: ScanTier,
  discovery?: DiscoveryKind,
): ExplorationLocation {
  const encounterByKind: Record<LocationKind, EncounterKind> = {
    station: 'hub', world: 'exploration', ruins: 'ruins', derelict: 'salvage',
    'resource-field': 'salvage', anomaly: 'exploration', outpost: 'alien-contact',
    signal: 'distress',
  }
  const services: ServiceKind[] = kind === 'station' ? ['trade', 'refuel', 'repair', 'recruit'] : []
  return {
    id: `${system.id}:loc-${localIndex}`,
    systemId: system.id,
    kind,
    encounter: encounterByKind[kind],
    name: `${system.name} · ${kind.replace('-', ' ')} ${localIndex + 1}`,
    scanTier,
    threat: REGIONAL_THREAT[system.region],
    ...(discovery ? { discovery } : {}),
    services,
    reward: kind === 'resource-field' ? { materials: 8, credits: 0 }
      : kind === 'derelict' ? { materials: 6, credits: 10 } : undefined,
  }
}

/** Stable by system ID: additions to other systems never shuffle these locations. */
export function generateExplorationWorld(seed: string, galaxy: Galaxy): ExplorationWorld {
  const locations: ExplorationLocation[] = []
  for (const system of galaxy.systems) {
    const rng = createRng(`${seed}:exploration-v2:${system.id}`)
    const kinds: LocationKind[] = []
    if (system.faction || system.id === galaxy.start) kinds.push('station')
    if (system.features.includes('habitable-world')) kinds.push('world')
    if (system.features.includes('ruins')) kinds.push('ruins')
    if (system.features.includes('derelict-beacon')) kinds.push('derelict')
    if (system.features.includes('asteroid-belt')) kinds.push('resource-field')
    if (system.features.includes('rift-echo') || system.features.includes('pulsar')) kinds.push('anomaly')
    if (kinds.length === 0 && rng.chance(0.65)) kinds.push('signal')
    if (kinds.length > 0 && rng.chance(0.2)) kinds.push('outpost')
    kinds.forEach((kind, i) =>
      locations.push(makeLocation(system, i, kind, kind === 'station' || kind === 'world' ? 'passive'
        : kind === 'ruins' || kind === 'anomaly' ? 'deep' : 'survey')),
    )
  }

  // Mandatory categories must have independent locations, not one irreplaceable clue.
  // Prefer diverse systems; avoid overriding the starter station or a location already
  // reserved for another prerequisite.
  const sources: DiscoveryKind[] = ['exotic-energy', 'spatial-observation', 'alien-propulsion']
  const allocated = new Set<string>()
  for (const [categoryIndex, kind] of sources.entries()) {
    const candidates = createRng(`${seed}:discoveries:${kind}`).shuffle(
      locations.filter((loc) => loc.kind !== 'station' && !allocated.has(loc.id)),
    )
    const picked: ExplorationLocation[] = []
    const regions = new Set<RegionId>()
    for (const location of candidates) {
      if (picked.some((v) => v.systemId === location.systemId)) continue
      const region = galaxy.systems.find((s) => s.id === location.systemId)?.region
      if (region && !regions.has(region)) {
        picked.push(location)
        regions.add(region)
      }
      if (picked.length >= 3) break
    }
    for (const location of candidates) {
      if (picked.length >= 3) break
      if (!picked.includes(location) && !picked.some((v) => v.systemId === location.systemId)) picked.push(location)
    }
    if (picked.length < 3) {
      throw new Error(`Unable to place three independent sources of ${kind}`)
    }
    for (const location of picked) {
      location.discovery = kind
      allocated.add(location.id)
    }
    void categoryIndex
  }

  // Explicit accessible starting services/resources and early scientific opportunity.
  const start = galaxy.start
  if (!locations.some((loc) => loc.systemId === start && loc.kind === 'station')) {
    const system = galaxy.systems.find((s) => s.id === start)!
    locations.push(makeLocation(system, locationsAt({ seed, locations }, start).length, 'station', 'passive'))
  }
  if (!locations.some((loc) => loc.systemId === start && loc.kind === 'resource-field')) {
    const system = galaxy.systems.find((s) => s.id === start)!
    locations.push(makeLocation(system, locationsAt({ seed, locations }, start).length, 'resource-field', 'survey'))
  }
  return { seed, locations }
}

/** Pure action reducer for the v2 slice. Rejects invisible/invalid actions. */
export function reduceExploration(
  state: ExplorationState, world: ExplorationWorld,
  action: ExplorationAction, currentSystem: SystemId,
): ExplorationState {
  if (action.type === 'scan') {
    if (action.systemId !== currentSystem) return state
    const statuses = { ...state.statuses }
    let changed = false
    for (const loc of locationsAt(world, currentSystem)) {
      if (TIER_ORDER[loc.scanTier] <= TIER_ORDER[action.tier] && !statuses[loc.id]) {
        statuses[loc.id] = 'detected'
        changed = true
      }
    }
    return changed ? { ...state, statuses } : state
  }
  const loc = world.locations.find((item) => item.id === action.locationId)
  if (!loc || loc.systemId !== currentSystem) return state
  const status = state.statuses[loc.id]
  if (action.type === 'investigate') {
    if (status !== 'detected') return state
    return { ...state, statuses: { ...state.statuses, [loc.id]: 'investigated' } }
  }
  if (status !== 'investigated' || state.claimed.includes(loc.id)) return state
  return {
    ...state,
    statuses: { ...state.statuses, [loc.id]: 'resolved' },
    claimed: [...state.claimed, loc.id],
    discoveries: loc.discovery && !state.discoveries.includes(loc.discovery)
      ? [...state.discoveries, loc.discovery] : state.discoveries,
    materials: state.materials + (loc.reward?.materials ?? 0),
    credits: state.credits + (loc.reward?.credits ?? 0),
  }
}
