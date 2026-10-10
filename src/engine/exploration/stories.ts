import type { ExplorationLocation, LocationKind } from './v2.js'

export interface StoryChoice {
  id: string; label: string; outcome: string; days: number
  materials: number; credits: number; fuel: number
}
export interface SiteStory { id: string; title: string; text: string; choices: StoryChoice[] }
export interface StoryRecord { locationId: string; storyId: string; choiceId: string; day: number }
const choice = (id: string, label: string, outcome: string, days: number, materials = 0, credits = 0, fuel = 0): StoryChoice =>
  ({ id, label, outcome, days, materials, credits, fuel })
const courier: SiteStory = {
  id: 'last-post', title: 'The last post',
  text: 'Beside the power cell, a separate transmitter holds 143 unsent family messages. Its final instruction is simple: keep trying. We can carry the messages to a station, or leave a stronger beacon for anyone still searching.',
  choices: [
    choice('carry', 'Carry the letters', '143 messages are safely aboard. A contacted station in another system can relay them. A delivery commission of 25 credits awaits.', 1),
    choice('beacon', 'Keep the light on', 'A new beacon begins transmitting the names of the missing. We leave the ship as a place where someone might still be found.', 1, -3),
  ],
}
const stories: Partial<Record<LocationKind, SiteStory[]>> = {
  derelict: [
    { id: 'winter-garden', title: 'A garden without a sun', text: 'Frost covers the crew quarters. In the greenhouse, a maintenance drone is still watering six living trees. Their roots have grown around a crate of valuable heat exchangers.', choices: [
      choice('seeds', 'Save the seed bank', 'The drone surrenders a sealed seed bank. Its trees will have another spring in the Ithaca’s nursery.', 2, -2, 12),
      choice('machinery', 'Recover the exchangers', 'The heat exchangers are aboard. Without their warmth, the greenhouse goes dark. We record what grew here.', 1, 7),
    ] },
    { id: 'unfinished-map', title: 'Someone else’s horizon', text: 'A navigator charted a safe route through the local dust before the ship failed. The raw readings are intact; the plotted course stops halfway through a handwritten correction.', choices: [
      choice('finish', 'Finish the navigator’s work', 'The correction resolves a dangerous eddy. A safer local course saves eight units of fuel, and the navigator’s name remains on the chart.', 2, 0, 0, 8),
      choice('sell', 'License the raw readings', 'A prospecting exchange buys the incomplete survey with its uncertainties clearly marked.', 1, 0, 16),
    ] },
  ],
  ruins: [
    { id: 'rain-vault', title: 'The rain vault', text: 'Every sixty seconds the buried machine plays the sound of rainfall. Beneath it is a reservoir, sealed when the surface dried. Its pump could repair our ship; opening the vault would erase its pressure record.', choices: [
      choice('listen', 'Preserve the reservoir', 'We leave the seal intact and sell copies of the climate record. For a moment, everyone on the bridge listens to the rain.', 2, 0, 22),
      choice('pump', 'Salvage the pump', 'The pressure record is lost when we open the vault. The pump yields a cache of precision alloys.', 1, 9),
    ] },
    { id: 'night-orchestra', title: 'The night orchestra', text: 'Thin towers vibrate in the wind. Their notes change as shadows cross a buried dial. This is a clock that has been keeping time for a civilisation no one remembers.', choices: [
      choice('record', 'Record a complete cycle', 'The towers sing through a full day. Our recording preserves the rhythm of a vanished calendar; an archive pays for a copy.', 3, 0, 28),
      choice('anchor', 'Stabilise the failing tower', 'We brace the smallest tower. The sequence is complete again. Loose fragments from the foundation can be taken without harming it.', 1, 3),
    ] },
  ],
  world: [{ id: 'tidal-lights', title: 'Lights beneath the tide', text: 'Each night, the shallows light up in branching patterns. Morozova suspects a living network. Sampling it would pay for supplies, but distant observation would keep our biology out of its ocean.', choices: [
    choice('observe', 'Map it from orbit', 'Three nights reveal a pattern linked to the tides. The survey earns a modest licensing fee. Nothing from the Ithaca enters the ocean.', 3, 0, 18),
    choice('sample', 'Send a sterile sampling probe', 'A sealed sample reaches quarantine. The probe remains below, broadcasting its position. The biochemistry contract pays for the expedition.', 1, -4, 32),
  ] }],
  'resource-field': [{ id: 'tethered-tug', title: 'The tethered tug', text: 'A mining tug is caught in its own cable. Its pilot asks for propellant to pull free. A salvage drone could cut the cable instead, but the abandoned ore would be lost.', choices: [
    choice('fuel', 'Transfer propellant', 'The tug pulls clear with its ore intact. Its pilot transfers refined alloy in thanks.', 1, 8, 0, -6),
    choice('cut', 'Cut the cable remotely', 'The pilot returns safely to the lane. The ore drifts into the ring; the tug’s insurer pays a small rescue fee.', 2, 0, 14),
  ] }],
  anomaly: [{ id: 'borrowed-minute', title: 'A borrowed minute', text: 'A probe answers a command we have not sent yet. The echo lasts sixty seconds, then falls silent. Repeating the experiment may consume the probe; recording from outside would take longer.', choices: [
    choice('repeat', 'Commit a second probe', 'The second probe never returns, but its timestamp does. An independent lab purchases the anomalous telemetry.', 1, -5, 30),
    choice('watch', 'Watch from a safe distance', 'After three days, the echo repeats naturally. We keep our probes and share the observations with a research exchange.', 3, 0, 18),
  ] }],
  outpost: [{ id: 'empty-chair', title: 'The empty chair', text: 'The settlement projects a table with an empty seat. Beside it are diagrams of a damaged water filter. Their invitation is unmistakable even before the words make sense.', choices: [
    choice('repair', 'Send replacement filters', 'Clean water flows again. The settlement sends fuel in sealed exchange canisters and a recording of a table with every seat filled.', 2, -5, 0, 12),
    choice('trade', 'Arrange a supply contract', 'We introduce the settlement to a passing trader. The filter delivery is scheduled, and the trader pays a brokerage fee.', 1, 0, 16),
  ] }],
  signal: [{ id: 'long-watch', title: 'The long watch', text: 'The signal comes from a weather buoy beside a shattered habitat. It has one remaining emergency capsule. Inside, a sleeping surveyor’s monitor still shows a steady heartbeat.', choices: [
    choice('wake', 'Wake the surveyor aboard', 'The surveyor asks what year it is, then asks for tea. Their emergency fund covers the rescue; they will disembark with the next civilian tender.', 2, -3, 26),
    choice('tender', 'Guide a medical tender in', 'We hold position until a medical ship docks with the capsule. Its doctor sends a quiet message: the surveyor is awake.', 3, 0, 12),
  ] }],
}
/** Authored layer has its own stable selector; it never consumes world-generation RNG. */
export function storyAt(seed: string, site: ExplorationLocation): SiteStory | null {
  if (site.name === 'The Silent Courier') return courier
  const pool = stories[site.kind]
  if (!pool) return null
  let hash = 2166136261
  for (const char of `${seed}:${site.id}:story-v1`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  return pool[(hash >>> 0) % pool.length]!
}
export function choiceTerms(choice: StoryChoice): string {
  const terms = [`${choice.days} ${choice.days === 1 ? 'day' : 'days'}`]
  for (const key of ['materials', 'credits', 'fuel'] as const) {
    if (choice[key]) terms.push(`${choice[key] > 0 ? '+' : '−'}${Math.abs(choice[key])} ${key}`)
  }
  return terms.join(' · ')
}
