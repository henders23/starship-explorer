import { SurvivorObjective, SurvivorStation, SurvivorArchive } from './SurvivorVoyage.js'
import { ExplorationStory, LettersObjective } from './ExplorationStory.js'
import { LongRelayObjective, LongRelayStation, LongRelayArchive } from './LongRelay.js'
import { ExpeditionGalaxyChart } from './ExpeditionGalaxyChart.js'
import { storyAt } from '../engine/exploration/stories.js'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  actionLock, reduceCampaign, travelCost, fuelCapacity, hullCapacity, recoveryDamage, carefulDays, stationPrice, salePrice, hasTech, fitted,
  travelOrder, interceptionRisk, ORDNANCE_PRICE, MAGAZINE_CAPACITY,
} from '../engine/exploration/campaign.js'
import { REGIONAL_THREAT } from '../engine/exploration/v2.js'
import { courseFinder, followCourse } from '../engine/exploration/navigation.js'
import type { Course } from '../engine/exploration/navigation.js'
import type { Campaign, CampaignAction } from '../engine/exploration/campaign.js'
import { locationsAt } from '../engine/exploration/v2.js'
import type { ExplorationLocation, LocationKind } from '../engine/exploration/v2.js'
import { REGION_NAMES, STAR_NAMES } from '../engine/worldgen/types.js'
import type { SystemId } from '../engine/worldgen/types.js'
import { saveExploration } from './exploration-save.js'
import { browserStorage } from './save.js'
import { MuteButton } from './sound.js'
import { plural } from './plural.js'
import { DRIVE_SEQUENCE } from '../engine/exploration/research.js'
import { ExplorationResearch, DriveTestScene, ReturnHomeScene, ExplorationEnding } from './ExplorationResearch.js'
import { EscortOffer, ExplorationBattle } from './ExplorationBattle.js'
import { SignalScene } from './SignalScene.js'
import { AwayTeam, TacticalMission } from './TacticalMission.js'
import './exploration.css'
import './crew-presence.css'
import { CrewLine } from './crew-presence.js'
import { ReportImage } from './ReportImage.js'
import { ShipRooms, bridgeMessage } from './ShipRooms.js'
import type { RoomId } from './ShipRooms.js'

const LABELS: Record<LocationKind, string> = {
  station: 'Orbital station', world: 'Planetary survey', ruins: 'Buried installation', derelict: 'Derelict vessel',
  'resource-field': 'Resource field', anomaly: 'Spatial anomaly', outpost: 'Alien outpost', signal: 'Unidentified signal',
}
/** Full-bleed art for each kind of place. Kinds without their own art share the nebula. */
const SCENE_ART: Record<LocationKind, [string, string]> = {
  derelict: ['/assets/exploration/silent-courier.webp', 'Frost-lined corridor aboard an abandoned courier, with a navigation cell still glowing'],
  ruins: ['/assets/exploration/buried-observatory.webp', 'Ancient arches rise from copper dunes above a buried installation'],
  world: ['/assets/exploration/orbital-frontier.webp', 'Clouds and copper continents seen from orbit'],
  station: ['/assets/rooms/communications.png', 'The communications deck holds a channel open to the station'],
  'resource-field': ['/assets/galaxy/expedition-nebula.webp', 'Nebula light over a drifting field of metal-rich fragments'],
  anomaly: ['/assets/galaxy/expedition-nebula.webp', 'Nebula light bending around a spatial anomaly'],
  outpost: ['/assets/galaxy/expedition-nebula.webp', 'Nebula light over the outpost’s position'],
  signal: ['/assets/galaxy/expedition-nebula.webp', 'Nebula light over the source of an unidentified signal'],
}
const ICONS: Record<LocationKind, ReactNode> = {
  station: <path d="M12 3l9 9-9 9-9-9z" />,
  world: <><circle cx="12" cy="12" r="6" /><path d="M3 14c4 2 14 0 18-4" /></>,
  ruins: <path d="M4 20V11a4 4 0 0 1 8 0v9M12 20v-6a4 4 0 0 1 8 0v6M2 20h20" />,
  derelict: <path d="M2 12h4l3-6 5 12 3-6h5" />,
  'resource-field': <><circle cx="6" cy="8" r="1.6" /><circle cx="13" cy="6" r="1.2" /><circle cx="17" cy="12" r="2" /><circle cx="9" cy="15" r="2.2" /><circle cx="15" cy="18" r="1.2" /></>,
  anomaly: <path d="M12 12a2 2 0 1 1 2-2 4 4 0 1 1-4-4 6 6 0 1 1-6 6" />,
  outpost: <path d="M12 4l8 15H4z" />,
  signal: <path d="M12 13v8M8.5 9.5a5 5 0 0 1 7 0M5.5 6.5a9 9 0 0 1 13 0M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2" />,
}
const DISCOVERY_NAMES = { 'exotic-energy': 'Exotic energy', 'spatial-observation': 'Spatial observations', 'alien-propulsion': 'Alien propulsion' }
const TABS = { system: 'Current system', ship: 'On board', galaxy: 'Galaxy chart', lab: 'Research lab', archive: 'Discoveries' } as const

