import { useMemo, useState } from 'react'
import type { Screen } from './App.js'
import { CrewPanel } from './CrewPanel.js'
import { useDispatch, useGame, useNavPlot } from './store.js'

type RoomId =
  | 'bridge'
  | 'comms'
  | 'armory'
  | 'science'
  | 'medical'
  | 'barracks'
  | 'engineering'

interface Room {
  id: RoomId
  name: string
  deck: string
  x: number
  y: number
  art: string
  kicker: string
  description: string
  metric: string
  metricLabel: string
}

const ROOMS: Room[] = [
  {
    id: 'bridge',
    name: 'Bridge',
    deck: '01 · Command',
    x: 78,
    y: 46,
    art: '/assets/rooms/bridge.png',
    kicker: 'Command nexus',
    description: 'Navigation, tactical coordination and the captain’s working plot.',
    metric: '4/4',
    metricLabel: 'stations online',
  },
  {
    id: 'comms',
    name: 'Operations',
    deck: '02 · Signals',
    x: 63,
    y: 46,
    art: '/assets/rooms/communications.png',
    kicker: 'Wideband array',
    description: 'Decrypt local traffic, hail contacts and trace long-range anomalies.',
    metric: '−82 dB',
    metricLabel: 'signal floor',
  },
  {
    id: 'armory',
    name: 'Armory',
    deck: '03 · Tactical',
    x: 64,
    y: 63,
    art: '/assets/rooms/armory.png',
    kicker: 'Weapons and field issue',
    description: 'Secure storage, weapon maintenance and away-team equipment preparation.',
    metric: '31',
    metricLabel: 'mission kits ready',
  },
  {
    id: 'science',
    name: 'Science',
    deck: '04 · Research',
    x: 45,
    y: 46,
    art: '/assets/rooms/science.png',
    kicker: 'Analysis laboratory',
    description: 'Examine recovered artefacts and turn field evidence into usable intelligence.',
    metric: '03',
    metricLabel: 'active samples',
  },
  {
    id: 'medical',
    name: 'Med Bay',
    deck: '05 · Medical',
    x: 47,
    y: 63,
    art: '/assets/rooms/med-bay.png',
    kicker: 'Trauma and recovery',
    description: 'Stabilisation, surgery and long-duration crew health monitoring.',
    metric: '92%',
    metricLabel: 'readiness',
  },
  {
    id: 'barracks',
    name: 'Barracks',
    deck: '06 · Crew',
    x: 32,
    y: 63,
    art: '/assets/rooms/barracks.png',
    kicker: 'Crew quarters',
    description: 'Bunks, lockers and the small private spaces the ship’s company calls home.',
    metric: '24/28',
    metricLabel: 'berths occupied',
  },
  {
    id: 'engineering',
    name: 'Engineering',
    deck: '07 · Reactor',
    x: 22,
    y: 53,
    art: '/assets/rooms/engineering.png',
    kicker: 'Drive and power',
    description: 'Main reactor, jump drive, life support and damage-control coordination.',
    metric: '8.4 GW',
    metricLabel: 'available output',
  },
]

