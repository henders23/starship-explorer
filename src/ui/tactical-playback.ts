import { useEffect, useRef, useState } from 'react'
import { reduceMission, visible } from '../engine/tactical/mission.js'
import type { Mission, TacticalEvent } from '../engine/tactical/mission.js'

export interface PlaybackFrame { mission: Mission; label: string; duration: number; actorId?: string; kind: TacticalEvent['kind'] | 'start' }
/** Derived from the same reducer as the saved order. Hidden movement is omitted. */
export function enemyPlayback(before: Mission): PlaybackFrame[] {
  const frames: PlaybackFrame[] = []
  let previous = before
  reduceMission(before, {type:'end-turn'}, event => {
    const {mission:m, actorId, kind} = event
    const actor = m.units.find(u=>u.id===actorId)
    const oldActor = previous.units.find(u=>u.id===actorId)
    const seen = !!actor && (actor.side==='crew' || visible(m,actor) || !!oldActor && visible(previous,oldActor))
    const target = m.units.find(u=>u.id===event.targetId)
    if (seen || kind==='reserve' || kind==='heat' || kind==='shot' && target?.side==='crew') {
      const name=seen?actor?.name:'Unseen hostile'
      const label=kind==='move'?`${name} moving`:kind==='reload'?`${name} reloading`:kind==='reserve'?'Security reserve entering the deck':kind==='heat'?'Thermal surge — exposed crew take damage':`${name} → ${target?.name ?? 'target'} · ${m.log.at(-1)?.split(': ').at(-1) ?? 'shot'}`
      frames.push({mission:m,label,duration:kind==='move'?190:kind==='shot'?850:700,actorId:seen?actorId:undefined,kind})
    }
    previous=m
  })
  return frames.length ? [{mission:before,label:'Hostile turn',duration:300,kind:'start'},...frames] : []
}

export function useEnemyPlayback() {
  const [playback,setPlayback]=useState<{frames:PlaybackFrame[];index:number}|null>(null)
  const [speed,setSpeed]=useState(1)
  const [reset,setReset]=useState(0)
  const busy=useRef(false)
  const skip=()=>{busy.current=false;setPlayback(null);setReset(n=>n+1)}
  useEffect(()=>{
    if(!playback)return
    const timer=window.setTimeout(()=>{
      if(playback.index+1===playback.frames.length){busy.current=false;setPlayback(null)}
      else setPlayback({...playback,index:playback.index+1})
    },playback.frames[playback.index]!.duration/speed)
    return ()=>window.clearTimeout(timer)
  },[playback,speed])
  useEffect(()=>{
    const media=window.matchMedia('(prefers-reduced-motion: reduce)')
    const change=()=>{if(media.matches)skip()}
    media.addEventListener('change',change)
    return ()=>media.removeEventListener('change',change)
  },[])
  return {frame:playback?.frames[playback.index],index:playback?.index??0,total:playback?.frames.length??0,reset,busy,speed,setSpeed,skip,
    start:(mission:Mission)=>{
      if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return
      const frames=enemyPlayback(mission)
      if(frames.length){busy.current=true;setPlayback({frames,index:0})}
    }}
}
