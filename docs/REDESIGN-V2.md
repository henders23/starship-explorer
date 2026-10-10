# Starship Explorer — Unified Redesign Rules

**Status:** approved design direction; implementation in increments.  
**Ruleset:** exploration-v2 (in development).  
**Source of truth:** this file supersedes the *gameplay direction* in `docs/DESIGN.md` for v2. The older document describes the currently playable v1; do not delete it until v2 is playable and migrated.

## 1. Player fantasy and pillars

Captain the ISS Ithaca, stranded in an unfamiliar galaxy. Explore systems, investigate strange places, meet alien civilisations, protect and improve the ship, and acquire the science needed to build the **Return Drive**.

1. **Discovery drives play.** A meaningful system may contain planets, moons, stations, derelicts, anomalies and events. The player chooses what to pursue.
2. **Several routes to progress.** Research discoveries can come through exploration, salvage, diplomacy, trade or tactical action. No mandatory discovery is locked to a unique encounter or victory in one battle.
3. **Consequences persist.** Named characters, faction standing, locations, casualties and unfinished stories survive travel and revisits.
4. **Systems are legible, surprises are not.** Present known odds, likely threats, costs, prerequisites and rewards. Do not reveal hidden story content before discovery.
5. **One ship, one crew.** Avoid colony, fleet, population, economy or morale management. The Ithaca is the mobile strategic base.
6. **The engine owns rules.** Deterministic seeded generation; serialisable state; logged actions; engine computes outcomes, UI renders them.

## 2. Campaign victory

Remove the global clue/gateway deduction, false-account filing, Nav Plot and wrong-system Long Jump.

Victory requires:
1. Drive Diagnostics — 4 research days.
2. Exotic Energy Storage — 6 days, plus one qualifying exotic-energy discovery.
3. Spatial Field Dynamics — 8 days, plus two distinct sources of spatial knowledge.
4. Prototype Return Drive — 10 days and construction (25 materials + 50 credits).
5. Drive Stabilisation — 12 days, following a controlled prototype test.
6. Construct final Return Drive (60 materials + 150 credits), then choose to activate it from any suitable system.

The five required research projects total **40 base research days**, but play continues normally while the laboratory works. Time and costs are provisional balance targets. A prototype failure produces a recoverable setback, not a softlock. The player may continue exploring after constructing the drive and leave when ready.

No optional weapons, shields, diplomatic achievement, faction alignment or tactical victory is a hidden mandatory prerequisite. Endings acknowledge saved people, allies, scientific discoveries and casualties.

## 3. Core loop

**Choose system → arrive and scan → inspect locations → talk / investigate / salvage / fight / leave → gain knowledge, relationships and resources → research and build → travel further.**

Most arrivals show a concise sensor report, not a modal scene. An intercept is possible under credible circumstances; dangerous regions must be telegraphed. Selecting a location opens its choices, scene, mission or service. Returning later is always possible unless the player caused a specifically explained change.

## 4. Persistent world model

A star system has 0–many persistent **locations**: stations, habitable worlds, ruins, derelicts, resource fields, anomalies, outposts and signal sources. The base generator uses the existing region, star, feature, lane and faction information.

A location has a stable ID, home system, type, name, discovery visibility, threat tier, encounter hook, optional one-time reward and optional persistent services.

Location knowledge progresses: `undetected → detected → investigated → resolved`. A `changed` narrative state is represented by **event flags**, not by overwriting all location state. A resolved station may still be visited for services. Events such as passing merchants may be transient and must not become permanently repeatable one-time rewards.

Scanning:
- Passive: obvious planets, stations and nearby objects.
- Survey: finer signatures and hidden or distant locations within the current system.
- Deep: scientific anomalies, buried installations and rare signatures; unlocked through sensors.
- Later research may reveal previously undetected locations on revisits.

A site is not exhausted just because a dialogue ended. Optional story threads and permanent services remain available. Always provide a leave/return option unless story circumstances clearly prevent it.

