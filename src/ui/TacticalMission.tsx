import { operativePortrait, gunName, enemyAppearance } from './tactical-identity.js'
import { playTacticalCue, cueForTacticalOrder } from './tactical-audio.js'
import { ReportImage } from './ReportImage.js'
import { CrewLine } from './crew-presence.js'
import { TacticalBoard } from './TacticalBoard.js'
import { movementPreview, orderFeedback } from './tactical-guidance.js'
import { DECK_NAMES, DECK_NOTES, siteVariant } from '../engine/tactical/variants.js'
import { OPERATION_KINDS, OPERATION_BRIEFINGS, operationArt } from '../engine/tactical/operations.js'
import type { OperationKind } from '../engine/tactical/operations.js'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { rankOf } from './ranks.js'
import { useEnemyPlayback } from './tactical-playback.js'
import type { Campaign, CampaignAction } from '../engine/exploration/campaign.js'
import { actionLock, boardingLoadoutCost, hasTech } from '../engine/exploration/campaign.js'
import { DEFAULT_LOADOUT, operationStatus, operationReward, interactionLabel, distance, extractionLosses, inExtraction, ROLE_NOTES, shotInfo, tacticalLock, visible } from '../engine/tactical/mission.js'
import type { Mission, OperativeLoadout, Point, TacticalAction, TacticalUnit } from '../engine/tactical/mission.js'
import { MuteButton } from './sound.js'
import { useDialogDismiss } from './dialog.js'
import { plural } from './plural.js'
import './tactical.css'

