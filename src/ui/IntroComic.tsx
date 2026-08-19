import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Officer, OfficerRole } from '../engine/crew/types.js'
import { useGame } from './store.js'

/**
 * The intro comic: how the Ithaca got to the far side.
 *
 * Five panels, played as beats over each one. Captions carry the narration
 * and the officers carry the dialogue, so the panel that opens a scene sets
 * the situation and the people in it react to what the player is looking at.
 *
 * The cast is the ship's founding command, science and security chairs —
 * Vale, Morozova and Cross, pinned in the roster generator — so the faces
 * that fly into the aperture here are the faces at the stations when the
 * briefing opens a few hours later.
 */

type Speaker = Extract<OfficerRole, 'captain' | 'science' | 'security'>

interface Beat {
  /** Whose line it is; null is a caption box rather than a speech box. */
  speaker: Speaker | null
  text: string
}

interface Panel {
  image: string
  /** Alt text for the panel art, read before the beats over it. */
  alt: string
  beats: Beat[]
}

const STATION_LABELS: Record<Speaker, string> = {
  captain: 'Command',
  science: 'Science',
  security: 'Security',
}

const PANELS: Panel[] = [
  {
    image: '/assets/comic/panel-1.jpg',
    alt: 'The bridge of the ISS Ithaca, the aperture turning on the forward screens.',
    beats: [
      {
        speaker: null,
        text: 'The ISS Ithaca, survey command, on station in the Cassiar Deep Range at the outer limit of charted space.',
      },
      {
        speaker: null,
        text: 'She has spent eleven months alongside something nobody aboard can explain, waiting for the day the numbers allow a ship to go through it.',
      },
      { speaker: 'captain', text: '“Take me through it once more, Lieutenant. For the log.”' },
      {
        speaker: 'science',
        text: '“The aperture has held steady for nine days. We keep it open with the field generators, we put the Ithaca through under her own power, and we come out at the Meridian yards. Four hundred light years, in about forty seconds.”',
      },
      { speaker: 'captain', text: '“And if the field drops while we are inside it?”' },
      {
        speaker: 'science',
        text: '“Then we learn something the models cannot tell us. I do not expect it to drop, Captain.”',
      },
    ],
  },
  {
    image: '/assets/comic/panel-2.jpg',
    alt: 'The Ithaca running in towards the open aperture, her escort holding back.',
    beats: [
      {
        speaker: null,
        text: 'Every trial before this one went through on a tether, and every one of them came back.',
      },
      {
        speaker: 'security',
        text: '“Escort is on the standoff line, Captain. Damage control parties are closed up and the whole ship is strapped in.”',
      },
      { speaker: 'science', text: '“Field strength ninety-eight and holding. Throat geometry is where I want it.”' },
      {
        speaker: 'captain',
        text: '“Then we go. Helm, ahead one third, and stay on the line Lieutenant Morozova gave you.”',
      },
    ],
  },
  {
    image: '/assets/comic/panel-3.jpg',
    alt: 'The Ithaca inside the aperture, light tearing along her hull.',
    beats: [
      { speaker: null, text: 'The Ithaca crosses the boundary at 14:02, ship’s time.' },
      { speaker: 'science', text: '“Through the threshold. Hull stress is inside tolerance.”' },
      { speaker: 'science', text: '“Captain, the throat is longer than the model said it would be.”' },
      { speaker: 'captain', text: '“How much longer?”' },
      { speaker: 'science', text: '“I cannot tell you. It keeps going.”' },
    ],
  },
  {
    image: '/assets/comic/panel-4.jpg',
    alt: 'The bridge in chaos as the ship is dragged forward, consoles arcing.',
    beats: [
      { speaker: null, text: 'Then something on the far side takes hold of her.' },
      {
        speaker: 'security',
        text: '“We are accelerating! Helm has no authority, Captain, she is not answering the yoke!”',
      },
      {
        speaker: 'science',
        text: '“The field has inverted. It is pulling us in, and I cannot shut it down from this station.”',
      },
      { speaker: 'captain', text: '“Engineering, cut the drive. Cut everything.”' },
      {
        speaker: 'security',
        text: '“No answer from engineering. Nav is down, astrogation is down, half this bridge is dark.”',
      },
    ],
  },
  {
    image: '/assets/comic/panel-5.jpg',
    alt: 'The Ithaca adrift and scarred under an unfamiliar ringed world.',
    beats: [
      {
        speaker: null,
        text: 'It stops as suddenly as it started. The bridge chronometer says twenty-two minutes have passed.',
      },
      {
        speaker: 'science',
        text: '“Engines are answering. Barely. Captain, navigation has nothing. Not one star in the catalogue.”',
      },
      { speaker: 'captain', text: '“Run it again.”' },
      {
        speaker: 'science',
        text: '“I have run it three times. There is no match anywhere in the library. Nobody from home has ever charted this sky.”',
      },
      { speaker: 'security', text: '“Muster is complete, Captain. Nobody is missing.”' },
      { speaker: 'captain', text: '“All hands to the bridge.”' },
    ],
  },
]

