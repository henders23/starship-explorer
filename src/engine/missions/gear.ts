import type { AwayTeam, Officer, OfficerRole } from '../crew/types.js'
import type { Approach } from './sites.js'

/**
 * The equipment locker, made real.
 *
 * Every item's effect is a rule the engine actually applies: weapons and
 * field kit move percentage points into the clean outcome (by how well the
 * item suits the approach being taken), armour takes percentage points off
 * its wearer's injury roll on a bad landing, and the trauma kit negates one
 * officer injury per mission. The numbers the Loadout screen shows are the
 * numbers the dice use — the same legibility rule the mission odds obey.
 */

export type GearSlot = 'primary' | 'armour' | 'equipment'

/**
 * How an approach goes in, derived from who it needs: the unassisted
 * approaches are direct force, the security-gated ones are tactical work,
 * and the science/medical ones live on finesse.
 */
export type ApproachStyle = 'force' | 'tactical' | 'finesse'

export interface GearItem {
  id: string
  slot: GearSlot
  name: string
  /** Two-letter locker stencil, e.g. "M9". */
  mark: string
  mass: number
  /** Percentage points added to the clean outcome, by approach style. */
  clean: Record<ApproachStyle, number>
  /** Percentage points off the carrier's injury roll on a bad landing. */
  guard: number
  /** While a carrier holds this, one officer injury per mission is negated. */
  medkit?: boolean
  /** Player-facing effect line. States exactly what the rules above do. */
  effect: string
  /** Player-facing handling note. */
  risk: string
}

export const GEAR: GearItem[] = [
  {
    id: 'pulse', slot: 'primary', name: 'M-9 Pulse Carbine', mark: 'M9', mass: 4.8,
    clean: { force: 2, tactical: 2, finesse: 2 }, guard: 0,
    effect: '+2 clean on any approach', risk: 'Dependable',
  },
  {
    id: 'scatter', slot: 'primary', name: 'Kestrel Scattergun', mark: 'SG', mass: 6.1,
    clean: { force: 4, tactical: 2, finesse: 0 }, guard: 0,
    effect: '+4 clean going in direct · useless for finesse work', risk: 'Loud',
  },
  {
    id: 'stunner', slot: 'primary', name: 'Vektor Arc Projector', mark: 'AP', mass: 5.4,
    clean: { force: 0, tactical: 2, finesse: 4 }, guard: 0,
    effect: '+4 clean on finesse approaches · nothing for a rush', risk: 'Non-lethal',
  },
  {
    id: 'hardsuit', slot: 'armour', name: 'Aegis Mk III Hardsuit', mark: 'A3', mass: 12.6,
    clean: { force: -1, tactical: -1, finesse: -1 }, guard: 15,
    effect: '−15% injury chance · −1 clean (the bulk slows the work)', risk: 'Sealed',
  },
  {
    id: 'scout', slot: 'armour', name: 'Pathfinder Flexweave', mark: 'PF', mass: 6.2,
    clean: { force: 1, tactical: 1, finesse: 1 }, guard: 6,
    effect: '−6% injury chance · +1 clean (moves like clothing)', risk: 'Mobile',
  },
  {
    id: 'hazmat', slot: 'armour', name: 'Sable Environment Rig', mark: 'ER', mass: 9.7,
    clean: { force: 0, tactical: 0, finesse: 0 }, guard: 10,
    effect: '−10% injury chance', risk: 'Hazard rated',
  },
  {
    id: 'scanner', slot: 'equipment', name: 'Tarsis Field Scanner', mark: 'FS', mass: 2.1,
    clean: { force: 1, tactical: 1, finesse: 3 }, guard: 0,
    effect: '+3 clean on finesse approaches · +1 elsewhere', risk: '8 hour cell',
  },
  {
    id: 'medkit', slot: 'equipment', name: 'Trauma Foam Kit', mark: 'TK', mass: 1.8,
    clean: { force: 0, tactical: 0, finesse: 0 }, guard: 0, medkit: true,
    effect: 'Negates one officer injury per mission', risk: 'Single use',
  },
  {
    id: 'drone', slot: 'equipment', name: 'Firefly Survey Drone', mark: 'SD', mass: 3.4,
    clean: { force: 3, tactical: 1, finesse: 1 }, guard: 0,
    effect: '+3 clean going in direct · +1 elsewhere (flies ahead)', risk: 'Autonomous',
  },
]

export const GEAR_BY_ID: Record<string, GearItem> = Object.fromEntries(
  GEAR.map((item) => [item.id, item]),
)

/** What one officer carries, one item per slot. Serialisable by design. */
export interface Loadout {
  primary: string
  armour: string
  equipment: string
}

export type Loadouts = Record<OfficerRole, Loadout>

/** Standard issue: what the armory hands each station on day one. */
export function defaultLoadouts(): Loadouts {
  return {
    captain: { primary: 'pulse', armour: 'hardsuit', equipment: 'scanner' },
    security: { primary: 'scatter', armour: 'hardsuit', equipment: 'drone' },
    science: { primary: 'stunner', armour: 'scout', equipment: 'scanner' },
    medical: { primary: 'stunner', armour: 'hazmat', equipment: 'medkit' },
  }
}

export function approachStyle(approach: Approach): ApproachStyle {
  if (approach.needs === null) return 'force'
  return approach.needs === 'security' ? 'tactical' : 'finesse'
}

/** The fit people whose lockers come along: chosen officers, plus the captain. */
function carriers(team: AwayTeam, roster: readonly Officer[]): OfficerRole[] {
  const roles: OfficerRole[] = team.captain ? ['captain', ...team.officers] : [...team.officers]
  return roles.filter((role) => roster.find((o) => o.role === role)?.status === 'fit')
}

/** Caps keep gear an edge, not a substitute for a good team. */
export const GEAR_BONUS_MAX = 8
export const GEAR_BONUS_MIN = -4

/**
 * The clean-odds shift the team's issued gear provides for one approach.
 * Summed across every carrier's three slots, then capped.
 */
export function gearCleanBonus(
  approach: Approach,
  team: AwayTeam,
  roster: readonly Officer[],
  loadouts: Loadouts,
): number {
  const style = approachStyle(approach)
  let bonus = 0
  for (const role of carriers(team, roster)) {
    for (const item of loadoutItems(loadouts[role])) bonus += item.clean[style]
  }
  return Math.max(GEAR_BONUS_MIN, Math.min(GEAR_BONUS_MAX, bonus))
}

/** Percentage points off this officer's injury roll, from what they wear. */
export function gearGuard(loadouts: Loadouts, role: OfficerRole): number {
  return loadoutItems(loadouts[role]).reduce((sum, item) => sum + item.guard, 0)
}

/** Whether anyone going down carries a trauma kit. */
export function teamHasMedkit(
  team: AwayTeam,
  roster: readonly Officer[],
  loadouts: Loadouts,
): boolean {
  return carriers(team, roster).some((role) =>
    loadoutItems(loadouts[role]).some((item) => item.medkit),
  )
}

export function loadoutMass(loadout: Loadout): number {
  return loadoutItems(loadout).reduce((sum, item) => sum + item.mass, 0)
}

function loadoutItems(loadout: Loadout | undefined): GearItem[] {
  if (!loadout) return []
  return [loadout.primary, loadout.armour, loadout.equipment]
    .map((id) => GEAR_BY_ID[id])
    .filter((item): item is GearItem => item !== undefined)
}
