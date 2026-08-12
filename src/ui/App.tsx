import { useState } from 'react'
import { EvidenceBoard } from './EvidenceBoard.js'
import { Inspector } from './Inspector.js'
import { StarMap } from './StarMap.js'
import { useDispatch, useGalaxyIndex, useGame, useNavPlot } from './store.js'

export function App() {
  const outcome = useGame((s) => s.state.outcome)

  return (
    <div className="crt flex h-full flex-col">
      <Header />
      <div className="flex min-h-0 flex-1">
        <main className="border-rule min-w-0 flex-1 border-r">
          <StarMap />
        </main>
        <aside className="flex w-[380px] shrink-0 flex-col overflow-hidden">
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
      <CaptainsLog />
      {outcome === 'home' && <Ending />}
    </div>
  )
}

function Header() {
  const restart = useGame((s) => s.restart)
  const seed = useGame((s) => s.state.seed)
  const jumps = useGame((s) => s.state.jumps)
  const [draft, setDraft] = useState(seed)

  return (
    <header className="border-rule flex shrink-0 items-center justify-between gap-4 border-b px-4 py-2">
      <div className="flex items-baseline gap-3">
        <h1 className="text-amber text-[13px] tracking-[0.2em] uppercase">Nav Plot</h1>
        <span className="text-ink-faint text-[10px]">Starship Explorer</span>
      </div>

      <div className="flex items-center gap-3">
        {jumps.length > 0 && (
          <span className="text-alarm-dim text-[10px]">
            {jumps.length} failed {jumps.length === 1 ? 'attempt' : 'attempts'}
          </span>
        )}
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            restart(draft.trim() || 'voyager')
          }}
        >
          <label className="label" htmlFor="seed">
            Galaxy
          </label>
          <input
            id="seed"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="border-rule text-ink-dim focus:border-amber-dim w-32 border bg-transparent px-2 py-0.5 text-[11px] outline-none"
          />
          <button
            type="submit"
            className="border-rule text-ink-faint hover:border-amber-dim hover:text-amber border px-2 py-0.5 text-[10px]"
          >
            Generate
          </button>
        </form>
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
  const { clues } = useNavPlot()
  const failed = jumps.filter((j) => !j.correct).length

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/85 px-6">
      <div className="panel max-w-lg px-6 py-5">
        <div className="label mb-2">Charted space</div>
        <h2 className="text-phosphor mb-3 text-[18px]">We are going home.</h2>
        <p className="text-ink-dim mb-4 text-[12px] leading-relaxed">
          You found it with {clues.length} accounts in hand
          {failed > 0
            ? ` and ${failed} wasted ${failed === 1 ? 'attempt' : 'attempts'} behind you.`
            : ' and no wasted attempts.'}{' '}
          In the finished game this is where the epilogue names the crew, one by one, and says
          what became of each of them.
        </p>
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
