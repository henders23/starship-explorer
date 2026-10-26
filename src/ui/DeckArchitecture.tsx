import type { Mission, Point } from '../engine/tactical/mission.js'
import { point } from './isometric.js'

/** Cutaway hull is outside the playable grid; every obstruction stays tile-driven. */
export function DeckArchitecture({m}:{m:Mission}) {
  const archive=!!m.recorder
  const panel=(a:Point,b:Point,key:string,i:number)=>{
    const p=point(a),q=point(b),h=31
    return <g key={key}>
      <path d={`M ${p.x} ${p.y} L ${q.x} ${q.y} L ${q.x} ${q.y-h} L ${p.x} ${p.y-h} Z`} fill="url(#hull-panel)" stroke="#53626a" strokeWidth=".6"/>
      <path d={`M ${p.x} ${p.y-h} L ${q.x} ${q.y-h}`} stroke="#809399" strokeWidth="3"/>
      <path d={`M ${p.x+1} ${p.y-5} L ${p.x+1} ${p.y-h+3}`} stroke="#162831" strokeWidth="3"/>
      <path d={`M ${p.x*.8+q.x*.2} ${p.y*.8+q.y*.2-22} L ${p.x*.2+q.x*.8} ${p.y*.2+q.y*.8-22}`} stroke={i%3===0?'#e7b57a':'#9bc8cc'} strokeWidth="2"/>
      {[9,12,15].map(y=><path key={y} d={`M ${p.x*.75+q.x*.25} ${p.y*.75+q.y*.25-y} L ${p.x*.25+q.x*.75} ${p.y*.25+q.y*.75-y}`} stroke="#111f26" strokeWidth="1.3"/>)}
    </g>
  }
  return <g pointerEvents="none" className="tac-hull">
    <defs><linearGradient id="hull-panel" x2="0" y2="1"><stop stopColor="#526570"/><stop offset=".4" stopColor="#2d414d"/><stop offset="1" stopColor="#18242d"/></linearGradient></defs>
    {Array.from({length:m.height},(_,i)=>i>=3&&i<=6?null:panel({x:-.52,y:i-.5},{x:-.52,y:i+.5},`port-${i}`,i))}
    {Array.from({length:m.width},(_,i)=>panel({x:i-.5,y:-.52},{x:i+.5,y:-.52},`starboard-${i}`,i))}
    <path d="M 54 212 L 354 372 L 699 188 L 699 206 L 354 390 L 54 230 Z" fill="#071119" opacity=".65"/>
    <g transform="translate(77 190)"><path d="M -25 8 L -25 -13 L 20 -37 L 20 -16" fill="none" stroke="#80979a" strokeWidth="4"/><path d="M -25 -12 L 20 -36" stroke="#9aefd1" strokeWidth="2"/><text x="-39" y="37" fill="#b9e5d9" fontSize="7" letterSpacing="1.3">SHUTTLE DOCK</text></g>
    <text x="24" y="28" fill="#c5d1cc" fontSize="9" letterSpacing="2">{archive?'MNEMOSYNE / ARCHIVE 04':'LODESTAR / BOARDING FEED'}</text>
    <text x="24" y="41" fill="#73929e" fontSize="6.5" letterSpacing="1.4">{archive?'ISOLATED STORAGE · EMERGENCY POWER':'CUTAWAY / LOCAL TELEMETRY'}</text>
  </g>
}
