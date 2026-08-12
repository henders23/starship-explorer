import { createRng, type Rng } from '../rng/prng.js'
import { generateGalaxy, type GalaxyOptions } from '../worldgen/galaxy.js'
import { GalaxyIndex } from '../worldgen/index-galaxy.js'
import type { Galaxy, StarSystem, SystemId } from '../worldgen/types.js'
import { admitsSystem, candidates, constraintKey, countCandidates } from './constraints.js'
import { DEFAULT_POOL_OPTIONS, enumerateTrueConstraints, filterUsable, type PoolOptions } from './pool.js'
import { DEFAULT_PROOF_OPTIONS, proveMystery, smallestWitness, type ProofOptions, type ProofReport } from './proof.js'
import { renderAttribution, renderClueProse, profileFor } from './prose.js'
import type { Clue, ClueSourceKind, Constraint, Mystery } from './types.js'

export interface MysteryOptions {
  /** Extra true clues beyond the minimum needed, to give the player choices. */
  targetRedundancy: number
  /** Hard ceiling on honest clues, so a stalling selection gives up early. */
  maxTrueClues: number
  corroboratedPairs: number
  falseClueTarget: number
  /** Clue selections attempted per galaxy before generating a new galaxy. */
  attemptsPerGalaxy: number
  /** Galaxies tried before giving up entirely. */
  maxGalaxies: number
  pool: PoolOptions
  proof: ProofOptions
  galaxy: Partial<GalaxyOptions>
}

export const DEFAULT_MYSTERY_OPTIONS: MysteryOptions = {
  targetRedundancy: 1.9,
  maxTrueClues: 18,
  corroboratedPairs: 2,
  falseClueTarget: 3,
  attemptsPerGalaxy: 12,
  maxGalaxies: 24,
  pool: DEFAULT_POOL_OPTIONS,
  proof: DEFAULT_PROOF_OPTIONS,
  galaxy: {},
}

export interface Puzzle {
  seed: string
  galaxy: Galaxy
  index: GalaxyIndex
  mystery: Mystery
  report: ProofReport
  /** How many galaxies and clue selections it took to satisfy the contract. */
  attempts: { galaxies: number; selections: number }
  /**
   * Why the rejected attempts were rejected, tallied by contract clause. The
   * generator rerolls silently, so without this any drift in the tuning shows
   * up only as the whole thing getting slower.
   */
  rejections: Record<string, number>
}

/** Buckets a proof failure message by the contract clause it belongs to. */
function rejectionKey(failure: string): string {
  return failure.split(':')[0] ?? 'unknown'
}

/** Sources that usually tell the truth, and sources that usually do not — but
 * with enough overlap that confidence is a hint rather than an answer key. */
const TRUE_SOURCE_WEIGHTS: Array<readonly [ClueSourceKind, number]> = [
  ['crew-memory', 5], ['derelict-log', 4], ['ruins-tablet', 4], ['faction-archive', 3],
  ['listening-post', 3], ['castaway', 2], ['prisoner', 2], ['alien-trader', 2],
]

const FALSE_SOURCE_WEIGHTS: Array<readonly [ClueSourceKind, number]> = [
  ['alien-trader', 5], ['prisoner', 4], ['listening-post', 3], ['crew-memory', 2],
  ['ruins-tablet', 2], ['derelict-log', 1.5], ['castaway', 0.5], ['faction-archive', 0.5],
]

