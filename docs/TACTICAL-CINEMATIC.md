# Cinematic boarding — current implementation

The tactical screen renders actual campaign state. It is not the generated
cinematic mockup. On 12 October 2026, eight-direction rig-rendered sprites
replaced the earlier clipped-torso/leg approximation. Five crew roles and two
custodian appearances now have walk, sprint, aim, fire, hit, fall, interact,
cover and reload poses. Ten rendered deck assets align with engine geometry.

The renderer remains a lightweight SVG/CSS scene using pre-rendered WebP, with
no runtime WebGL requirement. Action points, hit rolls and saves are independent
of animation. Reduced motion preserves immediate control and state clarity.

[Current implementation, evidence, reproduction and limitations](ANIMATED-BOARDING-AND-SURVIVORS.md).

The figures remain stylised. The photorealistic concept, artist-quality
architecture and human-playtested movement naturalness are still targets;
passing tests is not evidence that those artistic targets have been reached.
