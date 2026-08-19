import { useEffect, useRef, useState } from 'react'
import { BriefingScreen } from './BriefingScreen.js'
import { CombatOverlay } from './CombatOverlay.js'
import { CrisisOverlay } from './CrisisOverlay.js'
import { EncounterOverlay } from './EncounterOverlay.js'
import { EvidenceBoard } from './EvidenceBoard.js'
import { Inspector } from './Inspector.js'
import { LabScreen } from './LabScreen.js'
import { playCues } from './audio.js'
import { epilogueLines } from '../engine/state/epilogue.js'
import { voyageLengthOf, type VoyageLength } from '../engine/state/modes.js'
import { surgeForecast } from '../engine/state/reducer.js'
import { TruthReveal } from './TruthReveal.js'
import { TECH_BY_ID } from '../engine/research/tech.js'
import { LoadoutScreen } from './LoadoutScreen.js'
import { ShipHub } from './ShipHub.js'
import { StarMap } from './StarMap.js'
import { StartScreen } from './StartScreen.js'
import { useDispatch, useGalaxyIndex, useGame, useNavPlot } from './store.js'

export type Screen = 'ship' | 'galaxy' | 'loadout' | 'lab'

const NAV_ITEMS: Array<{ id: Screen; label: string; code: string }> = [
  { id: 'ship', label: 'Ship Overview', code: '01' },
  { id: 'galaxy', label: 'Galaxy', code: '02' },
  { id: 'loadout', label: 'Loadout', code: '03' },
  { id: 'lab', label: 'Research', code: '04' },
]

/** Title → briefing → the game. The briefing is the crew handing over context. */
type Phase = 'title' | 'briefing' | 'game'

export function App() {
  const outcome = useGame((s) => s.state.outcome)
  const [screen, setScreen] = useState<Screen>('ship')
  const [phase, setPhase] = useState<Phase>('title')
  const ambientRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const navigate = (event: Event) => {
      const next = (event as CustomEvent<Screen>).detail
      if (NAV_ITEMS.some((item) => item.id === next)) setScreen(next)
    }
    window.addEventListener('starship:navigate', navigate)
    return () => window.removeEventListener('starship:navigate', navigate)
  }, [])

  const restart = useGame((s) => s.restart)

  // The ship's ambience runs aboard ship — the briefing on the bridge and the
  // cutaway both count. Playback must begin inside the "Take command" click —
  // browsers refuse audio that was never sanctioned by a user gesture.
  const startAmbience = () => {
    const ambient = ambientRef.current ?? new Audio('/assets/audio/ship-ambient.mp3')
    ambientRef.current = ambient
    ambient.loop = true
    ambient.volume = 0.15
    void ambient.play().catch(() => {})
  }

  const begin = (seed: string | undefined, length: VoyageLength) => {
    startAmbience()
    // A named seed replays a known galaxy; a blank one rolls a fresh sky.
    restart(seed || `voyager-${Date.now().toString(36)}`, length)
    setPhase('briefing')
  }

  const resume = () => {
    startAmbience()
    setPhase('game')
  }

  // Station hotkeys, active once aboard and only when no overlay is playing.
  const encounterOpen = useGame(
    (s) => s.state.encounter !== null || s.state.combat !== null || s.state.crisis !== null,
  )
  useEffect(() => {
    if (phase !== 'game') return
    const onKey = (event: KeyboardEvent) => {
      if (encounterOpen) return
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
      const stations: Record<string, Screen> = { '1': 'ship', '2': 'galaxy', '3': 'loadout', '4': 'lab' }
      const next = stations[event.key]
      if (next) setScreen(next)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, encounterOpen])

  useEffect(() => {
    const ambient = ambientRef.current
    if (!ambient) return
    // The hum runs aboard ship, and quieter under the chart — the map bed.
    if (phase === 'briefing' || (phase === 'game' && (screen === 'ship' || screen === 'galaxy'))) {
      ambient.volume = screen === 'galaxy' ? 0.07 : 0.15
      void ambient.play().catch(() => {})
    } else ambient.pause()
  }, [phase, screen])

  // The cue layer (R10): every transition's events can carry a stinger —
  // scenes opening, surges, contact alarms, the jump. Pure presentation.
  const lastEvents = useGame((s) => s.lastEvents)
  useEffect(() => {
    if (phase === 'game') playCues(lastEvents)
  }, [phase, lastEvents])

  if (phase === 'title') {
    return (
      <div className="crt app-shell h-full">
        <StartScreen onBegin={begin} onResume={resume} />
      </div>
    )
  }

  if (phase === 'briefing') {
    return (
      <div className="crt app-shell h-full">
        <BriefingScreen onComplete={() => setPhase('game')} />
      </div>
    )
  }

  return (
    <div className="crt app-shell flex h-full flex-col">
      <Header screen={screen} onScreen={setScreen} />
      <div className="min-h-0 flex-1 overflow-hidden">
        {/* Keyed on the screen so switching stations plays the same short
            arrival transition everywhere, instead of a hard cut. */}
        <div key={screen} className="screen-stage h-full">
          {screen === 'ship' && <ShipHub onNavigate={setScreen} />}
          {screen === 'galaxy' && <GalaxyDeck />}
          {screen === 'loadout' && <LoadoutScreen />}
          {screen === 'lab' && <LabScreen />}
        </div>
      </div>
      <CaptainsLog />
      <EncounterOverlay />
      <CrisisOverlay />
      <CombatOverlay />
      {outcome === 'home' && <Ending />}
      {outcome === 'lost' && <LostEnding />}
      {outcome === 'stranded' && <StrandedEnding />}
      {outcome === 'destroyed' && <DestroyedEnding />}
    </div>
  )
}

