import { enemyAppearance } from './tactical-identity.js'
import type { TacticalUnit } from '../engine/tactical/mission.js'
export const figureAsset = (side: TacticalUnit['side']) => `/assets/exploration/tactical-${side === 'crew' ? 'operative' : 'custodian'}.webp`
export const rigAsset = (unit:TacticalUnit) => `/assets/tactical/${unit.side==='crew'?unit.role:enemyAppearance(unit).kind==='enforcer'?'custodian-heavy':'custodian'}.webp`
/** One consistent articulated rig; 8 unmirrored directions, 38 poses per role. */
export function TacticalFigure({unit}:{unit:TacticalUnit}) {
  return <g className={`tac-figure ${unit.side==='crew'?'ally':'enemy'}`}>
    <rect className="tac-figure-hitbox" x={-18} y={-60} width={36} height={66} fill="transparent" pointerEvents="all"/>
    <foreignObject x={-40} y={-67} width={80} height={80} pointerEvents="none">
      <div className="tac-rig" style={{width:80,height:80,backgroundImage:`url(${rigAsset(unit)})`,backgroundSize:'3040px 640px',backgroundPosition:'0 -160px'}}/>
    </foreignObject>
    {unit.hp>0&&<g className="tac-visible-weapon" pointerEvents="none">
      <path d={unit.role==='heavy'?'M -1 -34 L 23 -36 L 27 -32 L 23 -29 L 9 -28 L 7 -21 L 1 -21 L 2 -29 L -1 -29 Z':'M 2 -35 L 23 -36 L 23 -33 L 27 -33 L 27 -31 L 18 -30 L 12 -29 L 10 -22 L 6 -22 L 7 -30 L 2 -31 Z'}
        fill={unit.weapon==='plasma'?'#93edf9':'#17262d'} stroke={unit.weapon==='plasma'?'#b9f9ff':'#b1c4c9'} strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M 17 -36 L 17 -40 L 20 -40 L 20 -36" stroke="#7d9599" strokeWidth="1.5" fill="none"/>
      {unit.role==='heavy'&&<path d="M 6 -28 L 11 -25 L 6 -21 Z" fill="#67787e" stroke="#bdc7c7"/>}
    </g>}
    {unit.overwatch&&<path d="M -19 7 L 0 14 L 19 7" fill="none" stroke="#f3d594" strokeWidth={2}/>}
    {unit.hp<=0&&unit.side==='crew'&&<text y={-13} textAnchor="middle" fontSize={9} fill="#ffcf85">DOWN</text>}
  </g>
}

export function TacticalStatus({unit,index}: {unit:TacticalUnit;index:number}) {
  const ally = unit.side === 'crew'
  return <g pointerEvents="none">
    <rect x={-16} y={-60} width={32} height={4} rx={1} fill="#02090e" stroke="#02090e" strokeWidth={2}/>
    <rect x={-16} y={-60} width={32 * unit.hp / unit.maxHp} height={4} rx={1} fill={ally ? '#a3f1d5' : '#ffa06d'}/>
    {ally && <><circle cx={-20} cy={-8} r={8} fill="#071920" stroke="#9ee0d6"/><text x={-20} y={-4.5} textAnchor="middle" fill="#e8fff6" fontSize={10} fontWeight="bold">{index + 1}</text>{[0,1].map((n) => <circle key={n} cx={-4 + n * 8} cy={-66} r={2.5} fill={unit.ap > n ? '#f3d594' : '#30444c'}/>)}</>}
  </g>
}
