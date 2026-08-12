/**
 * Inspect a generated mystery.
 *
 *   npm run mystery -- --seed 1234
 *   npm run mystery -- --seed voyager --walkthrough
 *   npm run mystery -- --sweep 200
 *
 * The walkthrough replays the deduction one clue at a time, which is the
 * fastest way to feel whether a puzzle is a puzzle or a formality.
 */
import { createRng } from '../src/engine/rng/prng.js'
import { candidatesForAll, findContradictions, greedyMinimalSubset } from '../src/engine/mystery/deduce.js'
import { describeConstraint } from '../src/engine/mystery/constraints.js'
import { generatePuzzle, GenerationError } from '../src/engine/mystery/generate.js'
import { profileFor } from '../src/engine/mystery/prose.js'
import { REGION_NAMES } from '../src/engine/worldgen/types.js'

const args = process.argv.slice(2)
const flag = (name: string): string | null => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && i + 1 < args.length ? args[i + 1]! : null
}
const has = (name: string): boolean => args.includes(`--${name}`)

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`
const green = (s: string) => `\x1b[32m${s}\x1b[0m`
const red = (s: string) => `\x1b[31m${s}\x1b[0m`
const amber = (s: string) => `\x1b[33m${s}\x1b[0m`

function rule(title = ''): void {
  const line = '─'.repeat(Math.max(0, 78 - title.length))
  console.log(dim(title ? `── ${title} ${line}` : `${'─'.repeat(80)}`))
}

if (has('sweep')) {
  sweep(Number(flag('sweep') ?? '200'))
} else {
  report(flag('seed') ?? 'indefatigable')
}

function report(seed: string): void {
  let puzzle
  try {
    puzzle = generatePuzzle(seed)
  } catch (error) {
    if (error instanceof GenerationError) {
      console.error(red(error.message))
      if (error.report) for (const f of error.report.failures) console.error(red(`  · ${f}`))
      process.exit(1)
    }
    throw error
  }

  const { index, mystery, report: proof } = puzzle
  const gateway = index.system(mystery.gateway)
  const decoy = index.system(mystery.decoy)
  const start = index.system(index.galaxy.start)

  rule('GALAXY')
  console.log(`  seed              ${bold(puzzle.seed)}`)
  console.log(`  systems           ${index.systems.length}, ${index.galaxy.lanes.length} jump lanes`)
  console.log(`  factions          ${index.galaxy.factions.map((f) => f.name).join(', ')}`)
  console.log(`  arrival           ${bold(start.name)} (${REGION_NAMES[start.region]})`)
  console.log(`  generation cost   ${puzzle.attempts.galaxies} galaxies, ${puzzle.attempts.selections} clue selections`)

  rule('ANSWER (hidden from the player)')
  console.log(`  gateway           ${bold(gateway.name)} — ${REGION_NAMES[gateway.region]}, ` +
    `${index.jumps(start.id, gateway.id)} jumps out`)
  console.log(`  decoy             ${decoy.name} — ${REGION_NAMES[decoy.region]}`)

  rule('EVIDENCE')
  for (const clue of mystery.clues) {
    const site = index.system(clue.source.at)
    const tag = clue.truth === 'false' ? red('LIE ') : clue.corroborates.length > 0 ? green('CORR') : '    '
    console.log(
      `  ${tag} ${bold(clue.id)}  ${dim(`conf ${clue.confidence.toFixed(2)}`)}  ` +
        `${describeConstraint(clue.constraint, index)}`,
    )
    console.log(
      dim(`         ${profileFor(clue.source.kind).label} at ${site.name} ` +
        `(${index.jumps(start.id, site.id)} jumps) — admits ` +
        `${candidatesForAll([clue], index).length} systems`),
    )
  }

  rule('CONTRADICTIONS THE PLAYER CAN FIND')
  const contradictions = findContradictions(mystery.clues, index, 3)
  if (contradictions.length === 0) {
    console.log(amber('  none — the lies are uncatchable, which the proof should have rejected'))
  }
  for (const c of contradictions) {
    const involved = c.clues.map((id) => mystery.clues.find((x) => x.id === id)!)
    const liars = involved.filter((x) => x.truth === 'false').map((x) => x.id)
    console.log(`  ${c.clues.join(' + ')}  ${dim(`→ impossible together; the liar is ${liars.join(', ') || 'none'}`)}`)
  }

  if (has('walkthrough')) {
    rule('DEDUCTION WALKTHROUGH (honest clues, greedy order)')
    const trueClues = mystery.clues.filter((c) => c.truth === 'true')
    const ordered = greedyMinimalSubset(trueClues, index)
    const filed: typeof ordered = []
    for (const clue of ordered) {
      filed.push(clue)
      const remaining = candidatesForAll(filed, index)
      const names = remaining.slice(0, 8).map((id) => index.system(id).name)
      console.log(
        `  ${bold(String(filed.length).padStart(2))}. ${describeConstraint(clue.constraint, index)}`,
      )
      console.log(
        dim(`      ${remaining.length} candidate${remaining.length === 1 ? '' : 's'}: ` +
          `${names.join(', ')}${remaining.length > names.length ? ', …' : ''}`),
      )
    }
  }

  rule('PROOF')
  const s = proof.stats
  const line = (label: string, value: string, ok: boolean) =>
    console.log(`  ${ok ? green('✓') : red('✗')} ${label.padEnd(30)} ${value}`)

  line('solvable', `true clues admit ${s.finalCandidates} system`, s.finalCandidates === 1)
  line('non-trivial', `tightest ≤3-clue subset leaves ${s.tightestSmallSubset}`, s.tightestSmallSubset >= 4)
  line('not a slog', `${s.meanCluesToShortlist.toFixed(1)} clues to a shortlist (worst ${s.worstCluesToShortlist})`, s.meanCluesToShortlist <= 8)
  line('falsifiable', `${s.falseClueCount} lies, caught by ${s.detectionWitnessSizes.join('/')} truth(s)`, s.falseClueCount >= 2)
  line('decoy plausibility', `${(s.decoyPlausibility * 100).toFixed(0)}% of truths fit the decoy`, s.decoyPlausibility >= 0.5)
  line('redundancy', `${s.trueClueCount} truths vs ${s.greedyMinimumClues} needed (${s.redundancy.toFixed(2)}×)`, s.redundancy >= 1.6)
  line('reachable', `${s.tourJumps} jumps to gather a solution`, Number.isFinite(s.tourJumps))

  console.log()
  console.log(proof.ok ? green('  contract satisfied') : red(`  contract FAILED: ${proof.failures.join('; ')}`))
  console.log()
}

/** Generate many seeds and report the distribution — the balance-tuning view. */
function sweep(count: number): void {
  const rng = createRng('sweep')
  const stats: Array<{ seed: string; trueClues: number; mean: number; tour: number; galaxies: number }> = []
  const failures: string[] = []
  const rejections: Record<string, number> = {}
  const kinds: Record<string, number> = {}

  const started = Date.now()
  for (let i = 0; i < count; i++) {
    const seed = `sweep-${rng.int(1e9)}`
    try {
      const puzzle = generatePuzzle(seed)
      stats.push({
        seed,
        trueClues: puzzle.report.stats.trueClueCount,
        mean: puzzle.report.stats.meanCluesToShortlist,
        tour: puzzle.report.stats.tourJumps,
        galaxies: puzzle.attempts.galaxies,
      })
      for (const [key, n] of Object.entries(puzzle.rejections)) {
        rejections[key] = (rejections[key] ?? 0) + n
      }
      for (const clue of puzzle.mystery.clues) {
        kinds[clue.constraint.kind] = (kinds[clue.constraint.kind] ?? 0) + 1
      }
    } catch (error) {
      failures.push(`${seed}: ${(error as Error).message.split('\n')[0]}`)
      if (error instanceof GenerationError) {
        for (const [key, n] of Object.entries(error.rejections)) {
          rejections[key] = (rejections[key] ?? 0) + n
        }
      }
    }
  }
  const elapsed = Date.now() - started

  const summarise = (label: string, values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b)
    const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))]
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    console.log(
      `  ${label.padEnd(22)} min ${String(sorted[0]).padStart(5)}   ` +
        `p50 ${String(at(0.5)).padStart(5)}   p90 ${String(at(0.9)).padStart(5)}   ` +
        `max ${String(sorted[sorted.length - 1]).padStart(5)}   mean ${mean.toFixed(2)}`,
    )
  }

  rule(`SWEEP — ${count} seeds in ${(elapsed / 1000).toFixed(1)}s (${(elapsed / count).toFixed(1)}ms each)`)
  console.log(`  generated             ${green(String(stats.length))}   failed ${failures.length > 0 ? red(String(failures.length)) : '0'}`)
  summarise('true clues', stats.map((s) => s.trueClues))
  summarise('clues to shortlist', stats.map((s) => Math.round(s.mean * 10) / 10))
  summarise('gathering tour (jumps)', stats.map((s) => s.tour))
  summarise('galaxies rerolled', stats.map((s) => s.galaxies))

  const total = Object.values(kinds).reduce((a, b) => a + b, 0)
  console.log()
  console.log('  clue kind mix')
  for (const [kind, n] of Object.entries(kinds).sort((a, b) => b[1] - a[1])) {
    const share = n / total
    console.log(`    ${kind.padEnd(12)} ${(share * 100).toFixed(1).padStart(5)}%  ${'█'.repeat(Math.round(share * 60))}`)
  }

  console.log()
  console.log('  attempts rejected by clause')
  for (const [key, n] of Object.entries(rejections).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${key.padEnd(24)} ${String(n).padStart(6)}`)
  }

  for (const f of failures.slice(0, 5)) console.log(red(`  ${f}`))
  console.log()
}
