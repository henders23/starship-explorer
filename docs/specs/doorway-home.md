# Spec: The Doorway Home — a contested-gate finale

*Harvested from `claude/ithaca-encounters-combat-dxkwdl` (commit `add4f3e`).
Spec, not a merge. The branch is archived; this document is the idea's
surviving form, adapted to this engine's pillars.*

## The idea

The correct Long Jump should not cut straight to the ending screen. The
gateway becomes a *place*: the ship arrives at the threshold, the arrival
plays as a scene, and — when the run has let danger build — the approach
is contested before the transit. Ithaca's framing line:

> *"The answer was right — but the run ends at the Doorway, not on a
> dice-less cut to black."*

## The Ithaca mechanism (as built there)

- `plotTheJump` with the correct target opened a finale encounter instead
  of ending the run: node `contested` when the war meter had climbed
  (`warPressure >= 4`), else straight to node `threshold`.
- **Contested node**: both fleets fighting across the approach. Four
  bloodless passages, each gated on a relationship the campaign built
  (a friendly admiral's timetable, either faction's standing, a pirate's
  blind lane) — deterministic, no dice, visible-but-locked so the player
  sees what would have opened them. One ungated fallback: **punch
  through** — the hardest warship class in the game, `noWithdraw: true`
  ("the reserve is already burned; there is nothing to withdraw to"),
  victory resuming the scene at the threshold, defeat still the end of
  the ship.
- **Threshold node**: the run's last choice, offering every ending the
  campaign earned — go home now; hold the door for the refugees
  (gated); stay a season and repair the network (gated); or send the plot
  home and keep the ship out here. All deterministic.
- The reusable primitives: `rewards.resumeEncounter` (a battle inside a
  story beat hands the screen back to the beat) and `noWithdraw`.

## Porting to this engine

Adapted to our three-track gate and our combat model:

1. **The arrival scene** (R9's finale item, first slice): when
   `plotTheJump` is correct, cast a `gateway` scene at the target — the
   threshold as narration, the whole crew on the bridge — whose single
   commit option performs today's instant transit. Pure content; no rule
   change beyond deferring `outcome: 'home'` to the scene option.
2. **The contested transit** (second slice): our analogue of the war
   meter already exists — `combats`, faction intel, and the surge count.
   Proposed gate: contested when the run made real enemies (e.g. two or
   more enemies destroyed, or any faction fought without intel on it);
   clear otherwise. On the contested branch:
   - **Bloodless passes, gated on what we track**: intel on the
     contesting faction (`hasIntelOn` — the game's standing "knowing
     things is a weapon"), or the gunnery/comms specialist aboard, or a
     clean record with that faction.
   - **Punch through** as the ungated fallback: a tier-capstone enemy in
     our FTL-style sim, resolved through the same logged `combatResolve`.
3. **Resolving the open question** (NEXT.md): a no-withdraw battle would
   break the "every fight avoidable" pillar — so *keep a bloodless route
   always available*, but price the fallback ones (fuel across the gap, a
   surge endured in the queue) so the earned routes still feel earned.
   `noWithdraw` applies only to the fight the player chose: committing to
   punch through is the one battle you cannot leave, which preserves the
   pillar (the *fight* was avoidable; the *retreat* is what's gone).
4. **Ending variants can wait.** Ithaca's four endings (return, hold the
   door, keeper, lighthouse) need the campaign-endings spec's flags to
   gate honestly. First ship the doorway as a place with one commit;
   variants arrive with the epilogue rulebook.

## Numbers from the source, for tuning reference

Contested threshold: war meter ≥ 4 of 10. Gate enemy: hull 24, shields 2
(their strongest non-boss). All finale dialogue results deterministic
(single entries, weight 100). Gate battle cost no calendar day.
