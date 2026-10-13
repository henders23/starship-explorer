import {test,expect} from '@playwright/test'
import type {Page} from '@playwright/test'
import {recorderDeployed,nextRecorderOrder} from '../tools/survivor-walkthrough.js'
import {legal} from '../tools/long-relay-walkthrough.js'
import {saveExploration,EXPLORATION_SAVE_KEY} from '../src/ui/exploration-save.js'
import {reduceMission} from '../src/engine/tactical/mission.js'
import type {Campaign} from '../src/engine/exploration/campaign.js'
function midMission(){let s=recorderDeployed();for(let i=0;i<200&&!s.mission!.recorder!.carrierId;i++)s=legal(s,{type:'tactical',order:nextRecorderOrder(s.mission!)});return s}
async function resume(page:Page,s:Campaign){let raw='';saveExploration(s,{getItem:()=>null,removeItem:()=>{},setItem:(_,v)=>{raw=v}});await page.addInitScript(({key,raw})=>{if(!localStorage.getItem(key))localStorage.setItem(key,raw)},{key:EXPLORATION_SAVE_KEY,raw});await page.goto('/');await page.getByRole('button',{name:'Resume expedition'}).click()}
for(const [width,height] of [[1366,768],[1440,900],[1920,1080]])test(`laptop archive layout ${width}x${height}`,async({page},info)=>{
 await page.setViewportSize({width:width!,height:height!});await resume(page,legal(midMission(),{type:'tactical',order:{type:'end-turn'}}))
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 await page.evaluate(async()=>{const urls=[...new Set([...document.querySelectorAll('image')].map(i=>i.getAttribute('href')!))];await Promise.all(urls.map(async src=>{const i=new Image();i.src=src;await i.decode()}));await Promise.all([...document.querySelectorAll<HTMLElement>('.tac-rig')].map(async el=>{const img=new Image();img.src=el.style.backgroundImage.slice(5,-2);await img.decode()}))})
 const bounds=await page.locator('.tac-quickbar').boundingBox();expect(bounds!.y+bounds!.height).toBeLessThan(height!);expect((await page.locator('.tac-squad').boundingBox())!.y).toBeLessThan(height!)
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 await page.screenshot({path:info.outputPath(`laptop-archive-${width}.png`)})
 const normal=(await page.locator('.tac-scroll').boundingBox())!.width
 const scale=await page.locator('.tac-board').evaluate(e=>(e as SVGSVGElement).getScreenCTM()!.a)
 await page.getByRole('button',{name:'Enlarge map',exact:true}).click();expect((await page.locator('.tac-scroll').boundingBox())!.width).toBeGreaterThan(normal)
 await expect(page.locator('.tac-orders')).toBeHidden()
 expect(await page.locator('.tac-board').evaluate(e=>(e as SVGSVGElement).getScreenCTM()!.a)).toBeGreaterThan(scale)
 await page.screenshot({path:info.outputPath(`laptop-focus-${width}.png`)})
 await page.getByRole('button',{name:'Fit map',exact:true}).click();await page.keyboard.press('2');await expect(page.locator('.tac-orders h2')).toHaveText(/Idris Okonkwo$/)
 expect(errors).toEqual([])
})
test('plays actual enemy shots in order, locks commands, then resumes with saved outcome',async({page},info)=>{
 await page.setViewportSize({width:1366,height:768});const s=midMission(),end=reduceMission(s.mission!,{type:'end-turn'});await resume(page,s)
 await page.keyboard.press('Shift+Enter')
 const playback=page.getByRole('status',{name:'Enemy turn playback'})
 await expect(playback).toBeVisible();await expect(page.getByRole('button',{name:'End turn · hostiles act',exact:true})).toBeDisabled()
 expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).actions.length,EXPLORATION_SAVE_KEY)).toBe(s.actions.length+1)
 await page.getByRole('button',{name:'1× speed'}).click();await expect(page.getByRole('button',{name:'2× speed'})).toBeVisible()
 await expect(playback).toContainText('→')
 await page.screenshot({path:info.outputPath('laptop-enemy-playback.png')})
 
 await expect(playback).toHaveCount(0,{timeout:20000});await expect(page.locator('.tac-turn b')).toHaveText(String(end.turn).padStart(2,'0'))
 await expect(page.getByRole('status',{name:'Last order'})).toContainText('Enemy turn resolved')
 await page.reload();await page.getByRole('button',{name:'Resume expedition'}).click();await expect(playback).toHaveCount(0);await expect(page.locator('.tac-turn b')).toHaveText(String(end.turn).padStart(2,'0'))
})
test('skip, reload during playback and reduced motion never repeat the order',async({page})=>{
 const s=midMission();await resume(page,s);const button=page.getByRole('button',{name:'End turn · hostiles act',exact:true}),playback=page.getByRole('status',{name:'Enemy turn playback'})
 await button.click();await expect(playback).toBeVisible();await page.keyboard.press('Escape');await expect(playback).toHaveCount(0);await expect(page.locator('.tac-animated-unit.moving')).toHaveCount(0)
 await button.click();await expect(playback).toBeVisible();await page.reload();await page.getByRole('button',{name:'Resume expedition'}).click();await expect(playback).toHaveCount(0)
 expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).actions.length,EXPLORATION_SAVE_KEY)).toBe(s.actions.length+2)
 await page.emulateMedia({reducedMotion:'reduce'});await button.click();await expect(playback).toHaveCount(0)
 expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).actions.length,EXPLORATION_SAVE_KEY)).toBe(s.actions.length+3)
})
