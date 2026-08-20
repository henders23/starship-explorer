import type { Rng } from '../rng/prng.js'
import { makeNamer } from './names.js'
import type {
  Faction,
  FactionArchetype,
  Galaxy,
  RegionId,
  StarSystem,
  StarType,
  SystemFeature,
  SystemId,
} from './types.js'

export interface GalaxyOptions {
  systemCount: number
  /** Inner and outer edge of the annulus the sector occupies, in light years. */
  innerRadius: number
  outerRadius: number
  /** Half-width of the sector's arc, in radians. */
  arc: number
  /** Minimum separation between systems, in light years. */
  minSeparation: number
  /** Systems further apart than this can never share a jump lane. */
  laneRange: number
  /** Upper bound on lanes per system, before connectivity repair. */
  maxDegree: number
  factionCount: number
}

/**
 * A long, shallow wedge of sky rather than a squat one.
 *
 * The sector runs outward from the core, and that outward run *is* the
 * voyage: the ship arrives at the near edge and the way home is somewhere
 * out at the far one. Making the radial band long and the arc narrow puts
 * that journey along the sector's own long axis, so the chart can draw it
 * across the screen at true scale instead of stretching one axis to fit.
 *
 * The area is held at roughly what it was (arc × (outer² − inner²) ≈ 431k
 * ly²), so ninety systems sit at the same density as before and a lane is
 * the same length it always was. What changes is the shape: the crossing is
 * about sixty per cent longer in jumps, and `laneCost` was eased to match.
 */
export const DEFAULT_GALAXY_OPTIONS: GalaxyOptions = {
  systemCount: 90,
  innerRadius: 350,
  outerRadius: 1350,
  arc: 0.254,
  minSeparation: 44,
  laneRange: 135,
  maxDegree: 4,
  factionCount: 5,
}

/**
 * Region centroids, expressed as a fraction of the radial band and a fraction
 * of the sector's half-arc. Both are relative so that reshaping the sector
 * moves the regions with it rather than throwing them off its edge.
 *
 * The Shallows sit at the near edge (where the ship arrives) and the Rift
 * Margin at the far edge, so "getting home" runs roughly outward.
 */
const REGION_ANCHORS: Array<{ id: RegionId; frac: number; across: number }> = [
  { id: 'shallows', frac: 0.12, across: 0.0 },
  { id: 'trade-reach', frac: 0.42, across: -0.51 },
  { id: 'cinder-belt', frac: 0.48, across: 0.55 },
  { id: 'xenoline', frac: 0.78, across: -0.4 },
  { id: 'rift-margin', frac: 0.88, across: 0.33 },
]

const STAR_WEIGHTS: Record<RegionId, Array<readonly [StarType, number]>> = {
  shallows: [['yellow', 5], ['orange', 4], ['red-dwarf', 6], ['binary', 3], ['blue-giant', 1], ['red-giant', 2], ['white-dwarf', 1], ['neutron', 0.3]],
  'trade-reach': [['yellow', 6], ['orange', 5], ['red-dwarf', 5], ['binary', 4], ['blue-giant', 2], ['red-giant', 2], ['white-dwarf', 1], ['neutron', 0.3]],
  'cinder-belt': [['white-dwarf', 6], ['neutron', 4], ['red-giant', 5], ['red-dwarf', 4], ['binary', 3], ['yellow', 1], ['orange', 1], ['blue-giant', 1]],
  xenoline: [['yellow', 4], ['orange', 4], ['red-dwarf', 4], ['binary', 4], ['blue-giant', 3], ['red-giant', 2], ['white-dwarf', 2], ['neutron', 1]],
  'rift-margin': [['neutron', 4], ['blue-giant', 4], ['white-dwarf', 3], ['binary', 4], ['red-giant', 3], ['red-dwarf', 3], ['yellow', 2], ['orange', 2]],
}

const FEATURE_WEIGHTS: Record<RegionId, Array<readonly [SystemFeature, number]>> = {
  shallows: [['gas-giant', 6], ['asteroid-belt', 5], ['ice-ring', 4], ['habitable-world', 4], ['derelict-beacon', 1], ['ruins', 1], ['nebula-shroud', 1], ['pulsar', 0.5]],
  'trade-reach': [['gas-giant', 6], ['habitable-world', 6], ['asteroid-belt', 5], ['ice-ring', 3], ['ruins', 2], ['derelict-beacon', 2], ['nebula-shroud', 1], ['pulsar', 0.5]],
  'cinder-belt': [['asteroid-belt', 7], ['derelict-beacon', 5], ['gas-giant', 3], ['ruins', 3], ['ice-ring', 2], ['pulsar', 2], ['nebula-shroud', 2], ['habitable-world', 0.5]],
  xenoline: [['habitable-world', 6], ['ruins', 5], ['gas-giant', 4], ['ice-ring', 3], ['asteroid-belt', 3], ['nebula-shroud', 2], ['derelict-beacon', 1], ['pulsar', 1]],
  'rift-margin': [['nebula-shroud', 5], ['pulsar', 4], ['ruins', 4], ['derelict-beacon', 4], ['gas-giant', 3], ['asteroid-belt', 3], ['ice-ring', 2], ['habitable-world', 1]],
}

