# Starship Lodestar — current roadmap

**11 October 2026 · Open Expedition · development branch of record: main**

[Design](DESIGN.md) defines the experience; [specification](SPECIFICATION.md)
defines contracts. This roadmap supersedes the old Classic Voyage R-series priorities.
Dates below mark evidence, not deadlines.

## Delivered baseline

- Persistent seeded expedition, scans, discoveries, station economy and recovery.
- All 29 research projects, queue, construction/fitting, prototype and Return Drive.
- Ten authored encounters, Courier letters, equipment and optional ship escorts.
- Core recovery, rescue, sabotage and salvage; nine newer operation configurations.
- Realistic tactical figures, environmental art, mobile navigation, depth sorting,
  AP/exposure/heat previews and actual combat-result feedback.
- Version-7 journals with earlier expedition support.

Latest gameplay evidence: `babec95`, 11 October 2026 — 277 tests, 28 browser
scenarios, build and desktop/phone visual review passed. This establishes a
working baseline, not completed content or validated player retention.

## Ordered milestones

| Order | Milestone | Why now | Completion gate |
| --- | --- | --- | --- |
| 1 | **The Long Relay** | Turn an isolated choice into an anticipated consequence | Three connected beats, two approaches, remembered response, replay/compatibility and comprehension checks; [brief](NEXT.md) |
| 2 | **People who grow** | Make a returning crew feel distinct | Small role-progression choices and one rescue follow-up; replacements stay viable; casualty-aware identity records |
| 3 | **A region worth revisiting** | Give geography narrative meaning | One faction-linked arc, recurring contact, noncombat route and explicit local consequences; no global politics simulation |
| 4 | **Combat with new decisions** | Add variety beyond layouts and statistics | One distinct enemy behaviour and role/environment interaction; no dominant loadout; withdrawal still meaningful |
| 5 | **Motion, sound and visual consistency** | Make existing actions feel physical | Consistent directional poses, brief impact/movement feedback, restrained audio, reduced-motion/mute parity and actual-device review |
| 6 | **Full-voyage balance and release** | Establish sustained interest and resilience | Uncoached full runs, viable noncombat/partial-success routes, recovery from losses, accessibility/performance/save review |

Each milestone is a playable increment. Avoid building broad generic frameworks
before their first authored use case. Milestones 2–5 can be adjusted based on
observed play; their scope is proposed. Critical correctness/accessibility defects
interrupt this order whenever discovered.

## Cross-cutting release work

- **Long journals:** consecutive live battle seconds now share one journal entry,
  replay is linear (50,000 actions load in well under a second) and the explicit
  limit is 50,000 actions, about 3.5 MB. Saving past it reports an autosave
  failure instead of writing an unloadable save. Browser storage quota remains the
  practical ceiling; checkpoints or export are the next step if real runs near it.
- **Performance:** profile initial load, React/SVG work, save replay and combat;
  address the current bundle advisory using evidence. Do not add expensive effects
  without a measured budget and reduced-motion fallback.
- **Saves:** retain old journal compatibility. Consider
  export/import after replay safety, without making cloud accounts necessary.
- **Access:** keyboard, focus, contrast, non-colour cues, screen-reader flows,
  narrow-screen controls and touch targets need a dedicated audit.
- **Content:** track repeated templates, revisit payoffs, character continuity and
  the time spent doing station work instead of exploring.
- **Release evidence:** record test counts/commit/date, known limitations and actual
  deployment status separately. Update README and design status with each milestone.

## Risks and decisions

| Risk | Response |
| --- | --- |
| Systems expand while interest remains flat | Build one connected arc and observe players before adding scale |
| Story changes rewrite earlier saves | Explicit opt-in orders, versioned content and prior-journal comparisons |
| Repeatable work dominates exploration | Measure full runs; preserve recovery while improving exploration value |
| Casualties erase progression | Keep viable recruits and optional combat; avoid irreplaceable science bearers |
| Realistic art reduces tactical clarity | Review at shipping size; preserve silhouettes and vector information |
| Ninety systems amplify repetition | Improve curated arcs and region pacing before adding locations |
| Automation is mistaken for fun validation | Keep functional tests and human-interest evidence separate |

Deferred: larger squads/maps, elevation, grenades, fighter bays, colonies,
multiplayer, global faction simulation and a mandatory final battle. Reconsider
only when a specific tested experience needs them.
