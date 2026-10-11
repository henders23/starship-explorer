import type { TacticalUnit } from '../engine/tactical/mission.js'

export const figureAsset = (side: TacticalUnit['side']) => `/assets/exploration/tactical-${side === 'crew' ? 'operative' : 'custodian'}.webp`
/** Status marks stay vector-sharp; bitmap detail never carries gameplay information. */
export function TacticalFigure({ unit }: { unit: TacticalUnit }) {
  const ally = unit.side === 'crew'
  return <g className={`tac-figure ${ally ? 'ally' : 'enemy'}`}>
    <rect className="tac-figure-hitbox" x={-16} y={-54} width={32} height={58} fill="transparent" pointerEvents="all" />
    <image href={figureAsset(unit.side)} x={-32} y={-58} width={64} height={64} pointerEvents="none" />
    {unit.overwatch && <path d="M -19 7 L 0 14 L 19 7" fill="none" stroke="#f3d594" strokeWidth={2}/>}
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
