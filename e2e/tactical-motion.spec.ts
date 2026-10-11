import { expect, test } from '@playwright/test'
import { deployBoarding } from '../tools/tactical-walkthrough.js'
import { EXPLORATION_SAVE_KEY, saveExploration } from '../src/ui/exploration-save.js'

test('operatives animate along tile paths and capture real walking frames',async({page},info)=>{
  await page.setViewportSize({width:1440,height:900})
  const state=deployBoarding('cinematic-walk')
  let saved=''
  saveExploration(state,{getItem:()=>null,removeItem:()=>{},setItem:(_,value)=>{saved=value}})
  await page.addInitScript(({key,saved})=>localStorage.setItem(key,saved),{key:EXPLORATION_SAVE_KEY,saved})
  await page.addInitScript(()=>{
    const native=Element.prototype.animate
    Element.prototype.animate=function(frames,options){
      const animation=native.call(this,frames,options)
      if(this.classList.contains('tac-animated-unit')){
        const capture=window as typeof window&{__walk?:Animation;__frames?:Keyframe[]}
        capture.__walk=animation
        capture.__frames=Array.isArray(frames)?frames:undefined
        animation.pause()
      }
      return animation
    }
  })
  await page.goto('/')
  await page.getByRole('button',{name:'Resume expedition'}).click()
  await page.getByRole('button',{name:'Tile 4,4',exact:true}).click()
  await page.getByRole('button',{name:'Move · 1 AP',exact:true}).click()
  const frames=await page.evaluate(()=>(window as typeof window&{__frames?:Keyframe[]}).__frames)
  expect(frames?.length).toBeGreaterThanOrEqual(3)
  expect(frames?.at(-1)?.transform).not.toEqual(frames?.[0]?.transform)
  for(const [i,fraction] of [0,.25,.5,.75,1].entries()){
    await page.evaluate(fraction=>{const animation=(window as typeof window&{__walk:Animation}).__walk;animation.currentTime=(animation.effect?.getTiming().duration as number)*fraction},fraction)
    await page.screenshot({path:info.outputPath(`walking-frame-${i}.png`),animations:'allow'})
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
})
