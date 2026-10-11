import { expect, test } from '@playwright/test'
import { deployBoarding } from '../tools/tactical-walkthrough.js'
import { completeOperation } from '../tools/operation-walkthrough.js'
import { reduceCampaign } from '../src/engine/exploration/campaign.js'
import { EXPLORATION_SAVE_KEY, saveExploration } from '../src/ui/exploration-save.js'

for(const width of [1440,390])test(`movement preview, targeting and combat feedback at ${width}px`,async({page},info)=>{
  await page.setViewportSize({width,height:900})
  await page.emulateMedia({reducedMotion:'reduce'})
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
  const initial=deployBoarding('guidance-browser')
  let raw='';saveExploration(initial,{getItem:()=>null,removeItem:()=>{},setItem:(_,v)=>{raw=v}})
  await page.addInitScript(({key,raw})=>{if(!localStorage.getItem(key))localStorage.setItem(key,raw)},{key:EXPLORATION_SAVE_KEY,raw})
  await page.goto('/');await page.getByRole('button',{name:'Resume expedition'}).click()
  await page.getByRole('button',{name:'Tile 3,4',exact:true}).click()
  const preview=page.locator('.tac-move-preview')
  await expect(preview).toContainText('1 AP → 1 AP left')
  await expect(preview).toContainText('Unseen threats are not included')
  await expect(page.getByTestId('movement-route')).toBeVisible()
  await page.getByRole('checkbox',{name:/Sprint/}).check()
  await expect(preview).toContainText('2 AP → 0 AP left')
  await expect(preview).toContainText('cannot fire or interact')
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).actions.length,EXPLORATION_SAVE_KEY)).toBe(initial.actions.length)
  await page.getByRole('button',{name:'Cancel move',exact:true}).click()
  await expect(preview).toHaveCount(0)
  await page.getByRole('checkbox',{name:/Sprint/}).uncheck()
  await page.getByRole('button',{name:'Tile 3,4',exact:true}).click()
  await preview.scrollIntoViewIfNeeded()
  await page.screenshot({path:info.outputPath('movement-preview.png'),fullPage:true})
  await page.getByRole('button',{name:'Move · 1 AP',exact:true}).click()
  await expect(page.getByRole('status',{name:'Last order'})).toContainText('1 AP spent. 1 AP left.')
  await page.getByRole('button',{name:/Custodian 1.*HP/}).click()
  await expect(page.getByTestId('target-line')).toBeVisible()
  await page.getByRole('button',{name:'Fire · 1 AP',exact:true}).click()
  await expect(page.getByRole('status',{name:'Last order'})).toContainText(/Shot hit|Shot missed/)
  await page.getByRole('button',{name:'End turn · hostiles act',exact:true}).click()
  await expect(page.getByRole('status',{name:'Last order'})).toContainText('Enemy turn resolved')
  await expect(page.getByRole('status',{name:'Last order'})).toContainText(/shots? exchanged/)
  await page.getByRole('status',{name:'Last order'}).scrollIntoViewIfNeeded()
  await page.screenshot({path:info.outputPath('combat-feedback.png'),fullPage:true})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.reload();await page.getByRole('button',{name:'Resume expedition'}).click()
  await expect(page.getByRole('status',{name:'Last order'})).toHaveCount(0)
  expect(errors).toEqual([])
})

test('nearer bulkheads occlude figures while status marks remain above the scenery',async({page},info)=>{
  const s=deployBoarding('depth-browser');let raw=''
  saveExploration(s,{getItem:()=>null,removeItem:()=>{},setItem:(_,v)=>{raw=v}})
  await page.addInitScript(({key,raw})=>localStorage.setItem(key,raw),{key:EXPLORATION_SAVE_KEY,raw})
  await page.goto('/');await page.getByRole('button',{name:'Resume expedition'}).click()
  for(const tile of ['Tile 3,2','Tile 4,2']){
    await page.getByRole('button',{name:tile,exact:true}).click()
    await page.getByRole('button',{name:'Move · 1 AP',exact:true}).click()
  }
  const order=await page.getByTestId('depth-objects').locator(':scope > g').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-object-id')))
  expect(order.indexOf('operative-0')).toBeLessThan(order.indexOf('obstacle-27'))
  expect(await page.getByTestId('depth-objects').evaluate(el=>Boolean(el.compareDocumentPosition(document.querySelector('[data-testid="tactical-status-marks"]')!)&Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true)
  await page.getByRole('region',{name:'Tactical map'}).scrollIntoViewIfNeeded()
  await page.screenshot({path:info.outputPath('bulkhead-depth.png'),fullPage:true})
})

test('salvage heat preview matches actual end-turn damage',async({page},info)=>{
  await page.setViewportSize({width:390,height:900})
  let state=completeOperation('operation-sweep-0','salvage').extraction!
  while(state.mission!.turn<7)state=reduceCampaign(state,{type:'tactical',order:{type:'end-turn'}})
  let raw='';saveExploration(state,{getItem:()=>null,removeItem:()=>{},setItem:(_,v)=>{raw=v}})
  await page.addInitScript(({key,raw})=>localStorage.setItem(key,raw),{key:EXPLORATION_SAVE_KEY,raw})
  await page.goto('/');await page.getByRole('button',{name:'Resume expedition'}).click()
  await page.getByRole('button',{name:'Tile 5,4',exact:true}).click()
  await expect(page.locator('.tac-move-preview')).toContainText('End-turn heat here: −2 health')
  await expect(page.locator('.tac-move-preview')).toContainText('Shields do not protect')
  await page.locator('.tac-move-preview').scrollIntoViewIfNeeded()
  await page.screenshot({path:info.outputPath('heat-preview.png'),fullPage:true})
  await page.getByRole('button',{name:'Move · 1 AP',exact:true}).click()
  await page.getByRole('button',{name:'End turn · hostiles act',exact:true}).click()
  await expect(page.getByRole('status',{name:'Last order'})).toContainText('Mara Chen: −2 health.')
})
