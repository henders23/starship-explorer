import { TacticalBoard } from './TacticalBoard.js'
import { movementPreview, orderFeedback } from './tactical-guidance.js'
import { DECK_NAMES, DECK_NOTES, siteVariant } from '../engine/tactical/variants.js'
import { figureAsset } from './TacticalFigure.js'
import { OPERATION_KINDS, OPERATION_BRIEFINGS, operationArt } from '../engine/tactical/operations.js'
import type { OperationKind } from '../engine/tactical/operations.js'
import { useRef, useState } from 'react'
import type { Campaign, CampaignAction } from '../engine/exploration/campaign.js'
import { actionLock, boardingLoadoutCost, hasTech } from '../engine/exploration/campaign.js'
import { DEFAULT_LOADOUT, operationStatus, operationReward, interactionLabel, distance, extractionLosses, inExtraction, ROLE_NOTES, shotInfo, tacticalLock, visible } from '../engine/tactical/mission.js'
import type { Mission, OperativeLoadout, Point, TacticalAction } from '../engine/tactical/mission.js'
import './tactical.css'

type Dispatch = (action: CampaignAction) => void
export function AwayTeam({ state, locationId, dispatch, onClose }: { state: Campaign; locationId: string | null; dispatch: Dispatch; onClose: () => void }) {
  const [squad, setSquad] = useState(state.roster.filter((o) => !o.dead && o.injuredUntil <= state.day).slice(0, 4).map((o) => o.id))
  const site = state.world.locations.find((s) => s.id === locationId)
  const station = state.world.locations.find((s) => s.systemId === state.at && s.kind === 'station' && ['investigated', 'resolved'].includes(state.exploration.statuses[s.id] ?? ''))
  const [operation, setOperation] = useState<OperationKind | 'core'>('rescue')
  const variant = siteVariant(state.seed, locationId ?? '')
  const briefing = operation === 'core' ? null : OPERATION_BRIEFINGS[operation]
  const deploy: CampaignAction = operation === 'core' ? { type: 'deploy', locationId: locationId ?? '', squad } : { type: 'deploy-operation', locationId: locationId ?? '', squad, kind:operation, variant }
  const lock = actionLock(state, deploy)
  return <div className="exp-modal-backdrop"><section className="exp-modal away-team" role="dialog" aria-modal="true" aria-label="Away team">
    <span className="exp-eyebrow">ISS ITHACA / SHUTTLE BAY</span><h2>{site ? 'Choose your four.' : 'The away team.'}</h2>
    <p>{site ? `${site.name}. ${Math.min(4, 2 + site.threat)} autonomous custodians guard the deck.` : 'Six berths. Each operative keeps their service record. Injuries heal as campaign days pass.'}</p>
    {site && <section className="operation-briefing" aria-label="Mission briefing"><label>Mission contract<select aria-label="Mission contract" value={operation} onChange={(e) => setOperation(e.target.value as OperationKind | 'core')}>
      {OPERATION_KINDS.map((kind) => <option key={kind} value={kind}>{kind[0]!.toUpperCase() + kind.slice(1)} · {OPERATION_BRIEFINGS[kind].title}</option>)}<option value="core">Core recovery · original mission</option>
    </select></label>{site && <img className="away-briefing-art" src={operation === 'core' ? `/assets/exploration/${site.kind === 'ruins' ? 'buried-observatory' : 'silent-courier'}.webp` : operationArt(operation)} alt="Boarding destination environment" />}{briefing && <><h3>{briefing.title}</h3>{operation !== 'core' && <p className="operation-layout"><strong>{DECK_NAMES[operation][variant - 1]}</strong>{DECK_NOTES[operation][variant - 1]}</p>}<p>{briefing.description}</p><p className="operation-voice">{briefing.voice}</p><strong>{briefing.reward}</strong><small>{briefing.warning}</small></>}<small>Choose one operation for this site. A successful extraction also recovers its normal cargo and science, closing the other contracts.</small></section>}
    {site && <div className="exp-notice">Optional mission · 1 campaign day · normal cargo and science, with the selected operation’s bonus on success. Wounded survivors need medical rest. Anyone left behind is permanently lost.</div>}
    <div className="away-roster">{state.roster.map((o) => {
      const ready = !o.dead && o.injuredUntil <= state.day
      return <button key={o.id} className={`away-person ${o.dead ? 'lost' : ''}`} aria-pressed={!!site && squad.includes(o.id)} disabled={!site || !ready}
        onClick={() => setSquad(squad.includes(o.id) ? squad.filter((id) => id !== o.id) : squad.length < 4 ? [...squad, o.id] : squad)}>
        <span className="away-monogram">{o.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}</span><span><strong>{o.name}</strong><small>{o.role} · {o.dead ? 'LOST' : ready ? 'READY' : `${o.injuredUntil - state.day} days recovery`}</small><small>{ROLE_NOTES[o.role]}</small><small>{o.missions} missions · {o.xp} service XP</small></span>
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
export function TacticalMission({ state, dispatch, onExit, saved }: { state: Campaign; dispatch: Dispatch; onExit: () => void; saved: boolean }) {
  const m = state.mission!
  const loadedRolls = useRef(m.rolls)
  const crew = m.units.filter((u) => u.side === 'crew')
  const [selected, setSelected] = useState((crew.find((unit) => unit.hp > 0) ?? crew[0]!).id)
  const [destination, setDestination] = useState<Point | null>(null)
  const [targetId, setTarget] = useState<string | null>(null)
  const [sprint, setSprint] = useState(false)
  const [confirmExtract, setConfirmExtract] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [lastOrder, setLastOrder] = useState<{before:Mission;action:TacticalAction}|null>(null)
  const feedback = lastOrder ? orderFeedback(lastOrder.before,m,lastOrder.action) : null
  const u = crew.find((unit) => unit.id === selected)!
  const hostiles = m.units.filter((unit) => unit.side === 'hostile' && unit.hp > 0 && visible(m, unit))
  const target = hostiles.find((unit) => unit.id === targetId)
  const shot = target ? shotInfo(m, u, target) : null
  const preview = destination ? movementPreview(m,u.id,destination,sprint) : null
  const path = preview?.path
  const losses = extractionLosses(m)
  const civiliansLeft = m.operation?.survivors.filter((s) => !s.evacuated) ?? []
  const abandoning = losses.length > 0 || civiliansLeft.length > 0
  const order = (action: TacticalAction) => { setLastOrder({before:m,action}); dispatch({ type: 'tactical', order: action }); setDestination(null) }
  const control = (action: TacticalAction, label: string, primary = false) => {
    const lock = tacticalLock(m, action)
    return <button className={`exp-button ${primary ? 'primary' : ''}`} title={lock ?? label} disabled={!!lock} onClick={() => order(action)}>{label}</button>
  }
  const chooseTarget = (id: string) => { setTarget(id); if (window.matchMedia('(max-width: 720px)').matches) document.querySelector('.tac-orders')?.scrollIntoView({ block: 'start', behavior: 'auto' }) }
  const selectUnit = (id: string) => { setSelected(id); setDestination(null) }
  const jumpTo = (selector: string) => {
    const panel = document.querySelector<HTMLElement>(selector)
    panel?.scrollIntoView({block:'start',behavior:'auto'}); panel?.focus({preventScroll:true})
  }
  if (m.outcome !== 'active') {
    const lost = crew.filter((o) => !m.rescued.includes(o.id))
    return <main className="exp-deck tac-results"><section className="exp-modal exp-ending" aria-label="Mission debrief">
      <span className="exp-eyebrow">SHUTTLE RETURN / {m.turn} TURNS</span><h2>{m.outcome === 'success' ? 'Something worth bringing home.' : m.outcome === 'retreat' ? 'Another way in.' : 'An empty shuttle.'}</h2>
      {m.operation && <><img className="operation-report-art" src={operationArt(m.operation.kind)} alt={`${m.operation.kind} operation environment`} /><p>{operationStatus(m)}</p>{m.outcome === 'success' && <p>Normal site cargo and science, plus <strong>{operationReward(m).materials} materials + {operationReward(m).credits} credits</strong>.{m.operation.kind === 'rescue' && ` ${civiliansLeft.length} civilians left behind.`}</p>}</>}
      <p>{m.operation ? m.outcome === 'success' ? 'The shuttle returns with something that remote instruments could not bring back.' : m.outcome === 'retreat' ? 'The team withdrew. No reward; the site remains available for another approach.' : 'There is no answer from the team. Their names stay in the service record.' : m.outcome === 'success' ? 'The core is secured. Morozova is waiting in the hangar before the shuttle doors open.' : m.outcome === 'retreat' ? 'The team withdrew without the core. We can return later, or finish the recovery with remote instruments.' : 'The custodians have gone quiet. There is no answer from the team. The ship can continue, but their names stay in the service record.'}</p>
      <div className="exp-ending-stats"><span><b>{m.rescued.length}</b>returned</span><span><b>{lost.length}</b>lost</span><span><b>1</b>campaign day</span></div>
      {crew.map((o) => <p key={o.id}><strong>{o.name}</strong> · {!m.rescued.includes(o.id) ? 'Lost' : o.hp < o.maxHp ? `Medical recovery: ${state.research.completed.includes('trauma-protocols') ? 2 : 4} days` : 'Fit for duty'}</p>)}
      <p>Rewards and crew records are applied when you acknowledge this report.</p>
      <button className="exp-button primary" onClick={() => dispatch({ type: 'debrief' })}>Return to the Ithaca</button>
      <small>{saved ? 'Mission report saved' : 'Autosave unavailable — keep this tab open'}</small>
    </section></main>
  }
  return <main className={`exp-deck tactical-deck atmosphere-${m.operation?.kind ?? 'core'}`}>
    <div inert={confirmExtract}>
      <header className="tac-header"><div><span className="exp-eyebrow">AWAY TEAM / LIVE TELEMETRY</span><h1>Boarding operation</h1><p>{m.name}{m.operation ? ` / ${OPERATION_BRIEFINGS[m.operation.kind].title}` : ''}</p></div>
        <div className="tac-turn"><span>TURN</span><b>{m.turn.toString().padStart(2, '0')}</b><small>{saved ? 'Orders saved' : 'Autosave unavailable'}</small></div>
        <button className="exp-button" onClick={onExit}>Save & title</button>
      </header>
      <div className="tac-objective"><span>{m.operation ? m.operation.kind.toUpperCase() : m.recovered ? '02 / EXTRACT' : '01 / RECOVER'}</span><strong>{operationStatus(m)}</strong><div className="tac-command">{control({ type: 'end-turn' }, 'End turn · hostiles act', true)}<button className="exp-button" disabled={!!tacticalLock(m, { type: 'extract', abandon: true })} title={tacticalLock(m, { type: 'extract', abandon: true }) ?? undefined} onClick={() => setConfirmExtract(true)}>Extract team</button></div></div>
      {feedback && <section className="tac-feedback" aria-label="Last order" role="status"><strong>{feedback.title}</strong>{feedback.details.map((line,i)=><span key={i}>{line}</span>)}</section>}
      <div className="tac-layout">
        <section className="tac-arena" aria-label="Tactical map" tabIndex={-1}>
          <div className="tac-mapbar"><span>{hostiles.length} visible hostiles · {u.name} selected</span><div className="tac-map-tools"><button className="exp-text-button" onClick={() => { const ready = [...crew.slice(crew.indexOf(u)+1),...crew.slice(0,crew.indexOf(u))].find((c) => c.hp > 0 && c.ap > 0); if (ready) selectUnit(ready.id) }} disabled={!crew.some((c) => c.id !== u.id && c.hp > 0 && c.ap > 0)}>Next ready operative</button><button className="exp-text-button" onClick={() => setExpanded(!expanded)}>{expanded ? 'Fit map' : 'Enlarge map'}</button><button className="exp-text-button tac-mobile-jump" onClick={() => jumpTo('.tac-orders')}>Orders ↓</button></div></div>
          {expanded && <small className="tac-pan-hint">Swipe or scroll sideways to explore the deck.</small>}
          <div className={`tac-scroll ${expanded ? 'expanded' : ''}`}>
            <TacticalBoard m={m} unitId={u.id} sprint={sprint} destination={destination} onDestination={setDestination} selected={selected} targetId={targetId} onSelect={selectUnit} onTarget={chooseTarget} loadedRolls={loadedRolls.current} />
          </div>
          <nav className="tac-quickbar" aria-label="Tactical quick actions">
            <button disabled={!destination || !!(destination&&tacticalLock(m,{type:'move',unitId:u.id,...destination,sprint}))} onClick={()=>destination&&order({type:'move',unitId:u.id,...destination,sprint})} title="Move the selected operative to the highlighted tile"><b>↗</b><span>MOVE<small>{sprint?'2 AP':'1 AP'}</small></span></button>
            <button disabled={!target || !!(target&&tacticalLock(m,{type:'shoot',unitId:u.id,targetId:target.id}))} onClick={()=>target&&order({type:'shoot',unitId:u.id,targetId:target.id})} title="Fire on the selected hostile"><b>⌖</b><span>FIRE<small>1 AP</small></span></button>
            <button disabled={!!tacticalLock(m,{type:'overwatch',unitId:u.id})} onClick={()=>order({type:'overwatch',unitId:u.id})} title="Cover an enemy movement lane"><b>◎</b><span>OVERWATCH<small>1 AP</small></span></button>
            <button disabled={!!tacticalLock(m,{type:'heal',unitId:u.id,targetId:u.id})} onClick={()=>order({type:'heal',unitId:u.id,targetId:u.id})} title="Use a medkit on this operative"><b>+</b><span>HEAL SELF<small>1 AP</small></span></button>
            <button onClick={()=>order({type:'end-turn'})} className="tac-quick-end" title="End turn and resolve hostile orders"><b>↻</b><span>END TURN<small>HOSTILES ACT</small></span></button>
          </nav>
          {destination && <div className="tac-destination"><span>{u.name} → {destination.x + 1},{destination.y + 1} · {path?.length ?? 'no'} path tiles</span>{control({ type: 'move', unitId: u.id, ...destination, sprint }, `${sprint ? 'Sprint' : 'Move'} · ${sprint ? 2 : 1} AP`, true)}<button className="exp-text-button" onClick={() => setDestination(null)}>Cancel move</button>{preview?.lock && <small>{preview.lock}</small>}{preview && !preview.lock && <div className="tac-move-preview" aria-label="Movement preview"><strong>{preview.cost} AP → {preview.remainingAP} AP left</strong><p>{preview.threats.length ? `${preview.threats.length} visible guard${preview.threats.length===1?'':'s'} can fire here from ${preview.threats.length===1?'its current position':'their current positions'}.` : 'No currently visible guard has a shot from its current position.'}</p>{preview.threats.map((e)=><span key={e.id}>{e.name}: {e.chance}% enemy hit chance · {e.cover ? e.cover===40?'full cover':'half cover' : 'no cover'}</span>)}{preview.heat>0 && <p className="tac-danger">End-turn heat here: −{preview.heat} health. Shields do not protect against heat.</p>}{preview.remainingAP===0 && <p>No AP left after this move. You cannot fire or interact until next turn.</p>}<small>Guards may move. Unseen threats are not included.</small></div>}</div>}
          <div className="tac-legend"><span>◈ Shuttle</span><span>{m.operation?.kind === 'rescue' ? 'Lilac / survivor beacons' : 'Amber / objective'}</span><span>Low crates / half cover</span><span>Tall bulkheads / block sight</span></div>
          <div className="tac-squad">{crew.map((unit, i) => <button key={unit.id} aria-pressed={selected === unit.id} onClick={() => selectUnit(unit.id)}><small>0{i + 1} / {unit.role}</small><strong>{unit.name}</strong><span>{unit.hp > 0 ? `${unit.hp}/${unit.maxHp} HP · ${unit.ap} AP${unit.shield !== undefined ? ` · ${unit.shield} shield` : ''}` : 'DOWNED — rescue or revive'}</span><progress value={unit.hp} max={unit.maxHp} aria-label={`${unit.name} health`} /></button>)}</div>
        </section>
        <aside className="tac-orders" tabIndex={-1} aria-label="Operative orders"><button className="exp-text-button tac-mobile-jump" onClick={() => jumpTo('.tac-arena')}>Back to map ↑</button>
          <img className="tac-operative-preview" src={figureAsset('crew')} alt="" /><span className="exp-eyebrow">SELECTED OPERATIVE</span><h2>{u.name}</h2><p>{u.role} · {u.hp}/{u.maxHp} health · {u.ap}/2 AP<br/>{u.ammo}/{u.magazine} ammunition · {u.damage} damage{u.weapon === 'plasma' ? ' · PLASMA' : ''}{u.shield !== undefined ? ` · ${u.shield}/4 SHIELD` : ''}{u.aimed ? ' · AIMED' : ''}{u.overwatch ? ' · OVERWATCH' : ''}</p>
          {m.operation && <div className="operation-tracker"><span className="exp-eyebrow">MISSION TRACKER</span>{m.operation.kind === 'rescue' ? m.operation.survivors.map((s) => <p key={s.id}>{s.name}<small>{s.evacuated ? 'Safely aboard' : `${s.x+1},${s.y+1} · ${s.leader ? `following ${crew.find((c) => c.id === s.leader)?.name}${crew.find((c) => c.id === s.leader)?.hp === 0 ? ' · escort DOWN; send help' : ''}` : 'waiting for an escort'}`}</small></p>) : <p>{operationStatus(m)}</p>}<small>{tacticalLock(m,{type:'interact',unitId:u.id}) ?? 'Objective interaction available now.'}</small></div>}
          <div className="tac-move"><label><input type="checkbox" checked={sprint} onChange={(e) => setSprint(e.target.checked)} /> Sprint · 2 AP · up to {u.move * 2} tiles</label>
            <p>{destination ? `Destination ${destination.x + 1},${destination.y + 1} · ${path?.length ?? 'no'} path${path?.length ? ' tiles' : ''}` : `Select a lit floor tile. Move up to ${u.move} tiles for 1 AP.`}</p>
            {destination && control({ type: 'move', unitId: u.id, ...destination, sprint }, `${sprint ? 'Sprint' : 'Move'} to selected tile · ${sprint ? 2 : 1} AP`, true)}
            {destination && <small>{tacticalLock(m, { type: 'move', unitId: u.id, ...destination, sprint })}</small>}
          </div>
          <div className="tac-targets"><span className="exp-eyebrow">VISIBLE TARGETS</span>{!hostiles.length && <p>No hostiles in sight. Darkened tiles hide unexplored space.</p>}{hostiles.map((enemy) => <button key={enemy.id} aria-pressed={targetId === enemy.id} onClick={() => setTarget(enemy.id)}>{enemy.name}<span>{enemy.hp} HP · {shotInfo(m, u, enemy).possible ? `${shotInfo(m, u, enemy).chance}%` : 'No clear shot'}</span></button>)}</div>
          {target && shot && <div className="tac-shot"><strong>{shot.possible ? `${shot.chance}% hit chance` : 'No clear shot'}</strong><small>75 base − {shot.cover} cover − {shot.rangePenalty} range + {shot.aim} aim</small>{control({ type: 'shoot', unitId: u.id, targetId: target.id }, 'Fire · 1 AP', true)}<small>{tacticalLock(m, { type: 'shoot', unitId: u.id, targetId: target.id })}</small></div>}
          <div className="tac-actions">{control({ type: 'aim', unitId: u.id }, 'Aim +20% · 1 AP')}{control({ type: 'overwatch', unitId: u.id }, 'Overwatch · 1 AP')}{control({ type: 'reload', unitId: u.id }, 'Reload · 1 AP')}{control({ type: 'interact', unitId: u.id }, `${interactionLabel(m)} · 1 AP`)}</div>
          <p className="tac-hint">One shot per turn. Overwatch fires once at a moving hostile during its turn; unused overwatch expires. Aim lasts this turn and ends when you move.</p>
          {crew.filter((c) => c.hp < c.maxHp && distance(c, u) <= 1).map((c) => <div key={c.id}>{control({ type: 'heal', unitId: u.id, targetId: c.id }, `Medkit: ${c.name} · 1 AP`)}{c.hp === 0 && inExtraction(u) && control({ type: 'evacuate', unitId: u.id, targetId: c.id }, `Pull ${c.name} aboard · 1 AP`)}</div>)}
          
          <small>Extraction requires a conscious operative in the shuttle zone. Revive downed crew with a medkit; they can move next turn. Each operative carries a medkit or a personal shield.</small>
        </aside>
      </div>
      <footer className="tac-log" aria-live="polite"><span className="exp-eyebrow">TEAM CHANNEL</span>{m.log.slice(-4).map((line, i) => <p key={i}>{line}</p>)}<details><summary>Mission transcript</summary>{m.log.slice(0, -4).map((line, i) => <p key={i}>{line}</p>)}</details></footer>
    </div>
    {confirmExtract && <div className="exp-modal-backdrop"><section className="exp-modal" role="dialog" aria-modal="true" aria-label="Confirm extraction"><span className="exp-eyebrow">SHUTTLE / DEPARTURE</span><h2>{abandoning ? 'Leave them behind?' : 'Bring them home.'}</h2><p>{m.operation ? `${operationStatus(m)} ${m.recovered ? 'This departure closes the site and pays the earned bonus.' : 'No objective secured: no reward. You can return later.'}` : m.recovered ? 'The core is secured.' : 'The core has not been recovered. You can return to this location later.'}</p>{civiliansLeft.length > 0 && <p className="operation-loss">Civilians left behind: {civiliansLeft.map((s) => s.name).join(', ')}. They are not aboard yet.</p>}<p>{losses.length ? `Permanently lost if you leave now: ${losses.map((o) => o.name).join(', ')}.` : 'All four operatives are in the shuttle zone, including anyone downed.'}</p><button className="exp-button primary" onClick={() => { order({ type: 'extract', abandon: abandoning }); setConfirmExtract(false) }}>{abandoning ? 'Confirm extraction and losses' : 'Confirm safe extraction'}</button><button className="exp-button" autoFocus onClick={() => setConfirmExtract(false)}>Keep the shuttle waiting</button></section></div>}
  </main>
}
