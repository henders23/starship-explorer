# Starship Explorer — Build Roadmap

Ordering principle: **the mystery is the game.** Get to a winnable loop with no
combat as fast as possible, then enrich. Each milestone ends with something
playable, not something merely built.

---

## M0 — Skeleton

*Goal: an empty game that runs, saves, and is deterministic.*

- Vite + React + TypeScript (strict) + Tailwind + Vitest
- Seeded PRNG in engine state; lint rule banning `Math.random`
- `GameState` types + zod schemas; `(state, action) => {state, events}` reducer
- Zustand store, event log rendering to a captain's-log panel
- Save/load via state serialization; a golden-replay test harness

**Done when:** a seed + action list replays to an identical state hash in CI.

---

## M1 — The galaxy and the fuel clock — **done**

*Goal: fly around a generated map and run out of fuel.*

- Worldgen: 70–110 systems, lane graph, regions, star/planet properties ✓ (built in M2)
- Travel: the ship is a place on the map; every action requires presence;
  lane costs scale with length; routes plotted by cheapest fuel ✓
- Refuelling: scoop at gas giants (full tank, free), drain swept derelicts
  (+8 as mission salvage) ✓ — refining and buying deferred to M7's economy
- The Long Jump takes a 30-fuel reserve; a wrong guess displaces the ship at
  least five jumps from the target with 25 in the tank ✓
- Loss condition: stranded — no affordable lane, nothing to scoop, the rift
  out of reach, and no derelict left to drain. Declared on the transition
  that closes the trap ✓
- Deferred: fog of war over system *contents*, drive charge time, and the
  Drift counter (rest of M3)

**Done when:** you can plan a 20-jump route and strand yourself by planning badly.
**Status:** met — arriving at a barren dead-end with an empty tank ends the run
in "the long silence"; the stranding test constructs exactly that trap.

---

## M2 — Clues and deduction ★  — **done**

*Goal: the game is winnable. This is the milestone that matters.*

- `Constraint` evaluator and candidate-set selector
- Gateway placement + clue generation + **solvability proof** (DESIGN §4.2)
- Worldgen property test over 10k seeds asserting the contract
- False clues with decoy consistency; corroboration and contradiction detection
- Nav Plot UI: evidence board, trust/doubt toggles, live candidate list, map overlay
- Clue-bearing points of interest scattered across the map (placeholder prose)
- The Long Jump: commit, win, or be flung across the galaxy

**Done when:** a playtester with no combat, no crew and no story can reason their
way home from evidence — and can also get it wrong.

**Status:** met. The contract holds across 10,000 seeds, and the Nav Plot plays
end to end — gather, file, catch the liars, commit, win. See
[MYSTERY.md](./MYSTERY.md), including the playtest finding on how the
contradiction panel was quietly arguing for the wrong answer.

---

## M3 — Crew, ship and pressure — **done**

*Goal: the ship becomes a thing you care about.*

Shipped:
- Named roster: the captain (the player) plus security, science and medical
  officers; two generic pools (12 crew, 12 security staff), numbers only
- Away missions with skill-gated approaches, legible odds, and a harm ladder
  (generics before officers, injuries before deaths, the captain last)
- **The medbay on a day clock**: wounded officers are out of action for 6
  days with a fit medical officer aboard, 12 without, shown as "medbay Nd"
  on the roster. Travel, scooping, missions and decoding all spend days
- Promotion: a generic steps up into a dead officer's chair, gaining a name
  and starting weaker
- Skill-gated decoding: artefacts recovered without science arrive
  unreadable; a dead science chair with an empty pool leaves them dark
- ~~Morale in four bands with a two-stage mutiny fuse~~ — *shipped in M3,
  then removed by design revision alongside the narrative layer: the crew
  of the Ithaca are loyal to the end, and the pressure is material rather
  than political. Empty stores now stop damage control and send away teams
  down hungry instead of souring anyone.*
- **Supplies** drain a point a day; an empty hold halts hull repair and
  costs away teams 10% off the clean outcome; restock (2 days) at
  habitable or faction systems
- **Drive scarring**: a failed Long Jump (or a late Rift Surge) scars the
  drive for +30% lane costs until a 4-day refit in a faction yard
- **Rift Surges** on a seeded, escalating schedule: fuel venting, spoiled
  stores, an officer injured, then drive scarring — the design's soft clock
