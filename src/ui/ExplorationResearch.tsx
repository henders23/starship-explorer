import { useState } from 'react'
import type { ReactNode } from 'react'
import { actionLock, buildLock, fitted, hasTech, researchProgress, researchRate, researchRequirements } from '../engine/exploration/campaign.js'
import type { Campaign, CampaignAction } from '../engine/exploration/campaign.js'
import { BRANCHES, DRIVE_SEQUENCE, PROJECT_IDS, PROJECTS, SLOT_LIMITS, blueprintFor, buildName } from '../engine/exploration/research.js'
import type { BuildId, ResearchBranch, Slot } from '../engine/exploration/research.js'

export function ResearchAction({ state, action, dispatch, children, primary = false, showReason = true }: {
  state: Campaign; action: CampaignAction; dispatch: (action: CampaignAction) => void; children: ReactNode; primary?: boolean; showReason?: boolean
}) {
  const lock = actionLock(state, action)
  return <div className="exp-action-control"><button className={`exp-button ${primary ? 'primary' : ''}`} disabled={!!lock}
    title={lock ?? undefined} onClick={() => dispatch(action)}>{children}</button>
    {lock && showReason && <small className="exp-lock-reason">{lock}</small>}</div>
}
export function ExplorationResearch({ state, dispatch, onShowSystem }: {
  state: Campaign; dispatch: (action: CampaignAction) => void; onShowSystem: (id: string) => void
}) {
  const [branch, setBranch] = useState<ResearchBranch>('Propulsion')
  const [section, setSection] = useState<'research' | 'workshop'>('research')
  const [showPath, setShowPath] = useState(() => !window.matchMedia('(max-width: 640px)').matches)
  const [showQueue, setShowQueue] = useState(() => !window.matchMedia('(max-width: 640px)').matches)
  const active = state.research.active
  const act = (action: CampaignAction, children: ReactNode, primary = false, showReason = true) =>
    <ResearchAction state={state} action={action} dispatch={dispatch} primary={primary} showReason={showReason}>{children}</ResearchAction>
  const needed = !state.findings.some((f) => f.kind === 'exotic-energy') ? 'exotic-energy' : 'spatial'
  const leads = state.world.locations.filter((site) => site.discovery &&
    (needed === 'exotic-energy' ? site.discovery === needed : ['spatial-observation', 'alien-propulsion'].includes(site.discovery)) &&
    !state.exploration.claimed.includes(site.id)).slice(0, 3)
  return <>
    <div className="exp-lab-hero"><span className="exp-eyebrow">SCIENCE & ENGINEERING</span><h2>A route home. Built here.</h2>
      <p>Research while you explore. Recover knowledge, choose your refits and test a drive that can bring the Ithaca home.</p></div>
    <button className="exp-lab-fold" aria-expanded={showPath} onClick={() => setShowPath(!showPath)}>Return Drive · {DRIVE_SEQUENCE.filter((id) => hasTech(state, id)).length}/5 breakthroughs <span>{showPath ? 'Hide milestones' : 'Show milestones'}</span></button>
    {showPath && <div className="exp-drive-progress" aria-label="Return Drive progress">
      {DRIVE_SEQUENCE.map((id, i) => <div key={id} className={hasTech(state, id) ? 'complete' : active === id ? 'active' : ''}>
        <span>{hasTech(state, id) ? '✓' : `0${i + 1}`}</span><strong>{PROJECTS[id].name}</strong><small>{hasTech(state, id) ? 'Researched' : `${PROJECTS[id].days} base days`}</small>
      </div>)}
    </div>}
    <div className="exp-drive-actions">
      {hasTech(state, 'prototype-drive') && !state.built.includes('prototype-drive') && act({ type: 'build', blueprint: 'prototype-drive' }, 'Construct prototype · 25 materials + 50 credits', true)}
      {state.built.includes('prototype-drive') && state.driveTest !== 'complete' && act({ type: 'begin-drive-test' }, 'Begin prototype field test', true)}
      {state.driveTest === 'complete' && !hasTech(state, 'drive-stabilisation') && <p className="exp-notice">Prototype test complete. Research Drive Stabilisation to unlock the final build.</p>}
      {hasTech(state, 'drive-stabilisation') && !state.built.includes('return-drive') && act({ type: 'build', blueprint: 'return-drive' }, 'Construct Return Drive · 60 materials + 150 credits', true)}
      {state.built.includes('return-drive') && <div className="exp-notice">The Return Drive is ready. You can depart from any system when you choose. Use <strong>Return home</strong> in the command bar.</div>}
    </div>
    <button className="exp-lab-fold" aria-expanded={showQueue} onClick={() => setShowQueue(!showQueue)}>Research queue · {state.research.queue.length}/3 pending <span>{showQueue ? 'Hide queue' : 'Show queue'}</span></button>
    {!showQueue && <p className="exp-compact-research">{active ? `${PROJECTS[active].name} · ${Math.ceil((PROJECTS[active].days - researchProgress(state, active)) / researchRate(state))} days remaining` : 'No active project'}</p>}
    {showQueue && <section className="exp-research-queue" aria-label="Research queue">
      <div><span className="exp-eyebrow">ACTIVE RESEARCH / {researchRate(state)}× WORK RATE</span>
        <h3>{active ? PROJECTS[active].name : 'Laboratory available'}</h3>
        {active ? <><progress value={researchProgress(state, active)} max={PROJECTS[active].days} aria-label="Active research progress" />
          <p>{researchProgress(state, active)} / {PROJECTS[active].days} work days · {Math.ceil((PROJECTS[active].days - researchProgress(state, active)) / researchRate(state))} activity days remaining</p>
          {act({ type: 'pause-research' }, 'Pause active project', false, false)}</> : <p>Start a project or queue your next choices. Blocked queue entries wait; ready entries proceed in order.</p>}
      </div>
      <div><span className="exp-eyebrow">UP NEXT / {state.research.queue.length} OF 3</span>
        {state.research.queue.length === 0 && <p>No projects queued. You may queue prerequisites before they are met.</p>}
        <ol>{state.research.queue.map((id, index) => <li key={id}><strong>{index + 1}. {PROJECTS[id].name}</strong>
          <small>{researchRequirements(state, id) ?? 'Ready after the active project'}</small>
          <div className="exp-queue-buttons">{act({ type: 'move-queue', project: id, direction: -1 }, 'Move up', false, false)}
            {act({ type: 'move-queue', project: id, direction: 1 }, 'Move down', false, false)}
            {act({ type: 'unqueue', project: id }, 'Remove', false, false)}</div></li>)}</ol>
      </div>
    </section>}
    <div className="exp-lab-sections"><button aria-pressed={section === 'research'} onClick={() => setSection('research')}>Research catalogue · 29 projects</button>
      <button aria-pressed={section === 'workshop'} onClick={() => setSection('workshop')}>Fabrication & fitting · {state.built.length} built</button></div>
    {section === 'research' ? <>
      <nav className="exp-branches" aria-label="Research branches">{BRANCHES.map((name) => <button key={name} aria-pressed={branch === name} onClick={() => setBranch(name)}>{name}
        <small>{PROJECT_IDS.filter((id) => PROJECTS[id].branch === name && hasTech(state, id)).length}/{PROJECT_IDS.filter((id) => PROJECTS[id].branch === name).length}</small></button>)}</nav>
      <div className="exp-projects">{PROJECT_IDS.filter((id) => PROJECTS[id].branch === branch).map((id) => {
        const project = PROJECTS[id], progress = researchProgress(state, id), complete = hasTech(state, id)
        return <article className={`exp-project ${project.future ? 'upcoming' : ''}`} key={id} aria-label={project.name}>
          <span className="exp-eyebrow">{branch} / {complete ? 'COMPLETE' : project.future ? 'UPCOMING' : active === id ? 'IN PROGRESS' : researchRequirements(state, id) ? 'LOCKED' : 'AVAILABLE'}</span>
          <h3>{project.name}</h3><p>{project.effect}</p>
          <div className="exp-dependencies"><span>After</span>{project.requires.length ? project.requires.map((parent) => <button key={parent} onClick={() => setBranch(PROJECTS[parent].branch)}>{hasTech(state, parent) ? '✓ ' : ''}{PROJECTS[parent].name}</button>) : <small>No research prerequisites</small>}</div>
          {project.discovery && <p className="exp-prerequisite">{project.discovery === 'any' ? 'One scientific discovery' : project.discovery === 'exotic' ? 'One exotic-energy discovery' : 'Two independent spatial or alien-propulsion sources; each station archive counts once'}</p>}
          {id === 'drive-stabilisation' && <p className="exp-prerequisite">Requires a completed prototype field test.</p>}
          {project.future ? <div className="exp-notice">{project.future}. Research is locked until it has a usable effect.</div> : <>
            <progress value={progress} max={project.days} aria-label={`${project.name} progress`} />
            <div className="exp-project-meta"><span>{progress} / {project.days} work days</span><span>{Math.ceil((project.days - progress) / researchRate(state))} activity days remaining</span></div>
            <div className="exp-project-controls">{act({ type: 'research', project: id }, complete ? 'Research complete' : active === id ? 'Researching as you explore' : progress ? 'Resume research' : 'Begin research', true, !complete && active !== id)}
              {!complete && active !== id && act({ type: 'queue', project: id }, state.research.queue.includes(id) ? 'Queued' : 'Add to queue', false, false)}</div>
            {project.blueprint && complete && <div className="exp-blueprint">
              {state.built.includes(id) ? <><small>{fitted(state, id) ? 'Fitted and active' : 'Constructed; stored aboard'}</small>{!fitted(state, id) && act({ type: 'equip', blueprint: id }, 'Fit upgrade')}</>
                : act({ type: 'build', blueprint: id }, `${id === 'deep-survey' ? 'Install array' : 'Construct upgrade'} · ${project.blueprint.materials} materials + ${project.blueprint.credits} credits`)}
            </div>}
          </>}
        </article>
      })}</div>
    </> : <>
      <div className="exp-slot-summary">{(['engine', 'utility', 'gadget', 'hull'] as Slot[]).map((slot) => <span key={slot}>{slot}<b>{state.equipped.filter((id) => blueprintFor(id)?.slot === slot).length}/{SLOT_LIMITS[slot]}</b></span>)}</div>
      <p>Constructing an upgrade pays for it once. Fit stored modules at no extra cost. Two utility slots and one gadget slot make your loadout a choice.</p>
      {([...PROJECT_IDS.filter((id) => PROJECTS[id].blueprint && hasTech(state, id)), ...(hasTech(state, 'drive-stabilisation') ? ['return-drive'] : [])] as BuildId[]).map((id) => {
        const cost = blueprintFor(id)!, built = state.built.includes(id), equipped = fitted(state, id)
        return <article className="exp-finding" key={id}><span className="exp-eyebrow">{cost.slot} / {equipped ? 'FITTED' : built ? 'STORED' : 'BLUEPRINT'}</span>
          <h3>{buildName(id)}</h3><p>{id === 'return-drive' ? 'Choose to return home from any system, whenever you are ready.' : PROJECTS[id].effect}</p>
          {!built ? act({ type: 'build', blueprint: id }, `Construct · ${cost.materials} materials + ${cost.credits} credits`, !buildLock(state, id))
            : equipped ? act({ type: 'unequip', blueprint: id }, 'Unfit and store', false, cost.slot !== 'drive' && cost.slot !== 'hull') : act({ type: 'equip', blueprint: id }, 'Fit stored upgrade', true)}
          {id === 'fuel-tanks' && equipped && <small>Unfitting vents any fuel above the standard 80-unit tank capacity.</small>}
        </article>
      })}
      {state.research.completed.every((id) => !PROJECTS[id].blueprint) && <div className="exp-empty">Research a hardware project to unlock its construction blueprint.</div>}
    </>}
    {hasTech(state, 'drive-diagnostics') && <section className="exp-science-leads"><span className="exp-eyebrow">DRIVE TELEMETRY / SCIENTIFIC LEADS</span><h3>Places worth investigating</h3>
      <p>Courier telemetry and our drive model point to compatible signatures. These are optional leads, not required destinations. Station scientific archives offer another route after Contextual Translation.</p>
      {leads.map((site) => <button className="exp-button" key={site.id} onClick={() => onShowSystem(site.systemId)}>{state.galaxy.systems.find((s) => s.id === site.systemId)!.name} · {needed === 'exotic-energy' ? 'energy signature' : 'spatial research lead'}</button>)}
    </section>}
  </>
}

