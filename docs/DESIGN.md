# Starship Explorer — Game Design Document

> You are the captain of a ship that is very far from home, with a crew you
> live alongside, a drive that cannot make the jump, and no chart that means
> anything. Somewhere out there is the way back — and the knowledge, the
> engine and the shielding it takes to survive it. Go and find them.

**Genre:** narrative space adventure / dialogue-driven exploration RPG
**Inspiration:** *Starship Traveller* (Fighting Fantasy #4), with the branching
paragraph book replaced by an open, seeded galaxy — and the paragraphs replaced
by scenes between people.
**Platform:** Web app — TypeScript + React (Vite), headless rules engine
**Map:** procedurally generated per seed, populated from a hand-authored content pool
**Win condition:** three tracks, all required — deduce *where* home is, build the
*engine* that can reach it, and build the *shield* that survives the rift.

---

## 1. The pitch

The *Indefatigable* enters a jump anomaly and comes out somewhere the star
charts do not describe. Familiar space is reachable — the anomaly has a far
end — but nobody aboard knows which of ninety stars it hides behind, and the
drive that was dragged through it could not make the return transit even if
they did.

You live on the ship. The game happens in conversation: arrive at a new world
and *something happens* — an officer notices a signal, an alien hails the ship,
a landing party finds something half-buried — and the scene plays out between
faces you know, with choices that matter. Out of those scenes comes everything
the voyage runs on:

- **Accounts** of the anomaly, which narrow down where home is. Some are lies.
- **Technology** — salvage, wreckage, and alien science that becomes the rift
  engine and rift shielding the return jump demands.
- **Understanding** — research that unlocks the rest: you cannot use what an
  alien tells you until you can understand the alien.

When all three are in hand — the place, the engine, the shield — you commit
everything to one jump. The game grades how much of your ship and your people
you brought home.

**The fantasy:** being a competent captain of a wounded ship, living among a
crew of individuals, and assembling the way home piece by piece from
conversations, ruins and wrecks.

---

## 2. Design pillars

1. **Everything arrives through a scene.** Clues, technology, recruits,
   fights, research prompts — the delivery mechanism is dialogue between
   characters with portraits and choices, never a bare button. The ship is a
   place; the crew are the interface.
2. **Information is the treasure.** Fuel and guns are means; knowledge is the
   end. Every system in the game should be able to answer "…and how does this
   help me get home?"
3. **The crew are people, not stats.** Names, faces, voices, permanent deaths —
   and growth: crew gain experience, and new faces can be recruited at
   stations. Losing your xenolinguist is a strategic wound; finding a better
   one is a strategic win.
4. **Deduction the player performs, not the character.** The game never says
   "you have found 7/10 clues". It gives you evidence and a plotting table, and
   *you* work out where home is. Being wrong must be genuinely possible.
5. **Legible systems, hidden content.** Rules are transparent and shown as
   numbers and odds. The galaxy's contents are not.

---

## 3. The core loop

```
        ┌────────────────────────────────────────────────────────┐
        │                                                        │
        ▼                                                        │
  ┌───────────┐  burn fuel  ┌────────────┐   a scene fires  ┌────┴─────┐
  │ STAR MAP  │────────────▶│   ARRIVE   │─────────────────▶│ ENCOUNTER │
  │ choose a  │             │ somewhere  │  someone notices │ dialogue, │
  │ system    │             │    new     │  something…      │ choices,  │
  └───────────┘             └────────────┘                  │ missions  │
        ▲                                                   └────┬──────┘
        │                     spend crew, days, fuel             │
        │                     gain accounts, tech, recruits      │
        │                                                        ▼
        │                ┌──────────────────┐         ┌──────────────────┐
        └────────────────│    NAV PLOT      │◀───────▶│  RESEARCH BENCH  │
          new candidates │ file accounts,   │ unlocks │ translate, study,│
                         │ eliminate stars, │ reading │ build the engine │
                         │ decide who lied  │         │ and the shield   │
                         └────────┬─────────┘         └────────┬─────────┘
                                  │  location known            │ engine + shield built
                                  └──────────────┬─────────────┘
                                                 ▼
                                          THE LONG JUMP
                                         (win or disaster)
```

**Session shape:** a run is 4–8 hours, 40–80 jumps. The player should play
their first scene within two minutes, file their first account within ten, and
have all three tracks visibly moving by the first hour.

---

## 4. The three tracks

Getting home requires all three. They are pursued through the same activity —
flying somewhere and playing the scene that fires there — so the player is
never grinding one bar; any landing can advance any track.

### 4.1 Navigational — *where is it?*

The deduction. Accounts of the anomaly are constraints over star systems; the
candidate set is every system consistent with what the player trusts; some
accounts are lies, catchable only through contradiction and corroboration.
This is the spine of the game and is specified in §5.

### 4.2 Technological — *what can reach it?*

The return transit needs two things no yard sells:

- **The rift engine.** Built from recovered components — an intact drive core
  from a wreck, alien machining, exotic fuel handling. Components are scene
  payloads: they are found in derelicts, traded for, dug out of ruins.
- **The rift shielding.** The anomaly tears unprotected hulls apart.
  Shield-frame components are found the same way, disproportionately in the
  hazardous places.

Components are discovered through scenes and *assembled* through research
projects (§6). The Long Jump is refused until both are built — and the plot
screen says exactly what is still missing.

### 4.3 Understanding — *can we even read what we have?*

A research track that gates the other two:

- **Translation.** Alien accounts and inscriptions arrive unreadable. Comms
  research raises the ship's translation tier; each tier makes another band of
  sources legible. An untranslated account is held but dark — the player can
  see what they are missing.
- **Analysis.** Some components cannot be identified, and some accounts cannot
  be fully assessed, below a given science tier.

Research costs days and needs the right people (§7): the science officer's
skill sets the pace, and specialist recruits accelerate it. The science
officer *proposes* research through scenes — a portrait, a pitch, options —
rather than the player reading a menu.

**Solvability rule:** understanding is gated by *time and crew*, never by
findable materials — so no seed can strand the player unable to read the only
evidence that remains. The generator's contract (§5.2) is extended so that
every run can find the place, the engine parts, and the shield parts.

---

## 5. The mystery: accounts, constraints and deduction

Unchanged in substance from the first design, and already implemented with a
proven generator. Summarised here; see [MYSTERY.md](./MYSTERY.md) for the
measured behaviour.

### 5.1 Model

At worldgen the generator picks one **Gateway system**. Every account is a
**constraint** — a predicate over star systems (direction, proximity, star
type, features, region, isolation, faction adjacency, anomaly). The player's
candidate set is every system satisfying all constraints they currently
*trust*. Accounts carry authored prose, a source, a shown-but-noisy confidence,
and a hidden truth flag.

### 5.2 Generation contract

The generator proves the puzzle before shipping it: solvable (true accounts
resolve to exactly the Gateway), non-trivial, not a slog, falsifiable (2–4
lies, each consistent with a decoy), catchable (every lie exposable with at
most two honest accounts), and reachable within the fuel budget.

**Extended for the three tracks:** engine and shield components must be placed
and reachable, and enough accounts must be legible at achievable translation
tiers that the deduction can proceed while research catches up. Verified by
the 10k-seed property test.

### 5.3 Where accounts and components come from

| Source | Scene shape | Yields |
|---|---|---|
| Alien trader | Negotiation; options improve with comms tier | Accounts (they lie for profit), components for barter |
| Derelict hulk | Away mission through the wreck | Log-core accounts, engine components, fuel salvage |
| Ruins | Away mission; translation-gated | Inscription accounts, shield components |
| Holdouts / castaways | Talk or force; how you go in decides how it ends | Accounts, occasionally a recruit |
| Listening post | Away mission; may be rigged | Signal accounts, comms components |
| Faction station | Docking scenes | Recruits, refit, components for trade |
| Crew memory | An officer speaks up on arrival somewhere relevant | Accounts, free but vague |

### 5.4 The Nav Plot (the deduction UI)

The game's signature screen, unchanged: evidence board with Trust/Doubt
filing, live candidate list and map overlay, contradiction detection (the only
way to catch liars), corroboration, and the commit button. **Never show a
progress bar** — the candidate count is the progress bar, and it can go up
when you doubt something. The plot screen also shows the technological track's
state plainly: what is built, what is missing, where the trail points.

### 5.5 Committing: the Long Jump

Charging the jump costs a large fixed fuel reserve, and requires the rift
engine and shielding built.

- **Correct →** ending, graded (§10).
- **Wrong →** the ship is flung to a far corner of the map with almost nothing
  in the tank and a scarred drive. Survivable perhaps twice. Never a game over
  by itself — the game over is running out of the means to keep looking.

---

## 6. Encounters: the scene engine

The delivery mechanism for the whole game.

### 6.1 Shape

A **scene** is: a trigger, a cast, a sequence of beats, and a set of options.

- **Triggers:** arriving at a system with content; docking at a station;
  returning from a mission; a research threshold; a rift surge; an officer
  with something to say.
- **Cast:** drawn from the roster (portraits the player knows) plus scene
  figures — a trader, a castaway, a voice on the wideband.
- **Beats:** authored prose with casting slots (names, places, the payload),
  presented as dialogue with portraits — the briefing scene's presentation,
  generalised.
- **Options:** 2–4, each a real decision: an approach with visible odds, a
  cost in days or fuel, a requirement (a fit officer, a skill, a translation
  tier, a piece of gear), or a refusal. Options dispatch engine actions;
  scenes never contain rules of their own.

### 6.2 Authoring model

Scene *templates* are authored; the seed *casts* them. A template knows its
shape ("derelict, first contact, something is still drawing power") and its
slots; worldgen binds it to a system, a payload (account, component, recruit),
and a cast. Content grows by adding templates, never by touching engine code.
This is the same authored-prose-over-procedural-placement bet the mystery
already makes, and it is the project's main content cost — the template pool
grows every milestone.

### 6.3 Missions are scenes

An away mission is a scene whose options are the approaches, with the odds
printed on them, and whose team is chosen in the scene. Harm follows the
established ladder (escorts, then hands, then officers, then — only leading in
person — the captain). Injuries persist; the medbay runs on the calendar.

---

## 7. Crew

### 7.1 Model

The founding roster: the captain (the player) and department officers —
security, science, medical — with names, portraits and skills, above small
pools of unnamed security staff and crew hands. A generic gains a name and a
face on promotion into a dead officer's chair.

**Growth beyond the founding four:**

- **Recruitment.** Stations and scenes offer specialists — a gunner, a
  linguist, a rift-physicist, an engineer. Recruits join the roster as named
  people with portraits and their own skills.
- **Experience.** Officers and specialists gain skill through use: missions
  led, research completed, battles fought. Skill feeds every system that
  reads it — mission odds, research pace, combat effectiveness, negotiation
  options.

### 7.2 Crew as the interface

Officers speak when there is something to say: arrival scenes, research
proposals, warnings. **Consult the Bridge** remains: each fit officer gives a
working opinion from real state — the nearest unexamined thread, the medbay
docket, what the boards show. The bridge is the quest log.

### 7.3 Injury and death

Away missions and ship combat hurt people. Injured crew sit in the medbay by
the calendar (faster with a fit medical officer); dead crew are dead, named in
the epilogue. There is no morale meter and no mutiny — the cost of a bad
landing is the people it costs.

---

## 8. Galaxy, travel and the map

- 70–110 systems, jump lanes, regions, seeded generation — as built.
- **Fuel is the master clock.** Scooping at gas giants and draining swept
  derelicts refills it; lanes burn it; a scarred drive burns 30% more.
- **The Rift Surge schedule** is the soft pressure clock: seeded, escalating,
  and forecastable by a good science officer. Surges vent fuel, injure crew,
  and scar the drive.
- **Stranded** remains a loss: no affordable lane, nothing to scoop, the
  reserve out of reach.
- **Presentation:** the chart is the strategic view; each system opens into a
  **system view** with its planets rendered — the place scenes visibly happen.
  The map should be worth staring at: it is where the player lives between
  scenes.

---

## 9. Ship-to-ship combat

FTL-style: real-time with pause, rooms, power and weapon variety — and still
avoidable and legible.

- **Contact opens with a posture scene:** hail, evade, or engage — with the
  odds and the stakes stated. Tolls can be paid; intelligence ends fights
  before they start.
- **Battle is a room-based simulation.** The Indefatigable's compartments
  (engines, shields, two weapon rooms, launch bay, sensors, helm) hold power
  from a fixed reactor budget; the enemy's compartments are clickable
  targets. Weapons charge in real time and hold or auto-fire: the pulse
  laser is dependable, missiles ignore shields but spend a persistent
  magazine, the ion disruptor strips shields and disables rooms, the focus
  beam carves bare hull but never a raised shield. The launch bay flies
  drones; sensors, powered, reveal the enemy's weapon charge; breaking off
  charges the drive while they keep shooting.
- **Enemy variety is a catalog.** Ship classes cut from the fleet art, per
  faction archetype and in two tiers — the rift's escalation brings out the
  heavier hulls. Raiders swarm and break; patrols sit behind layered
  shields; polity hulls carry ion and beams.
- **Destroying the enemy is enough.** No boarding, no capture logistics.
- **Surrender happens to the informed:** intelligence on a faction takes a
  hurt patrol's colours mid-battle. Raiders never yield.
- Hull damage and spent missiles persist; yards repair and restock; a hulled
  ship is an ending.
- **Architecture:** the battle simulation runs in the UI; the engine stays
  deterministic. Contacts, ship classes, posture dialogue and rewards are
  engine rules, and the battle's outcome enters the action log as a
  `combatResolve` action — a replayed log carries the result the way it
  carries every other player decision.

There is **no separate infantry combat system**. Ground violence resolves
inside scenes with the mission odds machinery.

---

## 10. Endings

Graded on arrival, not just pass/fail, with the epilogue naming individual
crew and what became of them — the payoff for permadeath.

- **Home** — graded by who and what made it back
- **The long silence** — stranded: no fuel, no leads, no way to make more
- **The captain did not come back** — lost leading from the front
- **Lost with all hands** — the ship destroyed

---

## 11. Technical architecture

Unchanged in principle; the engine remains pure, seeded and deterministic.

- **The engine is pure.** `(state, action) → (state, events)`; all randomness
  from a seeded PRNG; a seed plus an action log always replays identically.
- **The UI renders state and dispatches actions.** If a number is computed in
  a component, that is a bug.
- **Scenes are content, validated at build time.** Templates live in typed
  content modules; the caster binds them at worldgen; choices dispatch
  ordinary actions, so replay covers dialogue too.
- **Events drive the fiction.** The reducer emits events; scenes and the log
  render them.
- **Testing:** unit tests per system; the 10k-seed solvability property test
  (extended to all three tracks); golden replays.

---

## 12. Presentation

Text-forward, chart-heavy, faces everywhere:

- **Scene overlay** — portraits, beats, options; the game's most-used surface.
- **Star map & system view** — SVG chart plus rendered planets.
- **Nav Plot** — the evidence board; the signature screen.
- **Research bench** — the tree, the projects, the officer's proposals.
- **Combat** — schematic, range strip, legible numbers.
- **The ship** — the cutaway hub, room views, the roster.

Aesthetic: amber/green CRT, thin rules, generous whitespace — *Alien*'s
MU-TH-UR by way of a paperback. Prose in second person, present tense, terse.

---

## 13. Open questions

1. **Save scumming.** Ironman-by-default with a casual toggle, or accept it?
2. **Long Jump attempts.** Survivable twice, or once?
3. **Run length.** A "short galaxy" option (40 systems, fewer components) is
   cheap and worth prototyping.
4. **Scene fatigue.** If every arrival fires a scene, arrivals at empty
   systems must stay quiet — silence needs to stay meaningful.

---

## 14. Scope guard

The failure mode for this project is building the galaxy simulation and never
building the game. The scenes and the mystery are the game. No colonies, no
fleets, no economy simulation, no second tactical combat system. One ship, one
crew, one way home.
