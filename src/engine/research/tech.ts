/**
 * The research trees.
 *
 * Intelligence is the game's only real currency, and *data* is its coin:
 * survey takes, alien schematics, salvaged cores, favours repaid in
 * knowledge. Encounters, quests and combat salvage all pay in data, and the
 * lab spends it here. Four trees, three tiers each. Every node solves one
 * problem the campaign actually poses — cheaper lanes, a survivable rift
 * transit, conversations that stop going wrong, a ship that can shoot back —
 * and none of them is free of consequence in the encounters that notice
 * what you have bolted on.
 */

export type TechTree = 'drives' | 'scanners' | 'comms' | 'warfare'

export type TechId =
  | 'drive-injectors'
  | 'drive-rift'
  | 'drive-gate'
  | 'scan-survey'
  | 'scan-recon'
  | 'scan-triangulate'
  | 'comms-semantic'
  | 'comms-choral'
  | 'comms-custodian'
  | 'war-ion'
  | 'war-beam'
  | 'war-armour'

export interface TechDef {
  id: TechId
  tree: TechTree
  name: string
  /** Data spent to research it. */
  cost: number
  /** The node that must already be unlocked, if any. */
  requires: TechId | null
  /** What it does, in the terms the systems actually use. */
  effect: string
  /** The lab report, in the captain's log voice. */
  flavour: string
}

/** Every research project takes the lab this many days, tank to bench. */
export const RESEARCH_DAYS = 2

export const TECHS: TechDef[] = [
  // -- Drives ------------------------------------------------------------
  {
    id: 'drive-injectors',
    tree: 'drives',
    name: 'Resonant Fuel Injectors',
    cost: 8,
    requires: null,
    effect: 'Lane travel costs 15% less fuel.',
    flavour:
      'Alien injector geometry, reverse-engineered from a trader’s spare. The drive drinks like a smaller ship.',
  },
  {
    id: 'drive-rift',
    tree: 'drives',
    name: 'Rift Field Stabilisers',
    cost: 12,
    requires: 'drive-injectors',
    effect: 'Long Jump reserve drops from 30 to 24 fuel, and a failed jump no longer scars the drive.',
    flavour:
      'The rift stops clawing at the housings. A wrong answer will still cost the reserve — but not the drive.',
  },
  {
    id: 'drive-gate',
    tree: 'drives',
    name: 'Gate Harmonic Coupling',
    cost: 16,
    requires: 'drive-rift',
    effect: 'Long Jump reserve drops to 20 fuel, and a failed jump strands far less of the tank.',
    flavour:
      'The old network’s own timing signal, matched. The drive holds the door open instead of forcing it.',
  },

  // -- Scanners ----------------------------------------------------------
  {
    id: 'scan-survey',
    tree: 'scanners',
    name: 'Deep-Range Survey Suite',
    cost: 7,
    requires: null,
    effect: 'Evidence sites are surveyed from anywhere on the chart, and fuel scooping takes 1 day instead of 2.',
    flavour:
      'The sensor mast learns to read a system before the ship arrives. Fewer surprises on the far side of a jump.',
  },
  {
    id: 'scan-recon',
    tree: 'scanners',
    name: 'Tactical Recon Optics',
    cost: 10,
    requires: 'scan-survey',
    effect: 'Away teams land with better maps: +5% to the clean outcome on every approach.',
    flavour:
      'Metre-scale terrain passes from orbit. The team walks in knowing where the floor is weak.',
  },
  {
    id: 'scan-triangulate',
    tree: 'scanners',
    name: 'Rift Echo Tomography',
    cost: 16,
    requires: 'scan-recon',
    effect: 'The chart marks the two stars where the rift resonates hardest. One is the way home. One is not.',
    flavour:
      'Two echoes, indistinguishable in every instrument. The machine has done all it can; provenance must do the rest.',
  },

  // -- Comms -------------------------------------------------------------
  {
    id: 'comms-semantic',
    tree: 'comms',
    name: 'Semantic Translation Matrix',
    cost: 7,
    requires: null,
    effect: 'Unlocks deeper dialogue with alien contacts — options marked [semantic comms].',
    flavour:
      'The difference between a threat and a ritual of humility turns out to be four phonemes and a posture.',
  },
  {
    id: 'comms-choral',
    tree: 'comms',
    name: 'Choral Notation Engine',
    cost: 10,
    requires: 'comms-semantic',
    effect: 'The Flotilla’s route-songs become legible — options marked [choral notation].',
    flavour:
      'Distances as intervals, hazards as dissonance. The nomads have been publishing charts for a thousand years.',
  },
  {
    id: 'comms-custodian',
    tree: 'comms',
    name: 'Custodian Protocol Stack',
    cost: 14,
    requires: 'comms-choral',
    effect: 'The gate network’s machines will speak with the ship — options marked [custodian protocol].',
    flavour:
      'Not a language. A credential. The old machines do not care what you say, only whether you may say it.',
  },

  // -- Warfare -----------------------------------------------------------
  {
    id: 'war-ion',
    tree: 'warfare',
    name: 'Ion Disruptor Mount',
    cost: 8,
    requires: null,
    effect: 'Adds the ion disruptor to ship combat: strips shields and ionises enemy systems without hull damage.',
    flavour:
      'A weapon that refuses to kill, adapted from one that refused to fire. The armoury is quietly proud of it.',
  },
  {
    id: 'war-beam',
    tree: 'warfare',
    name: 'Focus Beam Array',
    cost: 12,
    requires: 'war-ion',
    effect: 'Adds the focus beam to ship combat: heavy, unavoidable damage — but useless against live shields.',
    flavour:
      'Coherent enough to sign your name on a hull at three kilometres. Shields shrug it off; nothing else does.',
  },
  {
    id: 'war-armour',
    tree: 'warfare',
    name: 'Ablative Lattice Armour',
    cost: 12,
    requires: 'war-ion',
    effect: 'Maximum hull rises from 30 to 36, and the reactor gains 2 power in combat.',
    flavour:
      'Phase-skin salvage, layered and tamed. The ship weighs more and worries less.',
  },
]

