import { createRng } from '../rng/prng.js'
import {
  FOUNDING_CAPTAIN,
  FOUNDING_SCIENCE,
  FOUNDING_SECURITY,
  RATINGS_POOL,
  SPECIALIST_POOL,
  type CrewPerson,
} from './people.js'
import type { Officer, OfficerRole } from './types.js'

const TITLES: Record<OfficerRole, string> = {
  captain: 'Cpt.',
  security: 'Chief',
  science: 'Lt.',
  medical: 'Dr.',
}

function asOfficer(person: CrewPerson, role: OfficerRole, skill: number, origin: Officer['origin']): Officer {
  return {
    role,
    name: `${TITLES[role]} ${person.name}`,
    portrait: person.portrait,
    skill,
    xp: 0,
    status: 'fit',
    origin,
  }
}

/**
 * The founding roster: the captain and three department officers.
 *
 * Three of the four chairs are cast rather than rolled. Vale, Morozova and
 * Cross take the ship into the aperture in the intro comic, so they are the
 * same three the player meets at the briefing a few hours later. Only the
 * medical chair is seeded, from the specialists Morozova leaves behind —
 * every founder starts at skill 3 either way, so the roll never touched the
 * numbers, only the faces.
 */
export function generateRoster(seed: string): Officer[] {
  const rng = createRng(`${seed}:roster`)
  const medical = rng.pick(SPECIALIST_POOL.filter((p) => p !== FOUNDING_SCIENCE))
  return [
    asOfficer(FOUNDING_CAPTAIN, 'captain', 3, 'founding'),
    asOfficer(FOUNDING_SECURITY, 'security', 3, 'founding'),
    asOfficer(FOUNDING_SCIENCE, 'science', 3, 'founding'),
    asOfficer(medical, 'medical', 3, 'founding'),
  ]
}

/**
 * A generic crew member steps up. They arrive with a face and a name for
 * the first time and less skill than the officer they replace — the ship
 * keeps a science officer, but not that science officer.
 *
 * The ratings pool is shuffled once per seed and walked in promotion
 * order, so replay is exact and no face ever serves twice.
 */
export function promoteGeneric(seed: string, role: OfficerRole, promotionCount: number): Officer {
  const queue = createRng(`${seed}:promotions`).shuffle(RATINGS_POOL)
  return asOfficer(queue[promotionCount % queue.length]!, role, 2, 'promoted')
}

/**
 * The faces waiting at the stations: drawn from the far end of the same
 * shuffled ratings queue the promotions walk from the front, so a recruit
 * is never the twin of someone who stepped up from the ranks.
 */
export function recruitPerson(seed: string, index: number): CrewPerson {
  const queue = createRng(`${seed}:promotions`).shuffle(RATINGS_POOL)
  return queue[queue.length - 1 - (index % queue.length)]!
}
