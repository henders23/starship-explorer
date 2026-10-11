import type { Mission, Point, TacticalUnit } from '../engine/tactical/mission.js'
import { inExtraction, pathTo, shotInfo, tacticalLock, tileAt, visible } from '../engine/tactical/mission.js'
import { DECK_NAMES } from '../engine/tactical/variants.js'
import { TacticalFigure, TacticalStatus } from './TacticalFigure.js'
import { point, diamond } from './isometric.js'
import { sceneOrder } from './tactical-scene.js'

function UnitFigure({unit,chosen,onChoose}:{unit:TacticalUnit;chosen:boolean;onChoose:()=>void}) {
  const p=point(unit),ally=unit.side==='crew'
  return <g role="button" tabIndex={0} aria-label={`${ally?'Select':'Target'} ${unit.name}`} onClick={onChoose} onKeyDown={(e)=>{if(['Enter',' '].includes(e.key)){e.preventDefault();onChoose()}}} transform={`translate(${p.x} ${p.y})`}>
    {(unit.shield??0)>0 && <ellipse cy={-24} rx={22} ry={32} fill="#6bcbe511" stroke="#83d6f0" strokeDasharray="3 3" pointerEvents="none"/>}
    <ellipse cy={2} rx={18} ry={9} fill="#0008" stroke={chosen?'#f6eacb':'none'} strokeWidth={2}/>
    {unit.hp>0 ? <TacticalFigure unit={unit}/> : <><path d="M -10 -4 L 10 4 M -10 4 L 10 -4" stroke={ally?'#f4c271':'#705556'} strokeWidth={4}/>{ally && <text y={-13} textAnchor="middle" fontSize={9} fill="#ffcf85">DOWN</text>}</>}
  </g>
}

