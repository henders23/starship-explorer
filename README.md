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

**Milestones 1–3 complete** — the deduction is playable and winnable, and it
costs fuel, days and people. Every jump burns fuel and a day; supplies drain
and hungry crews sour; wounded officers sit in the medbay by the calendar;
the Rift surges on its own escalating schedule; and a crew pushed past
Mutinous takes the ship. Defended evidence takes an away team whose
composition sets your options and your odds; artefacts come back unreadable
without your science officer; the bridge, consulted, gives real answers.
Four ways for a run to end: home, the captain dead on the ground, the long
silence, or the mutiny. No ship combat yet.

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
