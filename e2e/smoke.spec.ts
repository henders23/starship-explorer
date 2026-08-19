import { expect, test } from '@playwright/test'

/**
 * The R8 smoke flow: title → briefing → scene → collect, on the known seed
 * `golden-1`. The same seed's full run is pinned by the golden-replay suite;
 * here the browser only proves the UI wires those actions up: the seed entry
 * starts the right galaxy, the briefing plays, travel fires a scene, and a
 * scene option actually collects.
 *
 * From the golden-1 fixture: travelling to sys-014 on day 0 casts a scene
 * with a priced walk-in collect option ("pay").
 */
test('title → briefing → scene → collect', async ({ page }) => {
  await page.goto('/')

  // Title: name the sky, take command.
  await expect(page.getByRole('heading', { name: /starship/i })).toBeVisible()
  await page.getByRole('textbox').fill('golden-1')
  await page.getByRole('button', { name: /take command|begin a new voyage/i }).click()

  // Intro comic: the aperture test that stranded the ship. Play a couple of
  // beats to prove the panels advance, then skip to the briefing.
  await expect(page.locator('.comic-screen')).toBeVisible()
  await page.getByRole('button', { name: /^Continue/ }).click()
  await page.getByRole('button', { name: /^Continue/ }).click()
  await page.getByRole('button', { name: 'Skip intro' }).click()

  // Briefing: the crew talks; play two beats, then take the station.
  await expect(page.getByRole('heading', { name: 'All hands to the bridge' })).toBeVisible()
  await page.getByRole('button', { name: /^Continue/ }).click()
  await page.getByRole('button', { name: /^Continue/ }).click()
  await page.getByRole('button', { name: 'Skip briefing' }).click()

  // Aboard: the command bar is up, day zero, full tank.
  await expect(page.getByRole('heading', { name: 'Starship Ithaca' })).toBeVisible()
  await expect(page.getByText('80/80', { exact: true })).toBeVisible()

  // The chart: the briefing slide plays on the first visit, then the known
  // first port of call is selected and flown to.
  await page.getByRole('button', { name: /Galaxy/ }).click()
  await expect(page.getByRole('heading', { name: 'Reading the chart' })).toBeVisible()
  await page.getByRole('button', { name: 'Take the chart' }).click()
  await expect(page.getByRole('heading', { name: 'Galactic Chart' })).toBeVisible()
  // The star's hit area is an SVG dot; dispatch the click straight to it.
  await page.locator('[data-system="sys-014"]').dispatchEvent('click')
  await page.getByRole('button', { name: /^Travel —/ }).click()

  // Arrival casts the scene. Play the beats out, then take the walk-in offer.
  const overlay = page.locator('.scene-overlay')
  await expect(overlay).toBeVisible()
  while (await overlay.getByRole('button', { name: /^Continue/ }).isVisible()) {
    await overlay.getByRole('button', { name: /^Continue/ }).click()
  }
  await overlay.locator('.scene-option:enabled').first().click()

  // Collected: the scene closes and the captain's log records the take —
  // the evidence line, or the component line that follows when the site
  // also held a rift part.
  await expect(overlay).toBeHidden()
  await expect(page.locator('footer')).toContainText(/Filed to the plot|crated and aboard/)
})
