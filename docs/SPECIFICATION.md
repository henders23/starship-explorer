# Starship Lodestar — implementation specification

**11 October 2026 · Open Expedition · baseline `babec95` · save envelope 7**

This is the engineering companion to [DESIGN.md](DESIGN.md). Sections 1–9 describe
implemented behaviour and contracts to preserve. Section 10 defines proposed
work; it does not claim those features exist. Exact tuning lives in the linked
source modules; update this document when intentionally changing the contract.

## 1. Scope and ownership

| Concern | Owner | Responsibility |
| --- | --- | --- |
| Campaign | [campaign.ts](../src/engine/exploration/campaign.ts) | Action validation, resources, clock, research, encounter integration and journal |
| Persistent world | [v2.ts](../src/engine/exploration/v2.ts) | Stable site generation, scans, statuses and one-time recovery |
| Research data | [research.ts](../src/engine/exploration/research.ts) | 29 projects, prerequisites, effects, blueprints and slot capacities |
| Site stories | [stories.ts](../src/engine/exploration/stories.ts) | Authored choices, deterministic selection and story records |
| Boarding | [mission.ts](../src/engine/tactical/mission.ts) | Movement, visibility, cover, attacks, AI, objectives and extraction |
| Operation content | [operations.ts](../src/engine/tactical/operations.ts), [variants.ts](../src/engine/tactical/variants.ts) | Briefings, objective data, fixed variants and civilian identities |
| Ship battles | [ship-battle.ts](../src/engine/exploration/ship-battle.ts) | Contact, validated orders, clock, power, damage and outcome |
| Presentation | [ExplorationDeck.tsx](../src/ui/ExplorationDeck.tsx), [TacticalMission.tsx](../src/ui/TacticalMission.tsx) | Views, selection, focus and dispatch |
| Tactical guidance | [tactical-guidance.ts](../src/ui/tactical-guidance.ts), [tactical-scene.ts](../src/ui/tactical-scene.ts) | Read-only previews, state-difference feedback and scene order |
| Expedition saves | [exploration-save.ts](../src/ui/exploration-save.ts) | Envelope validation, replay and legacy-preview migration |

The expedition has no server dependency. React owns transient interaction state;
pure reducers own gameplay. UI timers request validated ship `advance` orders.
A sprite, preview, camera or animation may not decide damage or advance RNG.

## 2. State, transitions and invariants

`Campaign` contains the seed/world/location, discovered site statuses, findings,
day/fuel/hull, research, built/equipped modules, prototype/return state, roster and
loadouts, story records, operations, escort records, active/last missions and
battles, accepted actions and a display log. The display log is not an event
source; replay uses `actions` and any frozen `legacyActions` prefix.

| ID | Contract |
| --- | --- |
| C01 | Same seed and accepted action journal reproduce the same gameplay state |
| C02 | Invalid action returns the original state, spends nothing and adds no journal entry |
| C03 | Input state is not mutated; derived previews and visibility do not consume randomness |
| C04 | Active boarding locks campaign actions to tactical orders/debrief; active ship contact locks to ship orders/debrief |
| C05 | Prototype calibration permits only completion or abort; home is terminal for campaign actions |
| C06 | Nonnegative resources; fuel/hull caps and blueprint-slot limits enforced in the engine |
| C07 | One-time site, story, delivery and escort rewards cannot be reclaimed through reload/revisit/repeated dispatch |
| C08 | Mandatory science has independent reachable sources; no optional combat victory or optional equipment is required for homecoming |
| C09 | No journalled gameplay effect is created by selecting, previewing, cancelling a preview or changing tabs |

`actionLock`, `tacticalLock` and `shipOrderLock` supply the UI's disabled reasons
and enforce the same restrictions on dispatch. New actions need both runtime
validation and TypeScript types. Do not trust imported save data as typed input.

### Location lifecycle

| State | How reached | Available next steps |
| --- | --- | --- |
| Undetected | Generated, not exposed | Appropriate scan |
| Detected | Passive/survey/deep scan | Investigate at the current system |
| Investigated | Investigation, normally 1 day | Recovery, available story, boarding at ruin/derelict, or station services |
| Resolved | Successful recovery/debrief | Recorded discoveries; pending story may remain; station services persist |

World generation reserves at least three independent sources per discovery kind,
preferentially across regions. The campaign exposes mandatory deep-tier science
sources at survey tier. The start guarantees a station, resource field and
survey-accessible Silent Courier. Preserve location IDs and existing seeded
selection when adding content; use a separate deterministic stream for new data.

