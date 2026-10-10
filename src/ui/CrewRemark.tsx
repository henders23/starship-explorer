import { useEffect, useMemo, useRef, useState } from 'react'
import { assignRemarks, REMARK_BY_ID, type RemarkVoice } from '../engine/crew/remarks.js'
import type { SystemId } from '../engine/worldgen/types.js'
import { useGame } from './store.js'

/**
 * The bridge, consulted.
 *
 * Point the chart at a star the ship has not been to and the officer whose
 * department it falls to says one thing about it — once per star, per voyage.
 * The chart is otherwise a silent instrument, and the crew are the reason any
 * of this matters; letting them speak over it is most of what makes ninety
 * catalogue entries feel like ninety places.
 *
 * Nothing here touches the deduction. The lines describe what a system *is*,
 * never where it stands in the plot, so a captain who reads every one of them
 * is no closer to the way home than one who dismisses them all.
 */

const STATION_LABELS: Record<RemarkVoice, string> = {
  security: 'Security',
  science: 'Science',
  medical: 'Medical',
}

const HEARD_KEY = 'starship-explorer-remarks-heard'

interface Heard {
  seed: string
  ids: SystemId[]
}

/**
 * Which stars this browser has already heard about, kept beside the save
 * rather than inside it: what the bridge has already said is presentation,
 * not a rule, and the engine's state hash should not move because somebody
 * clicked a star. A new seed starts the log again.
 */
function readHeard(seed: string): Set<SystemId> {
  try {
    const raw = window.localStorage.getItem(HEARD_KEY)
    if (!raw) return new Set()
    const heard = JSON.parse(raw) as Heard
    return heard.seed === seed ? new Set(heard.ids) : new Set()
  } catch {
    // Private modes refuse storage entirely. Hearing a line twice is a far
    // smaller failure than a chart that will not open.
    return new Set()
  }
}

function writeHeard(seed: string, ids: Set<SystemId>): void {
  try {
    window.localStorage.setItem(HEARD_KEY, JSON.stringify({ seed, ids: [...ids] } satisfies Heard))
  } catch {
    /* nothing to do: the bridge simply repeats itself next voyage */
  }
}

export function CrewRemark() {
  const seed = useGame((s) => s.state.seed)
  const galaxy = useGame((s) => s.state.galaxy)
  const roster = useGame((s) => s.state.roster)
  const selected = useGame((s) => s.state.selected)
  const shipAt = useGame((s) => s.state.ship.at)
  const busy = useGame(
    (s) => s.state.encounter !== null || s.state.combat !== null || s.state.crisis !== null,
  )

  const remarks = useMemo(() => assignRemarks(seed, galaxy), [seed, galaxy])
  const heard = useRef<Set<SystemId>>(readHeard(seed))
  const [speaking, setSpeaking] = useState<SystemId | null>(null)

  // A fresh voyage clears the log of what has been said.
  useEffect(() => {
    heard.current = readHeard(seed)
    setSpeaking(null)
  }, [seed])

  useEffect(() => {
    if (busy) return
    // Nothing to say about the deck plates: the ship is already here, and
    // arriving somewhere has scenes of its own.
    if (!selected || selected === shipAt) return
    if (heard.current.has(selected)) return
    heard.current.add(selected)
    writeHeard(seed, heard.current)
    setSpeaking(selected)
  }, [selected, shipAt, busy, seed])

  if (!speaking || busy) return null

  const remark = REMARK_BY_ID[remarks[speaking] ?? '']
  if (!remark) return null

  const system = galaxy.systems.find((s) => s.id === speaking)
  const officer = roster.find((o) => o.role === remark.voice && o.status === 'fit')

  return (
    <div className="chart-remark" key={speaking} role="status" aria-live="polite">
      {officer?.portrait ? (
        <div className="chart-remark-portrait">
          <img src={officer.portrait} alt="" />
        </div>
      ) : (
        <div className="chart-remark-portrait is-log">✦</div>
      )}
      <div className="chart-remark-copy">
        <div className="chart-remark-speaker">
          <strong>{officer ? officer.name : `${STATION_LABELS[remark.voice]} station`}</strong>
          <span>
            {officer
              ? `${STATION_LABELS[remark.voice]} · on ${system?.name ?? 'the chart'}`
              : `duty watch · on ${system?.name ?? 'the chart'}`}
          </span>
        </div>
        <p className="chart-remark-line">{remark.line}</p>
        <div className="chart-remark-foot">
          <button className="chart-remark-close" onClick={() => setSpeaking(null)}>
            Noted <span>›</span>
          </button>
        </div>
      </div>
    </div>
  )
}
