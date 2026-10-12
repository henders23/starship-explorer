import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
const server=await createServer({server:{host:'127.0.0.1',port:4173,strictPort:true}});await server.listen();
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage();page.on('pageerror',e=>console.error(e));await page.goto('http://127.0.0.1:4173/tools/art/rig-scene.html');await page.waitForFunction(()=>window.ready);
await mkdir('public/assets/tactical',{recursive:true});
for(const role of ['assault','recon','engineer','medic','heavy','custodian','custodian-heavy']){const url=await page.evaluate(role=>window.renderRig(role),role);await writeFile(`public/assets/tactical/${role}.png`,Buffer.from(url.split(',')[1],'base64'));console.log(role);}
for(const kind of ['floor','floor-grate','floor-medical','floor-warning','wall','medical','server','cover','cargo','console','archive','coolant','archive-console']){const url=await page.evaluate(kind=>window.renderDeck(kind),kind);await writeFile(`public/assets/tactical/deck-${kind}.png`,Buffer.from(url.split(',')[1],'base64'));console.log(kind);}
await browser.close();await server.close();
execFileSync('python',['-c',"from PIL import Image; from pathlib import Path; [(Image.open(p).save(p.with_suffix('.webp'),quality=88,method=2),p.unlink()) for p in Path('public/assets/tactical').glob('*.png')]"]);