type Dispatch = (action: CampaignAction) => void
export function AwayTeam({ state, locationId, dispatch, onClose }: { state: Campaign; locationId: string | null; dispatch: Dispatch; onClose: () => void }) {
  useDialogDismiss(onClose)
  const [squad, setSquad] = useState(state.roster.filter((o) => !o.dead && o.injuredUntil <= state.day).slice(0, 4).map((o) => o.id))
  const site = state.world.locations.find((s) => s.id === locationId)
  const station = state.world.locations.find((s) => s.systemId === state.at && s.kind === 'station' && ['investigated', 'resolved'].includes(state.exploration.statuses[s.id] ?? ''))
  const recorder=state.survivorArc?.stage==='accepted'&&state.survivorArc.destinationId===locationId
  const [operation, setOperation] = useState<OperationKind | 'core'>('rescue')
  const variant = siteVariant(state.seed, locationId ?? '')
  const briefing = operation === 'core' ? null : OPERATION_BRIEFINGS[operation]
  const deploy: CampaignAction = recorder?{type:'deploy-recorder',squad}:operation === 'core' ? { type: 'deploy', locationId: locationId ?? '', squad } : { type: 'deploy-operation', locationId: locationId ?? '', squad, kind:operation, variant, rememberSurvivors:true }
  const lock = actionLock(state, deploy)
  return <div className="exp-modal-backdrop"><section className="exp-modal away-team" role="dialog" aria-modal="true" aria-label="Away team">
    <span className="exp-eyebrow">ISS Lodestar / shuttle bay</span><h2>{site ? 'Choose your four.' : 'The away team.'}</h2>
    <p>{site ? `${site.name}. ${recorder?2:Math.min(4, 2 + site.threat)} autonomous custodians guard the deck.` : 'Six berths. Each operative keeps their service record. Injuries heal as campaign days pass.'}</p>
    <CrewLine person="cross" compact>A good mission is one we finish with everyone aboard. Choose a team and check the risks.</CrewLine>
    {site && !recorder && <section className="operation-briefing" aria-label="Mission briefing"><label>Mission contract<select aria-label="Mission contract" value={operation} onChange={(e) => setOperation(e.target.value as OperationKind | 'core')}>
      {OPERATION_KINDS.map((kind) => <option key={kind} value={kind}>{kind[0]!.toUpperCase() + kind.slice(1)} · {OPERATION_BRIEFINGS[kind].title}</option>)}<option value="core">Core recovery · original mission</option>
    </select></label>{site && <img className="away-briefing-art" src={operation === 'core' ? `/assets/exploration/${site.kind === 'ruins' ? 'buried-observatory' : 'silent-courier'}.webp` : operationArt(operation)} alt="Boarding destination environment" />}{briefing && <><h3>{briefing.title}</h3>{operation !== 'core' && <p className="operation-layout"><strong>{DECK_NAMES[operation][variant - 1]}</strong>{DECK_NOTES[operation][variant - 1]}</p>}<p>{briefing.description}</p><p className="operation-voice">{briefing.voice}</p><strong>{briefing.reward}</strong><small>{briefing.warning}</small></>}<small>Choose one operation for this site. A successful extraction also recovers its normal cargo and science, closing the other contracts.</small></section>}
    {site&&recorder&&<section className="operation-briefing"><h3>Someone left behind</h3><ReportImage eventId="survivor" compact /><p>Lift the recorder for 1 AP. The carrier moves two tiles per AP and cannot sprint. Set it down for 1 AP to transfer it to a nearby operative. A downed carrier drops it automatically.</p><strong>Two reserve custodians arrive from the far airlock: one on the next enemy turn after pickup, the second two enemy turns later.</strong><p>Bring the carrier to the shuttle and extract for evidence, or withdraw without it. The decision ends this request’s field visit. Acknowledge the survivor at the original station: 24 credits for evidence, no payment for withdrawal.</p><small>1 campaign day on debrief · no normal site cargo or science · crew losses persist.</small></section>}
    {site && !recorder && <div className="exp-notice">Optional mission · 1 campaign day · normal cargo and science, with the selected operation’s bonus on success. Wounded survivors need medical rest. Anyone left behind is permanently lost.</div>}
    <div className="away-roster">{state.roster.map((o) => {
      const ready = !o.dead && o.injuredUntil <= state.day
      return <button key={o.id} className={`away-person ${o.dead ? 'lost' : ''}`} aria-pressed={!!site && squad.includes(o.id)} disabled={!site || !ready}
        onClick={() => setSquad(squad.includes(o.id) ? squad.filter((id) => id !== o.id) : squad.length < 4 ? [...squad, o.id] : squad)}>
        <span className="away-portrait" aria-hidden="true" style={{ backgroundImage: `url(${operativePortrait(o)})` }} /><span><strong><em>{rankOf(o)}</em> {o.name}</strong><small>{o.role} · {o.dead ? 'LOST' : ready ? 'READY' : `${o.injuredUntil - state.day} ${plural(o.injuredUntil - state.day, 'day')} recovery`}</small><small>{ROLE_NOTES[o.role]}</small><small>{o.missions} {plural(o.missions, 'mission')} · {o.xp} service XP</small></span>
      </button>
    })}</div>
    <section className="away-equipment" aria-label="Field equipment"><details open={hasTech(state, 'plasma-ballistics') || hasTech(state, 'personal-shields')}><summary>Field equipment · weapons & gadgets</summary><p>Standard weapons and medkits are free. Advanced gear costs 2 materials per item each time the team deploys.</p>
      <small>Plasma: +2 damage, two-round magazine. Shield: absorbs 4 damage, no recharge; replaces that operative’s medkit.</small>
      {state.roster.filter((o) => !o.dead && (!site || squad.includes(o.id))).map((o) => {
        const gear = state.loadouts[o.id] ?? DEFAULT_LOADOUT
        const change = (patch: Partial<OperativeLoadout>) => dispatch({ type: 'loadout', operativeId: o.id, ...gear, ...patch })
        return <div className="away-gear-row" key={o.id}><strong>{o.name}</strong>
          <label>Weapon<select aria-label={`${o.name} weapon`} value={gear.weapon} onChange={(e) => change({ weapon: e.target.value as OperativeLoadout['weapon'] })}><option value="standard">Standard · free</option><option value="plasma" disabled={!hasTech(state, 'plasma-ballistics')}>Plasma · {hasTech(state, 'plasma-ballistics') ? '2 materials' : 'research required'}</option></select></label>
          <label>Gadget<select aria-label={`${o.name} gadget`} value={gear.gadget} onChange={(e) => change({ gadget: e.target.value as OperativeLoadout['gadget'] })}><option value="medkit">Medkit · free</option><option value="shield" disabled={!hasTech(state, 'personal-shields')}>Shield · {hasTech(state, 'personal-shields') ? '2 materials' : 'research required'}</option></select></label>
        </div>
      })}
    </details></section>
    {site && <div className="away-deploy"><p>Deployment equipment: {boardingLoadoutCost(state, squad)} materials. {squad.length}/4 selected. Select a crew member to free a place.</p><button className="exp-button primary" disabled={!!lock} onClick={() => { dispatch(deploy); onClose() }}>Deploy away team</button>{lock && <small>{lock}</small>}</div>}
    {!site && <>
      <button className="exp-button" disabled={!!actionLock(state, { type: 'rest-team' })} onClick={() => dispatch({ type: 'rest-team' })}>Medical rest · 1 day · no cost</button>
      {station ? <><button className="exp-button" disabled={!!actionLock(state, { type: 'recruit', locationId: station.id })} onClick={() => dispatch({ type: 'recruit', locationId: station.id })}>Recruit replacement · 20 credits · 1 day</button><small>{actionLock(state, { type: 'recruit', locationId: station.id }) ?? 'A named operative can join your team here.'}</small></> : <p>Contact a station to recruit replacements for lost operatives. Station contracts can fund recruitment.</p>}
      <small>Service XP records experience. Research in Weapons and Defence unlocks plasma weapons and personal shields.</small>
    </>}
    <button className="exp-text-button" onClick={onClose}>{site ? 'Cancel deployment' : 'Back to ship'}</button>
  </section></div>
}
const ROLE_LABEL: Record<TacticalUnit['role'], string> = { assault: 'Assault', recon: 'Recon', engineer: 'Engineer', medic: 'Medic', heavy: 'Heavy' }
/** A segmented bar: one block per point, so counts read at a glance. */
function StatBar({ label, name, value, max, color, text }: { label: string; name: string; value: number; max: number; color: string; text: string }) {
  return <div className="tac-stat"><span>{label}</span>
    <span className="tac-seg" role="meter" aria-label={name} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-valuetext={text} style={{ width: max * 11 - 2 }}>
      <i style={{ width: Math.max(0, value * 11 - 2), backgroundImage: `repeating-linear-gradient(90deg,${color} 0 9px,transparent 9px 11px)` }} /></span></div>
}
const icon = (d: ReactNode) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">{d}</svg>

