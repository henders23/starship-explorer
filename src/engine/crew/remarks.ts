import { createRng } from '../rng/prng.js'
import type { Galaxy, StarSystem, SystemId } from '../worldgen/types.js'

/**
 * The bridge, consulted about a star.
 *
 * Point the chart at a system the ship has not been to and one of the three
 * officers says something about it — not about the plot, and never about
 * whether that star is the way home. The remarks are astrography, hearsay and
 * shipboard temper: what kind of place it is, and what it would cost the crew
 * to go there. The deduction is the player's, and nothing here narrows it.
 *
 * The galaxy is generated, so the lines cannot be written per star name. Each
 * one is written against something a star *is* — a feature, a class of sun, a
 * region, a junction, an empty system — and the assignment below deals one
 * line to each of the ninety systems, matched to what that system actually
 * holds, distinct from every other system's, and fixed by the seed so the
 * same sky always says the same things.
 */

/** Who says it. The captain is the player and never remarks to themselves. */
export type RemarkVoice = 'science' | 'security' | 'medical'

/**
 * What a line is written about. `any` lines fit any star and are the fallback
 * once the specific pools for a sky are spent.
 */
export type RemarkSubject =
  | { kind: 'feature'; feature: StarSystem['features'][number] }
  | { kind: 'star'; star: StarSystem['star'] }
  | { kind: 'region'; region: StarSystem['region'] }
  | { kind: 'claimed'; by: boolean }
  | { kind: 'junction' }
  | { kind: 'deadEnd' }
  | { kind: 'barren' }
  | { kind: 'any' }

export interface Remark {
  id: string
  voice: RemarkVoice
  subject: RemarkSubject
  line: string
}

const feature = (f: StarSystem['features'][number]): RemarkSubject => ({ kind: 'feature', feature: f })
const star = (s: StarSystem['star']): RemarkSubject => ({ kind: 'star', star: s })
const region = (r: StarSystem['region']): RemarkSubject => ({ kind: 'region', region: r })

/**
 * A hundred and twenty-two lines for ninety stars. The surplus is the point:
 * a sky heavy in ruins and light in ice still has to deal every system
 * something it has earned, without repeating itself.
 */
