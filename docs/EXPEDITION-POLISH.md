# Expedition polish — 10 October 2026

## Player-facing changes

- Open Expedition is the primary title-screen entry. The classic mystery voyage
  remains available with its own save. A first-step prompt starts Drive Diagnostics
  so new players can progress research while exploring.
- Three cinematic environment assets replace the generic planet illustration and
  give worlds, derelicts and ruins a readable visual identity. Location briefings
  use the main panel; the sidebar keeps recovery controls available. Phone users
  can move directly between the encounter and recovery controls with focus preserved.
- Ten authored encounter templates cover seven non-station location kinds. Two
  choices per encounter have explicit time/resource costs and persistent records.
  Selection is deterministic without touching world-generation RNG. Decisions are
  independent of cargo recovery, available after boarding or remote recovery, and
  pay only once per location. Repeated templates remain possible across a large galaxy.
- The Silent Courier's 143 letters form a complete side voyage: carry the messages,
  reach and contact a station outside the arrival system, relay them for 25 credits,
  and receive an acknowledgement. Alternatively, leave a replacement beacon for
  three materials. The archive, command rail and ending remember the decision.
- All 29 research projects now work. Alien Plasma Ballistics unlocks +2 damage
  weapons with two-round magazines. Personal Shield Emitters unlock 4 points of
  damage absorption instead of a medkit, without in-mission regeneration.
- Away Team provides per-operative weapon/gadget choices. Each advanced item costs
  two materials per deployment, charged only when a valid squad launches. Standard
  gear remains free. Choices persist across missions, but gear cannot change during
  an active mission. Shield damage, ammo and loadouts survive save/reload.

## Compatibility

Save envelope version 5 adds story actions, delivery status and loadout actions.
Versions 1–4 remain readable. Older envelopes reject newly introduced actions and
research that was unavailable in those versions. Existing accepted actions preserve
resource, time, RNG and combat semantics. Version-1 preview replay remains frozen.
Thirty baseline mission generations were compared directly against the shipped
`0350499` implementation; they matched exactly. Empty/standard loadouts do not add
new fields to old tactical units. New gear effects require explicit loadout orders.

## Adversarial and visual review

Validation: 249 unit/property tests across 26 files, 16 browser scenarios, and a
successful TypeScript/Vite production build. The changed browser scenarios were
rerun after the final visual fixes.

- Swept every encounter choice across 30 galaxies: resources, time, research work,
  fuel limits, repeat claims, mutation, invalid/remote/unseen/unaffordable choices.
- Delivery validation: wrong system, uncontacted station, duplicate commission,
  real connected travel, reload, older-envelope rejection and corrupt-save preservation.
- Equipment validation: research locks, invalid/dead crew, counterfeit gear, mid-mission
  swaps, cost by selected squad, insufficient supplies, repeated deployment, shield
  overflow, no regeneration, medkit replacement, active combat replay.
- Twelve equipped boarding runs completed with four survivors using legal tactical
  orders, in addition to existing baseline boarding and ship-escort coverage.
- Reviewed actual screenshots at 1440×900, 390×844 and 320×740, including title,
  main expedition, encounter, equipment and tactical battle. Found and fixed buried
  story choices, title clipping from CSS load order, a recovery-focus loop, equipment
  cost visibility and browser-default health-bar colours.
- Browser coverage includes old campaign entry, research/Return Drive/ending,
  boarding, escort contact/combat/retreat, story/relay delivery, equipment selection,
  reload, keyboard navigation and reduced-motion preference.

## Remaining quality work

This is a tested improvement, not a claim of final balance or finished content.
Boarding still has two layouts and one core-recovery objective. Crew service XP is
recorded but does not yet grant rank bonuses. Ship art and map units need further
visual work; faction arcs and long-run external playtesting remain priorities.
The JS bundle still has Vite's advisory 500 kB chunk warning. Generated location
art is archetypal, not a unique render of every procedural planet or vessel.

## Art provenance

Generated with the built-in imagegen tool, then encoded as WebP at quality 88 for
shipping, without compositional edits. Originals were 1536×1024. Each asset was
visually inspected before use. No text or gameplay controls are baked into images.

### `public/assets/exploration/orbital-frontier.webp`

Final prompt:

> Create a finished production background image for a serious science-fiction exploration game, landscape 1536x1024. Photorealistic cinematic orbital view: a immense blue-green alien planet fills the right two thirds, thin turquoise atmosphere, intricate cloud systems, copper desert continents and dark ocean, softly sunlit from upper right. A small, believable, weathered modular scientific spacecraft, long narrow profile with habitation modules and antennae, drifts near the lower right edge, dwarfed by the planet. Tiny pinprick stars, black negative space on the left third for live UI text. Restrained teal, warm ivory and copper palette; physically plausible light, subtle grain, tangible materials. Awe, loneliness, curiosity. Premium grounded film VFX, exceptionally crisp atmospheric detail; no text, no logos, no UI, no borders, no neon, no lens flare, no people. Image must work as a wide cropped hero background, keep important objects in middle horizontal band.

### `public/assets/exploration/silent-courier.webp`

Final prompt:

> Production environment still for a grounded science fiction exploration game. Photorealistic cinematic landscape 1536x1024: inside a long abandoned interstellar courier vessel, viewed down a spacious utilitarian pressure corridor into a circular navigation compartment. Weathered ivory ceramic panels, exposed dark metal ribs, suspended fine ice particles, subtle frost, small amber emergency lamps. At the far end a single small cylindrical power cell emits a restrained pale turquoise glow above a circular console, keeping one beacon alive. Through a small side porthole: black space and a crescent planet. Beautifully believable industrial design, tactile materials, film-quality environmental storytelling. Quiet, haunting, hopeful, not horror. No people, no bodies, no creatures, no weapons, no text, no logos, no interface. Clear central composition, luminous focal point in upper-middle, deep navy shadows, copper and teal accents, details readable in a small landscape card crop.

### `public/assets/exploration/buried-observatory.webp`

Final prompt:

> Photorealistic cinematic environment concept art for grounded science-fiction exploration game, landscape 1536x1024. A vast ancient alien installation half-buried in rust-red desert dunes, precise dark basalt concentric arches protruding from sand, delicate carved channels, a narrow entrance below the arches glowing faintly warm amber from deep underground. Two tiny helmeted scientific explorers in practical ivory pressure suits at lower left establish enormous scale, carrying instruments not weapons. Far horizon hazy mesas, pale blue twilight sky, a tiny distant moon, fine windblown sand, strong soft directional light, exquisite real stone erosion and sand texture. Palette muted copper, ink blue, warm ivory. Quiet archaeological wonder, enigmatic but plausible, premium realistic film VFX. No fantasy magic, no neon, no text, no logos, no interface, no borders. Major architecture centered, horizontal crop safe, composition readable as a wide game location card.