function GalaxyDeck() {
  return (
    <div className="flex h-full min-h-0 galaxy-deck">
      <main className="border-rule min-w-0 flex-1 border-r">
        <StarMap />
      </main>
      <aside className="galaxy-sidebar flex w-[372px] shrink-0 flex-col overflow-hidden">
        <Section title="System">
          <Inspector />
        </Section>
        <Section title="Candidates">
          <CandidateList />
        </Section>
        <Section title="Evidence" grow>
          <EvidenceBoard />
        </Section>
      </aside>
    </div>
  )
}

function Header({ screen, onScreen }: { screen: Screen; onScreen: (screen: Screen) => void }) {
  const jumps = useGame((s) => s.state.jumps)

  return (
    <header className="command-bar border-rule flex shrink-0 items-center gap-5 border-b px-5">
      <div className="brand-lockup flex shrink-0 items-center">
        <h1 className="text-ink text-[17px] font-normal tracking-[0.24em] uppercase">Starship Explorer</h1>
      </div>

      <nav className="primary-nav flex h-full min-w-0 flex-1 items-stretch" aria-label="Primary stations">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => onScreen(item.id)}
            aria-current={screen === item.id ? 'page' : undefined}
            className={`nav-tab ${screen === item.id ? 'is-active' : ''}`}
          >
            <span>{item.code}</span>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="header-telemetry flex shrink-0 items-center gap-3">
        <NavPlotNudge />
        <ResearchChip />
        <FuelGauge />
        {jumps.length > 0 && (
          <span className="text-alarm-dim text-[10px]">
            {jumps.length} failed {jumps.length === 1 ? 'attempt' : 'attempts'}
          </span>
        )}
      </div>
    </header>
  )
}

function Section({
  title,
  children,
  grow = false,
}: {
  title: string
  children: React.ReactNode
  /** A growing section fills the remaining height and owns its own scrolling. */
  grow?: boolean
}) {
  return (
    <section className={`border-rule flex min-h-0 flex-col border-b ${grow ? 'flex-1' : 'shrink-0'}`}>
      <div className="label border-rule shrink-0 border-b px-4 py-1.5">{title}</div>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  )
}

/**
 * The candidate list is the score. It replaces the progress bar the design
 * forbids: it goes down as evidence accumulates and back up when the player
 * withdraws trust, which is exactly the feedback a deduction needs.
 */