- **Consult the Bridge**: science points at the nearest uncollected thread,
  medical reads the medbay and stores, security counts what is left. A
  mutinous crew gives the captain nothing

Deferred beyond M3, with reasons:
- Power allocation and per-subsystem damage — belongs with ship combat (M5),
  where the reactor budget becomes a per-round decision
- Per-crew loyalty and loyalty-gated clue release — the generic pools have
  no individuals to be loyal; revisit if the roster model ever deepens
- Constraint degradation on weak decode rolls — the undecoded-artefact gate
  covers the same strategic ground with less risk to puzzle solvability

**Done when:** losing your xenolinguist visibly hurts your chances of getting home.
**Status:** met, twice over — undecoded artefacts go dark without a science
officer, and the calendar the medbay runs on is the same one the Rift's
surge schedule and the supplies drain are counting.

---

## M4 — Planets and away missions

*Goal: places worth going to.*

- Planet generation and trait-driven site eligibility
- Site archetypes + authored choice nodes with skill checks and visible odds
- Away team selection, equipment locker and loadout
- Hazards, injuries, contamination, equipment loss
- Real authored clue prose replacing M2 placeholders
- Ground encounters resolved by **check-based abstraction** for now

**Done when:** the decision of whom to send down is genuinely difficult.

---

## M5 — Ship-to-ship combat

*Goal: space has teeth, and mercy has value.*

- Range bands, manoeuvre, per-round power allocation, initiative
- Beams / torpedoes / subsystem targeting / hail / flee
- Encounter posture choice (hail, scan, evade, engage, ambush)
- Disable-vs-destroy: salvage, nav computers, prisoners
- Faction AI archetypes; threat scaling with Drift
- Prisoners as an ongoing logistical and moral problem

**Done when:** taking a ship intact is measurably better play than destroying it.
**Status:** first cut shipped ahead of schedule, FTL-school rather than
range-band: real-time pausable combat with reactor allocation, per-room
damage, subsystem targeting, ion/beam research unlocks, withdraw-vs-fight,
and outcomes that re-enter the reducer as replayable actions. Encounters
(with 40 authored dialogues), the research trees and culture standings
landed with it — see docs/ENCOUNTERS.md. Range bands, hail/scan postures,
disable-vs-destroy and prisoners remain open.

---

## M6 — Infantry combat

*Goal: boarding actions and the ground fights that earned it.*

- Zone maps, cover, initiative, move/fire/aim/suppress/grapple
- Stun vs lethal with faction and morale consequences
- Boarding actions reusing the system with enemy decks as zones
- Wounds carried back to the medbay
- Retrofit M4's abstract ground encounters onto the tactical system

**Done when:** boarding a raider for their charts is the tensest thing in the game.

---

## M7 — Factions, economy and endings

*Goal: a world with politics, and a payoff.*

- Faction reputation, rival pairs, territory, safe passage
- Markets, trade goods, prices varying by region and standing
- Reputation-gated archives as premium clue sources
- Crew personal threads with triggers and resolutions
- All six endings with per-crew epilogues
- Full-run balance pass: fuel curve, clue density, threat curve

**Done when:** diplomacy is a viable route home without firing a shot.

---

## M8 — Polish

- Alien tech and strange (not merely bigger) upgrades
- Portrait composition, CRT presentation pass, sound
- Onboarding: first 10 minutes must teach the Nav Plot
- Accessibility: keyboard-only play, screen-reader log, colourblind-safe map
- Ironman/casual toggle, run stats, seed sharing
- Playwright smoke flows; performance pass on the map

---

## Risk register

| Risk | Impact | Mitigation |
|---|---|---|
| Two tactical combat systems eat the schedule | High | M4 ships abstract ground combat; M6 is deferrable without breaking the game |
| Generated puzzles are unsolvable or trivial | Fatal | Solvability proof in the generator + 10k-seed property test, built in M2 |
| Procedural content reads as flavourless | High | Map is procedural, *prose is authored*; content pool grows every milestone |
| Deduction UI is confusing | High | Nav Plot prototyped in M2 and playtested before any combat work starts |
| Scope creep into a 4X | Fatal | No colonies, no fleets, no economy simulation. One ship, one crew, one way home |