export function TacticalBoard({m,unitId,sprint,destination,onDestination,selected,targetId,onSelect,onTarget,loadedRolls}:{m:Mission;unitId:string;sprint:boolean;destination:Point|null;onDestination:(p:Point)=>void;selected:string;targetId:string|null;onSelect:(id:string)=>void;onTarget:(id:string)=>void;loadedRolls:number}) {
  const crew=m.units.filter((u)=>u.side==='crew'),unit=m.units.find((u)=>u.id===unitId)!
  const path=destination?pathTo(m,unit,destination):null
  const legal=destination && !tacticalLock(m,{type:'move',unitId,...destination,sprint})
  const target=m.units.find((u)=>u.id===targetId && u.side==='hostile' && u.hp>0 && visible(m,u))
  const canShoot=target && shotInfo(m,unit,target).possible
  return <svg viewBox="0 0 720 420" className="tac-board" aria-label="Isometric boarding deck">
    <defs>
      <radialGradient id="deck-glow"><stop stopColor="#183941"/><stop offset="1" stopColor="#08131c"/></radialGradient>
      <linearGradient id="bulkhead-top" x2="0" y2="1"><stop stopColor="#74919c"/><stop offset="1" stopColor="#3b5260"/></linearGradient>
      <linearGradient id="bulkhead-face" x2="1" y2="1"><stop stopColor="#2c4653"/><stop offset="1" stopColor="#152734"/></linearGradient>
      <pattern id="deck-grating" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M 0 0 L 6 0 M 0 3 L 6 3" stroke="#b9d5d2" strokeWidth=".35" opacity=".2"/></pattern>
    </defs>
    <rect width="720" height="420" fill="url(#deck-glow)"/>
    <path d="M 41 196 L 400 387 L 699 228 L 699 236 L 400 395 L 41 204 Z" fill="#030a11" stroke="#344b59" pointerEvents="none"/>
    <BoardTiles m={m} unitId={unitId} sprint={sprint} destination={destination} onDestination={onDestination}/>
    {path && <g pointerEvents="none" data-testid="movement-route"><polyline points={[unit,...path].map((p)=>`${point(p).x},${point(p).y}`).join(' ')} fill="none" stroke={legal?'#c3fff0':'#edb18f'} strokeWidth={2} strokeDasharray={legal?undefined:'4 4'}/>{path.map((p,i)=><circle key={i} cx={point(p).x} cy={point(p).y} r={2.5} fill={legal?'#c3fff0':'#edb18f'}/>)}</g>}
    <g data-testid="depth-objects">{sceneOrder(m).map((item)=>{
      const p=point(item.p)
      let node
      if(item.kind==='obstacle')node=<Obstacle m={m} p={item.p}/>
      if(item.kind==='unit') {
        const u=m.units[item.index]!,ally=u.side==='crew'
        node=<UnitFigure unit={u} chosen={ally?selected===u.id:targetId===u.id} onChoose={()=>ally?onSelect(u.id):onTarget(u.id)}/>
      }
      if(item.kind==='survivor')node=<g pointerEvents="none" transform={`translate(${p.x} ${p.y})`}><ellipse rx={15} ry={8} fill="#242331" stroke="#edc4fa"/><image href="/assets/exploration/tactical-survivor.webp" x={-30} y={-53} width={60} height={60}/></g>
      if(item.kind==='crate') {
        const c=m.operation!.crates[item.index]!
        node=<g pointerEvents="none" transform={`translate(${p.x} ${p.y})`}><path d="M -12 0 L -12 -16 L 0 -22 L 12 -16 L 12 0 L 0 6 Z" fill={c.collected?'#263e43':'#b58b45'} stroke={c.collected?'#4e6465':'#ffe0a2'}/></g>
      }
      if(item.kind==='objective')node=<g pointerEvents="none" transform={`translate(${p.x} ${p.y})`}><path d="M -11 0 L 0 -23 L 11 0 L 0 7 Z" fill={m.recovered?'#2a5960':'#ffd184'} stroke="#fbe6b6"/></g>
      return <g key={item.id} data-object-id={item.id}>{node}</g>
    })}</g>
    {target && <g pointerEvents="none" data-testid="target-line"><line x1={point(unit).x} y1={point(unit).y-22} x2={point(target).x} y2={point(target).y-22} stroke={canShoot?'#e9c48c':'#d88d7a'} strokeWidth={1.5} strokeDasharray="5 5"/><circle cx={point(target).x} cy={point(target).y-22} r={18} fill="none" stroke={canShoot?'#e9c48c':'#d88d7a'}/></g>}
    <g pointerEvents="none" data-testid="tactical-status-marks">
      {m.units.filter((u)=>u.hp>0 && (u.side==='crew'||visible(m,u))).map((u)=><g key={u.id} transform={`translate(${point(u).x} ${point(u).y})`}><TacticalStatus unit={u} index={crew.findIndex((c)=>c.id===u.id)}/></g>)}
      {m.operation?.survivors.map((s,i)=>!s.evacuated && <text key={s.id} x={point(s).x} y={point(s).y+20} fontSize={9} textAnchor="middle" fill="#f4dfff">{i+1} / {s.leader?'FOLLOWING':'SURVIVOR'}</text>)}
      {m.operation?.crates.map((c,i)=><text key={i} x={point(c).x} y={point(c).y+20} fontSize={9} fill="#efdbb2" textAnchor="middle">{c.collected?'SECURED':`CASE ${i+1}`}</text>)}
      {(!m.operation||m.operation.kind==='sabotage') && m.seen.includes(m.objective.y*m.width+m.objective.x) && <text x={point(m.objective).x} y={point(m.objective).y+21} textAnchor="middle" fill="#ffd184" fontSize={9}>{m.recovered?'SECURED':m.operation?'UPLINK':'CORE'}</text>}
    </g>
    {m.lastShot && m.rolls>loadedRolls && <g key={`shot-${m.rolls}`} className="tac-shot-effect" pointerEvents="none"><line x1={point(m.lastShot.from).x} y1={point(m.lastShot.from).y-15} x2={point(m.lastShot.to).x} y2={point(m.lastShot.to).y-15} stroke={m.lastShot.hit?'#eafed0':'#e8a17a'} strokeWidth={3}/><circle cx={point(m.lastShot.to).x} cy={point(m.lastShot.to).y-15} r={12} fill="none" stroke="#ffdea0"/><text x={point(m.lastShot.to).x} y={point(m.lastShot.to).y-58} textAnchor="middle" fill="#fff2d1" fontSize={15}>{m.lastShot.hit?`−${m.lastShot.damage}`:'MISS'}</text></g>}
    {m.operation?.kind==='salvage' && <g pointerEvents="none" className="tac-heat-boundary"><path d="M 460 100 L 160 260" stroke="#f5b47b" strokeDasharray="4 5" strokeWidth={1.5}/><text x={447} y={99} fill="#ffd3a1" fontSize={9}>HEAT ZONE →</text></g>}
    <text x={23} y={391} fill="#69cbbd" fontSize={10}>SHUTTLE ←</text><text x={470} y={391} fill="#7fa0ae" fontSize={9}>{m.operation?.variant?DECK_NAMES[m.operation.kind][m.operation.variant-1]!.toUpperCase():'RECOVERY DECK'} / 12 × 10</text>
  </svg>
}