export function generatePuzzle(
  seed: number | string,
  options: Partial<MysteryOptions> = {},
): Puzzle {
  const opts: MysteryOptions = {
    ...DEFAULT_MYSTERY_OPTIONS,
    ...options,
    pool: { ...DEFAULT_POOL_OPTIONS, ...options.pool },
    proof: { ...DEFAULT_PROOF_OPTIONS, ...options.proof },
    galaxy: { ...DEFAULT_MYSTERY_OPTIONS.galaxy, ...options.galaxy },
  }

  const seedLabel = String(seed)
  const rootRng = createRng(seedLabel)
  let selections = 0
  let lastReport: ProofReport | null = null
  const rejections: Record<string, number> = {}
  const tally = (key: string) => {
    rejections[key] = (rejections[key] ?? 0) + 1
  }

  for (let galaxyAttempt = 0; galaxyAttempt < opts.maxGalaxies; galaxyAttempt++) {
    const galaxyRng = rootRng.fork(`galaxy-${galaxyAttempt}`)
    const galaxy = generateGalaxy(galaxyRng, opts.galaxy)
    galaxy.seed = seedLabel
    const index = new GalaxyIndex(galaxy)

    if (!index.isConnected() || galaxy.systems.length < 40) {
      tally('galaxy-unusable')
      continue
    }

    const eligible = eligibleGateways(index, galaxyRng)
    if (eligible.length === 0) {
      tally('no-eligible-gateway')
      continue
    }

    for (let attempt = 0; attempt < opts.attemptsPerGalaxy; attempt++) {
      selections++
      const rng = galaxyRng.fork(`mystery-${attempt}`)
      // Rotate through the candidate Gateways: a system with a structural twin
      // can never be isolated, and rerolling the whole galaxy to escape one bad
      // Gateway throws away a perfectly good map.
      const gateway = eligible[attempt % eligible.length]!
      const built = buildMystery(gateway, index, rng, opts)
      if ('reason' in built) {
        tally(built.reason)
        continue
      }
      const mystery = built.mystery

      const report = proveMystery(mystery, index, opts.proof)
      lastReport = report
      if (report.ok) {
        return {
          seed: seedLabel,
          galaxy,
          index,
          mystery,
          report,
          attempts: { galaxies: galaxyAttempt + 1, selections },
          rejections,
        }
      }
      for (const failure of report.failures) tally(rejectionKey(failure))
    }
  }

  throw new GenerationError(
    `Could not generate a puzzle satisfying the contract for seed "${seedLabel}" ` +
      `after ${opts.maxGalaxies} galaxies and ${selections} clue selections.`,
    lastReport,
    rejections,
  )
}

export class GenerationError extends Error {
  readonly report: ProofReport | null
  readonly rejections: Record<string, number>
  constructor(message: string, report: ProofReport | null, rejections: Record<string, number> = {}) {
    super(message)
    this.name = 'GenerationError'
    this.report = report
    this.rejections = rejections
  }
}

/**
 * Systems that could serve as the Gateway: they carry the same rift echo as the
 * anomaly that stranded the ship, and sit far enough from the arrival point
 * that reaching one is a journey rather than an accident. Ordered so that Rift
 * Margin systems are tried first, since that is where the fiction wants it.
 */
function eligibleGateways(index: GalaxyIndex, rng: Rng): StarSystem[] {
  const distances = index.distancesFrom(index.galaxy.start)
  const eligible = rng.shuffle(
    index.systems.filter((system) => {
      if (!system.features.includes('rift-echo')) return false
      if (system.id === index.galaxy.start) return false
      const d = distances.get(system.id) ?? Infinity
      return d >= 6 && Number.isFinite(d)
    }),
  )
  return [
    ...eligible.filter((s) => s.region === 'rift-margin'),
    ...eligible.filter((s) => s.region !== 'rift-margin'),
  ]
}

type BuildOutcome = { mystery: Mystery } | { reason: string }

function buildMystery(
  gateway: StarSystem,
  index: GalaxyIndex,
  rng: Rng,
  opts: MysteryOptions,
): BuildOutcome {
  const pool = filterUsable(
    enumerateTrueConstraints(gateway, index, rng.fork('true-pool'), opts.pool),
    index,
    opts.pool,
  )
  if (pool.length < 8) return { reason: 'thin-constraint-pool' }

  const chosen = selectTrueConstraints(pool, gateway.id, index, rng, opts)
  if (!chosen) return { reason: 'no-isolating-clue-set' }

  const decoy = chooseDecoy(chosen, gateway.id, index, rng)
  if (!decoy) return { reason: 'no-plausible-decoy' }

  const lies = selectFalseConstraints(decoy, gateway.id, chosen, index, rng, opts)
  if (lies.length < opts.proof.minFalseClues) return { reason: 'no-catchable-lies' }

  return { mystery: assembleClues(gateway.id, decoy.id, chosen, lies, index, rng, opts) }
}

