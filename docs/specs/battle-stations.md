# Spec: Officers at battle stations

*Harvested from `claude/ithaca-encounters-combat-dxkwdl` (commit `e77b2a7`,
"Loyal crew at battle stations"). Spec, not a merge — the branches have
incompatible engines. The branch itself is archived; this document is the
idea's surviving form.*

## The idea

During ship combat, each officer can man a station that grants a live
bonus — and manning is a wager: a hit on a manned room can wound the
officer, and the wound rides back to the roster and the medbay calendar
where it costs days of that officer's skills (missions, research, decoding,
consults all read `isFit`). Standing an officer down is the safe, weaker
line. Loyal crew, real stakes, no morale meter.

## The Ithaca mechanism (as built there)

Stations, one per role:

| Station | Role | Room it depends on | Bonus |
|---|---|---|---|
| Helm | captain | helm | +evade: `4 + skill` points |
| Weapons | security | weapons | all weapons charge `×(1.06 + 0.02·skill)` |
| Sensors | science | sensors | enemy evade −5 on our shots |
| Medbay | medical | none (passive) | today's combat wounds heal in half the time |

Rules that made it work:

- **Auto-manned, opt-out.** Fit officers take their stations when battle
  opens; the player stands them down from the tactical display. Wounded
  officers cannot be re-manned mid-battle.
- **The liveness gate.** A bonus is live only while the officer is manning,
  unwounded, and the station's room has hull left. The sensors room was the
  most fragile (1 hp) — one hit kills the science bonus, which is the
  drama working as intended.
- **The wound roll.** Only on hits that reach the hull, only on manned
  rooms: 30% (`STATION_INJURY_CHANCE`) that the officer goes down.
  "OFFICER DOWN" in the battle log; the room keeps fighting.
- **The verdict re-enters the rules as one action.** The battle screen
  reported `{result, hull, injured: OfficerRole[]}`; the reducer applied
  injuries on the medbay calendar (6 days with a fit doctor, 12 without;
  a wounded doctor means 12 for everyone, including themselves). Defeat
  skips injuries — the ship is gone.

Design-intent line worth keeping: *"Manning is a real wager: the bonus is
live only while the officer's room has hull, and a hit that damages a
manned room can put its officer on the deck."*

## Porting to this engine

Our battle sim runs in the UI (`BattleScreen`) and reports one logged
`combatResolve` action; the engine clamps the report. The port is small:

1. **Extend the report**: `combatResolve` gains `injured: OfficerRole[]`.
   The reducer validates (roles on the roster, fit at battle start, no
   captain-death here — combat wounds, never kills) and applies
   `status: 'injured'` with the existing `injuryDuration` rules, which are
   already richer than Ithaca's (fit doctor and Trauma Protocols shorten
   the stay to 4; worst case 12).
2. **Stations in the sim**: map to our rooms (helm, weapons, sensors
   already exist in the FTL-style layout). Same bonuses, tuned to our
   numbers; keep the 30% wound roll on manned-room hull hits.
3. **Auto-man, opt-out** UI in the battle screen's bottom bar, with the
   status strip (`MANNED / STOOD DOWN / WOUNDED / UNFIT / ROOM DOWN`).
4. **Replay safety**: the wound list is part of the logged action, so
   replays never re-fight the battle — same contract we already hold.

Known gap in the source to decide deliberately: Ithaca documented "sensors
stay live unpowered with the science officer" in three places and
implemented it nowhere. Either implement it or drop it from the copy.

## Why it fits

The game's combat already pays intelligence over firepower; stations add
the other half — combat that reaches into the campaign layer through the
medbay calendar, using systems (injury, recovery, XP) that all exist. The
security chief's gunnery XP hook (`gainXp` on won fights) is already in
the reducer; station XP can ride the same rail.
