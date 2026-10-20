import { survivorSummary } from '../engine/exploration/survivor-arc.js'
import { useMemo, useRef, useState } from 'react'
import { courseFinder } from '../engine/exploration/navigation.js'
import type { ReactNode } from 'react'
import { useDialogDismiss } from './dialog.js'
import { CrewLine } from './crew-presence.js'
import { plural } from './plural.js'
import { leadLabel, scienceLeads } from './science-leads.js'
import { actionLock, buildLock, fitted, hasTech, researchProgress, researchRate, researchRequirements } from '../engine/exploration/campaign.js'
import type { Campaign, CampaignAction } from '../engine/exploration/campaign.js'
import { BRANCHES, DRIVE_SEQUENCE, PROJECT_IDS, PROJECTS, SLOT_LIMITS, blueprintFor, buildName } from '../engine/exploration/research.js'
import type { BuildId, ProjectId, Slot } from '../engine/exploration/research.js'

/** Campaign days of activity until a project completes at the current work rate. */
export const daysLeft = (state: Campaign, id: ProjectId) => Math.ceil((PROJECTS[id].days - researchProgress(state, id)) / researchRate(state))
export function ResearchAction({ state, action, dispatch, children, primary = false, showReason = true }: {
  state: Campaign; action: CampaignAction; dispatch: (action: CampaignAction) => void; children: ReactNode; primary?: boolean; showReason?: boolean
}) {
  const lock = actionLock(state, action)
  return <div className="exp-action-control"><button className={`exp-button ${primary ? 'primary' : ''}`} disabled={!!lock}
    title={lock ?? undefined} onClick={() => dispatch(action)}>{children}</button>
    {lock && showReason && <small className="exp-lock-reason">{lock}</small>}</div>
}
export function ExplorationResearch({ state, dispatch, onShowSystem, status }: {
  state: Campaign; dispatch: (action: CampaignAction) => void; onShowSystem: (id: string) => void; status?: ReactNode
}) {
  const [section, setSection] = useState<'research' | 'workshop'>('research')
  const [selected, setSelected] = useState<BuildId | null>(() => state.research.active ?? DRIVE_SEQUENCE.find((id) => !hasTech(state, id)) ?? null)
  const detailRef = useRef<HTMLElement>(null)
  const active = state.research.active
  const act = (action: CampaignAction, children: ReactNode, primary = false, showReason = true) =>
    <ResearchAction state={state} action={action} dispatch={dispatch} primary={primary} showReason={showReason}>{children}</ResearchAction>
  const courses = useMemo(() => courseFinder(state), [state])
  const leads = scienceLeads(state, courses)
  const choose = (id: BuildId | null) => {
    setSelected(id)
    if (id && window.matchMedia('(max-width: 760px)').matches) requestAnimationFrame(() => detailRef.current?.scrollIntoView({ block: 'start' }))
  }
  const breakthroughs = DRIVE_SEQUENCE.filter((id) => hasTech(state, id)).length
  const buildable = [...PROJECT_IDS.filter((id) => PROJECTS[id].blueprint && hasTech(state, id)), ...(hasTech(state, 'drive-stabilisation') ? ['return-drive'] : [])] as BuildId[]
  const stateOf = (id: ProjectId) => hasTech(state, id) ? 'Complete' : PROJECTS[id].future ? 'Upcoming' : active === id ? 'In progress'
    : state.research.queue.includes(id) ? 'Queued' : researchRequirements(state, id) ? 'Locked' : 'Available'
  const project = selected && selected !== 'return-drive' && section === 'research' ? selected : null
  const blueprint = selected && section === 'workshop' && buildable.includes(selected) ? selected : null

  return <div className="exp-lab">
    {project && projectDetail(project)}
    {blueprint && <section className="exp-lab-detail" aria-label={`${buildName(blueprint)} details`} ref={detailRef}>
      {blueprintCard(blueprint)}
    </section>}
    <aside className="exp-lab-side" aria-label="Research projects">
      <div className="exp-lab-side-head"><span className="exp-eyebrow">Research</span>{status}</div>
      <p className="exp-lab-summary">{researchRate(state)}× work rate · {state.research.completed.length} of {PROJECT_IDS.length} complete · {state.research.queue.length} queued</p>
      <section className="exp-route-home" aria-label="Route home">
        <div className="exp-route-head"><strong>Return Drive</strong><span>{breakthroughs}/5 breakthroughs</span></div>
        <div className="exp-route-pips" aria-hidden="true">{DRIVE_SEQUENCE.map((id) => <i key={id} className={hasTech(state, id) ? 'done' : active === id ? 'active' : ''} />)}</div>
        {hasTech(state, 'prototype-drive') && !state.built.includes('prototype-drive') && act({ type: 'build', blueprint: 'prototype-drive' }, 'Construct prototype · 25 materials + 50 credits', true)}
        {state.built.includes('prototype-drive') && state.driveTest !== 'complete' && act({ type: 'begin-drive-test' }, 'Begin prototype field test', true)}
        {state.driveTest === 'complete' && !hasTech(state, 'drive-stabilisation') && <small>Prototype test complete. Research Drive Stabilisation to unlock the final build.</small>}
        {hasTech(state, 'drive-stabilisation') && !state.built.includes('return-drive') && act({ type: 'build', blueprint: 'return-drive' }, 'Construct Return Drive · 60 materials + 150 credits', true)}
        {state.built.includes('return-drive') && <small>The Return Drive is ready. Choose <strong>Return home</strong> in the top bar whenever you like.</small>}
        {!active && breakthroughs < 5 && <small className="exp-idle-note" role="status">{state.autoResearch ? `Laboratory idle. Automatic research starts ${PROJECTS[DRIVE_SEQUENCE.find((id) => !hasTech(state, id))!].name} as soon as it can.` : 'Laboratory idle. No research is progressing.'}</small>}
        <label className="exp-auto-research"><input type="checkbox" checked={!!state.autoResearch} disabled={!!actionLock(state, { type: 'auto-research', enabled: !state.autoResearch })}
          onChange={() => dispatch({ type: 'auto-research', enabled: !state.autoResearch })} />
          <span>Continue the route home automatically<small>When the lab would sit idle, it starts the next Return Drive project it can. Queued projects go first.</small></span></label>
      </section>
      <div className="exp-lab-sections" role="group" aria-label="Laboratory sections">
        <button aria-pressed={section === 'research'} onClick={() => { setSection('research'); setSelected(null) }}>Research catalogue</button>
        <button aria-pressed={section === 'workshop'} onClick={() => { setSection('workshop'); setSelected(null) }}>Fabrication & fitting · {state.built.length} built</button>
      </div>
      {section === 'research' ? BRANCHES.map((branch) => {
        const ids = PROJECT_IDS.filter((id) => PROJECTS[id].branch === branch)
        return <section key={branch} aria-label={branch}>
          <h3 className="exp-lab-group">{branch}<span>{ids.filter((id) => hasTech(state, id)).length}/{ids.length}</span></h3>
          {ids.map((id) => {
            const status = stateOf(id), left = daysLeft(state, id), queued = state.research.queue.indexOf(id)
            return <button key={id} className={`exp-lab-row ${status.toLowerCase().replace(' ', '-')}`} aria-pressed={selected === id} onClick={() => choose(id)}>
              <span><strong>{PROJECTS[id].name}{DRIVE_SEQUENCE.includes(id) && <span className="exp-tag">Route home</span>}</strong>
                <small>{status}{queued >= 0 ? ` · ${queued + 1}` : ''}</small></span>
              <span className="exp-lab-time">{status === 'Complete' ? <b aria-label="complete">✓</b> : PROJECTS[id].future ? <b>—</b> : <><b>{left}</b><small>{active === id ? plural(left, 'day left', 'days left') : plural(left, 'day')}</small></>}</span>
            </button>
          })}
        </section>
      }) : <>
        <div className="exp-slot-summary">{(['engine', 'utility', 'gadget', 'hull'] as Slot[]).map((slot) => <span key={slot}>{slot}<b>{state.equipped.filter((id) => blueprintFor(id)?.slot === slot).length}/{SLOT_LIMITS[slot]}</b></span>)}</div>
        <small>Constructing an upgrade pays for it once. Fit stored modules at no extra cost.</small>
        {buildable.map((id) => {
          const built = state.built.includes(id), equipped = fitted(state, id), cost = blueprintFor(id)!
          return <button key={id} className="exp-lab-row" aria-pressed={selected === id} onClick={() => choose(id)}>
            <span><strong>{buildName(id)}</strong><small>{cost.slot} · {equipped ? 'Fitted' : built ? 'Stored' : 'Blueprint'}</small></span>
            <span className="exp-lab-time">{!built && <><b>{cost.materials}</b><small>materials</small></>}</span>
          </button>
        })}
        {buildable.length === 0 && <div className="exp-empty">Research a hardware project to unlock its construction blueprint.</div>}
      </>}
    </aside>
  </div>

  // Plain render helpers rather than nested components, so focus survives each order.
  function projectDetail(id: ProjectId) {
    const p = PROJECTS[id], progress = researchProgress(state, id), complete = hasTech(state, id), queued = state.research.queue.includes(id)
    const lock = researchRequirements(state, id), drive = DRIVE_SEQUENCE.includes(id)
    return <section key={id} className="exp-lab-detail" aria-label={`${p.name} details`} ref={detailRef}>
      <article aria-label={p.name}>
        <div className="exp-lab-detail-head"><span className="exp-eyebrow">{p.branch} / {stateOf(id)}{drive ? ' / Route home' : ''}</span>
          <button className="exp-close" aria-label="Close details" onClick={() => setSelected(null)}><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12" /></svg></button></div>
        <h2>{p.name}</h2>
        {drive && <CrewLine person="morozova" compact>Every result gives us one more piece of a route home. This is our next step.</CrewLine>}
        <p>{p.effect}</p>
        <div className="exp-dependencies"><span>After</span>{p.requires.length ? p.requires.map((parent) => <button key={parent} onClick={() => setSelected(parent)}>{hasTech(state, parent) ? '✓ ' : ''}{PROJECTS[parent].name}</button>) : <small>No research prerequisites</small>}</div>
        {p.discovery && <p className="exp-prerequisite">{p.discovery === 'any' ? 'Needs one scientific discovery.' : p.discovery === 'exotic' ? 'Needs one exotic-energy discovery.' : 'Needs two independent spatial or alien-propulsion sources; each station archive counts once.'}</p>}
        {id === 'drive-stabilisation' && <p className="exp-prerequisite">Needs a completed prototype field test.</p>}
        {p.blueprint && <p className="exp-blueprint-note">Unlocks a buildable upgrade: {p.blueprint.materials} materials + {p.blueprint.credits} credits · {p.blueprint.slot} slot.</p>}
        {p.future ? <div className="exp-notice">{p.future}. Research is locked until it has a usable effect.</div> : <>
          <div className="exp-progress" role="progressbar" aria-label={`${p.name} progress`} aria-valuemin={0} aria-valuemax={p.days} aria-valuenow={progress}><i style={{ width: `${Math.round(progress * 100 / p.days)}%` }} /></div>
          <div className="exp-project-meta"><span>{progress} / {p.days} work days</span><span>{complete ? 'Complete' : `${daysLeft(state, id)} activity ${plural(daysLeft(state, id), 'day')} remaining`}</span></div>
          <div className="exp-project-controls">
            {act({ type: 'research', project: id }, complete ? 'Research complete' : active === id ? 'Researching as you explore' : progress ? 'Resume research' : 'Begin research', true, false)}
            {active === id ? act({ type: 'pause-research' }, 'Pause research', false, false)
              : !complete && (queued ? act({ type: 'unqueue', project: id }, 'Remove from queue', false, false) : act({ type: 'queue', project: id }, 'Add to queue', false, false))}
            {queued && <>{act({ type: 'move-queue', project: id, direction: -1 }, 'Move up', false, false)}{act({ type: 'move-queue', project: id, direction: 1 }, 'Move down', false, false)}</>}
          </div>
          {!complete && active !== id && lock && <small className="exp-lock-reason">{lock}. You can queue it now; it starts once that is met.</small>}
          {p.blueprint && complete && <div className="exp-blueprint">
            {state.built.includes(id) ? <><small>{fitted(state, id) ? 'Fitted and active' : 'Constructed; stored aboard'}</small>{!fitted(state, id) && act({ type: 'equip', blueprint: id }, 'Fit upgrade')}</>
              : act({ type: 'build', blueprint: id }, `${id === 'deep-survey' ? 'Install array' : 'Construct upgrade'} · ${p.blueprint.materials} materials + ${p.blueprint.credits} credits`)}
          </div>}
        </>}
        {p.discovery && !complete && hasTech(state, 'drive-diagnostics') && <section className="exp-science-leads" aria-label="Scientific leads"><span className="exp-eyebrow">Drive telemetry / scientific leads</span>
          <p>Compatible signatures, nearest first. Station archives offer another route after Contextual Translation.</p>
          {leads.map(({ site, course }) => <button className="exp-button exp-lead" key={site.id} onClick={() => onShowSystem(site.systemId)}>
            <span>{state.galaxy.systems.find((s) => s.id === site.systemId)!.name} · {leadLabel(state)}</span>
            <small>{!course ? 'No course with the current drive' : course.path.length === 1 ? 'In this system' : `${course.path.length - 1} ${plural(course.path.length - 1, 'jump')} · ${course.fuel} fuel`}</small></button>)}
        </section>}
      </article>
    </section>
  }

  function blueprintCard(id: BuildId) {
    const cost = blueprintFor(id)!, built = state.built.includes(id), equipped = fitted(state, id)
    return <article aria-label={buildName(id)}>
      <div className="exp-lab-detail-head"><span className="exp-eyebrow">{cost.slot} / {equipped ? 'Fitted' : built ? 'Stored' : 'Blueprint'}</span>
        <button className="exp-close" aria-label="Close details" onClick={() => setSelected(null)}><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12" /></svg></button></div>
      <h2>{buildName(id)}</h2><p>{id === 'return-drive' ? 'Choose to return home from any system, whenever you are ready.' : PROJECTS[id].effect}</p>
      {!built ? act({ type: 'build', blueprint: id }, `Construct · ${cost.materials} materials + ${cost.credits} credits`, !buildLock(state, id))
        : equipped ? act({ type: 'unequip', blueprint: id }, 'Unfit and store', false, cost.slot !== 'drive' && cost.slot !== 'hull') : act({ type: 'equip', blueprint: id }, 'Fit stored upgrade', true)}
      {id === 'fuel-tanks' && equipped && <small>Unfitting vents any fuel above the standard 80-unit tank capacity.</small>}
    </article>
  }
}

