import { useMemo, useState } from 'react'
import { needsDecoding } from '../engine/missions/sites.js'
import { describeConstraint } from '../engine/mystery/constraints.js'
import { profileFor } from '../engine/mystery/prose.js'
import type { ClueSourceKind, PlayerClue } from '../engine/mystery/types.js'
import { useDispatch, useGalaxyIndex, useGame, useNavPlot } from './store.js'

/**
 * The lab, made honest. The sample queue is the artefacts the away teams
 * actually brought back — inscriptions, log cores, signal loops — and the
 * deep analysis button is the engine's decode action: it takes the science
 * officer a day, and what it yields is the clue's real prose and constraint,
 * ready to be weighed on the Nav Plot. No invented specimens, no fake scan
 * percentages: an empty bench says so.
 */

const FORM_TAGS: Partial<Record<ClueSourceKind, string>> = {
  'ruins-tablet': 'INSCRIPTION',
  'derelict-log': 'LOG CORE',
  'listening-post': 'SIGNAL LOOP',
}

export function LabScreen() {
  const dispatch = useDispatch()
  const roster = useGame((s) => s.state.roster)
  const index = useGalaxyIndex()
  const science = roster.find((officer) => officer.role === 'science')
  const { clues, undecoded, canDecode } = useNavPlot()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // The bench holds every artefact recovered so far: sealed ones first,
  // because they are the ones the lab still owes the Nav Plot.
  const artefacts = useMemo(() => {
    const held = clues.filter((clue) => needsDecoding(clue.source.kind))
    return [...held].sort(
      (a, b) => Number(undecoded.has(b.id)) - Number(undecoded.has(a.id)),
    )
  }, [clues, undecoded])

  const current =
    artefacts.find((clue) => clue.id === selectedId) ??
    artefacts.find((clue) => undecoded.has(clue.id)) ??
    artefacts[0] ??
    null
  const sealed = current !== null && undecoded.has(current.id)

  return (
    <div className="lab-screen relative h-full overflow-hidden">
      <div className="lab-art" aria-hidden="true" />
      <div className="lab-overlay" aria-hidden="true" />

      <header className="lab-title">
        <div className="eyebrow">Science deck · containment laboratory 03</div>
        <h2>Research & Analysis</h2>
        <p>Artefacts come back sealed. Until they are read, they say nothing about the way home.</p>
      </header>

      <aside className="lab-samples panel-glass">
        <div className="panel-heading">
          <span>Recovered artefacts</span>
          <span>{artefacts.length === 0 ? 'none' : `${artefacts.length} held`}</span>
        </div>
        {artefacts.length === 0 && (
          <div className="lab-empty">
            The bench is clear. Artefacts recovered without a science officer on the ground
            arrive here sealed — everything readable is already on the Nav Plot.
          </div>
        )}
        {artefacts.map((clue, i) => (
          <button
            key={clue.id}
            className={`sample-card ${current?.id === clue.id ? 'is-active' : ''}`}
            onClick={() => setSelectedId(clue.id)}
          >
            <span className="sample-index">{String(i + 1).padStart(2, '0')}</span>
            <span>
              <small>{FORM_TAGS[clue.source.kind] ?? 'ARTEFACT'}</small>
              <strong>{profileFor(clue.source.kind).label} {clue.id}</strong>
              <em>{index.system(clue.source.at).name}</em>
            </span>
            <span className={`sample-state ${undecoded.has(clue.id) ? 'state-encrypted' : 'state-cleared'}`}>
              {undecoded.has(clue.id) ? 'SEALED' : 'DECODED'}
            </span>
          </button>
        ))}
        <div className="sample-footer">
          {clues.length - [...undecoded].length} readable {clues.length - [...undecoded].length === 1 ? 'account' : 'accounts'} on the Nav Plot
        </div>
      </aside>

      {current ? (
        <ArtefactAnalysis
          clue={current}
          sealed={sealed}
          canDecode={canDecode}
          onDecode={() => dispatch({ type: 'decode', clue: current.id })}
        />
      ) : (
        <section className="lab-analysis panel-glass">
          <div className="analysis-heading">
            <div><span>STANDBY</span><h3>No sample under analysis</h3></div>
            <span className="containment-state">CONTAINMENT IDLE</span>
          </div>
          <p className="lab-idle">
            Away teams that go down without the science officer bring their finds here.
            Anything they recover with {science?.name ?? 'a science officer'} on the ground
            is read on site and goes straight to the plot.
          </p>
        </section>
      )}

      <aside className="science-officer panel-glass">
        <div className="panel-heading"><span>Officer on station</span><span>{science?.status ?? 'vacant'}</span></div>
        <div className="officer-profile">
          <span className="officer-portrait">
            {science?.portrait ? (
              <img src={science.portrait} alt="" />
            ) : (
              science?.name.split(' ').map((part) => part[0]).join('').slice(0, 2) ?? '—'
            )}
          </span>
          <span><strong>{science?.name ?? 'Science station vacant'}</strong><small>Chief science officer · skill {science?.skill ?? 0}</small></span>
        </div>
        {canDecode ? (
          <p>“Give me a day with a sealed one and it will talk, Captain. They always talk.”</p>
        ) : (
          <p className="officer-warning">
            No fit science officer aboard. Sealed artefacts stay dark until there is one.
          </p>
        )}
        <dl>
          <div><dt>Sealed artefacts</dt><dd>{[...undecoded].length}</dd></div>
          <div><dt>Accounts held</dt><dd>{clues.length}</dd></div>
          <div><dt>Decode time</dt><dd>1 day each</dd></div>
        </dl>
      </aside>
    </div>
  )
}

