import { siteVariant } from '../src/engine/tactical/variants.js'
import { briefing, missionObjective, tacticalAction } from './helpers.js'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { readyOperation, completeOperation, nextOperationOrder, launchOperation } from '../tools/operation-walkthrough.js'
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
  const ready = readyOperation('browser-operations')
  const site = ready.world.locations.find((l)=>l.name==='The Silent Courier')!
  const names = launchOperation(ready.seed,'rescue',siteVariant(ready.seed,site.id)).mission!.operation!.survivors.map((s)=>s.name)
  await resume(page,ready)
  await page.getByRole('button',{name:/The Silent Courier/}).click()
  await briefing(page)
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
  await missionObjective(page)
  await expect(page.locator('.operation-tracker')).toContainText(names[0]!)
  await expect(page.locator('.operation-tracker')).toContainText(names[1]!)
  await page.screenshot({path:info.outputPath('rescue-deck.png'),fullPage:true})
  await noOverflow(page)
  await page.getByRole('button',{name:'Extract team',exact:true}).click()
  const confirm=page.getByRole('dialog',{name:'Confirm extraction'})
  await expect(confirm).toContainText(`Civilians left behind: ${names.join(', ')}`)
  await expect(confirm).toContainText('No objective secured: no reward')
  await page.getByRole('button',{name:'Keep the shuttle waiting'}).click()
  await expect(confirm).not.toBeVisible()
  await page.getByRole('button',{name:'Extract team',exact:true}).click()
  await page.getByRole('button',{name:'Confirm extraction and losses'}).click()
  await expect(page.getByRole('region',{name:'Mission debrief'})).toContainText('No reward; the site remains available')
  await page.getByRole('button',{name:'Return to the Lodestar'}).click()
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
  await (await tacticalAction(page,new RegExp(`^${interactionLabel(before.mission!)}`))).click()
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
  await page.getByRole('button',{name:'Return to the Lodestar'}).click()
  await expect(page.getByTestId('exp-materials')).toHaveText(String(run.final.exploration.materials))
  await page.reload();await page.getByRole('button',{name:'Resume expedition'}).click()
  await expect(page.getByTestId('exp-materials')).toHaveText(String(run.final.exploration.materials))
  await noOverflow(page)
})

for(const width of [1440,390,320])test(`alternate decks, figures and quick controls at ${width}px`,async({page},info)=>{
  await page.setViewportSize({width,height:900})
  await page.emulateMedia({reducedMotion:'reduce'})
  for(const kind of OPERATION_KINDS){
    await resume(page,launchOperation('visual-variants',kind,3))
    const assets = kind==='rescue' ? ['operative','custodian','survivor'] : ['operative','custodian']
    for(const name of assets){
      expect(await page.evaluate(async (src)=>{const img=new Image();img.src=src;try{await img.decode();return img.naturalWidth===512}catch{return false}},`/assets/exploration/tactical-${name}.webp`)).toBe(true)
    }
    await page.keyboard.press('n')
    await expect(page.locator('.tac-orders h2')).toHaveText(/Idris Okonkwo$/)
    await page.getByRole('button',{name:'Select Sofia Reyes',exact:true}).click()
    await expect(page.locator('.tac-orders h2')).toHaveText(/Sofia Reyes$/)
    if(width<721){
      await page.getByRole('button',{name:'Enlarge map',exact:true}).click()
      await expect(page.locator('.tac-scroll')).toHaveClass(/expanded/)
    }
    await noOverflow(page)
    await page.screenshot({path:info.outputPath(`${kind}-variant-three.png`),fullPage:true})
    await page.reload();await page.getByRole('button',{name:'Resume expedition'}).click()
    const raw=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),EXPLORATION_SAVE_KEY)
    expect(raw.actions.at(-1)).toMatchObject({type:'deploy-operation',variant:3,kind})
  }
})
