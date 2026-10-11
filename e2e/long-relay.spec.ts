import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import type { Campaign } from '../src/engine/exploration/campaign.js'
import { acceptedRelay, relayDecisionReady, relayReplyReady } from '../tools/long-relay-walkthrough.js'
import { EXPLORATION_SAVE_KEY, saveExploration } from '../src/ui/exploration-save.js'

async function resume(page:Page,state:Campaign) {
  let raw=''
  saveExploration(state,{getItem:()=>null,removeItem:()=>{},setItem:(_,v)=>{raw=v}})
  await page.goto('/')
  await page.evaluate(({key,value})=>localStorage.setItem(key,value),{key:EXPLORATION_SAVE_KEY,value:raw})
  await page.reload()
  await page.getByRole('button',{name:'Resume expedition'}).click()
}
function station(state:Campaign,id:string){
  return state.world.locations.find(s=>s.id===id)!
}
test('Long Relay objective points to a reachable real system',async({page},info)=>{
  const state=acceptedRelay('relay-browser-objective')
  const dest=station(state,state.relayArc!.destinationStationId)
  await resume(page,state)
  await expect(page.getByTestId('relay-objective')).toContainText('Reach Tarek Sen')
  await page.getByRole('button',{name:'Locate on chart'}).click()
  await expect(page.getByRole('heading',{name:'Galaxy chart'})).toBeVisible()
  await expect(page.locator('.exp-detail')).toContainText(dest.name.split(' · ')[0]!)
  await page.screenshot({path:info.outputPath('relay-accepted-desktop.png'),fullPage:true,animations:'disabled'})
})
for(const approach of ['repair','local-copy'] as const)test('Long Relay '+approach+' choice, persistence and acknowledgement',async({page},info)=>{
  if(approach==='local-copy')await page.setViewportSize({width:390,height:844})
  const initial=relayDecisionReady('relay-browser-'+approach)
  const target=station(initial,initial.relayArc!.destinationStationId)
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
  await resume(page,initial)
  await page.getByTestId('location-station').filter({hasText:target.name}).click()
  const panel=page.getByTestId('relay-conversation')
  await expect(panel).toContainText('Tarek Sen')
  await page.screenshot({path:info.outputPath('relay-choice-'+approach+'.png'),fullPage:true,animations:'disabled'})
  await panel.getByRole('button',{name:approach==='repair'?'Repair the shared relay':'Carry a private copy'}).click()
  await expect(page.getByTestId('relay-objective')).toContainText('Return to Edda Sol')
  await page.reload()
  await page.getByRole('button',{name:'Resume expedition'}).click()
  await expect(page.getByTestId('relay-objective')).toContainText('Return to Edda Sol')
  const reply=relayReplyReady('relay-browser-'+approach,approach)
  const origin=station(reply,reply.relayArc!.originStationId)
  await resume(page,reply)
  await page.getByTestId('location-station').filter({hasText:origin.name}).click()
  await expect(page.getByTestId('relay-conversation')).toContainText('Edda Sol')
  await page.getByRole('button',{name:'Give Edda the reply'}).click()
  await expect(page.getByTestId('relay-objective')).toHaveCount(0)
  await page.getByRole('button',{name:/Discoveries/}).click()
  await expect(page.getByRole('article',{name:'Long Relay captain’s record'})).toContainText(approach==='repair'?'Restored the public communications relay':'Carried a private reply')
  await page.reload()
  await page.getByRole('button',{name:'Resume expedition'}).click()
  await page.getByRole('button',{name:/Discoveries/}).click()
  await expect(page.getByRole('article',{name:'Long Relay captain’s record'})).toContainText('Edda received Tarek’s answer')
  await page.screenshot({path:info.outputPath('relay-complete-'+approach+'.png'),fullPage:true,animations:'disabled'})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  expect(errors).toEqual([])
})