function Obstacle({m,p}:{m:Mission;p:Point}) {
  const q=point(p),tile=tileAt(m,p),height=tile==='wall'?28:12
  return <g pointerEvents="none"><path d={`M ${q.x - 29} ${q.y} L ${q.x} ${q.y + 15} L ${q.x + 29} ${q.y} L ${q.x + 29} ${q.y - height} L ${q.x} ${q.y + 15 - height} L ${q.x - 29} ${q.y - height} Z`} fill={tile === 'wall' ? 'url(#bulkhead-face)' : '#49473c'} stroke="#6b7e82" strokeWidth={0.7}/><polygon points={diamond(p, height)} fill={tile === 'wall' ? 'url(#bulkhead-top)' : '#a09268'} stroke="#92a2a0" strokeWidth={0.7}/><path d={`M ${q.x} ${q.y+15} L ${q.x} ${q.y+15-height}`} stroke="#acbac0" strokeOpacity={.5}/><path d={`M ${q.x+6} ${q.y+8-height} L ${q.x+22} ${q.y-height}`} stroke={tile === 'wall' ? '#a3e2e5' : '#e8c382'} strokeWidth={2}/>{tile === 'wall' && <path d={`M ${q.x-19} ${q.y+2-height} L ${q.x-19} ${q.y+4} M ${q.x-12} ${q.y+6-height} L ${q.x-12} ${q.y+8}`} stroke="#10232d" strokeWidth={2}/>}</g>
}

function BoardTiles({ m, unitId, sprint, destination, onDestination }: { m: Mission; unitId: string; sprint: boolean; destination: Point | null; onDestination: (p: Point) => void }) {
  const u = m.units.find((unit) => unit.id === unitId)!
  return <>{Array.from({ length: m.width * m.height }, (_, n) => ({ x: n % m.width, y: Math.floor(n / m.width) })).sort((a, b) => a.x + a.y - b.x - b.y).map((p) => {
    const known = m.seen.includes(p.y * m.width + p.x), lit = visible(m, p), tile = tileAt(m, p), q = point(p), chosen = destination?.x === p.x && destination?.y === p.y
    const lock = known && tile === 'floor' ? tacticalLock(m, { type: 'move', unitId, ...p, sprint }) : 'Unknown or blocked'
    const reachable = !lock && u.hp > 0
    return <g key={`${p.x}-${p.y}`}>
      <polygon id={`tile-${p.x}-${p.y}`} points={diamond(p)} fill={!known ? '#09121a' : inExtraction(p) ? '#164941' : chosen ? '#5c8771' : reachable ? '#254955' : lit ? '#182d39' : '#111e28'} stroke={m.operation?.kind === 'salvage' && p.x >= 4 && known ? m.turn >= 4 ? '#cb694e' : '#85613f' : !known ? '#13222c' : '#42606a'} strokeWidth={0.7}
        role={known && tile === 'floor' ? 'button' : undefined} tabIndex={known && tile === 'floor' ? 0 : undefined} aria-label={`Tile ${p.x + 1},${p.y + 1}${inExtraction(p) ? ' shuttle' : ''}`}
        onClick={() => { if (known && tile === 'floor') onDestination(p) }} onKeyDown={(e) => { if (['Enter', ' '].includes(e.key)) { e.preventDefault(); onDestination(p) }
          const d: Record<string, Point> = { ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 } }; if (d[e.key]) { e.preventDefault(); document.getElementById(`tile-${p.x + d[e.key]!.x}-${p.y + d[e.key]!.y}`)?.focus() } }} />
      {known && tile === 'floor' && <g pointerEvents="none" opacity={lit ? 1 : .4}><polygon points={diamond(p)} fill="url(#deck-grating)"/><path d={`M ${q.x-21} ${q.y} L ${q.x} ${q.y+11} L ${q.x+21} ${q.y}`} fill="none" stroke="#a3bdc4" strokeOpacity={.18} strokeWidth={.6}/>{(inExtraction(p) || (p.x % 3 === 0 && p.y % 3 === 0)) && <path d={`M ${q.x-23} ${q.y-3} L ${q.x-11} ${q.y-9}`} stroke={inExtraction(p) ? '#a2f6da' : '#8ebacb'} strokeWidth={2}/>}</g>}
    </g>
  })}</>
}
