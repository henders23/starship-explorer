import { createRng } from '../rng/prng.js'
import type { SystemId } from '../worldgen/types.js'

/**
 * Arrival signals: the short, FTL-style events that make a jump into a new
 * system more than a fuel cost. Each offers two or three choices with their
 * terms shown up front; a risky choice says so, and its luck is seeded by the
 * voyage, the system and the choice, so a reload rolls the same way.
 */
export type SignalSpeaker = 'cross' | 'kerr' | 'mori' | 'morozova'
export interface SignalOutcome {
  text: string
  materials?: number; credits?: number; fuel?: number; missiles?: number; hull?: number
  /** Brings a survivor aboard as an operative (credits instead when the roster is full). */
  recruit?: boolean
  /** Shares charts: survey-scans every system one lane away. */
  charts?: boolean
  /** The signal was bait: a hostile drops out of hiding. */
  ambush?: boolean
}
export interface SignalChoice {
  id: string; label: string
  /** Paid up front, whatever happens. */
  cost?: { credits?: number; fuel?: number; materials?: number }
  days?: number
  /** Percent chance of `good`; absent means certain. */
  odds?: number
  good: SignalOutcome; bad?: SignalOutcome
}
export interface ArrivalSignal { id: string; title: string; speaker: SignalSpeaker; line: string; text: string; choices: SignalChoice[] }
export interface PendingSignal { id: string; systemId: SystemId }

/** Percent of first arrivals in a new system that pick up a signal. */
export const SIGNAL_CHANCE = 45

