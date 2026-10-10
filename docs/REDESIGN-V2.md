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

## 14. Playable exploration increment (October 2026)

The title screen now offers **Start exploration preview**, with its own resume control.
The original campaign still runs through **Take command** and retains its existing save.
The preview reuses the 90-system galaxy generator and lane fuel costs, with a separate
pure `exploration/campaign.ts` reducer and an accepted-action journal.

Implemented:
- Galaxy navigation, passive arrival scans, one-day surveys and gated deep scans.
- Persistent selectable contacts, investigation, explicit one-time recovery, return visits.
- A guaranteed survey-accessible Silent Courier with an exotic-energy discovery at the start.
- Named discovery sources (two spatial observations remain two distinct findings).
- Two sensor projects: Planetary Spectrometry (4 days) and Deep Survey Array (8 days).
  Spectrometry identifies scientific signatures before investigation. Deep Survey requires
  completed spectrometry and one recovered discovery, then a 20-material/65-credit refit.
  Research advances during actions; switching preserves progress. No queue in this increment.
- Remote investigation (2 days, no damage) or rapid recovery (1 day, 4 hull damage per
  threat tier); both recover the same resources. This is narrative exploration, not tactical combat.
- Persistent station refuelling (+20 fuel/10 credits), repairs (+20 hull/5 materials/10 credits),
  and alloy sales (4 materials/12 credits), each taking one day. Tanks and hull are capped.
- Three-day emergency hydrogen collection, available only when no neighbouring jump is
  affordable, restores enough fuel for a jump even with empty stores.
- Discovery archive, voyage log, responsive controls, visible research locks and autosave status.

Preview saves use `starship-explorer-exploration-v2`, envelope version 1, seed plus accepted
actions. Loading replays the journal rather than trusting stored balances. Invalid and future
versions remain untouched; replacing an existing preview requires an explicit new-voyage
confirmation. Changes to generation or action semantics require a save-version change and
an intentional migration/archive policy. Legacy save keys are never read by this loader.

Still pending: the full research tree, research queue, Return Drive victory, faction consequence
arcs, operative missions, tactical combat and ship-combat integration. The preview does not
claim a complete or balanced campaign. Random location generation still needs encounter variety
and tuning; this increment uses the existing large galaxy instead of a bespoke 12-system slice.

Verification: campaign tests cover the complete sensor loop, invalid actions, persistent
services, source provenance, emergency recovery, immutable state, replay saves and malformed
saves. A 40-seed sweep checks opening science and geographically distributed essential sources.
Browser tests cover exploration/save/revisit on desktop, narrow layout and the legacy smoke flow.

## 15. Return Drive and research increment (October 2026)

This increment supersedes section 14's sensor-only scope. The exploration preview now
has a complete **research → construction → prototype test → stabilisation → departure**
route. The original campaign remains separate.

### Available research and hardware

The catalogue defines all 29 projects and six branches, with explicit dependencies.
**21 projects are usable now. Eight combat-dependent projects are visibly upcoming and
cannot be started or queued**: four Weapons projects, Layered Shielding, Adaptive Shield
Matrix, Personal Shield Emitters and Trauma Protocols. Their original intended effects
are retained in the catalogue; there are no simulated bonuses pretending that V2 combat
or operative injuries already exist.

One project is active and three may wait in the queue. Projects may be queued before
prerequisites are met; the scheduler takes the first ready entry and leaves blocked
entries waiting. Switching or pausing preserves work. Queue entries can be reordered or
removed. Remaining work from a multi-day action carries into the next ready project.
A discovery delivered at the end of an expedition, or the completed prototype test,
only unlocks subsequent work **after** that action finishes.

Construction takes one day and pays materials/credits once. Hardware auto-fits if a slot
is free, otherwise it remains in storage. Two engine slots, two utility slots, one gadget
slot and one permanent hull installation constrain fitting. Drive components have their
own slots. Unfitting retains the hardware; removing fuel tanks vents fuel above 80.
Hull plating cannot be repeatedly removed/refitted to manufacture free hull repairs.

