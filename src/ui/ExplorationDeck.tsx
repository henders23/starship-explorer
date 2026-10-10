import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  actionLock, reduceCampaign, SENSOR_PROJECTS, travelCost,
} from '../engine/exploration/campaign.js'
import type { Campaign, CampaignAction, SensorProject } from '../engine/exploration/campaign.js'
import { locationsAt } from '../engine/exploration/v2.js'
import type { LocationKind } from '../engine/exploration/v2.js'
import { REGION_NAMES, STAR_NAMES } from '../engine/worldgen/types.js'
import { saveExploration } from './exploration-save.js'
import './exploration.css'

const LABELS: Record<LocationKind, string> = {
  station: 'Orbital station', world: 'Planetary survey', ruins: 'Buried installation', derelict: 'Derelict vessel',
  'resource-field': 'Resource field', anomaly: 'Spatial anomaly', outpost: 'Alien outpost', signal: 'Unidentified signal',
}
const SCENES: Record<LocationKind, string> = {
  station: 'The docking lights answer in sequence. A station tender guides us to an outer berth. The exchange will accept recovered alloys; the yard can replenish fuel and repair the hull.',
  world: 'River systems cross the night side like silver threads. We can map the atmosphere and send instruments down without disturbing the surface. There is time to do this carefully.',
  ruins: 'The structures are almost buried, but their geometry is deliberate. A narrow shaft still radiates heat. Remote instruments can reconstruct the machinery before anyone goes near it.',
  derelict: 'The hull is cold; one compartment still has power. Something inside has kept working long after the crew left. We can catalogue it with probes, or bring it aboard quickly.',
  'resource-field': 'Metal-rich fragments drift through a narrow orbital band. We can collect them with remote tugs, or take the shuttle in for a faster recovery.',
  anomaly: 'The instruments disagree about the distance to the same point in space. We should take measurements from several positions before approaching the field.',
  outpost: 'A small settlement responds with a repeating pattern of light. We can keep our distance and record the exchange, or approach to deliver a survey package.',
  signal: 'The transmission repeats, but its timing follows the rotation of a nearby object. A patient observation should tell us whether it is a beacon, an instrument, or a call for help.',
}
const DISCOVERY_NAMES = { 'exotic-energy': 'Exotic energy', 'spatial-observation': 'Spatial observations', 'alien-propulsion': 'Alien propulsion' }

