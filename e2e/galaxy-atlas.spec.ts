import { expect, test } from '@playwright/test'

for(const width of [1440,390])test(`new galaxy atlas draws real generated world and can zoom at ${width}px`,async({page},info)=>{
  await page.setViewportSize({width,height:900})
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
  await page.goto('/')
  await page.getByRole('button',{name:'Begin expedition'}).click()
  await page.getByRole('button', { name: 'Skip briefing' }).click()
  await page.getByRole('button',{name:/Galaxy chart/}).click()
  const chart=page.getByRole('region',{name:'Interactive stellar chart'})
  await expect(chart).toBeVisible()
  await expect(chart.locator('image[href="/assets/galaxy/expedition-nebula.webp"]')).toHaveCount(1)
  await expect(chart.locator('image[href="/assets/ships/expedition-ithaca.webp"]')).toHaveCount(1)
  const assets=['expedition-ithaca','expedition-ironclad','expedition-manta','expedition-helios','expedition-cathedral','expedition-ghost'].map(n=>'/assets/ships/'+n+'.webp')
  assets.push('/assets/galaxy/expedition-nebula.webp')
  const allLoaded=await page.evaluate(async assets=>Promise.all(assets.map(src=>new Promise<boolean>(resolve=>{
    const img=new Image();img.onload=()=>resolve(img.naturalWidth>=300);img.onerror=()=>resolve(false);img.src=src
  }))),assets)
  expect(allLoaded).toEqual(assets.map(()=>true))
  const camera=chart.getByTestId('galaxy-camera')
  const oldTransform=await camera.getAttribute('transform')
  await chart.getByRole('button',{name:'Zoom in'}).click()
  expect(await camera.getAttribute('transform')).not.toEqual(oldTransform)
  await chart.getByRole('button',{name:'Recenter chart'}).click()
  expect(await camera.getAttribute('transform')).toEqual(oldTransform)
  const firstOther=chart.locator('.exp-atlas-star:not(.is-current)').first()
  // Neighbouring stars' hit areas can overlap at 390px; select from the keyboard instead.
  await firstOther.focus(); await page.keyboard.press('Enter')
  await expect(chart.getByTestId('galaxy-route')).toBeVisible()
  await expect(chart.getByText(/^\d+ JUMPS? · \d+ FUEL$/)).toBeVisible()
  const box=await chart.locator('svg.exp-atlas-svg').boundingBox()
  if(!box)throw new Error('Atlas has no visible viewport')
  const beforePan=await camera.getAttribute('transform')
  // Start the drag on empty map: stars and the chart's overlaid controls swallow a press.
  const start=await page.evaluate(({x,y,width,height})=>{
    for(let gy=0.2;gy<0.9;gy+=0.1)for(let gx=0.1;gx<0.7;gx+=0.1){
      const px=x+width*gx,py=y+height*gy,el=document.elementFromPoint(px,py)
      if(el&&el.closest('svg.exp-atlas-svg')&&!el.closest('.exp-atlas-star'))return{x:px,y:py}
    }
    return null
  },box)
  if(!start)throw new Error('No empty map to drag')
  await page.mouse.move(start.x,start.y)
  await page.mouse.down()
  await page.mouse.move(start.x+50,start.y+15,{steps:3})
  await page.mouse.up()
  // The pan lands on the next frame; wait for it rather than racing the render.
  await expect.poll(()=>camera.getAttribute('transform')).not.toEqual(beforePan)
  await chart.getByRole('button',{name:'Recenter chart'}).click()
  await chart.scrollIntoViewIfNeeded()
  await page.screenshot({path:info.outputPath(`galaxy-atlas-${width}.png`),fullPage:true,animations:'disabled'})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  expect(errors).toEqual([])
})
