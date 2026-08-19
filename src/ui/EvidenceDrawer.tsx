import { describeConstraint } from '../engine/mystery/constraints.js'
import { countCandidatesForAll } from '../engine/mystery/deduce.js'
import type { ClueState, PlayerClue } from '../engine/mystery/types.js'
import { profileFor } from '../engine/mystery/prose.js'
import { commsTier, requiredTier } from '../engine/research/tech.js'
import { fileClue, useDispatch, useGalaxyIndex, useGame, useNavPlot } from './store.js'

/**
 * The evidence drawer.
 *
 * It rises over the foot of the chart when the captain asks for it and gets
 * out of the way again: the accounts are read *against* the sky, so the sky
 * stays visible while they are read.
 *
 * The one rule this screen obeys: there is no progress bar. The candidate
 * count is the progress bar, and it is allowed to go *up* when the player
 * doubts something. Showing "7 of 12 clues found" would turn a deduction into
 * a shopping list.
 */
export function EvidenceDrawer({ onClose }: { onClose: () => void }) {
  const { clues, trusted, contradictions, conflicted, corroborated, impossible, undecoded, canDecode } =
    useNavPlot()

  return (
    <div className="evidence-drawer" role="region" aria-label="Evidence">
      <div className="drawer-head">
        <span className="label">
          Evidence · {clues.length} {clues.length === 1 ? 'account' : 'accounts'} ·{' '}
          {trusted.length} trusted
        </span>
        <span className="flex items-center gap-3.5">
          {contradictions.length > 0 && (
            <span className="text-alarm text-[10px] tracking-[0.12em] uppercase">
              {contradictions.length}{' '}
              {contradictions.length === 1 ? 'contradiction' : 'contradictions'}
            </span>
          )}
          <button onClick={onClose} className="drawer-close">Close</button>
        </span>
      </div>

      {clues.length === 0 ? (
        <div className="drawer-empty">
          No accounts of the anomaly yet.{' '}
          <span className="text-ink-dim">Search a ringed star on the chart.</span>
        </div>
      ) : (
        <div className="drawer-body">
          {/* Pinned. When the plot collapses, the explanation of *why* must not
              be somewhere the player has to go looking for it. */}
          {(impossible || contradictions.length > 0) && (
            <div className="drawer-conflicts">
              {impossible && (
                <div className="border-alarm-dim bg-alarm-dim/10 text-alarm mb-2 border px-3 py-1.5 text-[11px]">
                  <strong className="tracking-wide">Nothing fits.</strong> At least one account you
                  trust is false.
                </div>
              )}
              {contradictions.length > 0 && (
                <Conflicts
                  contradictions={contradictions}
                  clues={clues}
                  corroborated={corroborated}
                />
              )}
            </div>
          )}

          <div className="drawer-cards">
            {clues.map((clue) =>
              undecoded.has(clue.id) ? (
                <UndecodedCard key={clue.id} clue={clue} canDecode={canDecode} />
              ) : (
                <ClueCard
                  key={clue.id}
                  clue={clue}
                  conflicted={conflicted.has(clue.id)}
                  corroborated={corroborated.has(clue.id)}
                />
              ),
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Conflicts, with each account's reliability shown beside it.
 *
 * Listing bare clue ids was actively misleading: one honest account that
 * contradicts three separate lies appears in every conflict, so the obvious
 * "the common factor is the liar" reading points straight at the truth and
 * lands the player on the decoy. The tally is the wrong signal and the game
 * should not present it alone — the reliability of the source is the right
 * one, so it belongs here, next to the comparison being made.
 */
function Conflicts({
  contradictions,
  clues,
  corroborated,
}: {
  contradictions: Array<{ clues: string[] }>
  clues: PlayerClue[]
  corroborated: Set<string>
}) {
  const byId = new Map(clues.map((c) => [c.id, c]))

  // Smallest conflicts first: a pair that cannot coexist names two suspects,
  // where a trio only narrows it to three.
  const ordered = [...contradictions].sort((a, b) => a.clues.length - b.clues.length)
  const shown = ordered.slice(0, 4)
  const hidden = ordered.length - shown.length

  return (
    <div>
      <div className="label mb-1.5">Contradictions — these cannot all be true</div>
      <div className="flex flex-col gap-1">
        {shown.map((conflict) => (
          <div key={conflict.clues.join('|')} className="flex flex-wrap items-center gap-x-1.5">
            {conflict.clues.map((id, i) => {
              const clue = byId.get(id)
              return (
                <span key={id} className="flex items-center gap-1">
                  {i > 0 && <span className="text-ink-faint mr-1">×</span>}
                  <span className="text-alarm text-[11px]">{id}</span>
                  <span className="text-ink-faint text-[10px]">
                    {clue ? `${Math.round(clue.confidence * 100)}%` : ''}
                  </span>
                  {corroborated.has(id) && (
                    <span className="text-phosphor text-[10px]" title="Independently corroborated">
                      ✓
                    </span>
                  )}
                </span>
              )
            })}
          </div>
        ))}
        {hidden > 0 && (
          <div className="text-ink-faint text-[10px]">
            and {hidden} further {hidden === 1 ? 'conflict' : 'conflicts'} among these accounts
          </div>
        )}
      </div>
      <div className="text-ink-faint mt-2 text-[10px] leading-relaxed">
        Weigh how reliable each source is rather than counting them up. One honest witness
        contradicts every liar it meets, so the star named most often here is often the true one.
      </div>
    </div>
  )
}

/**
 * An artefact brought back without a science officer on the ground. The
 * player holds it, and cannot read it: no constraint, no prose, no filing.
 * This card is the visible cost of an empty science chair.
 */
function UndecodedCard({ clue, canDecode }: { clue: PlayerClue; canDecode: boolean }) {
  const index = useGalaxyIndex()
  const dispatch = useDispatch()
  const tierHeld = useGame((s) => commsTier(s.state))
  const site = index.system(clue.source.at)
  const tierNeeded = requiredTier(clue.source.kind)
  const untranslated = tierNeeded > tierHeld

  return (
    <div className="clue-card border-l-amber-dim opacity-80">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-amber-dim text-[12px]">
          {untranslated ? 'Untranslated account' : 'Undecoded artefact'}
        </span>
        <span className="text-ink-faint shrink-0 text-[10px]">{clue.id}</span>
      </div>
      <p className="text-ink-dim mb-2 text-[11px] leading-relaxed italic">
        Recovered from {site.name}. Whatever it says about the way home, nobody aboard has
        read it yet.
      </p>
      {untranslated ? (
        <div className="text-alarm-dim text-[10px]">
          The script defeats the ship's matrix — needs Translation Matrix{' '}
          {tierNeeded === 2 ? 'II' : 'I'} on the research bench.
        </div>
      ) : canDecode ? (
        <button
          onClick={() => dispatch({ type: 'decode', clue: clue.id })}
          className="border-amber-dim text-amber hover:bg-amber-dim/15 border px-2 py-0.5 text-[10px]"
        >
          Put the science officer on it
        </button>
      ) : (
        <div className="text-alarm-dim text-[10px]">
          No fit science officer aboard. It stays dark until there is one.
        </div>
      )}
    </div>
  )
}

function ClueCard({
  clue,
  conflicted,
  corroborated,
}: {
  clue: PlayerClue
  conflicted: boolean
  corroborated: boolean
}) {
  const index = useGalaxyIndex()
  const dispatch = useDispatch()
  const site = index.system(clue.source.at)
  const admits = countCandidatesForAll([clue], index)

  const border = conflicted
    ? 'border-l-alarm'
    : clue.state === 'trusted'
      ? 'border-l-phosphor'
      : clue.state === 'doubted'
        ? 'border-l-ink-faint'
        : 'border-l-transparent'

  return (
    <div className={`clue-card ${border} ${clue.state === 'doubted' ? 'opacity-45' : ''}`}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-amber text-[12px]">{describeConstraint(clue.constraint, index)}</span>
        <span className="text-ink-faint shrink-0 text-[10px]">{clue.id}</span>
      </div>

      <p className="text-ink-dim mb-2 text-[11px] leading-relaxed italic">{clue.prose}</p>

      <div className="text-ink-faint mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
        <span>{profileFor(clue.source.kind).label}</span>
        <span>{site.name}</span>
        <Confidence value={clue.confidence} />
        <span>rules out {index.systems.length - admits}</span>
        {corroborated && (
          <span className="text-phosphor" title="A second, independent source says the same thing">
            corroborated
          </span>
        )}
      </div>

      <div className="flex gap-1.5">
        <FileButton clue={clue} target="trusted" label="Trust" />
        <FileButton clue={clue} target="doubted" label="Doubt" />
        {clue.state !== 'unfiled' && (
          <button
            onClick={() => dispatch(fileClue(clue.id, 'unfiled'))}
            className="text-ink-faint hover:text-ink-dim px-2 py-0.5 text-[10px]"
          >
            Set aside
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Confidence is shown because a source's reputation is real information — but
 * it is deliberately not decisive. Archives are usually honest and brokers
 * usually are not, and both are sometimes the opposite.
 */
function Confidence({ value }: { value: number }) {
  const filled = Math.round(value * 5)
  return (
    <span title={`Source reliability ${(value * 100).toFixed(0)}%`} className="tracking-widest">
      <span className="text-amber-dim">{'▮'.repeat(filled)}</span>
      <span className="text-ink-faint/50">{'▮'.repeat(5 - filled)}</span>
    </span>
  )
}

function FileButton({
  clue,
  target,
  label,
}: {
  clue: PlayerClue
  target: ClueState
  label: string
}) {
  const dispatch = useDispatch()
  const active = clue.state === target
  const tone =
    target === 'trusted'
      ? active
        ? 'border-phosphor text-phosphor'
        : 'border-rule text-ink-faint hover:border-phosphor-dim hover:text-phosphor-dim'
      : active
        ? 'border-ink-dim text-ink-dim'
        : 'border-rule text-ink-faint hover:border-ink-dim hover:text-ink-dim'

  return (
    <button onClick={() => dispatch(fileClue(clue.id, target))} className={`border px-2 py-0.5 text-[10px] ${tone}`}>
      {label}
    </button>
  )
}
