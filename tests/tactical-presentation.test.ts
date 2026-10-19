import { describe, expect, it } from 'vitest'
import { operativePortrait, enemyAppearance, gunName } from '../src/ui/tactical-identity.js'
import { cueForTacticalOrder } from '../src/ui/tactical-audio.js'
import { DECK_STYLES, deckStyle } from '../src/ui/tactical-environment.js'
import { initialRoster, createOperation } from '../src/engine/tactical/mission.js'
import { OPERATION_KINDS } from '../src/engine/tactical/operations.js'
import { rigAsset } from '../src/ui/TacticalFigure.js'

describe('tactical presentation', () => {
 it('gives each original operative a stable, distinct portrait',()=>{
  const roster=initialRoster()
  const ids=roster.map(operativePortrait)
  expect(new Set(ids).size).toBe(roster.length)
  for(const url of ids)expect(url).toMatch(/^\/assets\/portraits\/\d+_/)
  expect(operativePortrait({id:'recruit-9'})).toBe(operativePortrait({id:'recruit-9'}))
 })
 it('distinguishes four enemy visual archetypes without touching combat rules',()=>{
  const enemies=['sentry-0','sentry-1','sentry-2','reserve'].map(id=>enemyAppearance({id,side:'hostile'}))
  expect(new Set(enemies.map(e=>e.kind)).size).toBe(4)
  expect(enemies.every(e=>e.name.length>0)).toBe(true)
  expect(rigAsset({id:'reserve',side:'hostile'} as any)).toMatch(/custodian-heavy/)
 })
 it('selects sounds by weapon and preserves mute-independent action meaning',()=>{
  expect(cueForTacticalOrder({type:'shoot'},{role:'heavy'})).toBe('heavy')
  expect(cueForTacticalOrder({type:'shoot'},{role:'assault',weapon:'plasma'})).toBe('plasma')
  expect(cueForTacticalOrder({type:'reload'})).toBe('reload')
  expect(cueForTacticalOrder({type:'end-turn'})).toBe('turn')
  expect(gunName({role:'engineer',weapon:'standard'})).toContain('service rifle')
 })
 it('assigns differentiated deck palettes to existing and new maps',()=>{
  const roster=initialRoster().slice(0,4)
  const styles=new Set<string>()
  for(const kind of OPERATION_KINDS)for(const variant of [1,2,3,4,5] as const){
   const mission=createOperation('presentation-seed','site','Ship',roster,1,{},kind,variant)
   const style=deckStyle(mission)
   expect(style.accent).toMatch(/^#/)
   styles.add(style.key)
  }
  expect(styles.size).toBeGreaterThanOrEqual(4)
  expect(DECK_STYLES.archive.key).toBe('archive')
 })
})