const BY_ID = new Map<TechId, TechDef>(TECHS.map((t) => [t.id, t]))

export function techDef(id: TechId): TechDef {
  const def = BY_ID.get(id)
  if (!def) throw new Error(`unknown tech: ${id}`)
  return def
}

export function hasTech(unlocked: readonly TechId[], id: TechId): boolean {
  return unlocked.includes(id)
}

/** Whether a node's prerequisite chain is satisfied. */
export function canResearch(unlocked: readonly TechId[], id: TechId): boolean {
  const def = techDef(id)
  if (unlocked.includes(id)) return false
  return def.requires === null || unlocked.includes(def.requires)
}

/* ------------------------------------------------------------------------ *
 * Effects. Each is a tiny pure function over the unlocked list, so the
 * reducer and the UI price things identically.
 * ------------------------------------------------------------------------ */

/** Lane fuel cost after drive research. Applied before the scarring premium. */
export function laneCostWith(unlocked: readonly TechId[], baseCost: number): number {
  return hasTech(unlocked, 'drive-injectors') ? Math.ceil(baseCost * 0.85) : baseCost
}

/** The Long Jump reserve, by drive tier: 30, then 24, then 20. */
export function longJumpReserveFor(unlocked: readonly TechId[]): number {
  if (hasTech(unlocked, 'drive-gate')) return 20
  if (hasTech(unlocked, 'drive-rift')) return 24
  return 30
}

/** Whether a failed Long Jump still scars the drive. */
export function riftScarsDrive(unlocked: readonly TechId[]): boolean {
  return !hasTech(unlocked, 'drive-rift')
}

/** Fuel left in the tank after a failed Long Jump, at most. */
export function riftFuelFloor(unlocked: readonly TechId[]): number {
  return hasTech(unlocked, 'drive-gate') ? 40 : 25
}

/** Days spent scooping a gas giant. */
export function scoopDaysFor(unlocked: readonly TechId[]): number {
  return hasTech(unlocked, 'scan-survey') ? 1 : 2
}

/** Flat bonus to away-mission approach odds from recon optics. */
export function awayBonusFor(unlocked: readonly TechId[]): number {
  return hasTech(unlocked, 'scan-recon') ? 5 : 0
}

/** Maximum hull, by armour research. */
export function hullMaxFor(unlocked: readonly TechId[]): number {
  return hasTech(unlocked, 'war-armour') ? 36 : 30
}

/** Reactor power available in combat. */
export function reactorFor(unlocked: readonly TechId[]): number {
  return hasTech(unlocked, 'war-armour') ? 12 : 10
}
