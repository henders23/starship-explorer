# The mystery and the Nav Plot (Milestone 2)

The deduction puzzle is the spine of Starship Explorer, so it is the first thing
built — generator, solvability proof, and the screen the player reasons on.
The game is winnable end to end: gather evidence, work out who is lying, commit.

The engine is pure TypeScript with no React, no I/O and no `Math.random`.

## Try it

```bash
npm install
npm run dev                                       # the Nav Plot
npm run mystery -- --seed voyager --walkthrough   # inspect one puzzle
npm run mystery -- --sweep 300                    # distribution across 300 seeds
npm test                                          # includes a 400-seed contract sweep
MYSTERY_SEEDS=10000 npx vitest run tests/mystery-contract.test.ts
```

## The Nav Plot

Search a ringed star on the chart to collect the accounts held there. Trust or
doubt each one. The chart shows live which stars remain consistent, and when the
trusted set collapses to nothing the contradiction panel names the groups that
cannot all be true. When you are sure, commit to the Long Jump.

Three rules the screen obeys:

- **No progress bar.** The candidate count is the progress bar, and it goes *up*
  when the player withdraws trust. "7 of 12 clues found" would turn a deduction
  into a shopping list.
- **Ruled-out stars stay on the chart**, dimmed. Knowing what you have
  eliminated is half of knowing anything.
- **The UI cannot see the answer.** Components are handed `PlayerClue`, which
  has no `truth` field, so leaking it is a compile error rather than a
  code-review question. Everything derived comes from an engine selector.

### A playtest finding worth keeping

Driving the finished screen turned up a trap the design did not anticipate.
Listing bare clue ids in the contradiction panel is *actively misleading*: one
honest account that contradicts three separate lies appears in every conflict,
so the obvious "the common factor must be the liar" reading points straight at
the truth. Doubting it resolved the plot to a single confident candidate — the
decoy. The player wins the argument and loses the game.

The fix was not to weaken the trap but to stop the interface arguing for the
wrong side: each conflict now shows the source reliability beside each account,
so the signal that actually discriminates sits next to the one that does not.
Playing "doubt the least reliable account in each conflict" now removes exactly
the lies. Playing "doubt the one named most often" still loses, which is as it
should be — but it is now a judgement the player makes rather than one the
screen makes for them.

## How it works

**Constraints, not facts.** A clue is a predicate over star systems —
`lies rimward of Kepler 1777`, `has a gas giant`, `borders the Belior Combine`.
The player's candidate set is every system satisfying all the clues they trust.
Nothing is ever a checklist item; a clue is only worth what it eliminates.

**The generator proves the puzzle before shipping it.** Placing a Gateway and
scattering clues is easy; guaranteeing the result is *winnable and worth
solving* is the actual work. `proveMystery` re-derives everything from the
clues and the galaxy and asserts the contract in DESIGN §4.2 — solvable,
non-trivial, not a slog, falsifiable, catchable, reachable. A failure rerolls
the clue selection, then the Gateway, then the galaxy.

**Lies are constructed, not sprinkled.** A false clue is true of a *decoy*
system, false of the Gateway, and required to be catchable: there must exist at
most two honest clues that, combined with it, admit no system at all. That is
exactly what the Nav Plot's contradiction detector surfaces, so every lie in the
game is exposable by a player who gathers redundant evidence — and only by one.

**Corroboration is a reward, not decoration.** Two independent sources asserting
the same constraint promote each other to corroborated, and the generator only
ever plants corroborating pairs on truths. So a corroborated clue is genuinely
safe to trust, and seeking a second opinion is a real strategy rather than
flavour text.

## Measured behaviour

Across 10,000 seeds, every seed produces a puzzle satisfying the contract.
Typical figures from a 300-seed sweep:

| | min | p50 | p90 | max |
|---|---|---|---|---|
| honest clues | 9 | 13 | 14 | 18 |
| clues to a 3-system shortlist | 5.4 | 7.1 | 7.8 | 8 |
| jumps to gather a solution | 11 | 32 | 48 | 60 |
| galaxies rerolled | 1 | 2 | 5 | 12 |

Generation costs ~30 ms per seed.

## Things worth knowing before building on this

**The clue mix is ~77% spatial.** Proximity and direction dominate because two
dozen landmarks generate hundreds of spatial constraints against roughly a dozen
of everything else, and most property negations ("is not a neutron star") are
correctly filtered out for saying almost nothing. Selection already picks the
*kind* first and damps kinds it has used, which took non-spatial clues from 8%
to 23%; getting further needs a richer vocabulary of system properties — tech
level, biosphere, population, ownership history — which arrives with planets in
M4. This is a content limitation, not a generator bug.

