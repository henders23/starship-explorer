# Cinematic boarding combat — implemented increment

The tactical screen is generated from the **actual campaign and saved mission state**, not the cinematic design mockup. Real browser captures, including a real shot and walking frames, are produced by `e2e/tactical-capture.spec.ts` and `e2e/tactical-motion.spec.ts` and uploaded by CI as `live-tactical-screenshots`.

## Shipped behaviour in this increment

- Crew and custodians interpolate between their recorded positions using the tactical engine's route finder. The displayed figure follows each tile in sequence instead of teleporting or sliding directly through cover.
- The original photorealistic single-pose sprite is divided *in the renderer only* into torso and left/right leg regions, which move out of phase. The sprite flips with the projected direction of travel. This is a lightweight walking approximation rather than a new multi-angle rig or motion-captured locomotion.
- Fire orders trigger a small recoil and muzzle flash; shots retain the authoritative hit/miss and damage cues from the engine. The animation does not invent damage.
- The deck gains steel and grating variation, mechanical details, emergency lamps, wear and focused ambient lighting. Selectable tiles, cover and visible hostiles remain readable.
- A quick-action strip permits Move, Fire, Overwatch, self-medication and End Turn, all gated by existing action validators. Original detailed controls remain available.
- Reduced-motion preference disables route interpolation and repeating secondary animation, without changing action timing or the mission state.
- No tactical engine, save-schema or random-seed rules have been changed; visuals are derived from canonical state.

## Quality checks and open limitations

These visuals are materially better than the earlier vector-only combat view, but **not yet at the level of the rendered target concept**. There are still one-pose soldier bitmaps and procedural rather than fully authored 3D-style deck modules. The renderer remains SVG, not a textured 3D/2.5D environment. Human playtesting is still needed for movement naturalness, ease of understanding combat, and lighting on less capable devices.

Future fidelity milestones:
1. Real 8-direction, multi-frame walk / run / crouch / fire / hit / fall sprites, authored from consistent character rigs. Avoid mirroring asymmetrical weapons and insignia.
2. Photorealistic modular deck atlas with consistent iso projection, physical cover alignment, damage and lighting variants; keep collision and cover geometry driven by mission state.
3. Better screen-space composition: camera tracking, cover silhouettes and occlusion, squad HUD closer to the reference, objective lighting that does not reveal unseen enemies.
4. Distinct enemy varieties and combat animation cues tied to the actual battle log. Profile particles and shaders before applying them on mobile.
5. Visual regression captures on all 9 contracts/layouts at 1440, 390 and 320 px; replay parity and long-session performance tests.

The generated high-fidelity mockup is **art direction only**. It is never passed off as a running-game screenshot.
