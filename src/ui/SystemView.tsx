import { useMemo } from 'react'
import type { StarSystem, StarType } from '../engine/worldgen/types.js'

/**
 * The selected system, rendered: its star and its worlds as a small orrery,
 * drawn deterministically from the system id so the same sky always looks
 * the same. Presentation only — every shape here restates catalogue data
 * the inspector already lists in words.
 */

const STAR_STYLE: Record<StarType, { fill: string; halo: string; r: number }> = {
  yellow: { fill: '#f5d98a', halo: '#f5d98a', r: 13 },
  orange: { fill: '#f0a95c', halo: '#f0a95c', r: 12 },
  'red-dwarf': { fill: '#d96a4a', halo: '#d96a4a', r: 8 },
  'red-giant': { fill: '#e2604a', halo: '#ff7a5c', r: 19 },
  'blue-giant': { fill: '#9cc4ff', halo: '#9cc4ff', r: 17 },
  'white-dwarf': { fill: '#e8f0f8', halo: '#cfe0ee', r: 6 },
  neutron: { fill: '#ffffff', halo: '#b8d8ff', r: 4 },
  binary: { fill: '#f5d98a', halo: '#f0a95c', r: 10 },
}

/** Small deterministic hash so each system's worlds sit differently. */
function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

interface World {
  orbit: number
  r: number
  fill: string
  ring?: boolean
  banded?: boolean
  habitable?: boolean
}

function worldsFor(system: StarSystem, seed: number): World[] {
  const worlds: World[] = []
  const rocks = ['#6d6a63', '#7a7168', '#5d6066', '#82756a']
  let orbit = 0

  const push = (world: Omit<World, 'orbit'>) => {
    worlds.push({ ...world, orbit: orbit++ })
  }

  // A couple of barren rocks pad every system out, seeded per id.
  const rockCount = 1 + (seed % 2)
  for (let i = 0; i < rockCount; i++) {
    push({ r: 2.5 + ((seed >> (i * 3)) % 3), fill: rocks[(seed >> i) % rocks.length]! })
  }
  if (system.features.includes('habitable-world'))
    push({ r: 5, fill: '#4f8f6c', habitable: true })
  if (system.features.includes('ice-ring')) push({ r: 4.5, fill: '#a9c6d4', ring: true })
  if (system.features.includes('gas-giant')) push({ r: 9, fill: '#b78a5a', banded: true })
  return worlds
}