/**
 * How often each kind of constraint should be *offered* during selection.
 *
 * Without this the pool is overwhelmingly spatial — sixteen landmarks yield
 * around a hundred proximity and direction constraints against a handful of
 * everything else — and a naive shuffle produces an evidence board where every
 * clue reads "more than five jumps from somewhere". Interleaving by kind costs
 * nothing and is the difference between a puzzle and a spreadsheet.
 */
const KIND_OFFER_WEIGHTS: Record<Constraint['kind'], number> = {
  proximity: 3,
  direction: 3,
  contains: 2.5,
  region: 2.5,
  starType: 2,
  adjacency: 2,
  isolation: 1.5,
  anomaly: 1.5,
}

/**
 * Picks which kind of constraint to draw next, favouring kinds the evidence
 * board is still short of. The `1 + 2 × already-chosen` damping is what stops
 * the first spatial clue from making the second one likelier still.
 */
function chooseKind(
  viable: ReadonlyArray<{ constraint: Constraint }>,
  chosen: readonly Constraint[],
  rng: Rng,
): Constraint['kind'] {
  const taken = new Map<Constraint['kind'], number>()
  for (const constraint of chosen) {
    taken.set(constraint.kind, (taken.get(constraint.kind) ?? 0) + 1)
  }

  const available = new Set(viable.map((v) => v.constraint.kind))
  const weights = [...available].map(
    (kind) => [kind, KIND_OFFER_WEIGHTS[kind] / (1 + 2 * (taken.get(kind) ?? 0))] as const,
  )
  return rng.weighted(weights)
}

/** Shuffles within each kind, then interleaves kinds by the weights above. */
function diversifiedOrder(pool: readonly Constraint[], rng: Rng): Constraint[] {
  const buckets = new Map<Constraint['kind'], Constraint[]>()
  for (const constraint of rng.shuffle(pool)) {
    const bucket = buckets.get(constraint.kind)
    if (bucket) bucket.push(constraint)
    else buckets.set(constraint.kind, [constraint])
  }

  const ordered: Constraint[] = []
  while (buckets.size > 0) {
    const entries = [...buckets.entries()].map(
      ([kind, items]) => [kind, KIND_OFFER_WEIGHTS[kind] * Math.min(1, items.length)] as const,
    )
    const kind = rng.weighted(entries)
    const bucket = buckets.get(kind)!
    ordered.push(bucket.shift()!)
    if (bucket.length === 0) buckets.delete(kind)
  }
  return ordered
}

/**
 * Builds a set of true constraints that isolates the Gateway while keeping
 * every small subset non-decisive — the "solvable but non-trivial" half of the
 * contract, enforced as clues are added rather than checked afterwards.
 */
