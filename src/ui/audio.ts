import type { GameEvent } from '../engine/state/types.js'

/**
 * The game's cue layer (R10): short synthesized stingers for the moments
 * that deserve one — a scene opening, the rift surging, the contact alarm,
 * the jump. Everything is WebAudio, in the same voice as the battle sim's
 * effects; no asset files, nothing to load, and the engine never knows
 * sound exists.
 */

let context: AudioContext | null = null

function ac(): AudioContext | null {
  try {
    context ??= new AudioContext()
    // Browsers gate audio behind a user gesture; every cue in this game
    // follows a click, so a resume attempt here is enough.
    if (context.state === 'suspended') void context.resume()
    return context.state === 'running' ? context : null
  } catch {
    return null
  }
}

function tone(
  c: AudioContext,
  shape: OscillatorType,
  f0: number,
  f1: number,
  start: number,
  dur: number,
  vol: number,
): void {
  const t = c.currentTime + start
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = shape
  osc.frequency.setValueAtTime(f0, t)
  if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur)
  gain.gain.setValueAtTime(vol, t)
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur)
  osc.connect(gain)
  gain.connect(c.destination)
  osc.start(t)
  osc.stop(t + dur + 0.02)
}

function noise(c: AudioContext, start: number, dur: number, vol: number, f0: number, f1: number): void {
  const t = c.currentTime + start
  const len = Math.ceil(c.sampleRate * dur)
  const buffer = c.createBuffer(1, len, c.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  const src = c.createBufferSource()
  src.buffer = buffer
  const filter = c.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime(f0, t)
  filter.frequency.exponentialRampToValueAtTime(f1, t + dur)
  const gain = c.createGain()
  gain.gain.setValueAtTime(vol, t)
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur)
  src.connect(filter)
  filter.connect(gain)
  gain.connect(c.destination)
  src.start(t)
  src.stop(t + dur + 0.02)
}

const CUES: Partial<Record<GameEvent['type'], (c: AudioContext) => void>> = {
  // A scene opens: two soft notes, someone on the other end of the channel.
  sceneOpened: (c) => {
    tone(c, 'sine', 392, 392, 0, 0.12, 0.05)
    tone(c, 'sine', 587, 587, 0.11, 0.2, 0.05)
  },
  // Evidence aboard: a small ascending chime, work rewarded.
  evidenceFound: (c) => {
    tone(c, 'triangle', 523, 523, 0, 0.1, 0.05)
    tone(c, 'triangle', 659, 659, 0.09, 0.1, 0.05)
    tone(c, 'triangle', 784, 784, 0.18, 0.22, 0.05)
  },
  // The Rift surges: the light goes wrong, and so does the chord.
  surgeStruck: (c) => {
    tone(c, 'sawtooth', 220, 82, 0, 0.7, 0.06)
    tone(c, 'sawtooth', 233, 87, 0.02, 0.7, 0.05)
    noise(c, 0, 0.6, 0.05, 1400, 200)
  },
  // A contact on the boards: the alarm, twice, unhurried and serious.
  contactMade: (c) => {
    tone(c, 'square', 660, 660, 0, 0.09, 0.045)
    tone(c, 'square', 660, 660, 0.22, 0.09, 0.045)
  },
  // The team holds for your call: one low question mark.
  crisisStruck: (c) => {
    tone(c, 'sine', 330, 349, 0, 0.35, 0.06)
  },
  // The doorway found: a rising figure that resolves.
  jumpSucceeded: (c) => {
    tone(c, 'sine', 392, 392, 0, 0.16, 0.06)
    tone(c, 'sine', 494, 494, 0.14, 0.16, 0.06)
    tone(c, 'sine', 587, 587, 0.28, 0.4, 0.06)
  },
  // The anomaly was not there: the same figure, falling apart.
  jumpFailed: (c) => {
    tone(c, 'sawtooth', 392, 110, 0, 0.8, 0.06)
    noise(c, 0.1, 0.7, 0.05, 900, 120)
  },
  // The ship is hit in the campaign layer (surge injuries land elsewhere).
  shipDamaged: (c) => {
    noise(c, 0, 0.2, 0.07, 800, 180)
  },
}

/** Play the cues a transition earned. Deduplicated per event type. */
export function playCues(events: readonly GameEvent[]): void {
  const c = ac()
  if (!c) return
  const seen = new Set<string>()
  for (const event of events) {
    if (seen.has(event.type)) continue
    seen.add(event.type)
    CUES[event.type]?.(c)
  }
}