## 3. Campaign clock and economy

| Action | Current effect |
| --- | --- |
| Travel | One day; connected-lane fuel cost; Slipstream permits eligible two-lane routes |
| Survey/deep scan | One day; deep requires fitted array; repeated completed scan rejected |
| Investigate | One day; makes local detected site available |
| Careful recovery | Two days, or one with fitted recon drones; no hull loss |
| Rapid recovery | One day; four hull per threat tier; fitted countermeasures remove ruin/derelict damage |
| Field engineering | Fitted tools add four materials to rapid ruin/derelict recovery |
| Station refuel | One day; +20 fuel capped; 10 credits, or 8 with Trade-Language Translation |
| Station repair | One day; +20 hull capped; 5 materials plus 10/8 credits |
| Buy materials | One day; 18 credits for 4 materials |
| Sell materials | One day; 4 materials for 12 credits, or 15 with trade translation |
| Station work | Repeatable; three days for 8 materials and 18 credits |
| Archive record | One day; 30 credits; translation required; relay permits remote known-station access |
| Emergency fuel | Only when no adjacent jump is affordable; three days; enough fuel for neighbouring travel, capped |
| Fitted recycler | One day; 3 materials for up to 15 fuel |
| Build module | One day; blueprint resources; auto-fit if a slot is available |
| Fit/unfit | No day; engine validates slots/permanent installations; removing tanks vents excess fuel |
| Medical rest | One day; available when a living operative is injured |
| Recruit | One day; 20 credits at a contacted local station; maximum six living operatives |
| Tactical debrief | One day, including withdrawal/defeat; roster consequences persist |
| Ship debrief | Zero days if cancelled, three if disabled, otherwise one |

Initial expedition: day 0, fuel 80/80, hull 100/100. Tanks increase fuel capacity
to 100. Composite hull raises capacity to 120 and adds 20 hull on fitting.
Research progresses through elapsed campaign days, not real time. Automated lab
provides 1.25 work per day. Research work can carry into eligible queued projects.
Starting/switching/queueing research does not itself advance the day.

Station archives count at most one spatial/propulsion source per station. Buying
two subjects from the same archive must not satisfy the two-independent-source
gate. Source findings are retained, not consumed by research.

## 4. Research and return contract

One active project, maximum three queued. Queueing may precede eligibility;
the first eligible queued project starts when possible. Pausing/switching preserves
progress. Physical modules use engine 2, utility 2, gadget 1, hull 1 and drive 2
slots. Hull/drive installations cannot be unfitted.

Prototype: research, construct for **25 materials + 50 credits**, then begin a
test in a surveyed system. Remote test takes two days without damage; shielded
test takes one day and 10 hull, requiring more than 10 hull. Aborting is safe.
Drive Stabilisation requires a completed test. Final Return Drive construction
costs **60 materials + 150 credits**. `return-home` requires construction, not a
particular system, faction, optional upgrade or victory. Active encounters still
must be resolved first.

### Research catalogue

All entries below are implemented. Days are base research work, not elapsed
real-world time. A blueprint indicates construction; loadout unlocks have their
own per-deployment supply cost. The source catalogue remains authoritative.

