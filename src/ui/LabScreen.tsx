import { useMemo, useState } from 'react'
import { useDispatch, useGame, useNavPlot } from './store.js'

const SAMPLE_TYPES = ['XENO-BIO', 'MINERAL', 'ARCHIVE'] as const

export function LabScreen() {
  const dispatch = useDispatch()
  const roster = useGame((s) => s.state.roster)
  const undecoded = useGame((s) => s.state.undecoded)
  const searched = useGame((s) => s.state.searched)
  const science = roster.find((officer) => officer.role === 'science')
  const { clues, canDecode } = useNavPlot()
  const [active, setActive] = useState(0)
  const [scan, setScan] = useState(68)
  const [log, setLog] = useState('Spectrographic baseline stable. Unknown tissue continues to metabolise.')

  const samples = useMemo(() => {
    const names = ['Specimen K-41', 'Rift Glass 7A', 'Recovered Log Core']
    return names.map((name, index) => ({
      name,
      type: SAMPLE_TYPES[index]!,
      state: index === 0 ? 'ACTIVE' : index === 1 ? 'QUEUED' : undecoded.length > 0 ? 'ENCRYPTED' : 'CLEARED',
      source: searched[index] ? `Site ${searched[index]!.slice(-4).toUpperCase()}` : ['Khepri ruins', 'Anomaly wake', 'Derelict hulk'][index],
      completion: index === active ? scan : [41, undecoded.length > 0 ? 12 : 100][index - 1] ?? 0,
    }))
  }, [active, scan, searched, undecoded.length])

  const current = samples[active]!

  const advance = () => {
    setScan((value) => Math.min(100, value + 8))
    setLog(scan >= 92 ? 'Analysis complete. Pattern added to the navigation evidence matrix.' : 'Deep scan advanced. Additional harmonic structure isolated.')
    if (scan >= 92 && undecoded[0] && canDecode) dispatch({ type: 'decode', clue: undecoded[0] })
  }

  return (
    <div className="lab-screen relative h-full overflow-hidden">
      <div className="lab-art" aria-hidden="true" />
      <div className="lab-overlay" aria-hidden="true" />

      <header className="lab-title">
        <div className="eyebrow">Science deck · containment laboratory 03</div>
        <h2>Research & Analysis</h2>
        <p>Recovered phenomena are dangerous until they are understood.</p>
      </header>

      <aside className="lab-samples panel-glass">
        <div className="panel-heading"><span>Sample queue</span><span>{samples.length} objects</span></div>
        {samples.map((sample, index) => (
          <button key={sample.name} className={`sample-card ${active === index ? 'is-active' : ''}`} onClick={() => { setActive(index); setScan(sample.completion) }}>
            <span className="sample-index">0{index + 1}</span>
            <span><small>{sample.type}</small><strong>{sample.name}</strong><em>{sample.source}</em></span>
            <span className={`sample-state state-${sample.state.toLowerCase()}`}>{sample.state}</span>
          </button>
        ))}
        <div className="sample-footer">{clues.length} field accounts in evidence matrix</div>
      </aside>

      <section className="lab-analysis panel-glass">
        <div className="analysis-heading">
          <div><span>{current.type}</span><h3>{current.name}</h3></div>
          <span className="containment-state">CONTAINMENT STABLE</span>
        </div>

        <div className="spectrograph" aria-label="Live analysis spectrum">
          {Array.from({ length: 36 }, (_, index) => (
            <i key={index} style={{ height: `${18 + ((index * 37 + active * 17) % 74)}%`, animationDelay: `${index * -0.06}s` }} />
          ))}
          <span className="graph-axis axis-y">ENERGY</span>
          <span className="graph-axis axis-x">FREQUENCY</span>
        </div>

        <div className="analysis-grid">
          <LabMetric label="Biohazard" value={active === 0 ? 'CLASS IV' : 'NONE'} tone={active === 0 ? 'red' : 'cyan'} />
          <LabMetric label="Age estimate" value={active === 1 ? '3.2 MY' : 'UNKNOWN'} />
          <LabMetric label="Rift resonance" value={`${(7.1 + active * 3.8).toFixed(1)} THz`} tone="amber" />
          <LabMetric label="Integrity" value={`${Math.max(47, 94 - active * 19)}%`} tone="cyan" />
        </div>

        <div className="scan-progress">
          <span><strong>Deep analysis</strong><small>{scan}% complete</small></span>
          <div><i style={{ width: `${scan}%` }} /></div>
        </div>

        <p className="lab-log"><span>SCI/{String(active + 1).padStart(3, '0')}</span>{log}</p>

        <button className="primary-action" disabled={!canDecode || scan >= 100} onClick={advance}>
          {scan >= 100 ? 'Analysis complete' : 'Advance deep scan'} <span>›</span>
        </button>
      </section>

      <aside className="science-officer panel-glass">
        <div className="panel-heading"><span>Officer on station</span><span>{science?.status ?? 'vacant'}</span></div>
        <div className="officer-profile">
          <span className="officer-portrait">{science?.name.split(' ').map((part) => part[0]).join('').slice(0, 2) ?? '—'}</span>
          <span><strong>{science?.name ?? 'Science station vacant'}</strong><small>Chief science officer · skill {science?.skill ?? 0}</small></span>
        </div>
        <p>“The sample is responding to observation. That is not a metaphor, Captain.”</p>
        <dl>
          <div><dt>Containment</dt><dd>Nominal</dd></div>
          <div><dt>Lab power</dt><dd>86%</dd></div>
          <div><dt>Unread artefacts</dt><dd>{undecoded.length}</dd></div>
        </dl>
      </aside>
    </div>
  )
}

function LabMetric({ label, value, tone = 'muted' }: { label: string; value: string; tone?: 'red' | 'cyan' | 'amber' | 'muted' }) {
  return <div className={`lab-metric tone-${tone}`}><span>{label}</span><strong>{value}</strong></div>
}
