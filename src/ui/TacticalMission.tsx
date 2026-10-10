import { useRef, useState } from 'react'
import type { Campaign, CampaignAction } from '../engine/exploration/campaign.js'
import { actionLock } from '../engine/exploration/campaign.js'
import { distance, extractionLosses, inExtraction, pathTo, ROLE_NOTES, shotInfo, tacticalLock, tileAt, visible } from '../engine/tactical/mission.js'
import type { Mission, Point, TacticalAction } from '../engine/tactical/mission.js'
import './tactical.css'

type Dispatch = (action: CampaignAction) => void
export function AwayTeam({ state, locationId, dispatch, onClose }: { state: Campaign; locationId: string | null; dispatch: Dispatch; onClose: () => void }) {
  const [squad, setSquad] = useState(state.roster.filter((o) => !o.dead && o.injuredUntil <= state.day).slice(0, 4).map((o) => o.id))
  const site = state.world.locations.find((s) => s.id === locationId)
  const station = state.world.locations.find((s) => s.systemId === state.at && s.kind === 'station' && ['investigated', 'resolved'].includes(state.exploration.statuses[s.id] ?? ''))
  const deploy: CampaignAction = { type: 'deploy', locationId: locationId ?? '', squad }
  const lock = actionLock(state, deploy)
  return <div className="exp-modal-backdrop"><section className="exp-modal away-team" role="dialog" aria-modal="true" aria-label="Away team">
    <span className="exp-eyebrow">ISS ITHACA / SHUTTLE BAY</span><h2>{site ? 'Choose your four.' : 'The away team.'}</h2>
    <p>{site ? `${site.name}. Recover the core, then extract through the shuttle zone. ${Math.min(4, 2 + site.threat)} autonomous custodians guard the deck.` : 'Six berths. Each operative keeps their service record. Injuries heal as campaign days pass.'}</p>
    {site && <div className="exp-notice">Optional mission · 1 campaign day · same cargo and science as remote recovery. Wounded survivors need medical rest. Anyone left behind is permanently lost.</div>}
    <div className="away-roster">{state.roster.map((o) => {
      const ready = !o.dead && o.injuredUntil <= state.day
      return <button key={o.id} className={`away-person ${o.dead ? 'lost' : ''}`} aria-pressed={!!site && squad.includes(o.id)} disabled={!site || !ready}
        onClick={() => setSquad(squad.includes(o.id) ? squad.filter((id) => id !== o.id) : squad.length < 4 ? [...squad, o.id] : squad)}>
        <span className="away-monogram">{o.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}</span><span><strong>{o.name}</strong><small>{o.role} · {o.dead ? 'LOST' : ready ? 'READY' : `${o.injuredUntil - state.day} days recovery`}</small><small>{ROLE_NOTES[o.role]}</small><small>{o.missions} missions · {o.xp} service XP</small></span>
      </button>
    })}</div>
    {site && <><p>{squad.length}/4 selected. Select a crew member to free a place.</p><button className="exp-button primary" disabled={!!lock} onClick={() => { dispatch(deploy); onClose() }}>Deploy away team</button>{lock && <small>{lock}</small>}</>}
    {!site && <>
      <button className="exp-button" disabled={!!actionLock(state, { type: 'rest-team' })} onClick={() => dispatch({ type: 'rest-team' })}>Medical rest · 1 day · no cost</button>
      {station ? <><button className="exp-button" disabled={!!actionLock(state, { type: 'recruit', locationId: station.id })} onClick={() => dispatch({ type: 'recruit', locationId: station.id })}>Recruit replacement · 20 credits · 1 day</button><small>{actionLock(state, { type: 'recruit', locationId: station.id }) ?? 'A named operative can join your team here.'}</small></> : <p>Contact a station to recruit replacements for lost operatives. Station contracts can fund recruitment.</p>}
      <small>Service XP records experience; rank bonuses and loadouts are planned for a later increment.</small>
    </>}
    <button className="exp-text-button" onClick={onClose}>{site ? 'Cancel deployment' : 'Back to ship'}</button>
  </section></div>
}
const point = (p: Point) => ({ x: 340 + (p.x - p.y) * 30, y: 52 + (p.x + p.y) * 16 })
const diamond = (p: Point, lift = 0) => { const q = point(p); return `${q.x},${q.y - 15 - lift} ${q.x + 29},${q.y - lift} ${q.x},${q.y + 15 - lift} ${q.x - 29},${q.y - lift}` }
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
  const u = crew.find((unit) => unit.id === selected)!
  const hostiles = m.units.filter((unit) => unit.side === 'hostile' && unit.hp > 0 && visible(m, unit))
  const target = hostiles.find((unit) => unit.id === targetId)
  const shot = target ? shotInfo(m, u, target) : null
  const path = destination ? pathTo(m, u, destination) : null
  const losses = extractionLosses(m)
  const order = (action: TacticalAction) => { dispatch({ type: 'tactical', order: action }); setDestination(null) }
  const control = (action: TacticalAction, label: string, primary = false) => {
    const lock = tacticalLock(m, action)
    return <button className={`exp-button ${primary ? 'primary' : ''}`} title={lock ?? label} disabled={!!lock} onClick={() => order(action)}>{label}</button>
  }
  const chooseTarget = (id: string) => { setTarget(id); if (window.matchMedia('(max-width: 720px)').matches) document.querySelector('.tac-orders')?.scrollIntoView({ block: 'start', behavior: 'smooth' }) }
  const selectUnit = (id: string) => { setSelected(id); setDestination(null) }
  if (m.outcome !== 'active') {
    const lost = crew.filter((o) => !m.rescued.includes(o.id))
    return <main className="exp-deck tac-results"><section className="exp-modal exp-ending" aria-label="Mission debrief">
      <span className="exp-eyebrow">SHUTTLE RETURN / {m.turn} TURNS</span><h2>{m.outcome === 'success' ? 'Something worth bringing home.' : m.outcome === 'retreat' ? 'Another way in.' : 'An empty shuttle.'}</h2>
      <p>{m.outcome === 'success' ? 'The core is secured. Morozova is waiting in the hangar before the shuttle doors open.' : m.outcome === 'retreat' ? 'The team withdrew without the core. We can return later, or finish the recovery with remote instruments.' : 'The custodians have gone quiet. There is no answer from the team. The ship can continue, but their names stay in the service record.'}</p>
      <div className="exp-ending-stats"><span><b>{m.rescued.length}</b>returned</span><span><b>{lost.length}</b>lost</span><span><b>1</b>campaign day</span></div>
      {crew.map((o) => <p key={o.id}><strong>{o.name}</strong> · {!m.rescued.includes(o.id) ? 'Lost' : o.hp < o.maxHp ? `Medical recovery: ${state.research.completed.includes('trauma-protocols') ? 2 : 4} days` : 'Fit for duty'}</p>)}
      <p>Rewards and crew records are applied when you acknowledge this report.</p>
      <button className="exp-button primary" onClick={() => dispatch({ type: 'debrief' })}>Return to the Ithaca</button>
      <small>{saved ? 'Mission report saved' : 'Autosave unavailable — keep this tab open'}</small>
    </section></main>
  }
  return <main className="exp-deck tactical-deck">
    <div inert={confirmExtract}>
      <header className="tac-header"><div><span className="exp-eyebrow">AWAY TEAM / LIVE TELEMETRY</span><h1>Boarding operation</h1><p>{m.name}</p></div>
        <div className="tac-turn"><span>TURN</span><b>{m.turn.toString().padStart(2, '0')}</b><small>{saved ? 'Orders saved' : 'Autosave unavailable'}</small></div>
        <button className="exp-button" onClick={onExit}>Save & title</button>
      </header>
      <div className="tac-objective"><span>{m.recovered ? '02 / EXTRACT' : '01 / RECOVER'}</span><strong>{m.recovered ? 'Core secured. Bring the team to the teal shuttle zone.' : 'Reach the amber core and recover it. Killing every custodian is optional.'}</strong><div className="tac-command">{control({ type: 'end-turn' }, 'End turn · hostiles act', true)}<button className="exp-button" disabled={!!tacticalLock(m, { type: 'extract', abandon: true })} title={tacticalLock(m, { type: 'extract', abandon: true }) ?? undefined} onClick={() => setConfirmExtract(true)}>Extract team</button></div></div>
      <div className="tac-layout">
        <section className="tac-arena" aria-label="Tactical map">
          <div className="tac-mapbar"><span>{hostiles.length} visible hostiles · {u.name} selected</span><button className="exp-text-button" onClick={() => setExpanded(!expanded)}>{expanded ? 'Fit map' : 'Enlarge map'}</button></div>
          <div className={`tac-scroll ${expanded ? 'expanded' : ''}`}>
            <svg viewBox="0 0 720 420" className="tac-board" aria-label="Isometric boarding deck">
              <defs><radialGradient id="deck-glow"><stop stopColor="#183941" /><stop offset="1" stopColor="#08131c" /></radialGradient><linearGradient id="operative-body" x2="0" y2="1"><stop stopColor="#b1fff2"/><stop offset="1" stopColor="#268d98"/></linearGradient></defs>
              <rect width="720" height="420" fill="url(#deck-glow)" />
              <BoardTiles m={m} unitId={u.id} sprint={sprint} destination={destination} onDestination={setDestination} />
              {path?.map((p, i) => { const q = point(p); return <circle key={i} cx={q.x} cy={q.y} r={3} fill="#c3fff0" pointerEvents="none" /> })}
              {m.seen.includes(m.objective.y * m.width + m.objective.x) && <g pointerEvents="none" transform={`translate(${point(m.objective).x} ${point(m.objective).y})`}><path d="M -11 0 L 0 -23 L 11 0 L 0 7 Z" fill={m.recovered ? '#2a5960' : '#ffd184'} stroke="#fbe6b6"/><text y={21} textAnchor="middle" fill="#ffd184" fontSize={9}>{m.recovered ? 'SECURED' : 'CORE'}</text></g>}
              {[...m.units].sort((a, b) => a.x + a.y - b.x - b.y).filter((unit) => unit.side === 'crew' || visible(m, unit)).map((unit) => {
                const p = point(unit), ally = unit.side === 'crew', index = crew.findIndex((c) => c.id === unit.id), chosen = ally ? selected === unit.id : targetId === unit.id
                return <g key={unit.id} role="button" tabIndex={0} aria-label={`${ally ? 'Select' : 'Target'} ${unit.name}`} onClick={() => ally ? selectUnit(unit.id) : chooseTarget(unit.id)} onKeyDown={(e) => { if (['Enter', ' '].includes(e.key)) { e.preventDefault(); ally ? selectUnit(unit.id) : chooseTarget(unit.id) } }}>
                  <ellipse cx={p.x} cy={p.y + 2} rx={18} ry={9} fill="#0008" stroke={chosen ? '#f6eacb' : 'none'} strokeWidth={2}/>
                  {unit.hp > 0 ? <g transform={`translate(${p.x} ${p.y})`}>
                    {ally ? <><path d="M -9 -2 L -7 -18 L 7 -18 L 9 -2 L 4 2 L 0 -4 L -4 2 Z" fill="url(#operative-body)" stroke="#bffff4"/><circle cy={-24} r={6} fill="#244e62" stroke="#c4fff2"/><path d="M -4 -25 L 4 -25" stroke="#c4fff2" strokeWidth={2}/><path d="M 7 -15 L 16 -10" stroke="#ecfffa" strokeWidth={4}/></> : <><path d="M -11 -3 L -9 -19 L 9 -19 L 11 -3 Z" fill="#9b4136" stroke="#ffae82"/><path d="M -8 -10 L -16 -2 M 8 -10 L 16 -2" stroke="#ffbc87" strokeWidth={3}/><rect x={-7} y={-28} width={14} height={9} rx={2} fill="#4b272b" stroke="#ffbd84"/><path d="M -4 -24 L 4 -24" stroke="#ffdb92" strokeWidth={2}/></>}
                    <rect x={-15} y={-40} width={30} height={4} fill="#060b10"/><rect x={-15} y={-40} width={30 * unit.hp / unit.maxHp} height={4} fill={ally ? '#7de9d5' : '#ef9876'}/>
                    {ally && <><text x={-20} y={-16} fill="#d2fff2" fontSize={11} fontWeight="bold">{index + 1}</text>{[0, 1].map((n) => <circle key={n} cx={-4 + n * 8} cy={-47} r={2.5} fill={unit.ap > n ? '#e9d298' : '#30444c'}/>)}</>}
                  </g> : <g transform={`translate(${p.x} ${p.y})`}><path d="M -10 -4 L 10 4 M -10 4 L 10 -4" stroke={ally ? '#f4c271' : '#705556'} strokeWidth={4}/>{ally && <text y={-13} textAnchor="middle" fontSize={9} fill="#ffcf85">DOWN</text>}</g>}
                </g>
              })}
              {m.lastShot && m.rolls > loadedRolls.current && <g key={`shot-${m.rolls}`} className="tac-shot-effect" pointerEvents="none"><line x1={point(m.lastShot.from).x} y1={point(m.lastShot.from).y - 15} x2={point(m.lastShot.to).x} y2={point(m.lastShot.to).y - 15} stroke={m.lastShot.hit ? '#eafed0' : '#e8a17a'} strokeWidth={3}/><circle cx={point(m.lastShot.to).x} cy={point(m.lastShot.to).y - 15} r={12} fill="none" stroke="#ffdea0"/><text x={point(m.lastShot.to).x} y={point(m.lastShot.to).y - 58} textAnchor="middle" fill="#fff2d1" fontSize={15}>{m.lastShot.hit ? `−${m.lastShot.damage}` : 'MISS'}</text></g>}
              <text x={23} y={391} fill="#69cbbd" fontSize={10}>SHUTTLE ←</text><text x={470} y={391} fill="#7fa0ae" fontSize={9}>RECOVERY DECK / 12 × 10</text>
            </svg>
          </div>
          {destination && <div className="tac-destination"><span>{u.name} → {destination.x + 1},{destination.y + 1} · {path?.length ?? 'no'} path tiles</span>{control({ type: 'move', unitId: u.id, ...destination, sprint }, `${sprint ? 'Sprint' : 'Move'} · ${sprint ? 2 : 1} AP`, true)}<small>{tacticalLock(m, { type: 'move', unitId: u.id, ...destination, sprint })}</small></div>}
          <div className="tac-legend"><span>◈ Shuttle</span><span>Amber / objective</span><span>Low crates / half cover</span><span>Tall bulkheads / block sight</span></div>
          <div className="tac-squad">{crew.map((unit, i) => <button key={unit.id} aria-pressed={selected === unit.id} onClick={() => selectUnit(unit.id)}><small>0{i + 1} / {unit.role}</small><strong>{unit.name}</strong><span>{unit.hp > 0 ? `${unit.hp}/${unit.maxHp} HP · ${unit.ap} AP` : 'DOWNED — rescue or revive'}</span><progress value={unit.hp} max={unit.maxHp} aria-label={`${unit.name} health`} /></button>)}</div>
        </section>
        <aside className="tac-orders">
          <span className="exp-eyebrow">SELECTED OPERATIVE</span><h2>{u.name}</h2><p>{u.role} · {u.hp}/{u.maxHp} health · {u.ap}/2 AP<br/>{u.ammo}/{u.magazine} ammunition · {u.damage} damage{u.aimed ? ' · AIMED' : ''}{u.overwatch ? ' · OVERWATCH' : ''}</p>
          <div className="tac-move"><label><input type="checkbox" checked={sprint} onChange={(e) => setSprint(e.target.checked)} /> Sprint · 2 AP · up to {u.move * 2} tiles</label>
            <p>{destination ? `Destination ${destination.x + 1},${destination.y + 1} · ${path?.length ?? 'no'} path${path?.length ? ' tiles' : ''}` : `Select a lit floor tile. Move up to ${u.move} tiles for 1 AP.`}</p>
            {destination && control({ type: 'move', unitId: u.id, ...destination, sprint }, `${sprint ? 'Sprint' : 'Move'} to selected tile · ${sprint ? 2 : 1} AP`, true)}
            {destination && <small>{tacticalLock(m, { type: 'move', unitId: u.id, ...destination, sprint })}</small>}
          </div>
          <div className="tac-targets"><span className="exp-eyebrow">VISIBLE TARGETS</span>{!hostiles.length && <p>No hostiles in sight. Darkened tiles hide unexplored space.</p>}{hostiles.map((enemy) => <button key={enemy.id} aria-pressed={targetId === enemy.id} onClick={() => setTarget(enemy.id)}>{enemy.name}<span>{enemy.hp} HP · {shotInfo(m, u, enemy).possible ? `${shotInfo(m, u, enemy).chance}%` : 'No clear shot'}</span></button>)}</div>
          {target && shot && <div className="tac-shot"><strong>{shot.chance}% hit chance</strong><small>75 base − {shot.cover} cover − {shot.rangePenalty} range + {shot.aim} aim</small>{control({ type: 'shoot', unitId: u.id, targetId: target.id }, 'Fire · 1 AP', true)}<small>{tacticalLock(m, { type: 'shoot', unitId: u.id, targetId: target.id })}</small></div>}
          <div className="tac-actions">{control({ type: 'aim', unitId: u.id }, 'Aim +20% · 1 AP')}{control({ type: 'overwatch', unitId: u.id }, 'Overwatch · 1 AP')}{control({ type: 'reload', unitId: u.id }, 'Reload · 1 AP')}{control({ type: 'interact', unitId: u.id }, 'Recover core · 1 AP')}</div>
          <p className="tac-hint">One shot per turn. Overwatch fires once at a moving hostile during its turn; unused overwatch expires. Aim lasts this turn and ends when you move.</p>
          {crew.filter((c) => c.hp < c.maxHp && distance(c, u) <= 1).map((c) => <div key={c.id}>{control({ type: 'heal', unitId: u.id, targetId: c.id }, `Medkit: ${c.name} · 1 AP`)}{c.hp === 0 && inExtraction(u) && control({ type: 'evacuate', unitId: u.id, targetId: c.id }, `Pull ${c.name} aboard · 1 AP`)}</div>)}
          
          <small>Extraction requires a conscious operative in the shuttle zone. Revive downed crew with a medkit; they can move next turn. Each operative carries one kit.</small>
        </aside>
      </div>
      <footer className="tac-log" aria-live="polite"><span className="exp-eyebrow">TEAM CHANNEL</span>{m.log.slice(-4).map((line, i) => <p key={i}>{line}</p>)}<details><summary>Mission transcript</summary>{m.log.slice(0, -4).map((line, i) => <p key={i}>{line}</p>)}</details></footer>
    </div>
    {confirmExtract && <div className="exp-modal-backdrop"><section className="exp-modal" role="dialog" aria-modal="true" aria-label="Confirm extraction"><span className="exp-eyebrow">SHUTTLE / DEPARTURE</span><h2>{losses.length ? 'Leave them behind?' : 'Bring them home.'}</h2><p>{m.recovered ? 'The core is secured.' : 'The core has not been recovered. You can return to this location later.'}</p><p>{losses.length ? `Permanently lost if you leave now: ${losses.map((o) => o.name).join(', ')}.` : 'All four operatives are in the shuttle zone, including anyone downed.'}</p><button className="exp-button primary" onClick={() => { order({ type: 'extract', abandon: losses.length > 0 }); setConfirmExtract(false) }}>{losses.length ? 'Confirm extraction and losses' : 'Confirm safe extraction'}</button><button className="exp-button" autoFocus onClick={() => setConfirmExtract(false)}>Keep the shuttle waiting</button></section></div>}
  </main>
}
function BoardTiles({ m, unitId, sprint, destination, onDestination }: { m: Mission; unitId: string; sprint: boolean; destination: Point | null; onDestination: (p: Point) => void }) {
  const u = m.units.find((unit) => unit.id === unitId)!
  return <>{Array.from({ length: m.width * m.height }, (_, n) => ({ x: n % m.width, y: Math.floor(n / m.width) })).sort((a, b) => a.x + a.y - b.x - b.y).map((p) => {
    const known = m.seen.includes(p.y * m.width + p.x), lit = visible(m, p), tile = tileAt(m, p), q = point(p), chosen = destination?.x === p.x && destination?.y === p.y
    const lock = known && tile === 'floor' ? tacticalLock(m, { type: 'move', unitId, ...p, sprint }) : 'Unknown or blocked'
    const reachable = !lock && u.hp > 0
    const height = tile === 'wall' ? 28 : 12
    return <g key={`${p.x}-${p.y}`}>
      <polygon id={`tile-${p.x}-${p.y}`} points={diamond(p)} fill={!known ? '#09121a' : inExtraction(p) ? '#164941' : chosen ? '#5c8771' : reachable ? '#254955' : lit ? '#182d39' : '#111e28'} stroke={!known ? '#13222c' : '#42606a'} strokeWidth={0.7}
        role={known && tile === 'floor' ? 'button' : undefined} tabIndex={known && tile === 'floor' ? 0 : undefined} aria-label={`Tile ${p.x + 1},${p.y + 1}${inExtraction(p) ? ' shuttle' : ''}`}
        onClick={() => { if (known && tile === 'floor') onDestination(p) }} onKeyDown={(e) => { if (['Enter', ' '].includes(e.key)) { e.preventDefault(); onDestination(p) }
          const d: Record<string, Point> = { ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 } }; if (d[e.key]) { e.preventDefault(); document.getElementById(`tile-${p.x + d[e.key]!.x}-${p.y + d[e.key]!.y}`)?.focus() } }} />
      {known && tile !== 'floor' && <g pointerEvents="none"><path d={`M ${q.x - 29} ${q.y} L ${q.x} ${q.y + 15} L ${q.x + 29} ${q.y} L ${q.x + 29} ${q.y - height} L ${q.x} ${q.y + 15 - height} L ${q.x - 29} ${q.y - height} Z`} fill={tile === 'wall' ? '#203c4a' : '#4d5140'} stroke="#6b7e82" strokeWidth={0.7}/><polygon points={diamond(p, height)} fill={tile === 'wall' ? '#476171' : '#8c805c'} stroke="#92a2a0" strokeWidth={0.7}/></g>}
    </g>
  })}</>
}