| Project | Branch | Days | Prerequisites | Construction / use |
| --- | --- | --- | --- | --- |
| Drive Diagnostics | Propulsion | 4 | None | Research effect |
| Exotic Energy Storage | Propulsion | 6 | Drive Diagnostics; Exotic-energy finding | Research effect |
| Spatial Field Dynamics | Propulsion | 8 | Exotic Energy Storage; Two independent spatial/propulsion sources | Research effect |
| Prototype Return Drive | Propulsion | 10 | Spatial Field Dynamics | 25 materials + 50 credits; drive slot |
| Drive Stabilisation | Propulsion | 12 | Prototype Return Drive; Completed prototype test | Research effect |
| Fuel Optimisation | Propulsion | 5 | None | 15 materials + 35 credits; engine slot |
| Extended Fuel Tanks | Propulsion | 5 | None | 12 materials + 30 credits; engine slot |
| Slipstream Navigation | Propulsion | 7 | Drive Diagnostics | Research effect |
| Emergency Fuel Recycling | Propulsion | 6 | None | 10 materials + 25 credits; utility slot |
| Fire Control Algorithms | Weapons | 4 | None | Research effect |
| Ion Projector | Weapons | 6 | Fire Control Algorithms | 18 materials + 50 credits; utility slot |
| Focus Beam | Weapons | 7 | Fire Control Algorithms | 24 materials + 70 credits; utility slot |
| Alien Plasma Ballistics | Weapons | 8 | Fire Control Algorithms | Loadout unlock; 2 materials per equipped operative per deployment |
| Composite Hull | Defence | 4 | None | 18 materials + 45 credits; hull slot |
| Layered Shielding | Defence | 6 | Composite Hull | Research effect |
| Adaptive Shield Matrix | Defence | 7 | Layered Shielding | Research effect |
| Personal Shield Emitters | Defence | 6 | Composite Hull | Loadout unlock; 2 materials per equipped operative per deployment |
| Planetary Spectrometry | Sensors | 4 | None | Research effect |
| Signal Triangulation | Sensors | 5 | Planetary Spectrometry | Research effect |
| Tactical Threat Analysis | Sensors | 6 | Planetary Spectrometry | Research effect |
| Deep Survey Array | Sensors | 8 | Planetary Spectrometry; Any finding | 20 materials + 65 credits; utility slot |
| Trade-Language Translation | Communications | 4 | None | Research effect |
| Contextual Translation | Communications | 6 | Trade-Language Translation | Research effect |
| Electronic Countermeasures | Communications | 6 | Trade-Language Translation | 15 materials + 40 credits; utility slot |
| Diplomatic Relay Network | Communications | 7 | Contextual Translation | Research effect |
| Trauma Protocols | Applied science | 4 | None | Research effect |
| Field Engineering | Applied science | 5 | None | 10 materials + 25 credits; gadget slot |
| Reconnaissance Drones | Applied science | 6 | Field Engineering | 15 materials + 40 credits; gadget slot |
| Automated Research Laboratory | Applied science | 7 | Planetary Spectrometry | 25 materials + 80 credits; utility slot |

## 5. Boarding contract

Choose exactly four distinct, healthy, living operatives at an investigated,
unresolved local ruin/derelict. Standard loadouts are free. Plasma and shields
each cost two materials per selected operative at valid deployment; changing a
loadout is free, and active missions prohibit changes. Failed deployment charges
nothing. The mission's seed includes the attempt number; published variant
selection is site-stable, while retries can have different combat rolls.

Current board: 12×10; Manhattan movement/range. Two AP per living operative at the
start of a player turn. Known floor and occupancy constrain pathfinding. Visibility
uses living crew, range 7 and supercover line of sight. Explored tiles remain
remembered; hostile visibility is current, not permanent knowledge.

| Order | AP / rule |
| --- | --- |
| Move | 1; up to movement allowance (normally 4, recon 5) |
| Sprint | 2; up to twice allowance |
| Shoot | 1; visible living target, range ≤7, clear sight, ammo and unused shot |
| Aim | 1; +20 percentage points to next shot; no stacking; before firing |
| Overwatch | 1; ammo and unused shot; reactive fire uses the shot allowance |
| Reload | 1; only below magazine capacity |
| Interact | 1; objective-specific range and conditions; engineer reach where supported |
| Heal | 1; usable medkit; injured adjacent ally/self; can revive a downed ally |
| Evacuate | 1; conscious operative in extraction beside a downed ally |
| End turn | No operative AP cost; guards act and applicable heat resolves |
| Extract | Conscious operative at shuttle; explicit abandonment flag where needed |

Accuracy: `clamp(75 - cover - max(0, distance - 4)*5 + aim, 10, 95)`.
Cover penalty is 20 for facing half cover, 40 for facing wall cover; walls also
block sight. A displayed percentage alone is not a legal-shot guarantee: ammo,
AP and one-shot-per-turn checks also apply. UI shows no-clear-shot for blocked
geometry. Shot RNG is tied to mission seed and roll index.

Standard damage is 3, or 4 for heavy; plasma adds 2 and uses a two-round magazine.
Standard magazines hold 4, heavy 3. Personal shields absorb four damage total,
replace the medkit and do not regenerate. Heat bypasses shields. Crew health
ranges from recon 8 to heavy 11. Class details live in `ROLE_NOTES` and mission
creation, not in duplicated UI constants.

### Objectives and outcomes