export function DriveTestScene({ state, dispatch }: { state: Campaign; dispatch: (action: CampaignAction) => void }) {
  if (state.driveTest !== 'calibrating') return null
  return <div className="exp-modal-backdrop"><section className="exp-modal" role="dialog" aria-modal="true" aria-label="Prototype field test">
    <span className="exp-eyebrow">RETURN DRIVE / FIELD TEST</span><h2>One small passage.</h2>
    <img className="exp-test-portrait" src="/assets/portraits/26_helen_morozova.png" alt="Helen Morozova" />
    <p>“The field is stable, but the edge is pulling at our instruments. We can send probes around it and map the strain. Or bring the ship close enough to measure it directly.”</p>
    <p>Both approaches complete the test. The prototype will survive.</p>
    <ResearchAction state={state} dispatch={dispatch} action={{ type: 'complete-drive-test', approach: 'remote' }} primary>Map with remote probes · 2 days · no damage</ResearchAction>
    <ResearchAction state={state} dispatch={dispatch} action={{ type: 'complete-drive-test', approach: 'shielded' }}>Shielded calibration pass · 1 day · 10 hull damage</ResearchAction>
    <button className="exp-text-button" onClick={() => dispatch({ type: 'abort-drive-test' })}>Power down and test later</button>
  </section></div>
}
export function ReturnHomeScene({ state, dispatch, onClose }: { state: Campaign; dispatch: (action: CampaignAction) => void; onClose: () => void }) {
  return <div className="exp-modal-backdrop"><section className="exp-modal" role="dialog" aria-modal="true" aria-label="Return home confirmation">
    <span className="exp-eyebrow">ISS ITHACA / DEPARTURE</span><h2>Set a course for home?</h2><p>The drive is ready. Activating it ends this voyage. You can also stay and continue exploring.</p>
    <ResearchAction state={state} dispatch={dispatch} action={{ type: 'return-home' }} primary>Activate Return Drive</ResearchAction>
    <button className="exp-button" onClick={onClose}>Keep exploring</button>
  </section></div>
}
export function ExplorationEnding({ state, onExit }: { state: Campaign; onExit: () => void }) {
  return <div className="exp-modal-backdrop"><section className="exp-modal exp-ending" role="dialog" aria-modal="true" aria-label="Voyage complete">
    <span className="exp-eyebrow">VOYAGE COMPLETE / DAY {state.day}</span><h2>A familiar sky.</h2>
    <p>At first, nobody says anything. Then the navigation console finds a star with a name the crew learned at school.</p>
    <p>Morozova checks the reading twice. Vale lets her finish. “Send our identification,” he says. “Tell them we’re home.”</p>
    <div className="exp-ending-stats"><span><b>{state.visited.length}</b>systems visited</span><span><b>{state.findings.length}</b>scientific sources</span><span><b>{state.research.completed.length}</b>projects completed</span></div>
    <p>{state.findings.some((f) => f.sourceName) ? 'The knowledge shared by distant stations travelled home with you.' : 'The observations and recovered machinery that made the journey possible are secured in the science archive.'}</p>
    <p>{hasTech(state, 'slipstream') ? 'Your navigators leave a chart of shortcuts for the next ship to follow.' : 'Every lane in the voyage log marks a place the Ithaca reached under her own power.'}</p>
    <button className="exp-button primary" onClick={onExit}>Return to title</button>
  </section></div>
}
