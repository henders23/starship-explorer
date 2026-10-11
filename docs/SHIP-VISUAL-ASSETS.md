# Ship visual candidates and galactic atlas art — October 2026

Seven original generated assets have been incorporated in this repo, with **six transparent, top-down, orthographic ship designs** and a separate, text-free nebula panorama. These are candidates for the main vessel, encounters, salvage, and map marker art; they have no implied gameplay statistics.

| Asset | Intended reference |
| --- | --- |
| expedition-ithaca.webp | ivory long-range exploration flagship |
| expedition-ironclad.webp | gunmetal armoured destroyer |
| expedition-manta.webp | violet alien stealth corvette |
| expedition-helios.webp | asymmetric civilian salvage vessel |
| expedition-cathedral.webp | large naval carrier |
| expedition-ghost.webp | damaged alien derelict |
| ../galaxy/expedition-nebula.webp | panoramic dark blue / warm amber nebula map backdrop |

The ship images were generated in this conversation, composed with a flat transparent background and converted to 384-pixel WebP with alpha using a quality-preserving resize (WebP quality 82). The nebula artwork is a compressed 1080-pixel-wide WebP. Production originals remain in the generating session; the optimized variants are for in-game use.

**Asset constraints:** ships face 12 o'clock in true overhead projection and have transparent backgrounds. As standalone pictures they are not animated or rigged. High-resolution cinematic concepts should not be mistaken for working game screens or loaded into the tactical environment in lieu of playable geometry.

**Acceptance:** all assets should load without missing URLs, ship silhouettes should remain legible at 48–150 screen pixels, hero/encounter roles should remain visually distinct, and selection labels must not be baked into the nebula. Any use in gameplay must preserve existing state and navigation rules.
## Live encounter integration

The encounter's **contact** stage now shows a reconstructed overhead ship image drawn from this pack, matched to the ship's faction style. The image is an aesthetic representation, not a schematic: in battle, the original tactical silhouette remains in place because the four targetable compartment overlays have validated locations. No combat stats, collision data, fire outcomes or save records depend on these images.

Current contact art uses the Helios, Ironclad, Cathedral, Manta and Ghost images for different encountered classes. The Ithaca image is used as the player's ship marker in the interactive galactic atlas. The original class sprites remain available for targeting and other game screens. `src/ui/ship-contact-art.ts` is the single source of truth for the encounter artwork mapping; fallback to the ship class sprite ensures unknown classes still render.
