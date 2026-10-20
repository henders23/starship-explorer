import { describe, expect, it } from 'vitest'
import { createCampaign } from '../src/engine/exploration/campaign.js'
import { courseFinder } from '../src/engine/exploration/navigation.js'
import { leadLabel, scienceLeads } from '../src/ui/science-leads.js'

describe('science leads', () => {
  it('stay dark until Drive Diagnostics, then point at the three nearest unclaimed sites the drive needs', () => {
    const s = createCampaign('leads-a')
    expect(scienceLeads(s, courseFinder(s))).toEqual([])
    const diagnosed = { ...s, research: { ...s.research, completed: [...s.research.completed, 'drive-diagnostics' as const] } }
    const leads = scienceLeads(diagnosed, courseFinder(diagnosed))
    expect(leads.length).toBeGreaterThan(0); expect(leads.length).toBeLessThanOrEqual(3)
    for (const { site } of leads) expect(site.discovery).toBe('exotic-energy')
    expect(leadLabel(diagnosed)).toBe('energy signature')
  })
})