| Operation | Completion and bonus |
| --- | --- |
| Core | Interact with core and extract; normal site reward |
| Rescue | Guide civilians physically to shuttle; 3 materials + 15 credits per evacuated civilian |
| Sabotage | Disable uplink and extract; 8 materials + 20 credits; alarm triggers pursuit/reserve |
| Salvage | Collect at least one case and extract; 5 materials + 8 credits per case, up to three |

Salvage heat: tiles with zero-based `x >= 4` (display columns 5–12), after enemy
activity at the end of turn 4 onwards: 1 health; turn 7 onwards: 2 health. The
shuttle-side columns stay safe. No real-time hazard clock.

Partial rescue/salvage successes resolve the site, including other mission offers,
and claim normal science/cargo plus bonus once on debrief. Extraction records
who returned. Unreturned operatives become dead on debrief. Injured returnees
recover after four additional campaign days, or two with Trauma Protocols.
Survivors gain 3 service XP for success, 1 otherwise; XP has no rank effect yet.
Withdrawal without success leaves site recovery available and awards no cargo.

Each newer operation has three variants: original, reflected and an authored
alternative. Explicit variant-bearing deployments preserve site identity. Old
orders without a variant retain original generation and names. Original core
missions keep their two-layout generator. Do not count a reflection as a wholly
new authored map in release notes.

### Guidance and rendering invariants

- Movement previews use engine paths/locks and report AP remaining, directional
  cover, currently visible guard firing chances and destination heat.
- Never disclose a guard merely because moving would reveal it. Do not promise
  safety against unseen threats or guards that may move.
- Feedback compares before/after health and shield values; misses still cost AP
  and ammo. No transient feedback replay after reload.
- Render floor, depth-sorted physical objects, then unobscured status marks.
  Hidden hostiles/scenery stay concealed. Decorative layers do not block clicks.
- Civilian beacon numbers retain their original indices after an evacuation.

## 6. Ship encounter contract

`ShipBattle` phases and orders belong to the expedition engine. Contact can end
through negotiation, payment, evasion or cancellation, or begin battle. Reactor
power totals at most 8. Weapon draw must fit assigned weapon power. Helm, weapons,
shields and engines have independent condition; repair selection is explicit.

The UI sends validated integer-second `advance` orders while unpaused; pause is
presentation control over those requests. Equivalent accepted tick partitions
must produce identical results. Never derive combat outcomes from animation time.
Lasers, missiles, ion and beams retain their distinct shield/system behaviour;
research and fitted modules supply upgrades at encounter creation.

Victory pays 12 materials + 35 credits. Negotiation, successful evasion or accepted
surrender pays 6 + 18. Successful escort locations cannot pay again. Retreat keeps
the job available without payment. Disabling leaves hull at 1, loses up to 8
materials/20 credits from existing stores and takes three days on debrief.
Renewable station work can fund repairs. No expedition game-over from this defeat.

## 7. Stories and presentation contract

Current site stories are two-choice authored templates selected independently of
world/combat RNG. Choice records contain location/story/choice IDs and day. They
may be made after cargo recovery and are paid once per site. Known costs must be
shown and affordability checked before dispatch.

The Courier `carry` choice permits a one-time delivery at a contacted station
outside the start system: one day, 25 credits and `lettersDelivered = true`.
The `beacon` choice is a different resolved decision, not an outstanding delivery.
Currently there is no general multi-step quest state or faction relationship map.

Transient selections, map enlargement, preview/cancel, feedback and pause controls
are not campaign rewards. Screens must preserve usable focus and expose save
failure. Phone navigation must bring both the map and active orders within reach.
New animation must honour reduced motion and remain separate from deterministic
state. Accessibility claims require actual testing, not just ARIA attributes.

## 8. Persistence and compatibility

| Mode | Storage | Format |
| --- | --- | --- |
| Open Expedition | `starship-explorer-exploration-v2` | Version 7, `ruleset`, seed, `legacyActions`, accepted `actions` |

Expedition loading accepts versions 1–7. Version 1 replays the frozen preview
reducer before migration. Later envelopes replay accepted actions, rejecting
feature orders unavailable in that envelope's version. Version 7 adds explicit
operation variants; pre-7 envelopes reject them. Seed length is 1–200 characters;
`actions` and a non-null legacy prefix are each limited to 10,000 entries.
Unreadable/unknown expedition saves remain untouched and show an error. Writes
return failure rather than claiming successful autosave.

