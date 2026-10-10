import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  actionLock, reduceCampaign, travelCost, fuelCapacity, hullCapacity, recoveryDamage, carefulDays, stationPrice, salePrice, hasTech, fitted, researchProgress, researchRate, researchRequirements,
} from '../engine/exploration/campaign.js'
import type { Campaign, CampaignAction } from '../engine/exploration/campaign.js'
import { locationsAt } from '../engine/exploration/v2.js'
import type { LocationKind } from '../engine/exploration/v2.js'
import { REGION_NAMES, STAR_NAMES } from '../engine/worldgen/types.js'
import { saveExploration } from './exploration-save.js'
import { DRIVE_SEQUENCE, PROJECTS } from '../engine/exploration/research.js'
import { ExplorationResearch, DriveTestScene, ReturnHomeScene, ExplorationEnding } from './ExplorationResearch.js'
import { AwayTeam, TacticalMission } from './TacticalMission.js'
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
  const [returnConfirm, setReturnConfirm] = useState(false)
  const [teamOpen, setTeamOpen] = useState(false)
  const [deploySite, setDeploySite] = useState<string | null>(null)
  const modalOpen = teamOpen || returnConfirm || state.driveTest === 'calibrating' || state.outcome === 'home'
  useEffect(() => {
    if (modalOpen) (document.querySelector('[role=dialog] button:not(:disabled)') as HTMLButtonElement | null)?.focus()
  }, [modalOpen, state.driveTest, state.outcome])
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
    if (action.type === 'return-home') setReturnConfirm(false)
    if (action.type === 'travel') { setSelectedSite(null); setTab('system') }
  }
  const here = state.galaxy.systems.find((system) => system.id === state.at)!
  const target = state.galaxy.systems.find((system) => system.id === selectedSystem)!
  const known = locationsAt(state.world, state.at).filter((site) => state.exploration.statuses[site.id])
  const site = known.find((location) => location.id === selectedSite)
  const active = state.research.active
  const neighbourIds = state.galaxy.adjacency[state.at]!
  const nextDrive = DRIVE_SEQUENCE.find((id) => !hasTech(state, id))
  const driveReady = state.built.includes('return-drive')
  const advice = driveReady ? 'Home when you are ready' : hasTech(state, 'prototype-drive') && state.driveTest !== 'complete' ? 'Test the way home' : nextDrive ? PROJECTS[nextDrive].name : 'Build the Return Drive'
  const adviceText = driveReady ? 'The final drive is fitted. Keep exploring, or choose Return home in the command bar.'
    : hasTech(state, 'prototype-drive') && state.driveTest !== 'complete' ? 'Construct the prototype in the lab, survey a system, then begin the field test.'
    : nextDrive ? state.research.active === nextDrive ? 'Research is underway. Survey nearby systems, investigate contacts or take station work while the laboratory progresses.' : `${researchRequirements(state, nextDrive) ?? 'Assign this project in the research lab'}. Research progresses while you explore and work at stations.`
    : 'Construct the final drive in the lab: 60 materials and 150 credits. Station survey contracts can replenish your stores.'
  const command = (action: CampaignAction, children: ReactNode, primary = false) => {
    const lock = actionLock(state, action)
    return <button className={primary ? 'exp-button primary' : 'exp-button'} disabled={!!lock}
      title={lock ?? undefined} onClick={() => dispatch(action)}>{children}</button>
  }

  if (state.mission) return <TacticalMission state={state} dispatch={dispatch} onExit={onExit} saved={saved} />
  return <main className="exp-deck" data-tab={tab}>
    <header className="exp-header" inert={modalOpen}>
      <div><span className="exp-eyebrow">ISS ITHACA / EXPLORATION PREVIEW</span><h1>Beyond the familiar</h1></div>
      <div className="exp-resources" aria-label="Ship resources">
        <span>DAY <b data-testid="exp-day">{state.day}</b></span>
        <span>FUEL <b data-testid="exp-fuel">{state.fuel}/{fuelCapacity(state)}</b></span>
        <span>HULL <b>{state.hull}/{hullCapacity(state)}</b></span>
        <span>MATERIALS <b data-testid="exp-materials">{state.exploration.materials}</b></span>
        <span>CREDITS <b>{state.exploration.credits}</b></span>
      </div>
      <button className="exp-button" onClick={() => { setDeploySite(null); setTeamOpen(true) }}>Away team</button>
      {driveReady && <button className="exp-button primary" onClick={() => setReturnConfirm(true)}>Return home</button>}
      <button className="exp-button" onClick={onExit}>Title screen</button>
    </header>
    <nav className="exp-nav" aria-label="Exploration stations" inert={modalOpen}>
      {(['system', 'galaxy', 'lab', 'archive'] as Tab[]).map((item, i) => <button key={item}
        aria-current={tab === item ? 'page' : undefined} onClick={() => setTab(item)}>
        <span>0{i + 1}</span>{ { system: 'Current system', galaxy: 'Galaxy chart', lab: 'Research lab', archive: 'Discoveries' }[item] }
      </button>)}
      <span className="exp-save" role="status">{saved ? 'Voyage saved' : 'Autosave unavailable — keep this tab open'}</span>
    </nav>
    <div className="exp-workspace" inert={modalOpen}>
      <aside className="exp-rail">
        <span className="exp-eyebrow">CAPTAIN’S NEXT STEP</span>
        <h2>{advice}</h2><p>{adviceText}</p>
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
        {fitted(state, 'fuel-recycling') && command({ type: 'recycle-fuel' }, 'Recycle fuel · 3 materials · 1 day')}
        <div className="exp-preview-note">Playable now: exploration, research, boarding missions, ship refits and the journey home. Ship combat integration and broader mission stories are still in development.</div>
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
              <span className={`exp-threat threat-${location.threat}`}>{hasTech(state, 'threat-analysis') ? `${recoveryDamage(state, location)} HULL RISK` : ['LOW', 'GUARDED', 'HAZARDOUS', 'EXTREME'][location.threat]}</span>
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
        {tab === 'lab' && <ExplorationResearch state={state} dispatch={dispatch} onShowSystem={(id) => { setSelectedSystem(id); setTab('galaxy') }} />}
        {tab === 'archive' && <>
          <div className="exp-section-heading"><div><span className="exp-eyebrow">SCIENCE ARCHIVE</span><h2>What we brought back</h2></div><span>{state.findings.length} distinct sources</span></div>
          <p>Each source is kept separately. Multiple observations of the same phenomenon can support later research.</p>
          {state.findings.length === 0 && <div className="exp-empty">No discoveries recovered yet. Start with the Silent Courier in your arrival system.</div>}
          {state.findings.map((finding) => {
            const location = state.world.locations.find((s) => s.id === finding.locationId)
            return <article className="exp-finding" key={finding.locationId}><span className="exp-eyebrow">RECOVERED / DAY {finding.day}</span>
              <h3>{DISCOVERY_NAMES[finding.kind]}</h3><p>{location?.name ?? finding.sourceName}</p>
              <button className="exp-button" onClick={() => { setSelectedSystem(location?.systemId ?? finding.systemId!); setTab('galaxy') }}>Locate source on chart</button>
            </article>
          })}
          {hasTech(state, 'relay-network') && <section className="exp-science-leads"><span className="exp-eyebrow">DIPLOMATIC RELAY NETWORK</span><h3>Known station archives</h3>
            {state.world.locations.filter((s) => s.kind === 'station' && ['investigated', 'resolved'].includes(state.exploration.statuses[s.id] ?? '')).map((station) => <article className="exp-finding" key={station.id}><h3>{station.name}</h3>
              {(['exotic-energy', 'spatial-observation', 'alien-propulsion'] as const).map((kind) => <div key={kind}>{command({ type: 'archive', locationId: station.id, kind }, `${DISCOVERY_NAMES[kind]} · 30 credits · 1 day`)}</div>)}
            </article>)}
          </section>}
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
              {command({ type: 'service', locationId: site.id, service: 'refuel' }, `Refuel +20 · ${stationPrice(state)} credits · 1 day`)}
              {command({ type: 'service', locationId: site.id, service: 'repair' }, `Repair +20 · 5 materials + ${stationPrice(state)} credits · 1 day`)}
              {command({ type: 'service', locationId: site.id, service: 'sell' }, `Sell 4 materials · receive ${salePrice(state)} credits · 1 day`)}
              {command({ type: 'service', locationId: site.id, service: 'buy' }, 'Buy 4 materials · 18 credits · 1 day')}
              {command({ type: 'service', locationId: site.id, service: 'contract' }, 'Survey contract · 3 days · earn 8 materials + 18 credits')}
              <small>Services remain available after you leave. Contracts provide renewable supplies.</small>
              {hasTech(state, 'contextual-translation') && <><h3>Scientific records</h3><small>A station supplies one independent spatial source. Seek a second station or an expedition for another.</small>
                {(['exotic-energy', 'spatial-observation', 'alien-propulsion'] as const).map((kind) => <div key={kind}>{command({ type: 'archive', locationId: site.id, kind }, `${DISCOVERY_NAMES[kind]} · 30 credits · 1 day`)}</div>)}
              </>}
            </div> : state.exploration.statuses[site.id] === 'resolved' ? <div className="exp-notice">Expedition complete. All findings and resources are aboard; they cannot be collected twice.</div> : <>
              <div className="exp-reward"><span className="exp-eyebrow">EXPECTED RECOVERY</span><p>{site.reward ? `${site.reward.materials} materials · ${site.reward.credits} credits` : 'A completed survey'}{site.discovery ? ` · ${DISCOVERY_NAMES[site.discovery]}` : ''}</p></div>
              {command({ type: 'recover', locationId: site.id, approach: 'careful' }, `Remote investigation · ${carefulDays(state)} ${carefulDays(state) === 1 ? 'day' : 'days'} · no damage`, true)}
              {command({ type: 'recover', locationId: site.id, approach: 'rapid' }, `Rapid expedition · 1 day · ${recoveryDamage(state, site)} hull damage`)}
              {['derelict', 'ruins'].includes(site.kind) && <><button className="exp-button" onClick={() => { setDeploySite(site.id); setTeamOpen(true) }}>Board with away team · tactical mission</button><small>Optional: recover the same cargo on foot. Two AP per operative; injuries and casualties persist. Remote investigation remains safe.</small></>}
              <p className="exp-prerequisite">Both approaches recover the same science. Remote instruments avoid damage; rapid retrieval uses any fitted engineering tools to recover additional materials from ruins and derelicts.</p>
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
        {(tab === 'lab' || tab === 'archive') && <><span className="exp-eyebrow">LABORATORY STATUS</span><h2>{active ? PROJECTS[active].name : 'Ready for a new question.'}</h2>
          <p>{active ? `${Math.ceil((PROJECTS[active].days - researchProgress(state, active)) / researchRate(state))} activity days remain. Keep exploring while the laboratory works.` : 'Assign a project or queue your next choices in the lab.'}</p>
          <p>Knowledge is never spent. Building hardware takes materials and credits; fitting it takes a free equipment slot.</p>
          <p>{state.research.queue.length} projects queued. {state.driveTest === 'complete' ? 'Prototype field test complete.' : 'A successful prototype test will unlock Drive Stabilisation.'}</p></>}
        <div className="exp-rule" /><span className="exp-eyebrow">VOYAGE RECORD</span><p>{state.visited.length} systems visited<br />{state.findings.length} {state.findings.length === 1 ? 'discovery' : 'discoveries'} recovered<br />{state.research.completed.length} projects completed</p>
      </aside>
    </div>
    <footer className="exp-log" aria-live="polite" inert={modalOpen}><span>CAPTAIN’S LOG</span><p>{state.log.at(-1)}</p>
      <details><summary>Earlier entries</summary><ol>{state.log.slice(0, -1).reverse().map((line, i) => <li key={i}>{line}</li>)}</ol></details>
    </footer>
    {teamOpen && <AwayTeam state={state} locationId={deploySite} dispatch={dispatch} onClose={() => setTeamOpen(false)} />}
    <DriveTestScene state={state} dispatch={dispatch} />
    {returnConfirm && state.outcome !== 'home' && <ReturnHomeScene state={state} dispatch={dispatch} onClose={() => setReturnConfirm(false)} />}
    {state.outcome === 'home' && <ExplorationEnding state={state} onExit={onExit} />}
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
