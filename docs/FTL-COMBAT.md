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

Save version 15 rejects either field in an older envelope. Versions 11 to 14 only
ever existed in pre-release builds whose rules were still moving; such saves are
kept unchanged and reported as unreplayable. `KNOWN_BATTLE_RULES`
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
| Reactor | Seven power (rules 1 kept eight): shields, engines and weapons cannot all be maxed. Yards add a point each, up to ten; the tenth needs Layered Shields, since nine already fills every other system. |
| Enemy crew | Three hands (four on tier-2 hulls), four hit points each, posted at their helm, weapons and shields (and engines). They fight fires and repair at our crew's rates, running to unattended damage: weapons first, then shields, helm and engines. An unmanned helm cannot evade. Hits and fires in a room kill or wound the crew in it, and killing every one ends the battle with the holds intact (spoils half again). Killing whoever flies stops a retreat. Their crew stay out of any room our guns struck in the last 3 seconds. Measured over 260 interceptions: ordinary fire takes the crew in about one win in seven; hunting the helm makes it the usual ending, at about 18 more hull. |
| Interceptions | 8/18/28/38% on arrival in threat 0/1/2/3 regions (the Shallows only from day 4), never at the start, 8 points lower with countermeasures, and never against a hull of 10 or less. Faction patrols in claimed space, raiders elsewhere; tier 2 at the rift margin and in late-voyage threat-2 space. Breaking the lock burns 2 fuel per attempt. Victory salvages 10 materials, 22 credits and 1 fuel (half again from tier-2 hulls, a quarter again for a crew kill) plus one seeded find from the wreck. An emergency jump mid-battle needs 20 escape work (about 13 seconds at full engines) and burns the same 2 fuel. |
| Rift front | A new voyage's first order (`begin`) starts its clock on day 0; journals without one start it at the first hazard-aware jump. After 10 days it swallows one jump-ring from the arrival system every 4 days, stopping two rings short of the galaxy's rim. Rift-touched arrivals: 55% interception, heavy tier only. Stations there evacuate (no services, armoury, recruits or escorts). Each day spent inside it tears 3 hull, never below 1 (on hardcore it can finish the ship); a jump pays its arrival day's toll before any interception opens fire. Inside the rift even a wreck is hunted. Field repairs (6 materials, 2 days, +12 hull) work anywhere, so a ship is never stranded without a way to mend. |
| Contracts | Full pay (8 materials, 18 credits) until the rift runs; then each contract at a station pays less than the last: 8/18, 6/12, 4/6, then 2/4. |
| Hostile retreat | In interceptions, a hostile at 30% hull or less spins up its FTL drive: a sixth of its working engine rooms per second while the helm is manned, gone at 10 (twenty seconds at full engines). Their first free hand runs for the helm and stays. Breaking engines or emptying the helm keeps them; an escape leaves no salvage. |
| Tolls | Escorts: 15 credits (8 with translation). Interceptions: 10 + 2 × their hull (×0.6 with translation): 42 for a Rust Queen, 58 for a Reaver. |
| The way home | Activating the Return Drive (`return-home` with `finale: 1`) draws the Ashen Sovereign: 1.5× hull (51), eight crew of six hit points, no hail, toll, evasion or declining. Its retreat is the Return Drive: 60 escape work, 40 seconds at full engines, and once it spins up their gunners hunt our engines. Destroying, emptying or outlasting it ends the voyage at home. Disabled: three days adrift while the crew patch the hull to at least 30, and the drive can be tried again; on hardcore the voyage is lost. Pausing the Return Drive keeps its progress. Simulated: an early build must run (about 85% make it home); a late build can fight and win nine times in ten. Journals without `finale` still go straight home. |
| Opening loadout | Guns open on their shields, or on their weapons when they carry none. Yard power goes to the weapons system, then engines; bought guns that power allows start on automatic (missiles stay off). |
| Signals | 45% of first arrivals raise one of 18 arrival signals; none repeats until all have been met. Every signal has a walk-away choice, risky choices show their odds, and outcomes show resource chips. An intercepted arrival's signal waits for the debrief. Four kind answers leave an echo: 35% of later quiet arrivals bring the grateful party back with a gift. |
| Armoury | Each station stocks two of Burst laser II (55 cr), Heavy laser (45), Twin Hellion (50), Ion blast II (50) and Breach missile (60), for two spare hardpoints. |
| Magazine | The Lodestar carries 6 Hellions to start, 12 at most. Rules-2 battles spend them. Stations sell two for 14 credits, with no day spent; a flown escort adds two. |

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
