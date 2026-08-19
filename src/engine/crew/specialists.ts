import { createRng } from '../rng/prng.js'
import type { Galaxy } from '../worldgen/types.js'
import { recruitPerson } from './generate.js'
import type { Specialist, SpecialistFocus } from './types.js'

/**
 * Specialist placement: three people with somewhere better to be, one per
 * focus, waiting at faction stations. Deterministic per seed, cast from the
 * far end of the ratings queue so they never duplicate a promoted face.
 */
export function placeSpecialists(seed: string, galaxy: Galaxy): Record<string, Specialist> {
  const rng = createRng(`${seed}:specialists`)
  const stations = galaxy.systems
    .filter((system) => system.faction !== null && system.id !== galaxy.start)
    .map((system) => system.id)
    .sort()
  const picks = rng.shuffle(stations)

  const sites: Record<string, Specialist> = {}
  const focuses: SpecialistFocus[] = ['gunnery', 'research', 'comms']
  focuses.forEach((focus, index) => {
    const at = picks[index]
    if (!at) return // a galaxy this faction-poor simply has fewer recruits
    const person = recruitPerson(seed, index)
    sites[at] = { name: person.name, portrait: person.portrait, focus }
  })
  return sites
}
