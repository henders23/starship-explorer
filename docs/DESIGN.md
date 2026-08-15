# Starship Explorer — Game Design Document

> You are the captain of a ship that is very far from home, with a crew that is
> frightened, a hold that is emptying, and no chart that means anything. Somewhere
> out there is the way back. Somebody knows where it is. Go and find out who.

**Genre:** narrative space adventure / light 4X-less exploration RPG
**Inspiration:** *Starship Traveller* (Fighting Fantasy #4), with the branching
paragraph book replaced by an open, seeded galaxy.
**Platform:** Web app — TypeScript + React (Vite), headless rules engine
**Map:** procedurally generated per seed, populated from a hand-authored content pool
**Win condition:** deduce the location of the way home from partial, sometimes false, evidence

---

## 1. The pitch

The *Ithaca* enters a jump anomaly and comes out somewhere the star charts
do not describe. Familiar space is reachable — the anomaly has a far end — but
nobody aboard knows which of nine hundred stars it hides behind.

The galaxy is open. You fly where you like. But every jump costs fuel you cannot
easily replace, and the only thing that actually wins the game is **information**:
scraps of astrogation lore held by traders, buried in ruins, locked in the nav
computers of ships you defeat, or sitting in the memory of a crewman who has not
yet thought to mention it. Each scrap narrows the field of candidate systems.
Some scraps are wrong.

When you think you know, you commit. You burn most of what you have left on one
jump. If you are right, you go home — and the game grades how much of your ship,
crew and honour you brought with you. If you are wrong, you are deeper in the
dark than before, with less of everything.

**The fantasy:** being a competent captain of a wounded ship, making hard trades
between your people, your hull and your knowledge.

---

## 2. Design pillars

1. **Information is the treasure.** Fuel, guns and crew are means; clues are the
   end. Every system in the game should be able to answer "…and how does this
   help me get home?"
2. **The crew are people, not stats.** They have names, wants, opinions and
   permanent deaths. They are also your hint system — a good captain listens to
   the bridge.
3. **Violence is one option and rarely the best one.** Every fight can be talked
   around, fled, or won without killing. Prisoners talk. Corpses don't.
4. **Deduction the player performs, not the character.** The game never says
   "you have found 7/10 clues". It gives you evidence and a plotting table, and
   *you* work out where home is. Being wrong must be genuinely possible.
5. **Legible systems, hidden content.** Rules are transparent and shown as
   numbers and odds. The galaxy's contents are not.

---

## 3. The core loop

```
        ┌──────────────────────────────────────────────────────┐
        │                                                      │
        ▼                                                      │
  ┌───────────┐   burn fuel   ┌───────────┐   resolve    ┌─────┴──────┐
  │ STAR MAP  │──────────────▶│  SYSTEM   │─────────────▶│  ENCOUNTER │
  │ choose a  │               │  arrive,  │              │ talk/fight │
  │ destination│              │  scan     │              │ /land/loot │
  └───────────┘               └───────────┘              └─────┬──────┘
        ▲                                                      │
        │                              spend crew, hull, parts │
        │                              gain fuel, gear, CLUES  │
        │                                                      ▼
        │                                            ┌──────────────────┐
        └────────────────────────────────────────────│    NAV PLOT      │
                        new candidate set            │ file clues,      │
                                                     │ eliminate stars, │
                                                     │ decide who lied  │
                                                     └────────┬─────────┘
                                                              │ commit
                                                              ▼
                                                        THE LONG JUMP
                                                       (win or disaster)
```

**Session shape:** a run is 4–8 hours, 40–80 jumps. The player should file their
first clue within 10 minutes and have a shortlist of ~5 candidate systems by the
midpoint.

---

## 4. The mystery: clues, constraints and deduction

This is the spine of the game and should be built first.

### 4.1 Model

At worldgen the generator picks one **Gateway system** from the map. Every clue
is a **constraint** — a predicate over star systems. The player's candidate set
is every system on the map satisfying all constraints they currently *trust*.

```ts
type Constraint =
  | { kind: 'direction';  of: SystemId; dir: 'coreward'|'rimward'|'spinward'|'trailing' }
  | { kind: 'proximity';  of: SystemId; op: 'within'|'beyond'; jumps: number }
  | { kind: 'starType';   is: StarType; negated: boolean }    // binary, neutron, red giant…
  | { kind: 'contains';   feature: SystemFeature; negated: boolean } // gas giant, ring world, belt, derelict beacon
  | { kind: 'adjacency';  faction: FactionId; negated: boolean }     // borders territory of…
  | { kind: 'region';     is: RegionId; negated: boolean }    // "somewhere beyond the Xenoline"
  | { kind: 'isolation';  op: 'atMost'|'atLeast'; lanes: number }
  | { kind: 'anomaly' }                                       // the same rift echo that took us

interface Clue {
  id: ClueId
  constraint: Constraint
  prose: string                 // authored, source-flavoured phrasing
  source: ClueSource            // who told you, and how they knew
  truth: 'true' | 'false'       // hidden from the player
  confidence: number            // 0..1 shown to the player, from source reputation
  corroborates: ClueId[]        // resolved at runtime when two clues agree
  state: 'unfiled' | 'trusted' | 'doubted'   // player's own call
}
```

### 4.2 Generation contract

The generator must **prove the puzzle before shipping it**. After placing the
Gateway and drafting clues it runs the filter itself and asserts:

- **Solvable:** the set of all *true* clues resolves to exactly one system — the Gateway.
- **Non-trivial:** no subset of ≤ 3 true clues resolves to fewer than 4 candidates.
- **Not a slog:** ~8 true clues should get the player to a shortlist of ≤ 3.
- **Falsifiable:** 2–4 false clues exist. Each false clue is *consistent with a decoy
  system*, so a player who trusts it lands somewhere plausible rather than nowhere.
  The decoy must satisfy ≥50% of the honest evidence, or the deception never gets
  off the ground.
- **Catchable:** every false clue must be exposable by combining it with **at most
  two** honest clues. A lie the player can never catch is a trap, not a puzzle —
  and this clause is what makes gathering *redundant* evidence the counter-play.
- **Reachable:** every clue's source is reachable from the start, and a greedy
  nearest-source gathering tour collects enough evidence to solve within the fuel
  budget (≤60 jumps). Redundancy: ≥1.6× the minimum required clues exist.

If any assertion fails the generator rerolls. Worldgen is cheap; broken runs are not.

The proof must be a pure function of the puzzle it is proving. The "not a slog"
clause samples random clue orderings, and if that sampling drew on caller-supplied
randomness the generator could accept a puzzle an independent re-prover then
rejects — so the sampling stream is derived from the puzzle's own content.

**Status: implemented and passing.** See [MYSTERY.md](./MYSTERY.md) for the
prototype, its measured behaviour across 10,000 seeds, and how to inspect a
generated puzzle.

### 4.3 Where clues come from

| Source | How it's earned | Reliability |
|---|---|---|
| Crew memory | A specialist recalls something when you visit a relevant place, or after a morale/trust threshold | High, but vague |
| Alien trader | Bought with credits, cargo, or a favour | Medium — they lie for profit |
| Derelict log | Away mission into a hulk; salvage + hazard | High if your comms officer can decode it |
| Ruins / tablets | Planetary exploration + xenolinguist | High; useless without a translator |
| Prisoner | Ship combat won *without* destroying the enemy, then interrogation | Medium — depends on how you treat them |
| Faction archive | Reputation gate, not a fight | Very high, expensive in politics |
| Listening post | Found by scanning; may be trapped | Medium |
| Another castaway | Rare; a whole cluster of clues and a moral problem | High |

**Skill gating that matters:** a raw clue arrives as an artefact — an alien
inscription, a corrupted log, a star chart in an unknown projection. Your
**Science / Comms / Xeno** specialists convert artefacts into constraints. A weak
specialist produces a *degraded* constraint ("within 4 jumps" instead of
"within 2") or, on a bad roll, a **silently false** one. Losing your xenolinguist
on an away mission is a real strategic wound.

### 4.4 The Nav Plot (the deduction UI)

A dedicated screen, and the game's most important piece of interface:

- **Evidence board** — every clue as a card: its prose, its source, its confidence,
  and a `Trust / Doubt` toggle.
- **Candidate list & map overlay** — remaining systems given trusted clues, live-updating
  as you toggle. Systems you haven't visited are shown by their *catalogued* properties
  only, so scanning has deductive value even in empty space.
- **Contradiction detector** — when two trusted clues cannot both be true, the pair
  is flagged red. This is the only way to catch liars, and it's why you seek
  redundant evidence instead of just enough evidence.
- **Corroboration** — two independent sources implying the same constraint promotes
  both to `corroborated`, visibly. Corroborated clues are never false.
- **Plot the Jump** — commit button, gated behind a confirmation showing the cost.

**Never show a progress bar.** The candidate count *is* the progress bar, and it
can go up when you doubt something.

### 4.5 Committing: the Long Jump

Charging the Gateway jump costs a large fixed fuel reserve plus drive integrity.

- **Correct →** ending, graded (see §11).
- **Wrong →** the ship is flung to a random far corner of the map, takes heavy
  drive/hull damage, morale collapses, and some fuel is lost. It is survivable
  perhaps twice. It is never a game over by itself — the game over is running out
  of the means to keep looking.

---

## 5. Galaxy and travel

### 5.1 Map

- 70–110 systems in a 2D field, presented as a star chart. Generated from seed.
- **Jump lanes** connect systems within drive range; the graph is sparse and
  irregular (some hubs, some dead ends, a few chokepoints).
- **Regions** give the map texture and set encounter tables:
  - *The Shallows* — where you arrive. Sparse, quiet, low-threat tutorial ground.
  - *Trade Reach* — dense, factioned, markets and politics. Clue-rich, dangerous socially.
  - *The Cinder Belt* — dead stars, salvage, radiation, derelicts.
  - *Xenoline* — alien polity space; access gated on diplomacy.
  - *The Rift Margin* — anomalous, hazardous, and where the best Gateway evidence lives.
- **Fog of war:** unvisited systems show only catalogue data (star type, rough
  position). Contents revealed by arriving and scanning, or by rumour.

### 5.2 Travel economy

**Fuel is the master clock.** Jump cost scales with distance; long jumps are
disproportionately expensive, so route planning matters.

Fuel comes from: scooping gas giants (slow, safe, needs a working scoop),
refining at stars (risky), trade (expensive), and salvage (uncertain).

There is **no hard turn limit**. Pressure instead comes from:
- consumables draining (fuel, food, medicine, parts),
- a **Drift** counter — the rift keeps pushing; every N jumps, a Rift Surge event
  fires, escalating in severity, and can shift lanes or close routes,
- an escalating pursuing threat once the wrong people learn you're carrying
  Gateway evidence.

This gives urgency without a countdown clock the player can see and resent.

---

## 6. The ship

The *Ithaca* is a state object, a resource pool, and a character.

### 6.1 Subsystems

Each has integrity 0–100 and a power draw. Damage is persistent; repair costs
Spare Parts and time.

| System | Function | When it's broken |
|---|---|---|
| Reactor | Total power budget | Everything is worse at once |
| Jump Drive | Max jump range, charge time | Shorter hops, longer waits |
| Manoeuvre | Evasion, range control in combat | Can't escape, can't close |
| Shields | Damage soak | Fights become lethal |
| Weapons | Beam & torpedo banks | Only diplomacy and running |
| Sensors | Scan depth, detection, target locks | Blind — clue-bearing sites go unnoticed |
| Comms | Hailing, decryption, translation | Clue artefacts stay unreadable |
| Life Support | Crew health & morale ceiling | A slow, awful clock |
| Medbay | Injury recovery, revive-from-critical | Wounds become deaths |
| Shuttle Bay | Away missions, salvage capacity | No landings |

### 6.2 Power allocation

A budget the player splits between Shields / Weapons / Drive / Sensors / Life
Support. Adjustable on the star map (strategic) and each round in combat
(tactical). Reactor damage shrinks the budget, which is how the ship *feels*
wounded rather than just showing a smaller number.

### 6.3 Cargo & resources

`Fuel · Spare Parts · Food · Medicine · Ordnance · Credits · Trade Goods · Artefacts`

Hold space is finite — carrying trade goods means not carrying fuel. Artefacts
are clue-bearing and some are also cursed, hot, or wanted by a faction.

### 6.4 Away-team equipment

Loadout chosen per mission, drawn from a limited locker:

- **Sidearms** — stun / lethal setting, a real choice with real consequences
- **Armour** — weight vs protection
- **Medkits**, **Environment suits** (hostile atmospheres), **Scanners**
- **Translator matrix** — required to convert many artefacts into clues
- **Breaching charges**, **Beacon** (emergency recall — costs the shuttle)

Alien tech can be salvaged and installed on ship or team, with a risk of side
effects. Late-game upgrades should be *strange*, not just bigger numbers.

---

## 7. Crew

### 7.1 Model

12–20 named crew. Start with ~14; they only ever get scarcer without recruiting.

```ts
interface CrewMember {
  id, name, species, portraitSeed
  role: 'Command'|'Pilot'|'Science'|'Engineering'|'Security'|'Medical'|'Comms'
  skills: { pilot, science, engineering, combat, medicine, xeno }  // 0-5
  traits: Trait[]          // 'Steady', 'Reckless', 'Xenophobe', 'Devout', 'Deserter'…
  health: number           // wounds persist; 0 = dead, permanently
  morale: number           // personal, feeds ship morale
  loyalty: number          // to you specifically
  thread?: PersonalThread  // their own story, see 7.3
  knowledge: ClueId[]      // what they know but haven't said yet
}
```

### 7.2 Crew as the hint system

This is the *Starship Traveller* bridge-officer feel, and it replaces a quest log.

- On arriving somewhere relevant, an officer speaks up unprompted:
  *"Captain — that pulsar signature. I served on a survey cutter that logged
  something like it. If the old charts hold, the anomaly you're looking for
  would lie coreward of here."* → a clue is offered.
- The player can **Consult the Bridge** at any time: each officer offers an
  opinion coloured by their skills, traits and morale. A high-Science officer
  gives good analysis; a Reckless one advises a fight; a low-loyalty one may
  advise you badly on purpose.
- Crew **volunteer clues at loyalty thresholds** — people don't share everything
  with a captain they don't trust. This makes morale a *puzzle-solving* resource,
  not just a fail-state meter.

### 7.3 Personal threads

Each crew member has a small arc that fires on triggers: a brother's ship in the
salvage lists, a religious objection to what you just did, a defector's contact
in Xenoline space. Resolving a thread grants loyalty, a skill bump, or a clue.
Ignoring one can end in resignation, sabotage, or a mutiny vote.

### 7.4 Morale and mutiny

Ship morale = weighted crew morale, modified by supplies, casualties, and
decisions (abandoning survivors, killing prisoners, ordering suicidal missions).

Thresholds: `Confident → Uneasy → Fractious → Mutinous`. At Fractious, orders can
be refused. At Mutinous, a mutiny event fires with the crew split by loyalty —
resolvable by force, by concession, or by a very good speech from a captain who
has earned it.

### 7.5 Away teams

3–5 crew chosen per mission. **Death is permanent and uncompensated.** The tension
is that your best clue-decoders are also the people you most need on the ground,
and the ground is where people die.

---

## 8. Planets and exploration

**Orbit → Scan → Choose a site → Resolve.**

Generated planets carry traits: `atmosphere · biosphere · gravity · tech level ·
natives · hazard · anomaly`. Traits determine which authored site templates are
eligible, so content is hand-written but placement is procedural.

Site archetypes: *Ruins · Crashed ship · Native settlement · Research outpost ·
Mining claim · Anomaly source · Nothing at all* (empty sites matter — they make
scanning meaningful and make risk real).

Site resolution mixes:
- **Skill checks** against the away team's best relevant skill, with visible odds
- **Authored choice nodes** — the gamebook DNA, 2–4 meaningful options
- **Hazards** — injury, contamination, equipment loss
- **Infantry combat** where it's earned, not by default

Rewards: fuel, parts, artefacts, recruits, and above all **clues**.

---

## 9. Ship-to-ship combat

Turn-based, tactical, fully legible. Every fight should be winnable *and*
avoidable.

**Encounter opens with a posture choice:** `Hail · Scan · Evade · Engage · Ambush`.
Talking first is usually correct and the game should reward it.

### 9.1 Combat turn

Range bands: **Long / Medium / Close**. Each round both sides pick a manoeuvre
and an action.

- **Manoeuvre:** Close / Hold / Withdraw / Evasive (evasion vs accuracy trade)
- **Power:** reallocate the reactor budget this round
- **Action:** Fire beams (accurate, short) · Fire torpedoes (heavy, slow, long) ·
  Target subsystem (harder, disables rather than destroys) · Board (Close range,
  triggers infantry combat) · Hail (mid-fight surrender/negotiation) ·
  Jump out (needs drive charge and distance)

### 9.2 Why you'd rather not kill them

Destroying a ship gives salvage. **Disabling** one gives salvage *and* a nav
computer *and* prisoners — which is to say, clues. Boarding actions are the
highest-value, highest-risk play in the game: infantry combat aboard a hostile
hull for their charts.

Prisoners then create an ongoing problem: they eat food, they need guarding, they
can be traded, released for reputation, or interrogated — and how you treat them
feeds crew morale and faction standing.

### 9.3 Enemies

Faction-flavoured behaviour: raiders close and board, patrol cutters demand
compliance and call for help, alien warships are outrageously strong and should
be run from. Threat scales with Drift, so dawdling makes space meaner.

---

## 10. Infantry combat

Small-squad tactical, **zone-based rather than grid-based** — cheaper to build,
faster to read, and better suited to a text-forward presentation.

- A map of 4–8 **zones** with cover ratings and connections.
- 3–5 of your crew vs 2–6 hostiles; initiative order by a Reflex derivative.
- Per turn: **Move / Fire / Aim / Take cover / Suppress / Use item / Grapple / Surrender-demand**
- **Stun vs lethal** on every shot. Stunned enemies become prisoners and
  intelligence; killed ones become a faction incident and a morale hit for crew
  who disapprove.
- Wounds carry back to the ship. The medbay decides whether a wound becomes a scar
  or a funeral.

Boarding actions reuse this system exactly, with the enemy ship's deck as zones
and the bridge/computer core as the objective.

---

## 11. Factions, reputation and endings

**Factions** (4–6, generated names, fixed archetypes): a mercantile combine, a
militant patrol, a xenophobic alien polity, a scavenger clan, a monastic order
that hoards charts.

Reputation −100…+100 per faction, with rival pairs so that pleasing one costs you
another. Reputation gates the *best* clue sources (archives, elders, pilots), so
diplomacy is a legitimate route to victory alongside salvage and violence.

### Endings

Graded on arrival, not just pass/fail:

- **Home, honoured** — most crew alive, ship intact, no atrocities
- **Home, hollow** — you made it, at a cost the epilogue names, person by person
- **Home, changed** — arrived carrying alien tech or passengers; the epilogue is uneasy
- **The long silence** — stranded: no fuel, no leads, no way to make more
- **Mutiny** — the crew takes the ship; you get an epilogue from someone else's chair
- **Lost with all hands** — destroyed

The epilogue should name individual crew and what became of them. That's the
payoff for permadeath.

---

## 12. Technical architecture

### 12.1 Shape

```
src/
  engine/            # pure TypeScript, zero React, zero I/O
    state/           # GameState types + zod schemas
    rng/             # seeded PRNG (splitmix/xoshiro); NEVER Math.random
    worldgen/        # map, factions, gateway + clue placement, solvability proof
    systems/         # travel, combat.ship, combat.ground, crew, morale, economy, clues
    reducer.ts       # (state, action) => { state, events }
    selectors/       # candidate-set filter, derived stats
  content/           # authored data: encounters, sites, clue prose, crew, items, traits
  ui/                # React: StarMap, Bridge, NavPlot, Combat, AwayMission, Log
  app/               # store wiring, save/load, routing
tests/
  engine/            # unit tests per system
  golden/            # seed + action log => expected final state (replay tests)
```

### 12.2 Key decisions

- **The engine is pure and deterministic.** `(state, action) → (state, events)`.
  All randomness from a seeded PRNG stored *in* the state. This buys: trivial
  save/load (serialize the state), replay-based regression tests, debuggability,
  and the option of a future headless/CLI or mobile front end.
- **The UI renders state and dispatches actions. It contains no rules.** If a
  number is computed in a component, that's a bug.
- **Events, not mutations, drive the fiction.** The reducer emits an event stream
  (`CrewDied`, `ClueFiled`, `SubsystemDisabled`); the UI turns events into log
  prose and animation. The captain's log falls out of this for free.
- **Content is data, validated at build time.** Encounters, sites, clue phrasings
  and crew archetypes live in typed content modules checked with zod, so writing
  content never requires touching engine code.
- **Stack:** Vite · React 18 · TypeScript strict · Zustand (thin store over the
  reducer) · Tailwind · Vitest · Playwright for a couple of smoke flows.

### 12.3 Testing strategy

- Unit tests per system (combat maths, fuel, morale thresholds).
- **Worldgen property tests** — generate 10k seeds, assert every one satisfies the
  §4.2 solvability contract. This is the single most valuable test in the project.
- **Golden replays** — a seed plus a recorded action list must always produce the
  same final state hash. Catches accidental non-determinism immediately.

---

## 13. Presentation

Text-forward, chart-heavy, deliberately low on art assets:

- **Star map** — SVG, the primary screen. Lanes, fog, range rings, candidate
  highlighting from the Nav Plot.
- **Bridge** — crew roster with portraits (generated/composed), status, and the
  Consult panel.
- **Nav Plot** — evidence board; the game's signature screen.
- **Combat** — schematic ship diagrams with subsystem damage, range band strip.
- **Log** — running prose in a monospaced captain's-log voice.

Aesthetic: amber/green CRT, thin rules, generous whitespace — *Alien*'s MU-TH-UR
by way of a paperback. Prose in second person, present tense, terse.

---

## 14. Open questions

1. **Save scumming.** Permadeath is the point, but the web makes reloading trivial.
   Ironman-by-default with an explicit "casual" toggle, or accept it?
2. **Long Jump attempts.** Should a wrong guess be economically survivable twice,
   or is once enough to make the deduction weigh properly?
3. **Multiple routes home.** Deferred for v1, but the architecture allows several
   Gateways with independent clue chains. Worth revisiting after the first
   playable.
4. **Run length.** 4–8 hours may be too long for the audience. A "short galaxy"
   option (40 systems, 5 true clues) is cheap to add and worth prototyping.
5. **Combat depth vs. count.** Two full tactical combat systems is the largest
   build risk here. Ground combat could ship as a lighter check-based resolution
   first and be deepened later (see roadmap M6).

---

## 15. Scope guard

The failure mode for this project is building the galaxy simulation and never
building the mystery. The mystery is the game. **Milestones 1–3 in
[ROADMAP.md](./ROADMAP.md) deliver a playable, winnable game with no combat at
all** — travel, clues, deduction and a Long Jump. Everything after that is
enrichment of a thing that already works.