function selectTrueConstraints(
  pool: readonly Constraint[],
  gateway: SystemId,
  index: GalaxyIndex,
  rng: Rng,
  opts: MysteryOptions,
): Constraint[] | null {
  // If the entire pool cannot separate the Gateway from every other system,
  // no selection from it ever will — the Gateway has a twin somewhere and this
  // galaxy cannot pose the question. Detect it once instead of failing slowly.
  if (countCandidates(pool, index) !== 1) return null

  const remaining = diversifiedOrder(pool, rng)
  const chosen: Constraint[] = []

  const keepsSmallSubsetsSafe = (candidate: Constraint): boolean => {
    // Only subsets containing the new constraint can newly violate the rule.
    if (countCandidates([candidate], index) < opts.proof.minCandidatesForSubset) return false
    for (let i = 0; i < chosen.length; i++) {
      if (countCandidates([candidate, chosen[i]!], index) < opts.proof.minCandidatesForSubset) {
        return false
      }
      for (let j = i + 1; j < chosen.length; j++) {
        const trio = [candidate, chosen[i]!, chosen[j]!]
        if (countCandidates(trio, index) < opts.proof.minCandidatesForSubset) return false
      }
    }
    return true
  }

  // Phase one: narrow to the Gateway alone.
  //
  // The instinct is to take the most decisive clue available each time, but
  // that is exactly wrong here: decisive early picks make every later trio too
  // tight, the safety check starts rejecting everything, and selection stalls
  // a few candidates short of an answer. Choosing at random among the clues
  // that make *any* progress keeps the whole set loose, which is what the
  // non-triviality rule actually wants — and it makes repeated attempts on the
  // same galaxy explore different clue sets instead of replaying one.
  let current = index.systems.length
  while (current > 1) {
    if (chosen.length >= opts.maxTrueClues) return null

    const viable: Array<{ at: number; constraint: Constraint; size: number }> = []
    for (let i = 0; i < remaining.length; i++) {
      const constraint = remaining[i]!
      if (!keepsSmallSubsetsSafe(constraint)) continue
      const size = countCandidates([...chosen, constraint], index)
      // Intersection is monotone, so a clue that narrows nothing can never
      // help reach the Gateway — it only makes later clues harder to accept.
      if (size >= current) continue
      viable.push({ at: i, constraint, size })
    }
    if (viable.length === 0) return null

    // Pick the *kind* first, then a clue of that kind. Picking uniformly from
    // the viable list instead would hand the board to spatial clues by sheer
    // weight of numbers: two dozen landmarks generate hundreds of proximity
    // and direction constraints against a handful of everything else.
    const kind = chooseKind(viable, chosen, rng)
    const pick = rng.pick(viable.filter((v) => v.constraint.kind === kind))
    chosen.push(pick.constraint)
    remaining.splice(pick.at, 1)
    current = pick.size
  }

  const isolated = candidates(chosen, index)
  if (isolated.length !== 1 || isolated[0] !== gateway) return null

  // Phase two: add spare evidence so the player has more than one route to the
  // answer and can afford to miss some of it.
  const target = Math.ceil(chosen.length * opts.targetRedundancy)
  for (const constraint of remaining) {
    if (chosen.length >= target) break
    if (chosen.some((c) => constraintKey(c) === constraintKey(constraint))) continue
    if (!keepsSmallSubsetsSafe(constraint)) continue
    chosen.push(constraint)
  }

  return chosen
}

/**
 * The decoy is the system a player who swallows the lies talks themselves
 * into. It has to be plausible — satisfying most of the honest evidence — or
 * the deception never gets off the ground.
 */
function chooseDecoy(
  trueConstraints: readonly Constraint[],
  gateway: SystemId,
  index: GalaxyIndex,
  rng: Rng,
): StarSystem | null {
  const scored = index.systems
    .filter((s) => s.id !== gateway && s.id !== index.galaxy.start)
    .map((system) => ({
      system,
      score: trueConstraints.filter((c) => admitsSystem([c], system.id, index)).length,
    }))
    .sort((a, b) => b.score - a.score)

  const threshold = trueConstraints.length * 0.55
  const plausible = scored.filter((s) => s.score >= threshold)
  if (plausible.length === 0) return null

  // Any of the most plausible few; picking strictly the best makes decoys
  // predictable across seeds.
  return rng.pick(plausible.slice(0, 5)).system
}

/**
 * Lies are true of the decoy, false of the Gateway, and — critically —
 * catchable: each one must contradict a small set of honest clues, so a player
 * who gathers redundant evidence can expose it on the Nav Plot.
 */
function selectFalseConstraints(
  decoy: StarSystem,
  gateway: SystemId,
  trueConstraints: readonly Constraint[],
  index: GalaxyIndex,
  rng: Rng,
  opts: MysteryOptions,
): Constraint[] {
  const decoyPool = filterUsable(
    enumerateTrueConstraints(decoy, index, rng.fork('false-pool'), opts.pool),
    index,
    opts.pool,
  )

  const trueKeys = new Set(trueConstraints.map(constraintKey))
  const asClues = trueConstraints.map((constraint, i) => toStubClue(constraint, i))

  const viable = diversifiedOrder(
    decoyPool.filter((constraint) => {
      if (trueKeys.has(constraintKey(constraint))) return false
      // Must actually exclude the Gateway, or it is not a lie at all.
      if (admitsSystem([constraint], gateway, index)) return false
      return (
        smallestWitness(
          toStubClue(constraint, -1),
          asClues,
          index,
          opts.proof.maxDetectionWitness,
        ) !== null
      )
    }),
    rng,
  )

  return viable.slice(0, opts.falseClueTarget)
}

