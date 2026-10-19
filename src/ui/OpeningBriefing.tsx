import { useEffect, useRef, useState } from 'react'
import { CrewLine } from './crew-presence.js'
import { MuteButton } from './sound.js'
import './opening-briefing.css'

/** Narratively fixed opening: never consumes campaign days or alters the save. */
const BRIEFING = [
  {
    eyebrow: 'TRANSIT REPORT / DAY ZERO',
    heading: 'These are not our stars.',
    context: 'The ISS Lodestar crossed an experimental transit aperture. The jump succeeded — but the exit did not match any chart. Earth is beyond communications range.',
    speaker: 'mori',
    line: 'I have run the comparison three times. Not one constellation matches. Captain, we are a long way from home.',
    art: '/assets/rooms/communications.png',
    alt: 'Navigator at the communications station aboard the Lodestar',
  },
  {
    eyebrow: 'ENGINEERING / SHIP STATUS',
    heading: 'One ship. Limited supplies.',
    context: 'The Lodestar survived intact enough to explore, but the transit cannot simply be repeated. The crew will need fuel, materials and a new Return Drive to make it home.',
    speaker: 'kerr',
    line: 'I can keep her flying. Getting us home will take more than repairing what we have.',
    art: '/assets/rooms/engineering.png',
    alt: 'Engineering room aboard the Lodestar',
  },
  {
    eyebrow: 'CAPTAIN’S ORDERS / FIRST CONTACT',
    heading: 'Find a way home.',
    context: 'Morozova has a starting research programme. Sensors also show nearby contacts; a survey may reveal an old courier carrying the first useful clue. You choose which risks the crew takes.',
    speaker: 'vale',
    line: 'Start Drive Diagnostics. Survey the area. Bring our people back. Then we make our own way home.',
    art: '/assets/rooms/bridge.png',
    alt: 'Bridge of the ISS Lodestar',
  },
] as const

export function OpeningBriefing({ onComplete, onBack }: { onComplete: () => void; onBack: () => void }) {
  const [step, setStep] = useState(0)
  const next = useRef<HTMLButtonElement>(null)
  const beat = BRIEFING[step]!
  useEffect(() => { next.current?.focus() }, [step])
  const advance = () => { if (step === BRIEFING.length - 1) onComplete(); else setStep(step + 1) }
  return <main className="opening-briefing" aria-label="Expedition opening briefing">
    <img className="opening-art" src={beat.art} alt={beat.alt} />
    <div className="opening-shade" aria-hidden="true" />
    <div className="opening-content">
      <span className="exp-eyebrow">ISS LODESTAR / {beat.eyebrow}</span>
      <div className="opening-progress" aria-label={'Briefing ' + (step + 1) + ' of ' + BRIEFING.length}>
        {BRIEFING.map((s,i) => <span key={s.heading} aria-current={i === step ? 'step' : undefined} />)}
      </div>
      <h1>{beat.heading}</h1>
      <p className="opening-context">{beat.context}</p>
      <CrewLine person={beat.speaker}>{beat.line}</CrewLine>
      <div className="opening-actions">
        <button className="exp-button primary" ref={next} onClick={advance}>{step === BRIEFING.length - 1 ? 'Take command' : 'Continue briefing'}</button>
        <button className="exp-button" onClick={onComplete}>Skip briefing</button>
        <button className="opening-back" onClick={onBack}>Return to title</button>
      </div>
    </div>
    <MuteButton className="start-mute" />
  </main>
}