type Tab = 'system' | 'galaxy' | 'lab' | 'archive'
export function ExplorationDeck({ initial, onExit }: { initial: Campaign; onExit: () => void }) {
  const [state, setState] = useState(initial)
  const [tab, setTab] = useState<Tab>('system')
  const [selectedSystem, setSelectedSystem] = useState(initial.at)
  const [selectedSite, setSelectedSite] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [saved, setSaved] = useState(true)
  const detailRef = useRef<HTMLElement>(null)
  useEffect(() => {
    if (selectedSite && window.matchMedia('(max-width: 640px)').matches)
      detailRef.current?.scrollIntoView({ block: 'start' })
  }, [selectedSite])
  useEffect(() => {
    try { setSaved(saveExploration(state, window.localStorage)) } catch { setSaved(false) }
  }, [state])
  const dispatch = (action: CampaignAction) => {
    setState((current) => reduceCampaign(current, action))
    if (action.type === 'travel') { setSelectedSite(null); setTab('system') }
  }
  const here = state.galaxy.systems.find((system) => system.id === state.at)!
  const target = state.galaxy.systems.find((system) => system.id === selectedSystem)!
  const known = locationsAt(state.world, state.at).filter((site) => state.exploration.statuses[site.id])
  const site = known.find((location) => location.id === selectedSite)
  const active = state.research.active
  const neighbourIds = state.galaxy.adjacency[state.at]!
  const scienceComplete = state.research.completed.includes('deep-survey')
  const command = (action: CampaignAction, children: ReactNode, primary = false) => {
    const lock = actionLock(state, action)
    return <button className={primary ? 'exp-button primary' : 'exp-button'} disabled={!!lock}
      title={lock ?? undefined} onClick={() => dispatch(action)}>{children}</button>
  }

  return <main className="exp-deck">
    <header className="exp-header">
      <div><span className="exp-eyebrow">ISS ITHACA / EXPLORATION PREVIEW</span><h1>Beyond the familiar</h1></div>
      <div className="exp-resources" aria-label="Ship resources">
        <span>DAY <b data-testid="exp-day">{state.day}</b></span>
        <span>FUEL <b data-testid="exp-fuel">{state.fuel}/80</b></span>
        <span>HULL <b>{state.hull}%</b></span>
        <span>MATERIALS <b data-testid="exp-materials">{state.exploration.materials}</b></span>
        <span>CREDITS <b>{state.exploration.credits}</b></span>
      </div>
      <button className="exp-button" onClick={onExit}>Title screen</button>
    </header>
    <nav className="exp-nav" aria-label="Exploration stations">
      {(['system', 'galaxy', 'lab', 'archive'] as Tab[]).map((item, i) => <button key={item}
        aria-current={tab === item ? 'page' : undefined} onClick={() => setTab(item)}>
        <span>0{i + 1}</span>{ { system: 'Current system', galaxy: 'Galaxy chart', lab: 'Research lab', archive: 'Discoveries' }[item] }
      </button>)}
      <span className="exp-save" role="status">{saved ? 'Voyage saved' : 'Autosave unavailable — keep this tab open'}</span>
    </nav>
    <div className="exp-workspace">
      <aside className="exp-rail">
        <span className="exp-eyebrow">CAPTAIN’S NEXT STEP</span>
        <h2>{state.findings.length === 0 ? 'Follow the quiet signal' : !state.deepArray ? scienceComplete ? 'Fit the survey array' : 'Learn to see further' : 'Return to the unexplored'}</h2>
        <p>{state.findings.length === 0 ? 'Survey this system. Investigate the Silent Courier, then recover its scientific sample.'
          : !state.deepArray ? scienceComplete ? 'The research is complete. Open the laboratory and install the array for 20 materials and 65 credits.' : 'Research Planetary Spectrometry, then the Deep Survey Array. Fit the array to reveal deeper sites.'
          : 'Deep-scan familiar systems or follow a new jump lane. Unfinished locations remain where you left them.'}</p>
        <button className="exp-button" onClick={() => setTab('lab')}>Open research lab</button>
        <div className="exp-rule" />
        <span className="exp-eyebrow">NEIGHBOURING SYSTEMS</span>
        <div className="exp-neighbours">
          {neighbourIds.map((id) => {
            const system = state.galaxy.systems.find((s) => s.id === id)!
            return <button key={id} onClick={() => { setSelectedSystem(id); setTab('galaxy') }}>
              <span>{system.name}<small>{REGION_NAMES[system.region]}{state.visited.includes(id) ? ' · visited' : ''}</small></span>
              <b>{travelCost(state, id)}<small>fuel</small></b>
            </button>
          })}
        </div>
        {!actionLock(state, { type: 'emergency-fuel' }) && <div className="exp-notice">
          <p>No jump is affordable. Collect trace hydrogen to reach another system.</p>
          {command({ type: 'emergency-fuel' }, 'Emergency fuel · 3 days')}
        </div>}
        <div className="exp-preview-note">Playable now: exploration, services and two sensor projects. Ground combat, full diplomacy and the Return Drive are still in development.</div>
      </aside>
      <section className="exp-main">
        {tab === 'system' && <>
          <div className="exp-system-hero">
            <div className="exp-orbit" aria-hidden="true"><div /></div>
            <span className="exp-eyebrow">{REGION_NAMES[here.region]} / {here.faction ? state.galaxy.factions.find((f) => f.id === here.faction)?.name : 'Unclaimed space'}</span>
            <h2>{here.name}</h2><p>Orbiting {STAR_NAMES[here.star]}.<br />{known.length} known {known.length === 1 ? 'contact' : 'contacts'} · {state.scans[state.at] ? `${state.scans[state.at]} scan complete` : 'passive sensors only'}</p>
            <div className="exp-actions">
              {command({ type: 'scan', tier: 'survey' }, 'Survey system · 1 day', true)}
              {command({ type: 'scan', tier: 'deep' }, 'Deep scan · 1 day')}
            </div>
            {!state.deepArray && <small>Deep scans require a researched and installed survey array.</small>}
          </div>
          <div className="exp-section-heading"><h3>Places to investigate</h3><span>Leave and return at any time</span></div>
          <div className="exp-locations">
            {known.length === 0 && <p className="exp-empty">Passive sensors found no contacts. Run a system survey to search further.</p>}
            {known.map((location) => <button key={location.id} data-testid={`location-${location.kind}`}
              className={`exp-location ${site?.id === location.id ? 'selected' : ''}`} onClick={() => setSelectedSite(location.id)}>
              <span className={`exp-site-icon ${location.kind}`} aria-hidden="true">{location.kind === 'station' ? '◇' : location.kind === 'world' ? '◉' : '⌁'}</span>
              <span><small>{LABELS[location.kind]}</small><strong>{location.name}</strong>
                <span className="exp-site-status">{state.exploration.statuses[location.id]}{location.services.length ? ' · station services' : ''}
                  {state.research.completed.includes('spectrometry') && location.discovery ? ` · ${DISCOVERY_NAMES[location.discovery]}` : ''}</span></span>
              <span className={`exp-threat threat-${location.threat}`}>{['LOW', 'GUARDED', 'HAZARDOUS', 'EXTREME'][location.threat]}</span>
            </button>)}
          </div>
        </>}
        {tab === 'galaxy' && <>
          <div className="exp-section-heading"><div><span className="exp-eyebrow">NAVIGATION</span><h2>Galaxy chart</h2></div>
            <label className="exp-search">Find system<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name or region" /></label></div>
          <GalaxyChart state={state} selected={selectedSystem} onSelect={setSelectedSystem} />
          <p className="exp-chart-key"><span>◆ Ithaca</span> <span>● Visited</span> <span>○ Unvisited</span> Select a system to inspect its route.</p>
          <div className="exp-chart-list">
            {[...state.galaxy.systems].sort((a, b) => Number(!neighbourIds.includes(a.id)) - Number(!neighbourIds.includes(b.id))).filter((s) => `${s.name} ${REGION_NAMES[s.region]}`.toLowerCase().includes(query.toLowerCase())).map((system) =>
              <button key={system.id} className={selectedSystem === system.id ? 'selected' : ''} onClick={() => setSelectedSystem(system.id)}>
                <strong>{system.name}</strong><small>{neighbourIds.includes(system.id) ? `${travelCost(state, system.id)} fuel · one jump` : REGION_NAMES[system.region]}{state.visited.includes(system.id) ? ' · visited' : ''}</small>
              </button>)}
          </div>
        </>}
        {tab === 'lab' && <>
          <div className="exp-lab-hero"><span className="exp-eyebrow">SCIENCE DIVISION</span><h2>Make discovery useful.</h2><p>Research advances while you travel, investigate and use station services. Switching projects preserves all work.</p></div>
          <div className="exp-projects">{(Object.keys(SENSOR_PROJECTS) as SensorProject[]).map((id) => {
            const project = SENSOR_PROJECTS[id]
            const progress = state.research.progress[id]
            const complete = state.research.completed.includes(id)
            return <article className="exp-project" key={id}>
              <span className="exp-eyebrow">SENSORS / {complete ? 'COMPLETE' : active === id ? 'IN PROGRESS' : actionLock(state, { type: 'research', project: id }) ? 'LOCKED' : 'AVAILABLE PROJECT'}</span>
              <h3>{project.name}</h3><p>{project.effect}</p>
              <progress value={progress} max={project.days} aria-label={`${project.name} progress`} />
              <div className="exp-project-meta"><span>{progress} / {project.days} research days</span><span>{project.days - progress} remaining</span></div>
              {id === 'deep-survey' && <p className="exp-prerequisite">Requires Planetary Spectrometry and one scientific discovery. Installation: 20 materials + 65 credits.</p>}
              {command({ type: 'research', project: id }, complete ? 'Research complete' : active === id ? 'Researching as you explore' : progress ? 'Resume research' : 'Begin research', true)}
              {actionLock(state, { type: 'research', project: id }) && !complete && active !== id && <small>{actionLock(state, { type: 'research', project: id })}</small>}
              {id === 'deep-survey' && complete && command({ type: 'install-array' }, state.deepArray ? 'Array installed' : 'Install array · 20 materials + 65 credits')}
            </article>
          })}</div>
          <div className="exp-notice">This preview includes the sensor progression loop. The six-branch research tree and Return Drive sequence are the next campaign milestone.</div>
        </>}
        {tab === 'archive' && <>
          <div className="exp-section-heading"><div><span className="exp-eyebrow">SCIENCE ARCHIVE</span><h2>What we brought back</h2></div><span>{state.findings.length} distinct sources</span></div>
          <p>Each source is kept separately. Multiple observations of the same phenomenon can support later research.</p>
          {state.findings.length === 0 && <div className="exp-empty">No discoveries recovered yet. Start with the Silent Courier in your arrival system.</div>}
          {state.findings.map((finding) => {
            const location = state.world.locations.find((s) => s.id === finding.locationId)!
            return <article className="exp-finding" key={finding.locationId}><span className="exp-eyebrow">RECOVERED / DAY {finding.day}</span>
              <h3>{DISCOVERY_NAMES[finding.kind]}</h3><p>{location.name}</p>
              <button className="exp-button" onClick={() => { setSelectedSystem(location.systemId); setTab('galaxy') }}>Locate source on chart</button>
            </article>
          })}
        </>}
      </section>
      <aside className="exp-detail" ref={detailRef}>
        {tab === 'system' && (site ? <>
          <span className="exp-eyebrow">{LABELS[site.kind]} / {state.exploration.statuses[site.id]}</span>
          <h2>{site.name}</h2>
          <div className="exp-officer"><img src="/assets/portraits/26_helen_morozova.png" alt="Helen Morozova" /><span>Helen Morozova<small>Science officer</small></span></div>
          <p>{state.exploration.statuses[site.id] === 'detected' ? 'We have a fix on the location. Investigate it to establish contact, assess the conditions and identify what can be recovered.' : site.name === 'The Silent Courier' ? 'Its crew shut down everything except the power cell. That cell has kept a tiny navigation beacon alive for decades. If we map its emissions, we can calibrate our sensors to recognise similar technology.' : SCENES[site.kind]}</p>
          {state.exploration.statuses[site.id] === 'detected' ? command({ type: 'investigate', locationId: site.id }, site.kind === 'station' ? 'Establish contact · 1 day' : 'Investigate · 1 day', true) : <>
            {site.services.length > 0 ? <div className="exp-service-list"><h3>Station services</h3>
              {command({ type: 'service', locationId: site.id, service: 'refuel' }, 'Refuel +20 · 10 credits · 1 day')}
              {command({ type: 'service', locationId: site.id, service: 'repair' }, 'Repair +20 · 5 materials + 10 credits · 1 day')}
              {command({ type: 'service', locationId: site.id, service: 'sell' }, 'Sell 4 materials · receive 12 credits · 1 day')}
              <small>Services remain available after you leave.</small>
            </div> : state.exploration.statuses[site.id] === 'resolved' ? <div className="exp-notice">Expedition complete. All findings and resources are aboard; they cannot be collected twice.</div> : <>
              <div className="exp-reward"><span className="exp-eyebrow">EXPECTED RECOVERY</span><p>{site.reward ? `${site.reward.materials} materials · ${site.reward.credits} credits` : 'A completed survey'}{site.discovery ? ` · ${DISCOVERY_NAMES[site.discovery]}` : ''}</p></div>
              {command({ type: 'recover', locationId: site.id, approach: 'careful' }, 'Remote investigation · 2 days · no damage', true)}
              {command({ type: 'recover', locationId: site.id, approach: 'rapid' }, `Rapid expedition · 1 day · ${site.threat * 4} hull damage`)}
              <p className="exp-prerequisite">Both approaches recover the same findings. Remote instruments take longer; a rapid retrieval exposes the ship to local hazards.</p>
            </>}
          </>}
          <button className="exp-text-button" onClick={() => setSelectedSite(null)}>Leave this location</button>
        </> : <><span className="exp-eyebrow">SYSTEM OPERATIONS</span><h2>A place worth stopping.</h2><p>Select a contact to investigate it. A survey reveals quieter signals; a deep scan can uncover places your current instruments miss.</p><p>Locations persist when you travel. There is no countdown forcing you to leave.</p></>)}
        {tab === 'galaxy' && <><span className="exp-eyebrow">SELECTED DESTINATION</span><h2>{target.name}</h2><p>{REGION_NAMES[target.region]} · {STAR_NAMES[target.star]}</p>
          <p>{target.faction ? `Claimed by ${state.galaxy.factions.find((f) => f.id === target.faction)?.name}.` : 'No registered faction claim.'}</p>
          <p>{state.visited.includes(target.id) ? `${locationsAt(state.world, target.id).filter((s) => state.exploration.statuses[s.id]).length} known locations. Your progress here is preserved.` : 'Unvisited. Local opportunities will appear on arrival and after scanning.'}</p>
          {target.id === state.at ? <div className="exp-notice">The Ithaca is here.</div> : <>
            {command({ type: 'travel', systemId: target.id }, `Travel${travelCost(state, target.id) !== null ? ` · ${travelCost(state, target.id)} fuel · 1 day` : ''}`, true)}
            {actionLock(state, { type: 'travel', systemId: target.id }) && <p>{actionLock(state, { type: 'travel', systemId: target.id })}. Use the neighbouring systems list to plan your next hop.</p>}
          </>}
        </>}
        {(tab === 'lab' || tab === 'archive') && <><span className="exp-eyebrow">LABORATORY STATUS</span><h2>{active ? SENSOR_PROJECTS[active].name : scienceComplete ? state.deepArray ? 'Survey array online.' : 'Ready for installation.' : 'Ready for a new question.'}</h2><p>{active ? `${SENSOR_PROJECTS[active].days - state.research.progress[active]} research days remain. Keep exploring while the laboratory works.` : scienceComplete ? state.deepArray ? 'Return to the system view and deep-scan for new contacts.' : 'Fit the researched array to unlock deep scans.' : 'Assign a project, then return to the system or galaxy chart.'}</p><p>Recovered science is knowledge, not a spendable currency. Installation uses materials and credits.</p></>}
        <div className="exp-rule" /><span className="exp-eyebrow">VOYAGE RECORD</span><p>{state.visited.length} systems visited<br />{state.findings.length} {state.findings.length === 1 ? 'discovery' : 'discoveries'} recovered<br />{state.research.completed.length} projects completed</p>
      </aside>
    </div>
    <footer className="exp-log" aria-live="polite"><span>CAPTAIN’S LOG</span><p>{state.log.at(-1)}</p>
      <details><summary>Earlier entries</summary><ol>{state.log.slice(0, -1).reverse().map((line, i) => <li key={i}>{line}</li>)}</ol></details>
    </footer>
  </main>
}

