# Starship Lodestar — full game design

**Design of record · 11 October 2026 · Open Expedition / exploration-v2**

This document describes the intended complete experience and distinguishes it
from the implemented baseline. [SPECIFICATION.md](SPECIFICATION.md) defines current
rules and engineering contracts; [ROADMAP.md](ROADMAP.md) defines build order.
The mystery-led design is preserved in [CLASSIC-DESIGN.md](CLASSIC-DESIGN.md).
This document supersedes the direction/status summaries in [REDESIGN-V2.md](REDESIGN-V2.md).

## 1. The game we are making

You captain the ISS Lodestar after a transit leaves it far from familiar space.
Home is something your crew can build a route to. Every system offers a question:
what is worth learning, who needs help, and what can you risk before moving on?
The pleasure lies in making a voyage that belongs to this crew.

**Genre:** single-player narrative exploration with strategic ship management,
optional turn-based boarding and real-time ship combat with pause.
**Platform:** laptop and desktop browsers; mouse/trackpad and keyboard. Phone play is not a product target (confirmed 12 October 2026). Existing narrow layouts remain a fallback.
**Audience:** players who enjoy discovery, readable tactics and human science
fiction. Boarding requires no reflex skill.
**Product scope:** self-contained browser game; no account, multiplayer, paid
progression, live service or runtime generative dialogue is currently designed.

The emotional movement is **disorientation → competence → attachment → a chosen
homecoming**. A player should remember a person they helped and a difficult
choice at least as clearly as a weapon upgrade.

## 2. Pillars and boundaries

| Pillar | Design consequence |
| --- | --- |
| Discovery drives progress | Science comes from exploring, observing, exchanging and helping |
| One ship, named people | Persistent injuries, losses and remembered deeds give decisions weight |
| Several routes forward | Combat is optional; independent science sources and recovery services prevent ordinary setbacks becoming dead ends |
| Legible systems | Show costs, prerequisites and known risks before commitment; label uncertainty |
| Consequences outlast scenes | Places and characters react to what happened; this is the next major content investment |
| Restraint supports wonder | Quiet arrivals and readable screens leave room for a surprising encounter |

Out of scope: colonies, fleets, grand-strategy diplomacy, salary/rations/morale
meters, a universal countdown, unlimited procedural dialogue and compulsory
battles on every jump. Do not reintroduce Classic Voyage's false-account puzzle
or Rift Surges into Open Expedition. Do not expand the map merely to add volume.

## 3. Baseline and ambition

| Area | Implemented | Planned or unresolved |
| --- | --- | --- |
| World | Default 90-system seeded galaxy, stable sites, scans and revisits | Complete-run pacing; richer regional identities |
| Progress | 29 usable projects, queue, fitting, prototype test and return | Narrative framing of milestones; human balance data |
| Stories | Ten templates; complete Courier delivery side voyage | Connected arcs, recurring contacts and callbacks |
| Ground | Core recovery plus rescue/sabotage/salvage; four of six operatives; nine newer operation configurations | Distinct enemies, deeper role choices and earned progression |
| Space | Saved station escorts, negotiation/evasion and compartment battles | Faction-specific encounters and signposted regional danger |
| Crew | Named roles, equipment, injuries, casualties and service XP | Relationships, rank abilities and off-duty presence |
| Art | Cinematic stills, realistic single-pose figures, lit vector decks and depth sorting | Directional poses, impact/movement animation and richer ship scenes |
| Endings | Voluntary homecoming and voyage acknowledgements | Personal payoffs grounded in connected story records |

The expedition is independently playable, but its content and balance are still
in development. A system in Classic Voyage is not evidence that its equivalent
exists in the expedition.

## 4. Loops and pacing

The short loop: inspect a place, understand options, commit, see the result and
choose whether to continue. The expedition loop: plan travel, discover sites,
recover science/resources, improve the Lodestar and pursue leads. The long loop:
assemble the Return Drive and decide what to finish before leaving.

Keep three clocks distinct:

- **Campaign days:** travel/expeditions advance research and injury recovery.
- **Tactical turns:** AP and local hazards; campaign time advances on debrief.
- **Battle seconds:** simulated ship combat, controllable with pause; campaign
  time advances when the encounter report is acknowledged.

Provisional experience targets, not measured claims:

| Segment | Target | Player outcome |
| --- | --- | --- |
| Opening | First 10–15 minutes | Start research, survey, recover a discovery, identify the next lead |
| Site scene | 2–5 minutes | Understand a situation, choose, see a consequence |
| Boarding | Roughly 10–20 minutes | Solve a changing problem and make an extraction decision |
| Connected arc | 15–25 minutes across visits | Remember a person and a later consequence |
| Session | 20–40 minutes | Complete a satisfying discovery/objective and stop safely |

Total campaign length is not yet a validated promise. Measure full legal runs
and first-time players before changing research time. Preserve station work as
a recovery route while avoiding a campaign best played by repeating contracts.

## 5. Opening and onboarding

Open Expedition is the primary title entry. Its first goal is **start Drive
Diagnostics and investigate the Silent Courier**. Explain the return goal in one
sentence, then let the player act. Retain the guaranteed station, resource field
and accessible exotic-energy source in the starting system.

Teach survey → investigation → recovery → useful research through action.
Introduce boarding as an optional route with a clear objective and a way out.
Do not require understanding all six research branches before the first choice.
Future opening scenes should show Morozova's curiosity and the crew's uncertainty
through a brief exchange. Cinematics must be skippable and leave the first action
obvious. Resuming must not replay onboarding or old combat effects.

## 6. World and exploration

Locations include stations, worlds, ruins, derelicts, resource fields, anomalies,
outposts and signals. Knowledge progresses from undetected to detected,
investigated and resolved. Resolving cargo does not erase a pending story or a
station's services. Revisits communicate what changed and what remains possible.

Passive sensors reveal obvious contacts. Survey reveals further opportunities;
deep scans require equipment and expose buried/faint sites. Mandatory scientific
sources remain survey-accessible. Named findings retain their source: two
independent observations cannot be replaced by buying the same record twice.

Generated geography supports authored stories. Future arcs bind to stable,
reachable sites with explicit fallbacks and never shuffle between visits. Do not
hide a required beat behind a scan the player cannot unlock. Do not despawn
essential science because an unrelated story ended.

## 7. Economy, research and homecoming

Fuel governs routes, materials construction/field supplies, credits services and
exchanges, and hull expedition damage. Discoveries are knowledge, not currency.
Magazines belong to encounters rather than adding a strategic ammunition economy.

The mandatory research sequence is:

1. Drive Diagnostics — 4 base days.
2. Exotic Energy Storage — 6 days and an exotic-energy finding.
3. Spatial Field Dynamics — 8 days and two independent spatial/propulsion sources.
4. Prototype Return Drive — 10 days, then construction and a controlled test.
5. Drive Stabilisation — 12 days after the test, then final drive construction.

The 40 base research days run alongside activity. One project is active; three
can wait in the queue. Switching preserves work. The next eligible queued project
can start, while blocked prerequisites remain visible.

Research unlocks capability, construction spends resources, and fitting occupies
a slot. Building automatically fits when space permits; otherwise the item is
stored. The lab explains these states. Optional weapons, shields and translation
must not become hidden requirements for victory.

Prototype testing offers a slower remote route or a faster route costing hull;
it can be aborted and retried. After constructing the final drive, home is
available from any system outside an active encounter. No mandatory final battle.
Emergency fuel, renewable station work, safe recovery and recruitment keep a
wounded expedition viable. Setbacks cost time, options or people, not an
unexplained forced restart.

## 8. Narrative, factions and crew

Existing choices combine time/resource consequences with an archive record.
The Courier asks whether to carry 143 letters or leave a beacon. Carrying them
leads to another system's relay and an acknowledgement. Extend this model into
connected content rather than adding many isolated reward buttons.

Each future arc needs a person with a concrete need, two defensible approaches,
an immediate result and a later response. A difficult choice is more than a good
answer with a fee. A grateful person can still disagree. Avoid interchangeable
speeches about destiny or a consequence that exists only in flavour text.