type Tab = keyof typeof TABS
type Command = (action: CampaignAction, children: ReactNode, primary?: boolean) => ReactNode
export function ExplorationDeck({ initial, onExit }: { initial: Campaign; onExit: () => void }) {
  const [state, setState] = useState(initial)
  const [tab, setTab] = useState<Tab>('system')
  const [shipRoom, setShipRoom] = useState<RoomId>('bridge')
  const [selectedSystem, setSelectedSystem] = useState<SystemId | null>(null)
  const [selectedSite, setSelectedSite] = useState<string | null>(null)
  const [saved, setSaved] = useState(true)
  const [returnConfirm, setReturnConfirm] = useState(false)
  const [teamOpen, setTeamOpen] = useState(false)
  const [deploySite, setDeploySite] = useState<string | null>(null)
  // A destination the captain is travelling towards in stages; cleared on arrival.
  const [course, setCourse] = useState<SystemId | null>(null)
  useEffect(() => { if (course === state.at) setCourse(null) }, [course, state.at])
  // The signal being answered stays on screen for its outcome until acknowledged.
  const [signalShown, setSignalShown] = useState<string | null>(null)
  const signalOpen = !!state.signal || (!!signalShown && !state.shipBattle)
  const modalOpen = signalOpen || teamOpen || returnConfirm || state.driveTest === 'calibrating' || state.outcome === 'home'
  useEffect(() => {
    if (modalOpen) (document.querySelector('[role=dialog] button:not(:disabled)') as HTMLButtonElement | null)?.focus()
  }, [modalOpen, state.driveTest, state.outcome])
  const deckRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const storage = browserStorage()
    try { setSaved(!!storage && saveExploration(state, storage)) } catch { setSaved(false) }
  }, [state])
  // What the last order wrote to the log surfaces briefly; the whole log stays readable in Discoveries.
  const [freshLog, setFreshLog] = useState<string[] | null>(null)
  const logLength = useRef(state.log.length)
  useEffect(() => {
    if (state.log.length === logLength.current) return
    setFreshLog(state.log.slice(Math.max(logLength.current, state.log.length - 4)))
    logLength.current = state.log.length
    const fade = window.setTimeout(() => setFreshLog(null), 7000)
    return () => window.clearTimeout(fade)
  }, [state.log])
  // Leaving reloads the voyage from storage, so unsaved progress would vanish silently.
  const exit = () => {
    if (!saved && !window.confirm('This voyage could not be autosaved. Leaving now loses any progress that was not saved. Return to the title screen anyway?')) return
    onExit()
  }
  const dispatch = (action: CampaignAction) => {
    setState((current) => reduceCampaign(current, action))
    if (action.type === 'return-home') setReturnConfirm(false)
    if (action.type === 'travel') arrive()
  }
  // Arrival shows the new system from the top.
  const arrive = () => { setSelectedSite(null); setSelectedSystem(null); setTab('system'); deckRef.current?.scrollTo({ top: 0 }) }
  const locate = (id: SystemId) => { setSelectedSystem(id); setTab('galaxy') }
  const courses = useMemo(() => courseFinder(state), [state])
  const systemName = (id: SystemId) => state.galaxy.systems.find((system) => system.id === id)!.name
  /** Every jump is an ordinary travel order; a whole route stops early if research completes. */
  const fly = (destination: SystemId, whole: boolean) => {
    const next = courses(destination)?.path[1]
    if (!next) return
    setCourse(destination)
    if (whole) { setState((current) => followCourse(current, destination).state); arrive() }
    else dispatch(travelOrder(next))
  }
  const courseControls = (destination: SystemId, plan: Course, staged: boolean) => {
    const jumps = plan.path.length - 1, hop = plan.path[1]!
    const hopLock = actionLock(state, { type: 'travel', systemId: hop })
    const routeLock = hopLock ?? (plan.fuel > state.fuel ? `Requires ${plan.fuel} fuel for the whole route; refuel at a station or travel in stages` : null)
    const hopLabel = `${systemName(hop)} · ${travelCost(state, hop)} fuel · 1 day`
    return <div className="exp-course-actions">
      {jumps > 1 && <button className="exp-button primary" disabled={!!routeLock} title={routeLock ?? undefined} onClick={() => fly(destination, true)}>
        {staged ? 'Continue the route' : 'Travel the route'} · {jumps} jumps · {plan.fuel} fuel</button>}
      <button className={`exp-button${jumps > 1 ? '' : ' primary'}`} disabled={!!hopLock} title={hopLock ?? undefined} onClick={() => fly(destination, false)}>
        {jumps > 1 ? 'Next jump only' : 'Final jump'} · {hopLabel}</button>
      {(hopLock ?? routeLock) && <small>{hopLock ?? routeLock}</small>}
    </div>
  }
  const plotted = course && course !== state.at ? course : null
  const plottedCourse = plotted ? courses(plotted) : null
  const here = state.galaxy.systems.find((system) => system.id === state.at)!
  const known = locationsAt(state.world, state.at).filter((site) => state.exploration.statuses[site.id])
  const site = known.find((location) => location.id === selectedSite)
  const nextDrive = DRIVE_SEQUENCE.find((id) => !hasTech(state, id))
  const driveReady = state.built.includes('return-drive')
  const labIdle = !state.research.active && !!nextDrive
  const arc = state.survivorArc
  const voyages = [arc ? arc.stage !== 'complete' : !!state.rescuedPeople?.[0], !!state.relayArc && state.relayArc.stage !== 'complete',
    state.stories.some((r) => r.storyId === 'last-post' && r.choiceId === 'carry') && !state.lettersDelivered].filter(Boolean).length
  const command: Command = (action, children, primary = false) => {
    const lock = actionLock(state, action)
    return <button className={primary ? 'exp-button primary' : 'exp-button'} disabled={!!lock}
      title={lock ?? undefined} onClick={() => dispatch(action)}>{children}</button>
  }
  const saveStatus = <span className="exp-save" role="status">{saved ? 'Voyage saved' : 'Autosave unavailable — keep this tab open'}</span>

  const hostileStops = (path: SystemId[]) => path.slice(1).filter((id) => REGIONAL_THREAT[state.galaxy.systems.find((s) => s.id === id)!.region] > 0).length
  /** The chart's floating card: where a system is and how to get there. */
  const systemCard = (id: SystemId) => {
    const target = state.galaxy.systems.find((system) => system.id === id)!
    const plan = courses(id), jumps = plan ? plan.path.length - 1 : 0, current = id === state.at
    const neighbour = !current && travelCost(state, id) !== null
    return <>
      <span className="exp-eyebrow">{current ? 'Current position' : 'Selected destination'}</span>
      <h2>{target.name}</h2>
      <p>{REGION_NAMES[target.region]} · {STAR_NAMES[target.star]}<br />
        {target.faction ? `Claimed by ${state.galaxy.factions.find((f) => f.id === target.faction)?.name}.` : 'No registered faction claim.'}</p>
      <p className={`exp-card-risk risk-${REGIONAL_THREAT[target.region]}`} data-testid="interception-risk">{interceptionRisk(state, target.id)}</p>
      <p>{current ? `${known.length} known ${plural(known.length, 'location')}. The Lodestar is here.`
        : state.visited.includes(id) ? `${locationsAt(state.world, id).filter((s) => state.exploration.statuses[s.id]).length} known locations. Your progress here is preserved.`
        : 'Unvisited. Local opportunities will appear on arrival and after scanning.'}</p>
      {!current && (plan && jumps > 0
        ? <p className="exp-card-route"><strong>{jumps} {jumps === 1 ? 'JUMP' : 'JUMPS'} · {plan.fuel} FUEL</strong> · arrives day {state.day + jumps}{hostileStops(plan.path) ? ` · ${hostileStops(plan.path)} ${plural(hostileStops(plan.path), 'stop')} in hostile space` : ''}</p>
        : <p className="exp-card-route">No course reaches {target.name} with the current drive.</p>)}
      {neighbour ? <div className="exp-course-actions">
        {command(travelOrder(id), `Travel · ${travelCost(state, id)} fuel · 1 day`, true)}
        {actionLock(state, { type: 'travel', systemId: id }) && <small>{actionLock(state, { type: 'travel', systemId: id })}.</small>}
      </div> : !current && plan && jumps > 1 ? courseControls(id, plan, false) : null}
    </>
  }

  if (state.shipBattle) return <ExplorationBattle state={state} dispatch={dispatch} onExit={exit} saved={saved} />
  if (state.mission) return <TacticalMission state={state} dispatch={dispatch} onExit={exit} saved={saved} />
  const scene = tab === 'system' ? site ? 'site' : 'system' : tab
  return <main className="exp-deck" data-tab={tab} data-scene={scene} ref={deckRef}>
    <header className="exp-header" inert={modalOpen}>
      <span className="exp-ship-mark">ISS LODESTAR</span>
      <nav className="exp-nav" aria-label="Exploration stations">
        {(Object.keys(TABS) as Tab[]).map((item) => <button key={item} aria-current={tab === item ? 'page' : undefined}
          onClick={() => { setTab(item); if (item === 'system') setSelectedSite(null) }}>
          {TABS[item]}
          {item === 'lab' && labIdle && <span className="exp-tab-flag" title="No research is progressing">idle</span>}
          {item === 'archive' && voyages > 0 && <span className="exp-tab-flag" title={`${voyages} side ${plural(voyages, 'voyage')} in progress`}>{voyages}</span>}
        </button>)}
      </nav>
      <div className="exp-resources" aria-label="Ship resources">
        <span>DAY <b data-testid="exp-day">{state.day}</b></span>
        <span>FUEL <b data-testid="exp-fuel">{state.fuel}/{fuelCapacity(state)}</b></span>
        <span>HULL <b>{state.hull}/{hullCapacity(state)}</b></span>
        <span>MISSILES <b data-testid="exp-missiles">{state.missiles}</b></span>
        <span>MATERIALS <b data-testid="exp-materials">{state.exploration.materials}</b></span>
        <span>CREDITS <b>{state.exploration.credits}</b></span>
      </div>
      {driveReady && <button className="exp-button primary" onClick={() => setReturnConfirm(true)}>Return home</button>}
      <button className="exp-button" onClick={() => { setDeploySite(null); setTeamOpen(true) }}>Away team</button>
      <button className="exp-button" onClick={exit}>Title screen</button>
      <MuteButton icon />
    </header>
    <div className="exp-stage" inert={modalOpen}>
      {scene === 'system' && <section className="exp-system" aria-label={here.name}>
        {plotted && <section className="exp-course-card" aria-label="Plotted course">
          <span className="exp-eyebrow">Plotted course</span><h3>{systemName(plotted)}</h3>
          {plottedCourse ? <><p>{plottedCourse.path.length - 1} {plural(plottedCourse.path.length - 1, 'jump')} left · {plottedCourse.fuel} fuel · arrives day {state.day + plottedCourse.path.length - 1}</p>
            {courseControls(plotted, plottedCourse, true)}</> : <p>No course reaches it with the current drive.</p>}
          <button className="exp-text-button" onClick={() => setCourse(null)}>Clear course</button>
        </section>}
        <div className="exp-system-hero">
          <h2>{here.name}</h2>
          <p>Orbiting {STAR_NAMES[here.star]}.<br />{known.length} known {plural(known.length, 'contact')} · {state.scans[state.at] ? `${state.scans[state.at]} scan complete` : 'passive sensors only'}</p>
          <div className="exp-bridge-presence">
            <CrewLine person="vale" compact>{bridgeMessage(state)}</CrewLine>
            <button className="exp-button" onClick={() => { setShipRoom('bridge'); setTab('ship') }}>Visit the bridge</button>
          </div>
          <div className="exp-actions">
            {!state.research.active && !state.research.completed.includes('drive-diagnostics') && <button className="exp-button primary" onClick={() => setTab('lab')}>Start Return Drive research</button>}
            {command({ type: 'scan', tier: 'survey' }, 'Survey system · 1 day', true)}
            {command({ type: 'scan', tier: 'deep' }, 'Deep scan · 1 day')}
            {fitted(state, 'fuel-recycling') && command({ type: 'recycle-fuel' }, 'Recycle fuel · 3 materials · 1 day')}
            {!actionLock(state, { type: 'emergency-fuel' }) && command({ type: 'emergency-fuel' }, 'Emergency fuel · 3 days')}
          </div>
          {!state.deepArray && <small>Deep scans require a researched and installed survey array.</small>}
          {!actionLock(state, { type: 'emergency-fuel' }) && <small className="exp-warning">No jump is affordable. Collect trace hydrogen to reach another system.</small>}
        </div>
        <div className="exp-places">
          <div className="exp-places-heading"><span className="exp-eyebrow">Places to investigate</span>{saveStatus}</div>
          {known.length === 0 && <p className="exp-empty">Passive sensors found no contacts. Run a system survey to search further.</p>}
          <div className="exp-locations">
            {known.map((location) => {
              const status = state.exploration.statuses[location.id]
              const waiting = storyAt(state.seed, location) && ['investigated', 'resolved'].includes(status ?? '') && !state.stories.some((r) => r.locationId === location.id)
              return <button key={location.id} data-testid={`location-${location.kind}`} className="exp-location" onClick={() => setSelectedSite(location.id)}>
                <svg className="exp-site-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">{ICONS[location.kind]}</svg>
                <span><small>{LABELS[location.kind]}</small><strong>{location.name}</strong>
                  <span className={`exp-site-status${waiting ? ' waiting' : ''}`}>{status}{waiting ? ' · decision waiting' : ''}{location.services.length ? ' · station services' : ''}
                    {state.research.completed.includes('spectrometry') && location.discovery ? ` · ${DISCOVERY_NAMES[location.discovery]}` : ''}</span></span>
                <span className={`exp-threat threat-${location.threat}`}>{hasTech(state, 'threat-analysis') ? `${recoveryDamage(state, location)} HULL RISK` : ['LOW', 'GUARDED', 'HAZARDOUS', 'EXTREME'][location.threat]}</span>
              </button>
            })}
          </div>
        </div>
      </section>}
      {scene === 'site' && site && <SiteScene key={site.id} state={state} site={site} dispatch={dispatch} command={command}
        onBack={() => setSelectedSite(null)} onBoard={() => { setDeploySite(site.id); setTeamOpen(true) }} />}
      {tab === 'ship' && <ShipRooms state={state} room={shipRoom} onRoom={setShipRoom} onNavigate={setTab} onTeam={() => { setDeploySite(null); setTeamOpen(true) }} />}
      {tab === 'galaxy' && <ExpeditionGalaxyChart state={state} selected={selectedSystem} onSelect={setSelectedSystem} card={systemCard} status={saveStatus} />}
      {tab === 'lab' && <ExplorationResearch state={state} dispatch={dispatch} onShowSystem={locate} status={saveStatus} />}
      {tab === 'archive' && <Discoveries state={state} command={command} onLocate={locate} status={saveStatus} />}
    </div>
    <div className={`exp-log${freshLog ? ' fresh' : ''}`} role="status" aria-live="polite" inert={modalOpen}>{(freshLog ?? state.log.slice(-1)).map((line, i) => <p key={i}>{line}</p>)}</div>
    {teamOpen && <AwayTeam state={state} locationId={deploySite} dispatch={dispatch} onClose={() => setTeamOpen(false)} />}
    <DriveTestScene state={state} dispatch={dispatch} />
    {signalOpen && <SignalScene state={state} shown={state.signal?.id ?? signalShown!} dispatch={dispatch}
      onAnswer={() => setSignalShown(state.signal!.id)} onClose={() => setSignalShown(null)} />}
    {returnConfirm && state.outcome !== 'home' && <ReturnHomeScene state={state} dispatch={dispatch} onClose={() => setReturnConfirm(false)} />}
    {state.outcome === 'home' && <ExplorationEnding state={state} onExit={exit} />}
  </main>
}

