/**
 * The playtest sweep (R10): fly the pilot across many seeds and measure the
 * runs — outcome mix, run length, fuel pressure, stalls, combat and crisis
 * load — before anyone tunes a number. The pilot plays with the answer key
 * open, so its numbers bound the experience from the optimal side: where
 * even the pilot stalls or scrapes the tank, a human will do worse.
 *
 *   npm run playtest                       # 60 seeds, standard sky
 *   npm run playtest -- --mode short       # the short-galaxy first-run mode
 *   npm run playtest -- --seeds 100 --write
 *
 * `--write` saves the report under docs/playtests/; otherwise it prints.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { GenerationError } from '../src/engine/mystery/generate.js'
import { VOYAGE_OPTIONS, type VoyageLength } from '../src/engine/state/modes.js'
import { newGame, reduce } from '../src/engine/state/reducer.js'
import type { GameState } from '../src/engine/state/types.js'
import { pilotRun } from './pilot.js'

const args = process.argv.slice(2)
const flag = (name: string): string | null => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && i + 1 < args.length ? args[i + 1]! : null
}
const mode = (flag('mode') ?? 'standard') as VoyageLength
const seedCount = Number(flag('seeds') ?? '60')
const write = args.includes('--write')

interface RunMetrics {
  seed: string
  outcome: GameState['outcome'] | 'stalled' | 'ungenerable'
  days: number
  actions: number
  cluesCollected: number
  cluesTotal: number
  undecodedLeft: number
  failedJumps: number
  genericsLost: number
  officersLost: number
  surges: number
  contacts: number
  battles: number
  crises: number
  scoops: number
  minFuel: number
  minHull: number
  /** Longest run of days between one evidence pickup and the next. */
  maxCollectionGap: number
  /** Days from the final evidence pickup to the end of the run. */
  endgameTail: number
}

function measure(seed: string): RunMetrics {
  const options = VOYAGE_OPTIONS[mode]
  let run
  try {
    run = pilotRun(seed, options)
  } catch (error) {
    if (error instanceof GenerationError) {
      return {
        seed, outcome: 'ungenerable', days: 0, actions: 0, cluesCollected: 0, cluesTotal: 0,
        undecodedLeft: 0, failedJumps: 0, genericsLost: 0, officersLost: 0, surges: 0,
        contacts: 0, battles: 0, crises: 0, scoops: 0, minFuel: 0, minHull: 0,
        maxCollectionGap: 0, endgameTail: 0,
      }
    }
    throw error
  }

  // Replay the log step by step for the timeline metrics the final state
  // cannot show: low-water marks and the rhythm of collection.
  let state = newGame(seed, options)
  let minFuel = state.ship.fuel
  let minHull = state.ship.hull
  let lastCollectionDay = 0
  let maxCollectionGap = 0
  let crises = 0
  for (const action of run.actions) {
    const step = reduce(state, action)
    state = step.state
    minFuel = Math.min(minFuel, state.ship.fuel)
    minHull = Math.min(minHull, state.ship.hull)
    for (const event of step.events) {
      if (event.type === 'evidenceFound') {
        maxCollectionGap = Math.max(maxCollectionGap, state.day - lastCollectionDay)
        lastCollectionDay = state.day
      }
      if (event.type === 'crisisStruck') crises += 1
    }
  }

  const final = run.final
  return {
    seed,
    outcome: run.stalled ? 'stalled' : final.outcome,
    days: final.day,
    actions: run.actions.length,
    cluesCollected: final.collected.length,
    cluesTotal: final.mystery.clues.length,
    undecodedLeft: final.undecoded.length,
    failedJumps: final.jumps.filter((j) => !j.correct).length,
    genericsLost: final.casualties.generics,
    officersLost: final.casualties.officers.length,
    surges: final.surges,
    contacts: final.combats,
    battles: run.actions.filter((a) => a.type === 'combatResolve').length,
    crises,
    scoops: run.actions.filter((a) => a.type === 'scoop').length,
    minFuel,
    minHull,
    maxCollectionGap,
    endgameTail: final.day - lastCollectionDay,
  }
}

