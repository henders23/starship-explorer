export type SystemId = string
export type FactionId = string

export type RegionId = 'shallows' | 'trade-reach' | 'cinder-belt' | 'xenoline' | 'rift-margin'

export type StarType =
  | 'yellow'
  | 'orange'
  | 'red-dwarf'
  | 'red-giant'
  | 'blue-giant'
  | 'white-dwarf'
  | 'neutron'
  | 'binary'

export type SystemFeature =
  | 'gas-giant'
  | 'asteroid-belt'
  | 'ice-ring'
  | 'habitable-world'
  | 'ruins'
  | 'derelict-beacon'
  | 'nebula-shroud'
  | 'pulsar'
  | 'rift-echo'

export interface StarSystem {
  id: SystemId
  name: string
  /** Cartesian position in light years; the galactic core sits at the origin. */
  x: number
  y: number
  /** Polar form, cached: `r` is distance from the core, `theta` the bearing. */
  r: number
  theta: number
  star: StarType
  features: SystemFeature[]
  region: RegionId
  /** The faction claiming this system, if any. */
  faction: FactionId | null
  /** Notable systems make better landmarks in clue prose. */
  landmark: boolean
}

export type FactionArchetype =
  | 'mercantile-combine'
  | 'militant-patrol'
  | 'xenophobic-polity'
  | 'scavenger-clan'
  | 'monastic-order'

export interface Faction {
  id: FactionId
  name: string
  archetype: FactionArchetype
  homeworld: SystemId
}

export interface Galaxy {
  seed: string
  systems: StarSystem[]
  /** Undirected jump lanes, each pair listed once. */
  lanes: Array<[SystemId, SystemId]>
  adjacency: Record<SystemId, SystemId[]>
  factions: Faction[]
  /** Where the ship comes out of the anomaly. */
  start: SystemId
}

export const REGION_NAMES: Record<RegionId, string> = {
  shallows: 'The Shallows',
  'trade-reach': 'The Trade Reach',
  'cinder-belt': 'The Cinder Belt',
  xenoline: 'The Xenoline',
  'rift-margin': 'The Rift Margin',
}

export const STAR_NAMES: Record<StarType, string> = {
  yellow: 'a yellow main-sequence star',
  orange: 'an orange dwarf',
  'red-dwarf': 'a red dwarf',
  'red-giant': 'a red giant',
  'blue-giant': 'a blue giant',
  'white-dwarf': 'a white dwarf',
  neutron: 'a neutron star',
  binary: 'a binary pair',
}

export const FEATURE_NAMES: Record<SystemFeature, string> = {
  'gas-giant': 'a gas giant',
  'asteroid-belt': 'an asteroid belt',
  'ice-ring': 'a ringed ice world',
  'habitable-world': 'a habitable world',
  ruins: 'ruins of some kind',
  'derelict-beacon': 'a derelict beacon',
  'nebula-shroud': 'a nebular shroud',
  pulsar: 'a pulsar',
  'rift-echo': 'a rift echo',
}
