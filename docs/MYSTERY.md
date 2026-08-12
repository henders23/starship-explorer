# The mystery generator (Milestone 2)

The deduction puzzle is the spine of Starship Explorer, so it is the first thing
built. This document covers what exists, how it behaves, and what is not done.

Everything here is pure TypeScript with no React, no I/O and no `Math.random`.

## Try it

```bash
npm install
npm run mystery -- --seed voyager --walkthrough   # inspect one puzzle
npm run mystery -- --sweep 300                    # distribution across 300 seeds
npm test                                          # includes a 400-seed contract sweep
MYSTERY_SEEDS=10000 npx vitest run tests/mystery-contract.test.ts
```

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

## Not done yet

- Clue sources are placed but there is no travel, fuel or economy to reach them (M1)
- No Nav Plot UI — the CLI walkthrough stands in for it (M2)
- Crew, skill-gated decoding and degraded constraints (M3)
- The Long Jump and its consequences (M2)
