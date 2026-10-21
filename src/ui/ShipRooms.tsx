import { useMemo } from 'react'
import type { Campaign } from '../engine/exploration/campaign.js'
import { CREW, CrewLine } from './crew-presence.js'
import type { CrewId } from './crew-presence.js'

export const ROOM_IDS = ['bridge', 'navigation', 'science', 'engineering', 'security'] as const
export type RoomId = typeof ROOM_IDS[number]
const ROOMS: Record<RoomId, { title: string; image: string; crew: CrewId; action: string }> = {
  bridge: { title: 'The bridge', image: '/assets/rooms/bridge.png', crew: 'vale', action: 'Open galaxy chart' },
  navigation: { title: 'Navigation', image: '/assets/rooms/communications.png', crew: 'mori', action: 'Open galaxy chart' },
  science: { title: 'Science deck', image: '/assets/rooms/science.png', crew: 'morozova', action: 'Open research lab' },
  engineering: { title: 'Engineering', image: '/assets/rooms/engineering.png', crew: 'kerr', action: 'Open research lab' },
  security: { title: 'Shuttle bay', image: '/assets/rooms/barracks.png', crew: 'cross', action: 'Review away team' },
}
export const bridgeMessage = (state: Campaign) => {
  if (state.built.includes('return-drive') && state.outcome === 'exploring') return 'The Return Drive is built. Whatever waits at the rift\'s edge, we can go home when you give the word.'
  if (!state.research.active && !state.research.completed.includes('drive-diagnostics'))
    return 'We need a way home. Morozova has a first research plan; start it, then examine the local signals.'
  if (!state.scans[state.at]) return 'We have a sky full of unanswered questions. Survey this system and see what it holds.'
  if (!state.findings.length) return 'The Silent Courier may hold our first lead. Investigate it before we leave this system.'
  return 'Every discovery brings us closer to home. Choose where our crew goes next.'
}
export function ShipRooms({ state, room, onRoom, onNavigate, onTeam }: {
  state: Campaign
  room: RoomId
  onRoom: (id: RoomId) => void
  onNavigate: (tab: 'system' | 'galaxy' | 'lab' | 'archive') => void
  onTeam: () => void
}) {
  const selected = ROOMS[room]
  const line = useMemo(() => ({
    bridge: bridgeMessage(state),
    navigation: state.visited.length > 1 ? 'We know the lanes now. The question is which destination is worth our time.' : 'These stars are unfamiliar, but their distances are honest. I can get us to the next lead.',
    science: state.research.active
      ? 'The lab is working while we travel. The readings still need places, not just theories.'
      : 'Give me a question worth answering and a little time. We can work out the rest.',
    engineering: state.hull < 55
      ? 'The hull needs attention before we take another risk. We can rebuild what this voyage has cost us.'
      : 'The Lodestar is holding together. The next improvement should make a real difference out there.',
    security: state.completedOperations.length
      ? 'We know what a boarding operation costs now. I want every name on the departure list back aboard.'
      : 'Four seats in the shuttle. We decide who goes, what they carry, and how we bring them back.',
  }), [state, room])
  return <section className="ship-rooms" aria-label="On board ISS Lodestar">
    <img className="ship-room-art" src={selected.image} alt={selected.title + ' aboard the ISS Lodestar'} />
    <div className="ship-room-veil" aria-hidden="true" />
    <div className="ship-room-content">
      <span className="exp-eyebrow">ISS LODESTAR / PEOPLE & PLACES</span>
      <h2>{selected.title}</h2>
      <nav className="ship-room-people" aria-label="Visit ship rooms">
        {ROOM_IDS.map(id => <button key={id} aria-pressed={room === id} onClick={() => onRoom(id)}>
          <img src={CREW[ROOMS[id].crew].portrait} alt="" />
          <span>{CREW[ROOMS[id].crew].name.split(' ').at(-1)}<small>{ROOMS[id].title}</small></span>
        </button>)}
      </nav>
      <CrewLine person={selected.crew}>{line[room]}</CrewLine>
      <div className="ship-room-actions">
        <button className="exp-button primary" onClick={() => room === 'security' ? onTeam() : onNavigate(room === 'bridge' || room === 'navigation' ? 'galaxy' : 'lab')}>{selected.action}</button>
        <button className="exp-button" onClick={() => onNavigate('system')}>Return to system</button>
      </div>
    </div>
  </section>
}
