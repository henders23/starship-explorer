import { useMemo, useState } from 'react'
import { needsDecoding } from '../engine/missions/sites.js'
import { describeConstraint } from '../engine/mystery/constraints.js'
import { profileFor } from '../engine/mystery/prose.js'
import type { ClueSourceKind, PlayerClue } from '../engine/mystery/types.js'
import { PARTS_NEEDED } from '../engine/research/parts.js'
import {
  canResearch,
  commsTier,
  requiredTier,
  TECH_BY_ID,
  TECH_TREE,
  type TechNode,
} from '../engine/research/tech.js'
import { useDispatch, useGalaxyIndex, useGame, useNavPlot } from './store.js'

/**
 * The research bench: the artefact queue on the left, the sample under
 * analysis in the middle, and the research track on the right — projects
 * pitched in the science officer's own voice, ticking down in the
 * background as the calendar runs.
 */

const FORM_TAGS: Partial<Record<ClueSourceKind, string>> = {
  'ruins-tablet': 'INSCRIPTION',
  'derelict-log': 'LOG CORE',
  'listening-post': 'SIGNAL LOOP',
  'alien-trader': 'PIDGIN LEDGER',
}

const TIER_NAMES = ['', 'Translation Matrix I', 'Translation Matrix II']

export function LabScreen() {
  const dispatch = useDispatch()
  const roster = useGame((s) => s.state.roster)
  const state = useGame((s) => s.state)
  const index = useGalaxyIndex()
  const science = roster.find((officer) => officer.role === 'science')
  const { clues, undecoded, canDecode } = useNavPlot()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // The bench holds every clue that ever needed working: artefact forms and
  // anything the translation matrix has not caught up with. Sealed first.
  const artefacts = useMemo(() => {
    const held = clues.filter(
      (clue) => needsDecoding(clue.source.kind) || requiredTier(clue.source.kind) > 0,
    )
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
        <div className="eyebrow">Science deck · research bench</div>
        <h2>Research & Analysis</h2>
        <p>What the ship cannot read, it cannot use. The bench turns time into understanding.</p>
      </header>

      <aside className="lab-samples panel-glass">
        <div className="panel-heading">
          <span>Held for analysis</span>
          <span>{artefacts.length === 0 ? 'none' : `${artefacts.length} items`}</span>
        </div>
        {artefacts.length === 0 && (
          <div className="lab-empty">
            The bench is clear. Artefacts and untranslated accounts arrive here; everything
            readable is already on the Nav Plot.
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
            Away teams that go down without the science officer bring their finds here, and so
            does anything the translation matrix cannot yet read.
          </p>
        </section>
      )}

      <aside className="science-officer panel-glass">
        <div className="panel-heading"><span>Research track</span><span>{science?.status ?? 'vacant'}</span></div>
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

        {state.tech.active ? (
          <div className="research-active">
            <div className="research-heading">
              <strong>{TECH_BY_ID[state.tech.active.id]!.name}</strong>
              <span>{state.tech.active.daysLeft}d left</span>
            </div>
            <div className="research-bar">
              <i
                style={{
                  width: `${Math.round(
                    (1 - state.tech.active.daysLeft / TECH_BY_ID[state.tech.active.id]!.days) * 100,
                  )}%`,
                }}
              />
            </div>
            {science?.status !== 'fit' && (
              <p className="lab-blocked">Paused — the science officer is not fit to work it.</p>
            )}
          </div>
        ) : (
          <p className="research-idle">The bench is between projects. {science ? 'Proposals below.' : ''}</p>
        )}

        <div className="research-list">
          {TECH_TREE.map((node) => (
            <ResearchCard
              key={node.id}
              node={node}
              researched={state.tech.researched.includes(node.id)}
              available={canResearch(state, node.id)}
              active={state.tech.active?.id === node.id}
              partsHeld={node.component ? state.parts[node.component] : 0}
              onStart={() => dispatch({ type: 'startResearch', tech: node.id })}
            />
          ))}
        </div>
      </aside>
    </div>
  )
}

function ResearchCard({
  node,
  researched,
  available,
  active,
  partsHeld,
  onStart,
}: {
  node: TechNode
  researched: boolean
  available: boolean
  active: boolean
  partsHeld: number
  onStart: () => void
}) {
  const [open, setOpen] = useState(false)
  const partsGated = node.component !== undefined && partsHeld < PARTS_NEEDED[node.component]
  const status = researched
    ? 'DONE'
    : active
      ? 'ACTIVE'
      : partsGated
        ? `PARTS ${partsHeld}/${PARTS_NEEDED[node.component!]}`
        : available
          ? `${node.days}D`
          : 'GATED'

  return (
    <div className={`research-card ${researched ? 'is-done' : ''} ${partsGated ? 'is-locked' : ''}`}>
      <button className="research-row" onClick={() => setOpen((v) => !v)}>
        <strong>{node.name}</strong>
        <span className={`research-status status-${partsGated ? 'locked' : status.toLowerCase()}`}>{status}</span>
      </button>
      {open && (
        <div className="research-detail">
          <p className="research-pitch">{node.pitch}</p>
          <p className="research-effect">{node.effect}</p>
          {available && !active && (
            <button className="primary-action" onClick={onStart}>
              Put the bench on it — {node.days} days <span>›</span>
            </button>
          )}
          {!available && !researched && !active && (
            <p className="lab-blocked">
              {partsGated
                ? `Locked — ${partsHeld} of ${PARTS_NEEDED[node.component!]} components recovered. The trail will provide.`
                : `Requires ${node.requires.map((r) => TECH_BY_ID[r]!.name).join(', ')}.`}
            </p>
          )}
        </div>
      )}
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
  const state = useGame((s) => s.state)
  const dispatch = useDispatch()
  const profile = profileFor(clue.source.kind)
  const tierNeeded = requiredTier(clue.source.kind)
  const tierHeld = commsTier(state)
  const tierBlocked = sealed && tierNeeded > tierHeld
  const nextMatrix = tierBlocked ? (['comms-1', 'comms-2'] as const)[tierHeld] : null

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
        <LabMetric
          label="Language"
          value={tierNeeded === 0 ? 'FAMILIAR' : TIER_NAMES[tierNeeded]!.toUpperCase()}
          tone={tierBlocked ? 'red' : 'muted'}
        />
        <LabMetric
          label="Source reliability"
          value={sealed ? 'UNKNOWN' : `${Math.round(clue.confidence * 100)}%`}
          tone="amber"
        />
      </div>

      {sealed ? (
        <p className="lab-log">
          <span>SCI/{clue.id}</span>
          {tierBlocked
            ? `Recovered from ${index.system(clue.source.at).name}. The script defeats the current matrix — whatever it says, the ship cannot read it yet.`
            : `Recovered from ${index.system(clue.source.at).name}. Whatever it says about the way home, nobody aboard has read it yet.`}
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
        tierBlocked ? (
          <>
            {nextMatrix && canResearch(state, nextMatrix) ? (
              <button
                className="primary-action"
                onClick={() => dispatch({ type: 'startResearch', tech: nextMatrix })}
              >
                Needs {TIER_NAMES[tierHeld + 1]} — put the bench on it <span>›</span>
              </button>
            ) : (
              <p className="lab-blocked">
                Needs {TIER_NAMES[tierNeeded]}
                {state.tech.active !== null && state.tech.active.id === nextMatrix
                  ? ` — in progress, ${state.tech.active.daysLeft}d left.`
                  : '.'}
              </p>
            )}
          </>
        ) : (
          <>
            <button className="primary-action" disabled={!canDecode} onClick={onDecode}>
              Run deep analysis — 1 day <span>›</span>
            </button>
            {!canDecode && (
              <p className="lab-blocked">Needs a fit science officer at the bench.</p>
            )}
          </>
        )
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
