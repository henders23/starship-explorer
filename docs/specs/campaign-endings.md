# Spec: Campaign-conditional endings — the run that gets remembered

*Harvested from `claude/ithaca-encounters-combat-dxkwdl` (commit `add4f3e`,
"The Doorway Home: an ending that remembers"). Spec, not a merge. The
branch is archived; this document is the idea's surviving form.*

## The idea

The ending reads the story. Every consequential thing the run did — the
people carried, the friends made, the enemies ended, the mercies shown —
gets a line in the epilogue, keyed on facts the run actually recorded. Two
design lines carry the whole feature:

> *"A ship that only flew and fought gets a short epilogue. That is the
> point."*

> *"When an encounter sets a consequential flag, give it an epilogue line —
> it is the cheapest place in the game to make a choice matter."*

## The Ithaca mechanism (as built there)

- **One untyped record**: `state.flags: string[]`. Encounter outcomes set
  and clear named flags (`defector-safe`, `gannet-friend`, `echo-dead`,
  `cargo-left`, …). No dedicated counters — the flags *are* the memory.
- **The epilogue rulebook**: a flat, authored-order array of
  `{ when: (state) => boolean, text }` — 16 rules there, grouped people →
  friends → enemies → region. `epilogueLines(state)` filters it; the
  Ending screen shows what the run earned. Mutual exclusion is
  hand-authored (a rule for "Vess walks free" and one for "Vess still
  aboard", conditions disjoint).
- **A journal, live-derived**: `openThreads(state)` (unfinished business)
  and `friendsOfTheShip(state)` — the same rule shape over the same flags,
  shown mid-run. The journal is a *read*, never a store.
- **Conditional outcomes**: encounter results could be gated on flags —
  a matching specific entry *replaces* the generic fallbacks. "The same
  choice lands differently on a ship that looted the paradise."

## Porting to this engine

We already keep half the memory: `casualties` (named officers, generic
count), `jumps`, `combats`, `surges`, `recruits.aboard`, `promotions`,
`tech.researched` — and the Ending/TruthReveal already read some of it
(`cleanRun`, per-officer sendoffs, the 24-souls line). The port:

1. **Add `flags: string[]` to `GameState`** (serialisable, replay-safe,
   set only by the reducer). Prefer a const union of known flag names for
   the compiler's sake — the Ithaca report's one regret was untyped
   strings.
2. **Set flags where consequence already happens**: scene options
   (castaway brought aboard vs. kept at airlock range, the archivist paid
   quietly), combat resolutions (`stood-down` on intel, `toll-paid`,
   `destroyed-them`, `yielded`), specialists signed, promotions made,
   surges endured past the third.
3. **The epilogue rulebook** in the engine (`epilogueLines(state)`),
   rendered by every ending screen — home *and* the losses. This is R9's
   "loss epilogues" item: stranded/destroyed/lost endings name what was
   done and who was lost with the same care the home ending names
   survivors.
4. **Later, if wanted**: the journal view (open threads mid-run) and
   flag-conditional scene variants. Both are strict extensions of the
   same rulebook shape.

## Sizing note

The value curve is steep at the start: even six or eight epilogue rules
over facts we already track (bloodless run, all components found before
day N, a promoted officer at a department, zero failed jumps, the linguist
aboard, three enemies destroyed) makes endings read like the run that
earned them. Flags can arrive incrementally after that.
