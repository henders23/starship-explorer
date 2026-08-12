# Starship Explorer

A narrative space adventure in the spirit of *Starship Traveller* (Fighting
Fantasy #4) — but instead of a branching paragraph book, an open, seeded galaxy.

You captain a ship thrown far from home by a jump anomaly. Fuel is finite, the
crew are named and die permanently, and the only thing that actually wins the
game is **information**: fragments of astrogation lore, gathered from traders,
ruins, derelicts and prisoners, each one narrowing down which of the galaxy's
stars hides the way back. Some of those fragments are lies.

When you think you know where home is, you commit everything to one jump.

## Status

**Milestones 1 and 2 complete, M3 crew slice in** — the deduction is playable
and winnable, and it now costs fuel and people. The ship is a place on the
chart: every lane burns fuel, gas giants refill the tank, and evidence is
collected where the ship is, not where the cursor is. Defended evidence takes
an away team: officers unlock approaches, generics absorb the harm, artefacts
come back unreadable without your science officer, and dead officers' chairs
are filled by promoting nameless crew who then have names. A wrong Long Jump
flings the ship across the chart with a near-dry tank; running out of moves
entirely ends the run in the long silence. No ship combat yet.

```bash
npm install
npm run dev                                       # play the Nav Plot
npm run mystery -- --seed voyager --walkthrough   # inspect a generated puzzle
npm run mystery -- --sweep 300                    # generation statistics
npm test
```

## Documentation

- **[Design document](docs/DESIGN.md)** — systems, mechanics, architecture
- **[Roadmap](docs/ROADMAP.md)** — build order, milestones, risks
- **[The mystery and the Nav Plot](docs/MYSTERY.md)** — what M2 does, how it behaves, what it doesn't do yet

## Stack

TypeScript · React · Vite · Tailwind · Vitest — with a pure, deterministic,
seeded rules engine that knows nothing about React. The engine never calls
`Math.random`: a seed plus an action log must always replay to the same state.
