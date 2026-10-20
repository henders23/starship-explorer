import { useSound } from './sound.js'

/**
 * Ship-combat sound, synthesised with WebAudio. The voices descend from the
 * original FTL-style battle prototype (pulse-laser chirp, Hellion hiss, ion
 * chord, beam sweep, impact thud, shield ping) and add the rest of a fight:
 * hull hits, misses, fires, repairs, alarms, the jump and the kill.
 *
 * Nothing is loaded from the network. Every call is a no-op while the
 * player has muted sound, before the first gesture unlocks audio, or in a
 * browser without WebAudio.
 */
export type CombatSound =
  | 'laser' | 'missile' | 'ion' | 'beam'
  | 'impact' | 'hull' | 'shield' | 'miss' | 'ionised'
  | 'fire' | 'extinguish' | 'repair' | 'ready' | 'click' | 'alarm'
  | 'explosion' | 'jump' | 'victory' | 'defeat' | 'pause' | 'resume' | 'target'

let context: AudioContext | null = null
let master: GainNode | null = null
let wet: ConvolverNode | null = null
let noiseBuffer: AudioBuffer | null = null

function audio(): AudioContext | null {
  if (context) return context
  const Ctor = typeof window === 'undefined' ? undefined
    : window.AudioContext ?? (window as never as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  try {
    context = new Ctor()
    const limiter = context.createDynamicsCompressor()
    limiter.threshold.value = -14; limiter.ratio.value = 6
    master = context.createGain(); master.gain.value = 0.9
    master.connect(limiter); limiter.connect(context.destination)
    // A short synthetic tail: vacuum has no reverb, but a hull does.
    wet = context.createConvolver()
    const len = Math.floor(context.sampleRate * 1.4), ir = context.createBuffer(2, len, context.sampleRate)
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3 }
    wet.buffer = ir
    const wetGain = context.createGain(); wetGain.gain.value = 0.22
    wet.connect(wetGain); wetGain.connect(master)
    noiseBuffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate)
    const n = noiseBuffer.getChannelData(0); for (let i = 0; i < n.length; i++) n[i] = Math.random() * 2 - 1
  } catch { context = null }
  return context
}

/** Browsers start audio suspended; the first click or key in a battle wakes it. */
export function unlockCombatAudio() {
  const c = audio()
  if (c?.state === 'suspended') void c.resume().catch(() => {})
}

interface Options { delay?: number; pan?: number; volume?: number }

