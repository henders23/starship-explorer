import {describe,expect,it} from 'vitest'
import {createMission,initialRoster,reduceMission,visible} from '../src/engine/tactical/mission.js'
import type {TacticalEvent} from '../src/engine/tactical/mission.js'
import {enemyPlayback} from '../src/ui/tactical-playback.js'
const mission=()=>createMission('playback','site','Test deck',initialRoster().slice(0,4),1)
describe('ordered tactical presentation',()=>{
 it('observes identical outcomes, RNG and logs without mutating the input',()=>{
  const m=mission(),original=structuredClone(m),events:TacticalEvent[]=[]
  const observed=reduceMission(m,{type:'end-turn'},e=>events.push(e))
  expect(observed).toEqual(reduceMission(m,{type:'end-turn'}));expect(m).toEqual(original)
  expect(events.length).toBeGreaterThan(0)
  const first=structuredClone(events[0]);events.at(-1)!.mission.units[0]!.hp=0
  if(events.length>1)expect(events[0]).toEqual(first)
  expect(observed.units[0]!.hp).toBeGreaterThan(0)
 })
 it('records each shot exactly once in order, including interrupted movement',()=>{
  const m=mission();m.tiles.fill('floor');m.units=m.units.slice(0,4)
  m.units[0]!.overwatch=true
  m.units.push({...m.units[0]!,id:'guard',name:'Guard',side:'hostile',x:10,y:3,hp:8,maxHp:8,move:5,ammo:4,overwatch:false})
  const events:TacticalEvent[]=[];const end=reduceMission(m,{type:'end-turn'},e=>events.push(e))
  const shots=events.filter(e=>e.kind==='shot')
  expect(shots.length).toBeGreaterThanOrEqual(2)
  expect(shots.map(e=>e.mission.rolls)).toEqual(Array.from({length:end.rolls-m.rolls},(_,i)=>m.rolls+i+1))
  expect(shots[0]!.actorId).toBe('operative-0')
  const i=events.indexOf(shots[0]!);expect(events[i-1]!.kind).toBe('move')
  expect(events[i-1]!.mission.units.find(u=>u.id==='guard')!.hp).toBe(8)
  expect(events.at(-1)!.mission.turn).toBe(m.turn)
  expect(end.turn).toBe(m.turn+1)
 })
 it('does not expose unseen hostile movement or reloading in captions',()=>{
  const m=mission();const hidden=m.units.find(u=>u.side==='hostile')!;hidden.x=11;hidden.y=0;hidden.ammo=0
  expect(visible(m,hidden)).toBe(false)
  const frames=enemyPlayback(m)
  expect(frames.filter(f=>['move','reload'].includes(f.kind)&&f.actorId===hidden.id)).toHaveLength(0)
 })
 it('records damage from heat before defeat and leaves all-down debrief until after playback',()=>{
  const m=mission();m.units=m.units.filter(u=>u.side==='crew');m.units.forEach((u,i)=>{u.hp=1;u.x=5;u.y=i})
  m.turn=4;m.operation={kind:'salvage',survivors:[],crates:[],alarm:false,reinforcement:false}
  const frames=enemyPlayback(m),end=reduceMission(m,{type:'end-turn'})
  expect(frames.at(-1)?.kind).toBe('heat');expect(frames.at(-1)?.mission.units.every(u=>u.hp===0)).toBe(true)
  expect(end.outcome).toBe('defeat')
 })
})