Usable effects include reduced travel fuel, 100-unit tanks, 120 maximum hull, direct
travel across two lanes, fuel recycling, remote scan contacts, more precise threat
reports, cheaper trade, station archive translation, remote scientific-record purchases,
electronic protection during hazardous recovery, engineering salvage bonuses, faster
safe recovery by drones, and a fitted laboratory granting 1.25 work days per activity day.
Field equipment currently affects narrative expeditions; later tactical abilities are
not being claimed by this increment.

### Completion and recovery routes

The five drive projects still total 40 base research days. Exotic storage needs one
exotic-energy source; spatial dynamics needs two independent spatial/propulsion sources.
A station's spatial archive counts once even if it describes several subjects. All
mandatory world discoveries are accessible with ordinary surveys, so optional sensor
research never becomes an implicit requirement for victory. Diagnostics reveal optional
scientific leads on the chart.

The prototype costs 25 materials + 50 credits. It may be tested in any surveyed system.
The saved, modal test scene offers remote probes (two days, no damage) or a shielded pass
(one day, 10 hull damage), and may be safely aborted and resumed. Stabilisation unlocks
the final 60-material/150-credit drive. Construction does not end exploration. Departure
is an explicit confirmed choice from any system; it records a persistent home outcome
and a voyage-specific ending. Completed voyages reject further gameplay mutations.

Station archives provide another route to discoveries after Contextual Translation;
the relay permits remote archive purchases but never remote physical refuelling/repairs.
A second independent spatial source must come from another station or an expedition.
Station survey contracts take three days and renewably pay 8 materials + 18 credits,
providing recovery from empty stores. Buying alloys costs more than selling them earns.
Previously unrewarded non-station surveys now yield modest one-time materials/credits.
Emergency hydrogen collection restores enough fuel for any adjacent lane when no jump
is affordable. None of these routes requires combat.

### Save compatibility and validation

Exploration save version **2** retains an optional version-1 journal prefix. That prefix
is replayed by `legacy-campaign.ts` using the unchanged location generator, then explicitly
migrated. Original balances, calendar, finds, research work and installed array survive.
New actions are replayed under the new rules. Known scanned systems receive newly
survey-accessible contacts. Malformed and unknown versions remain untouched. The loader
does not overwrite a version-1 save; the next successful autosave stores both its original
prefix and the new continuation. Future semantic changes require another version/migration.

`tools/exploration-walkthrough.ts` completes campaigns using accepted public actions,
without balance edits or resource grants. Run `npm run exploration:simulate -- 20`.
Tests cover queue order/limits and blocked entries, fractional work, discovery delivery
timing, hardware costs/slots/effects, independent archives, empty-store recovery, safe
prototype failure avoidance, saves during the test, version-1 migration and returned-game
immutability. Twenty seeded runs cover exploration and archives, including deliberately
missed scientific sources. Browser flows cover the original campaign, sensors, the
prototype scene, final research/build/departure, completed-save reload and mobile queues.

These simulations establish solvability, not a validated 4–8-hour campaign balance.
Tactical missions, ship-combat integration and substantial authored faction arcs remain
next. The short archive route and repeatable recovery contracts will need pacing review
alongside those richer encounters.


## 16. Tactical boarding increment (October 2026)

Optional boarding is now available after investigating an unresolved derelict or ruin,
including the starter Silent Courier. The existing remote and rapid recoveries remain
available. Boarding awards the same one-time cargo and scientific source, never an
additional copy; combat is not a prerequisite for the Return Drive.

This first tactical slice uses two deterministic **12×10** recovery-deck layouts. The
smaller introductory board is deliberate; larger 24×18 missions, rescue/infiltration
objectives and authored faction encounters remain future work. Custodians are autonomous
site defences, not a substitute for the pending faction relationship system.

### Rules and consequences

- Six distinct named operatives; select four healthy crew. Assault, recon, engineer,
  medic and heavy roles have usable health, movement, interaction, treatment or weapon
  differences. These operatives are separate from ship officers.
- Two AP per turn: move one AP, sprint two, shoot one (once per turn), aim one,
  overwatch one, reload one, recover the core one, or use a single medkit one.
- Cardinal pathfinding, solid bulkheads, directional cover, visible hit calculations,
  shared line of sight and explored-space memory. Enemies outside sight are hidden.
  Aim grants 20 percentage points and expires after moving or the turn. Overwatch
  fires once at a moving hostile during the enemy turn; unused orders then expire.
