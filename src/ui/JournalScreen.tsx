import { encounterDef } from '../engine/encounters/catalog.js'
import { friendsOfTheShip, openThreads } from '../engine/encounters/journal.js'
import { useGame } from './store.js'

/**
 * The journal: the full captain's log, and the score the log cannot keep —
 * open threads, standing friendships, and the appointments the galaxy
 * intends to keep. Opened from the log footer; closes back to the game.
 */

const KIND_TONES: Record<string, string> = {
  arrival: 'text-phosphor',
  travel: 'text-ink-faint',
  evidence: 'text-amber',
  mission: 'text-amber',
  crew: 'text-ink-dim',
  bridge: 'text-phosphor-dim',
  surge: 'text-alarm',
  filing: 'text-ink-faint',
  contradiction: 'text-alarm-dim',
  jump: 'text-amber',
  encounter: 'text-phosphor',
  combat: 'text-alarm-dim',
  research: 'text-phosphor-dim',
  ending: 'text-alarm',
}

export function JournalScreen({ onClose }: { onClose: () => void }) {
  const state = useGame((s) => s.state)
  const threads = openThreads(state)
  const friends = friendsOfTheShip(state)
  const leads = [...state.pending].sort((a, b) => a.notBefore - b.notBefore)

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/80 px-8 py-8">
      <div className="panel-glass flex h-full w-full max-w-5xl min-h-0 flex-col px-6 py-5">
        <div className="mb-3 flex shrink-0 items-baseline justify-between">
          <div>
            <div className="eyebrow">Ship’s records · day {state.day}</div>
            <h2 className="text-ink text-[16px] tracking-wide">The Captain’s Journal</h2>
          </div>
          <button
            onClick={onClose}
            className="border-rule text-ink-dim hover:border-amber-dim hover:text-amber border px-3 py-1 text-[11px]"
          >
            Close
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[1.4fr_1fr] gap-5">
          <section className="flex min-h-0 flex-col">
            <div className="label border-rule mb-2 shrink-0 border-b pb-1">Log — newest first</div>
            <div className="encounter-prose flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-2">
              {[...state.log].reverse().map((entry) => (
                <div key={entry.id} className="flex gap-3 text-[11px] leading-relaxed">
                  <span className="text-ink-faint shrink-0">{String(entry.id).padStart(3, '0')}</span>
                  <span className={`shrink-0 text-[9px] uppercase ${KIND_TONES[entry.kind] ?? 'text-ink-faint'}`}>
                    {entry.kind}
                  </span>
                  <span className="text-ink-dim">{entry.text}</span>
                </div>
              ))}
            </div>
          </section>

          <div className="flex min-h-0 flex-col gap-4 overflow-y-auto pr-1">
            <section>
              <div className="label border-rule mb-2 border-b pb-1">Open threads</div>
              {threads.length === 0 ? (
                <p className="text-ink-faint text-[11px]">Nothing unfinished. It will not last.</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {threads.map((text) => (
                    <p key={text} className="text-ink-dim text-[11px] leading-relaxed">
                      <span className="text-amber mr-1.5">◈</span>
                      {text}
                    </p>
                  ))}
                </div>
              )}
            </section>

            <section>
              <div className="label border-rule mb-2 border-b pb-1">Expected</div>
              {leads.length === 0 ? (
                <p className="text-ink-faint text-[11px]">No appointments the galaxy has told you about.</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {leads.map((p) => {
                    const due = p.notBefore - state.day
                    return (
                      <div key={p.id} className="flex items-baseline justify-between gap-2 text-[11px]">
                        <span className="text-ink-dim">{encounterDef(p.id)?.title ?? p.id}</span>
                        <span className="text-ink-faint shrink-0 text-[10px]">
                          {due <= 0 ? 'imminent' : `~${due}d`}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            <section>
              <div className="label border-rule mb-2 border-b pb-1">Friends of the ship</div>
              {friends.length === 0 ? (
                <p className="text-ink-faint text-[11px]">The ship has made no friends yet. The galaxy is watching how you fly.</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {friends.map((text) => (
                    <p key={text} className="text-ink-dim text-[11px] leading-relaxed">
                      <span className="text-phosphor mr-1.5">✓</span>
                      {text}
                    </p>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
