# State of the Voyage — deployment check and next steps

*19 Aug 2026 · repo `henders23/starship-explorer` · default branch
`claude/space-adventure-game-plan-29sgn5` @ 9ac3e7a · 139 tests / 13 suites*

Where the game stands after the R-series build-out, what the deployment check
found, and the three milestones that take it from feature-complete systems to
a finished, released game.

---

## 1. Deployment check — every build green, production nine milestones old

All eleven pushes of the R-series built successfully on Vercel: every preview
deployment from R0 through the FTL combat rebuild reports READY, with no build
failures anywhere in the run. PRs #3 and #4 merged the whole series into the
repository's default branch.

| Environment | Serving | Status |
|---|---|---|
| Production | tracks `main` @ bbfc065 — the **full R-series game**, deployed 19 Aug | **READY** |
| Default branch | `claude/space-adventure-game-plan-29sgn5` @ 9ac3e7a — full R-series via PRs #3 & #4 | READY |
| Working branch | `claude/game-cohesion-transitions-29u57t` @ fd37ec2 — all 11 deployments clean | READY |
| Parallel prototype | `claude/ithaca-encounters-combat-dxkwdl` — to be deleted; its three ideas are specced in R8/R9 below | DELETE |

**Status 19 Aug (done this session):** `main` was fast-forwarded through the
default branch plus the doc commit and pushed; Vercel built and promoted it —
production now serves the full game (deployment `READY`, commit bbfc065).
Remaining hand-work: **deleting the Ithaca branch needs one click in the
GitHub UI** (the remote environment's git proxy refuses deletion pushes, and
the GitHub API surface here has no delete-branch route) — Branches page →
`claude/ithaca-encounters-combat-dxkwdl` → delete. Its three worthwhile ideas
are already captured as specs in R8/R9. Branch strategy note for R8: `main`
is now current, but the repo's *default* branch is still
`claude/space-adventure-game-plan-29sgn5`; pick one as the branch of record
(recommend `main`) and change the GitHub default accordingly.

## 2. Where the game stands — feature-complete systems, thin content

The R-series delivered the pivoted design: everything arrives through
**scenes**; the way home takes all **three tracks** (the proven-solvable
deduction, the rift engine and shielding built from recovered components, and
the research bench whose translation tiers gate what the ship can read);
combat is the **FTL-style battle** — rooms, reactor power, four weapon types,
a thirteen-class enemy fleet — with intelligence still buying the bloodless
endings. Crew gain skill through use, specialists hire on at stations, runs
autosave and resume, and every ending pays off with the truth reveal.

The architecture held: the engine is pure and seeded, a seed plus an action
log replays exactly (the battle sim runs in the UI and reports one logged
`combatResolve` action), and the tests cover the systems including the
extended three-track solvability contract.

**What that leaves:** the game is now content-bound and balance-bound. One
scene variant per situation repeats quickly, combat classes share one room
layout, nobody has played a full run end-to-end, and the finish line is unrun.

## 3. Next steps

### R8 — Ship it properly

*Goal: the released thing is the real thing, and the repo can't drift again.*

- **Production cutover.** Point production at the current game and verify the
  live URL by hand. Retire or fast-forward `main` — one branch of record.
- **Settle the Ithaca branch.** Harvest three ideas as specs, then archive it:
  officers manning battle stations, campaign-conditional endings, and the
  *Doorway Home* contested-gate finale. Specs, not merges — the branches have
  incompatible engines.
- **Save versioning policy.** Saves currently fail-safe to a fresh game on
  schema change. Version stamp + stated policy before players have long runs
  to lose.
- **The golden-replay harness.** Promised in M0, still absent: seed + recorded
  action log asserting a final state hash in CI — before balancing changes
  numbers.
- **One Playwright smoke flow in CI** (title → briefing → scene → collect).

**Done when:** the public URL serves the current game, CI replays a golden
run, and one branch is the branch.

### R9 — The content milestone

*Goal: a full run never shows the player the same scene twice, and the ending
is the best scene in the game.*

- **Scene pool depth**: 3+ beat variants per template family, region flavour.
- **Mid-mission choice nodes**: one authored decision inside away missions
  with printed odds, riding the existing harm ladder.
- **The finale**: an arrival scene at the gateway threshold, and an optional
  contested transit (from the Ithaca spec) — fought, or passed bloodlessly
  with the right intelligence. The Long Jump stays the commit; the doorway
  becomes a place.
- **Combat presentation depth**: per-class enemy room layouts, hi-res exports
  of favourite catalog ships, a tier-3 flagship class.
- **Loss epilogues**: name what was lost with the same care the home ending
  names survivors.

**Done when:** a complete playthrough contains no repeated scene text and the
gateway arrival is a scene, not a screen-swap.

### R10 — Balance, feel, release

*Goal: a stranger can finish a run, want another, and hear the game.*

- **Full-run playtests first**: three complete seeds, log stalls/snowballs/
  boredom before tuning anything. Truth-reveal stats are the telemetry.
- **The tuning pass**: contact rates and the 12-day grace, damage curves and
  tier-2 timing, research day costs, component counts, fuel economy, target
  run length — plus a **short galaxy** (~40 systems) as the first-run mode.
- **Audio**: scene stingers, a map bed, surge and jump cues.
- **Onboarding & access**: first-clue nudge on the Nav Plot, colourblind-safe
  chart markers, keyboard coverage for scenes and battle.

**Done when:** an uncoached player finishes a short-galaxy run and starts a
second one.

## 4. Risks and open questions

| Risk | Why it matters | Mitigation |
|---|---|---|
| Content volume | Scene writing is now the schedule | Templates + casting only; pool grows every milestone |
| Balance debt | Every number set by judgement, not play | Playtests before tuning; golden replays lock behaviour first |
| Two-branch drift | main vs. default already diverged once | R8 settles one branch of record |
| Battle sim outside engine | `combatResolve` trusts the UI's report (clamped) | Accepted for single-player; revisit if runs are shared competitively |

**Open questions:** ironman by default or accept save-scumming; one Long Jump
failure survivable or two; whether the Ithaca finale's no-withdraw battle fits
the "every fight avoidable" pillar, or the contested gate should always keep a
bloodless route.