/**
 * A place in the current system, shown full-bleed. The story sits over the art;
 * every order (contact, recovery, station services) lives in the science
 * officer's briefing, opened from her portrait.
 */
function SiteScene({ state, site, dispatch, command, onBack, onBoard }: {
  state: Campaign; site: ExplorationLocation; dispatch: (action: CampaignAction) => void; command: Command; onBack: () => void; onBoard: () => void
}) {
  const status = state.exploration.statuses[site.id]
  const detected = status === 'detected'
  const storyShown = !!storyAt(state.seed, site) && !detected
  const [open, setOpen] = useState(!storyShown)
  useEffect(() => setOpen(!storyShown), [storyShown])
  const briefRef = useRef<HTMLElement>(null)
  const [art, alt] = SCENE_ART[site.kind]
  const toggle = () => {
    setOpen(!open)
    if (!open) requestAnimationFrame(() => briefRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled):not(.exp-close)')?.focus())
  }
  const recorder = state.survivorArc?.stage === 'accepted' && state.survivorArc.destinationId === site.id && !detected
  return <section className="exp-scene" aria-label={site.name}>
    <img className="exp-scene-art" src={art} alt={alt} />
    <button className="exp-back" onClick={onBack}>← Back to system overview</button>
    <div className="exp-scene-copy">
      <h2>{site.name}</h2>
      {storyShown ? <ExplorationStory state={state} site={site} dispatch={dispatch} />
        : <p>{detected ? `${LABELS[site.kind]}. Investigate this contact to uncover its story and identify recoverable supplies.` : LABELS[site.kind]}</p>}
      {!detected && <div className="exp-scene-main-action"><button className="exp-button primary" onClick={() => setOpen(true)}>{site.kind === 'station' ? 'Open station services' : 'Review expedition options'}</button></div>}
    </div>
    <button className="exp-officer" aria-expanded={open} aria-controls="exp-briefing" onClick={toggle}>
      <img src="/assets/portraits/26_helen_morozova.png" alt="" />
      <span>Helen Morozova<small>{open ? 'Close briefing' : 'Open briefing'}</small></span>
    </button>
    {open && <aside id="exp-briefing" className="exp-detail exp-brief" aria-label="Science officer briefing" ref={briefRef}>
      <div className="exp-brief-head">
        <div><span className="exp-eyebrow">Science officer briefing</span><h3>{LABELS[site.kind]} · {status}</h3></div>
        <button className="exp-close" aria-label="Close briefing" onClick={() => setOpen(false)}><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12" /></svg></button>
      </div>
      <CrewLine person="morozova" compact>{detected ? 'We have a fix on the location. Investigate before choosing how to recover it.' : site.kind === 'station' ? 'The station has supplies and people with their own concerns. We should listen before we leave.' : site.kind === 'derelict' ? 'We can send probes or a boarding team. I want a clear plan before anyone crosses that hatch.' : 'We can learn something here without taking an unnecessary risk.'}</CrewLine>
      {site.name === 'The Silent Courier' && !detected && <p>Its surviving power cell kept the transmitter alive. Studying it may point us towards the Return Drive.</p>}
      {detected ? command({ type: 'investigate', locationId: site.id }, site.kind === 'station' ? 'Establish contact · 1 day' : 'Investigate · 1 day', true) : <>
        {site.services.length > 0 ? <div className="exp-service-list">
          <SurvivorStation state={state} siteId={site.id} dispatch={dispatch} /><LongRelayStation state={state} siteId={site.id} dispatch={dispatch} />
          <h3>Station services</h3>
          {command({ type: 'service', locationId: site.id, service: 'refuel' }, `Refuel +20 · ${stationPrice(state)} credits · 1 day`)}
          {command({ type: 'service', locationId: site.id, service: 'repair' }, `Repair +20 · 5 materials + ${stationPrice(state)} credits · 1 day`)}
          {command({ type: 'service', locationId: site.id, service: 'sell' }, `Sell 4 materials · receive ${salePrice(state)} credits · 1 day`)}
          {command({ type: 'service', locationId: site.id, service: 'buy' }, 'Buy 4 materials · 18 credits · 1 day')}
          {command({ type: 'service', locationId: site.id, service: 'ordnance' }, `Buy 2 Hellion missiles · ${ORDNANCE_PRICE} credits · ${state.missiles}/${MAGAZINE_CAPACITY} aboard`)}
          {command({ type: 'service', locationId: site.id, service: 'contract' }, 'Survey contract · 3 days · earn 8 materials + 18 credits')}
          {state.stories.some((r) => r.storyId === 'last-post' && r.choiceId === 'carry') && !state.lettersDelivered && <section className="exp-relay" aria-label="The last post delivery"><h3>The last post</h3>{command({ type: 'deliver-letters', locationId: site.id }, 'Relay the letters · 1 day · +25 credits', true)}{state.at === state.galaxy.start && <small>These relays cannot reach home. Try a station in another system.</small>}</section>}
          <EscortOffer state={state} locationId={site.id} dispatch={dispatch} />
          <small>Services remain available after you leave. Contracts provide renewable supplies.</small>
          {hasTech(state, 'contextual-translation') && <><h3>Scientific records</h3><small>A station supplies one independent spatial source. Seek a second station or an expedition for another.</small>
            {(['exotic-energy', 'spatial-observation', 'alien-propulsion'] as const).map((kind) => <div key={kind}>{command({ type: 'archive', locationId: site.id, kind }, `${DISCOVERY_NAMES[kind]} · 30 credits · 1 day`)}</div>)}
          </>}
        </div> : status === 'resolved' ? <div className="exp-notice">Expedition complete. All findings and resources are aboard; they cannot be collected twice.</div> : <>
          <div className="exp-reward"><span className="exp-eyebrow">Expected recovery</span><p>{site.reward ? `${site.reward.materials} materials · ${site.reward.credits} credits` : 'A completed survey'}{site.discovery ? ` · ${DISCOVERY_NAMES[site.discovery]}` : ''}</p></div>
          {command({ type: 'recover', locationId: site.id, approach: 'careful' }, `Remote investigation · ${carefulDays(state)} ${carefulDays(state) === 1 ? 'day' : 'days'} · no damage`, true)}
          {command({ type: 'recover', locationId: site.id, approach: 'rapid' }, `Rapid expedition · 1 day · ${recoveryDamage(state, site)} hull damage`)}
          {['derelict', 'ruins'].includes(site.kind) && <button className="exp-button" onClick={onBoard}>Board with away team · tactical mission</button>}
          <small>{['derelict', 'ruins'].includes(site.kind) ? 'Boarding: choose rescue, sabotage or salvage for extra rewards. Injuries and casualties persist; remote investigation remains safe. ' : ''}Both other approaches recover the same science; rapid retrieval uses any fitted engineering tools to recover extra materials.</small>
        </>}
      </>}
      {recorder && <section className="relay-conversation"><h3>Someone left behind</h3><p>The recorder is beyond a broken service partition. Recover it carefully, or withdraw. Carrying it limits movement to two tiles per AP and wakes two security reserves.</p><button className="exp-button" onClick={onBoard}>Prepare recorder recovery</button><small>No normal cargo or science from this return visit. Report to the survivor afterwards.</small></section>}
      <button className="exp-text-button" onClick={onBack}>Leave this location</button>
    </aside>}
  </section>
}