function CandidateList() {
  const index = useGalaxyIndex()
  const dispatch = useDispatch()
  const selected = useGame((s) => s.state.selected)
  const { candidates, trusted, impossible } = useNavPlot()

  if (impossible) {
    return (
      <div className="text-alarm px-4 py-3 text-[11px]">
        No star fits. Something you trust is false.
      </div>
    )
  }

  if (trusted.length === 0) {
    return (
      <div className="text-ink-faint px-4 py-3 text-[11px]">
        Trust an account to begin narrowing the field.
      </div>
    )
  }

  return (
    <div className="px-4 py-2">
      <div className="text-ink-dim mb-1.5 text-[11px]">
        <span className="text-phosphor text-[14px]">{candidates.length}</span> consistent with{' '}
        {trusted.length} trusted {trusted.length === 1 ? 'account' : 'accounts'}
      </div>
      {candidates.length <= 24 && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          {candidates.map((id) => (
            <button
              key={id}
              onClick={() => dispatch({ type: 'select', system: id })}
              className={`text-[11px] ${
                selected === id ? 'text-amber' : 'text-phosphor hover:text-amber'
              }`}
            >
              {index.system(id).name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * The first-clue nudge (R10): evidence aboard but nothing ever filed means
 * the player may not know the deduction exists. One quiet chip until the
 * first act of trust or doubt, then never again.
 */
function NavPlotNudge() {
  const collected = useGame((s) => s.state.collected.length)
  const anyFiled = useGame((s) =>
    Object.values(s.state.clueStates).some((v) => v !== 'unfiled'),
  )
  if (collected === 0 || anyFiled) return null

  return (
    <button
      className="border-amber-dim/50 text-amber-dim hover:bg-amber-dim/10 border px-2 py-0.5 text-[10px]"
      onClick={() => window.dispatchEvent(new CustomEvent('starship:navigate', { detail: 'galaxy' }))}
      title="Accounts are aboard but none is trusted or doubted. Filing them is how the field narrows."
    >
      unassessed evidence — open the Nav Plot
    </button>
  )
}

/** The bench's active project, and the surge forecast once telemetry exists. */
function ResearchChip() {
  const active = useGame((s) => s.state.tech.active)
  const forecast = useGame((s) => surgeForecast(s.state))
  const day = useGame((s) => s.state.day)

  return (
    <span className="flex items-center gap-4 text-[11px]">
      {forecast !== null && (
        <span className="text-phosphor-dim" title="Rift Telemetry: the next surge, forecast to the day">
          surge day {forecast}{forecast <= day + 2 ? ' — soon' : ''}
        </span>
      )}
      {active && (
        <span className="text-amber-dim" title="Active research: ticks down while the science officer is fit">
          R&D: {TECH_BY_ID[active.id]!.name} · {active.daysLeft}d
        </span>
      )}
    </span>
  )
}

function FuelGauge() {
  const fuel = useGame((s) => s.state.ship.fuel)
  const hull = useGame((s) => s.state.ship.hull)
  const day = useGame((s) => s.state.day)
  const scarred = useGame((s) => s.state.driveScarred)
  const max = 80
  const filled = Math.round((fuel / max) * 12)
  const tone = fuel <= 20 ? 'text-alarm' : fuel <= 40 ? 'text-amber' : 'text-phosphor'

  return (
    <span className="flex items-center gap-5 text-[14px]">
      <span className="flex items-center gap-2">
        <span className="label">Day</span>
        <span className="text-ink">{day}</span>
      </span>
      <span className="flex items-center gap-2.5">
        <span className="label">Fuel</span>
        <span className={`tracking-tighter ${tone}`}>
          {'▮'.repeat(Math.max(0, filled))}
          <span className="text-ink-faint/40">{'▮'.repeat(Math.max(0, 12 - filled))}</span>
        </span>
        <span className="text-ink">
          {fuel}/{max}
        </span>
      </span>
      {hull < 100 && (
        <span
          className={hull <= 35 ? 'text-alarm' : 'text-amber-dim'}
          title="Battle damage. A faction yard refit plates it over."
        >
          hull {hull}%
        </span>
      )}
      {scarred && (
        <span className="text-alarm-dim" title="A scarred drive burns 30% more per lane until refitted in faction space">
          drive scarred
        </span>
      )}
    </span>
  )
}

function CaptainsLog() {
  const log = useGame((s) => s.state.log)
  const latest = log[log.length - 1]
  if (!latest) return null

  return (
    <footer className="border-rule text-ink-dim shrink-0 border-t px-4 py-2 text-[11px] leading-relaxed">
      <span className="text-ink-faint mr-2">{String(latest.id).padStart(3, '0')}</span>
      {latest.text}
    </footer>
  )
}

/**
 * The lines this run earned (R9): the engine's epilogue rulebook, shown on
 * every ending — the home run and the losses alike remember the voyage.
 */
function VoyageEpilogue() {
  const state = useGame((s) => s.state)
  const lines = epilogueLines(state)
  if (lines.length === 0) return null

  return (
    <div className="border-rule mb-4 flex max-h-44 flex-col gap-1.5 overflow-y-auto border-t pt-3 text-[12px] leading-relaxed">
      {lines.map((line) => (
        <p key={line} className="text-ink-dim">
          {line}
        </p>
      ))}
    </div>
  )
}

/**
 * The loss endings name what was lost with the same care the home ending
 * names survivors (R9). The dead get their lines; the living get counted.
 */
function TheCost() {
  const casualties = useGame((s) => s.state.casualties)
  const pools = useGame((s) => s.state.pools)
  const roster = useGame((s) => s.state.roster)
  const outcome = useGame((s) => s.state.outcome)
  if (casualties.officers.length === 0 && casualties.generics === 0) return null

  const standing = roster.filter((o) => o.status !== 'dead').length

  return (
    <div className="text-ink-dim mb-4 flex flex-col gap-1 text-[12px] leading-relaxed">
      {casualties.officers.map((name) => (
        <div key={name}>
          <span className="text-alarm-dim">{name}</span> did not live to see how it ends. The
          log has their name spelled right, where whoever finds it will read it.
        </div>
      ))}
      {casualties.generics > 0 && (
        <div className="text-ink-faint">
          {casualties.generics} of the ship's company died doing what the ship asked of them.
          The muster roll keeps every name{outcome === 'destroyed'
            ? '; now it keeps them all.'
            : `; ${standing + pools.security + pools.crew} souls remain to remember them.`}
        </div>
      )}
    </div>
  )
}

function Ending() {
  const restart = useGame((s) => s.restart)
  const seed = useGame((s) => s.state.seed)
  const length = useGame((s) => voyageLengthOf(s.state.galaxy))
  const jumps = useGame((s) => s.state.jumps)
  const roster = useGame((s) => s.state.roster)
  const pools = useGame((s) => s.state.pools)
  const casualties = useGame((s) => s.state.casualties)
  const { clues } = useNavPlot()
  const failed = jumps.filter((j) => !j.correct).length
  const cleanRun = casualties.generics === 0 && casualties.officers.length === 0

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/85 px-6">
      <div className="panel max-w-lg px-6 py-5">
        <div className="label mb-2">Charted space</div>
        <h2 className="text-phosphor mb-3 text-[18px]">
          {cleanRun ? 'Home, with everyone.' : 'We are going home.'}
        </h2>
        <p className="text-ink-dim mb-3 text-[12px] leading-relaxed">
          You found it with {clues.length} accounts in hand
          {failed > 0
            ? ` and ${failed} wasted ${failed === 1 ? 'attempt' : 'attempts'} behind you.`
            : ' and no wasted attempts.'}
        </p>
        <div className="text-ink-dim mb-4 flex flex-col gap-1 text-[12px] leading-relaxed">
          {roster
            .filter((o) => o.status !== 'dead')
            .map((o) => (
              <div key={o.role}>
                <span className="text-ink">{o.name}</span>{' '}
                {o.origin === 'promoted'
                  ? 'steps off the ship with a rank nobody can take back.'
                  : o.status === 'injured'
                    ? 'walks down the ramp unaided, against medical advice.'
                    : 'goes home.'}
              </div>
            ))}
          {casualties.officers.map((name) => (
            <div key={name}>
              <span className="text-alarm-dim">{name}</span> does not. Their name is read out at
              the memorial, first among the others.
            </div>
          ))}
          <div className="text-ink-faint">
            Of the ship's company, {pools.security + pools.crew} of 24 come home
            {casualties.generics > 0
              ? `; ${casualties.generics} ${casualties.generics === 1 ? 'does' : 'do'} not.`
              : '.'}
          </div>
        </div>
        <VoyageEpilogue />
        <TruthReveal />
        <button
          onClick={() => restart(`${seed}-again`, length)}
          className="border-amber-dim text-amber hover:bg-amber-dim/15 border px-3 py-1.5 text-[11px]"
        >
          Another galaxy
        </button>
      </div>
    </div>
  )
}

/** Out of fuel, out of options, out here. The long silence. */
function StrandedEnding() {
  const restart = useGame((s) => s.restart)
  const seed = useGame((s) => s.state.seed)
  const length = useGame((s) => voyageLengthOf(s.state.galaxy))
  const at = useGame((s) => s.state.ship.at)
  const name = useGame((s) => s.state.galaxy.systems.find((x) => x.id === at)?.name ?? at)

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/90 px-6">
      <div className="panel border-rule max-w-lg px-6 py-5">
        <div className="label mb-2">The long silence</div>
        <h2 className="text-ink-dim mb-3 text-[18px]">The tank is dry at {name}.</h2>
        <p className="text-ink-dim mb-4 text-[12px] leading-relaxed">
          Nothing the tank can reach holds fuel — no giant to scoop, no wreck to drain — and
          not enough remains for the rift. The plot on the board may even be right — someone
          should check it, someday, whoever finds the log. The ship keeps its orbit. The orbit
          keeps its ship.
        </p>
        <TheCost />
        <VoyageEpilogue />
        <TruthReveal />
        <button
          onClick={() => restart(`${seed}-again`, length)}
          className="border-rule text-ink-dim hover:border-amber-dim hover:text-amber border px-3 py-1.5 text-[11px]"
        >
          Another galaxy
        </button>
      </div>
    </div>
  )
}

/** Lost with all hands. The shortest entry in any registry. */
function DestroyedEnding() {
  const restart = useGame((s) => s.restart)
  const seed = useGame((s) => s.state.seed)
  const length = useGame((s) => voyageLengthOf(s.state.galaxy))

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/90 px-6">
      <div className="panel border-alarm-dim max-w-lg px-6 py-5">
        <div className="label mb-2">No further entries</div>
        <h2 className="text-alarm mb-3 text-[18px]">Lost with all hands.</h2>
        <p className="text-ink-dim mb-4 text-[12px] leading-relaxed">
          The <em>Indefatigable</em> comes apart a very long way from anywhere she was built to
          be. The plot on the Nav board — the accounts, the trust so carefully placed and
          withheld — burns with everything else. Whatever the answer was, it stays out here.
        </p>
        <TheCost />
        <VoyageEpilogue />
        <TruthReveal />
        <button
          onClick={() => restart(`${seed}-again`, length)}
          className="border-alarm-dim text-alarm hover:bg-alarm-dim/15 border px-3 py-1.5 text-[11px]"
        >
          Another ship, another galaxy
        </button>
      </div>
    </div>
  )
}

/** The captain led from the front once too often. */
function LostEnding() {
  const restart = useGame((s) => s.restart)
  const seed = useGame((s) => s.state.seed)
  const length = useGame((s) => voyageLengthOf(s.state.galaxy))

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/90 px-6">
      <div className="panel border-alarm-dim max-w-lg px-6 py-5">
        <div className="label mb-2">Final entry — hand unknown</div>
        <h2 className="text-alarm mb-3 text-[18px]">The captain did not come back.</h2>
        <p className="text-ink-dim mb-4 text-[12px] leading-relaxed">
          The ship is still out here. The evidence is still on the plot, and somebody else is
          reading it now. Whatever happens to the {' '}
          <em>Indefatigable</em> next, it happens without you.
        </p>
        <TheCost />
        <VoyageEpilogue />
        <TruthReveal />
        <button
          onClick={() => restart(`${seed}-again`, length)}
          className="border-alarm-dim text-alarm hover:bg-alarm-dim/15 border px-3 py-1.5 text-[11px]"
        >
          Another captain, another galaxy
        </button>
      </div>
    </div>
  )
}