export function DriveTestScene({ state, dispatch }: { state: Campaign; dispatch: (action: CampaignAction) => void }) {
  return state.driveTest === 'calibrating' ? <DriveTestDialog state={state} dispatch={dispatch} /> : null
}
function DriveTestDialog({ state, dispatch }: { state: Campaign; dispatch: (action: CampaignAction) => void }) {
  useDialogDismiss(() => dispatch({ type: 'abort-drive-test' }))
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
  useDialogDismiss(onClose)
  return <div className="exp-modal-backdrop"><section className="exp-modal" role="dialog" aria-modal="true" aria-label="Return home confirmation">
    <span className="exp-eyebrow">ISS LODESTAR / DEPARTURE</span><h2>Set a course for home?</h2><p>The drive is ready. Spinning it up will tear at the rift, and the rift will answer. Survive long enough for the drive to take hold, or destroy what comes, and the voyage ends at home. You can also stay and continue exploring.</p>
    {state.survivorArc&&state.survivorArc.stage!=='complete'&&<p>Someone left behind remains unfinished. You may return home without completing this request.</p>}
    {state.relayArc && state.relayArc.stage!=='complete' && <p>The Long Relay remains unfinished. Returning home leaves Edda or Tarek waiting for a reply; this optional mission does not block departure.</p>}
    <ResearchAction state={state} dispatch={dispatch} action={{ type: 'return-home', finale: 1 }} primary>Activate Return Drive</ResearchAction>
    <button className="exp-button" onClick={onClose}>Keep exploring</button>
  </section></div>
}
export function ExplorationEnding({ state, onExit }: { state: Campaign; onExit: () => void }) {
  const rescued = state.completedOperations.reduce((n, o) => n + o.survivors, 0)
  return <div className="exp-modal-backdrop"><section className="exp-modal exp-ending" role="dialog" aria-modal="true" aria-label="Voyage complete">
    <span className="exp-eyebrow">VOYAGE COMPLETE / DAY {state.day}</span><h2>A familiar sky.</h2>
    <p>At first, nobody says anything. Then the navigation console finds a star with a name the crew learned at school.</p>
    {state.lastShipBattle?.kind === 'finale' && <p>{state.lastShipBattle.result === 'victory' ? 'Behind them, the Ashen Sovereign is a cloud of cooling metal at the mouth of the rift.' : state.lastShipBattle.result === 'yielded' ? 'Behind them, the Ashen Sovereign drifts dark at the mouth of the rift, its crew watching them go.' : 'Behind them, the Ashen Sovereign is still firing into the place where the Lodestar used to be.'}{state.hardcore ? ' A hardcore voyage, brought home.' : ''}</p>}
    <p>Morozova checks the reading twice. Vale lets her finish. “Send our identification,” he says. “Tell them we’re home.”</p>
    <div className="exp-ending-stats"><span><b>{state.visited.length}</b>{plural(state.visited.length, 'system')} visited</span><span><b>{state.findings.length}</b>scientific {plural(state.findings.length, 'source')}</span><span><b>{state.research.completed.length}</b>{plural(state.research.completed.length, 'project')} completed</span></div>
    <p>{state.findings.some((f) => f.sourceName) ? 'The knowledge shared by distant stations travelled home with you.' : 'The observations and recovered machinery that made the journey possible are secured in the science archive.'}</p>
    {state.stories.length > 0 && <p>Your captain’s record holds {state.stories.length} {plural(state.stories.length, 'decision')} made beyond charted space.{state.lettersDelivered ? ' And 143 letters reached the people who had waited for them.' : state.stories.some((r) => r.storyId === 'last-post' && r.choiceId === 'carry') ? ' The Courier’s undelivered letters come home with you; their journey can finally end.' : ''}</p>}
    {state.survivorArc&&<p>{state.survivorArc.survivor.name}: {survivorSummary(state.survivorArc)} {state.survivorArc.stage!=='complete'?'The station conversation remains unfinished.':'The survivor heard your report.'}</p>}
    {state.relayArc && <p>{state.relayArc.stage==='complete' ? state.relayArc.approach==='repair' ? 'The Long Relay is working again. Tarek’s answer reached Edda, and the communities along the line have their connection back.' : 'Edda received Tarek’s private reply. The wider line remains broken, but the words meant for one family reached them.' : state.relayArc.stage==='accepted' ? 'Edda’s message remains aboard, unanswered. The promised visit to Tarek will have to wait.' : 'Tarek’s reply is still aboard. Edda never received the answer she hoped for.'}</p>}
    {state.completedOperations.length > 0 && <p>{state.completedOperations.length} boarding {plural(state.completedOperations.length, 'contract')} completed.{rescued > 0 && ` ${rescued} rescued ${plural(rescued, 'surveyor has', 'surveyors have')} another chance to see their families.`}</p>}
    {state.escortCompleted.length > 0 && <p>{state.escortCompleted.length} survey {plural(state.escortCompleted.length, 'tender reached its destination', 'tenders reached their destinations')} under the Lodestar’s protection.</p>}
    {state.roster.some((o) => o.dead) && <p>The crew reads the names of those who did not return: {state.roster.filter((o) => o.dead).map((o) => o.name).join(', ')}.</p>}
    {state.roster.some((o) => o.missions > 0 && !o.dead) && <p>The shuttle crews bring their mission records home, too. Every return to the hangar mattered.</p>}
    <p>{hasTech(state, 'slipstream') ? 'Your navigators leave a chart of shortcuts for the next ship to follow.' : 'Every lane in the voyage log marks a place the Lodestar reached under her own power.'}</p>
    <button className="exp-button primary" onClick={onExit}>Return to title</button>
  </section></div>
}