export function TacticalMission({ state, dispatch, onExit, saved }: { state: Campaign; dispatch: Dispatch; onExit: () => void; saved: boolean }) {
  const playback = useEnemyPlayback()
  const playing = !!playback.frame
  const m = playback.frame?.mission ?? state.mission!
  const loadedRolls = useRef(m.rolls)
  const skipPlayback = () => { loadedRolls.current=state.mission!.rolls; playback.skip() }
  const crew = m.units.filter((u) => u.side === 'crew')
  const [selected, setSelected] = useState((crew.find((unit) => unit.hp > 0) ?? crew[0]!).id)
  const [destination, setDestination] = useState<Point | null>(null)
  const [targetId, setTarget] = useState<string | null>(null)
  const [confirmExtract, setConfirmExtract] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [objectiveOpen, setObjectiveOpen] = useState(true)
  const [lastOrder, setLastOrder] = useState<{before:Mission;action:TacticalAction}|null>(null)
  const feedback = lastOrder ? orderFeedback(lastOrder.before,m,lastOrder.action) : null
  const previousShot = useRef(m.rolls)
  useEffect(() => {
    if(m.rolls !== previousShot.current && m.lastShot && !playing) {
      playTacticalCue(m.lastShot.hit ? (m.lastShot.damage === 0 ? 'shield' : 'impact') : 'miss')
    }
    previousShot.current = m.rolls
  }, [m.rolls, m.lastShot, playing])
  useEffect(() => {
    if(!playback.frame || playback.frame.kind === 'start')return
    if(playback.frame.kind === 'shot')playTacticalCue('fire')
    else if(playback.frame.kind === 'move')playTacticalCue('move')
    else if(playback.frame.kind === 'reserve' || playback.frame.kind === 'heat')playTacticalCue('alarm')
    else if(playback.frame.kind === 'reload')playTacticalCue('reload')
  }, [playback.index, playback.frame?.kind, playback.frame?.mission.rolls])
  const u = crew.find((unit) => unit.id === selected)!
  const rank = (unit: TacticalUnit) => rankOf(state.roster.find((o) => o.id === unit.id))
  // Movement costs follow the distance: a walk for 1 AP, or a sprint for 2 when the walk falls short.
  const sprintTo = (p: Point) => !!tacticalLock(m, { type: 'move', unitId: u.id, ...p, sprint: false }) && !tacticalLock(m, { type: 'move', unitId: u.id, ...p, sprint: true })
  const sprint = destination ? sprintTo(destination) : false
  const hostiles = m.units.filter((unit) => unit.side === 'hostile' && unit.hp > 0 && visible(m, unit))
  const target = hostiles.find((unit) => unit.id === targetId)
  const shot = target ? shotInfo(m, u, target) : null
  const preview = destination ? movementPreview(m,u.id,destination,sprint) : null
  const losses = extractionLosses(m)
  const civiliansLeft = m.operation?.survivors.filter((s) => !s.evacuated) ?? []
  const abandoning = losses.length > 0 || civiliansLeft.length > 0
  const order = (action: TacticalAction) => { if(playback.busy.current || tacticalLock(state.mission!,action))return; playTacticalCue(cueForTacticalOrder(action, m.units.find(unit=>unit.id===('unitId' in action?action.unitId:'')))); if(action.type==='end-turn')playback.start(state.mission!); setLastOrder({before:m,action}); dispatch({ type: 'tactical', order: action }); setDestination(null); setTarget(null) }
  const lockOf = (action: TacticalAction) => playing ? 'Hostile turn playing — skip to continue' : tacticalLock(m, action)
  const control = (action: TacticalAction, label: string, primary = false) => {
    const lock = lockOf(action)
    return <button className={`exp-button ${primary ? 'primary' : ''}`} title={lock ?? label} disabled={!!lock} onClick={() => order(action)}>{label}</button>
  }
  const quick = (action: TacticalAction, glyph: ReactNode, label: string, note: string, title: string) => {
    const lock = lockOf(action)
    return <button className="tac-act" disabled={!!lock} title={lock ?? title} onClick={() => order(action)}>{icon(glyph)}<span>{label}<small>{note}</small></span></button>
  }
  const menuItem = (action: TacticalAction, label: string, note = '1 AP') => {
    const lock = lockOf(action)
    return <button key={label} className="tac-menu-item" disabled={!!lock} title={lock ?? undefined} onClick={() => order(action)}><span>{label}</span><small>{note}</small></button>
  }
  const selectUnit = (id: string) => { if(id!==selected)playTacticalCue('select');setSelected(id); setDestination(null); setTarget(null) }
  const moveTo = (p: Point) => order({ type: 'move', unitId: u.id, ...p, sprint: sprintTo(p) })
  const onTile = (p: Point, immediate: boolean) => { if (immediate || (destination?.x === p.x && destination.y === p.y)) moveTo(p); else { setDestination(p); setTarget(null) } }
  const onTarget = (id: string, immediate: boolean) => { if (immediate || targetId === id) order({ type: 'shoot', unitId: u.id, targetId: id }); else { setTarget(id); setDestination(null) } }
  useEffect(()=>{
    const key=(e:KeyboardEvent)=>{
      if(e.key==='Escape' && playback.busy.current){e.preventDefault();skipPlayback();return}
      if(confirmExtract || playback.busy.current || m.outcome!=='active' || e.repeat || e.ctrlKey || e.metaKey || e.altKey || (e.target as HTMLElement).closest('input,select,textarea,[contenteditable=true]'))return
      const index=Number(e.key)-1
      if(index>=0 && index<crew.length){e.preventDefault();selectUnit(crew[index]!.id)}
      if(e.key.toLowerCase()==='n'){const i=crew.indexOf(u);const next=[...crew.slice(i+1),...crew.slice(0,i)].find(c=>c.hp>0&&c.ap>0);if(next){e.preventDefault();selectUnit(next.id)}}
      const action:TacticalAction|null=e.key==='Enter'&&e.shiftKey?{type:'end-turn'}:e.key.toLowerCase()==='r'?{type:'reload',unitId:u.id}:e.key.toLowerCase()==='o'?{type:'overwatch',unitId:u.id}:e.key.toLowerCase()==='f'&&target?{type:'shoot',unitId:u.id,targetId:target.id}:null
      if(action){e.preventDefault();order(action)}
    }
    window.addEventListener('keydown',key);return ()=>window.removeEventListener('keydown',key)
  })
  if (m.outcome !== 'active') {
    const lost = crew.filter((o) => !m.rescued.includes(o.id))
    return <main className="exp-deck tac-results"><section className="exp-modal exp-ending" aria-label="Mission debrief">
      <span className="exp-eyebrow">Shuttle return / {m.turn} turns</span><h2>{m.outcome === 'success' ? 'Something worth bringing home.' : m.outcome === 'retreat' ? 'Another way in.' : 'An empty shuttle.'}</h2>
      {m.recorder&&<><h3>{m.outcome==='success'?'Evidence aboard':'Recorder left behind'}</h3><p>{operationStatus(m)}</p><p>No normal site cargo or science. Return to the survivor at the marked station to close the request.</p></>}
      {m.operation && <><img className="operation-report-art" src={operationArt(m.operation.kind)} alt={`${m.operation.kind} operation environment`} /><p>{operationStatus(m)}</p>{m.outcome === 'success' && <p>Normal site cargo and science, plus <strong>{operationReward(m).materials} materials + {operationReward(m).credits} credits</strong>.{m.operation.kind === 'rescue' && ` ${civiliansLeft.length} ${plural(civiliansLeft.length, 'civilian')} left behind.`}</p>}</>}
      <p>{m.recorder?'This field visit is over. Crew records and the survivor’s next conversation are applied on acknowledgement.':m.operation ? m.outcome === 'success' ? 'The shuttle returns with something that remote instruments could not bring back.' : m.outcome === 'retreat' ? 'The team withdrew. No reward; the site remains available for another approach.' : 'There is no answer from the team. Their names stay in the service record.' : m.outcome === 'success' ? 'The core is secured. Morozova is waiting in the hangar before the shuttle doors open.' : m.outcome === 'retreat' ? 'The team withdrew without the core. We can return later, or finish the recovery with remote instruments.' : 'The custodians have gone quiet. There is no answer from the team. The ship can continue, but their names stay in the service record.'}</p>
      <div className="exp-ending-stats"><span><b>{m.rescued.length}</b>returned</span><span><b>{lost.length}</b>lost</span><span><b>1</b>campaign day</span></div>
      <ul className="tac-roll">{crew.map((o) => <li key={o.id}><strong><em>{rank(o)}</em> {o.name}</strong><span>{!m.rescued.includes(o.id) ? 'Lost' : o.hp < o.maxHp ? `Medical recovery: ${state.research.completed.includes('trauma-protocols') ? 2 : 4} days` : 'Fit for duty'}</span></li>)}</ul>
      <p>Rewards and crew records are applied when you acknowledge this report.</p>
      <button className="exp-button primary" onClick={() => dispatch({ type: 'debrief' })}>Return to the Lodestar</button>
      <small>{saved ? 'Mission report saved' : 'Autosave unavailable — keep this tab open'}</small>
    </section></main>
  }
  const missionTag = m.recorder ? 'Recorder' : m.operation ? m.operation.kind : m.recovered ? 'Extract' : 'Recover core'
  const interact: TacticalAction = { type: 'interact', unitId: u.id }
  return <main className={`exp-deck tactical-deck atmosphere-${m.recorder?'archive':m.operation?.kind ?? 'core'} ${expanded?'deck-focus':''}`}>
    <div className="tac-workspace" inert={confirmExtract}>
      <aside inert={playing} className="tac-orders" tabIndex={-1} aria-label="Operative orders">
        <div className="tac-orders-head">
          <span className="tac-turn" role="status" aria-label={`Turn ${m.turn}`}>TURN <b>{m.turn.toString().padStart(2, '0')}</b></span>
          <button className="tac-mission-tag" aria-expanded={objectiveOpen} aria-controls="tac-objective" title="Mission objective" onClick={() => setObjectiveOpen(!objectiveOpen)}>{missionTag}</button>
        </div>
        {objectiveOpen && <section id="tac-objective" className="tac-objective" aria-label="Mission objective">
          <span className="exp-eyebrow">{m.name}{m.operation ? ` / ${OPERATION_BRIEFINGS[m.operation.kind].title}` : m.recorder ? ' / Someone left behind' : ''}</span>
          <p>{operationStatus(m)}</p>
          {m.operation?.kind === 'rescue' && <div className="operation-tracker">{m.operation.survivors.map((s) => <p key={s.id}>{s.name}<small>{s.evacuated ? 'Safely aboard' : `${s.x+1},${s.y+1} · ${s.leader ? `following ${crew.find((c) => c.id === s.leader)?.name}${crew.find((c) => c.id === s.leader)?.hp === 0 ? ' · escort DOWN; send help' : ''}` : 'waiting for an escort'}`}</small></p>)}</div>}
          <small>Extraction needs a conscious operative in the shuttle zone. Revive downed crew with a medkit.</small>
        </section>}
        {control({ type: 'end-turn' }, 'End turn · hostiles act', true)}
        <div className="tac-rule" />
        <span className="exp-eyebrow">Squad</span>
        <div className="tac-squad" role="list" aria-label="Squad">{crew.map((unit, i) => {
          const open = selected === unit.id
          return <div role="listitem" key={unit.id}>
            <button className="tac-sq" aria-expanded={open} onClick={() => selectUnit(unit.id)}>
              <img className="tac-sq-face" src={operativePortrait(unit)} alt="" loading="lazy"/>
              <span className="tac-sq-top"><small>0{i + 1} / {ROLE_LABEL[unit.role]}</small><small>{unit.hp > 0 ? `${unit.hp}/${unit.maxHp} HP · ${unit.ap}/2 AP` : 'DOWNED'}</small></span>
              <strong><em>{rank(unit)}</em> {unit.name}</strong>
              <span className="tac-hp" aria-hidden="true"><i style={{ width: `${unit.hp * 100 / unit.maxHp}%` }} /></span>
            </button>
            {open && <section className="tac-sq-detail" aria-label={`${unit.name} details`}>
              <div className="tac-sq-kit">
                <div className="tac-portrait" role="img" aria-label={`${unit.name}, ${ROLE_LABEL[unit.role].toLowerCase()} operative`} style={{ backgroundImage: `url(${operativePortrait(unit)})` }} />
                <div className="tac-weapon" title={`${gunName(unit)} · ${unit.damage} damage · ${unit.magazine}-round magazine`}>
                  <svg width="56" height="16" viewBox="0 0 56 16" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" aria-hidden="true"><path d="M1 6h29l3-3h9v3h13v3H38l-3 2H23l-3 4h-5l2-4H7l-2 2H1z" /><path d="M25 11l-1 4M42 3V1h4" /></svg>
                  <small>{gunName(unit)}</small>
                </div>
              </div>
              <div className="tac-sq-stats">
                <h2><em>{rank(unit)}</em> {unit.name}</h2><small className="tac-active-weapon">Equipped · {gunName(unit)}</small>
                <StatBar label="HEALTH" name="Health" value={unit.hp} max={unit.maxHp} color={unit.hp * 2 < unit.maxHp ? '#f0a77c' : '#71e0d6'} text={`${unit.hp}/${unit.maxHp} health`} />
                <StatBar label="AP" name="Action points" value={unit.ap} max={2} color="#9fd3e6" text={`${unit.ap}/2 AP`} />
                <StatBar label="AMMO" name="Ammunition" value={unit.ammo} max={unit.magazine} color="#e2c98f" text={`${unit.ammo}/${unit.magazine} ammunition`} />
                <StatBar label="DAMAGE" name="Damage" value={unit.damage} max={Math.max(5, unit.damage)} color="#f0a77c" text={`${unit.damage} damage${unit.weapon === 'plasma' ? ' · plasma' : ''}`} />
                <StatBar label="MOVE" name="Movement" value={m.recorder?.carrierId === unit.id ? 2 : unit.move} max={5} color="#b9c9f2" text={`${m.recorder?.carrierId === unit.id ? 2 : unit.move} tiles per AP`} />
                {unit.shield !== undefined && <StatBar label="SHIELD" name="Shield" value={unit.shield} max={4} color="#83d6f0" text={`${unit.shield}/4 shield`} />}
                {(unit.aimed || unit.overwatch || m.recorder?.carrierId === unit.id || unit.hp === 0) && <div className="tac-flags">
                  {unit.hp === 0 && <span>Downed</span>}{unit.aimed && <span>Aimed</span>}{unit.overwatch && <span>Overwatch</span>}{m.recorder?.carrierId === unit.id && <span>Recorder</span>}</div>}
              </div>
            </section>}
          </div>
        })}</div>
        <small className="tac-saved">{saved ? 'Orders saved' : 'Autosave unavailable'}</small>
      </aside>
      <section className="tac-arena" aria-label="Tactical map" tabIndex={-1}>
        <div className="tac-deck-label" aria-live="polite">{m.recorder?'Archive vault':m.operation?.kind==='rescue'?'Quarantine and medical':m.operation?.kind==='salvage'?'Salvage and thermal':m.operation?.kind==='sabotage'?'Security relay':'Derelict recovery'} <span>{m.operation?.variant ? 'sector '+m.operation.variant : 'boarding deck'}</span></div>
        {playing&&<section className="tac-playback" role="status" aria-label="Enemy turn playback"><span>HOSTILE TURN · {playback.index}/{playback.total-1}</span><strong>{playback.frame!.label}</strong><button onClick={()=>playback.setSpeed(playback.speed===1?2:1)}>{playback.speed}× speed</button><button onClick={skipPlayback}>Skip playback <kbd>Esc</kbd></button></section>}
        <div className={`tac-scroll ${expanded ? 'expanded' : ''}`} inert={playing}>
          <TacticalBoard key={playback.reset} m={m} unitId={u.id} sprint={sprint} destination={destination} selected={selected} targetId={targetId} loadedRolls={loadedRolls.current} activeActor={playback.frame?.actorId} playbackSpeed={playing?playback.speed:1}
            onHoverTile={(p) => { setDestination(p); setTarget(null) }} onTile={onTile} onSelect={selectUnit}
            onHoverTarget={(id) => { setTarget(id); setDestination(null) }} onTarget={onTarget} onLeave={() => { setDestination(null); setTarget(null) }} />
        </div>
        <div className="tac-overlay-tools" inert={playing}>
          <button className="exp-button" onClick={() => setExpanded(!expanded)}>{expanded ? 'Fit map' : 'Enlarge map'}</button>
          <button className="exp-button" disabled={playing || !!tacticalLock(m, { type: 'extract', abandon: true })} title={tacticalLock(m, { type: 'extract', abandon: true }) ?? undefined} onClick={() => setConfirmExtract(true)}>Extract team</button>
          <button className="exp-button" onClick={onExit}>Save & title</button>
          <MuteButton icon />
        </div>
        {(preview || (target && shot)) && !playing && <div className="tac-intent">
          {preview && destination && (preview.lock ? <div className="tac-move-preview"><strong>Out of reach</strong><small>{preview.lock}</small></div>
            : <div className="tac-move-preview" aria-label="Movement preview"><strong>{sprint ? 'Sprint' : 'Move'} to {destination.x + 1},{destination.y + 1} · {preview.cost} AP → {preview.remainingAP} AP left</strong>
              {preview.threats.length ? <p>{preview.threats.length} visible guard{preview.threats.length===1?'':'s'} can fire here.</p> : <p>No visible guard has a shot here.</p>}
              {preview.threats.map((e)=><span key={e.id}>{e.name}: {e.chance}% to hit · {e.cover ? e.cover===40?'full cover':'half cover' : 'no cover'}</span>)}
              {preview.heat>0 && <p className="tac-danger">End-turn heat here: −{preview.heat} health. Shields do not protect against heat.</p>}
              {preview.remainingAP===0 && <p>No AP left after this move: you cannot fire or interact until next turn.</p>}
              <small>Click to move. Guards may move. Unseen threats are not included.</small></div>)}
          {target && shot && <div className="tac-shot">
            <span className="tac-enemy-intel">Visual identification · {enemyAppearance(target).name}</span>
            <strong>{shot.possible ? `Fire at ${target.name} · ${shot.chance}%` : `No clear shot at ${target.name}`}</strong>
            <small>75 base − {shot.cover} cover − {shot.rangePenalty} range + {shot.aim} aim · {target.hp} HP</small>
            <small>{lockOf({ type: 'shoot', unitId: u.id, targetId: target.id }) ?? 'Click to fire · 1 AP'}</small></div>}
        </div>}
        {feedback && !playing && !preview && !target && <section className="tac-feedback" aria-label="Last order" role="status"><strong>{feedback.title}</strong>{feedback.details.map((line,i)=><span key={i}>{line}</span>)}</section>}
        <nav inert={playing} className="tac-quickbar" aria-label="Tactical quick actions">
          <div className="tac-actwrap">
            <div className="tac-actmenu" role="group" aria-label={`Actions for ${rank(u)} ${u.name}`}><div>
              {menuItem({ type: 'reload', unitId: u.id }, 'Reload', `${u.ammo}/${u.magazine} ammo · 1 AP`)}
              {menuItem(interact, interactionLabel(m))}
              {m.recorder?.carrierId === u.id && menuItem({ type: 'drop-recorder', unitId: u.id }, 'Set recorder down')}
              {crew.filter((c) => c.id !== u.id && c.hp < c.maxHp && distance(c, u) <= 1).map((c) => menuItem({ type: 'heal', unitId: u.id, targetId: c.id }, `Medkit: ${c.name}`))}
              {crew.filter((c) => c.hp === 0 && distance(c, u) <= 1 && inExtraction(u)).map((c) => menuItem({ type: 'evacuate', unitId: u.id, targetId: c.id }, `Pull ${c.name} aboard`))}
            </div></div>
            <button className="tac-act" aria-haspopup="true">{icon(<path d="M8 4l11 8-5 1.2 3 5.6-2.4 1.2-3-5.6L8 18z" />)}<span>ACTION<small>RELOAD · ITEM · AID</small></span></button>
          </div>
          {quick({ type: 'aim', unitId: u.id }, <><circle cx="12" cy="12" r="7" /><path d="M12 2v5M12 17v5M2 12h5M17 12h5" /></>, 'AIM', '+20% · 1 AP', 'Steady the next shot: +20% to hit')}
          {quick({ type: 'overwatch', unitId: u.id }, <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></>, 'OVERWATCH', '1 AP', 'Fire once at a hostile that moves in sight')}
          {quick({ type: 'heal', unitId: u.id, targetId: u.id }, <path d="M12 5v14M5 12h14" />, 'HEAL SELF', '1 AP', 'Use a medkit on this operative')}
          <button className="tac-act tac-quick-end" disabled={playing} title="End turn and resolve hostile orders" onClick={() => order({ type: 'end-turn' })}>{icon(<path d="M19 12a7 7 0 1 1-2.05-4.95M19 4v4h-4" />)}<span>END TURN<small>HOSTILES ACT</small></span></button>
        </nav>
      </section>
    </div>
    {confirmExtract && <div className="exp-modal-backdrop"><EscapeDismisses onDismiss={() => setConfirmExtract(false)} /><section className="exp-modal" role="dialog" aria-modal="true" aria-label="Confirm extraction"><span className="exp-eyebrow">Shuttle / departure</span><h2>{abandoning ? 'Leave them behind?' : 'Bring them home.'}</h2><p>{m.recorder?`${operationStatus(m)} Leaving ends this field visit. No normal site cargo will be paid.`:m.operation ? `${operationStatus(m)} ${m.recovered ? 'This departure closes the site and pays the earned bonus.' : 'No objective secured: no reward. You can return later.'}` : m.recovered ? 'The core is secured.' : 'The core has not been recovered. You can return to this location later.'}</p>{civiliansLeft.length > 0 && <p className="operation-loss">Civilians left behind: {civiliansLeft.map((s) => s.name).join(', ')}. They are not aboard yet.</p>}<p>{losses.length ? `Permanently lost if you leave now: ${losses.map((o) => o.name).join(', ')}.` : 'All four operatives are in the shuttle zone, including anyone downed.'}</p><button className="exp-button primary" onClick={() => { order({ type: 'extract', abandon: abandoning }); setConfirmExtract(false) }}>{abandoning ? 'Confirm extraction and losses' : 'Confirm safe extraction'}</button><button className="exp-button" autoFocus onClick={() => setConfirmExtract(false)}>Keep the shuttle waiting</button></section></div>}
  </main>
}

function EscapeDismisses({ onDismiss }: { onDismiss: () => void }) {
  useDialogDismiss(onDismiss)
  return null
}