- Custodians act deterministically, reload, approach when no shot is available and
  fire at an eligible crew member. Both shots and AI live in the rules engine.
- Downed operatives may be revived with a nearby medkit and can act next turn. A
  conscious operative standing in the shuttle zone can pull an adjacent downed
  crewmate aboard for one AP. Downed crew already inside the zone are extracted.
- Extraction requires a conscious operative in the shuttle zone. All operatives
  outside that zone are lost permanently; the UI lists their names and requires a
  second explicit confirmation. Recovering the core secures it for the team.
- A complete squad incapacitation ends the mission in defeat. Retreat and defeat
  leave the site available for another mission or remote recovery.
- The saved debrief applies cargo, discoveries, casualties, service records and one
  campaign day exactly once. The lab progresses on that day, with science delivered
  at its end. Tactical turns themselves do not advance the campaign calendar.
- Wounded survivors need four campaign days of recovery, or two with **Trauma
  Protocols**, now usable. Free medical rest is available aboard ship; normal travel
  and activities also advance recovery. Recruit named replacements at a contacted
  station for 20 credits and one day, up to six living operatives. Station contracts
  remain an unlimited source of funding. Dead operatives stay in the roster record.
- Service XP and mission counts are recorded. Rank bonuses, promotion choices,
  individual loadouts, grenades, elevation and ship-officer deployment are not yet
  implemented. Seven research projects still await ship combat or tactical loadouts;
  the research catalogue now has **22 usable projects**.

The mission interface includes squad selection, an isometric board, reachable tiles,
path previews, shot modifiers, ammunition/AP/health, short shot feedback, a transcript,
mobile map enlargement and explicit extraction. Core recovery and casualty outcomes
persist through reloads. The return-home ending acknowledges lost operatives.

### Save compatibility and validation

Envelope **version 3** adds tactical orders. Accepted version-2 exploration actions
retain exactly the same gameplay semantics; replay adds the initial named roster and
empty mission state. Version-1 journals still use the frozen original reducer before
migration. Version-2 envelopes reject new boarding/trauma actions. Reading a save does
not rewrite it; the next successful autosave writes version 3. Saves during combat,
while viewing a debrief and after reward application all replay deterministically.

`npm run tactical:simulate -- 12` completes twelve seeded introductory missions using
legal public actions and visible targets. Unit tests cover path/AP restrictions, cover
and sight, shot limits, ammo, overwatch, revival, extraction consent, injuries, losses,
replacement recruitment, no duplicate reward, save replay and older journal migration.
Browser checks cover launching from a location, movement, shooting, combat reload,
cancelling an extraction with losses, safe retreat and completed-mission reload on mobile.
The existing Return Drive voyage simulations and original campaign remain regression gates.

This establishes a playable recovery-mission slice, not full tactical campaign balance.
Broader mission stories and map variety, progression/loadouts, faction consequences and
ship-combat integration remain the next areas of work.


## 17. Ship escort and combat increment (October 2026)

Contacted stations now offer one optional survey escort each. Reviewing an escort
shows the specific hostile class, hull, shields and weapons; the captain can decline
without cost. There are no new automatic travel interceptions or compulsory battles.
The tender provides a credible reason for the encounter and a way to tow the Ithaca
back if it becomes disabled. Faction standing and multi-system faction stories are
still separate, unfinished work.

### Contact and battle rules

- Hail reveals a 15-credit transit demand (8 with Trade-Language Translation).
  Contextual Translation opens a no-payment agreement after hailing. Negotiated
  passage pays 6 materials and 18 credits, so the quoted toll remains affordable.
- Evade with the tender: 65% success, or 85% with fitted Electronic Countermeasures.
  Failure starts battle. The seeded result is unchanged by reload or cancelling and
  reopening the same station’s contact.
- Battle starts **paused**. Resume for one-second simulation ticks, pause at any
  point, or manually advance one second. Hiding the tab pauses; loading a saved
  battle always opens paused, with no offline time or reset of hull/charge/RNG.
