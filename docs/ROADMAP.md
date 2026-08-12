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

## M3 — Crew, ship and pressure — **first slice done**

*Goal: the ship becomes a thing you care about.*

Shipped in the first slice (officers-and-redshirts model):
- Named roster: the captain (the player) plus security, science and medical
  officers; two generic pools (12 crew, 12 security staff), numbers only
- Away missions to collect defended evidence: team selection, skill-gated
  approaches, legible odds, casualties, injuries with a healing clock
- Harm ladder: generics absorb losses before officers; the captain can lead
  in person and dying out there ends the run
- Promotion: a generic steps up into a dead officer's chair, gaining a name
  and starting weaker — the ship keeps a science officer, not that one
- Skill-gated decoding: artefacts recovered without science arrive unreadable
  and stay off the Nav Plot until a fit science officer decodes them
- Per-crew epilogues in both endings

Still to come in M3:
- Ship subsystems, integrity, damage, repair, power allocation
- Consumables (food, medicine, parts) and the hold-space trade-off
- Morale, loyalty, refused orders → mutiny; loyalty-gated clue release
- **Consult the Bridge** and unprompted officer hints
- Constraint degradation on weak decode rolls
- Drift counter and escalating Rift Surge events

**Done when:** losing your xenolinguist visibly hurts your chances of getting home.
**Status of that bar:** met by the slice — kill the science officer with an empty
crew pool and every undecoded artefact aboard goes permanently dark.

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
