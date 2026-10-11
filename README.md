# Starship Ithaca

**Explore strange worlds. Bring your people back. Build a way home.**

A single-player space expedition for the browser. Captain the ISS Ithaca in a
seeded galaxy, recover scientific discoveries, lead boarding teams and defend
survey ships. Research the Return Drive while the voyage continues, then decide
when you are ready to leave.

![The Silent Courier — a derelict waiting to be explored](public/assets/exploration/silent-courier.webp)

## Play the current game

Choose **Begin expedition** under **Open Expedition** on the title screen.
**Resume expedition** continues its browser autosave. Enter a galaxy seed to
revisit the same generated world.

1. Start **Drive Diagnostics** so research advances while you explore.
2. Survey the arrival system and investigate **The Silent Courier**.
3. Choose a story response and recover its scientific discovery. Remote recovery
   is available; tactical boarding is optional.
4. Follow research leads, visit stations and collect independent spatial or
   propulsion discoveries.
5. Research, construct and field-test the prototype. Finish Drive Stabilisation,
   construct the Return Drive and choose **Return home** when ready.

The title screen also retains **Classic Voyage**, the earlier deduction-led
campaign, with its own save. Its clue puzzle and Rift Surges are separate rules.

## What is playable

| System | Current implementation |
| --- | --- |
| Expedition | Seeded galaxy, persistent sites, passive/survey/deep scans, travel, stations and discovery archive |
| Research | All 29 projects across six branches; one active project, three queue slots, construction and fitting |
| Encounters | Ten authored templates and the Courier's 143-letter delivery voyage |
| Boarding | Four-person squads; core recovery, rescue, sabotage and salvage; nine configurations across the three newer operations |
| Tactical decisions | Cover, line of sight, fog, AP, aim, overwatch, equipment, extraction and persistent injuries/casualties |
| Tactical feedback | Route/AP/exposure/heat previews, targeting lines, hit/miss and damage summaries, depth-sorted figures |
| Ship encounters | Station escorts with negotiation, evasion or real-time combat with pause, reactor power and compartment targeting |
| Presentation | Cinematic location/briefing art, realistic tactical figures, responsive layouts and phone map enlargement |
| Persistence | Version-7 expedition journals; versions 1–6 supported; Classic Voyage kept separate |
| Finish | Research, prototype test, Return Drive construction, voluntary return and voyage summary |

This is a playable game under active development. Long faction arcs, a developed
crew relationship system, rank abilities, directional character animation and
full-run human balance validation remain ahead. Figures use one pose; layout
variations include reflected plans. No runtime AI API is required.

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

Latest gameplay validation, **11 October 2026**, at commit
[`babec95`](https://github.com/henders23/starship-explorer/commit/babec95d1438ff01400bc24e973e0a2311ae5fff):
**277 tests in 29 files, 28 browser scenarios, production build and desktop/phone
visual review passed.** This is a dated baseline, not exhaustive testing or final
balance. Vite still reports a JavaScript chunk-size advisory.

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
- Review changed screens on desktop and phone, with keyboard and reduced motion.
- Publish the reviewed, tested tree to `main` and verify deployment status.
- Record generated-art prompts and provenance in milestone notes. Keep text,
  controls and tactical information out of raster artwork.

Repository: [henders23/starship-explorer](https://github.com/henders23/starship-explorer).
The product name is **Starship Ithaca**; the repository remains `starship-explorer`.
