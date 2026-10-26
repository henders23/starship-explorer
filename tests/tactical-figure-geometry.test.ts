import {describe,expect,it} from 'vitest'
import {weaponFacingAngle,shotMuzzle,figureProfile} from '../src/ui/tactical-figure-geometry.js'
describe('weapon grips and enemy silhouettes',()=>{
 it('has eight unique viewing directions and normalizes 0..7',()=>{
  const angles=Array.from({length:8},(_,i)=>weaponFacingAngle(i))
  expect(new Set(angles).size).toBe(8)
  expect(weaponFacingAngle(8)).toBe(weaponFacingAngle(0))
  expect(weaponFacingAngle(-1)).toBe(weaponFacingAngle(7))
 })
 it('mounts the gun muzzle towards the target but keeps it near the shooter',()=>{
  expect(shotMuzzle({x:100,y:140},{x:200,y:140})).toEqual({x:122,y:109})
  expect(shotMuzzle({x:100,y:140},{x:100,y:40})).toEqual({x:100,y:102})
  expect(Object.values(shotMuzzle({x:0,y:0},{x:0,y:0})).every(Number.isFinite)).toBe(true)
 })
 it('distinguishes physical size and silhouette for all four current opponents',()=>{
  const names=['scout','custodian','sentinel','enforcer'] as const
  expect(new Set(names.map(n=>figureProfile(n).shoulder)).size).toBe(4)
  expect(figureProfile('enforcer').shoulder).toBeGreaterThan(figureProfile('scout').shoulder)
 })
})
