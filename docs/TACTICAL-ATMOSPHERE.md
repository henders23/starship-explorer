# Tactical atmosphere and deck variety — 11 October 2026

## Player-facing changes

- Crew, custodians and civilian beacons now use three realistic transparent figures.
  Ivory armour, orange machinery and lilac civilian clothing separate their roles.
  Health bars, action points, selection rings and squad numbers remain vector marks.
- Boarding decks have layered metal panels, grating, inset lights, lit bulkheads,
  a visible platform edge and distinct mission palettes. Salvage marks the heat
  boundary on the map as well as describing it in the objective.
- Each operation now has three configurations: its original plan, a reflected
  configuration and a newly authored plan with different target placement.
  Rescue's survey habitat separates the civilians into far corners; salvage's
  maintenance stores puts deeper cargo beyond the bays.
- A site's layout and survivor identities stay fixed on retry. Survivor names
  vary between sites, using a separate deterministic stream from combat RNG.
- The briefing identifies the deck and its approach. Next ready operative skips
  downed or exhausted crew. Phone users can move directly between map and orders;
  focus follows the jump. Map enlargement and panning remain available.

## Save compatibility

Version 7 journals explicitly record the new optional deck variant on deployment.
Existing version-6 operation orders omit this field and continue to create the
exact original mission, including the original survivor names. Versions 1–6 still
load; pre-7 envelopes reject variant-bearing orders. Original core missions are
unchanged. A direct comparison with `c8a11a5` replayed 36 old operations through
1,777 tactical actions with identical mission state after every action.

## Adversarial checks

- All nine configurations have reachable objectives, floor-only spawn positions,
  unique unit positions and stable generation. Invalid variant values are rejected.
- 72 legal-order runs across all three kinds, three configurations and threat
  levels 0–2 completed their objectives. 71 returned all four crew; one greedy
  full-cargo salvage run lost one operative after exhausting its medkits.
- That casualty exposed a flaw in the fixture pilot: it waited indefinitely for
  a downed operative it could no longer revive. It now explicitly extracts with
  losses when all living crew are aboard and no medkit remains. The game already
  supported this decision; no casualty was silently removed or revived.
- New journals replay at the first objective, extraction, report and acknowledged
  debrief. Older envelopes reject new fields; unchanged old journals still load.
- Browser checks cover sprite decoding, direct figure selection, cycling crew,
  focus-aware map/orders navigation, map enlargement, reload and width containment
  at 1440, 390 and 320 pixels, including reduced-motion preference.

The final suite passed 269 unit/property tests across 28 files and 24 browser
scenarios. The production build passed; its existing bundle-size advisory remains
(about 595 kB raw / 188 kB gzip). Visual review also caught focus styling bleeding
onto health bars and AP dots after mouse clicks; focus indicators now appear only
for keyboard navigation and are confined to the figure hitbox.

## Art provenance and files

Generated with the built-in imagegen tool using the imagegen skill, without
reference inputs. Source alpha is preserved. Images are downsampled to 512×512 and
encoded as WebP at quality 90, method 6. No creative post-processing.

- `public/assets/exploration/tactical-operative.webp`
- `public/assets/exploration/tactical-custodian.webp`
- `public/assets/exploration/tactical-survivor.webp`

The renderer is a hybrid of raster figures and vector deck geometry. These are
single-pose tactical figures, not animated character rigs. Further work should
include directional poses, clearer depth occlusion and human playtesting of the
hardest salvage route. Reflected layouts are variations, not entirely new rooms.

### operative prompt

Use case: stylized-concept. Asset type: single transparent-background isometric tactical game sprite, realistic 3D render for a spaceship boarding game. Subject: ONE full-body human expedition operative in ivory EVA combat armour, charcoal flexible joints, small teal illuminated helmet visor and shoulder strips, compact backpack, two boots clearly apart, holding one compact dark rifle in both hands at a low ready angle to lower right. Camera orthographic isometric three-quarter view, looking down at 30 degrees, subject faces lower-right of image, visible helmet top and shoulders. Strong legible silhouette, realistic proportions, premium hard-surface materials, restrained wear, clean ivory versus dark contrast suitable at 48 pixels tall. Upper-left soft light with subtle cool rim light. Entire figure centred, feet near bottom with 8 percent transparent margin, no ground plane or floor, no pedestal, NO cast shadow outside figure, no scenery, no text, no icons, no multiple poses, no extra limbs. Genuinely transparent alpha background. Square canvas.

### custodian prompt

Use case: stylized-concept. Asset type: single transparent-background isometric tactical game sprite, realistic 3D render for spaceship boarding. Subject: ONE full-body hostile autonomous security custodian robot, broad copper-orange armoured shoulder chassis, compact rectangular mechanical head with horizontal amber optic, dark steel joints, two sturdy articulated legs with separate feet, one integrated short arm cannon pointed lower-left. No human anatomy under armour. Camera orthographic isometric three-quarter looking down 30 degrees, robot faces lower-left. Strong readable silhouette at 48 pixels tall, realistic metal materials, restrained edge wear, copper-orange and gunmetal high contrast with small amber lights. Soft upper-left key light. Entire figure centred, feet near bottom with 8 percent transparent margin. No ground, no floor, no base or pedestal, NO cast shadow outside figure, no scenery, no text, no multiple poses, no extra limbs. Genuinely transparent alpha background. Square canvas.

### survivor prompt

Use case: stylized-concept. Asset type: ONE transparent-background isometric tactical game sprite, realistic 3D render for a science-fiction rescue game. Subject: one unarmed adult civilian surveyor wearing a dusty lilac-purple pressure suit with charcoal knee patches, small rectangular chest life-support unit and low-profile backpack. No armour, no weapon, no helmet. Short dark hair, medium brown skin. Full body, two feet visible, slightly tired but upright stance, hands relaxed by sides. Orthographic isometric camera looking down 30 degrees, person faces lower-left. Clear silhouette at 48 pixels tall, realistic human proportions and fabric materials, purple suit stays visually distinct from ivory armed crew and orange robots. Soft upper-left lighting. Full body centred, 8 percent transparent margin above and below. No floor, scenery, ground shadow, pedestal, base, text or other figures. Genuinely transparent alpha background, square canvas.


