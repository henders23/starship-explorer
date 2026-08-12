import { createRng } from '../rng/prng.js'
import {
  COMMAND_POOL,
  RATINGS_POOL,
  SECURITY_POOL,
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
    status: 'fit',
    origin,
  }
}

/**
 * The founding roster: the captain and three department officers, cast per
 * seed from the portrait pools — command faces on the bridge, the older
 * heads in science and medical, the young in security. Science and medical
 * share a pool but never a person.
 */
export function generateRoster(seed: string): Officer[] {
  const rng = createRng(`${seed}:roster`)
  const specialists = rng.sample(SPECIALIST_POOL, 2)
  return [
    asOfficer(rng.pick(COMMAND_POOL), 'captain', 3, 'founding'),
    asOfficer(rng.pick(SECURITY_POOL), 'security', 3, 'founding'),
    asOfficer(specialists[0]!, 'science', 3, 'founding'),
    asOfficer(specialists[1]!, 'medical', 3, 'founding'),
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
