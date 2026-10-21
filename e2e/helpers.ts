import type { Page } from '@playwright/test'

const literal = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Opens a research project from the lab's sidebar and returns its detail card. */
export async function openProject(page: Page, name: string) {
  await page.getByRole('complementary', { name: 'Research projects' }).getByRole('button', { name: new RegExp(`^${literal(name)}`) }).click()
  return page.getByRole('article', { name, exact: true })
}

/** Finds a system with the chart's search box and selects it. */
export async function chartTo(page: Page, name: string) {
  await page.getByRole('button', { name: /Galaxy chart/ }).click()
  await page.getByRole('textbox', { name: 'Find system' }).fill(name)
  await page.locator('.exp-chart-list button').filter({ has: page.locator('strong', { hasText: new RegExp(`^${literal(name)}$`) }) }).click()
}

/** Flies one jump to a neighbouring system through the chart, walking away from any arrival signal. */
export async function travelTo(page: Page, name: string) {
  await chartTo(page, name)
  await page.getByRole('button', { name: /^Travel ·/ }).click()
  await payOff(page)
  await walkAway(page)
}
/** Settles an interception on arrival, if one is waiting, by fighting it out a second at a time on default orders. */
export async function payOff(page: Page) {
  const engage = page.getByRole('button', { name: 'Engage · enter battle paused', exact: true })
  if (!(await engage.waitFor({ timeout: 700 }).then(() => true, () => false))) return
  await engage.click()
  const skip = page.getByRole('button', { name: 'Skip briefing' })
  if (await skip.isVisible()) await skip.click()
  const report = page.getByRole('button', { name: 'Acknowledge interception report', exact: true })
  for (let i = 0; i < 400 && !(await report.isVisible()); i++) {
    const step = page.getByRole('button', { name: 'Advance 1 second', exact: true })
    if (await step.isVisible()) await step.click(); else await page.waitForTimeout(200)
  }
  await report.click()
}
/** Answers an arrival signal, if one is up, with its no-effect choice. */
export async function walkAway(page: Page) {
  const leave = page.getByTestId('signal-walk-away')
  if (!(await leave.waitFor({ timeout: 700 }).then(() => true, () => false))) return
  await leave.click()
  await page.getByRole('dialog').getByRole('button', { name: 'Continue', exact: true }).click()
}

/** Opens the science officer's briefing at the current place, if it is not already open. */
export async function briefing(page: Page) {
  const brief = page.getByRole('complementary', { name: 'Science officer briefing' })
  if (!(await brief.isVisible())) await page.getByRole('button', { name: /Helen Morozova/ }).click()
  return brief
}

/** The tactical ACTION menu opens on hover; returns one of its orders. */
export async function tacticalAction(page: Page, name: RegExp) {
  await page.getByRole('button', { name: /^ACTION/ }).hover()
  return page.getByRole('group', { name: /^Actions for/ }).getByRole('button', { name })
}

/** The mission objective sits behind the mission tag in the squad panel. */
export async function missionObjective(page: Page) {
  const panel = page.locator('.tac-objective')
  if (!(await panel.isVisible())) await page.locator('.tac-mission-tag').click()
  return panel
}
