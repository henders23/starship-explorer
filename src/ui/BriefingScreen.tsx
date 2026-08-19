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
      'Ship’s log, day one. The jump anomaly has closed behind the Indefatigable. The stars outside the viewports match nothing in the catalogue.',
  },
  {
    speaker: 'science',
    text: () =>
      'That was no lane transit, Captain. The rift carried us clean off the charts — I can’t match a single constellation. We are a very long way from home.',
  },
  {
    speaker: 'security',
    text: () =>
      'Boards are clean. No pursuit, no contacts. Whatever threw us here didn’t follow us through.',
  },
  {
    speaker: 'medical',
    text: () =>
      'Sickbay reports bruises and one cracked rib. Twenty-four souls aboard, all accounted for. Shaken, but standing.',
  },
  {
    speaker: 'captain',
    text: (n) => `Then we work the problem. ${n.science}, tell me what we know.`,
  },
  {
    speaker: 'science',
    text: () =>
      'An uncharted sector, some ninety stars. A rift like the one that took us has a far end — somewhere out there is the mouth that leads home. The catalogue can’t tell us which star hides it. But somebody out here will know pieces of it.',
  },
  {
    speaker: 'security',
    text: () =>
      'Then we go and take those pieces. Ruins, derelicts, traders, prisoners — whoever holds them. My teams go down armed, Captain, and I pick who walks into what. Composition sets the odds.',
  },
  {
    speaker: 'science',
    text: (n) =>
      `And whatever ${n.security} carries back, I read. Artefacts come to the lab sealed — without me at the bench they are just heavy souvenirs. Bring me anything with writing on it.`,
  },
  {
    speaker: 'medical',
    text: () =>
      'A word before anyone gets heroic: if they come back on stretchers, they are mine for days, not hours. The medbay runs on the calendar, and so should your plans.',
  },
  {
    speaker: 'medical',
    text: () =>
      'And the rift itself is not done with us. Engineering says it surges — the light goes wrong and something aboard breaks, or someone does. When it happens, my medbay fills. Plan for that too.',
  },
  {
    speaker: 'science',
    text: () =>
      'One more thing, and it matters most: some of what we are told out here will be wrong, or worded to mislead. Every account goes on the plot, but trust is a decision, Captain — not a feeling. The chart will show you which stars survive what you choose to believe.',
  },
  {
    speaker: 'security',
    text: () =>
      'Engineering reads eighty in the tank. Every lane burns it, and there are no depots out here — gas giants can refill us, if we find them and can spare the days.',
  },
  {
    speaker: 'captain',
    text: () =>
      'So that’s the shape of it. We gather every account we can, we decide which to believe, and the plot narrows the field. When it narrows far enough, we burn the reserve on one long jump. We only get to be sure once.',
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
        <div className="eyebrow">ISS Indefatigable · bridge · day 1</div>
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
