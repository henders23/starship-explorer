import { enemyAppearance } from './tactical-identity.js'
import { figureProfile } from './tactical-figure-geometry.js'
import type { TacticalUnit } from '../engine/tactical/mission.js'
export const figureAsset = (side: TacticalUnit['side']) => `/assets/exploration/tactical-${side === 'crew' ? 'operative' : 'custodian'}.webp`
export const rigAsset = (unit:TacticalUnit) => `/assets/tactical/${unit.side==='crew'?unit.role:enemyAppearance(unit).kind==='enforcer'?'custodian-heavy':'custodian'}.webp`
/** One consistent articulated rig; 8 unmirrored directions, 38 poses per role. */
export function TacticalFigure({unit}:{unit:TacticalUnit}) {
  const visual=enemyAppearance(unit)
  const form=figureProfile(visual.kind)
  const enemy=unit.side==='hostile'
  return <g className={`tac-figure ${unit.side==='crew'?'ally':'enemy'}`} data-profile={enemy?visual.kind:unit.role}>
    <rect className="tac-figure-hitbox" x={-18} y={-60} width={36} height={66} fill="transparent" pointerEvents="all"/>
    <foreignObject x={-40} y={-67} width={80} height={80} pointerEvents="none">
      <div className="tac-rig" style={{width:80,height:80,backgroundImage:`url(${rigAsset(unit)})`,backgroundSize:'3040px 640px',backgroundPosition:'0 -160px'}}/>
    </foreignObject>
    {/* Narrow material highlights preserve the underlying animated rig and its face.
         Separate shoulder, visor and gun clusters evoke the attached equipment from
         the reference without pretending the unfinished GLTF skin is present. */}
    {enemy&&unit.hp>0&&<g className="tac-enemy-equipment" pointerEvents="none" aria-hidden="true">
      <path d={`M ${-form.shoulder} -44 L -11 -48 L 11 -48 L ${form.shoulder} -44 L ${form.shoulder-2} -34 L 11 -38 L -11 -38 L ${-form.shoulder+2} -34 Z`}
        fill="#263843" fillOpacity=".74" stroke={form.accent} strokeOpacity=".7" strokeWidth="1.2"/>
      <path d={`M ${-form.head} -55 L ${form.head} -55 L ${form.head-1} -49 L ${-form.head+1} -49 Z`}
        fill="#111d26" fillOpacity=".94" stroke={form.accent} strokeWidth=".8"/>
      <path d={`M ${-form.head+2} -52 L ${form.head-2} -52`} stroke={form.accent} strokeWidth="2.2" strokeLinecap="round"/>
      {visual.kind==='scout'&&<><path d="M -3 -55 L -7 -68 M 4 -55 L 8 -62" stroke="#b5c1bf" strokeWidth="1.2"/><circle cx={-7} cy={-68} r={2.2} fill="#e5c487"/></>}
      {visual.kind==='sentinel'&&<><path d="M -21 -43 L -16 -50 L -7 -45 M 21 -43 L 16 -50 L 7 -45" fill="#334a53" stroke="#d9aaa0"/><path d="M -12 -35 H 12" stroke="#e98776" strokeWidth="2.1"/></>}
      {visual.kind==='enforcer'&&<><path d="M -20 -40 L -24 -27 L -12 -27 L -8 -38 M 20 -40 L 24 -27 L 12 -27 L 8 -38" fill="#48515a" stroke="#cba486" strokeWidth="1.1"/><rect x={-7} y={-39} width={14} height={8} rx={1} fill="#52626e" stroke="#ead0a2"/><path d="M 0 -39 v 8" stroke="#edb683"/></>}
    </g>}
    {unit.hp>0&&<g className="tac-visible-weapon" pointerEvents="none" data-testid={`weapon-${unit.id}`}>
      <g className="tac-weapon-body">
      <path d={unit.role==='heavy'?'M -1 -34 L 23 -36 L 27 -32 L 23 -29 L 9 -28 L 7 -21 L 1 -21 L 2 -29 L -1 -29 Z':'M 2 -35 L 23 -36 L 23 -33 L 27 -33 L 27 -31 L 18 -30 L 12 -29 L 10 -22 L 6 -22 L 7 -30 L 2 -31 Z'}
        fill={unit.weapon==='plasma'?'#93edf9':'#17262d'} stroke={unit.weapon==='plasma'?'#b9f9ff':'#b1c4c9'} strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M 17 -36 L 17 -40 L 20 -40 L 20 -36" stroke="#7d9599" strokeWidth="1.5" fill="none"/>
      {unit.role==='heavy'&&<path d="M 6 -28 L 11 -25 L 6 -21 Z" fill="#67787e" stroke="#bdc7c7"/>}
      {unit.weapon==='plasma'&&<path d="M 7 -34 H 19" stroke="#b7ffff" strokeWidth="1.6" opacity=".9"/>}
      </g>
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
