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

**Milestone 2 in progress** — the deduction puzzle. The generator and its
solvability proof are built and tested; there is no game around them yet.

```bash
npm install
npm run mystery -- --seed voyager --walkthrough   # inspect a generated puzzle
npm run mystery -- --sweep 300                    # generation statistics
npm test
```

## Documentation

- **[Design document](docs/DESIGN.md)** — systems, mechanics, architecture
- **[Roadmap](docs/ROADMAP.md)** — build order, milestones, risks
- **[The mystery generator](docs/MYSTERY.md)** — what M2 does, how it behaves, what it doesn't do yet

## Stack

TypeScript · React · Vite · Tailwind · Vitest — with a pure, deterministic,
seeded rules engine that knows nothing about React. The engine never calls
`Math.random`: a seed plus an action log must always replay to the same state.