### Encounter families

1. Exploration / surveys.
2. Ancient ruins / research installations.
3. Derelict spacecraft / salvage.
4. Stations / hubs / recruitment and trade.
5. Alien contact / diplomacy / translation.
6. Hostile encounters / ship or ground combat.
7. Distress calls / unusual events / connected stories.

Mix brief authored scenes (2–5 minutes), medium missions (10–30 minutes) and multi-system arcs. Start with a few distinctive recurring characters and five faction-linked story arcs rather than a huge pool of shallow text.

### Galaxy generation targets

Current default: around 90 systems with five existing factions/regions. Initial targets by system: 20% quiet/resource systems, 40% single-opportunity, 25% multi-opportunity, 15% major/story hubs. These are tuning targets, not exact guarantees.

The starter's two-jump neighbourhood must include an accessible station/service, recoverable materials, an introductory scientific opportunity and an optional ground mission. A short 12-system vertical slice should contain two factions and 18–24 locations before scaling.

**Solvability invariant:** each essential scientific category has at least three sources in distinct systems, from more than one region when the galaxy size allows; at least one viable route remains after ordinary misses or retreats. A science category may have salvage, diplomatic and investigative delivery channels. Essential resources must remain recoverable; emergency fuel recycling avoids hard failure.

## 5. Research and construction

Six branches, **29 projects total**:
- Propulsion (9): five mandatory drive projects; optional fuel optimisation, fuel tanks, slipstream routes and emergency recycling.
- Weapons (4): fire control, ion projector, focus beam, alien plasma ballistics.
- Defence (4): composite hull, layered shields, adaptive matrix, personal shields.
- Sensors (4): planetary spectrometry, signal triangulation, tactical threat analysis, deep survey.
- Communications (4): trade translation, contextual translation, electronic countermeasures, diplomatic relay network.
- Applied science (4): trauma protocols, field engineering, reconnaissance drones, automated lab.

One active project, up to three queued. Research progresses with the campaign clock, and suspending a project preserves progress. Injuries or loss of a scientist slow work but do not permanently block it. Research normally requires time and known prerequisites, not generic research points. Found samples and observations are named **discoveries**, not spendable currency.

**Research ≠ construction.** A completed project unlocks effects or blueprints; a physical refit takes materials and credits. Equipment and ship upgrade slots limit stacking. UI always shows the effect, prerequisites, time and reason for any lock.

## 6. Resource economy

Routine resources only:
- **Fuel** — travel, scooping, trading or emergency recycling.
- **Materials** — recovered from salvage, surveys, missions and trade; spent on construction/repair.
- **Credits** — earned through trade, tasks and assistance; spent at stations.

Preserve ammunition as a tactical ship-combat consumable, not an additional strategic economy. No morale, general rations, maintenance salary, abstract research currency or universal global countdown. Region danger and consequential actions create pressure rather than unavoidable surges. Remove the v1 Rift Surge progression from v2.

Player must be able to recover from fuel shortages and unlucky choices without trivialising routes. Costs and reward rates need complete-run playtesting.

## 7. Factions, language and narrative

Keep existing faction archetypes as a starting point. Store relations, linguistic understanding and access separately. A faction may be friendly but poorly understood, or comprehensible but hostile. Higher translation tiers open meaningful dialogue, scientific information and diplomatic choices. Actions set typed consequence flags to support later encounters and endings. The simulation should not grow into a detailed political/economic model.

Recurring contacts can provide opportunities or react to prior decisions. Diplomacy, trade or observation should sometimes substitute for combat.

## 8. Tactical ground missions

Three delivery modes: narrative investigation (no board), tactical exploration (map, possible violence), and tactical battle.

