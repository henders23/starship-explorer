/** V2 research catalogue: ship systems and away-team equipment. */
export const BRANCHES = ['Propulsion', 'Weapons', 'Defence', 'Sensors', 'Communications', 'Applied science'] as const
export type ResearchBranch = typeof BRANCHES[number]
export const PROJECT_IDS = [
  'drive-diagnostics', 'exotic-storage', 'spatial-dynamics', 'prototype-drive', 'drive-stabilisation',
  'fuel-optimisation', 'fuel-tanks', 'slipstream', 'fuel-recycling',
  'fire-control', 'ion-projector', 'focus-beam', 'plasma-ballistics',
  'composite-hull', 'layered-shields', 'adaptive-shields', 'personal-shields',
  'spectrometry', 'triangulation', 'threat-analysis', 'deep-survey',
  'trade-language', 'contextual-translation', 'countermeasures', 'relay-network',
  'trauma-protocols', 'field-engineering', 'recon-drones', 'automated-lab',
] as const
export type ProjectId = typeof PROJECT_IDS[number]
export type BuildId = ProjectId | 'return-drive'
export type Slot = 'engine' | 'utility' | 'gadget' | 'hull' | 'drive'
export interface Blueprint { materials: number; credits: number; slot: Slot }
export interface ResearchProject {
  name: string; branch: ResearchBranch; days: number; effect: string; requires: ProjectId[]
  discovery?: 'any' | 'exotic' | 'spatial'
  blueprint?: Blueprint
  future?: string
}
export const PROJECTS: Record<ProjectId, ResearchProject> = {
  'drive-diagnostics': { name: 'Drive Diagnostics', branch: 'Propulsion', days: 4, requires: [],
    effect: 'Identify what the Return Drive needs and chart leads to spatial research.' },
  'exotic-storage': { name: 'Exotic Energy Storage', branch: 'Propulsion', days: 6, requires: ['drive-diagnostics'], discovery: 'exotic',
    effect: 'Contain the energy needed to sustain a long-distance spatial field.' },
  'spatial-dynamics': { name: 'Spatial Field Dynamics', branch: 'Propulsion', days: 8, requires: ['exotic-storage'], discovery: 'spatial',
    effect: 'Combine two independent spatial or propulsion discoveries into a navigable field model.' },
  'prototype-drive': { name: 'Prototype Return Drive', branch: 'Propulsion', days: 10, requires: ['spatial-dynamics'],
    effect: 'Unlock a prototype to construct and test in any surveyed system.', blueprint: { materials: 25, credits: 50, slot: 'drive' } },
  'drive-stabilisation': { name: 'Drive Stabilisation', branch: 'Propulsion', days: 12, requires: ['prototype-drive'],
    effect: 'Use the completed prototype test to unlock final Return Drive construction.' },
  'fuel-optimisation': { name: 'Fuel Optimisation', branch: 'Propulsion', days: 5, requires: [],
    effect: 'Fit improved injectors: travel costs 15% less fuel, rounded up.', blueprint: { materials: 15, credits: 35, slot: 'engine' } },
  'fuel-tanks': { name: 'Extended Fuel Tanks', branch: 'Propulsion', days: 5, requires: [],
    effect: 'Fit tanks that raise fuel capacity from 80 to 100.', blueprint: { materials: 12, credits: 30, slot: 'engine' } },
  slipstream: { name: 'Slipstream Navigation', branch: 'Propulsion', days: 7, requires: ['drive-diagnostics'],
    effect: 'Travel directly to a system two lanes away. The shortcut uses 75% of its two-lane fuel cost and takes one day.' },
  'fuel-recycling': { name: 'Emergency Fuel Recycling', branch: 'Propulsion', days: 6, requires: [],
    effect: 'Fit a recycler to convert 3 materials into 15 fuel in one day, anywhere.', blueprint: { materials: 10, credits: 25, slot: 'utility' } },
  'fire-control': { name: 'Fire Control Algorithms', branch: 'Weapons', days: 4, requires: [],
    effect: 'Ship weapons charge 10% faster in every battle.' },
  'ion-projector': { name: 'Ion Projector', branch: 'Weapons', days: 6, requires: ['fire-control'],
    effect: 'Strip shields and temporarily disable enemy systems.', blueprint: { materials: 18, credits: 50, slot: 'utility' } },
  'focus-beam': { name: 'Focus Beam', branch: 'Weapons', days: 7, requires: ['fire-control'],
    effect: 'Precision damage to exposed hull systems; cannot penetrate shields.', blueprint: { materials: 24, credits: 70, slot: 'utility' } },
  'plasma-ballistics': { name: 'Alien Plasma Ballistics', branch: 'Weapons', days: 8, requires: ['fire-control'],
    effect: 'Unlock plasma loadouts: +2 ground damage, two-round magazine. Costs 2 materials per equipped operative at deployment.' },
  'composite-hull': { name: 'Composite Hull', branch: 'Defence', days: 4, requires: [],
    effect: 'Fit reinforced plating: maximum hull rises to 120 and current hull gains 20.', blueprint: { materials: 18, credits: 45, slot: 'hull' } },
  'layered-shields': { name: 'Layered Shielding', branch: 'Defence', days: 6, requires: ['composite-hull'],
    effect: 'Unlock a second ship shield layer; allocate four shield power in battle.' },
  'adaptive-shields': { name: 'Adaptive Shield Matrix', branch: 'Defence', days: 7, requires: ['layered-shields'],
    effect: 'Improve shield recovery by 20%.' },
  'personal-shields': { name: 'Personal Shield Emitters', branch: 'Defence', days: 6, requires: ['composite-hull'],
    effect: 'Unlock a 4-point personal shield instead of a medkit. No recharge during a mission. Costs 2 materials per equipped operative at deployment.' },
  spectrometry: { name: 'Planetary Spectrometry', branch: 'Sensors', days: 4, requires: [],
    effect: 'Identify scientific signatures at detected sites before investigating.' },
  triangulation: { name: 'Signal Triangulation', branch: 'Sensors', days: 5, requires: ['spectrometry'],
    effect: 'Detect obvious contacts in adjacent systems whenever you scan.' },
  'threat-analysis': { name: 'Tactical Threat Analysis', branch: 'Sensors', days: 6, requires: ['spectrometry'],
    effect: 'Reveal exact rapid-expedition hull damage before investigating a location.' },
  'deep-survey': { name: 'Deep Survey Array', branch: 'Sensors', days: 8, requires: ['spectrometry'], discovery: 'any',
    effect: 'Fit a deep array to reveal buried sites locally and faint survey contacts up to two lanes away.', blueprint: { materials: 20, credits: 65, slot: 'utility' } },
  'trade-language': { name: 'Trade-Language Translation', branch: 'Communications', days: 4, requires: [],
    effect: 'Station refuelling and repairs cost 8 credits instead of 10; alloy sales earn 15 instead of 12.' },
  'contextual-translation': { name: 'Contextual Translation', branch: 'Communications', days: 6, requires: ['trade-language'],
    effect: 'Purchase scientific records from contacted stations as an alternative to recovering discoveries.' },
  countermeasures: { name: 'Electronic Countermeasures', branch: 'Communications', days: 6, requires: ['trade-language'],
    effect: 'Fit a signal spoofer: rapid recovery at ruins and derelicts takes no hull damage; escort evasion rises to 85% and battle evasion gains 10 points.', blueprint: { materials: 15, credits: 40, slot: 'utility' } },
  'relay-network': { name: 'Diplomatic Relay Network', branch: 'Communications', days: 7, requires: ['contextual-translation'],
    effect: 'Buy scientific records from known stations remotely. Physical cargo and repairs still need a local berth.' },
  'trauma-protocols': { name: 'Trauma Protocols', branch: 'Applied science', days: 4, requires: [],
    effect: 'Injured away-team survivors recover in two campaign days instead of four.' },
  'field-engineering': { name: 'Field Engineering', branch: 'Applied science', days: 5, requires: [],
    effect: 'Equip engineering tools: rapid recovery from ruins and derelicts yields 4 additional materials.', blueprint: { materials: 10, credits: 25, slot: 'gadget' } },
  'recon-drones': { name: 'Reconnaissance Drones', branch: 'Applied science', days: 6, requires: ['field-engineering'],
    effect: 'Equip survey drones: careful recovery takes one day with no hull damage.', blueprint: { materials: 15, credits: 40, slot: 'gadget' } },
  'automated-lab': { name: 'Automated Research Laboratory', branch: 'Applied science', days: 7, requires: ['spectrometry'],
    effect: 'Fit a laboratory: gain 1.25 research days per day of activity, reducing remaining research time by 20%.', blueprint: { materials: 25, credits: 80, slot: 'utility' } },
}
export const DRIVE_SEQUENCE: ProjectId[] = ['drive-diagnostics', 'exotic-storage', 'spatial-dynamics', 'prototype-drive', 'drive-stabilisation']
export const SLOT_LIMITS: Record<Slot, number> = { engine: 2, utility: 2, gadget: 1, hull: 1, drive: 2 }
export function blueprintFor(id: BuildId): Blueprint | undefined {
  return id === 'return-drive' ? { materials: 60, credits: 150, slot: 'drive' } : PROJECTS[id]?.blueprint
}
export function buildName(id: BuildId): string { return id === 'return-drive' ? 'Return Drive' : PROJECTS[id].name }
