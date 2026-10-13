import { test,expect } from '@playwright/test'
import { recorderDeployed,nextRecorderOrder,survivorReply,survivorAccepted } from '../tools/survivor-walkthrough.js'
import { legal } from '../tools/long-relay-walkthrough.js'
import { saveExploration,EXPLORATION_SAVE_KEY } from '../src/ui/exploration-save.js'
import type { Campaign } from '../src/engine/exploration/campaign.js'
import type { Page } from '@playwright/test'
import { missionObjective, tacticalAction } from './helpers.js'
async function resume(page:Page,s:Campaign){let saved='';saveExploration(s,{getItem:()=>null,removeItem:()=>{},setItem:(_,v)=>{saved=v}});await page.addInitScript(({key,saved})=>{if(!localStorage.getItem(key))localStorage.setItem(key,saved)},{key:EXPLORATION_SAVE_KEY,saved});await page.goto('/');await page.getByRole('button',{name:'Resume expedition'}).click()}
for(const width of [1440,390,320])test(`real recorder mid-mission at ${width}px`,async({page},info)=>{
 await page.setViewportSize({width,height:1000})
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.url())})
 let s=recorderDeployed()
 for(let i=0;i<200&&!s.mission!.recorder!.carrierId;i++)s=legal(s,{type:'tactical',order:nextRecorderOrder(s.mission!)})
 s=legal(s,{type:'tactical',order:{type:'end-turn'}})
 await resume(page,s)
 await expect(page.getByRole('region',{name:'Tactical map'})).toBeVisible()
 await expect(await missionObjective(page)).toContainText('2 tiles per AP')
 const carrier=s.mission!.units.find(u=>u.id===s.mission!.recorder!.carrierId)!
 await page.getByRole('button',{name:`Select ${carrier.name}`,exact:true}).click()
 await expect(await tacticalAction(page,/^Set recorder down/)).toBeEnabled()
 await page.evaluate(async()=>{await Promise.all(Array.from(document.querySelectorAll('image')).map(i=>new Promise<void>(resolve=>{const a=new Image();a.onload=()=>resolve();a.onerror=()=>resolve();a.src=i.getAttribute('href')!})));document.querySelector('.tactical-deck')?.scrollTo(0,0)})
 await page.screenshot({path:info.outputPath(`recorder-mid-mission-${width}.png`),animations:'disabled'})
 await expect(page.getByRole('button',{name:'Extract team',exact:true})).toBeDisabled()
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 expect(errors).toEqual([])
})
for(const recover of [true,false])test(`survivor conversation and closeout evidence=${recover}`,async({page},info)=>{
 const s=survivorReply('survivor-0',recover),site=s.world.locations.find(l=>l.id===s.survivorArc!.stationId)!
 await resume(page,s)
 await page.getByTestId('location-station').filter({hasText:site.name}).click()
 await expect(page.getByRole('region',{name:'Someone left behind',exact:true})).toContainText(s.survivorArc!.survivor.name)
 await page.getByRole('button',{name:'Acknowledge the survivor'}).click()
 await expect(page.getByRole('button',{name:'Acknowledge the survivor'})).toHaveCount(0)
 await page.reload();await page.getByRole('button',{name:'Resume expedition'}).click()
 await expect(page.getByRole('article',{name:'Active voyage Someone left behind'})).toHaveCount(0)
 await page.screenshot({path:info.outputPath(`survivor-closeout-${recover}.png`)})
})
test('accepted survivor request has a working chart destination on phone',async({page})=>{
 await page.setViewportSize({width:320,height:900});await resume(page,survivorAccepted())
 await page.getByRole('button',{name:/Discoveries/}).click()
 await page.getByRole('button',{name:'Locate survivor objective'}).click()
 await expect(page.getByRole('region',{name:'Interactive stellar chart'})).toBeVisible()
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
})
test('reduced motion snaps position but preserves the legal order, AP and rig',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});const s=recorderDeployed();await resume(page,s)
 // Clicking a reachable tile moves there at once.
 await page.getByRole('button',{name:'Tile 3,4',exact:true}).click()
 const unit=page.getByTestId('tactical-unit-operative-0')
 await expect(unit).not.toHaveClass(/moving/)
 await expect(unit.locator('.tac-rig')).toBeVisible()
 await expect(page.getByRole('status',{name:'Last order'})).toContainText('1 AP left')
})
