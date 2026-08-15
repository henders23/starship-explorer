import type { GameState } from '../state/types.js'
import type { EndingVariant } from './types.js'

/**
 * The epilogue: what the ending remembers.
 *
 * Every consequential thread the campaign can leave open or closed has a
 * line here, keyed on the flags and standings the encounters actually set.
 * The Ending screen shows the lines the run earned, in this order — the
 * people first, then the enemies, then the region. A ship that only flew
 * and fought gets a short epilogue. That is the point.
 */

export const ENDING_VARIANTS: Record<
  EndingVariant,
  { label: string; headline: string; body: string }
> = {
  return: {
    label: 'The return',
    headline: 'We are going home.',
    body:
      'The Ithaca crosses the threshold without ceremony, because the crew voted against ceremony: just the door, and then the long-imagined sky. The survey service will spend a decade arguing about the plot she brings back. The crew will spend it sleeping with the windows open.',
  },
  coalition: {
    label: 'The held door',
    headline: 'The door stayed open long enough.',
    body:
      'Ninety hulls became three hundred before the gate finally closed — refugees, defectors, the stubborn and the saved, a whole constellation spelling itself into a sky with no front line. On the far side they scattered into human space like seeds. The Ithaca came through last, escorted by everyone. There are children on a dozen worlds now who fly formation-signals as a game, and name the ship when they play it.',
  },
  keeper: {
    label: 'The lit road',
    headline: 'The network is lit behind us.',
    body:
      'The season of repairs became the treaty nobody signed: gates that work are gates worth not fighting over. The custodian machines keep an operator record with exactly one crewed vessel in it, and route pilgrims now travel a lit road where the Ithaca once groped in the dark. She came home a year late, to a survey service that had already named the corridor after her.',
  },
  lighthouse: {
    label: 'The lighthouse',
    headline: 'Home knows the way. The ship keeps the door.',
    body:
      'The packet reached the survey service in fourteen months; the first rescue ship flew the Ithaca’s plot in three years. They found her on station at the terminus, patched and repainted and busy — the light every lost thing in the region steers by, crewed by people who were asked, one by one, and stayed. The captain’s log is still kept. The entries have stopped being about home and started being about neighbours.',
  },
}

interface EpilogueRule {
  /** Lines fire in catalog order; each states one closed (or open) thread. */
  when: (state: GameState) => boolean
  text: string
}

