import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { readyOperation, completeOperation, nextOperationOrder } from '../tools/operation-walkthrough.js'
import type { Campaign } from '../src/engine/exploration/campaign.js'
import { reduceCampaign } from '../src/engine/exploration/campaign.js'
import { OPERATION_KINDS, OPERATION_BRIEFINGS } from '../src/engine/tactical/operations.js'
import { interactionLabel } from '../src/engine/tactical/mission.js'
import { EXPLORATION_SAVE_KEY, saveExploration } from '../src/ui/exploration-save.js'

async function resume(page: Page, state: Campaign) {
  let raw = ''
  saveExploration(state, { getItem:()=>null, removeItem:()=>{}, setItem:(_,v)=>{raw=v} })
  await page.goto('/')
  await page.evaluate(({key,raw})=>localStorage.setItem(key,raw), {key:EXPLORATION_SAVE_KEY,raw})
  await page.reload()
  await page.getByRole('button', {name:'Resume expedition'}).click()
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true)
}
for (const mobile of [false,true]) test(`operation briefings and withdrawal on ${mobile?'mobile':'desktop'}`,async({page},info)=>{
  if(mobile)await page.setViewportSize({width:390,height:844})
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
  await resume(page,readyOperation('browser-operations'))
  await page.getByRole('button',{name:/The Silent Courier/}).click()
  await page.getByRole('button',{name:'Board with away team · tactical mission'}).click()
  for(const kind of OPERATION_KINDS){
    await page.getByRole('combobox',{name:'Mission contract'}).selectOption(kind)
    await expect(page.getByRole('region',{name:'Mission briefing'})).toContainText(OPERATION_BRIEFINGS[kind].title)
    const art=page.locator('.away-briefing-art')
    await expect(art).toHaveAttribute('src',`/assets/exploration/mission-${kind}.webp`)
    await expect.poll(()=>art.evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0)).toBe(true)
    await page.getByRole('combobox',{name:'Mission contract'}).scrollIntoViewIfNeeded()
    await page.screenshot({path:info.outputPath(`${kind}-briefing.png`),fullPage:true})
    await noOverflow(page)
  }
  await page.getByRole('combobox',{name:'Mission contract'}).selectOption('rescue')
  await page.getByRole('button',{name:'Deploy away team',exact:true}).click()
  await expect(page.locator('.operation-tracker')).toContainText('Dr Imani Hale')
  await expect(page.locator('.operation-tracker')).toContainText('Tarin Voss')
  await page.screenshot({path:info.outputPath('rescue-deck.png'),fullPage:true})
  await noOverflow(page)
  await page.getByRole('button',{name:'Extract team',exact:true}).click()
  const confirm=page.getByRole('dialog',{name:'Confirm extraction'})
  await expect(confirm).toContainText('Civilians left behind: Dr Imani Hale, Tarin Voss')
  await expect(confirm).toContainText('No objective secured: no reward')
  await page.getByRole('button',{name:'Keep the shuttle waiting'}).click()
  await expect(confirm).not.toBeVisible()
  await page.getByRole('button',{name:'Extract team',exact:true}).click()
  await page.getByRole('button',{name:'Confirm extraction and losses'}).click()
  await expect(page.getByRole('region',{name:'Mission debrief'})).toContainText('No reward; the site remains available')
  await page.getByRole('button',{name:'Return to the Ithaca'}).click()
  expect(errors).toEqual([])
})
for(const kind of OPERATION_KINDS)test(`${kind} objective, reload, extraction and one-time reward`,async({page},info)=>{
  if(kind==='salvage')await page.setViewportSize({width:390,height:844})
  const run=completeOperation('operation-sweep-0',kind),before=run.interaction!
  await resume(page,before)
  const order=nextOperationOrder(before.mission!)
  if(!('unitId' in order))throw new Error('Expected objective order')
  const unit=before.mission!.units.find(u=>u.id===order.unitId)!
  await page.getByRole('button',{name:`Select ${unit.name}`,exact:true}).click()
  await page.getByRole('button',{name:`${interactionLabel(before.mission!)} · 1 AP`,exact:true}).click()
  await page.reload();await page.getByRole('button',{name:'Resume expedition'}).click()
  const after=reduceCampaign(before,{type:'tactical',order})
  const raw=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),EXPLORATION_SAVE_KEY)
  expect(raw.actions).toEqual(after.actions)
  await page.screenshot({path:info.outputPath(`${kind}-objective.png`),fullPage:true})
  await noOverflow(page)
  await resume(page,run.extraction!)
  await page.getByRole('button',{name:'Extract team',exact:true}).click()
  await page.getByRole('button',{name:'Confirm safe extraction'}).click()
  await expect(page.getByRole('region',{name:'Mission debrief'})).toContainText('Rewards and crew records are applied when you acknowledge')
  await page.screenshot({path:info.outputPath(`${kind}-debrief.png`),fullPage:true})
  await page.reload();await page.getByRole('button',{name:'Resume expedition'}).click()
  await page.getByRole('button',{name:'Return to the Ithaca'}).click()
  await expect(page.getByTestId('exp-materials')).toHaveText(String(run.final.exploration.materials))
  await page.reload();await page.getByRole('button',{name:'Resume expedition'}).click()
  await expect(page.getByTestId('exp-materials')).toHaveText(String(run.final.exploration.materials))
  await noOverflow(page)
})
