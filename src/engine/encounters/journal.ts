import type { GameState } from '../state/types.js'
import { doneFlag } from './select.js'

/**
 * The journal: what the ship is in the middle of.
 *
 * The captain's log records what happened; the journal keeps score of what
 * is *unfinished* — debts, contracts, passengers with prices on them,
 * programmes half-flown — and of the friendships worth calling on. Rules
 * are keyed on the same flags the encounters set, so a thread appears the
 * moment it opens and vanishes the moment the story closes it.
 */

interface ThreadRule {
  /** Open while all of these flags are set… */
  all: string[]
  /** …and none of these. */
  none?: string[]
  text: string
}

const THREADS: ThreadRule[] = [
  {
    all: ['oracle-debt'],
    text: 'The Oracle of the Ninth Relay holds an unspecified favour over the ship. It will be collected.',
  },
  {
    all: ['gannet-contract'],
    none: ['gannet-taken', 'gannet-friend'],
    text: 'Marchetti’s contract on the pirate called the Gannet is in the safe. She will find you first.',
  },
  {
    all: ['defector-aboard'],
    none: ['defector-safe'],
    text: 'Vess berths by the hydroponics bay. Vekar retrieval orders stand, and their lances are looking.',
  },
  {
    all: ['defector-aboard', 'defector-safe'],
    text: 'Vess berths by the hydroponics bay, retrieval order marked INFEASIBLE. Nobody stands watch over the berth anymore, officially.',
  },
  {
    all: ['child-aboard'],
    none: ['child-safe'],
    text: 'The cartographer’s child is aboard, and a seizure writ with the Ithaca’s name on it is working through four jurisdictions.',
  },
  {
    all: ['child-aboard', 'child-safe'],
    text: 'The cartographer’s child is aboard, her writ unserved and its corvette burned. She has started correcting the chart table.',
  },
  {
    all: ['buoy-woken'],
    none: ['listener-friend', 'echo-dead'],
    text: 'Something dormant heard the ship listening at the blue star, and has been reporting coreward since.',
  },
  {
    all: ['mimic-studied'],
    none: ['echo-dead'],
    text: 'The mimetic intelligence behind the false beacon has stopped fishing and started composing. It knows the ship’s name.',
  },
  {
    all: ['mimic-met'],
    none: ['echo-dead', 'mimic-studied'],
    text: 'The thing that wore the Ithaca’s silhouette got away wounded. Things like that keep accounts.',
  },
  {
    all: ['letters-sent'],
    none: ['echo-dead'],
    text: 'Four hundred letters went out on the anomaly — and announced, to anyone listening, exactly where they were born.',
  },
  {
    all: ['parallax-1'],
    none: ['parallax-2'],
    text: 'Reyne’s parallax programme: one baseline of three fixed. She will be waiting at the next usable pulsar.',
  },
  {
    all: ['parallax-2'],
    none: ['parallax-3'],
    text: 'Reyne’s parallax programme: two baselines of three. One more window closes the triangle.',
  },
  {
    all: ['paradise-respected'],
    none: [doneFlag('paradise-test')],
    text: 'The empty world watched the away teams work. A finding is coming.',
  },
  {
    all: ['paradise-looted'],
    none: [doneFlag('paradise-test')],
    text: 'The empty world watched the away teams load its granaries. A finding is coming.',
  },
  {
    all: ['cargo-left'],
    text: 'Forty containers of sleeping colonists are still in the dark where the ship left them, on a battery with a month to live.',
  },
]

const FRIENDS: ThreadRule[] = [
  { all: ['admiral-friend'], text: 'Admiral Sale’s chart of the war corridor — and the old man’s regard.' },
  { all: ['gannet-friend'], text: 'The Gannet and every colony she feeds. Her running charts came with the toast.' },
  { all: ['convoy-friend'], text: 'The refugee constellation. Ninety hulls that spell the ship’s name in formation.' },
  { all: ['marlowe-friend'], text: 'Dex Marlowe redraws his blockade line weekly, and shares it.' },
  { all: ['sanctuary-friend'], text: 'The hospital moon keeps its lights, and its intake records stay open to the ship.' },
  { all: ['listener-friend'], text: 'The ancient buoy that emptied its ten-thousand-year memory into the comms array.' },
  { all: ['swarm-friend'], text: 'The Ten Thousand, who read the drive respectfully and paid in survey data.' },
  { all: ['mines-stood-down'], text: 'A minefield of dead pilots, stood down by name. The lane they held is open.' },
  { all: ['held-the-torch'], text: 'The maintenance watch, since the day the Old Man held the torch.' },
  { all: ['oracle-paid'], text: 'The custodian network’s ledger reads DEBT PAID. Machines remember.' },
  { all: ['audited-good'], text: 'The Custodians’ audit: IN GOOD STANDING. The only such entry in the ledger.' },
]

function applies(rule: ThreadRule, state: GameState): boolean {
  if (!rule.all.every((f) => state.flags.includes(f))) return false
  if (rule.none?.some((f) => state.flags.includes(f))) return false
  return true
}

/** Unfinished business, in authored order. */
export function openThreads(state: GameState): string[] {
  return THREADS.filter((r) => applies(r, state)).map((r) => r.text)
}

/** Standing assets: the relationships worth calling on. */
export function friendsOfTheShip(state: GameState): string[] {
  return FRIENDS.filter((r) => applies(r, state)).map((r) => r.text)
}
