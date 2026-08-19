import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Officer, OfficerRole } from '../engine/crew/types.js'
import { useGame } from './store.js'

/**
 * The opening scene: the bridge, moments after the anomaly spits the ship
 * out. The founding officers talk the situation through in front of the
 * player, and in doing so hand over the game's manual in fiction — what the
 * chart is for, why away teams carry guns, why artefacts go to the lab, why
 * the medbay runs on the calendar, and what the one jump home will cost.
 *
 * The cast comes from the seeded roster, so the people speaking here are the
 * same faces the player will later send down to the surface.
 */

interface Beat {
  /** Which chair the line comes from; null is the ship's log narrating. */
  speaker: OfficerRole | null
  text: (names: Record<OfficerRole, string>) => string
}

const STATION_LABELS: Record<OfficerRole, string> = {
  captain: 'Command',
  security: 'Security',
  science: 'Science',
  medical: 'Medical',
}

const BEATS: Beat[] = [
  {
    speaker: null,
    text: () =>
      'Ship’s log, day one. The anomaly closed behind the Ithaca four hours ago. The stars outside the viewports do not match anything in the catalogue.',
  },
  {
    speaker: 'science',
    text: () =>
      'That was not a lane transit, Captain. Whatever the rift did, it put us somewhere off the charts entirely. I have run the constellations twice and I cannot match one of them. We are a long way from home.',
  },
  {
    speaker: 'security',
    text: () =>
      'Boards are clean. No pursuit, nothing on any band. Nothing came through behind us.',
  },
  {
    speaker: 'medical',
    text: () =>
      'Sickbay has bruises and one cracked rib. Twenty-four aboard, all accounted for.',
  },
  {
    speaker: 'captain',
    text: (n) => `Then we work the problem. ${n.science}, tell me what we know.`,
  },
  {
    speaker: 'science',
    text: () =>
      'We are in an uncharted sector, about ninety stars. A rift like the one that took us has a far end, so there is a mouth out there somewhere that leads back. The catalogue cannot tell us which star it sits behind. But people out here will have seen pieces of it.',
  },
  {
    speaker: 'security',
    text: () =>
      'Then we go and get those pieces. Ruins, derelicts, traders, whoever is holding them. My teams go down armed, Captain, and I pick who walks into what. Who you send changes the odds.',
  },
  {
    speaker: 'science',
    text: (n) =>
      `And whatever ${n.security} brings back, I read. Artefacts come up sealed and they stay sealed until somebody works them at the bench. Bring me anything with writing on it.`,
  },
  {
    speaker: 'medical',
    text: () =>
      'One thing before anyone gets heroic. If they come back on stretchers I have them for days at a time, and I cannot rush that. Build it into your planning.',
  },
  {
    speaker: 'medical',
    text: () =>
      'And the rift is not finished with us. Engineering says it surges. The light goes wrong, and something aboard breaks, or somebody does. When that happens my medbay fills up. Plan for it.',
  },
  {
    speaker: 'science',
    text: () =>
      'One last thing, Captain, and I think it is the one that matters. Some of what we are told out here will be wrong, and some of it will be worded to mislead us. Every account goes on the plot either way. But you have to decide which ones we believe, and the chart only narrows once you do.',
  },
  {
    speaker: 'security',
    text: () =>
      'Engineering reads eighty in the tank. Every lane burns some of it and there are no depots out here. Gas giants can refill us, if we find them and can spare the days.',
  },
  {
    speaker: 'captain',
    text: () =>
      'All right. We collect every account we can, we decide which ones to believe, and the plot narrows the field. When it is narrow enough we burn the reserve on one long jump. There will not be much left over for a second guess.',
  },
  {
    speaker: 'captain',
    text: () => 'Stations, everyone. Let’s find the way home.',
  },
]

export function BriefingScreen({ onComplete }: { onComplete: () => void }) {
  const roster = useGame((s) => s.state.roster)
  const [beat, setBeat] = useState(0)

  const byRole = useMemo(() => {
    const map = {} as Record<OfficerRole, Officer | undefined>
    for (const officer of roster) map[officer.role] = officer
    return map
  }, [roster])

  // Short address forms — "Cpt. Vale", "Chief Cross" — for use inside lines.
  const shortNames = useMemo(() => {
    const short = {} as Record<OfficerRole, string>
    for (const role of Object.keys(STATION_LABELS) as OfficerRole[]) {
      const name = byRole[role]?.name ?? STATION_LABELS[role]
      const parts = name.split(' ')
      short[role] = parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]}` : name
    }
    return short
  }, [byRole])

  const last = beat === BEATS.length - 1
  const current = BEATS[beat]!
  const officer = current.speaker ? byRole[current.speaker] : undefined

  const advance = useCallback(() => {
    if (last) onComplete()
    else setBeat((b) => b + 1)
  }, [last, onComplete])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault()
        advance()
      }
      if (event.key === 'Escape') onComplete()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [advance, onComplete])

  return (
    <div className="briefing-screen" onClick={advance}>
      <div className="briefing-backdrop" aria-hidden="true" />
      <div className="briefing-veil" aria-hidden="true" />

      <div className="briefing-header">
        <div className="eyebrow">ISS Ithaca · bridge · day 1</div>
        <h2>All hands to the bridge</h2>
      </div>

      <button
        className="briefing-skip"
        onClick={(event) => {
          event.stopPropagation()
          onComplete()
        }}
      >
        Skip briefing
      </button>

      <div className="briefing-dialogue panel-glass" key={beat}>
        {officer ? (
          <div className="briefing-portrait">
            {officer.portrait ? (
              <img src={officer.portrait} alt="" />
            ) : (
              officer.name.slice(0, 1)
            )}
          </div>
        ) : (
          <div className="briefing-portrait is-log">✦</div>
        )}
        <div className="briefing-copy">
          <div className="briefing-speaker">
            {officer ? (
              <>
                <strong>{officer.name}</strong>
                <span>{STATION_LABELS[current.speaker!]}</span>
              </>
            ) : (
              <strong>Ship’s log</strong>
            )}
          </div>
          <p className="briefing-line">{current.text(shortNames)}</p>
        </div>
      </div>

      <div className="briefing-footer" onClick={(event) => event.stopPropagation()}>
        <div className="briefing-progress" aria-label={`Line ${beat + 1} of ${BEATS.length}`}>
          {BEATS.map((_, index) => (
            <i key={index} className={index <= beat ? 'is-done' : ''} />
          ))}
        </div>
        <button className="briefing-advance" onClick={advance}>
          {last ? 'Take your station' : 'Continue'} <span>›</span>
        </button>
      </div>
    </div>
  )
}