function ArtefactAnalysis({
  clue,
  sealed,
  canDecode,
  onDecode,
}: {
  clue: PlayerClue
  sealed: boolean
  canDecode: boolean
  onDecode: () => void
}) {
  const index = useGalaxyIndex()
  const profile = profileFor(clue.source.kind)

  return (
    <section className="lab-analysis panel-glass">
      <div className="analysis-heading">
        <div>
          <span>{FORM_TAGS[clue.source.kind] ?? 'ARTEFACT'}</span>
          <h3>{profile.label} {clue.id}</h3>
        </div>
        <span className="containment-state">{sealed ? 'CONTENTS SEALED' : 'ANALYSIS COMPLETE'}</span>
      </div>

      <div className="spectrograph" aria-hidden="true">
        {Array.from({ length: 36 }, (_, i) => (
          <i
            key={i}
            style={{
              height: `${sealed ? 10 + ((i * 13) % 24) : 18 + ((i * 37 + clue.id.length * 17) % 74)}%`,
              animationDelay: `${i * -0.06}s`,
            }}
          />
        ))}
        <span className="graph-axis axis-y">ENERGY</span>
        <span className="graph-axis axis-x">FREQUENCY</span>
      </div>

      <div className="analysis-grid">
        <LabMetric label="Origin" value={index.system(clue.source.at).name} tone="cyan" />
        <LabMetric label="Form" value={profile.label} />
        <LabMetric label="Status" value={sealed ? 'SEALED' : 'DECODED'} tone={sealed ? 'red' : 'cyan'} />
        <LabMetric
          label="Source reliability"
          value={sealed ? 'UNKNOWN' : `${Math.round(clue.confidence * 100)}%`}
          tone="amber"
        />
      </div>

      {sealed ? (
        <p className="lab-log">
          <span>SCI/{clue.id}</span>
          Recovered from {index.system(clue.source.at).name}. Whatever it says about the way
          home, nobody aboard has read it yet.
        </p>
      ) : (
        <div className="lab-reading">
          <p className="lab-prose">“{clue.prose}”</p>
          <p className="lab-constraint">
            Reads as: <strong>{describeConstraint(clue.constraint, index)}</strong>
            <span> · {clue.source.attribution}</span>
          </p>
        </div>
      )}

      {sealed ? (
        <>
          <button className="primary-action" disabled={!canDecode} onClick={onDecode}>
            Run deep analysis — 1 day <span>›</span>
          </button>
          {!canDecode && (
            <p className="lab-blocked">Needs a fit science officer at the bench.</p>
          )}
        </>
      ) : (
        <button
          className="primary-action"
          onClick={() => window.dispatchEvent(new CustomEvent('starship:navigate', { detail: 'galaxy' }))}
        >
          Weigh it on the Nav Plot <span>›</span>
        </button>
      )}
    </section>
  )
}

function LabMetric({ label, value, tone = 'muted' }: { label: string; value: string; tone?: 'red' | 'cyan' | 'amber' | 'muted' }) {
  return <div className={`lab-metric tone-${tone}`}><span>{label}</span><strong>{value}</strong></div>
}
