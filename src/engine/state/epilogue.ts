import { FOCUS_LABELS } from '../crew/types.js'
import type { GameState } from './types.js'

/**
 * The epilogue rulebook (R9; docs/specs/campaign-endings.md): every ending
 * screen — home and the losses alike — shows the lines this run earned,
 * keyed on facts the state already keeps. People first, then the voyage,
 * then the sky. A run that did nothing memorable gets a short epilogue;
 * that is the point.
 *
 * Rules return null when the run did not earn their line. Order is
 * authored, not sorted.
 */
type EpilogueRule = (state: GameState) => string | null

const RULES: EpilogueRule[] = [
  // — The people —
  (s) =>
    s.casualties.officers.length === 0 && s.casualties.generics === 0 && s.day > 0
      ? 'Nobody died out here. Whatever else this log records, let it record that first.'
      : null,
  (s) => {
    const stepped = s.roster.filter((o) => o.origin === 'promoted' && o.status !== 'dead')
    if (stepped.length === 0) return null
    const names = stepped.map((o) => o.name).join(' and ')
    return `${names} ${stepped.length === 1 ? 'was' : 'were'} a number on a duty roster when the voyage began, and ${
      stepped.length === 1 ? 'holds' : 'hold'
    } a department at the end of it. Ships make people the way people make ships.`
  },
  (s) => {
    if (s.recruits.aboard.length === 0) return null
    const names = s.recruits.aboard
      .map((r) => `${r.name} (${FOCUS_LABELS[r.focus].toLowerCase()})`)
      .join(', ')
    return `Strangers signed aboard at strange docksides and made the ship better than her plans: ${names}.`
  },

  // — The voyage —
  (s) =>
    s.collected.length > 0 && s.collected.length === s.mystery.clues.length
      ? `Every account of the anomaly this sky held — all ${s.collected.length} of them — ended up on the plot. Nothing out here knew something the ship did not go and hear.`
      : null,
  (s) =>
    s.undecoded.length > 0
      ? `${s.undecoded.length === 1 ? 'One recovered artefact was' : `${s.undecoded.length} recovered artefacts were`} never read. The sky keeps a few of its accounts.`
      : null,
  (s) => {
    const failed = s.jumps.filter((j) => !j.correct).length
    if (failed === 0) return null
    return failed === 1
      ? 'The reserve burned once on a star that held nothing. The plot was wrong before it was right, and the ship survived learning it.'
      : `${failed} times the reserve burned on stars that held nothing. The ship kept plotting.`
  },

  // — The sky —
  (s) =>
    s.surges >= 3
      ? `The Rift surged ${s.surges} times, each worse than the last. It never stopped the work; it only priced it.`
      : null,
  (s) =>
    s.driveScarred
      ? 'The drive never sounded quite the same after the rift finished with it. Ships remember too.'
      : null,
  (s) =>
    s.combats === 0 && s.day >= 20
      ? 'In all those days under a hostile sky, no interceptor ever closed to weapons range. Quiet lanes are read, not found.'
      : null,
  (s) =>
    s.combats >= 3 && s.ship.hull >= 100 && s.outcome !== 'destroyed'
      ? `${s.combats} interceptions, and the hull reads whole at the end of it. Knowing things is a weapon that never needs reloading.`
      : null,
]

/** The lines this run earned, in authored order. */
export function epilogueLines(state: GameState): string[] {
  const lines: string[] = []
  for (const rule of RULES) {
    const line = rule(state)
    if (line !== null) lines.push(line)
  }
  return lines
}