/** The voyage record: side voyages in progress, decisions, findings and the full log. */
function Discoveries({ state, command, onLocate, status }: { state: Campaign; command: Command; onLocate: (id: SystemId) => void; status: ReactNode }) {
  const objectives = [<SurvivorObjective key="survivor" state={state} onLocate={onLocate} />, <LongRelayObjective key="relay" state={state} onLocate={onLocate} />,
    <LettersObjective key="letters" state={state} />]
  return <section className="exp-archive" aria-label="Discoveries">
    <div className="exp-archive-column">
      <div className="exp-archive-heading"><h2>Discoveries</h2><span>{state.findings.length} distinct {plural(state.findings.length, 'source')} · {status}</span></div>
      <div className="exp-voyages">{objectives}</div>
      {state.stories.length > 0 && <section className="exp-captains-record" aria-label="Captain’s record"><h3>Captain’s record</h3>{state.stories.map((record) => {
        const place = state.world.locations.find((s) => s.id === record.locationId)!
        const story = storyAt(state.seed, place)!, choice = story.choices.find((c) => c.id === record.choiceId)!
        return <article className="exp-finding" key={record.locationId}><span className="exp-eyebrow">Day {record.day} / {place.name}</span><h3>{story.title}</h3><ReportImage eventId={story.id} compact /><strong>{choice.label}</strong><p>{choice.outcome}</p><button className="exp-text-button" onClick={() => onLocate(place.systemId)}>Locate encounter on chart</button></article>
      })}</section>}
      <LongRelayArchive state={state} /><SurvivorArchive state={state} />
      <h3 className="exp-archive-label">Recovered sources</h3>
      {state.findings.length === 0 && <div className="exp-empty">No discoveries recovered yet. Start with the Silent Courier in your arrival system.</div>}
      {state.findings.map((finding) => {
        const location = state.world.locations.find((s) => s.id === finding.locationId)
        return <article className="exp-finding" key={finding.locationId}><span className="exp-eyebrow">Recovered / day {finding.day}</span>
          <h3>{DISCOVERY_NAMES[finding.kind]}</h3><p>{location?.name ?? finding.sourceName}</p>
          <button className="exp-text-button" onClick={() => onLocate(location?.systemId ?? finding.systemId!)}>Locate source on chart</button>
        </article>
      })}
      {state.findings.length > 0 && <small>Each source is kept separately. Multiple observations of the same phenomenon can support later research.</small>}
      {hasTech(state, 'relay-network') && <section className="exp-science-leads"><span className="exp-eyebrow">Diplomatic relay network</span><h3>Known station archives</h3>
        {state.world.locations.filter((s) => s.kind === 'station' && ['investigated', 'resolved'].includes(state.exploration.statuses[s.id] ?? '')).map((station) => <article className="exp-finding" key={station.id}><h3>{station.name}</h3>
          {(['exotic-energy', 'spatial-observation', 'alien-propulsion'] as const).map((kind) => <div key={kind}>{command({ type: 'archive', locationId: station.id, kind }, `${DISCOVERY_NAMES[kind]} · 30 credits · 1 day`)}</div>)}
        </article>)}
      </section>}
      <p className="exp-voyage-record">{state.visited.length} {plural(state.visited.length, 'system')} visited · {state.research.completed.length} {plural(state.research.completed.length, 'project')} completed</p>
      <details className="exp-full-log"><summary>Captain’s log · {state.log.length} {plural(state.log.length, 'entry', 'entries')}</summary>
        <ol>{[...state.log].reverse().map((line, i) => <li key={i}>{line}</li>)}</ol></details>
    </div>
  </section>
}
