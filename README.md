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

**Milestones 1–3 complete, and the narrative layer is in** — the deduction
is playable and winnable, and it costs fuel, days and people. Every jump
burns fuel and a day; supplies drain, and an empty hold stops damage control
and sends away teams down hungry; wounded officers sit in the medbay by the
calendar; and the Rift surges on its own escalating schedule. The crew are
loyal to the end — the pressure is material, never political. Defended evidence
takes an away team whose composition sets your options and your odds;
artefacts come back unreadable without your science officer; the bridge,
consulted, gives real answers.

The ISS *Ithaca*'s galaxy now talks back: ~40 authored encounters —
contacts, traders, war patrols, derelicts, bounties, and connected chains
that hunt the ship down days later. Intelligence arrives from technology
(four research trees paid in data), from races (four cultures that keep
score), and from characters (missions and favours that pay in route clues
handed straight to the Nav Plot). Some encounters are hostile: real-time,
pausable, FTL-school ship combat — reactor allocation, per-room damage,
subsystem targeting, ion and beam mounts off the warfare tree, and a
withdraw option that costs fuel and rarely ends the argument. Four ways for a
run to end: home, the captain dead on the ground, the long silence, or the
ship lost with all hands — and being right is no longer a cut
to black: the correct jump opens the Doorway, contested by the war if you
let the war reach it, with four endings gated on what the ship actually did
out here, and an epilogue that remembers every thread the campaign closed.

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
- **[Encounters, intelligence and the war](docs/ENCOUNTERS.md)** — the narrative layer, research trees, cultures, and ship combat

## Stack

TypeScript · React · Vite · Tailwind · Vitest — with a pure, deterministic,
seeded rules engine that knows nothing about React. The engine never calls
`Math.random`: a seed plus an action log must always replay to the same state.
