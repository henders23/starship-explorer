import { describe, expect, it } from 'vitest'
import { reportArtwork, REPORT_ART } from '../src/ui/report-art.js'

describe('situational report art', () => {
 it('illustrates the mining tug with a specific scene, not a generic galaxy', () => {
  expect(reportArtwork('tethered-tug')).toMatchObject({src:'/assets/reports/mining-tug.webp'})
  expect(reportArtwork('tethered-tug')?.alt).toMatch(/tug/i)
 })
 it('covers every authored story beat and keeps its identity stable', () => {
  for (const id of ['last-post','winter-garden','unfinished-map','rain-vault','night-orchestra','tidal-lights','tethered-tug','borrowed-minute','empty-chair','long-watch'])
   expect(REPORT_ART[id]?.src).toMatch(/^\/assets\/reports\//)
  for (const key of ['last-post','winter-garden','rain-vault','tethered-tug','borrowed-minute','empty-chair','survivor','long-relay']) expect(REPORT_ART[key]?.src).toMatch(/\.webp$/)
  expect(reportArtwork('nonexistent-event')).toBeNull()
 })
})
