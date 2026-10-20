import { hasTech } from '../engine/exploration/campaign.js'
import type { Campaign } from '../engine/exploration/campaign.js'
import type { Course } from '../engine/exploration/navigation.js'
import type { SystemId } from '../engine/worldgen/types.js'

/** The discovery the Return Drive needs next: exotic energy first, then spatial sources. */
export const neededDiscovery = (state: Campaign) => !state.findings.some((f) => f.kind === 'exotic-energy') ? 'exotic-energy' as const : 'spatial' as const
export const leadLabel = (state: Campaign) => neededDiscovery(state) === 'exotic-energy' ? 'energy signature' : 'spatial research lead'

/** Drive telemetry's nearest three unclaimed sites with the discovery the drive needs; none before Drive Diagnostics. */
export function scienceLeads(state: Campaign, courses: (target: SystemId) => Course | null) {
  if (!hasTech(state, 'drive-diagnostics')) return []
  const needed = neededDiscovery(state)
  const distance = (course: Course | null) => course ? course.path.length * 10_000 + course.fuel : Infinity
  return state.world.locations.filter((site) => site.discovery &&
    (needed === 'exotic-energy' ? site.discovery === needed : ['spatial-observation', 'alien-propulsion'].includes(site.discovery)) &&
    !state.exploration.claimed.includes(site.id)).map((site) => ({ site, course: courses(site.systemId) }))
    .sort((a, b) => distance(a.course) - distance(b.course) || a.site.id.localeCompare(b.site.id)).slice(0, 3)
}
