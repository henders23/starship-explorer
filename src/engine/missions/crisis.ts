import type { AwayTeam, OfficerRole } from '../crew/types.js'
import type { Rng } from '../rng/prng.js'
import type { SystemId } from '../worldgen/types.js'
import type { Odds, SiteType } from './sites.js'

/**
 * Mid-mission choice nodes (R9): some missions hit an authored complication
 * on the ground. The situation worsens, the team stands at a decision whose
 * odds shifts are printed — the numbers the player sees are the numbers the
 * dice use, same house rule as the mission panel — and the resolution rides
 * the existing harm ladder. The crisis is ordinary state and the call is an
 * ordinary logged action, so saves resume mid-crisis and replays land the
 * same way.
 */

export const CRISIS_CHANCE = 0.35
/** Firing a crisis worsens the committed odds; the choices claw it back. */
export const CRISIS_PENALTY = { clean: -10, disaster: 6 }

export interface CrisisChoice {
  id: string
  label: string
  detail: string
  /** A department officer this choice needs on the team and fit. */
  needs?: Exclude<OfficerRole, 'captain'>
  /** Printed shift applied to the standing odds. */
  shift: { clean: number; disaster: number }
  /** Days the choice spends before the roll. */
  days: number
}

export interface MissionCrisis {
  at: SystemId
  team: AwayTeam
  approach: string
  siteType: SiteType
  text: string
  /** The odds standing at the decision — committed odds, crisis applied. */
  odds: Odds
  choices: CrisisChoice[]
}

/** Shift odds, clamped sane, always summing to exactly 100. */
export function shiftOdds(base: Odds, shift: { clean: number; disaster: number }): Odds {
  const clean = Math.min(95, Math.max(2, base.clean + shift.clean))
  const disasterRaw = Math.min(90, Math.max(0, base.disaster + shift.disaster))
  const messy = Math.max(0, 100 - clean - disasterRaw)
  return { clean, messy, disaster: 100 - clean - messy }
}

interface CrisisSpec {
  text: (system: string) => string
  choices: CrisisChoice[]
}

/** One authored complication per site family. The expert choice is gated,
 * the careful one costs a day, the rash one pays in risk. */
const CRISES: Record<SiteType, CrisisSpec> = {
  derelict: {
    text: (system) =>
      `Halfway to the log core the deck lets go under the point man. The route ahead crosses ` +
      `an unpowered section of ${system}'s wreck that flexes with every step, and the team is ` +
      `holding position on the wrong side of it.`,
    choices: [
      {
        id: 'cut',
        label: 'Cut a new route through the hold wall',
        detail: "the chief's torch crew makes its own corridor",
        needs: 'security',
        shift: { clean: 12, disaster: -8 },
        days: 0,
      },
      {
        id: 'lines',
        label: 'Rig lines and take the long way round',
        detail: 'slow and sure, and a day the mission did not budget',
        shift: { clean: 8, disaster: -6 },
        days: 1,
      },
      {
        id: 'press',
        label: 'Press on across the flexing deck',
        detail: 'and hope it holds under the last man',
        shift: { clean: 0, disaster: 0 },
        days: 0,
      },
    ],
  },
  ruins: {
    text: (system) =>
      `A gallery roof lets go somewhere behind the team, and the dust does not settle. The ` +
      `inner chamber at ${system} is still shifting, and the team is inside it.`,
    choices: [
      {
        id: 'read',
        label: 'Read the structure before the next fall',
        detail: 'the science officer maps what will hold',
        needs: 'science',
        shift: { clean: 12, disaster: -8 },
        days: 0,
      },
      {
        id: 'shore',
        label: 'Shore the galleries and work slow',
        detail: 'a day of bracing before anyone touches the chamber',
        shift: { clean: 8, disaster: -6 },
        days: 1,
      },
      {
        id: 'grab',
        label: 'Take what is nearest and go',
        detail: 'fast, and hope the roof waits',
        shift: { clean: 0, disaster: 0 },
        days: 0,
      },
    ],
  },
  holdout: {
    text: (system) =>
      `It goes wrong at the barricade. One of ${system}'s holdouts, young and exhausted and ` +
      `with a weapon up, starts shouting, and voices on both sides of the wire start rising to ` +
      `meet it.`,
    choices: [
      {
        id: 'doctor',
        label: 'Send the doctor forward, hands empty',
        detail: 'unarmed, and visibly a doctor',
        needs: 'medical',
        shift: { clean: 12, disaster: -8 },
        days: 0,
      },
      {
        id: 'back',
        label: 'Pull back and let them cool',
        detail: 'a day lost, and nobody gets shot for it',
        shift: { clean: 8, disaster: -6 },
        days: 1,
      },
      {
        id: 'shout',
        label: 'Shout them down before it spreads',
        detail: 'and hope it reads as an order, not a threat',
        shift: { clean: 0, disaster: 0 },
        days: 0,
      },
    ],
  },
  'listening-post': {
    text: (system) =>
      `A relay wakes under the floor plates of ${system}'s station: a rhythmic pulse in ` +
      `nobody's language, and it is quickening. The post has noticed its visitors.`,
    choices: [
      {
        id: 'decode',
        label: 'Read the trigger logic before it finishes',
        detail: 'the science officer works it while the pulse runs',
        needs: 'science',
        shift: { clean: 12, disaster: -8 },
        days: 0,
      },
      {
        id: 'cutpower',
        label: 'Cut power at the mast and wait it out',
        detail: 'a cold day outside while the station settles',
        shift: { clean: 8, disaster: -6 },
        days: 1,
      },
      {
        id: 'yank',
        label: 'Pull the core before it decides',
        detail: 'out before the pulse finishes, one way or the other',
        shift: { clean: 0, disaster: 0 },
        days: 0,
      },
    ],
  },
}

/** Whether this mission hits its complication. One dedicated stream. */
export function crisisFires(rng: Rng): boolean {
  return rng.chance(CRISIS_CHANCE)
}

export function castCrisis(
  at: SystemId,
  systemName: string,
  siteType: SiteType,
  team: AwayTeam,
  approach: string,
  committedOdds: Odds,
): MissionCrisis {
  const spec = CRISES[siteType]
  return {
    at,
    team,
    approach,
    siteType,
    text: spec.text(systemName),
    odds: shiftOdds(committedOdds, CRISIS_PENALTY),
    choices: spec.choices,
  }
}