export function ShipHub({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  const [room, setRoom] = useState<Room | null>(null)
  const state = useGame((s) => s.state)
  const { sites, clues } = useNavPlot()

  const wounded = state.roster.filter((officer) => officer.status === 'injured').length
  const unread = state.undecoded.length
  // Live count of the queue entries that actually demand attention right now.
  const pending = 1 + (unread > 0 ? 1 : 0) + (wounded > 0 ? 1 : 0)

  return (
    <div className="ship-hub relative h-full overflow-hidden">
      <div className="hub-backdrop" aria-hidden="true" />

      <section className="hub-context pointer-events-none absolute top-6 left-6 z-10">
        <h2>ISS <em>Ithaca</em></h2>
      </section>

      <div className="ship-stage" role="group" aria-label="Interactive cutaway of the ISS Ithaca">
        <div className="ship-cutaway" />
        <div className="ship-scan" aria-hidden="true" />
        {ROOMS.map((entry) => (
          <button
            key={entry.id}
            className={`room-hotspot hotspot-${entry.id}`}
            style={{ left: `${entry.x}%`, top: `${entry.y}%` }}
            onClick={() => setRoom(entry)}
            aria-label={`Zoom into ${entry.name}`}
          >
            {entry.name}
          </button>
        ))}
      </div>

      <aside className="hub-left-panel panel-glass absolute bottom-5 left-5 z-10 w-[420px]">
        <div className="panel-heading">
          <span>Ship’s company</span>
        </div>
        <CrewPanel />
      </aside>

      <aside className="hub-right-panel panel-glass absolute right-5 bottom-5 z-10 w-[310px]">
        <div className="panel-heading">
          <span>Command queue</span>
          <span>{String(pending).padStart(2, '0')} pending</span>
        </div>
        <HubTask
          tone="amber"
          label="Plot next transit"
          detail={`${sites.size} evidence sites remain · ${state.ship.fuel}/80 fuel`}
          onClick={() => onNavigate('galaxy')}
        />
        <HubTask
          tone={unread > 0 ? 'cyan' : 'muted'}
          label="Process field samples"
          detail={
            unread > 0
              ? `${unread} sealed ${unread === 1 ? 'artefact awaits' : 'artefacts await'} science review`
              : 'No sealed artefacts held'
          }
          onClick={() => onNavigate('lab')}
        />
        <HubTask
          tone={wounded > 0 ? 'red' : 'muted'}
          label="Prepare away team"
          detail={`${state.pools.security} security · ${clues.length} accounts held`}
          onClick={() => onNavigate('loadout')}
        />
      </aside>

      <div className="hub-hint absolute bottom-6 left-1/2 z-10 -translate-x-1/2">
        Select a compartment to inspect
      </div>

      {room && (
        <RoomFocus
          room={room}
          onClose={() => setRoom(null)}
          onNavigate={onNavigate}
        />
      )}
    </div>
  )
}

function HubTask({
  tone,
  label,
  detail,
  onClick,
}: {
  tone: 'amber' | 'cyan' | 'red' | 'muted'
  label: string
  detail: string
  onClick: () => void
}) {
  return (
    <button className="hub-task" onClick={onClick}>
      <span className={`task-marker task-${tone}`} />
      <span>
        <strong>{label}</strong>
        <small>{detail}</small>
      </span>
      <span className="task-arrow">›</span>
    </button>
  )
}

function RoomFocus({
  room,
  onClose,
  onNavigate,
}: {
  room: Room
  onClose: () => void
  onNavigate: (screen: Screen) => void
}) {
  const dispatch = useDispatch()
  const roster = useGame((s) => s.state.roster)
  const day = useGame((s) => s.state.day)
  const officer = useMemo(() => {
    const role = room.id === 'science' ? 'science' : room.id === 'medical' ? 'medical' : null
    return role ? roster.find((entry) => entry.role === role) : null
  }, [room.id, roster])

  const action = () => {
    if (room.id === 'science') onNavigate('lab')
    if (room.id === 'armory') onNavigate('loadout')
    if (room.id === 'bridge') dispatch({ type: 'consult' })
    if (room.id === 'engineering') dispatch({ type: 'refit' })
  }

  const actionLabel =
    room.id === 'science'
      ? 'Enter laboratory'
      : room.id === 'armory'
        ? 'Enter equipment locker'
        : room.id === 'bridge'
          ? 'Consult the bridge'
          : room.id === 'engineering'
            ? 'Order drive refit'
            : null

  return (
    <div className={`room-focus room-focus-${room.id}`}>
      <div
        className="room-focus-art"
        style={{ backgroundImage: `url(${room.art})` }}
        aria-hidden="true"
      />
      <div className="room-vignette" aria-hidden="true" />
      <button className="room-back" onClick={onClose}>
        <span>←</span> Return to ship
      </button>

      <section className="room-focus-copy">
        <div className="eyebrow">{room.deck}</div>
        <h2>{room.name}</h2>
        <p className="room-kicker">{room.kicker}</p>
        <p>{room.description}</p>
        <div className="room-metric">
          <strong>{room.metric}</strong>
          <span>{room.metricLabel}</span>
        </div>
        {officer && (
          <div className="room-officer">
            <span className={`officer-avatar avatar-${officer.role}`}>
              {officer.portrait ? (
                <img src={officer.portrait} alt="" />
              ) : (
                officer.name.slice(0, 1)
              )}
            </span>
            <span>
              <small>Officer on station</small>
              <strong>{officer.name}</strong>
              <em>{officer.status === 'injured' ? `Recovery day ${officer.healedAfter ?? day}` : officer.status}</em>
            </span>
          </div>
        )}
        {actionLabel && (
          <button className="primary-action" onClick={action}>
            {actionLabel} <span>›</span>
          </button>
        )}
      </section>
    </div>
  )
}
