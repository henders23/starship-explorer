import { audioOut, onAudioReady } from './combat-sfx.js'

/**
 * The battle score and the rift's ambience, synthesised like the combat
 * sounds and played through the same mute switch and limiter.
 *
 * - tension: a low drone and a slow heartbeat while the battle is paused or the contact waits.
 * - fight: the drone opens up under a minor arpeggio and a kick, turning to a
 *   second progression every other phrase.
 * - finale: faster, a harmonic-minor progression, a pad a fifth above and a
 *   snare on the backbeat, for the run home.
 * - rift: no music, only a sub drone and slow wind, aboard in rift space.
 */
export type ScoreMode = 'off' | 'tension' | 'fight' | 'finale'
export type Ambience = 'off' | 'rift'

const midi = (n: number) => 440 * 2 ** ((n - 69) / 12)
// Bars of four chords; each chord is a root and an arpeggio, in MIDI notes.
const FIGHT = [[45, [57, 60, 64, 69]], [41, [57, 60, 65, 69]], [43, [55, 59, 62, 67]], [40, [55, 59, 64, 67]]] as const
// Every other phrase the fight turns: Am, C, G, E, ending on the dominant to pull back round.
const FIGHT_TURN = [[45, [57, 60, 64, 72]], [48, [60, 64, 67, 72]], [43, [55, 59, 62, 71]], [40, [56, 59, 64, 68]]] as const
const FINALE = [[38, [62, 65, 69, 74]], [46, [62, 65, 70, 74]], [36, [60, 64, 67, 72]], [45, [61, 64, 69, 73]]] as const
const FINALE_TURN = [[38, [62, 65, 69, 77]], [43, [62, 67, 70, 74]], [45, [61, 64, 69, 76]], [45, [61, 64, 67, 73]]] as const

let mode: ScoreMode = 'off', ambience: Ambience = 'off'
let score: { bus: GainNode; filter: BiquadFilterNode; drones: OscillatorNode[]; pad: GainNode; timer: number; next: number; step: number; stopping?: number } | null = null
let wind: { bus: GainNode; nodes: AudioScheduledSourceNode[]; stopping?: number } | null = null
/** Seconds a fade to silence takes before its nodes are stopped and dropped, so nothing idles in the background. */
const RELEASE_MS = 2500

function startScore() {
  const out = audioOut()
  if (!out || score) return
  const { context: c, master } = out
  const bus = c.createGain(); bus.gain.value = 0.0001; bus.connect(master)
  const filter = c.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 260; filter.Q.value = 4; filter.connect(bus)
  const lfo = c.createOscillator(), depth = c.createGain(); lfo.frequency.value = 0.07; depth.gain.value = 90
  lfo.connect(depth); depth.connect(filter.frequency); lfo.start()
  const drones = [55, 55.35, 82.4].map((f, i) => {
    const o = c.createOscillator(), g = c.createGain(); o.type = i === 2 ? 'triangle' : 'sawtooth'; o.frequency.value = f
    g.gain.value = i === 2 ? 0.05 : 0.07; o.connect(g); g.connect(filter); o.start(); return o
  })
  const pad = c.createGain(); pad.gain.value = 0; pad.connect(bus)
  const padOsc = c.createOscillator(); padOsc.type = 'sawtooth'; padOsc.frequency.value = midi(62)
  const padFilter = c.createBiquadFilter(); padFilter.type = 'lowpass'; padFilter.frequency.value = 900
  padOsc.connect(padFilter); padFilter.connect(pad); padOsc.start()
  drones.push(lfo, padOsc)
  score = { bus, filter, drones, pad, timer: 0, next: c.currentTime + 0.1, step: 0 }
  score.timer = window.setInterval(schedule, 60)
  applyScore()
}

