import { HULL_MAX, ORDNANCE_MAX } from '../combat/combat.js'
import { createRng } from '../rng/prng.js'
import type { GameState } from '../state/types.js'
import type { StarSystem } from '../worldgen/types.js'
import type { SceneBeat, SceneInstance, SceneOption } from './types.js'

/**
 * Transit events (R11): the things that happen between the stars.
 *
 * Sixty percent of a voyage used to be travel, and seven days in ten passed
 * without anything happening at all — the chart was a fuel spreadsheet with
 * good writing at either end of the trip. These are the middle: a lane the
 * ship is only passing through turns up something worth a day, and the
 * captain decides whether the day is worth spending.
 *
 * They fire only at systems the route *passes through* — never at the
 * destination, where the arrival scene belongs, and never where evidence is
 * waiting. Casting is pure: the same seed and the same day always finds the
 * same thing adrift.
 */

export const TRANSIT_CHANCE = 0.16

interface TransitTemplate {
  id: string
  /** Whether this find makes sense for this ship, in this system. */
  applies: (state: GameState, system: StarSystem) => boolean
  beats: (system: StarSystem) => SceneBeat[]
  options: SceneOption[]
}

const TEMPLATES: TransitTemplate[] = [
  {
    id: 'transit-ice',
    applies: (state, system) =>
      state.ship.fuel < 70 &&
      (system.features.includes('ice-ring') || system.features.includes('asteroid-belt')),
    beats: (system) => [
      {
        speaker: null,
        text:
          `The transit through ${system.name} takes the ship along the inner edge of the field, ` +
          `and the survey returns come back wrong in an interesting way.`,
      },
      {
        speaker: 'science',
        text:
          `“Cometary ice, Captain — dirty, ancient, and volatile enough to crack for fuel if we ` +
          `stop and work it. A day of it, and the tank thanks you. Or we hold course and I file ` +
          `the coordinates for a ship that has more time than we do.”`,
      },
    ],
    options: [
      {
        id: 'crack',
        label: 'Heave to and crack the ice',
        detail: '1 day · 10 fuel into the tank',
        effect: { kind: 'salvage', days: 1, fuel: 10 },
      },
      { id: 'press', label: 'Log it and hold course', effect: { kind: 'dismiss' } },
    ],
  },
  {
    id: 'transit-lifeboat',
    applies: () => true,
    beats: (system) => [
      {
        speaker: null,
        text:
          `Mid-transit at ${system.name}, the boards catch a return too regular to be rock: a ` +
          `lifeboat, tumbling slowly, running on the last of a battery somebody charged a very ` +
          `long time ago.`,
      },
      {
        speaker: 'medical',
        text:
          `“No life signs, Captain. There were, once — the recycler ran for years after it stopped ` +
          `mattering. Whoever they were, they are past my help.”`,
      },
      {
        speaker: 'security',
        text:
          `“Their tanks will still have something in them, and their locker will still have a ` +
          `manifest. It costs us a day and a boarding party, and it costs them nothing at all now.”`,
      },
    ],
    options: [
      {
        id: 'board',
        label: 'Come alongside and strip her',
        detail: '1 day · fuel and whatever the locker held',
        effect: { kind: 'salvage', days: 1, fuel: 7, ordnance: 1 },
      },
      {
        id: 'leave',
        label: 'Read the names into the log and pass on',
        detail: 'Some things are not salvage',
        effect: { kind: 'dismiss' },
      },
    ],
  },
  {
    id: 'transit-battlefield',
    applies: (state) => state.ordnance < ORDNANCE_MAX,
    beats: (system) => [
      {
        speaker: null,
        text:
          `Something was fought over ${system.name}, and not long ago. The debris still holds its ` +
          `formation, which means nobody has come back for it.`,
      },
      {
        speaker: 'security',
        text:
          `“Two hulls, maybe three, and a great deal of ordnance that never got where it was going. ` +
          `Half of it will be junk. The other half will fit our racks, Captain, and we are not ` +
          `carrying enough of it.”`,
      },
    ],
    options: [
      {
        id: 'sweep',
        label: 'Sweep the field for live ordnance',
        detail: '1 day · missiles for the magazine',
        effect: { kind: 'salvage', days: 1, ordnance: 3 },
      },
      { id: 'press', label: 'Leave the dead their argument', effect: { kind: 'dismiss' } },
    ],
  },
  {
    id: 'transit-echo',
    applies: (state, system) =>
      state.tech.active !== null &&
      state.roster.some((o) => o.role === 'science' && o.status === 'fit') &&
      system.features.includes('rift-echo'),
    beats: (system) => [
      {
        speaker: 'science',
        text:
          `“Captain — hold the transit. There is an echo here, and it is the clearest one I have ` +
          `read since we came through. Everything I am working on at the bench, I am working on ` +
          `blind. A day inside this thing and I would not be.”`,
      },
      {
        speaker: null,
        text:
          `Outside, ${system.name}'s echo turns over like something breathing in its sleep. It is ` +
          `the shape of the door that took the ship, seen from the wrong side.`,
      },
    ],
    options: [
      {
        id: 'instrument',
        label: 'Hold station and instrument the echo',
        detail: '1 day · the bench gains two on its project',
        effect: { kind: 'salvage', days: 1, research: 2 },
      },
      { id: 'press', label: 'Not today', effect: { kind: 'dismiss' } },
    ],
  },
  {
    id: 'transit-lee',
    applies: (state) => state.ship.hull < HULL_MAX - 10,
    beats: (system) => [
      {
        speaker: 'security',
        text:
          `“Captain, the plating we welded over is talking again. If we are stopping anywhere on ` +
          `this leg, ${system.name} is the place — there is a moon here to put between us and ` +
          `anyone's sensors while the crew works outside.”`,
      },
    ],
    options: [
      {
        id: 'patch',
        label: 'Ride the lee and patch the hull',
        detail: '1 day · the worst of the damage plated over',
        effect: { kind: 'salvage', days: 1, hull: 12 },
      },
      { id: 'press', label: 'She will hold. Press on', effect: { kind: 'dismiss' } },
    ],
  },
]

/**
 * What the ship finds crossing this system, if anything. Pure in the seed
 * and the day, so a replayed log finds the same thing in the same place.
 */
export function castTransit(state: GameState, system: StarSystem): SceneInstance | null {
  const rng = createRng(`${state.seed}:transit:${state.day}:${system.id}`)
  if (!rng.chance(TRANSIT_CHANCE)) return null

  const eligible = TEMPLATES.filter((t) => t.applies(state, system))
  if (eligible.length === 0) return null

  const template = rng.pick(eligible)
  return {
    at: system.id,
    templateId: template.id,
    figure: null,
    beats: template.beats(system),
    options: template.options,
  }
}
