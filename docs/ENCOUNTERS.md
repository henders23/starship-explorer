# Encounters, Intelligence and the War

*How the narrative layer works, where its content comes from, and how to
extend it. Covers the encounter engine, the research trees, the culture
standings, and the hand-off into ship combat.*

---

## 1. The idea

The game's spine is the deduction: collect accounts of the anomaly, weigh
their provenance, commit to one star. M2–M3 built that spine and gave it a
cost in fuel, days and people. The encounter layer gives it a **galaxy that
talks back** — and makes *intelligence* something that arrives from many
directions:

- **Technology** — research trees turn data into better scanners, drives
  that can survive the rift, comms tiers that unlock conversations, and a
  combat loadout.
- **Races** — four cultures keep score on the ship. Standing opens (and
  closes) dialogue options, passage, and endgame verification.
- **Characters** — encounters offer missions, trades and favours; the good
  ones pay in route clues handed straight to the Nav Plot.

Some encounters are hostile, and the argument continues on the tactical
display (see §6).

## 2. Architecture

Everything narrative lives in `src/engine/encounters/`:

| file | role |
|---|---|
| `types.ts` | `EncounterDef` — a small dialogue graph: nodes → choices → weighted outcomes |
| `catalog.ts` | the authored content, ~40 encounters in seven arcs |
| `select.ts` | seeded selection on arrival: follow-ups first, then a weighted roll |

The reducer owns all consequences (`encounterChoose`, `encounterContinue`,
`resolveCombat`, `research` in `state/reducer.ts`). Everything is pure and
seeded: the same seed and action log replays to the same conversations, the
same dice, the same hunters arriving on the same days.

**State added to `GameState`:** `data`, `unlockedTech`, `flags`, `standing`,
`warPressure`, `pending` (scheduled follow-ups), `encounter` (the open
dialogue), `hull`, `combat`, and the `destroyed` outcome.

### Selection, on every arrival

1. If a scheduled follow-up is **due** (`day >= notBefore`) and its
   conditions pass, it fires — hunters find you wherever you jump.
2. Otherwise the arrival rolls at `ENCOUNTER_CHANCE` (55%) and picks by
   weight from every encounter whose `when` clause the system, calendar,
   war pressure and story flags satisfy.
3. Uniques are barred by a `done:<id>` flag the moment they open.

### Outcomes

A choice lists visible requirements (`needs`: tech / fit officer / standing
/ flag), an up-front cost (`spend`), and weighted results. An outcome can
move any dial the game has: fuel, supplies, hull, data, standing,
war pressure, flags, injuries, crew losses, days — and the two that matter:

- `shareClues: n` — n uncollected clues from the mystery are handed to the
  plot, already legible (told, not decoded). This is the bridge between the
  narrative layer and the deduction.
- `combat: { enemy, rewards, withdrawFollowUp }` — battle stations.

`followUp: { id, days: [min,max] }` schedules a connected encounter.

**Conditional results.** A result entry may carry a third element — a
condition on flags, standing or war pressure. Entries whose condition fails
are dropped, and when a specific entry survives it *replaces* the
unconditional fallbacks: the same choice lands differently on a ship that
looted the paradise, or is hiding a defector from the inspectors. Every
choice keeps at least one unconditional entry (the tests enforce it), and
scheduled follow-ups whose flag conditions can no longer pass are pruned —
the hunter died, the debt was paid, the thread closes.

## 3. The content, mapped to the narrative pack

The catalog adapts entries from the 200-entry narrative pack
(`starship_explorer_narrative_pack.md`). Current coverage:

| arc | encounters | pack sources |
|---|---|---|
| The Lost Course | blue-star → the-listener; false-beacon → beacon-voice → echo-hunt; parallax-1/2/3; near-home | 001, 004, 005, 006, 025 |
| Contacts & trade | song-map, gasbag-trader, navigation-oracle → oracle-favour, untranslatable, regret-trader, last-trader, archive-keeper, swarm-delegate | 007, 047, 052, 056, 062, 071, 198 |
| The war | burning-line, neutrality-inspection, hospital-moon, defector → defector-hunted, admirals-map, minefield, propaganda-rescue, chitin-queen, refugee-constellation | 020, 081, 086–088, 090, 091, 098, 101 |
| Life aboard | blue-fever, birthday, the-strike, letters-home → who-listened | 111, 114, 116, 128 |
| Derelicts | grave-deck, cargo-breathing → cargo-owners, museum-of-captains → freed-warlord, hull-within-hull | 162, 163, 169, 171 |
| Worlds | singing-canyon, abandoned-paradise → paradise-test, first-footprint, cartographer-child → child-hunted | 023, 146, 152, 160 |
| Hostiles & bounties | corsair-ambush, reaver-hunt, bounty-broker → friendly-pirate, custodian-trial | 037, 055/085, 185 |
| The Doorway Home | doorway-home — the finale, see §8 | 030, 110, 200 |