/**
 * Wraps a bare constraint as a Clue so it can be fed to the proof helpers,
 * which work in terms of clues. These never escape the generator.
 */
function toStubClue(constraint: Constraint, ordinal: number): Clue {
  return {
    id: `stub-${ordinal}`,
    constraint,
    prose: '',
    source: { kind: 'crew-memory', at: '', attribution: '' },
    truth: 'true',
    confidence: 0,
    corroborates: [],
    state: 'unfiled',
  }
}

function assembleClues(
  gateway: SystemId,
  decoy: SystemId,
  trueConstraints: readonly Constraint[],
  falseConstraints: readonly Constraint[],
  index: GalaxyIndex,
  rng: Rng,
  opts: MysteryOptions,
): Mystery {
  const clues: Clue[] = []
  const usedSites = new Set<SystemId>([index.galaxy.start])
  let n = 0

  const make = (constraint: Constraint, truth: 'true' | 'false'): Clue => {
    const kind = rng.weighted(truth === 'true' ? TRUE_SOURCE_WEIGHTS : FALSE_SOURCE_WEIGHTS)
    const at = pickSourceSystem(kind, index, rng, usedSites)
    usedSites.add(at)

    const profile = profileFor(kind)
    const confidence = clamp(profile.reliability + rng.float(-0.08, 0.08), 0.3, 0.97)

    return {
      id: `clue-${String(n++).padStart(2, '0')}`,
      constraint,
      prose: renderClueProse(constraint, kind, index, rng),
      source: { kind, at, attribution: renderAttribution(kind, rng) },
      truth,
      confidence: Math.round(confidence * 100) / 100,
      corroborates: [],
      state: 'unfiled',
    }
  }

  for (const constraint of trueConstraints) clues.push(make(constraint, 'true'))
  for (const constraint of falseConstraints) clues.push(make(constraint, 'false'))

  // Corroboration: a second, independent source asserting the same thing.
  // Only ever planted on truths, which is what makes a corroborated clue safe.
  const trueClues = clues.filter((c) => c.truth === 'true')
  for (const original of rng.sample(trueClues, opts.corroboratedPairs)) {
    const echo = make(original.constraint, 'true')
    // Two sources of the same kind is not independence.
    if (echo.source.kind === original.source.kind) continue
    echo.corroborates = [original.id]
    original.corroborates = [...original.corroborates, echo.id]
    clues.push(echo)
  }

  return { gateway, decoy, clues }
}

/**
 * Evidence lives where it makes sense: archives in claimed space, tablets in
 * ruins, logs aboard derelicts. Falls back to anywhere if the galaxy did not
 * happen to generate a fitting site.
 */
function pickSourceSystem(
  kind: ClueSourceKind,
  index: GalaxyIndex,
  rng: Rng,
  used: ReadonlySet<SystemId>,
): SystemId {
  const all = index.systems.filter((s) => s.id !== index.galaxy.start)

  const matches = (s: StarSystem): boolean => {
    switch (kind) {
      case 'faction-archive':
        return s.faction !== null && s.landmark
      case 'ruins-tablet':
        return s.features.includes('ruins')
      case 'derelict-log':
        return s.features.includes('derelict-beacon')
      case 'listening-post':
        return (
          s.features.includes('pulsar') ||
          s.features.includes('nebula-shroud') ||
          s.features.includes('derelict-beacon')
        )
      case 'alien-trader':
        return s.faction !== null || s.features.includes('habitable-world')
      case 'castaway':
        return index.degree(s.id) <= 2 || s.region === 'cinder-belt' || s.region === 'rift-margin'
      case 'crew-memory':
        return s.landmark
      case 'prisoner':
        return true
    }
  }

  const fitting = all.filter(matches)
  const unused = fitting.filter((s) => !used.has(s.id))
  const pool = unused.length > 0 ? unused : fitting.length > 0 ? fitting : all
  return rng.pick(pool).id
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
