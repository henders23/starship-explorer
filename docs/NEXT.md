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

### R8 — Ship it properly — **DONE (19 Aug)**

*Goal: the released thing is the real thing, and the repo can't drift again.*

- ~~**Production cutover.**~~ Done: `main` fast-forwarded, production READY.
- ~~**Settle the Ithaca branch.**~~ Done: the three ideas live as real specs —
  `docs/specs/battle-stations.md`, `docs/specs/campaign-endings.md`,
  `docs/specs/doorway-home.md` — adapted to this engine. The branch itself
  still needs its one-click deletion in the GitHub UI.
- ~~**Save versioning policy.**~~ Done: versioned envelope (`src/ui/save.ts`),
  migration chain, archive-not-delete on mismatch, legacy adoption, tests.
- ~~**The golden-replay harness.**~~ Done: three complete pilot-driven runs
  (`tests/fixtures/golden/`), replayed by final-state hash in the suite;
  `npm run golden:record` regenerates deliberately (`tools/pilot.ts` plays,
  `tools/record-golden.ts` records).
- ~~**One Playwright smoke flow in CI.**~~ Done: `.github/workflows/ci.yml`
  runs typecheck, the full suite (golden replays included), and the
  title → briefing → scene → collect browser walk (`e2e/smoke.spec.ts`).

**Done when:** the public URL serves the current game, CI replays a golden
run, and one branch is the branch. *All true as of 19 Aug; branch-of-record
note: `main` is current — changing the repo's default branch to `main` is
still one click in the GitHub UI.*

### R9 — The content milestone

*Goal: a full run never shows the player the same scene twice, and the ending
is the best scene in the game.*

- ~~**Scene pool depth**~~ Done 19 Aug: 3–4 beat variants per family with
  region flavour, and variant *rotation* — a run repeats no scene text until
  a family outgrows its pool (pinned by the encounters suite).
- ~~**Mid-mission choice nodes**~~ Done 19 Aug: the crisis — some missions
  hold at an authored complication per site family, odds printed exactly as
  rolled, riding the harm ladder; saves resume mid-crisis (schema v3).
- **The finale**: ~~an arrival scene at the gateway threshold~~ done 19 Aug —
  the correct Long Jump arrives at the threshold and the transit is the
  scene's commit option. Remaining: the optional contested transit (per
  `docs/specs/doorway-home.md`), which wants the campaign-endings flags
  groundwork first.
- **Combat presentation depth**: ~~per-class enemy room layouts~~ and ~~a
  tier-3 flagship class~~ done 19 Aug (seven interior plans, the Ashen
  Sovereign at surge ≥ 4). Remaining: hi-res exports of favourite catalog
  ships — an art task, not a code one.
- ~~**Loss epilogues**~~ Done 19 Aug: the epilogue rulebook
  (`src/engine/state/epilogue.ts`) shows every ending the lines the run
  earned, and the loss screens name the dead.

**Done when:** a complete playthrough contains no repeated scene text and the
gateway arrival is a scene, not a screen-swap.

### R10 — Balance, feel, release

*Goal: a stranger can finish a run, want another, and hear the game.*

- ~~**Full-run playtests first**~~ Done 19 Aug, and automated: `npm run
  playtest` sweeps the pilot across dozens of seeds and reports outcomes,
  fuel floors, stalls and combat load (`docs/playtests/`). First findings
  drove real fixes — surge bleeds tuned (8/15 → 6/10, scarred drives vent
  fuel instead of re-scarring), stranding detected honestly (reachability,
  not "any affordable lane") and declared on any fuel spend, and the chart
  now prints each leg's arrival fuel against the cost of rescue beyond it.
  After the pilot learned staged refuelling, 60/60 standard seeds finish —
  the economy is sound but demands planning, which the new readout teaches.
- **The tuning pass**: contact rates and the 12-day grace, damage curves and
  tier-2 timing, research day costs, component counts — the sweep is now the
  instrument for all of it. ~~Short galaxy as the first-run mode~~ done
  19 Aug: 48 systems, same solvability contract, chosen on the title screen;
  sweeps read it at 100% completion, a third shorter, 90% bloodless.
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