export const REMARKS: Remark[] = [
  // ---- Gas giants -------------------------------------------------------
  { id: 'gg-1', voice: 'science', subject: feature('gas-giant'), line: 'A gas giant, and a deep one. We can scoop it if the tank gets thin — the drive has never once cared how undignified the refuelling was.' },
  { id: 'gg-2', voice: 'medical', subject: feature('gas-giant'), line: 'Banded hydrogen and nothing anywhere to stand on. Postings like that are where crews finally sleep, Captain.' },
  { id: 'gg-3', voice: 'science', subject: feature('gas-giant'), line: 'The banding on that giant is textbook. I would like an afternoon and a spectrometer, and I am aware I am getting neither.' },
  { id: 'gg-4', voice: 'security', subject: feature('gas-giant'), line: 'That is a considerable gravity well. If I wanted to sit and wait for a ship to come past, I would sit in the shadow of it.' },

  { id: 'gg-5', voice: 'science', subject: feature('gas-giant'), line: 'Moons around that giant, and a good number of them. Somebody with patience could hide a whole flotilla in that traffic.' },
  { id: 'gg-6', voice: 'security', subject: feature('gas-giant'), line: 'Scooping means flying the ship into the top of an atmosphere on purpose. I mention it every time and I will keep mentioning it.' },

  // ---- Asteroid belts ---------------------------------------------------
  { id: 'ab-1', voice: 'security', subject: feature('asteroid-belt'), line: 'A belt like that runs cold on every sweep. Rock hides a hull better than any field this ship carries.' },
  { id: 'ab-2', voice: 'science', subject: feature('asteroid-belt'), line: 'An unsorted belt — that system never finished making its planets. Excellent salvage. Appalling navigation.' },
  { id: 'ab-3', voice: 'security', subject: feature('asteroid-belt'), line: 'Mining claims, most likely. Miners this far out are armed, and they shoot first at anything that arrives quietly.' },
  { id: 'ab-4', voice: 'medical', subject: feature('asteroid-belt'), line: 'Rock dust gets into everything, crew included. If we dock there I want the filters run twice and the coughs logged.' },

  { id: 'ab-5', voice: 'science', subject: feature('asteroid-belt'), line: 'Metal-rich, by the reflectance. Every hull in this sector was pulled out of a belt like that one, eventually.' },
  { id: 'ab-6', voice: 'medical', subject: feature('asteroid-belt'), line: 'Belt work kills people slowly and then all at once. If there are miners in there, some of them will want a doctor.' },

  // ---- Ice rings --------------------------------------------------------
  { id: 'ir-1', voice: 'science', subject: feature('ice-ring'), line: 'Ring ice, and clean ice at that. Water is fuel, coolant and drinking, in ascending order of how much the crew care.' },
  { id: 'ir-2', voice: 'medical', subject: feature('ice-ring'), line: 'A ringed ice world. Every soul aboard will find a reason to be near a viewport. Let them — it costs nothing and it helps.' },
  { id: 'ir-3', voice: 'science', subject: feature('ice-ring'), line: 'Those rings are young. Something out there came apart within the last million years, which in this business is yesterday.' },
  { id: 'ir-4', voice: 'security', subject: feature('ice-ring'), line: 'Ring ice scatters our sensors and everyone else’s equally. That cuts both ways, and I do not care for the second way.' },

  { id: 'ir-5', voice: 'science', subject: feature('ice-ring'), line: 'Ice that clean is a chemistry set. Half of what we know about the outer sector was read out of rings like those.' },
  { id: 'ir-6', voice: 'security', subject: feature('ice-ring'), line: 'Ice is water, water is fuel, and fuel is worth killing for out here. Somebody will already have thought of that.' },

  // ---- Habitable worlds -------------------------------------------------
  { id: 'hw-1', voice: 'medical', subject: feature('habitable-world'), line: 'A green world, Captain. Ground under boots, air nobody has recycled four times. I am prescribing it, if that helps you decide.' },
  { id: 'hw-2', voice: 'science', subject: feature('habitable-world'), line: 'Habitable by the survey’s standards, which are generous. Still: atmosphere, liquid water, and something down there using both.' },
  { id: 'hw-3', voice: 'medical', subject: feature('habitable-world'), line: 'Where there are people there are traders, and traders talk. That is worth more to this ship than the shore leave, though I want the shore leave too.' },
  { id: 'hw-4', voice: 'security', subject: feature('habitable-world'), line: 'Inhabited worlds come with customs officers, tariffs and somebody’s navy. Let us try not to arrive looking interesting.' },

  { id: 'hw-5', voice: 'science', subject: feature('habitable-world'), line: 'A living biosphere. Whatever else that system is, it is the rarest thing on this chart and it should be handled like it.' },
  { id: 'hw-6', voice: 'security', subject: feature('habitable-world'), line: 'Somebody lives there. People who live somewhere have opinions about ships that arrive without asking.' },

  // ---- Ruins ------------------------------------------------------------
  { id: 'ru-1', voice: 'science', subject: feature('ruins'), line: 'Ruins — older than any faction we have met out here. They kept star charts, and that is the part of them I care about.' },
  { id: 'ru-2', voice: 'security', subject: feature('ruins'), line: 'Somebody died protecting whatever is still down there. Take a full away team or take nothing at all.' },
  { id: 'ru-3', voice: 'science', subject: feature('ruins'), line: 'The masonry alone would be somebody’s career. I will settle for whatever survived in their archives, and I will settle gladly.' },
  { id: 'ru-4', voice: 'medical', subject: feature('ruins'), line: 'Ruins mean remains, sooner or later. I would rather the away team heard that from me before they went down than from the site.' },

  { id: 'ru-5', voice: 'science', subject: feature('ruins'), line: 'Stonework and no bodies, on the last survey. Whoever built it left in good order — which is its own kind of unsettling.' },
  { id: 'ru-6', voice: 'security', subject: feature('ruins'), line: 'Ruins draw looters the way wrecks draw scavengers. We will not be the first team down there this decade.' },

  // ---- Derelict beacons -------------------------------------------------
  { id: 'db-1', voice: 'security', subject: feature('derelict-beacon'), line: 'That beacon has repeated the same eleven seconds for decades. Derelicts mean salvage — or an ambush wearing salvage as a coat.' },
  { id: 'db-2', voice: 'science', subject: feature('derelict-beacon'), line: 'The carrier signal is drifting flat. Whatever powers it has been failing slowly for a very long time, and is nearly done.' },
  { id: 'db-3', voice: 'medical', subject: feature('derelict-beacon'), line: 'A dead ship still calling. Whoever set that going expected somebody to come for them. Nobody did.' },
  { id: 'db-4', voice: 'security', subject: feature('derelict-beacon'), line: 'A lit beacon on a cold hull, this far out? Someone wanted it found. That worries me a good deal more than silence would.' },

  { id: 'db-5', voice: 'science', subject: feature('derelict-beacon'), line: 'The hull is intact enough to be worth boarding. Whatever went wrong aboard it went wrong on the inside.' },
  { id: 'db-6', voice: 'medical', subject: feature('derelict-beacon'), line: 'There will be a crew still aboard that ship. I would like to be on the team, and I would like the team briefed.' },

  // ---- Nebular shrouds --------------------------------------------------
  { id: 'ns-1', voice: 'science', subject: feature('nebula-shroud'), line: 'That shroud reads hot on every band we have. Inside it our sensors will be worth roughly what guessing is worth.' },
  { id: 'ns-2', voice: 'security', subject: feature('nebula-shroud'), line: 'We cannot see into it and nothing inside can see us. I would call that even if I trusted whoever is already in there.' },
  { id: 'ns-3', voice: 'science', subject: feature('nebula-shroud'), line: 'Ionised gas, thick enough to chart by eye. The instruments will lie to us politely for as long as we are in it.' },
  { id: 'ns-4', voice: 'medical', subject: feature('nebula-shroud'), line: 'The light inside a shroud does something to people. Expect short tempers, long silences, and three of them at my door.' },

  { id: 'ns-5', voice: 'science', subject: feature('nebula-shroud'), line: 'The shroud is stellar remnant — a star died there and never quite finished dispersing. Beautiful, and entirely opaque.' },
  { id: 'ns-6', voice: 'security', subject: feature('nebula-shroud'), line: 'Gas that thick fouls a targeting solution completely. Whoever shoots first in there is shooting at a rumour.' },

  // ---- Pulsars ----------------------------------------------------------
  { id: 'pu-1', voice: 'science', subject: feature('pulsar'), line: 'A pulsar. The radiation cone sweeps every few seconds; the shielding will hold, but nothing lives there by choice.' },
  { id: 'pu-2', voice: 'security', subject: feature('pulsar'), line: 'Hard radiation on a schedule you could set a watch by. Nobody hides in a system like that — which is worth knowing too.' },
  { id: 'pu-3', voice: 'science', subject: feature('pulsar'), line: 'A neutron star spun up and screaming. Every navigator inside a hundred light years uses it as a fixed point, ourselves included.' },
  { id: 'pu-4', voice: 'medical', subject: feature('pulsar'), line: 'I want everyone off the hull while we are in that system, and dosimeters read on the way out. No exceptions, and that includes you.' },

  { id: 'pu-5', voice: 'science', subject: feature('pulsar'), line: 'The spin-down rate is measurable from here. Give me a week in that system and I could tell you its age to the century.' },
  { id: 'pu-6', voice: 'security', subject: feature('pulsar'), line: 'Comms will be useless in the cone. If we split up in there, we stay split until we are out again.' },

  // ---- Rift echoes ------------------------------------------------------
  { id: 're-1', voice: 'science', subject: feature('rift-echo'), line: 'A rift echo, Captain — the same signature as the thing that threw us out here. The drive hums when we so much as point at it.' },
  { id: 're-2', voice: 'science', subject: feature('rift-echo'), line: 'Every instrument disagrees with every other about that system, and each is perfectly confident. That is what an echo does to a sensor suite.' },
  { id: 're-3', voice: 'medical', subject: feature('rift-echo'), line: 'The crew feel those before the sensors report them. Three people on my list with bad dreams this week, and one of them flies this ship.' },
  { id: 're-4', voice: 'security', subject: feature('rift-echo'), line: 'Whatever tore the sky open there left a scar behind it. I would sooner we went in with the guns already warm.' },

  { id: 're-5', voice: 'science', subject: feature('rift-echo'), line: 'The echo is old and it is faint, but it is the same shape as ours. Something opened out there once, and closed again.' },
  { id: 're-6', voice: 'medical', subject: feature('rift-echo'), line: 'I have read the intake logs from the last echo we passed. Whatever it does to instruments, it does a version of to people.' },

  // ---- Star classes -----------------------------------------------------
  { id: 'sy-1', voice: 'science', subject: star('yellow'), line: 'A yellow main-sequence star: unremarkable, and therefore useful — unremarkable stars are the ones the old surveys bothered to catalogue properly.' },
  { id: 'sy-2', voice: 'medical', subject: star('yellow'), line: 'Ordinary sunlight. You would not think that counted for anything until you have gone without it for a season.' },
  { id: 'sy-3', voice: 'science', subject: star('yellow'), line: 'Near enough the same class as home’s. The crew will notice the colour of it. They always notice.' },

  { id: 'so-1', voice: 'science', subject: star('orange'), line: 'An orange dwarf — long-lived and patient. If anything ever settled in there, it had all the time it could possibly have wanted.' },
  { id: 'so-2', voice: 'medical', subject: star('orange'), line: 'That light is kinder than the instruments make it sound. Warm, in the way old lamps are warm.' },
  { id: 'so-3', voice: 'security', subject: star('orange'), line: 'Quiet star, quiet system, nothing on any band. Quiet is generally where I start looking.' },

  { id: 'sr-1', voice: 'science', subject: star('red-dwarf'), line: 'A red dwarf. Dim, stable, and more numerous than everything else in the sky combined — which is precisely why nobody surveys them properly.' },
  { id: 'sr-2', voice: 'security', subject: star('red-dwarf'), line: 'Thin data, a small red sun, nothing worth naming. That is exactly what a hiding place looks like from the outside.' },
  { id: 'sr-3', voice: 'science', subject: star('red-dwarf'), line: 'A flare star, at a guess. Anything living in close to it would have learned to live underground, and quickly.' },

  { id: 'sg-1', voice: 'science', subject: star('red-giant'), line: 'A red giant, and late in the business of being one. It has already swallowed whatever it had close in.' },
  { id: 'sg-2', voice: 'medical', subject: star('red-giant'), line: 'That star is dying, slowly and enormously. Crews find it either beautiful or unbearable and there is no third camp.' },
  { id: 'sg-3', voice: 'security', subject: star('red-giant'), line: 'The outer system will be thick with what the star has thrown off. Tell the helm to take it slowly.' },

  { id: 'sb-1', voice: 'science', subject: star('blue-giant'), line: 'A blue giant: brief, violent, and very bright. It will not be there in a few million years, so I would rather look now.' },
  { id: 'sb-2', voice: 'security', subject: star('blue-giant'), line: 'A blue giant lights a system like a searchlight. Nothing approaches one unseen, and that includes us.' },
  { id: 'sb-3', voice: 'medical', subject: star('blue-giant'), line: 'Shutters to maximum on the approach, please. That light is not kind to eyes and I am short of eye patches.' },

  { id: 'sw-1', voice: 'science', subject: star('white-dwarf'), line: 'A white dwarf — a star’s ember, still cooling. Whatever system it had, it has already burned through.' },
  { id: 'sw-2', voice: 'science', subject: star('white-dwarf'), line: 'The core of it is degenerate matter. A spoonful would go through this deck and keep going for some while.' },
  { id: 'sw-3', voice: 'medical', subject: star('white-dwarf'), line: 'A dead sun and whatever is left circling it. Not the posting I would choose for anyone already low.' },

  { id: 'sn-1', voice: 'science', subject: star('neutron'), line: 'A neutron star: the whole mass of a sun folded down to something you could walk across, if walking there were survivable.' },
  { id: 'sn-2', voice: 'security', subject: star('neutron'), line: 'Gravity gradients like that take a hull apart if the helm gets bored. Nobody gets bored on my watch.' },
  { id: 'sn-3', voice: 'science', subject: star('neutron'), line: 'Its timing signal is better than the clock on this bridge. Navigators adore them. I adore them.' },

  { id: 'sp-1', voice: 'science', subject: star('binary'), line: 'A binary pair. Two suns, one thoroughly confused set of orbits, and a chart that cost somebody years of their life.' },
  { id: 'sp-2', voice: 'security', subject: star('binary'), line: 'Binaries strip their moons bare. Where there is stripping there are rigs, and where there are rigs there is somebody who owns them.' },
  { id: 'sp-3', voice: 'medical', subject: star('binary'), line: 'Two suns, two sets of shadows, and a sleep cycle that gives up entirely. I will be hearing about it for a week.' },

  // ---- Regions ----------------------------------------------------------
  { id: 'rg-sh-1', voice: 'medical', subject: region('shallows'), line: 'The Shallows. This is where the anomaly set us down, and it is the closest thing to familiar anyone aboard has left.' },
  { id: 'rg-sh-2', voice: 'security', subject: region('shallows'), line: 'Near space: traffic, patrols, the occasional honest trader. It stops being this friendly the further out we push.' },
  { id: 'rg-tr-1', voice: 'medical', subject: region('trade-reach'), line: 'The Trade Reach — ports, people and gossip. Half of what this ship knows, it learned in somebody’s bar.' },
  { id: 'rg-tr-2', voice: 'security', subject: region('trade-reach'), line: 'Trade lanes mean cargo, and cargo means somebody out here makes a living relieving ships of it.' },
  { id: 'rg-cb-1', voice: 'science', subject: region('cinder-belt'), line: 'The Cinder Belt: old stars, burnt-out systems, and a great deal of wreckage nobody ever came back for.' },
  { id: 'rg-cb-2', voice: 'security', subject: region('cinder-belt'), line: 'Salvage country. Everything out here belongs to whoever reached it first and is still holding it.' },
  { id: 'rg-xl-1', voice: 'science', subject: region('xenoline'), line: 'The Xenoline. Past this the charts stop agreeing with one another, and the names on them stop being ours.' },
  { id: 'rg-xl-2', voice: 'medical', subject: region('xenoline'), line: 'Nobody aboard has been this far out before. It shows, in small ways, at the ends of long shifts.' },
  { id: 'rg-rm-1', voice: 'science', subject: region('rift-margin'), line: 'The Rift Margin. Out here the sky itself is unreliable — half our fixed points are not, in fact, fixed.' },
  { id: 'rg-rm-2', voice: 'security', subject: region('rift-margin'), line: 'The edge of everything. If it goes wrong for us out there, nothing is coming to help.' },

  // ---- Claimed and unclaimed --------------------------------------------
  { id: 'fc-1', voice: 'security', subject: { kind: 'claimed', by: true }, line: 'That system is claimed and they patrol it. We arrive politely, or we arrive under fire.' },
  { id: 'fc-2', voice: 'medical', subject: { kind: 'claimed', by: true }, line: 'Claimed space means a yard, a dock, and somebody who can repair what I cannot. Worth a tariff, in my professional opinion.' },
  { id: 'fc-3', voice: 'security', subject: { kind: 'claimed', by: true }, line: 'Somebody’s flag over that star. Flags this far out are less about pride than about tolls.' },
  { id: 'un-1', voice: 'security', subject: { kind: 'claimed', by: false }, line: 'Nobody claims it, which means nobody polices it. Both halves of that matter to us.' },
  { id: 'un-2', voice: 'science', subject: { kind: 'claimed', by: false }, line: 'Unclaimed, and uncatalogued by anyone we can actually ask. We would be writing that survey ourselves.' },

  // ---- Shape of the lane graph ------------------------------------------
  { id: 'jn-1', voice: 'science', subject: { kind: 'junction' }, line: 'Four lanes converge there. Anything that has moved through this part of the sector has passed through it at least once.' },
  { id: 'jn-2', voice: 'security', subject: { kind: 'junction' }, line: 'A junction. Junctions are where you set an ambush, and where you set a watch. Sometimes both.' },
  { id: 'jn-3', voice: 'medical', subject: { kind: 'junction' }, line: 'Everyone comes through there eventually. If we want news — or want to be found — that is the place to sit.' },
  { id: 'de-1', voice: 'security', subject: { kind: 'deadEnd' }, line: 'One lane in and the same lane out. I do not care for systems a ship can be cornered in.' },
  { id: 'de-2', voice: 'science', subject: { kind: 'deadEnd' }, line: 'A cul-de-sac of a system. Whatever went in there had to have meant to go in there.' },
  { id: 'de-3', voice: 'medical', subject: { kind: 'deadEnd' }, line: 'Nowhere to run from that one. Not a comfortable place to have an emergency, and we do have emergencies.' },
  { id: 'ba-1', voice: 'science', subject: { kind: 'barren' }, line: 'Nothing on the charts but the star itself. Empty systems are good for the nerves and bad for the mystery.' },
  { id: 'ba-2', voice: 'security', subject: { kind: 'barren' }, line: 'No worlds, no wreckage, no traffic. Nothing there to want, so nothing there to fight over.' },
  { id: 'ba-3', voice: 'medical', subject: { kind: 'barren' }, line: 'A sun and a great deal of nothing. The crew will not thank you for a week of looking at it.' },

  // ---- Anywhere ---------------------------------------------------------
  { id: 'an-1', voice: 'science', subject: { kind: 'any' }, line: 'The survey entry runs to three lines and two of them are the coordinates. We would be doing the rest of it ourselves.' },
  { id: 'an-2', voice: 'security', subject: { kind: 'any' }, line: 'Nothing on file that worries me. Which is not at all the same thing as nothing to worry about.' },
  { id: 'an-3', voice: 'medical', subject: { kind: 'any' }, line: 'The tank and the calendar both, Captain. Every lane we fly is a day none of us get back.' },
  { id: 'an-4', voice: 'science', subject: { kind: 'any' }, line: 'I have cross-checked it against everything we hold. It remains possible, which is all a chart can ever tell you.' },
  { id: 'an-5', voice: 'security', subject: { kind: 'any' }, line: 'The route is clean as far as we can see down it. As far as we can see down it is not very far.' },
  { id: 'an-6', voice: 'medical', subject: { kind: 'any' }, line: 'We can make that trip. Whether the crew arrive in a state to do anything afterwards is a separate question.' },
  { id: 'an-7', voice: 'science', subject: { kind: 'any' }, line: 'Astrogation has it plotted. The lanes out that way were charted by someone in a hurry, several generations ago.' },
  { id: 'an-8', voice: 'security', subject: { kind: 'any' }, line: 'If we go, I would rather we went with the tank up. Arriving somewhere new on fumes is how ships get boarded.' },
  { id: 'an-9', voice: 'medical', subject: { kind: 'any' }, line: 'Nobody aboard has ever been there. That is true of almost everywhere now, and it has stopped being remarkable.' },
  { id: 'an-10', voice: 'science', subject: { kind: 'any' }, line: 'The last survey of that system predates the faction that claims this half of the sector. Treat it as a rough guide.' },
  { id: 'an-11', voice: 'security', subject: { kind: 'any' }, line: 'A long way to go on somebody’s word. Though somebody’s word is the whole of what we have.' },
  { id: 'an-12', voice: 'medical', subject: { kind: 'any' }, line: 'It is a star on a chart, Captain. Whether it is anything more than that is what we go out and find.' },
  { id: 'an-13', voice: 'science', subject: { kind: 'any' }, line: 'Two catalogues, two different positions for that star, four light years apart. Somebody copied somebody badly a long time ago.' },
  { id: 'an-14', voice: 'security', subject: { kind: 'any' }, line: 'No distress traffic, no patrol traffic, no traffic at all. Systems that quiet are usually quiet for a reason.' },
  { id: 'an-15', voice: 'medical', subject: { kind: 'any' }, line: 'Whatever you decide, decide it today. Waiting costs the same as flying and buys us nothing at all.' },
  { id: 'an-16', voice: 'science', subject: { kind: 'any' }, line: 'The lane geometry into that system is awkward. Not dangerous — just the sort of awkward that turns into dangerous when you are tired.' },
  { id: 'an-17', voice: 'security', subject: { kind: 'any' }, line: 'We would be arriving without knowing who else is already there. That is most of this job, so I will stop saying it.' },
  { id: 'an-18', voice: 'medical', subject: { kind: 'any' }, line: 'The medbay is as ready as it gets. Go where you must, Captain — just tell me the day before, not the hour.' },
  { id: 'an-19', voice: 'science', subject: { kind: 'any' }, line: 'It is on nobody\u2019s trade route, which means the only accounts of it will be from people who went out of their way.' },
  { id: 'an-20', voice: 'security', subject: { kind: 'any' }, line: 'Approach lanes are open. If that changes on the way in, I would like the guns crewed before we find out why.' },
]

