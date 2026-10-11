# Tactical readability — 11 October 2026

## Player-facing changes

- Selecting a destination previews its AP cost, remaining AP, directional cover
  and the firing chances of guards that are currently visible. A route line links
  the operative to the selected tile. Invalid routes stay uncommittable. Cancel
  move dismisses the preview without spending an action or changing the save.
- The preview explicitly excludes unseen threats and warns that guards can move.
  It is a current-position exposure check, not a prediction of the whole enemy
  turn. A newly revealed guard is not disclosed before the player moves.
- Salvage previews show exact end-turn heat at that destination, including the
  turn-4/turn-7 thresholds and the fact that shields do not protect against heat.
- Target selection draws a sight line and reticle. An obstructed or out-of-range
  target says “No clear shot” instead of presenting a misleading hit percentage.
- A last-order summary reports movement/AP, hits and misses, separate health and
  shield changes, incapacitations, objective progress and enemy-turn shot counts.
  Reloading does not replay this transient feedback or flash an old shot.
- Floor geometry, raised scenery, objectives and figures now have separate render
  layers. Raised objects and figures draw back to front, so a nearer bulkhead can
  obscure a figure’s legs. Health, AP and squad marks remain above scenery and do
  not intercept clicks. Civilian beacon numbers stay fixed after one is evacuated.
- Mobile target selection respects reduced-motion use by jumping without smooth
  scrolling. Existing map/orders navigation and map enlargement are retained.

## Compatibility and verification

This increment changes presentation only. The campaign/tactical engine and save
loader are untouched; version 7 and earlier journals retain their existing rules.

Adversarial tests cover hidden guards, newly revealed guards, cover direction,
occupied/blocked/unexplored/invalid tiles, insufficient AP, sprint cost, exact heat
thresholds, actual shield-versus-health losses, misses, incapacitation, stable
depth ordering and hidden scenery. Preview and scene helpers do not mutate the
mission or consume combat RNG.

Browser checks exercise preview/cancel/commit, unchanged save journals while
previewing, sprint updates, targeting, shooting, enemy turns, reload suppression,
actual heat damage against the displayed warning and depth ordering. Actual
desktop and phone screenshots were reviewed for route, damage and map readability.

Final validation: 277 tests across 29 test files and 28 browser scenarios passed.
The TypeScript/Vite production build passed, and `git diff --check` was clean.

## Limits

The preview does not simulate enemy movement or unknown enemies, and says so.
Status marks deliberately remain visible through nearby scenery. Figures still
use one standing pose; this pass improves their placement and feedback rather
than adding animation. The existing production bundle-size advisory remains.