**Known limitation:** saving does not currently enforce the loader's 10,000-action
ceiling. Very long journals, especially battle ticks, need a measured compaction
or checkpoint design before broad release. Do not claim arbitrary-length voyages
are safe merely because shorter replay fixtures pass.

Compatibility rules for every new mechanic:

1. Identify every existing accepted action whose semantics could change.
2. Preserve those semantics, or add explicit version dispatch/frozen replay rules.
3. Introduce new behaviour through an explicit new action or content version.
4. Version the envelope when new orders/state need discrimination; reject those
   orders under older envelopes and retain existing fixtures.
5. Test reload at interaction, combat, report and reward-acknowledgement boundaries.
6. Never fix a replay mismatch by silently regenerating a different world or save.

## 9. Verification and release gates

| Contract | Existing verification anchors | Required regression focus |
| --- | --- | --- |
| C01–C03 | `exploration-campaign`, `rng`, `journal`, tactical/ship suites | Replay, invalid action identity, nonmutation, RNG independence |
| C04–C06 | Campaign/research/tactical/ship suites | Interleaved orders, negative resources, slots, active encounter locks |
| C07 | Story, operation, tactical and ship suites | Repeated reward/debrief, reload and reopened site attempts |
| C08 | Exploration world/campaign/research suites and walkthrough pilots | Source distribution, noncombat homecoming, zero-store recovery |
| C09 | Tactical guidance unit/browser suites | Preview and cancel leave the journal unchanged |
| Old saves | Save and expedition suites; milestone comparison evidence | Old journals, pre-version rejection, malformed save preservation |
| Readability | `e2e/tactical-guidance.spec.ts`, operations/loadout/ship flows | Actual desktop/phone screens, fog, depth, heat and damage |

Named suites are under [tests](../tests); browser scenarios under [e2e](../e2e).
See [README](../README.md) for commands. CI currently runs typecheck, unit
suites and Playwright; it does not contain a separate production-build step.
Run `npm run build` as an additional release check for gameplay changes.

The last gameplay baseline at `babec95` passed 277 tests in 29 files and 28 browser
scenarios plus build/visual review. For documentation-only updates, verify source
facts, commands, links and Markdown diffs; do not imply the gameplay suite was
rerun if it was not. Human playtesting and performance profiling remain separate.

For changed UI: inspect 1366×768, 1440×900 and 1920×1080 laptop/desktop layouts,
keyboard focus, reduced motion, no page errors, image decoding and overflow.
Publish the tested tree, verify remote `main`, then deployment status. Do not
reinterpret a green deployment as proof that every CI check has passed.

## 10. Implemented next slice: The Long Relay

**Implemented in version 8.** [NEXT.md](NEXT.md) contains the original scene/choice brief. This
section defines the minimal implementation contract, avoiding a generic quest
framework before one real arc works.

Implemented module: `src/engine/exploration/arcs.ts`. New optional state is absent
until an explicit `start-arc` action; do not auto-activate during replay of old
`deliver-letters` actions. The envelope version is 8; versions 1–7 continue to load.

```ts
// Current types in the shipping source.
type RelayStage = 'accepted' | 'relay-resolved' | 'complete';
type RelayApproach = 'repair' | 'local-copy';
interface RelayArc {
  version: 1;
  id: 'long-relay';
  originStationId: string;
  destinationStationId: string;
  stage: RelayStage;
  approach: RelayApproach | null;
  records: { beatId: string; choiceId: string; day: number }[];
}
type ArcAction =
  | { type: 'start-arc'; arcId: 'long-relay'; locationId: string }
  | { type: 'arc-choice'; arcId: 'long-relay'; beatId: 'relay';
      choiceId: RelayApproach }
  | { type: 'arc-choice'; arcId: 'long-relay'; beatId: 'reply';
      choiceId: 'acknowledge' };
```

Eligibility: delivered Courier letters, current location a contacted
station, no active encounter/calibration, expedition ongoing, arc not already
accepted. On start, bind the current station as origin and choose another
reachable station using a new independent deterministic stream. Reveal the exact
destination as an explicit lead without touching existing world generation or
combat RNG. Persist bindings. If no valid destination exists, disable acceptance
with an explanation; the rest of the game stays playable.