export const SIGNALS: ArrivalSignal[] = [
  { id: 'distress', title: 'A distress call on repeat', speaker: 'cross', line: 'Could be real. Could be bait. Raiders love a loop like that.',
    text: 'A freighter hangs dark off the jump point, its distress beacon cycling the same twelve words. No reply to our hail.',
    choices: [
      { id: 'answer', label: 'Dock and help', odds: 65,
        good: { text: 'Six frightened crew and a dead reactor. Kerr gets it restarting; they insist we take spares and what credit they have.', materials: 6, credits: 18 },
        bad: { text: 'The freighter is a hollow shell. Weapons lock from the shadow behind it: the beacon was bait.', ambush: true } },
      { id: 'ignore', label: 'Log it and keep our distance', good: { text: 'We relay the position to the nearest station and move on. Cross watches the freighter until it is out of range.' } },
    ] },
  { id: 'hulk', title: 'A hulk with its holds intact', speaker: 'kerr', line: 'Old hull, cold reactor, full cargo bay. I can strip it, but those bulkheads are tired.',
    text: 'A mining tender, decades dead, tumbles slowly through the system. Its cargo seals still read green.',
    choices: [
      { id: 'strip', label: 'Strip it for parts', odds: 75,
        good: { text: 'Kerr\'s team cuts out the whole ore processor and a crate of fittings.', materials: 10 },
        bad: { text: 'A bulkhead fails as we pull away; the decompression slams the hulk into our flank. We still get some of it aboard.', materials: 4, hull: -8 } },
      { id: 'scan', label: 'Survey it from range', good: { text: 'Remote drones pull loose plating without risking the ship.', materials: 3 } },
      { id: 'leave', label: 'Leave it drifting', good: { text: 'Kerr watches it tumble away on the rear camera, and says nothing.' } },
    ] },
  { id: 'trader', title: 'A trader with a full tank', speaker: 'mori', line: 'They are offering a deal before we have even said hello. Fuel or ordnance, captain?',
    text: 'A stubby independent trader matches our velocity and opens a market channel, listing fuel and a crate of Hellion missiles.',
    choices: [
      { id: 'fuel', label: 'Buy 3 fuel', cost: { credits: 15 }, good: { text: 'The trader pumps three units across and wishes us a straight lane.', fuel: 3 } },
      { id: 'missiles', label: 'Buy 2 Hellion missiles', cost: { credits: 12 }, good: { text: 'Two Hellions transfer to our magazine, cheaper than any station.', missiles: 2 } },
      { id: 'leave', label: 'Decline politely', good: { text: 'The trader shrugs and drifts off toward the next jump point.' } },
    ] },
  { id: 'debris', title: 'A field of fresh debris', speaker: 'kerr', line: 'Somebody lost a fight here not long ago. That is a lot of good metal.',
    text: 'Wreckage from a recent battle spreads across the approach: hull plate, conduit, a drifting turret mount.',
    choices: [
      { id: 'mine', label: 'Work the field', days: 1, good: { text: 'A long shift in suits nets a hold full of plate and conduit.', materials: 8 } },
      { id: 'pass', label: 'Pass through', good: { text: 'We thread the debris without stopping.' } },
    ] },
  { id: 'refugees', title: 'A shuttle running on fumes', speaker: 'morozova', line: 'Eleven people, and their tanks are nearly dry. They have charts of everything around here.',
    text: 'A battered shuttle full of settlers is trying to reach the next system with almost no fuel. They offer their navigation charts in exchange for help.',
    choices: [
      { id: 'give', label: 'Give them 2 fuel', cost: { fuel: 2 }, good: { text: 'The settlers transmit their charts and their thanks. Every system one lane out is now surveyed.', charts: true } },
      { id: 'decline', label: 'We cannot spare it', good: { text: 'We wish them luck. Morozova does not say anything for a while.' } },
    ] },
  { id: 'cache', title: 'An unclaimed weapons cache', speaker: 'cross', line: 'Military stencils, no owner on the registry. Somebody buried this for a reason.',
    text: 'An armoured canister is tethered to a rock in the outer belt, broadcasting a dead faction\'s supply code.',
    choices: [
      { id: 'open', label: 'Crack it open', odds: 70,
        good: { text: 'Three Hellion missiles in good order, packed in foam.', missiles: 3 },
        bad: { text: 'The canister was trapped. The blast scars our forward plating.', hull: -10 } },
      { id: 'leave', label: 'Leave it', good: { text: 'Some locks are better left closed.' } },
    ] },
  { id: 'depot', title: 'An automated fuel depot', speaker: 'mori', line: 'It will sell to anyone with a licence. We do not have one. I could talk it round, or it could call for help.',
    text: 'An unmanned refuelling platform hails us in a corporate dialect and offers a visitor\'s allowance.',
    choices: [
      { id: 'draw', label: 'Take the visitor\'s allowance', good: { text: 'The depot meters out three units and logs our hull number.', fuel: 3 } },
      { id: 'override', label: 'Override the lockout', odds: 55,
        good: { text: 'Mori\'s override holds. We fill the tanks before the depot notices.', fuel: 8 },
        bad: { text: 'The depot screams for its owners, and someone was already close.', ambush: true } },
      { id: 'leave', label: 'Move on without docking', good: { text: 'We leave the depot to its next customer.' } },
    ] },
  { id: 'pilot', title: 'A lifepod with a heartbeat', speaker: 'cross', line: 'One survivor, conscious and asking for a ship. We could use another pair of hands.',
    text: 'A lone pilot drifts in a scuffed lifepod, the last of a crew lost to raiders. They ask to come aboard and earn their keep.',
    choices: [
      { id: 'rescue', label: 'Bring them aboard', good: { text: 'The pilot signs on as an operative and asks where the armoury is.', recruit: true } },
      { id: 'beacon', label: 'Leave a rescue beacon', good: { text: 'We boost their beacon and log the position with the nearest station.' } },
    ] },
  { id: 'storm', title: 'An ion storm across the lane', speaker: 'mori', line: 'I can ride the leading edge and save us fuel, or we wait for it to pass.',
    text: 'A wall of charged particles is sweeping across the system. Its leading edge is fast and turbulent.',
    choices: [
      { id: 'ride', label: 'Ride the storm front', odds: 60,
        good: { text: 'Mori finds the slipstream and the storm pushes us along for free.', fuel: 2 },
        bad: { text: 'The front throws us into a debris eddy. The hull takes a beating before we break clear.', hull: -6 } },
      { id: 'wait', label: 'Hold position until it passes', good: { text: 'We sit in the lee of a moon while the storm goes by, then take the clear lane.' } },
    ] },
  { id: 'satellite', title: 'A relay that still answers', speaker: 'morozova', line: 'It is old, but it is listening. Repair it and it will tell us what it knows.',
    text: 'A pre-collapse relay satellite responds to our handshake with a polite request for maintenance.',
    choices: [
      { id: 'repair', label: 'Repair its relay', cost: { materials: 4 }, good: { text: 'Restored, the relay shares its survey of every system one lane away and a station pays a finder\'s fee.', charts: true, credits: 6 } },
      { id: 'salvage', label: 'Salvage its core', good: { text: 'The core is worth something to the right buyer.', credits: 14 } },
      { id: 'leave', label: 'Let it keep listening', good: { text: 'We leave the relay to its long watch.' } },
    ] },
]
export const SIGNAL_BY_ID: Record<string, ArrivalSignal> = Object.fromEntries(SIGNALS.map((s) => [s.id, s]))

/** Which signal, if any, waits at a system on first arrival. */
export function signalAt(seed: string, systemId: SystemId): ArrivalSignal | null {
  const rng = createRng(`${seed}:signal:${systemId}`)
  return rng.int(100) < SIGNAL_CHANCE ? rng.pick(SIGNALS) : null
}
/** Whether a risky choice comes good: seeded by voyage, system and choice. */
export function signalLuck(seed: string, pending: PendingSignal, choice: SignalChoice): boolean {
  return choice.odds === undefined || createRng(`${seed}:signal:${pending.systemId}:${choice.id}`).int(100) < choice.odds
}
/** A choice that changes nothing: walking away. Every signal offers one. */
export const quietChoice = (signal: ArrivalSignal) => signal.choices.find((c) => !c.cost && !c.days && c.odds === undefined &&
  Object.keys(c.good).every((k) => k === 'text'))!
/** Plain-language terms for a choice button. */
export function signalTerms(choice: SignalChoice): string {
  const terms: string[] = []
  if (choice.cost?.credits) terms.push(`${choice.cost.credits} credits`)
  if (choice.cost?.fuel) terms.push(`${choice.cost.fuel} fuel`)
  if (choice.cost?.materials) terms.push(`${choice.cost.materials} materials`)
  if (choice.days) terms.push(`${choice.days} day`)
  if (choice.odds !== undefined) terms.push(`risky · ${choice.odds}% it goes well`)
  return terms.join(' · ') || 'no cost'
}
