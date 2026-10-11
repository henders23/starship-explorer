import type { Point } from '../engine/tactical/mission.js'
export const point = (p: Point) => ({x:340+(p.x-p.y)*30,y:52+(p.x+p.y)*16})
export const diamond = (p: Point, lift=0) => { const q=point(p);return `${q.x},${q.y-15-lift} ${q.x+29},${q.y-lift} ${q.x},${q.y+15-lift} ${q.x-29},${q.y-lift}` }
export const depth = (p: Point) => p.x+p.y
