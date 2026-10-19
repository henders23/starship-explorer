# ISS Lodestar — Opening Briefing and Event Dossiers

Implementation brief, 19 October 2026. Player experience goals: orientation before action; reports illustrate *situations*, not a generic system backdrop; repeatable crew voices; minimal obstruction of navigation.

## 1. New game onboarding

**Entry:** Begin expedition creates the seeded campaign but opens `OpeningBriefing` before mounting the deck. Resuming a saved voyage bypasses this sequence. The briefing is 3 skippable, keyboard-accessible cards and has a Return to title control. No actions advance a campaign day until the player takes command.

1. **Unknown stars (Mori):** experimental transit aperture, no matching charts, long-range communications silent.
2. **Ship status (Kerr):** vessel survived, no return transit available; resources and research are needed.
3. **Captain's orders (Vale):** start Drive Diagnostics, survey, investigate the Silent Courier.

Each beat uses an **existing illustrated ship room**, a **consistent portrait**, a single paragraph, and a button. No revived deduction rules, no mystery puzzle and no compulsory cinematic.

## 2. Event dossier contract

A dossier is tied to a unique **story ID**, not a system ID or procedural location kind. Source: `src/ui/report-art.tsx`. It includes an accessible alt description, an event-specific illustration, and a concise caption. `ExplorationStory` renders the art alongside the report text and decisions; `Discoveries` repeats the same artwork in the captain's record so consequences are remembered.

Situational first pack: tethered mining tug, damaged habitat capsule, ship greenhouse, navigator's route chart, ancient rain reservoir, tidal lights, alien settlement, temporal probe, silent courier, night orchestra. The independent ship-contact tactical art and full-bleed system artwork are retained. Report art **must not** replace the full system background. Additional side-mission briefs use matching report assets.

Artwork is first-pass in-repo vector illustrations suitable for the smaller dossier viewport; higher-fidelity scene art can replace any SVG without changing the UI's contract.

## 3. Readability criteria

- One dominant heading and no more than one paragraph of context per intro beat.
- Event image is distinct from crew portrait. Action buttons always remain identifiable.
- Art never overlays important buttons or faces. Responsive at 390 px and laptop 1366 px.
- Report choice costs and effects remain unchanged. Crew dialogue is deterministic and narrative only.
- All events and recovery screens remain playable with image-loading failures.

## 4. Tests and roll-out

Unit checks: story-to-image mappings and fallback. Browser tests: new start shows briefing, skip works, resume skips, mining tug appears only on story report (not system background), first decision retains its action controls. Run `npm run build`, `npm test`, `npx playwright test` in CI before merge.

## 5. Further experience improvements, ranked

1. Crew-specific post-mission dialogue acknowledging injuries and losses from saved state.
2. Character portrait cards for named survivors after onboarding — no recycled face for an unrelated stranger.
3. Two or three consequential decision callbacks in subsequent missions.
4. Report briefings that foreground known risks and hide advanced mechanics behind disclosure.
5. More distinctive authored events replacing generic procedural text.
6. Medbay with visual recovery changes, ship wear and repair feedback.
7. Short post-action summaries and genuinely meaningful reward reveals.
8. First-session uncoached usability review and visual QA at 1366×768.
