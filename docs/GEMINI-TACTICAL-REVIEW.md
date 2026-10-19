# Tactical realism: selective adoption from Gemini's 3D prototype

Reviewed 20 October 2026 against the user-supplied HTML **AEGIS PROTOCOL: Rift Frontier — 3D Tactical Combat & 20-Archetype Codex** (1732 lines, approximately 95 KB).

## What the source really contains

- 20 proposed enemy descriptions in three factions: seven Helio-Syndicate, six Foundry Automata, seven Mycelial Rift-Kin. Includes HP, armour, movement, aim, damage and proposed abilities — these are **metadata**, not 20 separately functioning enemy AIs.
- Procedural Three.js meshes for gyrospheres, mortars, monowheels, kiln walkers and alien shapes.
- A skinned-human path with Mixamo-named bones, two-bone IK, palm orientation, rifle rear/forward grip anchors, attached armour, crouch and foot-to-ground correction.
- Standard physically-based materials, repeatable procedural deck textures, hemispheric and directional lighting, shadows, fog and bloom.
- The input HTML **ends inside the** `selectOperative` **function**, with no script closure, scene population or working render/game loop after that point. `baseSoldierGltf` is null in the supplied text; the referenced rigged GLTF asset and animations are not included, and therefore the skinned human path is not demonstrably functional. One weapon branch refers to `new THREE.CupGeometry`, which is not a standard Three geometry.

## Integrated in Lodestar

**Preserve the existing React tactical HUD, mission rules, interaction hit targets, save replay and low-overhead eight-direction sprite rig.** Do not insert Aegis's large heads-up display, neon skin, gameplay rules or unfinished WebGL game.

1. Use the *principle* of world-space weapon attachment: mount the existing visible weapons to the operator shoulder and rotate them with the eight-direction facing; project muzzle flashes and tracers from a forward gun origin. The prior weapon path remained static across all faces.
2. Use the *principle* of readable 3D silhouettes: distinct armoured shoulder/helmet, sensor antenna and forearm plates per existing enemy class, each with restrained material highlights, rather than one coloured base sprite. These do not change combat AI.
3. Use the material and lighting idea judiciously with SVG layered highlight passes instead of adding always-on WebGL overlays and bloom, which would reduce accessibility and mobile performance.
4. Test facing geometry and lethal/visual feedback without altering combat RNG. The finite-state animation system remains 8-direction/38-frame.

## Next: actual 3D rigging

The proper next graphics milestone is an opt-in **Three.js 3D tactical rendering prototype** on one mission: legally obtained human GLB/GLTF with rig and at least idle/walk/fire/hit clips, a modular weapon mesh, two-bone IK targets, and two procedural automaton rigs. Align these to the existing 12×10 tile simulation. The prototype's missing GLTF and untested IK cannot be accepted as production code. Profile on laptops and provide a fallback to the existing WebP figures before any renderer switch.

## Enemy behavior priorities

Prototype's most practical roster ideas: a fast gyro-scout, fortified sentry/tripod, armour-breaking breacher, and a medium-range relay jammer. Start by giving three types different **gameplay telegraphs and counterplay**, then introduce them into new missions via a versioned compatibility strategy: do not silently change results when replaying existing journal actions.

## Quality gates

- All eight facings rotate weapon direction and keep the muzzle near its bearer.
- Highlights and extra armour never cover action markers or eclipse target hitboxes.
- Combat saves and deterministic replay are unchanged; no new game RNG from rendering.
- Full laptop and mobile capture review, reduced-motion behavior, performance profiling, and human playtests are still required.
