/**
 * Record golden-replay fixtures: complete runs, played by the pilot through
 * the real reducer, stored as seed + action log + final-state hash. The
 * golden-replay suite replays them in CI; a hash mismatch means the engine's
 * behaviour changed.
 *
 *   npm run golden:record              # refresh the standard fixture set
 *   npm run golden:record -- --scan 40 # hunt completable seeds, keep 3
 *
 * Regenerate deliberately, commit the diff, and say why in the commit: the
 * whole point of the pin is that these files only change on purpose.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { stateHash } from '../src/engine/state/hash.js'
import { newGame, reduceAll } from '../src/engine/state/reducer.js'
import { pilotRun } from './pilot.js'

const FIXTURE_DIR = join(import.meta.dirname, '..', 'tests', 'fixtures', 'golden')
/** The standard set: seeds known to complete. --scan finds replacements. */
const STANDARD_SEEDS = ['golden-1', 'golden-2', 'golden-3']

const args = process.argv.slice(2)
const scanIndex = args.indexOf('--scan')
const scanCount = scanIndex >= 0 ? Number(args[scanIndex + 1] ?? '40') : 0

mkdirSync(FIXTURE_DIR, { recursive: true })

let recorded = 0
const seeds = scanCount > 0
  ? Array.from({ length: scanCount }, (_, i) => `golden-${i + 1}`)
  : STANDARD_SEEDS
const wanted = scanCount > 0 ? 3 : seeds.length

for (const seed of seeds) {
  if (recorded >= wanted) break
  const run = pilotRun(seed)
  if (run.stalled || run.final.outcome !== 'home') {
    console.log(`  ${seed}: the pilot did not bring this seed home (${run.final.outcome}) — skipped`)
    continue
  }

  // Replay from nothing before trusting it: the fixture must reproduce.
  const replayed = reduceAll(newGame(seed), run.actions).state
  const hash = stateHash(replayed)
  if (hash !== stateHash(run.final)) {
    console.error(`  ${seed}: replay diverged from the recording — engine impurity, not writing it`)
    process.exitCode = 1
    continue
  }

  const fixture = {
    seed,
    hash,
    outcome: replayed.outcome,
    day: replayed.day,
    actionCount: run.actions.length,
    cluesCollected: replayed.collected.length,
    jumps: replayed.jumps.length,
    casualties: replayed.casualties,
    actions: run.actions,
  }
  const file = join(FIXTURE_DIR, `${seed}.json`)
  writeFileSync(file, JSON.stringify(fixture, null, 2) + '\n')
  console.log(
    `  ${seed}: ${fixture.outcome} on day ${fixture.day} — ${fixture.actionCount} actions, ` +
      `${fixture.cluesCollected} clues, hash ${hash}`,
  )
  recorded += 1
}

if (recorded < wanted) {
  console.error(`recorded ${recorded} of ${wanted} fixtures`)
  process.exitCode = 1
}