The remaining pack entries are a backlog, not a cut: the engine needs no
changes to absorb them. To add one, append an `EncounterDef` to the right
arc in `catalog.ts` — the tests validate the graph (entry node exists,
gotos resolve, follow-ups defined, portraits on disk) automatically.

### Authoring rules

- Requirements are **visible, never hidden** — a locked choice shows its
  lock. That is how the player learns what research buys.
- Outcomes may be random, but every branch is survivable unless the prose
  promises otherwise; the dice pick flavour and price, not gotchas.
- Intelligence is the real payout. Fuel and stores keep the ship moving;
  data, standing and shared clues get it home.
- Connected beats use flags + `followUp`, and follow-up-only encounters use
  `weight: 0`.

## 4. Cultures and war pressure

Four cultures track standing, −3…+3: the **Choral Flotillas** (nomad
cartographer-singers), the **Vekar Ascendancy** and **Ostrean Compact**
(the two sides of the war), and the **Gate Custodians** (the machines that
audit the ancient network). Standing gates choices (`needs.standing`), and
the endgame `custodian-trial` pays two clues for a custodian standing of +2.

`warPressure` (0–10) is moved by choices and gates war-arc encounters via
`when.minWar`. It is displayed on the Intel screen.

## 5. Research

`src/engine/research/tech.ts`: four trees × three tiers, paid in **data**,
two days a project, a fit science officer required.

- **Drives** — cheaper lanes; Long Jump reserve 30 → 24 → 20; the rift
  stops scarring the drive, then stops draining the tank.
- **Scanners** — remote site survey + 1-day scooping; +5% clean on away
  approaches; **Rift Echo Tomography** marks the gateway/decoy pair on the
  chart, unlabeled — the machine narrows it to two, provenance must finish.
- **Comms** — three tiers of dialogue unlocks (`[semantic comms]`,
  `[choral notation]`, `[custodian protocol]`). Purely content-gated:
  every tier opens options the ship literally could not say before.
- **Warfare** — ion disruptor, focus beam, ablative armour (hull 30 → 36,
  reactor +2).

Data comes from encounters, quests and combat salvage. The full tree costs
more than a typical run earns — choosing what to know is the strategy.

## 6. Ship combat

The tactical display (`src/ui/CombatScreen.tsx`) is the FTL-school
prototype, ported: reactor allocation across shields/engines/launch/
sensors, per-room damage on both ships, weapons that charge/hold/auto,
subsystem targeting, ion effects, a fighter bay, damage control on both
sides, pause on Space — plus a **withdraw** mechanic (2+ engine power,
charges over time, costs 6 fuel, and the hunter usually
reschedules).

The engine's contract (`src/engine/combat/ships.ts`) is deliberately thin:
enemy classes (corsair, patrol, warship, reaver, echo), the player loadout
as a function of the warfare tree, and `PendingCombat` — what the fight is,
what winning pays. The battle's verdict re-enters the reducer as a
`resolveCombat` action, so **a replayed action log never re-fights the
battle**. Victory pays the encounter's promised rewards (fuel, data,
clues, standing, flags); defeat is the `destroyed` ending; hull persists
between fights and heals a point a day, or fully at a yard refit.

## 7. Testing

- `tests/encounters.test.ts` — catalog integrity, seeded selection,
  follow-up scheduling, choice gating, spends, clue sharing, combat
  hand-off, replay determinism.
- `tests/research.test.ts` — action guards and every numeric effect.
- `tests/combat.test.ts` — loadout growth and all three resolutions.

## 8. The Doorway Home — the ending sequence

The correct Long Jump no longer cuts straight to the ending: it opens
`doorway-home`, the finale encounter (pack 030/110/200), and the run ends
inside it.

- **The contested gate** (110): at war pressure ≥ 4 the terminus is a
  battlefield. Every relationship the campaign built is a bloodless way
  through — the Admiral's map, Ascendancy or Compact standing, the Gannet's
  blind lane — and punching through is always available: a committed battle
  (`noWithdraw`) whose victory resumes the dialogue at the threshold
  (`rewards.resumeEncounter`). Defeat at the gate is still the end of the
  ship. Keep the war meter down, and the approach is simply clear.
- **The threshold** (030/200): the last choice, with endings gated on the
  campaign — `return` (always), `coalition` (hold the door for the refugee
  constellation; needs `convoy-friend`), `keeper` (stay a season and repair
  the network; needs custodian standing +2), and `lighthouse` (send the plot
  home, keep the ship out here; needs only the nerve). The variant lands in
  `state.ending` and the Ending screen keys off it.
- **The epilogue** (`src/engine/encounters/epilogue.ts`): a rulebook of
  lines keyed on flags and standings — the people carried, the friends
  made, the enemies ended, the region left behind. The Ending screen shows
  the lines the run actually earned. A ship that only flew and fought gets
  a short epilogue; that is the point. New consequential flags should get a
  line here — it is the cheapest place in the game to make a choice matter.