/** Flat (panel, beat) order, so one counter walks the whole sequence. */
const SEQUENCE = PANELS.flatMap((panel, panelIndex) =>
  panel.beats.map((_, beatIndex) => ({ panelIndex, beatIndex })),
)

export function IntroComic({ onComplete }: { onComplete: () => void }) {
  const roster = useGame((s) => s.state.roster)
  const [step, setStep] = useState(0)

  const byRole = useMemo(() => {
    const map = {} as Record<OfficerRole, Officer | undefined>
    for (const officer of roster) map[officer.role] = officer
    return map
  }, [roster])

  const { panelIndex, beatIndex } = SEQUENCE[step]!
  const panel = PANELS[panelIndex]!
  const beat = panel.beats[beatIndex]!
  const officer = beat.speaker ? byRole[beat.speaker] : undefined
  const last = step === SEQUENCE.length - 1

  const advance = useCallback(() => {
    if (last) onComplete()
    else setStep((s) => s + 1)
  }, [last, onComplete])

  // The next panel is fetched while the current one is still being read, so
  // a click never lands on a blank frame.
  useEffect(() => {
    const next = PANELS[panelIndex + 1]
    if (!next) return
    const preload = new Image()
    preload.src = next.image
  }, [panelIndex])

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
    <div className="comic-screen" onClick={advance}>
      {/* Keyed on the panel so only a panel change replays the fade. */}
      <img key={panel.image} className="comic-panel" src={panel.image} alt={panel.alt} />
      <div className="comic-veil" aria-hidden="true" />

      <div className="comic-header">
        <div className="eyebrow">
          The wreck of the Corvin aperture · panel {panelIndex + 1} of {PANELS.length}
        </div>
      </div>

      <button
        className="briefing-skip"
        onClick={(event) => {
          event.stopPropagation()
          onComplete()
        }}
      >
        Skip intro
      </button>

      {beat.speaker === null ? (
        <div className="comic-caption" key={step}>
          <p>{beat.text}</p>
        </div>
      ) : (
        <div className="comic-dialogue panel-glass" key={step}>
          <div className="briefing-portrait">
            {officer?.portrait ? (
              <img src={officer.portrait} alt="" />
            ) : (
              (officer?.name ?? '?').slice(0, 1)
            )}
          </div>
          <div className="briefing-copy">
            <div className="briefing-speaker">
              <strong>{officer?.name ?? STATION_LABELS[beat.speaker]}</strong>
              <span>{STATION_LABELS[beat.speaker]}</span>
            </div>
            <p className="briefing-line">{beat.text}</p>
          </div>
        </div>
      )}

      <div className="briefing-footer" onClick={(event) => event.stopPropagation()}>
        <div className="briefing-progress" aria-label={`Beat ${step + 1} of ${SEQUENCE.length}`}>
          {SEQUENCE.map((_, index) => (
            <i key={index} className={index <= step ? 'is-done' : ''} />
          ))}
        </div>
        <button className="briefing-advance" onClick={advance}>
          {last ? 'Take your station' : 'Continue'} <span>›</span>
        </button>
      </div>
    </div>
  )
}
