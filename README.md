# Starship Explorer

**Explore strange worlds. Bring your people back. Build a way home.**

A single-player space expedition for laptop and desktop browsers. Captain the ISS Ithaca in a
seeded galaxy, recover scientific discoveries, lead boarding teams and defend
survey ships. Research the Return Drive while the voyage continues, then decide
when you are ready to leave.

![The Silent Courier — a derelict waiting to be explored](public/assets/exploration/silent-courier.webp)

## Play the current game

Choose **Begin expedition** on the title screen. **Resume expedition**
continues its browser autosave. Enter a galaxy seed to revisit the same
generated world.

Every expedition screen shares one slim bar: the four stations (**Current
system**, **Galaxy chart**, **Research lab**, **Discoveries**), ship resources,
**Away team**, **Title screen** and the sound switch. Art fills the rest of the
screen; details open on demand.

1. Open the **Research lab** and start **Drive Diagnostics** so research advances
   while you explore. The lab's tab is flagged **idle** whenever nothing is
   being researched. Tick **Continue the route home automatically** in the lab if
   you want each later drive project to start by itself once its requirements
   are met.
2. Survey the arrival system and open **The Silent Courier** from the places
   along the bottom of the screen.
3. Choose a story response. Select Helen Morozova's portrait for her briefing:
   investigation, recovery, boarding and station services all live there.
