import type { OfficerRole } from '../crew/types.js'
import type { TechId } from '../research/tech.js'
import { hasTech } from '../research/tech.js'
import type { CultureId } from '../encounters/types.js'

/**
 * Ship-to-ship combat, M5: the data side.
 *
 * The battle itself runs in the combat screen — real-time, pausable,
 * FTL-school: a reactor to allocate, rooms that take damage, weapons that
 * charge and target subsystems. The *engine* only knows three things: what
 * the enemy is, what the Ithaca brings to the fight, and what the outcome
 * costs or pays. The result re-enters the reducer as an action, so a
 * replayed action log never needs to re-fight the battle.
 */

export type EnemyClassId = 'corsair' | 'patrol' | 'warship' | 'reaver' | 'echo'

export type GunKind = 'laser' | 'missile' | 'ion'

export interface EnemyGun {
  kind: GunKind
  label: string
  /** Seconds to charge. */
  time: number
  shots: number
  dmg: number
}

export interface EnemyClass {
  id: EnemyClassId
  name: string
  /** The line under the name on the tactical readout. */
  designation: string
  hull: number
  /** Shield layers, 0–2. */
  shields: number
  /** Seconds between self-repairs. */
  repairSecs: number
  guns: EnemyGun[]
  /** A rough gauge for the encounter UI: what the crew is in for. */
  menace: 'light' | 'serious' | 'grave'
}

export const ENEMY_CLASSES: Record<EnemyClassId, EnemyClass> = {
  corsair: {
    id: 'corsair',
    name: 'SABLE CORSAIR',
    designation: 'RAIDER — LIGHT HULL',
    hull: 14,
    shields: 1,
    repairSecs: 10,
    guns: [{ kind: 'laser', label: 'LASER', time: 9, shots: 2, dmg: 1 }],
    menace: 'light',
  },
  patrol: {
    id: 'patrol',
    name: 'VEKAR PATROL LANCE',
    designation: 'MILITARY — INTERDICTION',
    hull: 18,
    shields: 2,
    repairSecs: 9,
    guns: [
      { kind: 'laser', label: 'LASER', time: 9, shots: 2, dmg: 1 },
      { kind: 'ion', label: 'ION', time: 12, shots: 1, dmg: 0 },
    ],
    menace: 'serious',
  },
  warship: {
    id: 'warship',
    name: 'OSTREAN LINE WARSHIP',
    designation: 'MILITARY — SHIP OF THE LINE',
    hull: 24,
    shields: 2,
    repairSecs: 8,
    guns: [
      { kind: 'laser', label: 'LASER', time: 8, shots: 2, dmg: 1 },
      { kind: 'missile', label: 'MISSILE', time: 14, shots: 1, dmg: 2 },
    ],
    menace: 'grave',
  },
  reaver: {
    id: 'reaver',
    name: 'KHR-77 REAVER',
    designation: 'HOSTILE — UNREGISTERED',
    hull: 22,
    shields: 2,
    repairSecs: 8,
    guns: [
      { kind: 'laser', label: 'LASER', time: 9, shots: 2, dmg: 1 },
      { kind: 'missile', label: 'MISSILE', time: 15, shots: 1, dmg: 2 },
    ],
    menace: 'serious',
  },
  echo: {
    id: 'echo',
    name: 'THE ECHO',
    designation: 'UNKNOWN — MIMETIC HULL',
    hull: 26,
    shields: 2,
    repairSecs: 7,
    guns: [
      { kind: 'laser', label: 'LASER', time: 8, shots: 2, dmg: 1 },
      { kind: 'ion', label: 'ION', time: 10, shots: 1, dmg: 0 },
      { kind: 'missile', label: 'MISSILE', time: 16, shots: 1, dmg: 2 },
    ],
    menace: 'grave',
  },
}

/** What winning pays and what it advances. Applied by the reducer. */
export interface CombatRewards {
  fuel?: number
  data?: number
  /** Route intelligence recovered from the wreck or its computers. */
  shareClues?: number
  standing?: Partial<Record<CultureId, number>>
  flagsSet?: string[]
  /** The log line for the victory, ahead of the standard tally. */
  text?: string
  /** Victory re-opens this dialogue node — for battles inside a story beat. */
  resumeEncounter?: { id: string; node: string }
}

