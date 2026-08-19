import { useEffect, useRef, useState } from 'react'
import { BriefingScreen } from './BriefingScreen.js'
import { EvidenceBoard } from './EvidenceBoard.js'
import { Inspector } from './Inspector.js'
import { LabScreen } from './LabScreen.js'
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
  { id: 'lab', label: 'Lab', code: '04' },
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

  // The ship's ambience runs aboard ship — the briefing on the bridge and the
  // cutaway both count. Playback must begin inside the "Take command" click —
  // browsers refuse audio that was never sanctioned by a user gesture.
  const begin = () => {
    const ambient = ambientRef.current ?? new Audio('/assets/audio/ship-ambient.mp3')
    ambientRef.current = ambient
    ambient.loop = true
    ambient.volume = 0.15
    void ambient.play().catch(() => {})
    setPhase('briefing')
  }

  useEffect(() => {
    const ambient = ambientRef.current
    if (!ambient) return
    if (phase === 'briefing' || (phase === 'game' && screen === 'ship'))
      void ambient.play().catch(() => {})
    else ambient.pause()
  }, [phase, screen])

  if (phase === 'title') {
    return (
      <div className="crt app-shell h-full">
        <StartScreen onBegin={begin} />
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
      {outcome === 'home' && <Ending />}
      {outcome === 'lost' && <LostEnding />}
      {outcome === 'stranded' && <StrandedEnding />}
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

function FuelGauge() {
  const fuel = useGame((s) => s.state.ship.fuel)
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

function Ending() {
  const restart = useGame((s) => s.restart)
  const seed = useGame((s) => s.state.seed)
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
        <button
          onClick={() => restart(`${seed}-again`)}
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
  const at = useGame((s) => s.state.ship.at)
  const name = useGame((s) => s.state.galaxy.systems.find((x) => x.id === at)?.name ?? at)

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/90 px-6">
      <div className="panel border-rule max-w-lg px-6 py-5">
        <div className="label mb-2">The long silence</div>
        <h2 className="text-ink-dim mb-3 text-[18px]">The tank is dry at {name}.</h2>
        <p className="text-ink-dim mb-4 text-[12px] leading-relaxed">
          No lane the ship can afford, nothing here to scoop, and not enough left for the rift.
          The plot on the board may even be right — someone should check it, someday, whoever
          finds the log. The ship keeps its orbit. The orbit keeps its ship.
        </p>
        <button
          onClick={() => restart(`${seed}-again`)}
          className="border-rule text-ink-dim hover:border-amber-dim hover:text-amber border px-3 py-1.5 text-[11px]"
        >
          Another galaxy
        </button>
      </div>
    </div>
  )
}

/** The captain led from the front once too often. */
function LostEnding() {
  const restart = useGame((s) => s.restart)
  const seed = useGame((s) => s.state.seed)

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
        <button
          onClick={() => restart(`${seed}-again`)}
          className="border-alarm-dim text-alarm hover:bg-alarm-dim/15 border px-3 py-1.5 text-[11px]"
        >
          Another captain, another galaxy
        </button>
      </div>
    </div>
  )
}
