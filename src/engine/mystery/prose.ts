import type { Rng } from '../rng/prng.js'
import type { GalaxyIndex } from '../worldgen/index-galaxy.js'
import { describeConstraint } from './constraints.js'
import type { ClueSourceKind, Constraint } from './types.js'

/**
 * The galaxy is procedural; the voice is not. Every clue reaches the player
 * wrapped in an authored phrasing chosen by its source, so a trader's rumour
 * never reads like a monastery's star chart.
 */

export interface SourceProfile {
  kind: ClueSourceKind
  label: string
  /** Base reliability, shown to the player as confidence. Not the truth flag. */
  reliability: number
  /** How the evidence is introduced. `{claim}` is replaced by the constraint. */
  templates: string[]
  attributions: string[]
}

export const SOURCE_PROFILES: SourceProfile[] = [
  {
    kind: 'crew-memory',
    label: 'Crew recollection',
    reliability: 0.8,
    templates: [
      'She turns from the console before she has quite decided to speak. "Captain — I served a survey tour out this way, years back. If I have it right, the anomaly you want {claim}."',
      '"You will want to hear this from me rather than the log," he says. "Everything I was ever taught says the gate {claim}."',
      'He is quiet for a long moment. "My first captain chased this same ghost. Her working assumption was that it {claim}. She never got to test it."',
    ],
    attributions: [
      'recalled by a member of the bridge crew',
      'from an officer\'s own service memory',
      'volunteered on the bridge, unprompted',
    ],
  },
  {
    kind: 'alien-trader',
    label: 'Purchased rumour',
    reliability: 0.52,
    templates: [
      'The broker counts your credits twice before answering. "The gate you are hunting {claim}. That is what I have. Whether it is what you need is not my affair."',
      'A voice through three layers of translation, and a laugh somewhere in it: "Everyone knows this. The gate {claim}. You paid too much."',
      'The trader will not meet your eye. "It {claim}," they say. "Now go, and do not say where you had it."',
    ],
    attributions: [
      'bought from a broker in a station concourse',
      'traded for, at a price',
      'sold to you by someone who was very keen to be paid first',
    ],
  },
  {
    kind: 'derelict-log',
    label: 'Salvaged log',
    reliability: 0.85,
    templates: [
      'The log is corrupted almost to nothing, but one entry survives intact: "…confirmed at last. It {claim}. If anyone finds this, that much is certain."',
      'The dead ship\'s astrogator kept a private file. The final entry reads simply: "It {claim}. We were too slow."',
      'You recover eleven seconds of audio. A tired voice, mid-sentence: "…and it {claim}, I would stake the ship on it—" and then nothing.',
    ],
    attributions: [
      'pulled from a derelict\'s memory core',
      'recovered from a dead ship\'s astrogation log',
      'salvaged from a wreck that had been drifting a long time',
    ],
  },
  {
    kind: 'ruins-tablet',
    label: 'Translated inscription',
    reliability: 0.78,
    templates: [
      'Your xenolinguist works through the night. By morning she has it: the inscription describes a passage that {claim}.',
      'The carving is older than your species. Rendered into something you can read, it says: the door {claim}.',
      'Translation is imperfect and she says so twice. The sense of it is that the way through {claim}.',
    ],
    attributions: [
      'translated from an inscription in planetary ruins',
      'read off a tablet older than your species',
      'decoded from carvings at an abandoned site',
    ],
  },
  {
    kind: 'prisoner',
    label: 'Interrogation',
    reliability: 0.58,
    templates: [
      'The prisoner talks eventually, and resents it. "Your gate {claim}. Now put me off at the next station and we are done."',
      '"You want the anomaly." They shrug against the restraints. "It {claim}. Everyone in this arm knows that. Ask anyone."',
      'They ask for water first, and terms second. When both are settled: "It {claim}."',
    ],
    attributions: [
      'given up by a prisoner taken in the boarding action',
      'extracted from a captive who wanted terms',
      'volunteered by a prisoner who wanted off your ship',
    ],
  },
  {
    kind: 'faction-archive',
    label: 'Archive record',
    reliability: 0.94,
    templates: [
      'The archivist grants you one hour and no copies. The relevant survey is unambiguous: the anomaly {claim}.',
      'Their records are meticulous and go back nine centuries. Cross-referenced, they establish that the gate {claim}.',
      'You are permitted to read, not to record. The chart is old, careful, and states plainly that it {claim}.',
    ],
    attributions: [
      'read under supervision in a faction archive',
      'from an official survey, granted as a favour',
      'consulted in a records vault you needed permission to enter',
    ],
  },
  {
    kind: 'listening-post',
    label: 'Intercepted signal',
    reliability: 0.7,
    templates: [
      'The post has been transmitting to nobody for a very long time. Decoded, the loop asserts that the passage {claim}.',
      'Comms cleans up the intercept over six hours. What is left of it says the gate {claim}.',
      'The signal repeats on a nine-minute cycle. Someone wanted this known: it {claim}.',
    ],
    attributions: [
      'decoded from an automated beacon',
      'intercepted from a listening post nobody has visited in decades',
      'pulled out of a repeating signal by your comms officer',
    ],
  },
  {
    kind: 'castaway',
    label: 'Fellow castaway',
    reliability: 0.88,
    templates: [
      'She has been out here eleven years and has not stopped working the problem. "It {claim}," she says. "I am nearly certain. I am also nearly out of time."',
      'The other captain shares what he has, which is more than you expected. "The gate {claim}. Do not waste it."',
      'They lost their ship a decade ago and their crew after that. What they have left is this: the way home {claim}.',
    ],
    attributions: [
      'shared by another castaway, freely',
      'given by someone who has been lost out here far longer than you',
      'passed on by a stranded captain with nothing left to trade',
    ],
  },
]

export function profileFor(kind: ClueSourceKind): SourceProfile {
  return SOURCE_PROFILES.find((p) => p.kind === kind) ?? SOURCE_PROFILES[0]!
}

export function renderClueProse(
  constraint: Constraint,
  kind: ClueSourceKind,
  index: GalaxyIndex,
  rng: Rng,
): string {
  const profile = profileFor(kind)
  return rng.pick(profile.templates).replace('{claim}', describeConstraint(constraint, index))
}

export function renderAttribution(kind: ClueSourceKind, rng: Rng): string {
  return rng.pick(profileFor(kind).attributions)
}