const pct = (values: number[], q: number): number => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? 0
}
const mean = (values: number[]): number =>
  values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length

/* ---------------------------------------------------------------- */

const runs: RunMetrics[] = []
for (let i = 0; i < seedCount; i++) {
  const metrics = measure(`pt-${mode}-${i}`)
  runs.push(metrics)
  if (metrics.outcome !== 'home') {
    console.log(`  ${metrics.seed}: ${metrics.outcome} on day ${metrics.days} (${metrics.cluesCollected}/${metrics.cluesTotal} clues, min fuel ${metrics.minFuel})`)
  }
}

const finished = runs.filter((r) => r.outcome === 'home')
const outcomes = new Map<string, number>()
for (const r of runs) outcomes.set(r.outcome, (outcomes.get(r.outcome) ?? 0) + 1)

const line = (label: string, values: number[], suffix = ''): string =>
  `| ${label} | ${pct(values, 0.25)} | ${pct(values, 0.5)} | ${pct(values, 0.75)} | ${pct(values, 0.9)} | ${mean(values).toFixed(1)}${suffix} |`

const share = (predicate: (r: RunMetrics) => boolean, of: RunMetrics[] = finished): string =>
  of.length === 0 ? '0%' : `${Math.round((of.filter(predicate).length / of.length) * 100)}%`

const report = `# Playtest sweep — ${mode} sky, ${seedCount} seeds

*Pilot-driven (answer key open: these bound the experience from the optimal
side). Generated by \`npm run playtest -- --mode ${mode} --seeds ${seedCount}\`.*

## Outcomes

${[...outcomes.entries()].map(([k, v]) => `- **${k}**: ${v} of ${runs.length} (${Math.round((v / runs.length) * 100)}%)`).join('\n')}

## The finished runs

| metric | p25 | p50 | p75 | p90 | mean |
|---|---|---|---|---|---|
${line('days to home', finished.map((r) => r.days))}
${line('actions', finished.map((r) => r.actions))}
${line('clues collected', finished.map((r) => r.cluesCollected))}
${line('surges endured', finished.map((r) => r.surges))}
${line('contacts', finished.map((r) => r.contacts))}
${line('battles fought', finished.map((r) => r.battles))}
${line('crises held', finished.map((r) => r.crises))}
${line('fuel scoops', finished.map((r) => r.scoops))}
${line('min fuel', finished.map((r) => r.minFuel))}
${line('min hull', finished.map((r) => r.minHull))}
${line('longest collection gap (days)', finished.map((r) => r.maxCollectionGap))}
${line('endgame tail (days)', finished.map((r) => r.endgameTail))}

## Pressure flags

- Near-stranding (min fuel ≤ 5): ${share((r) => r.minFuel <= 5)} of finished runs
- Hull scare (min hull ≤ 35): ${share((r) => r.minHull <= 35)} of finished runs
- Long endgame tail (> 12 days after the last clue): ${share((r) => r.endgameTail > 12)}
- Mid-run stall (a collection gap > 15 days): ${share((r) => r.maxCollectionGap > 15)}
- Bloodless runs (nobody lost): ${share((r) => r.genericsLost === 0 && r.officersLost === 0)}
- Officer deaths anywhere: ${share((r) => r.officersLost > 0)}
- Artefacts left unread at the end: ${share((r) => r.undecodedLeft > 0)}
- Wrong Long Jumps: ${share((r) => r.failedJumps > 0)}
`

console.log('\n' + report)

if (write) {
  const dir = join(import.meta.dirname, '..', 'docs', 'playtests')
  mkdirSync(dir, { recursive: true })
  const file = join(dir, `sweep-${mode}-${seedCount}.md`)
  writeFileSync(file, report)
  console.log(`written to ${file}`)
}