4. Follow research leads (shown in a project's details, nearest first), visit
   stations and collect independent spatial or propulsion discoveries. On the
   **Galaxy chart**, hover a star for a second or select it for its card, or use
   **Find system**; choose **Travel the route** to fly every jump in one order.
   The course pauses if research completes on the way.
5. Research, construct and field-test the prototype. Finish Drive Stabilisation,
   construct the Return Drive and choose **Return home** when ready.

**Discoveries** keeps the voyage record: side voyages in progress, the
captain's decisions, recovered sources and the full captain's log.

The earlier deduction-led campaign, **Classic Voyage**, remains playable from
`/?classic`, with its own save. Its clue puzzle and Rift Surges are separate rules.

## What is playable

| System | Current implementation |
| --- | --- |
| Expedition | Seeded galaxy, persistent sites, passive/survey/deep scans, travel, stations and discovery archive |
| Research | All 29 projects across six branches; one active project, three queue slots, construction and fitting |
| Encounters | Ten authored templates, Courier letters, The Long Relay and Someone left behind (a rescued survivor’s follow-up) |
| Boarding | Four-person squads; core recovery, rescue, sabotage, salvage and fragile-recorder extraction; nine standard operation configurations plus the recorder vault |
| Tactical decisions | Cover, line of sight, fog, AP, aim, overwatch, equipment, extraction and persistent injuries/casualties |
| Tactical feedback | Route/AP/exposure/heat previews, targeting lines, hit/miss and damage summaries, depth-sorted figures; ordered enemy turns with speed and skip controls |
| Ship encounters | Station escorts with negotiation, evasion or real-time combat with pause, reactor power, compartment targeting, on-hull damage markers and a guided repair order |
| Presentation | Interactive galactic atlas; six overhead warships; eight-direction rig-rendered crew and custodians; a detailed archive vault; laptop deck enlargement and keyboard shortcuts |
| Persistence | Version-10 expedition journals; versions 1–9 supported; explicit survivor identity tracking on new deployments; Classic Voyage kept separate |
| Finish | Research, prototype test, Return Drive construction, voluntary return and voyage summary |

This is a playable game under active development. Long faction arcs, a developed
crew relationship system, rank abilities, photorealistic character fidelity and
full-run human balance validation remain ahead. Character frames come from consistent
articulated rigs; they are still stylised. Layout variations include reflected plans.
No runtime AI API or 3D renderer is required by the game.

## Laptop controls

Boarding gives the deck the screen. The squad runs down the left: select an
operative's bar for their portrait, weapon and segmented stat bars, and the
mission tag beside the turn counter for the objective. Hover a lit tile to
preview the move (AP, exposure, heat; sprints are chosen by distance) and click
to move. Hover a visible hostile to preview the shot and click to fire. On a
touch screen, the first tap previews and a second tap orders. The quick bar
under the deck holds **Action** (reload, objective, recorder, medkits), **Aim**,
**Overwatch**, **Heal self** and **End turn**. **Enlarge map** hides the squad to
give the deck more width; **Fit map** restores it.

- **1–4**: select operative; **N**: next operative with AP.
- **F**: fire at the selected target; **R**: reload; **O**: overwatch.
- **Shift+Enter**: end turn. Hostile actions play in sequence at **1× or 2×**.
- **Esc** or **Skip playback**: return directly to the resolved turn.

The turn is saved immediately; animation never rerolls a shot. Reduced motion
skips the sequence and retains the written combat summary. These controls do
not activate while typing or while the extraction confirmation is open.

[Latest laptop milestone and actual screenshots](docs/LAPTOP-BOARDING.md).

## Play the survivor follow-up

Rescue at least one surveyor through a new **Rescue** deployment and acknowledge
the debrief. At a contacted station, accept **Someone left behind** from that
actual survivor. Follow the marked destination, investigate it, then choose
**Prepare recorder recovery**. The carrier moves two tiles per AP and cannot
sprint. Lifting the recorder wakes two reserve custodians; hand it to another
operative by setting it down and lifting it again. Bring it to the shuttle or
withdraw without it, then return to the original station for the survivor’s reply.
Evidence pays 24 credits once. This return visit awards no normal site cargo.

Old rescue logs recorded counts only; they are not assigned invented identities.
Your next rescue enables the new request. The Return Drive remains available
regardless of optional mission progress.

## Run locally

Use Node.js 22.12+ on the Node 22 line (CI uses Node 22) and npm.

```bash
npm ci
npm run dev
```

Open the local URL printed by Vite. Saves live in that browser and origin;
there is no account or cloud-save service. Clearing browser storage removes
local progress. Replacing an expedition prompts first.

```bash
npm run build       # TypeScript check + production build into dist/
npm run preview     # serve the production build locally
```

## Validate changes

```bash
npm test
npm run typecheck
npx playwright install chromium
npm run test:e2e
npm run exploration:simulate -- 20
npm run tactical:simulate -- 12
npm run ship:simulate -- 20
node --import tsx tools/operation-walkthrough.ts 12
```

For constrained environments use `npm test -- --maxWorkers=2` and
`npm run test:e2e -- --workers=2`. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` can point
to an existing compatible Chromium executable. Playwright starts Vite on port 4173.

Latest implementation: **12 October 2026**. See
[the animation and survivor milestone](docs/ANIMATED-BOARDING-AND-SURVIVORS.md)
for exact scope, validation, reproduction and real game captures. Vite still reports
a JavaScript chunk-size advisory. Human balance and visual-quality playtesting remain open.

## Design and development

| Document | Purpose |
| --- | --- |
| [Game design](docs/DESIGN.md) | Player experience, systems, narrative, art, pacing and quality bar |
| [Implementation specification](docs/SPECIFICATION.md) | Current contracts, architecture, compatibility and acceptance criteria |
| [Roadmap](docs/ROADMAP.md) | Prioritised milestones and completion gates |
| [Next design milestone](docs/NEXT.md) | A connected-story slice: The Long Relay |
| [Classic design](docs/CLASSIC-DESIGN.md) | The preserved mystery campaign |
| [Redesign history](docs/REDESIGN-V2.md) | Original proposal and dated implementation notes |
| [Latest tactical review](docs/TACTICAL-READABILITY.md) | Movement guidance, damage feedback and depth-order validation |

`DESIGN.md` owns experience and scope; `SPECIFICATION.md` owns implementation
contracts; `ROADMAP.md` owns priority. Historical notes record earlier states.
Features marked **planned** are not implemented by publishing their design.

```text
src/engine/exploration/  Expedition, research, stories and ship battle
src/engine/tactical/     Boarding rules, operations and deck variants
src/engine/state/        Classic Voyage state and reducer
src/engine/mystery/      Classic deduction puzzle
src/ui/                  React views, presentation helpers and persistence
public/assets/           Shipped static assets
tests/                  Rules, replay, compatibility and property tests
e2e/                    Browser scenarios
tools/                  Seeded campaign and combat pilots
docs/                   Design, specification and milestone evidence
```

React 19 · TypeScript · Vite · Tailwind/CSS · Vitest · Playwright. Expedition rules
are pure seeded reducers. The UI requests actions and presents outcomes; it does
not decide combat results. Classic Voyage has its own older architecture.

## Contribution and release rules

- Keep mandatory science reachable and optional combat optional.
- Preserve accepted old journals; introduce new mechanics explicitly and version
  saves when required. Never silently reinterpret old actions.
- Test the failure modes a change introduces: invalid orders, repeated rewards,
  hidden-information leaks and reload boundaries.
- Review changed screens at 1366×768, 1440×900 and 1920×1080, with keyboard and reduced motion. Laptop/desktop play is the product target; narrow layouts are a fallback.
- Publish the reviewed, tested tree to `main` and verify deployment status.
- Record generated-art prompts and provenance in milestone notes. Keep text,
  controls and tactical information out of raster artwork.

Repository: [henders23/starship-explorer](https://github.com/henders23/starship-explorer).
The product name is **Starship Explorer**; the ship is the ISS Ithaca.
