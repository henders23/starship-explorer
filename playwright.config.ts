import { existsSync } from 'node:fs'
import { defineConfig } from '@playwright/test'

// Some sandboxes preinstall a Chromium that predates this Playwright's
// pinned build; use it when present rather than downloading another.
const sandboxChromium = '/opt/pw-browsers/chromium'
const executablePath =
  process.env.CI || !existsSync(sandboxChromium) ? undefined : sandboxChromium

/**
 * The R8 smoke flow: one browser walk through title → briefing → scene →
 * collect against the dev server. Deeper end-to-end coverage belongs to the
 * golden-replay harness, which exercises the engine without a browser; this
 * exists to catch "the app doesn't boot / the flow doesn't wire up".
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: 'http://localhost:4173',
    launchOptions: { executablePath },
    // The seeded galaxy renders hundreds of SVG nodes; a roomy viewport
    // keeps the chart usable for coordinate-free clicks.
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: 'npx vite --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