export const REMARK_BY_ID: Record<string, Remark> = Object.fromEntries(
  REMARKS.map((remark) => [remark.id, remark]),
)

/**
 * How strongly a line about this kind of thing beats a vaguer one. The spread
 * is wide on purpose: a system with ruins in it should be talked about as a
 * system with ruins in it, and only fall back to its sun, its region and
 * finally to shipboard small talk once those lines are spent.
 */
const SPECIFICITY: Record<RemarkSubject['kind'], number> = {
  feature: 24,
  barren: 12,
  junction: 6,
  deadEnd: 6,
  star: 4,
  region: 2,
  claimed: 2,
  any: 0.5,
}

/** Whether a line is true of a system — the contract the assignment keeps. */
export function remarkFits(remark: Remark, system: StarSystem, degree: number): boolean {
  switch (remark.subject.kind) {
    case 'feature':
      return system.features.includes(remark.subject.feature)
    case 'star':
      return system.star === remark.subject.star
    case 'region':
      return system.region === remark.subject.region
    case 'claimed':
      return (system.faction !== null) === remark.subject.by
    case 'junction':
      return degree >= 4
    case 'deadEnd':
      return degree <= 1
    case 'barren':
      return system.features.length === 0
    case 'any':
      return true
  }
}

/**
 * One remark per system, fixed by the seed.
 *
 * Systems are dealt in a shuffled order so that no part of the sky gets first
 * refusal on the good lines every voyage, and each takes the most specific
 * unused line that fits it — a system with ruins hears about its ruins before
 * it hears about its sun. When a pool runs dry the line falls back through
 * vaguer subjects to the `any` pool, and only if all ninety-six are spent
 * does a line get told twice.
 */
export function assignRemarks(seed: string, galaxy: Galaxy): Record<SystemId, string> {
  const rng = createRng(`${seed}:remarks`)
  const unused = new Set(REMARKS.map((r) => r.id))
  const assigned: Record<SystemId, string> = {}

  for (const system of rng.shuffle(galaxy.systems)) {
    const degree = (galaxy.adjacency[system.id] ?? []).length
    const fits = REMARKS.filter((r) => remarkFits(r, system, degree))
    const free = fits.filter((r) => unused.has(r.id))
    const pool = free.length > 0 ? free : fits

    // Weighted toward the specific, so the sky is described by what is in it.
    const chosen = rng.weighted(pool.map((r) => [r, SPECIFICITY[r.subject.kind]] as const))
    assigned[system.id] = chosen.id
    unused.delete(chosen.id)
  }

  return assigned
}
