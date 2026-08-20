import { PARTS_NEEDED } from '../engine/research/parts.js'
import { TECH_BY_ID } from '../engine/research/tech.js'
import { useDispatch, useGalaxyIndex, useGame, useNavPlot } from './store.js'

/**
 * The plot bar: one strip along the foot of the chart carrying the state of
 * the deduction rather than the state of any one star. Everything about a
 * selected system now lives in the inspector docked to the right, so this is
 * only the score — how many stars are still standing, how far the way home
 * has been built, and the way in to the accounts that decide both.
 */
export function PlotBar({
  evidenceOpen,
  onToggleEvidence,
}: {
  evidenceOpen: boolean
  onToggleEvidence: () => void
}) {
  const index = useGalaxyIndex()
  const dispatch = useDispatch()
  const selected = useGame((s) => s.state.selected)
  const { candidates, trusted, impossible, clues } = useNavPlot()

  return (
    <div className="plot-bar">
      <div className="plot-cell plot-count">
        <span className="plot-label">Still standing</span>
        <span className={impossible ? 'plot-figure is-alarm' : 'plot-figure'}>
          {impossible ? 'none' : candidates.length}
        </span>
      </div>

      <div className="plot-cell plot-shortlist">
        {impossible ? (
          <span className="plot-note is-alarm">
            No star fits. Something you trust is false — doubt an account on the evidence drawer.
          </span>
        ) : trusted.length === 0 ? (
          <span className="plot-note">
            Trust an account on the evidence drawer to begin narrowing the field.
          </span>
        ) : (
          <div className="candidate-chips">
            {candidates.map((id) => (
              <button
                key={id}
                onClick={() => dispatch({ type: 'select', system: id })}
                className={`candidate-chip ${selected === id ? 'is-on' : ''}`}
              >
                {index.system(id).name}
              </button>
            ))}
          </div>
        )}
      </div>

      <TrackStatus />

      <button
        onClick={onToggleEvidence}
        className={`plot-evidence ${evidenceOpen ? 'is-open' : ''}`}
        aria-expanded={evidenceOpen}
      >
        {evidenceOpen
          ? 'Hide evidence'
          : `Evidence · ${clues.length} ${clues.length === 1 ? 'account' : 'accounts'}`}
      </button>
    </div>
  )
}

/**
 * The technological gate, on one line. The full itemisation lives on the
 * research bench; here it is only a reminder that a heading is not enough.
 */
function TrackStatus() {
  const state = useGame((s) => s.state)

  const stage = (id: 'rift-drive' | 'rift-shield') => {
    const node = TECH_BY_ID[id]!
    const kind = node.component!
    if (state.tech.researched.includes(id)) return 'built'
    if (state.tech.active?.id === id) return `${state.tech.active.daysLeft}d`
    if (state.parts[kind] >= PARTS_NEEDED[kind]) return 'ready'
    return `${state.parts[kind]}/${PARTS_NEEDED[kind]}`
  }

  return (
    <div
      className="plot-cell plot-gate"
      title="The way home takes three things: the rift drive, the rift shielding, and a heading you trust."
    >
      <span className="plot-label">Way home</span>
      <span>
        drive <b>{stage('rift-drive')}</b> · shield <b>{stage('rift-shield')}</b> · heading{' '}
        <b>the plot</b>
      </span>
    </div>
  )
}