Voice direction: Morozova notices evidence and uncertainty; Cross considers what
equipment and people can bear; Vale's choices express the player's priorities.
These are writing intentions, not a claim of a complete relationship simulation.
Recurring civilians need stable identities and distinct concerns. Never use a
lost or abandoned person as an unexplained returning speaker.

Factions currently supply geographic context. The intended future model separates
standing, understanding and access. Prove one arc with explicit local consequences
before adding global reputation meters or five simultaneous faction storylines.

Six named operatives form a reserve roster; four deploy. Roles affect health,
movement, damage, interaction or healing. Injured survivors recover and stations
provide replacements. XP is recorded but grants no rank bonus yet. Future
progression should offer a few role-specific choices without making replacements
unusable. Ship-officer deployment and expanded squads remain deferred.

## 9. Boarding

The current board is a 12×10 grid presented isometrically. Two AP per operative
create tradeoffs between moving, shooting, sprinting and preparation. Movement
uses known floor; cover protects directionally; line of sight blocks fire. Range,
visibility, cover and insufficient AP must be understandable as different limits.

| Objective | Main decision | Pressure and exit |
| --- | --- | --- |
| Core recovery | Find a route to the objective and back | Guards; clearing every enemy is unnecessary |
| Rescue | Divide escorts or keep the group protected | Physically bring civilians to the shuttle; partial rescue allowed |
| Sabotage | Prepare the retreat before disabling the uplink | Alarm, pursuing guards and one reserve |
| Salvage | Take another case or leave with secured cargo | Turn-based heat deeper in the deck; partial extraction allowed |

Movement previews show AP and exposure to guards visible now, explicitly excluding
unseen enemies and future movement. Heat previews show actual destination damage.
Last-order feedback explains hits, misses, shield absorption, health loss and
incapacitation. Neither preview nor animation may alter simulation state.

Extraction is a meaningful objective. Revive or evacuate downed operatives when
possible; confirm people left behind explicitly. Success claims site cargo and
bonus once. Withdrawal without the objective permits a retry or remote recovery.
Roster consequences still apply. A later arc must respect partial outcomes.

Future additions should deepen a decision: distinct enemy behaviour, role
interaction or an environmental choice. Larger boards, six-person deployments,
elevation and grenades from the original proposal are deferred hypotheses, not
promised features. Readability on a laptop takes priority over map size.

## 10. Ship encounters

Current encounters are optional station escorts. Contact offers negotiation,
payment, evasion, engagement or refusal. Combat manages eight reactor power,
compartment targets and repairs, with laser/missile/ion/beam differences.
Pause provides time to understand the situation. Damage should explain its effect.
Escape and surrender are real outcomes; defeat disables the ship and incurs a
recovery cost. Hull damage persists.

Broader conflict is future work. An interception needs a reason and, where
appropriate, a credible noncombat option. Frequent ambushes and repetitive
combat dialogue would undermine exploration.

## 11. Art, motion and sound

Grounded, worn science fiction: navy space, ivory equipment, muted copper
machinery, restrained teal information lights. Materials look usable and touched
by people. Realistic stills establish scale, place and emotion; the tactical
information layer stays crisp and independent of artwork.

- **Environments:** coherent lighting, a clear focal point and crop-safe composition.
  Preserve people and objectives at laptop aspect ratios.
- **Figures:** consistent orthographic camera, scale, light and ground contact;
  separate crew, machines and civilians by silhouette as well as colour. Future
  poses must match the actual board perspective.
- **Decks:** distinct floors, cover and walls, rear-to-front sorting, status marks
  above scenery and reliable fog concealment.
- **Interface:** strong hierarchy and restrained telemetry; decorative detail must
  not compete with an active order or consequential choice.
- **Motion, planned:** brief movement, recoil, impact and extraction beats that
  never gate input or determine simulation time. Reduced motion keeps immediate
  state feedback while removing travel/recoil effects.
