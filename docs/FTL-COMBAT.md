# Ship combat (battle rules 2)

October 2026. Ship-to-ship combat follows FTL: real time with pause, rooms as
targets, a reactor that never has enough power, and a crew who keep the ship
fighting. This page records the rules and the reasons behind them.

## Versioning

Saves are action journals replayed on load, so rules never change under an
existing journal. The battle rules ride on the orders that start a fight:

- `escort` with `rules: 2`. Without it, the escort replays under rules 1, the
  frozen instant-resolution rules of earlier builds.
- `travel` with `hazards: 1` can end in an interception. Without it, a jump
  replays as before.

Save version 11 rejects either field in an older envelope. `KNOWN_BATTLE_RULES`
lists every accepted version, so a future rules 3 cannot strand rules-2 journals.
Rules-1 equivalence was fuzzed over 4000 battles against the previous reducer.

## Rules 2

| Element | Rule |
| --- | --- |
| Clock | Whole simulated seconds. The screen interpolates between them; pause holds the fraction. |
| Projectiles | Lasers and ion bolts fly 1 s, missiles 2 s, beams are instant. Evasion is rolled on arrival. |
| Events | Each second reports launch, impact, fire, extinguish, repair and crew events with ever-increasing ids. The UI turns them into sound and light once. |
| Opening | Hostile guns start half charged. Our weapons open aimed at their shields. A failed evasion leaves their guns 75% charged. |
| Targeting tell | A hostile gun locks a compartment at 60% charge (`AIM_AT`). Gunners favour their hull plan's doctrine compartment three to one (`PREFERRED_TARGET`). |
| Damage | Hostile damage is stated on the old 100-hull scale and lands scaled by kind (`INCOMING_DAMAGE`: laser 1, missile ½, beam ⅔). |
| Fires | Hull hits may start a fire (laser 10%, beam 25%, missile 35%). A fire costs its compartment a point, and wounds the crew in it, every 5 s for 10 s. The enemy fights its own fires. |
| Crew | Four officers man rooms. The helm needs one for evasion. Crewed engines add 5 evasion, weapons charge 10% faster, and shields recharge faster. Officers fight fires (4 s), then repair a point per 10 officer-seconds (Kerr ×1.5). Moves take 2 s. Hits and fires wound; a downed officer is in the medical bay for 20 s. |
| Interceptions | 14/24/34% on arrival in threat 1/2/3 regions, never in the Shallows or at the start, 8 points lower with countermeasures, and never against a hull below 25. Faction patrols in claimed space, raiders elsewhere; tier 2 at the rift margin and in late-voyage threat-2 space. Victory salvages 10 materials, 22 credits and 1 fuel. |

## Balance

Measured with a policy simulation over 40–100 seeds per class (passive: engage
and press nothing; competent: missiles on auto, engines up):

- Low-threat escorts (Rust Queen, Magpie): passive loses 13–22 hull, competent 7–11.
- Threat-2 escorts (Carrion Jack): passive loses about 49, competent about 18.
- Rift-margin Reavers usually beat passive play; competent play wins at a cost.

## Presentation and sound

`src/ui/ExplorationBattle.tsx` draws projectiles in an SVG layer measured from the
live room geometry, with bursts, shield ripples where the shot meets the shield
ellipse, smoke, floating labels, hull shake and an ending sequence before the
report. `src/ui/combat-sfx.ts` synthesises every sound with WebAudio. Its weapon
voices descend from the original FTL-style prototype (the Classic
`BattleScreen`), extended with hull hits, misses, fires, extinguishers, repairs,
weapon-ready chimes, a hull-critical klaxon, the kill, the jump and stings. The
mute switch silences even scheduled sounds.
