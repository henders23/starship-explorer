# Boarding operations — 10 October 2026

## What ships

Boarding now offers three authored operations plus the original core-recovery mission.
Each new operation has a different 12×10 layout, briefing dialogue, objective rules,
generated environment art, and a bonus beyond normal site cargo and science.

| Operation | Decision | Success bonus |
| --- | --- | --- |
| Rescue | Assign one surveyor per escort; bring them physically back to the shuttle. Another operative can take over if an escort falls. | 3 materials + 15 credits per evacuated civilian |
| Sabotage | Approach stationary guards, disable the uplink, escape pursuing guards and one reserve. | 8 materials + 20 credits |
| Salvage | Take one, two or three cases; weigh deeper cargo against rising heat. | 5 materials + 8 credits per case |

Salvage heat applies at the end of turn 4 onward beyond column 4: one health point,
rising to two from turn 7. The exit corridor stays safe; shields do not absorb heat.
There is no real-time clock. This threshold was moved earlier during playtesting
because the original threshold never affected a competent full-cargo run.

Partial rescue/salvage success is allowed. Successful extraction closes that site,
including its other mission contracts. Rewards apply exactly once on debrief.
Withdrawal without an objective pays nothing and leaves remote recovery or a retry
available. Crew injuries and permanent losses use the existing campaign rules.
Rescue extraction explicitly names civilians still outside. The ending remembers
completed contracts and the number of evacuated surveyors.

## Compatibility and validation

Save envelope version 6 adds `deploy-operation` journals; versions 1–5 remain
readable. Older envelopes reject new operation orders. The original `deploy`
action still creates exactly the original mission. Thirty old missions, across
three threat levels and 1,175 tactical actions, were compared state-for-state with
the implementation shipped in `9bd257e`; every state matched.

New tests cover physical escorts, handoff after incapacitation, inaccessible
interactions, one-time reinforcements, heat thresholds and defeat, partial salvage,
explicit civilian abandonment, retreat, replay at objective/extraction/debrief,
and duplicate-reward/site-reopening attempts. Legal-order pilots completed 36
introductory campaigns and 36 maximum-threat missions with all four crew returned.

Browser scenarios exercise actual contract selection, image loading, objective
interactions, save/reload, extraction confirmation, debrief acknowledgement and
reward persistence on desktop and phone. Visual review at 1440×900 and 390×844
covered briefings, tactical maps/trackers and debriefs. Fixes included an escort
stranded beside the shuttle, debriefs showing live danger instructions, and moving
art beside the contract selector. Map enlargement remains available on phones.

Validation commands:
- `npm run build`
- `npm test -- --maxWorkers=2`
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=... npx playwright test --workers=2`
- `node --import tsx tools/operation-walkthrough.ts 12`

Final result: 264 unit/property tests across 27 files, 21 browser scenarios and
the TypeScript/Vite production build passed. No browser page errors or horizontal
overflow appeared in the new desktop/mobile contract scenarios.

## Scope and next quality work

This supplies meaningful mission variety, not a final balance verdict. The
automated pilot is conservative; human playtesting should assess pressure,
comprehension and whether players actually choose partial extraction. Repeated
contracts reuse authored layouts and surveyor identities. Branching follow-up
stories, more layout variants and a tactical art pass are useful next increments.
Combat intentionally remains a clear vector map; the realistic art establishes
the mission environment. The production build still reports the existing
500 kB bundle-size advisory (about 590 kB raw / 186 kB gzip).

## Asset provenance

Generated with the imagegen skill on 10 October 2026. No external reference images.
Converted losslessly in composition to RGB WebP (quality 88, method 6), with no
creative post-processing. Sources remain in the generating session.

### mission-rescue.webp

Prompt:

Use case: stylized-concept. Production briefing art for a grounded cinematic science-fiction game, landscape 1536x1024. Inside a damaged orbital habitat medical bay, two conscious civilian surveyors in practical grey survival suits wait beside open emergency sleep capsules. One sits helping the other stand; an ivory-armoured rescue operative with a closed helmet extends a gloved hand in the foreground. Frosted glass, worn white panels, amber emergency strips, teal diagnostic lights, floating dust. Distant pressure door suggests a route to safety. Photorealistic film VFX, believable hands and anatomy, human vulnerability and hope, not horror. Wide composition, important characters in middle band for cinematic crop. No text, no logos, no UI, no gore. Muted navy, ivory and copper, practical lighting.

### mission-sabotage.webp

Prompt:

Use case: stylized-concept. Production briefing art for a grounded cinematic science-fiction game, landscape 1536x1024. A huge security uplink chamber inside an ancient industrial space installation. A tall copper-and-black antenna core rises behind an accessible waist-high control console. Two compact autonomous security robots with practical articulated legs and amber optics guard distant catwalks. One ivory-suited engineer in the lower-left foreground studies the console, tiny against the infrastructure. Navy shadows, restrained red warning lamps, teal traces in conduits, worn ceramics and metal, atmospheric dust, tangible believable machinery. Photorealistic premium film VFX, tension before a quiet sabotage, no explosions. Wide composition with core and foreground console centrally readable in a horizontal crop. No text, no logos, no interface, no fantasy magic.

### mission-salvage.webp

Prompt:

Use case: stylized-concept. Production mission briefing image for a grounded cinematic science-fiction game. Landscape 1536x1024, photorealistic premium film VFX. A damaged spacecraft cargo hall with three distinctive heavy sealed salvage cases spaced along a grated loading aisle receding into depth. Closest case amber metal, second ivory, third dark grey with small amber status light; plausible handles and latches, no readable labels. Two helmeted salvage operatives in weathered ivory suits near first case, one gestures toward the deeper cargo, deciding whether to continue. Far bulkhead glows orange from overheating conduits and drifting sparks, while foreground exit corridor is cool blue, visibly safer. Worn industrial materials, copper emergency lighting, navy shadows, atmospheric steam, danger without violence. Important elements in central horizontal band for a wide crop. No text, no logos, no UI, no giant explosion.