export function playCombatSound(type: CombatSound, { delay = 0, pan = 0, volume = 1 }: Options = {}) {
  if (useSound.getState().muted) return
  const c = audio()
  if (!c || c.state !== 'running' || !master || !wet || !noiseBuffer) return
  const t = c.currentTime + Math.max(0, delay)
  const out = c.createGain(); out.gain.value = volume
  const panner = c.createStereoPanner(); panner.pan.value = Math.max(-1, Math.min(1, pan))
  out.connect(panner); panner.connect(master); panner.connect(wet)

  const osc = (shape: OscillatorType, f0: number, f1: number, dur: number, vol: number, at = 0, curve = 1) => {
    const o = c.createOscillator(), g = c.createGain(), s = t + at
    o.type = shape
    o.frequency.setValueAtTime(f0, s)
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), s + dur * curve)
    g.gain.setValueAtTime(0.0001, s)
    g.gain.exponentialRampToValueAtTime(vol, s + Math.min(0.012, dur / 4))
    g.gain.exponentialRampToValueAtTime(0.0001, s + dur)
    o.connect(g); g.connect(out); o.start(s); o.stop(s + dur + 0.03)
  }
  const noise = (dur: number, vol: number, fc: number, f1?: number, at = 0, type: BiquadFilterType = 'bandpass', q = 1) => {
    const s = t + at, src = c.createBufferSource(); src.buffer = noiseBuffer
    const f = c.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(fc, s)
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, s + dur)
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, s)
    g.gain.exponentialRampToValueAtTime(vol, s + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, s + dur)
    src.connect(f); f.connect(g); g.connect(out); src.start(s, Math.random() * 0.15); src.stop(s + dur + 0.03)
  }

  switch (type) {
    // Weapons leaving the gun — the original prototype's voices, fuller.
    case 'laser': osc('square', 880, 180, 0.13, 0.08); osc('sawtooth', 1320, 260, 0.1, 0.03); noise(0.05, 0.05, 4000, undefined, 0, 'highpass'); break
    case 'missile': noise(0.45, 0.12, 600, 150); osc('sine', 90, 45, 0.3, 0.12); noise(0.9, 0.05, 1400, 300, 0.1); break
    case 'ion': osc('sine', 520, 300, 0.22, 0.1); osc('sine', 780, 450, 0.22, 0.05); osc('triangle', 1560, 900, 0.18, 0.03, 0.02); break
    case 'beam': osc('sawtooth', 140, 900, 0.4, 0.07, 0, 0.7); osc('sine', 70, 70, 0.7, 0.05); noise(0.6, 0.03, 2400, 1200); break
    // Arrivals.
    case 'impact': noise(0.18, 0.16, 900, 200); osc('sine', 120, 45, 0.22, 0.16); break
    case 'hull': noise(0.35, 0.22, 1100, 120); osc('sine', 95, 32, 0.5, 0.24); noise(0.6, 0.06, 300, 80, 0.06, 'lowpass'); osc('square', 60, 40, 0.18, 0.04, 0.03); break
    case 'shield': osc('sine', 1400, 1000, 0.16, 0.09); osc('sine', 2100, 1500, 0.12, 0.04); noise(0.2, 0.03, 3000, 5000, 0, 'bandpass', 4); break
    case 'miss': noise(0.32, 0.05, 2200, 380); break
    case 'ionised': for (let i = 0; i < 4; i++) osc('square', 1800 - i * 260, 900, 0.05, 0.025, i * 0.045); osc('sine', 400, 180, 0.3, 0.05); break
    // Ship's business.
    case 'fire': for (let i = 0; i < 7; i++) noise(0.08, 0.05 + Math.random() * 0.05, 1800 + Math.random() * 2400, undefined, i * 0.07 + Math.random() * 0.03, 'bandpass', 2); noise(0.7, 0.04, 500, 900, 0, 'lowpass'); break
    case 'extinguish': noise(0.7, 0.07, 5000, 2500, 0, 'highpass'); break
    case 'repair': osc('triangle', 660, 660, 0.08, 0.05); osc('triangle', 990, 990, 0.12, 0.05, 0.08); break
    case 'ready': osc('sine', 1180, 1180, 0.07, 0.035); osc('sine', 1770, 1770, 0.09, 0.025, 0.06); break
    case 'click': osc('square', 2400, 1600, 0.025, 0.03); break
    case 'target': osc('triangle', 900, 1500, 0.07, 0.04); break
    case 'pause': osc('sine', 700, 380, 0.12, 0.05); break
    case 'resume': osc('sine', 380, 700, 0.12, 0.05); break
    case 'alarm': for (let i = 0; i < 3; i++) { osc('square', 620, 620, 0.22, 0.035, i * 0.5); osc('square', 465, 465, 0.22, 0.035, i * 0.5 + 0.25) } break
    // Endings.
    case 'explosion':
      noise(1.4, 0.3, 700, 60, 0, 'lowpass'); osc('sine', 110, 26, 1.6, 0.3)
      noise(0.5, 0.18, 1600, 200, 0.28); osc('sine', 80, 30, 0.9, 0.18, 0.3)
      noise(1.8, 0.1, 400, 50, 0.6, 'lowpass'); break
    case 'jump': osc('sine', 160, 1900, 1.3, 0.09, 0, 0.9); osc('sawtooth', 80, 950, 1.3, 0.03, 0, 0.9); noise(1.4, 0.08, 300, 6000, 0.1); break
    case 'victory': [523, 659, 784, 1046].forEach((f, i) => osc('triangle', f, f, i === 3 ? 0.9 : 0.22, 0.07, i * 0.14)); break
    case 'defeat': [392, 330, 262, 196].forEach((f, i) => osc('triangle', f, f * 0.98, i === 3 ? 1.1 : 0.3, 0.07, i * 0.22)); osc('sine', 60, 30, 1.6, 0.12); break
  }
}