**Lies can be tighter than truths.** Honest clues are constrained by the
non-triviality rule; false ones are not, so a lie is sometimes the most
*specific*-looking clue on the board. That reads as a tempting lead rather than
a tell, and it makes the deception work — but if playtesting shows players
learning "the narrow clue is the liar", the fix is to apply the same admission
floor to false clues.

**Nothing is tuned against real play yet.** The thresholds — 4 candidates for
small subsets, 8 clues to a shortlist, 60 jumps of gathering — are reasoned
guesses. They are all in `DEFAULT_PROOF_OPTIONS`, and `npm run mystery -- --sweep`
exists so they can be moved on evidence once the Nav Plot is playable.

## Layout

```
src/engine/
  rng/prng.ts              seeded PRNG; the engine never calls Math.random
  worldgen/
    galaxy.ts              systems, regions, jump lanes, factions
    index-galaxy.ts        derived views: BFS distances, degree, ordinals
  mystery/
    types.ts               Constraint, Clue, Mystery
    constraints.ts         evaluation, bitmask compilation, prose rendering
    pool.ts                enumerate every constraint true of a system
    generate.ts            Gateway, clue selection, decoy, lies, assembly
    proof.ts               the solvability contract  ← the important one
    deduce.ts              player-side: candidates, contradictions (never reads truth)
    prose.ts               authored phrasings per source archetype
tools/mystery-cli.ts       inspection and sweep harness
tests/                     unit, invariant, and contract-sweep tests
```

`deduce.ts` is the boundary: it is everything the UI is allowed to compute, and
it never consults `Clue.truth`. Keeping that line clean is what stops the answer
leaking into the Nav Plot.

## Performance note

Selection tests every offered clue against every existing pair and trio, which
is millions of set intersections per seed. Constraints are therefore compiled
once into bitmasks over systems and intersected word-wise, cached off the
`GalaxyIndex` in a `WeakMap`. This took generation from ~4 s per seed to ~30 ms,
which is the difference between a 10,000-seed property test being a release
gate and being impossible.

## The crew (M3, first slice)

Four named people and twenty-four numbers. The captain is the player; the
security, science and medical officers are the specialists; the generic pools
are exactly that — counts, no names — until one is promoted into a dead
officer's chair and becomes a person the epilogue will name.

Evidence held by traders, archives and castaways is a walk. Evidence inside
derelicts, ruins, holdouts and listening posts takes an **away mission**: pick
the team, pick an approach, read the odds, launch. The numbers shown are the
numbers rolled. Officers unlock approaches (security cuts in, science walks in
quiet, medical talks the holdouts down); generics soak the harm first; the
captain can lead in person for +8% — and if the captain dies out there, the
run ends.

A **costly** landing still recovers the evidence. A **disaster** recovers
nothing, and the site remains — it must, because a destroyable clue could
silently break the solvability contract.

Artefact evidence (logs, tablets, signals) recovered without the science
officer on the ground arrives **undecoded**: held, visible, unreadable, and
excluded from the Nav Plot until a fit science officer decodes it. Lose your
science officer with an empty promotion pool and those artefacts stay dark
for the rest of the run. That is the strategic wound the design asked for.

## Travel and the fuel clock (M1)

The ship is a place on the chart, and nothing happens at a distance: searching,
missions and scooping all require being there. Lanes cost fuel by length (the
tank holds 80); routes are plotted cheapest-first and drawn on the chart before
you commit to them. Gas giants refill the tank for free — the pumps of this
galaxy — and a swept derelict's tanks are worth 8 more.

The Long Jump takes a 30-fuel reserve. A wrong guess now has teeth: the rift
throws the ship at least five jumps from where it aimed, with 25 in the tank
and the chart to replot from a strange sky.

**Stranded is the loss condition**, and it is not "low on fuel" — it is *no
move remains*: no affordable lane, nothing here to scoop, the rift out of
reach, and no derelict left at this system whose tanks a mission could drain.
It is declared on the exact transition that closes the trap, and the run ends
in the long silence.

## Not done yet

- **A failed Long Jump does not damage the ship.** Displacement and fuel loss
  are in; drive scarring and the morale collapse await ship systems and morale
  (rest of M3).
- **No morale, consumables or ship subsystems.** The rest of M3.
- **No fog of war.** System contents are visible from the catalogue; M1's
  deferred piece, revisited alongside sensors.
- **No onboarding.** The screen assumes you have read this page.