- Eight reactor units, shared among shields, engines and weapons. Shield layers
  require two power each; engines improve evasion and charge escape; active weapons
  must fit within allocated weapon power. Switching a weapon off discards its charge.
- Pulse lasers fire two 1-damage shots; missiles deal 2 damage and bypass shields;
  ion shots strip a shield or disable an exposed compartment for six seconds;
  beams deal 3 damage, ignore evasion and cannot penetrate any remaining shield.
  The station lends four missiles per escort. Ordnance is consumed tactically and
  returned after the encounter, not added to the strategic resource economy.
- Retain the existing ship artwork, class catalogue and hostile compartment layouts.
  Own and enemy helm, weapons, shields and engines can be targeted/damaged. Weapon
  damage slows charging, shield damage limits layers, and disabled helm/engines
  remove evasion. Repair crews restore one chosen compartment point per six seconds;
  battle repairs never restore strategic hull. Enemies charge weapons, choose targets
  and repair compartments through the deterministic simulation.
- A retreat needs ten units of engine charge (ten seconds at two effective power).
  Disabled or unpowered engines cannot charge; damage already taken persists.
  Contextual Translation allows accepting surrender at or below 30% enemy hull;
  the interface pauses when that offer first becomes available.

The existing v1 UI-owned combat simulation stays untouched. V2 uses the separate pure
`exploration/ship-battle.ts` reducer. Configuration, targets, manual fire and clock
advancement are accepted campaign actions; the UI cannot submit a fabricated victory
or hull total. Pause is a UI clock control, not a source of unsaved simulation state.
The battle report itself is saved before rewards are acknowledged.

### Research and campaign consequences

Five previously locked projects are usable: Fire Control (+10% charging rate), Ion
Projector and Focus Beam (research, construct, then fit), Layered Shielding (second
layer with four power) and Adaptive Shield Matrix (+20% shield recovery work).
Electronic Countermeasures also add 10 percentage points of battle evasion alongside
their existing expedition protection. The catalogue now has **27 usable projects**;
Plasma Ballistics and Personal Shield Emitters still await operative weapon/gadget
loadouts. No unimplemented ground-optics bonus is claimed by Fire Control.

Victory awards 12 materials and 35 credits. Negotiated passage, successful evasion or
accepted surrender awards 6 materials and 18 credits. A completed station escort cannot
pay again; retreat and disabling leave the job available. Successful/retreated missions
advance one campaign day when the report is acknowledged. Declining advances none.

At the last hull point the Ithaca becomes disabled rather than exploding. The tender
provides emergency tow: three days, up to 8 materials and 20 credits lost from existing
stores, **hull remains at 1**. Renewable station work can fund repairs even at zero
supplies. No reward is paid for disabling or fleeing. Existing exploration, boarding,
research and Return Drive routes remain available after the encounter. The ending
acknowledges completed survey escorts.

### Saves and validation

Envelope **version 4** adds escort actions and empty escort state to older campaigns.
Previously accepted version-2/3 actions retain their semantics; older envelopes reject
new escort orders and newly unlocked research nodes. Version-1 preview replay remains
frozen. Existing boarding saves replay unchanged, including active missions and reports.

`npm run ship:simulate -- 20` completes twenty seeded introductory escorts with legal
bridge orders. Tests cover tick partition determinism, power/weapon constraints, ammo,
ion/beam/missile distinctions, repairs, retreat, actual research effects, surrender,
negotiation/evasion, hull persistence, emergency recovery, one-time rewards, active-battle
replay and prior-version migration. Browser flows cover station contact, paid passage,
saved reports, the real-time/pause clock, room selection, combat reload, victory and
mobile retreat. Ship-display height assertions prevent control panels clipping the hulls.

This is a saved escort-combat slice, not a fully balanced faction campaign. Automatic
interceptions, fighter launch bays, more encounter stories and the remaining tactical
loadouts remain outside this increment.


## Expedition polish and tactical equipment — 10 October 2026

See [EXPEDITION-POLISH.md](EXPEDITION-POLISH.md) for the current increment:
10 authored encounters, the Courier delivery side voyage, three cinematic environment
assets, operative plasma/shield loadouts, all 29 research projects usable, and save
envelope version 5. This supersedes the earlier notes about two locked tactical nodes.
