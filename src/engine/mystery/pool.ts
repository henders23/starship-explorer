import type { Rng } from '../rng/prng.js'
import type { GalaxyIndex } from '../worldgen/index-galaxy.js'
import type { RegionId, StarSystem, StarType, SystemFeature } from '../worldgen/types.js'
import { admits, constraintKey, satisfies } from './constraints.js'
import type { Constraint } from './types.js'

const ALL_STAR_TYPES: StarType[] = [
  'yellow', 'orange', 'red-dwarf', 'red-giant', 'blue-giant', 'white-dwarf', 'neutron', 'binary',
]

const ALL_REGIONS: RegionId[] = ['shallows', 'trade-reach', 'cinder-belt', 'xenoline', 'rift-margin']

const ALL_FEATURES: SystemFeature[] = [
  'gas-giant', 'asteroid-belt', 'ice-ring', 'habitable-world', 'ruins',
  'derelict-beacon', 'nebula-shroud', 'pulsar',
]

export interface PoolOptions {
  /** How many landmark systems to draw spatial constraints against. */
  landmarkCount: number
  /**
   * A constraint admitting fewer systems than this is too decisive to be a
   * single clue — it would hand the player the answer. See DESIGN §4.2.
   */
  minAdmitted: number
  /** A constraint admitting more than this fraction of the map says nothing. */
  maxAdmittedFraction: number
}

export const DEFAULT_POOL_OPTIONS: PoolOptions = {
  landmarkCount: 24,
  minAdmitted: 5,
  maxAdmittedFraction: 0.7,
}

/**
 * Every constraint we know how to phrase that is *true of `target`*.
 *
 * Run against the Gateway this yields the pool of honest clues. Run against a
 * decoy and filtered to those false of the Gateway, it yields the lies.
 */
export function enumerateTrueConstraints(
  target: StarSystem,
  index: GalaxyIndex,
  rng: Rng,
  options: PoolOptions = DEFAULT_POOL_OPTIONS,
): Constraint[] {
  const out: Constraint[] = []
  const seen = new Set<string>()

  const offer = (constraint: Constraint): void => {
    const key = constraintKey(constraint)
    if (seen.has(key)) return
    // The generator's own guard rail: never emit a clue that is false of the
    // thing it is supposed to describe.
    if (!satisfies(constraint, target, index)) return
    seen.add(key)
    out.push(constraint)
  }

  const landmarks = rng
    .shuffle(index.systems.filter((s) => s.landmark && s.id !== target.id))
    .slice(0, options.landmarkCount)

  for (const landmark of landmarks) {
    // Radial and angular bearings are independent axes, so a system can
    // truthfully be described as both coreward and spinward of a landmark.
    offer({ kind: 'direction', of: landmark.id, dir: 'coreward' })
    offer({ kind: 'direction', of: landmark.id, dir: 'rimward' })
    offer({ kind: 'direction', of: landmark.id, dir: 'spinward' })
    offer({ kind: 'direction', of: landmark.id, dir: 'trailing' })

    const d = index.jumps(landmark.id, target.id)
    if (Number.isFinite(d)) {
      for (const slack of [0, 1, 2]) {
        offer({ kind: 'proximity', of: landmark.id, op: 'within', jumps: d + slack })
      }
      for (const slack of [1, 2, 3]) {
        const bound = d - slack
        if (bound >= 1) offer({ kind: 'proximity', of: landmark.id, op: 'beyond', jumps: bound })
      }
    }
  }

  offer({ kind: 'starType', is: target.star, negated: false })
  for (const star of rng.sample(ALL_STAR_TYPES.filter((s) => s !== target.star), 5)) {
    offer({ kind: 'starType', is: star, negated: true })
  }

  for (const feature of target.features) {
    if (feature !== 'rift-echo') offer({ kind: 'contains', feature, negated: false })
  }
  for (const feature of rng.sample(ALL_FEATURES.filter((f) => !target.features.includes(f)), 5)) {
    offer({ kind: 'contains', feature, negated: true })
  }

  for (const faction of index.galaxy.factions) {
    offer({ kind: 'adjacency', faction: faction.id, negated: false })
  }
  for (const faction of rng.sample(index.galaxy.factions, 2)) {
    offer({ kind: 'adjacency', faction: faction.id, negated: true })
  }

  offer({ kind: 'region', is: target.region, negated: false })
  for (const region of ALL_REGIONS.filter((r) => r !== target.region)) {
    offer({ kind: 'region', is: region, negated: true })
  }

  const degree = index.degree(target.id)
  offer({ kind: 'isolation', op: 'atMost', lanes: degree })
  offer({ kind: 'isolation', op: 'atMost', lanes: degree + 1 })
  offer({ kind: 'isolation', op: 'atLeast', lanes: degree })
  if (degree - 1 >= 1) offer({ kind: 'isolation', op: 'atLeast', lanes: degree - 1 })

  offer({ kind: 'anomaly' })

  return out
}

/**
 * Drops constraints that are individually decisive (they would end the game in
 * one clue) or individually vacuous (they say nothing about anything).
 */
export function filterUsable(
  constraints: readonly Constraint[],
  index: GalaxyIndex,
  options: PoolOptions = DEFAULT_POOL_OPTIONS,
): Constraint[] {
  const ceiling = Math.floor(index.systems.length * options.maxAdmittedFraction)
  return constraints.filter((constraint) => {
    const n = admits(constraint, index)
    return n >= options.minAdmitted && n <= ceiling
  })
}
