import type { ReactNode } from 'react'

/** Existing original portraits, now shared across all expedition scenes. */
export const CREW = {
  vale: { name: 'Alexander Vale', role: 'Captain', portrait: '/assets/portraits/01_alexander_vale.png' },
  morozova: { name: 'Helen Morozova', role: 'Science officer', portrait: '/assets/portraits/26_helen_morozova.png' },
  cross: { name: 'Gabriel Cross', role: 'Security chief', portrait: '/assets/portraits/14_gabriel_cross.png' },
  mori: { name: 'Lena Mori', role: 'Navigator', portrait: '/assets/portraits/02_lena_mori.png' },
  kerr: { name: 'Jonas Kerr', role: 'Engineer', portrait: '/assets/portraits/03_jonas_kerr.png' },
} as const
export type CrewId = keyof typeof CREW
export function CrewLine({ person, children, compact = false }: {
  person: CrewId; children: ReactNode; compact?: boolean
}) {
  const member = CREW[person]
  return <figure className={`crew-voice${compact ? ' compact' : ''}`}>
    <img src={member.portrait} alt="" loading="lazy" />
    <figcaption><strong>{member.name}</strong><span>{member.role}</span>
      <p>{children}</p>
    </figcaption>
  </figure>
}
