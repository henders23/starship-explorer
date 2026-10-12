import { expect,it } from 'vitest'
import { createMission,initialRoster,reduceMission } from '../src/engine/tactical/mission.js'
import { facing,routeBetween,restPose,reaction } from '../src/ui/tactical-animation.js'
it('faces all octants without mirroring the rifle',()=>{
 const directions=new Set([[-1,-1],[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0]].map(([x,y])=>facing({x:0,y:0},{x:x!,y:y!})))
 expect(directions.size).toBe(8);expect(facing({x:1,y:1},{x:1,y:1},3)).toBe(3)
})
it('follows traversable engine route without changing AP, RNG, positions or journal',()=>{
 const m=createMission('animation','s','Deck',initialRoster().slice(0,4),0),original=JSON.stringify(m),u=m.units[0]!
 const next=reduceMission(m,{type:'move',unitId:u.id,x:3,y:3}),after=next.units[0]!
 const route=routeBetween(m,u,after)
 expect(route.at(-1)).toEqual({x:3,y:3});expect(route.length).toBeGreaterThan(2)
 route.slice(1).forEach((p,i)=>expect(Math.abs(p.x-route[i]!.x)+Math.abs(p.y-route[i]!.y)).toBe(1))
 expect(JSON.stringify(m)).toBe(original);expect(after.ap).toBe(1);expect(next.rolls).toBe(m.rolls)
 expect(restPose(m,{...u,hp:0})).toBe('fall')
 expect(reaction(u,{...u,ammo:u.ammo-1})).toBe('fire');expect(reaction(u,{...u,hp:u.hp-1})).toBe('hit')
})