function GalaxyChart({ state, selected, onSelect }: { state: Campaign; selected: string; onSelect: (id: string) => void }) {
  const systems = state.galaxy.systems
  const minX = Math.min(...systems.map((s) => s.x)), maxX = Math.max(...systems.map((s) => s.x))
  const minY = Math.min(...systems.map((s) => s.y)), maxY = Math.max(...systems.map((s) => s.y))
  const point = (id: string) => {
    const s = systems.find((system) => system.id === id)!
    return { x: 35 + (s.x - minX) / (maxX - minX) * 830, y: 45 + (s.y - minY) / (maxY - minY) * 350 }
  }
  return <svg className="exp-map" viewBox="0 0 900 440" aria-label="Exploration galaxy map">
    {state.galaxy.lanes.map(([a, b]) => { const p = point(a), q = point(b); return <line key={`${a}-${b}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y} className={a === state.at || b === state.at ? 'adjacent' : ''} /> })}
    {systems.map((s) => {
      const p = point(s.id), current = s.id === state.at, chosen = s.id === selected
      return <g key={s.id} role="button" tabIndex={0} aria-label={`Select ${s.name}`} onClick={() => onSelect(s.id)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(s.id) } }}>
        <circle cx={p.x} cy={p.y} r={14} fill="transparent" />
        <circle cx={p.x} cy={p.y} r={current ? 7 : 4} className={current ? 'current' : state.visited.includes(s.id) ? 'visited' : 'unvisited'} />
        {chosen && <circle cx={p.x} cy={p.y} r={12} className="selected-ring" />}
        {(current || chosen) && <text x={p.x} y={p.y - 20} textAnchor={p.x < 100 ? 'start' : p.x > 800 ? 'end' : 'middle'}>{current ? 'ITHACA · ' : ''}{s.name}</text>}
      </g>
    })}
  </svg>
}