- **Expedition audio, planned:** quiet ambience and specific interaction/hazard
  cues, independent mute/volume, no autoplay dependency and no repetitive spoken
  damage reports. All essential information remains understandable silently.

Create new raster art for a defined screen need. Inspect it at shipping size,
record prompts/provenance, compress files and inspect alpha edges. Keep labels,
hit odds and controls outside raster images. Single-pose figures are the current
baseline, not finished character animation.

## 12. Interface and accessibility

Current stations: Current system, Galaxy chart, Research lab and Discoveries,
plus Away team and encounter screens. The command area shows resources, save
status and the next research goal. Story and tactical objectives should be
reachable without losing the relevant map or choice context.

Requirements: keyboard-operable controls, visible focus, labelled disabled
reasons, text/symbol support for colour, no essential hover-only information and
readable contrast. Target at least 44×44 CSS pixels for critical controls; audit
rather than assume current compliance. Respect reduced motion and retain usable
layouts at 320px. Map panning is intentional; page-level horizontal overflow is not.

Autosave failure must be visible. Replacing progress requires confirmation.
Art/dialogue must not shift destructive controls under the pointer. A full
screen-reader audit remains outstanding; SVG labels alone do not establish it.

## 13. Persistence and engineering principles

The expedition uses serialisable seeded state and accepted-action journals.
Reducers own outcomes. Presentation cannot consume combat randomness, award
cargo, advance turns or change identity. Reload reproduces equipment, objectives,
encounters and resource totals.

Version-7 expedition journals support earlier versions through explicit rules.
Classic saves use a separate format/key. New features cannot reinterpret accepted
old actions. Retain fixtures; introduce changed semantics through explicit actions
or versioned rules/content. No backend is needed for current scope. Local saves
are not cross-device backup; export/import is a future option. Measure the bundle
advisory and journal-length ceiling before a broad public release.

## 14. Quality and playtesting

Automation checks correctness; people establish whether decisions are interesting.
Each milestone needs legal-order replays, adversarial boundaries and visual review.
Passing tests alone do not establish commercial polish or final balance.

For the next slice, observe at least five new players if available. Without
coaching, ask them to identify the next objective, explain their choice and recall
a person's response. Record hesitation, missed controls, low-value repetition and
misunderstood consequences. Proposed first gate: four of five find the next step,
at least three recall a consequence, nobody loses progress to a bug. This is a
small-sample iteration criterion, not evidence already collected.

Release quality also requires full noncombat and combat-inclusive campaigns,
casualty/poverty recovery, old-save replay, keyboard/laptop review, measured load
performance and no unexplained progression block.

## 15. Next design milestone

Build **The Long Relay**, an optional continuation of the Courier story: two
recurring contacts, one substantial decision and a later response, supported by
a compact active-objective view and a persistent record. It tests whether the
existing systems can produce attachment and anticipation. [NEXT.md](NEXT.md)
defines the slice and its acceptance gates.

Then invest in crew progression and faction arcs, followed by combat variety
and presentation. Give players a reason to care about the next place before
adding more places or equipment.

## Survivor continuity and animated boarding — 12 October 2026

The next implemented optional voyage is **Someone left behind**. A named person
actually evacuated during a new rescue asks for the field team's last recorder.
Its weight creates a tactical role: someone carries slowly while others cover
the retreat. The captain can leave without it and must hear the survivor's
response. Evidence, withdrawal and a lost team have honest distinct closeouts.
The mission remains independent of the route home.

Directional character rigs and modular metallic decks are now implemented;
photorealistic cinematic fidelity and human playtesting remain unfinished.
[Detailed scope and captures](ANIMATED-BOARDING-AND-SURVIVORS.md).

## Laptop boarding presentation — 12 October 2026

Enemy turns now show the actual ordered moves, overwatch interruptions, shots,
reloads, reserves and heat events. Orders pause during playback; speed and skip
controls are always available. The authoritative turn is saved immediately.
The recorder vault is the visual reference scene for this pass: storage racks,
cooling equipment, service consoles and a cutaway hull. See
[LAPTOP-BOARDING.md](LAPTOP-BOARDING.md) for evidence and remaining limitations.