const ARCHETYPES: FactionArchetype[] = [
  'mercantile-combine',
  'militant-patrol',
  'xenophobic-polity',
  'scavenger-clan',
  'monastic-order',
]

/** Regions each faction archetype prefers to plant its homeworld in. */
const ARCHETYPE_HOME_REGIONS: Record<FactionArchetype, RegionId[]> = {
  'mercantile-combine': ['trade-reach', 'shallows'],
  'militant-patrol': ['trade-reach', 'shallows'],
  'xenophobic-polity': ['xenoline'],
  'scavenger-clan': ['cinder-belt'],
  'monastic-order': ['rift-margin', 'xenoline'],
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function scatterPositions(rng: Rng, opts: GalaxyOptions): Array<{ x: number; y: number }> {
  const placed: Array<{ x: number; y: number }> = []
  const maxAttempts = opts.systemCount * 240

  for (let attempt = 0; attempt < maxAttempts && placed.length < opts.systemCount; attempt++) {
    // Sample uniformly by area within the annulus sector.
    const rr = Math.sqrt(
      rng.float(opts.innerRadius ** 2, opts.outerRadius ** 2),
    )
    const theta = rng.float(-opts.arc, opts.arc)
    const point = { x: rr * Math.cos(theta), y: rr * Math.sin(theta) }

    let tooClose = false
    for (const other of placed) {
      if (distance(point, other) < opts.minSeparation) {
        tooClose = true
        break
      }
    }
    if (!tooClose) placed.push(point)
  }

  return placed
}

function assignRegions(
  rng: Rng,
  points: Array<{ x: number; y: number }>,
  opts: GalaxyOptions,
): { regions: RegionId[]; anchors: Array<{ id: RegionId; x: number; y: number }> } {
  const span = opts.outerRadius - opts.innerRadius
  const anchors = REGION_ANCHORS.map((anchor) => {
    const r = opts.innerRadius + span * Math.min(0.98, Math.max(0.02, anchor.frac + rng.float(-0.05, 0.05)))
    const theta = opts.arc * (anchor.across + rng.float(-0.11, 0.11))
    return { id: anchor.id, x: r * Math.cos(theta), y: r * Math.sin(theta) }
  })

  const regions = points.map((point) => {
    let best = anchors[0]!
    let bestDist = Infinity
    for (const anchor of anchors) {
      const d = distance(point, anchor)
      if (d < bestDist) {
        bestDist = d
        best = anchor
      }
    }
    return best.id
  })

  return { regions, anchors }
}

function buildLanes(
  rng: Rng,
  systems: StarSystem[],
  opts: GalaxyOptions,
): { lanes: Array<[SystemId, SystemId]>; adjacency: Record<SystemId, SystemId[]> } {
  const adjacency: Record<SystemId, SystemId[]> = {}
  for (const s of systems) adjacency[s.id] = []

  const laneSet = new Set<string>()
  const key = (a: SystemId, b: SystemId) => (a < b ? `${a}|${b}` : `${b}|${a}`)

  const link = (a: StarSystem, b: StarSystem): boolean => {
    const k = key(a.id, b.id)
    if (a.id === b.id || laneSet.has(k)) return false
    laneSet.add(k)
    adjacency[a.id]!.push(b.id)
    adjacency[b.id]!.push(a.id)
    return true
  }

  // Every system reaches toward its nearest neighbours, subject to a degree cap
  // so the graph stays sparse and irregular rather than a uniform mesh.
  const neighboursByDistance = systems.map((s) =>
    systems
      .filter((o) => o.id !== s.id && distance(s, o) <= opts.laneRange)
      .sort((a, b) => distance(s, a) - distance(s, b)),
  )

  for (let i = 0; i < systems.length; i++) {
    const system = systems[i]!
    const target = rng.weighted([
      [1, 3],
      [2, 6],
      [3, 4],
      [opts.maxDegree, 2],
    ])
    for (const other of neighboursByDistance[i]!) {
      if (adjacency[system.id]!.length >= target) break
      if (adjacency[other.id]!.length >= opts.maxDegree) continue
      link(system, other)
    }
  }

  // Connectivity repair: merge components by their closest cross-component pair.
  const componentOf = (): Map<SystemId, number> => {
    const comp = new Map<SystemId, number>()
    let next = 0
    for (const system of systems) {
      if (comp.has(system.id)) continue
      const id = next++
      const queue = [system.id]
      comp.set(system.id, id)
      while (queue.length > 0) {
        const current = queue.pop()!
        for (const neighbour of adjacency[current]!) {
          if (!comp.has(neighbour)) {
            comp.set(neighbour, id)
            queue.push(neighbour)
          }
        }
      }
    }
    return comp
  }

  for (let guard = 0; guard < systems.length; guard++) {
    const comp = componentOf()
    const componentCount = new Set(comp.values()).size
    if (componentCount <= 1) break

    // Join component 0 to whichever other component has the closest system.
    let bestPair: [StarSystem, StarSystem] | null = null
    let bestDist = Infinity
    for (const a of systems) {
      if (comp.get(a.id) !== 0) continue
      for (const b of systems) {
        if (comp.get(b.id) === 0) continue
        const d = distance(a, b)
        if (d < bestDist) {
          bestDist = d
          bestPair = [a, b]
        }
      }
    }
    if (!bestPair) break
    link(bestPair[0], bestPair[1])
  }

  // A few long lanes give the map shortcuts and make routing interesting.
  const longLaneCount = Math.max(2, Math.round(systems.length * 0.04))
  for (let i = 0; i < longLaneCount; i++) {
    const a = rng.pick(systems)
    const candidates = systems.filter((o) => {
      const d = distance(a, o)
      return d > opts.laneRange && d <= opts.laneRange * 2.1
    })
    if (candidates.length > 0) link(a, rng.pick(candidates))
  }

  const lanes: Array<[SystemId, SystemId]> = [...laneSet].map((k) => {
    const [a, b] = k.split('|')
    return [a!, b!]
  })

  return { lanes, adjacency }
}

function placeFactions(rng: Rng, systems: StarSystem[], opts: GalaxyOptions): Faction[] {
  const namer = makeNamer(rng.fork('faction-names'))
  const archetypes = rng.sample(ARCHETYPES, opts.factionCount)
  const factions: Faction[] = []
  const taken = new Set<SystemId>()

  for (const archetype of archetypes) {
    const preferred = ARCHETYPE_HOME_REGIONS[archetype]
    const pool = systems.filter((s) => preferred.includes(s.region) && !taken.has(s.id))
    const fallback = systems.filter((s) => !taken.has(s.id))
    const home = rng.pick(pool.length > 0 ? pool : fallback)
    taken.add(home.id)

    const faction: Faction = {
      id: `fac-${factions.length}`,
      name: namer.faction(),
      archetype,
      homeworld: home.id,
    }
    factions.push(faction)

    // Claim nearby systems, thinning out with distance from the homeworld.
    const reach = rng.float(120, 210)
    for (const system of systems) {
      if (system.faction !== null) continue
      const d = distance(home, system)
      if (d > reach) continue
      if (system.id === home.id || rng.chance(1 - d / reach)) {
        system.faction = faction.id
      }
    }
    home.faction = faction.id
    home.landmark = true
  }

  return factions
}

export function generateGalaxy(rng: Rng, options: Partial<GalaxyOptions> = {}): Galaxy {
  const opts = { ...DEFAULT_GALAXY_OPTIONS, ...options }
  const namer = makeNamer(rng.fork('system-names'))

  const points = scatterPositions(rng, opts)
  const { regions, anchors } = assignRegions(rng, points, opts)

  const systems: StarSystem[] = points.map((point, index) => {
    const region = regions[index]!
    const star = rng.weighted(STAR_WEIGHTS[region])

    const featureCount = rng.weighted([
      [0, 1.5],
      [1, 5],
      [2, 4],
      [3, 1.5],
    ])
    const features: SystemFeature[] = []
    for (let i = 0; i < featureCount; i++) {
      const feature = rng.weighted(FEATURE_WEIGHTS[region])
      if (!features.includes(feature)) features.push(feature)
    }

    return {
      id: `sys-${String(index).padStart(3, '0')}`,
      name: namer.system(),
      x: point.x,
      y: point.y,
      r: Math.hypot(point.x, point.y),
      theta: Math.atan2(point.y, point.x),
      star,
      features,
      region,
      faction: null,
      landmark: false,
    }
  })

  // Rift echoes are rare and cluster toward the Margin. They are the signature
  // the Gateway shares with the anomaly that stranded the ship.
  const echoCount = rng.range(4, 7)
  const echoPool = rng.shuffle(
    systems.filter((s) => !s.features.includes('rift-echo')),
  ).sort((a, b) => {
    const weight = (s: StarSystem) => (s.region === 'rift-margin' ? 0 : s.region === 'cinder-belt' ? 1 : 2)
    return weight(a) - weight(b)
  })
  for (const system of echoPool.slice(0, echoCount)) {
    system.features.push('rift-echo')
  }

  const factions = placeFactions(rng, systems, opts)

  for (const system of systems) {
    if (system.landmark) continue
    const notable =
      system.features.includes('pulsar') ||
      system.features.includes('nebula-shroud') ||
      system.features.includes('habitable-world') ||
      system.features.includes('ruins')
    system.landmark = notable ? rng.chance(0.8) : rng.chance(0.18)
  }

  const { lanes, adjacency } = buildLanes(rng, systems, opts)

  const shallowsAnchor = anchors.find((a) => a.id === 'shallows')!
  const start = [...systems].sort(
    (a, b) => distance(a, shallowsAnchor) - distance(b, shallowsAnchor),
  )[0]!

  return {
    seed: '',
    systems,
    lanes,
    adjacency,
    factions,
    start: start.id,
  }
}