/** A battle the reducer has ordered and the combat screen must now fight. */
export interface PendingCombat {
  enemy: EnemyClassId
  /** Seeds the combat screen's RNG, so a re-mounted battle rolls the same. */
  seed: string
  /** Where the enemy came from, for the readout and the log. */
  label: string
  rewards?: CombatRewards
  /** If the captain disengages, this encounter is rescheduled. */
  withdrawFollowUp?: { id: string; days: [number, number] }
  /** A committed battle: the tactical display offers no withdrawal. */
  noWithdraw?: boolean
}

export interface PlayerWeaponSpec {
  name: string
  kind: 'laser' | 'missile' | 'ion' | 'beam'
  room: 'weapons1' | 'weapons2'
  cost: number
  time: number
  shots: number
  dmg: number
  ammo?: number
  color: string
}

/** The Ithaca's combat loadout, as the warfare tree currently stands. */
export function playerWeaponsFor(unlocked: readonly TechId[]): PlayerWeaponSpec[] {
  const weapons: PlayerWeaponSpec[] = [
    { name: 'PULSE LASER', kind: 'laser', room: 'weapons1', cost: 1, time: 8, shots: 2, dmg: 1, color: '#ff6b5e' },
    { name: 'HELLION MISSILE', kind: 'missile', room: 'weapons1', cost: 1, time: 13, shots: 1, dmg: 2, ammo: 8, color: '#ffb454' },
  ]
  if (hasTech(unlocked, 'war-ion')) {
    weapons.push({ name: 'ION DISRUPTOR', kind: 'ion', room: 'weapons2', cost: 1, time: 7, shots: 1, dmg: 0, color: '#5fd8ff' })
  }
  if (hasTech(unlocked, 'war-beam')) {
    weapons.push({ name: 'FOCUS BEAM', kind: 'beam', room: 'weapons2', cost: 2, time: 15, shots: 1, dmg: 3, color: '#c39bff' })
  }
  return weapons
}

/* ------------------------------------------------------------------------ *
 * Battle stations: the crew in combat.
 *
 * Fit officers man stations automatically (the captain can stand anyone
 * down from the tactical display). Manning is a real wager: the bonus is
 * live only while the officer's room has hull, and a hit that damages a
 * manned room can put its officer on the deck — the wound rides the
 * resolveCombat action back to the roster and the medbay, where the usual
 * calendar (and the medical officer) takes over. Medical has no station to
 * man; their combat value is that everyone hurt today heals in half the
 * time.
 * ------------------------------------------------------------------------ */

export interface CombatStation {
  role: OfficerRole
  label: string
  /** The player room whose survival the bonus depends on; null = passive. */
  room: 'helm' | 'weapons1' | 'sensors' | null
  blurb: string
}

export const COMBAT_STATIONS: CombatStation[] = [
  { role: 'captain', label: 'HELM', room: 'helm', blurb: 'evasive command: +evade by skill' },
  { role: 'security', label: 'WEAPONS', room: 'weapons1', blurb: 'gunnery drill: weapons charge faster' },
  { role: 'science', label: 'SENSORS', room: 'sensors', blurb: 'target solutions: +accuracy, sensors live unpowered' },
  { role: 'medical', label: 'MEDBAY', room: null, blurb: 'triage: combat wounds heal in half the time' },
]

/** Chance a damaging hit on a manned room wounds its officer. */
export const STATION_INJURY_CHANCE = 0.3

/** Extra evade with the captain at the helm, by skill. */
export function helmEvadeBonus(skill: number): number {
  return 4 + skill
}

/** Weapon charge multiplier with the security officer on the guns. */
export function weaponsChargeBoost(skill: number): number {
  return 1 + 0.06 + 0.02 * skill
}

/** Enemy evade shaved off the Ithaca's fire with science on sensors. */
export const SCIENCE_ACCURACY_BONUS = 5