export function SystemView({
  system,
  hasEvidence,
  here,
}: {
  system: StarSystem
  hasEvidence: boolean
  here: boolean
}) {
  const seed = useMemo(() => hash(system.id), [system.id])
  const star = STAR_STYLE[system.star]
  const worlds = useMemo(() => worldsFor(system, seed), [system, seed])
  const belt = system.features.includes('asteroid-belt')
  const shroud = system.features.includes('nebula-shroud')
  const echo = system.features.includes('rift-echo')
  const pulsar = system.features.includes('pulsar')
  const beacon = system.features.includes('derelict-beacon')

  const width = 340
  const height = 128
  const cx = 42
  const cy = height / 2
  const firstOrbit = star.r + 22
  const orbitGap = worlds.length > 3 ? 26 : 32
  const orbitR = (index: number) => firstOrbit + index * orbitGap

  return (
    <div className={`system-view ${shroud ? 'is-shrouded' : ''}`}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Orbital view of ${system.name}`}>
        <defs>
          <radialGradient id={`halo-${system.id}`}>
            <stop offset="0" stopColor={star.halo} stopOpacity=".55" />
            <stop offset="1" stopColor={star.halo} stopOpacity="0" />
          </radialGradient>
        </defs>

        {shroud && <rect x="0" y="0" width={width} height={height} fill="#2b4d63" opacity=".14" />}

        {/* Orbit lines */}
        {worlds.map((world) => (
          <circle
            key={`orbit-${world.orbit}`}
            cx={cx}
            cy={cy}
            r={orbitR(world.orbit)}
            fill="none"
            stroke="rgb(59 110 119 / .3)"
            strokeWidth=".7"
          />
        ))}

        {belt && (
          <circle
            cx={cx}
            cy={cy}
            r={orbitR(worlds.length) - orbitGap / 2}
            fill="none"
            stroke="#7a7168"
            strokeWidth="3"
            strokeDasharray="1 3.2"
            opacity=".55"
          />
        )}

        {echo && (
          <circle
            className="rift-echo-ring"
            cx={cx}
            cy={cy}
            r={orbitR(worlds.length) + 6}
            fill="none"
            stroke="#7fd4c1"
            strokeWidth=".8"
            strokeDasharray="6 5"
            opacity=".6"
          />
        )}

        {/* The star (or the pair) */}
        <circle cx={cx} cy={cy} r={star.r * 2.6} fill={`url(#halo-${system.id})`} />
        {system.star === 'binary' ? (
          <>
            <circle cx={cx - 6} cy={cy - 4} r={8} fill={star.fill} />
            <circle cx={cx + 7} cy={cy + 5} r={5.5} fill="#f0a95c" />
          </>
        ) : (
          <circle cx={cx} cy={cy} r={star.r} fill={star.fill} />
        )}
        {pulsar && (
          <g className="pulsar-beams" opacity=".7">
            <line x1={cx - star.r - 16} y1={cy} x2={cx + star.r + 16} y2={cy} stroke="#cfe0ee" strokeWidth=".8" />
          </g>
        )}

        {/* Worlds, each at a seeded bearing on its orbit */}
        {worlds.map((world, index) => {
          const angle = (((seed >> (index * 5)) % 360) * Math.PI) / 180
          // Keep worlds on the right-facing arc so they stay inside the frame.
          const bearing = -0.9 + (Math.abs(Math.sin(angle)) * 1.8 - 0.9) * 0.5
          const x = cx + Math.cos(bearing) * orbitR(world.orbit)
          const y = cy + Math.sin(bearing) * orbitR(world.orbit)
          return (
            <g key={`world-${world.orbit}`}>
              {world.ring && (
                <ellipse cx={x} cy={y} rx={world.r + 5} ry={world.r / 1.6} fill="none" stroke="#a9c6d4" strokeWidth=".8" opacity=".7" transform={`rotate(-18 ${x} ${y})`} />
              )}
              <circle cx={x} cy={y} r={world.r} fill={world.fill} />
              {world.banded && (
                <>
                  <line x1={x - world.r + 1} y1={y - 2.5} x2={x + world.r - 1} y2={y - 2.5} stroke="#8a6a48" strokeWidth="1.4" opacity=".8" />
                  <line x1={x - world.r + 0.5} y1={y + 2} x2={x + world.r - 0.5} y2={y + 2} stroke="#d0a878" strokeWidth="1.1" opacity=".7" />
                </>
              )}
              {world.habitable && (
                <circle cx={x} cy={y} r={world.r + 1.8} fill="none" stroke="#7fd4c1" strokeWidth=".5" opacity=".8" />
              )}
              {hasEvidence && world.orbit === worlds.length - 1 && (
                <circle className="site-ring" cx={x} cy={y} r={world.r + 5} fill="none" stroke="var(--color-amber)" strokeWidth=".9" />
              )}
            </g>
          )
        })}

        {beacon && (
          <circle className="beacon-blink" cx={width - 24} cy={18} r={2} fill="var(--color-alarm)" />
        )}

        {here && (
          <path
            d={`M ${width - 20} ${height - 16} l 5 6 l -5 6 l -5 -6 Z`}
            fill="none"
            stroke="var(--color-amber)"
            strokeWidth="1.1"
            transform={`translate(0,-6)`}
          />
        )}
      </svg>
      {hasEvidence && (
        <div className="system-view-caption">
          {here ? 'Something waits here — respond to the contact' : 'Something waits in this system'}
        </div>
      )}
    </div>
  )
}
