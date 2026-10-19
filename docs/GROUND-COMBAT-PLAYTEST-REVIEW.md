# Ground-combat expert playtest review and implementation ledger

19 October 2026. **Evidence level:** source inspection, existing *actual gameplay screenshots* at [docs/qa/recorder-mid-mission-desktop.png](qa/recorder-mid-mission-desktop.png), deterministic campaign/squad simulations and GitHub browser tests. **Not** an observed independent human playtest; the scorecard below is a heuristic judgment, not a user satisfaction survey.

## Actual player journey

1. Choose a mission contract and four named operatives in the shuttle bay.
2. Choose weapons and gadgets; deploy to a 12 × 10 isometric tactical map.
3. See the objective, move behind cover, choose enemies and fire with percentages and AP costs.
4. Guard reinforcements and special mission pressure (heat, escorts, recorder) complicate the route.
5. Return all surviving people to the shuttle, extract, and see the consequences in the campaign.

## Observed strengths

- Rules and movement are deterministic, saving/replaying actions without visual effects altering combat.
- Route/exposure preview, aim, overwatch, partial cover and injury/extraction stakes produce genuine tactics.
- Three mission contracts (rescue, sabotage, salvage) plus core and recorder recovery prevent a single mandatory kill-all structure.
- Existing positional depth sorting, cutaway geometry and animated directional rigs already support the camera style.

## Expert heuristic weaknesses (before this pass)

| Area | Priority | Test |
| --- | --- | --- |
| Operative identity | Critical | Can a player name and recognise the same four soldiers across deployment, field and debrief without rereading labels? |
| Audio feedback | High | Can the player hear distinct rifle, heavy, plasma, hits, shields, reloads and enemy actions with sound enabled? |
| Weapon visibility | High | Is the rifle readable on figures *and* in the squad panel at typical laptop resolution? |
| Level variety | High | Do layouts differ in approach and cover, not just in tint or place names? |
| Enemy diversity | Critical | Do hostiles force different decisions instead of merely displaying different colours? |
| Readability | High | Can the objective, squad, AP, enemies and extraction all be found within 5 seconds? |
| Emotional consequence | High | Do a badly wounded, downed or lost operative generate a distinct debrief or future crew response? |
| Strategic tension | High | Is extra salvage worth a further exposed turn, and is extraction always a viable answer? |

## This playable polish pass

- Six distinct existing human portrait assets displayed across squad cards and equipment briefing instead of animation-sheet crops. A separate pack of six new AI-generated portrait crops was produced for later artist review.
- Visible SVG weapon attachments in the combat space and named equipped weapon in the sidebar.
- Web Audio layered SFX for rifle/plasma/heavy shots, movement, reload, shield and health impacts, selection, healing, alarms and turn change. Honour the global mute; no external sound download or new game-state fields.
- Rescued, sabotaged, salvaged and archival decks receive separate light/floor/ambient readouts.
- Six extra authored variations bring the **three main operation categories from nine to fifteen deterministic layout configurations**. Existing variants 1–3 and saved journal instructions are unchanged.
- Extra unit and browser assertions, replay checks and automated mission sweeps.

## Adversarial QA

New layouts must pass pathing from shuttle to every objective, no spawn inside a wall, no duplicate initial positions, deterministic recreation, valid replay and a complete legal scripted expedition. Testing already detected wall/guard conflicts and a rescue route that stalled the scripted pilot. These were fixed before merge, not accepted as cosmetic issues.

## Remaining bar for an AMAZING experience — ordered

1. **Add genuinely differentiated enemy behaviours:** flanking scout, suppressor, armoured shield bearer, drone spotter, engineer jammer, melee interceptor. Make their intention visually clear one turn ahead.
2. **Commission real recorded/processed game audio:** positional shots, reverb by room, metallic damage, distinctive weapon tails, restrained machinery ambience; mix and loudness controls.
3. **Build high-resolution portrait / enemy / weapon asset atlas:** one identifiable face for each operative, four directional hero rigs per class, varied robot silhouettes, consistent scale and lighting. The new AI-generated portrait crop pack is an early prototype, not final AAA art.
4. **Upgrade the renderer** from static SVG textures to a richer hybrid 2.5D/3D pipeline (or tightly drawn perspective-consistent 2D), with physically believable shadows, impact particles and contextual cover destruction; do not obscure the tile logic.
5. **Meaningful tactical progression:** at least one distinctive earned ability per class, plus threat-based enemy introductions.
6. **Scenario pacing and variety:** a carefully authored tutorial boarding mission, one rare environmental surprise and a short mission debarkation reaction tied to injuries/survivors.
7. **Real uncoached player tests:** five new-player sessions and three tactics-game veterans, with measures for first valid turn, objective understanding, wrong-order attempts, elapsed mission time, extraction success and repeat-session motivation.

Do not certify quality as 'amazing' until actual human testers and visual/audio reviews support it. Automated tests prove correctness, not atmosphere, delight or sound fidelity.