- Isometric presentation backed by a 2D tile grid, usual board ~24×18.
- Four named operatives at first; shuttle upgrade unlocks a fifth/sixth.
- Two action points per character per player turn.
- Move (1), sprint (2), shoot (1; generally once/turn), overwatch (1), reload (1), aim (1), interact (1), items (usually 1), grenade (2).
- Cover: exposed, half, full; visible accuracy modifiers from range, flanking, elevation, abilities. Example standard rifle odds: 75/55/35 percent.
- Clear movement, line of sight, fog of war, extraction zones, enemy turns and mission objective UI.
- Five broadly trainable roles: assault, recon, engineer, medic, heavy.
- Objective diversity: recover, rescue, investigate, infiltrate, defend, disable, evacuate, capture.
- Incapacitation and extraction matter; injuries and permadeath persist. Defeat/retreat must not invalidate campaign solvability.
- No generic role pool is a substitute for distinct tactical operatives. Existing ship officers remain; their ship duties matter if assigned to a mission.

The tactical rules engine must own movement, attack resolution, state and RNG. Do **not** duplicate the ship combat's UI-owned simulation approach: ground moves and attacks must be deterministic logged actions.

## 9. Ship combat

Retain existing FTL-style real-time-with-pause, compartments, reactor power, target selection and distinct weapons. Contact posture offers hail, evade, negotiation or engage. Research unlocks blueprints and construction/installation is separate. Faction knowledge and diplomacy open bloodless choices; salvage rewards must be persistent. Ship fights are a possible consequence of where and how the player travels, not a compulsory frequent interruption.

## 10. Unified crew model

Ship officers retain portraits, names, stations and relationships. A separate named operative roster handles tactical loadouts, XP, injuries and permadeath; ship specialists may occasionally deploy at the cost of losing their support availability. Start with six operatives, choose four. Accessible recruitment and recovery ensure a bad mission does not end a campaign. Keep the existing officer characters, portraits and introductory premise.

## 11. Interface

- Galaxy map: explored/faction space, stations, threats and opportunities, no clue candidates.
- System view: selectable planets/moons/sites with scan progress and location states.
- Encounter view: cast dialogue, contextual choices and visible costs; scenes occur because the player pursues a contact.
- Ship hub: repair, build, roster and upgrades.
- Research lab: dependency tree, discoveries and project queue.
- Tactical screen: selected unit, AP, cover, hit odds, known threats, objective and extraction.
- Ship battle: existing room-based tactical management.

## 12. Architecture and migration

Do not retrofit mystery state into the new model. Introduce typed `exploration`, `discoveries`, `inventory`, `relationships`, `tactical` and `research-v2` modules behind an explicit ruleset boundary. Preserve the v1 game and its replay fixtures until v2 is independently playable. Version save data and migrate deliberately; do not reinterpret old clue saves as new exploration campaigns.

Implementation in playable increments:
1. Unified rules (this file), deterministic persistent location generator, state transitions and tests.
2. Exploration UI and system scans; multiple selectable locations with one-time rewards and persistent services.
3. Research-v2 prerequisites, queue, discovery routing, resources, construction and drive finish.
4. Factions, dialogue hooks, rewards and multi-system story threads.
5. Isometric tactical rules engine, map, actions, AI, mission objectives and squad progression.
6. Ship-combat links and upgrade application.
7. Full v2 campaign, save migration/legacy archive strategy, comprehensive generator and balance tests; retire obsolete mystery UI and files only after v2 succeeds.

**Tests required:** deterministic seeds and action replays; unique location IDs; no duplicate reward; changes preserved after save/load; reachable starter opportunities; ≥3 geographically distributed sources per mandatory discovery; no missing mandatory unlock; tactical AP, line-of-sight, extraction and casualty invariants; complete seeded campaign simulations; UI smoke; backwards compatibility for v1.

## 13. Scope decisions

Do not build colonies, fleets, diplomacy grand strategy, detailed economies or procedural dialogue that merely changes names. Focus on meaningful, persistent discoveries and a small number of replayable but genuinely different encounters. A playable vertical slice is the standard for each milestone.

**Important:** this specification describes the target v2, not a claim that the currently deployed game already implements it.
