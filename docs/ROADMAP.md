# Starship Ithaca — Build Roadmap

Ordering principle: **the scenes and the mystery are the game.** The deduction
engine is built and proven; the R-series turns the game dialogue-first and
adds the technological and research tracks. Each milestone ends with something
playable, not something merely built.

R1 comes before everything else because every later milestone — research
proposals, component discovery, recruitment, surrender negotiations — is
expressed *through* scenes. Building combat or the tech tree first would mean
building their interfaces twice.

---

## Foundation (the former M0–M3) — **done**

What the R-series builds on, all shipped and tested:

- Pure, seeded, deterministic rules engine; `(state, action) => {state, events}`;
  a seed plus an action log always replays identically
- Worldgen: 70–110 systems, lane graph, regions; travel, fuel, scooping,
  derelict salvage; the stranded loss ("the long silence")
- **The mystery**: constraint clues, trust/doubt filing, contradiction and
  corroboration detection, false clues with decoy consistency, and a
  **solvability proof** holding across a 10,000-seed property test
- The Nav Plot UI: evidence board, live candidate list, map overlay
- Crew: named roster with portraits, away missions with legible odds and a
  harm ladder, injuries on a medbay day-clock, promotion from the ranks,
  skill-gated decoding
- Rift Surges on a seeded escalating schedule; drive scarring and refits
- A real equipment locker: loadouts in engine state, feeding mission odds and
  injury rolls
- The opening bridge briefing — the presentation prototype for R1's scenes

Removed in the pivot (R0): morale, mutiny, and supplies. Pacing pressure now
rests on fuel and the surge schedule.

---

## R0 — The pivot — **done**

*Goal: the design of record matches the game being built.*

- DESIGN.md rewritten around the three-track goal (place / engine / shield),
  dialogue-first delivery, research and translation, recruitment and
  experience, destroy-or-drive-off combat ✓
- Morale, the mutiny fuse, volunteer caps, and fractious-crew penalties
  removed from engine, UI and tests ✓
- Supplies and resupply removed; the rift surge that spoiled stores now vents
  fuel harder ✓
- Endings reduce to: home, the long silence, the captain lost — combat adds
  "lost with all hands" in R5 ✓

**Done when:** the docs describe the new game, the engine contains no morale or
supplies state, and the full test suite passes.

---

## R1 — The encounter engine ★ — **done**

*Goal: everything arrives through a scene. This is the milestone that matters.*

- Scene schema: trigger, cast, beats with casting slots, options with
  requirements (fit officer, skill, gear, later tech tier) and effects that
  dispatch ordinary reducer actions
- Seeded casting: templates bound to systems, payloads and cast at worldgen;
  deterministic and replayable — a dialogue choice is an action in the log
- Arrival triggers: reaching a system with content fires its scene; empty
  systems stay quiet so silence keeps meaning
- Scene UI generalised from the briefing screen: portraits, speaker
  attribution, beats, choice buttons carrying their odds and requirements
- Clue delivery moves into scenes: social sources play as conversations;
  hazardous sites play as scenes whose options are the mission approaches,
  team selection included
- Template pool v1: at least one family per source kind (trader, castaway,
  derelict, ruins, holdout, listening post, crew memory)

**Done when:** every clue in a run arrives through a scene where at least one
choice mattered, and a replayed action log replays the same conversations.

---

## R2 — Research and translation — **done**

*Goal: understanding is a track, and the science officer drives it.*

- Tech state and a research bench screen (the lab, repurposed): projects cost
  days with a fit science officer; skill and specialists set the pace
- **Translation tiers** gate alien accounts — the undecoded-artefact mechanic
  generalised: held but dark until comms research catches up, and the player
  can always see what they are missing
- Science-officer proposal scenes: research options pitched in dialogue, not
  menus
- Tree v1: comms tiers, sensors, medbay improvement, and the two R3 slots
  (rift engine, rift shielding) visible but unbuildable
- Understanding is gated by time and crew only — never by findable materials

**Done when:** a run is visibly blocked on understanding an alien account until
comms research completes, and the player knew it the whole time.

---

## R3 — The three-part way home — **done**

*Goal: the win condition is place + engine + shield.*

- Engine and shield **components** as scene payloads placed at worldgen —
  wrecks and traders skew engine, ruins and hazard sites skew shield
- Rift engine and rift shielding as research projects requiring their
  components; the Long Jump refuses until both are built and says what is
  missing
- **Solvability contract extended across all three tracks** and enforced by
  the 10k-seed property test: every run can find the place, the parts, and
  read enough evidence at achievable tiers
- The Long Jump becomes a ceremony: the commit, the burn, the reveal

**Done when:** 10,000 seeds prove every run can finish all three tracks, and
losing a component source never silently strands a run.

---

## R4 — A map worth staring at — **done**

*Goal: the galaxy looks like the place the scenes happen.*

- System view: click a system, see its star and planets rendered
  (procedurally, per seed) with the scene hooks visible on them
- Visual pass on the chart: richer starfield, region texture, lane rendering
- Scene triggers surfaced on the map — the place something happened is a place
  the player remembers

**Done when:** a playtester pans the map for pleasure and can point to where
each story beat happened.

---

## R5 — Ship-to-ship combat — **done** *(rebuilt FTL-style in R5.5 — see DESIGN §9)*

*Goal: space has teeth; intelligence has value.*

- Seeded hostile contacts by region and rift escalation
- Contact opens as a posture scene: hail, evade, engage — odds stated
- Turn-based resolution, legible numbers: range, power to shields or guns,
  fire or break off; gunnery skill and weapons research feed it
- Destroy or drive off; **surrender when the player holds intelligence** on
  the enemy — yielding accounts, components or fuel without a shot
- Hull damage persists; yard repairs; the "lost with all hands" ending
- No boarding, no capture logistics, no infantry system

**Done when:** a fight can be won, fled, or — with the right knowledge —
never fought at all, and the player can say why each time.

---

## R6 — Crew depth — **done**

*Goal: the roster grows, and the people on it grow.*

- Recruitment through station and rescue scenes: specialists (gunner,
  linguist, engineer, physicist) join as named, portraited people
- Experience: skills rise through use — missions, research, battles — and
  every system that reads skill feels it
- Roster UI beyond the founding four; specialists assignable where they help

**Done when:** two runs diverge meaningfully because of who was recruited and
who was lost.

---

## R7 — Polish and the payoff — **in progress**

- Save/resume (autosave; the state was built serialisable from day one) ✓
- The post-run **truth reveal**: every account stamped true/false against how
  the player filed it, plus run stats ✓
- Seed entry and sharing on the title screen ✓; station hotkeys (1–4) ✓
- Per-crew epilogues (home ending has them; the loss endings do not yet)
- Audio beyond the hub; colourblind-safe map
- Onboarding: the first ten minutes teach the Nav Plot through scenes

---

## Risk register

| Risk | Impact | Mitigation |
|---|---|---|
| Scene authoring volume eats the schedule | High | Templates + seeded casting, never one-off scenes; pool grows every milestone |
| Three mandatory tracks feel like a checklist | High | Any landing can advance any track; tracks share the scene delivery |
| Extended solvability contract breaks | Fatal | Extend the 10k-seed property test in R3 before balancing anything |
| Generated puzzles unsolvable or trivial | Fatal | Existing proof retained and extended |
| Procedural content reads as flavourless | High | Map is procedural, *prose is authored*; template pool grows every milestone |
| Scope creep into a 4X | Fatal | No colonies, no fleets, no economy simulation, no second combat system |