const RULES: EpilogueRule[] = [
  // -- The people the ship carried -------------------------------------
  {
    when: (s) => s.flags.includes('defector-safe'),
    text:
      'Vess, who was grown to think a war and refused, walks down the ramp a free citizen of nowhere — and is met by three governments’ worth of asylum lawyers who have been following the story. The hydroponics bay is never reassigned.',
  },
  {
    when: (s) => s.flags.includes('defector-aboard') && !s.flags.includes('defector-safe'),
    text:
      'Vess disembarks quietly, still watching the sky for retrieval lances that no longer have jurisdiction. It takes months for the watching to stop. The crew take turns standing nearby until it does.',
  },
  {
    when: (s) => s.flags.includes('child-safe') || s.flags.includes('child-aboard'),
    text:
      'The cartographer’s child steps onto a world where a route-memory is just a family heirloom, not a crime. She recites the whole thousand-year chart once, for the archives, on her own terms — then goes, at last, to school.',
  },
  {
    when: (s) => s.flags.includes('survivor-aboard'),
    text:
      'The survivor from the grave deck stands a long time at the bottom of the ramp, two centuries and one doorway from the accident. “The rescue came,” they say, finally, and let the curtains of the old cabin stay drawn forever.',
  },
  // -- The friends the ship made ---------------------------------------
  {
    when: (s) => s.flags.includes('gannet-friend'),
    text:
      'The Gannet’s songs reach human space about a year later, the way songs do — three languages, uncountable verses, one recurring ship that always arrives in the nick of time. The naval attachés file her as myth. The colonies know better.',
  },
  {
    when: (s) => s.flags.includes('gannet-taken'),
    text:
      'The verses about the Gannet’s capture also make the crossing, eventually. They are very good, and they are not kind, and the name they are unkind to is the Ithaca’s. Some bills arrive as music.',
  },
  {
    when: (s) => s.standing.flotilla >= 2,
    text:
      'The Choral Flotillas add a theme to the route-song — a human ship, rendered as a rising interval that resolves home. It will outlast every chart aboard. Somewhere in the braid of forty hulls, it is being sung right now.',
  },
  {
    when: (s) => s.flags.includes('mines-stood-down'),
    text:
      'The minefield’s squadron is read into the record at the memorial service, name by name, by a log officer who kept her promise. A lane the charts called empty is a lane now. The dead pilots hold no more formations.',
  },
  {
    when: (s) => s.flags.includes('sanctuary-friend'),
    text: 'The hospital moon keeps its lights. Director Halloran sends one message through the door, addressed to the whole crew: “Ward Nine is a ward again.”',
  },
  {
    when: (s) => s.flags.includes('oracle-paid') || s.flags.includes('audited-good'),
    text:
      'The custodian machines amend their oldest ledger: one crewed vessel, debts settled, IN GOOD STANDING. It is the only entry of its kind. Pilgrims will queue past it for a thousand years and wonder.',
  },
  {
    when: (s) => s.flags.includes('known-rescuer'),
    text:
      'Okonkwo’s documentary crosses over in the packet traffic: eleven hours of a neutral ship doing the work, cut to forty minutes that never once show a flag. It wins nothing and changes several minds that mattered.',
  },
  // -- The enemies the ship ended --------------------------------------
  {
    when: (s) => s.flags.includes('echo-dead'),
    text:
      'The emergency bands of the region are quieter than any living navigator remembers. Nothing answers the old lure frequencies now. Fourteen dead crews’ voices are finally, entirely, silence — the kind that means rest.',
  },
  {
    when: (s) => s.flags.includes('reaver-dead'),
    text:
      'The KHR-77’s hunting grounds go back to being lanes. For a season, salvage crews recover nav cores from its hoard and mail names back to families that stopped hoping years ago. The Ithaca’s log is cited in every notification.',
  },
  {
    when: (s) => s.flags.includes('warlord-dead'),
    text:
      'Exhibit Seven’s war is finally over, nine centuries past its armistice. The museum’s empty case is left empty — the Curator’s one concession — with a new plaque: RELEASED, AND ANSWERED FOR.',
  },
  {
    when: (s) => s.flags.includes('cargo-left'),
    text:
      'Nobody aboard mentions the forty containers, ever, in any log. The battery had a month left. The arithmetic is easy and nobody does it out loud. Some cargo the ship carries home is not in the hold.',
  },
  // -- The region left behind ------------------------------------------
  {
    when: (s) => s.flags.includes('letters-sent'),
    text:
      'And in the end, the letters had beaten the ship home — four hundred of them, delivered over the years by relay and rumour and one very patient postal clerk. In four hundred households, the crew had already been spoken to every night. The homecomings simply continue the conversation.',
  },
  {
    when: (s) => s.warPressure >= 6,
    text:
      'The war the Ithaca crossed is still burning behind the door. The plot she carried home includes every atrocity coordinate her sensors ever logged — filed, attributed, and now in the hands of people whose job is remembering.',
  },
  {
    when: (s) => s.flags.includes('captain-memory-sold'),
    text:
      'Somewhere in a collector’s vault, the worst hour of your life plays on a loop for connoisseurs. You still cannot remember the light going wrong. On the whole — and it took years to be sure — you decided you got the better half of that trade.',
  },
]

export function epilogueLines(state: GameState): string[] {
  return RULES.filter((rule) => rule.when(state)).map((rule) => rule.text)
}