/** Looks ahead and schedules the next notes, so the beat holds even when the page is busy. */
function schedule() {
  const out = audioOut()
  if (!out || !score) return
  const { context: c, noise } = out
  if (mode === 'off') { score.next = c.currentTime + 0.1; return }
  // After a stall (a busy frame, a throttled background tab), skip ahead rather than play every missed note at once.
  score.next = Math.max(score.next, c.currentTime + 0.02)
  if (mode === 'tension') {
    // Paused, the pulse slows to a muffled heartbeat instead of stopping dead.
    while (score.next < c.currentTime + 0.25) {
      const at = score.next, k = c.createOscillator(), kg = c.createGain()
      k.frequency.setValueAtTime(70, at); k.frequency.exponentialRampToValueAtTime(34, at + 0.2)
      kg.gain.setValueAtTime(score.step % 2 ? 0.06 : 0.1, at); kg.gain.exponentialRampToValueAtTime(0.0001, at + 0.28)
      k.connect(kg); kg.connect(score.filter); k.start(at); k.stop(at + 0.32)
      score.next += score.step % 2 ? 0.95 : 0.3; score.step++
    }
    return
  }
  const finale = mode === 'finale', beat = 60 / (finale ? 132 : 108) / 2
  const turn = Math.floor(score.step / 32) % 2 === 1, bars = finale ? turn ? FINALE_TURN : FINALE : turn ? FIGHT_TURN : FIGHT
  const note = (f: number, at: number, dur: number, vol: number, type: OscillatorType = 'triangle') => {
    const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.value = f
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
    o.connect(g); g.connect(score!.bus); o.start(at); o.stop(at + dur + 0.05)
  }
  while (score.next < c.currentTime + 0.25) {
    const at = score.next, step = score.step, [root, arp] = bars[Math.floor(step / 8) % bars.length]!
    note(midi(arp[step % 4]!) * (step % 8 >= 4 ? 2 : 1), at, beat * 0.9, finale ? 0.05 : 0.04)
    if (step % 4 === 0) {
      // The heartbeat: a sine kick, and the bass on the chord root.
      const k = c.createOscillator(), kg = c.createGain(); k.frequency.setValueAtTime(90, at); k.frequency.exponentialRampToValueAtTime(38, at + 0.18)
      kg.gain.setValueAtTime(finale ? 0.22 : 0.16, at); kg.gain.exponentialRampToValueAtTime(0.0001, at + 0.25); k.connect(kg); kg.connect(score.bus); k.start(at); k.stop(at + 0.3)
      note(midi(root), at, beat * 3.6, 0.08, 'sawtooth')
    }
    if (finale && step % 8 === 4) {
      const n = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); n.buffer = noise
      f.type = 'bandpass'; f.frequency.value = 1800; g.gain.setValueAtTime(0.09, at); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.16)
      n.connect(f); f.connect(g); g.connect(score.bus); n.start(at, Math.random()); n.stop(at + 0.2)
    }
    if (finale && step % 8 === 0) score.pad.gain.setTargetAtTime(0.025, at, 0.3)
    score.next += beat; score.step++
  }
}

function applyScore() {
  const out = audioOut()
  if (!out) return
  if (mode === 'off') {
    if (score && score.stopping === undefined) {
      score.bus.gain.setTargetAtTime(0.0001, out.context.currentTime, 0.4)
      const ending = score
      ending.stopping = window.setTimeout(() => {
        window.clearInterval(ending.timer); for (const o of ending.drones) o.stop(); ending.bus.disconnect()
        if (score === ending) score = null
      }, RELEASE_MS)
    }
    return
  }
  if (score?.stopping !== undefined) { window.clearTimeout(score.stopping); score.stopping = undefined }
  if (!score) { startScore(); return }
  const now = out.context.currentTime
  score.bus.gain.setTargetAtTime(mode === 'tension' ? 0.35 : mode === 'fight' ? 0.55 : 0.7, now, 0.6)
  score.filter.frequency.setTargetAtTime(mode === 'tension' ? 220 : mode === 'fight' ? 420 : 650, now, 0.8)
  // Clear any swell already scheduled for the next bar, or it outlasts the pause.
  if (mode !== 'finale') { score.pad.gain.cancelScheduledValues(now); score.pad.gain.setTargetAtTime(0, now, 0.5) }
}

function applyAmbience() {
  const out = audioOut()
  if (!out) return
  const { context: c, master, noise } = out
  if (ambience === 'off') {
    if (wind && wind.stopping === undefined) {
      wind.bus.gain.setTargetAtTime(0.0001, c.currentTime, 0.8)
      const ending = wind
      ending.stopping = window.setTimeout(() => { for (const n of ending.nodes) n.stop(); ending.bus.disconnect(); if (wind === ending) wind = null }, RELEASE_MS + 1500)
    }
    return
  }
  if (wind?.stopping !== undefined) { window.clearTimeout(wind.stopping); wind.stopping = undefined }
  if (!wind) {
    const bus = c.createGain(); bus.gain.value = 0.0001; bus.connect(master)
    const sub = [27.5, 41.2].map((f) => { const o = c.createOscillator(), g = c.createGain(); o.frequency.value = f; g.gain.value = 0.12; o.connect(g); g.connect(bus); o.start(); return o })
    const air = c.createBufferSource(); air.buffer = noise; air.loop = true
    const band = c.createBiquadFilter(); band.type = 'bandpass'; band.Q.value = 3; band.frequency.value = 400
    const sweep = c.createOscillator(), depth = c.createGain(); sweep.frequency.value = 0.05; depth.gain.value = 250
    sweep.connect(depth); depth.connect(band.frequency)
    const airGain = c.createGain(); airGain.gain.value = 0.18
    air.connect(band); band.connect(airGain); airGain.connect(bus); air.start(); sweep.start()
    wind = { bus, nodes: [...sub, air, sweep] }
  }
  wind.bus.gain.setTargetAtTime(0.5, c.currentTime, 1.5)
}

onAudioReady(() => { applyScore(); applyAmbience() })

/** What the score should be playing; it fades between modes and waits for audio to be unlocked. */
export function setScore(next: ScoreMode) { mode = next; applyScore() }
/** The world's ambience aboard: the rift's wind when the Lodestar is inside it. */
export function setAmbience(next: Ambience) { ambience = next; applyAmbience() }