The relay choice requires the bound destination to be contacted locally. Repair:
5 materials and 2 days. Local copy: 3 days and no resource cost. Both resolve the
relay stage and continue ordinary research. No payout or scientific finding at
this stage. Reply acknowledgement requires a return to the origin station,
advances zero days and pays 20 credits exactly once; it creates the branch-specific
ending/captain's-record acknowledgement. These are the implemented balance values.

The arc may be left pending indefinitely. Deferral is a UI close, not an action
that pays, resets or advances anything. Homecoming is still allowed and describes
unfinished work honestly. No hidden timer, forced battle, casualty or mandatory
science gate. Existing delivery payment remains exactly 25 credits, unaffected.

| ID | Proposed acceptance criterion |
| --- | --- |
| N01 | Eligible old/new campaigns can opt in; ordinary version-1–7 replay produces no unsolicited arc or changed resources |
| N02 | Same accepted arc start binds the same reachable sites; preview cannot change binding or RNG |
| N03 | Wrong stage/site, duplicate start, duplicate acknowledgement, forged choice and insufficient repair supplies are rejected without mutation |
| N04 | Resource/day/research changes occur exactly once; local-copy route works with zero materials/credits |
| N05 | Reload at every stage preserves bindings, branch, resource totals, objective and reply text |
| N06 | Both branches can finish, be deferred or be left behind at homecoming; main campaign solvability remains intact |
| N07 | Objective panel points to a real route and says whether travel, contact or reply is next; no dead-end button |
| N08 | The reply and ending identify the actual approach; new named contacts are consistent and never presented as previously rescued NPCs |
| N09 | Desktop/phone, keyboard and reduced-motion flows complete without errors or overflow |
| N10 | Observed playtest meets the comprehension/recall gates in DESIGN.md, or documents and fixes the failure before content expansion |

Use legal actions to reach fixtures. Add targeted arc unit tests, route binding
sweeps, old-journal comparisons and both-branch browser flows. No synthetic reward
injection as evidence of a playable arc. Save gates must reject arc orders under
pre-feature envelopes. New art consists only of two contact portraits and one
relay scene if existing assets cannot meet the composition/identity need.

## 11. Implemented survivor callback and directional animation (12 October 2026)

**Someone left behind** adds `accept-survivor`, `deploy-recorder`,
`close-survivor`, and tactical `drop-recorder` orders. Save envelope 9 accepts
older journals unchanged. New rescue deployments explicitly opt into named
survivor tracking; historical rescues retain their original counts.

A local contacted station binds one actual rescued survivor and one reachable
recorder site. A separate tactical visit imposes carrier speed, transfer/drop,
and two alarm-triggered reinforcements. Success requires a conscious carrier
inside extraction. Retreat/loss are valid branch outcomes, never evidence
success. The original station pays 24 credits once for evidence; other branches
pay zero. No normal site reward is applied by the special debrief.

Animation consumes canonical state but introduces no AP, damage, RNG or campaign
clock changes. All seven rig atlases contain eight unmirrored directions. See
[implementation and evidence](ANIMATED-BOARDING-AND-SURVIVORS.md) for pose schema,
asset reproduction, acceptance coverage and remaining fidelity limitations.

## 12. Laptop boarding presentation

Laptop/desktop is the target platform; phone play is not an acceptance target.
Legacy narrow-screen checks may remain to catch accidental regressions.

1. An optional `TacticalObserver` receives detached snapshots for enemy moves,
   shots (including overwatch), reloads, reserves and heat. Enabling observation
   must produce exactly the same resulting mission, RNG rolls and log.
2. Playback exists only in React state. A single journal order is dispatched and
   saved immediately; reload/title/skip cannot replay or duplicate that order.
3. Only visible movement/reloading earns a playback frame. Reserve warnings may
   appear without exposing their position. Shots affecting crew remain reported.
4. Commands are guarded while playback runs. Speed toggles 1×/2×. Escape and Skip
   return control; reduced motion bypasses playback or stops it when enabled.
5. A fatal turn shows its damage before the debrief. No UI timer determines
   injuries, extraction, turn count, heat or reinforcement cadence.
6. At 1366×768 and larger, primary orders and four squad cards remain visible;
   the detailed orders panel scrolls. Enlarge map gives the deck the panel's width.
7. Rig assets remain 38 frames × 8 facings, with no new runtime renderer.
   Archive scenery is placed on actual cover tiles; hull dressing is outside the
   playable grid. Save version remains 9.

Evidence and reproduction: [LAPTOP-BOARDING.md](LAPTOP-BOARDING.md).
