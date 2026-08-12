import { useState } from 'react'
import { sitePlan } from '../engine/state/reducer.js'
import { FEATURE_NAMES, REGION_NAMES, STAR_NAMES } from '../engine/worldgen/types.js'
import { MissionPanel } from './MissionPanel.js'
import { useDispatch, useGalaxyIndex, useGame, useNavPlot } from './store.js'

/**
 * The selected system: what the catalogue says about it, whether it survives
 * the plot, whether there is evidence to sweep, and the commit button.
 */
export function Inspector() {
  const index = useGalaxyIndex()
  const dispatch = useDispatch()
  const selectedId = useGame((s) => s.state.selected)
  const searched = useGame((s) => s.state.searched)
  const outcome = useGame((s) => s.state.outcome)
  const jumps = useGame((s) => s.state.jumps)
  const start = useGame((s) => s.state.galaxy.start)
  const gameState = useGame((s) => s.state)
  const { candidateSet, sites, trusted } = useNavPlot()
  const [confirming, setConfirming] = useState(false)
  const [planning, setPlanning] = useState(false)

  if (!selectedId) {
    return <div className="text-ink-faint px-4 py-6 text-[11px]">Select a star on the chart.</div>
  }

  const system = index.system(selectedId)
  const isCandidate = candidateSet.has(system.id)
  const hasEvidence = sites.has(system.id)
  const alreadyTried = jumps.some((j) => j.target === system.id)
  const { site } = sitePlan(gameState, system.id)

  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-amber text-[15px]">{system.name}</h2>
          {system.id === start && <span className="text-ink-faint text-[10px]">arrival point</span>}
        </div>
        <div className="text-ink-faint text-[10px]">{REGION_NAMES[system.region]}</div>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[11px]">
        <Row label="Star">{STAR_NAMES[system.star]}</Row>
        <Row label="Lanes">{index.degree(system.id)}</Row>
        <Row label="Distance">{index.jumps(start, system.id)} jumps from arrival</Row>
        <Row label="Claimed by">
          {system.faction ? index.factionName(system.faction) : 'nobody'}
        </Row>
        <Row label="Contains">
          {system.features.length === 0
            ? 'nothing of note'
            : system.features.map((f) => FEATURE_NAMES[f]).join(', ')}
        </Row>
      </dl>

      <div
        className={`border px-2 py-1 text-[11px] ${
          isCandidate ? 'border-phosphor-dim text-phosphor' : 'border-rule text-ink-faint'
        }`}
      >
        {trusted.length === 0
          ? 'No plot filed — every star is still possible.'
          : isCandidate
            ? 'Consistent with everything you trust.'
            : 'Ruled out by your plot.'}
      </div>

      {hasEvidence && site === null && (
        <button
          onClick={() => dispatch({ type: 'search', system: system.id })}
          className="border-amber-dim text-amber hover:bg-amber-dim/15 border px-3 py-1.5 text-[11px]"
        >
          Search this system
        </button>
      )}

      {hasEvidence && site !== null && (
        <button
          onClick={() => setPlanning(true)}
          className="border-alarm-dim text-amber hover:bg-amber-dim/15 border px-3 py-1.5 text-[11px]"
        >
          Send an away team — {site.label.toLowerCase()}
        </button>
      )}

      {planning && site !== null && (
        <MissionPanel system={system.id} site={site} onClose={() => setPlanning(false)} />
      )}

      {!hasEvidence && searched.includes(system.id) && (
        <div className="text-ink-faint text-[10px]">Already searched. Nothing further here.</div>
      )}

      {outcome === 'seeking' && (
        <LongJump
          name={system.name}
          isCandidate={isCandidate}
          alreadyTried={alreadyTried}
          confirming={confirming}
          setConfirming={setConfirming}
          onCommit={() => {
            dispatch({ type: 'plotTheJump', target: system.id })
            setConfirming(false)
          }}
        />
      )}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-ink-faint">{label}</dt>
      <dd className="text-ink-dim">{children}</dd>
    </>
  )
}

/**
 * The commit. Two-step by design: the whole game funnels into this button and
 * a misclick should never spend the reserve.
 */
function LongJump({
  name,
  isCandidate,
  alreadyTried,
  confirming,
  setConfirming,
  onCommit,
}: {
  name: string
  isCandidate: boolean
  alreadyTried: boolean
  confirming: boolean
  setConfirming: (v: boolean) => void
  onCommit: () => void
}) {
  if (alreadyTried) {
    return (
      <div className="border-alarm-dim text-alarm-dim border px-2 py-1 text-[10px]">
        Already attempted. The anomaly was not here.
      </div>
    )
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="border-rule text-ink-dim hover:border-amber-dim hover:text-amber border px-3 py-1.5 text-[11px]"
      >
        Plot the Long Jump to {name}
      </button>
    )
  }

  return (
    <div className="border-amber-dim border px-3 py-2">
      <p className="text-ink-dim mb-2 text-[11px] leading-relaxed">
        Committing burns the reserve and strains the drive. If you are wrong we are further out
        than we were, with less to look with.
        {!isCandidate && (
          <span className="text-alarm">
            {' '}
            Your own plot rules this star out.
          </span>
        )}
      </p>
      <div className="flex gap-2">
        <button
          onClick={onCommit}
          className="border-amber text-amber hover:bg-amber-dim/20 border px-3 py-1 text-[11px]"
        >
          Commit
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="border-rule text-ink-faint hover:text-ink-dim border px-3 py-1 text-[11px]"
        >
          Hold
        </button>
      </div>
    </div>
  )
}
