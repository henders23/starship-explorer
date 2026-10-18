# ISS Lodestar — character-led expedition

**Implemented UI increment: 19 October 2026**. This design note records what
is included, what is still pending, and why the interface is organised this way.

## Intent

The player should feel responsible for *people*, not merely research counters.
Portraits should identify a person who is speaking, not masquerade as arbitrary
decorative buttons. Keep one clear next action visible and leave in-depth rules
behind a voluntary choice. Avoid large, scrolling dialogue monologues.

## Shipped changes

- Retire the Classic Voyage entry point, including `/?classic`. The engine and
  separate historical saves remain available for provenance but are not played.
- Present the ship to the player as **ISS Lodestar**. Existing gameplay rules,
  encounter order, saves, research and tactical outcomes are unchanged.
- Reuse consistent original portraits for Captain Alexander Vale, Helen Morozova,
  Gabriel Cross, Lena Mori and Jonas Kerr.
- Provide a room-focused onboard view: bridge, science deck, engineering and
  shuttle bay. Each room shows a large original room image, a speaker and a
  meaningful route to an existing game action.
- Open the campaign with a concise captain's priority and visible route into
  starting Return Drive research; avoid a non-skippable cinematic.
- Ground site-story dialogue, Long Relay, survivor follow-up, research and
  escort contact in recurring crew commentary.
- Make the active tactical objective visible without another click.
- Keep location actions discoverable independently of the science officer portrait.

## Image dependency

The user provided a Lodestar start-screen image in the conversation. The
repository's start-screen art is intentionally still the previous asset
because the image was supplied as a chat visual without an accessible binary
file to upload via the GitHub connector. Do not claim the background has been
updated. Replace `public/assets/start-screen.png` with the supplied
source when the image is available as a normal file; verify 1366x768 and
1920x1080 crops, keeping title and controls left of the ship.

## Next quality pass

1. Capture real desktop screenshots of the title, initial current system, all
   ship rooms, site decisions, science details, long-relay scene and boarding.
2. Validate that the images and action buttons fit at 1366x768 without unwanted
   scrolling or text over faces. Do not introduce visual noise to fill space.
3. Check scene dialogue for character-specific voice and continuity. Never
   assign a random existing face to a named external station visitor.
4. Add portrait-backed *consequences* after one mission; e.g. a rescued surveyor
   recalled later by Cross or Morozova. Record only what the saved state supports.
5. Observe five uncoached players and log when they are uncertain what to do.
6. Keep version-10 save replay, deterministic rules and accessibility intact.

## Deliberate exclusions

No unvalidated generated portrait for the named survivor, Edda or Tarek. No new
morale meters, AI-generated dialogue, compulsory ship battles, new research
branches or expansion of the galaxy. Let the characters affect interpretation
and the player's choices before designing deeper simulation effects.
