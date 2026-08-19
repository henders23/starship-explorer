import type { Officer, OfficerRole } from '../crew/types.js'
import { dominantSite, type Site } from '../missions/sites.js'
import type { Clue, ClueSourceKind } from '../mystery/types.js'
import { createRng, type Rng } from '../rng/prng.js'
import type { GameState } from '../state/types.js'
import type { RegionId, StarSystem } from '../worldgen/types.js'
import type { SceneBeat, SceneFigure, SceneInstance, SceneOption } from './types.js'

/**
 * The scene templates and the caster.
 *
 * Templates are authored; the seed casts them. A template family exists per
 * kind of content — trader, archive, castaway, crew memory, and one per
 * hazardous site type — and each family carries beat variants so repeat
 * encounters do not read identically. Casting is a pure function of the
 * game state: the same seed and the same arrival always play the same scene.
 */

interface CastContext {
  system: StarSystem
  clues: Clue[]
  site: Site | null
  /** Short address forms per role, e.g. "Lt. Novak"; falls back to the role. */
  officer: Record<OfficerRole, string>
  figure: SceneFigure | null
  rng: Rng
}

interface SceneTemplate {
  id: string
  /** Casts the outside party, if the family has one. */
  figure?: (rng: Rng) => SceneFigure
  /** Beat variants; the rng picks one. */
  variants: Array<(ctx: CastContext) => SceneBeat[]>
  options: (ctx: CastContext) => SceneOption[]
}

const shortName = (officer: Officer | undefined, fallback: string): string => {
  if (!officer) return fallback
  const parts = officer.name.split(' ')
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]}` : officer.name
}

const account = (ctx: CastContext): string =>
  ctx.clues.length === 1 ? 'an account' : `${ctx.clues.length} accounts`

/** The same phrase, capitalised, for when it opens a sentence. */
const Account = (ctx: CastContext): string => {
  const phrase = account(ctx)
  return phrase.charAt(0).toUpperCase() + phrase.slice(1)
}

/**
 * Region flavour (R9): a clause of local weather the narrator can weave in,
 * so the same family reads differently in different parts of the sky.
 */
const REGION_FLAVOUR: Record<RegionId, string> = {
  shallows: 'out here in the Shallows, where traffic is a rumour and the lanes run quiet',
  'trade-reach': 'deep in the Trade Reach, with dock chatter crowding every open band',
  'cinder-belt': 'in the Cinder Belt, under a sky the colour of old burns',
  xenoline: 'along the Xenoline, where nothing on the chart had a human name first',
  'rift-margin': 'hard against the Rift Margin, where the instruments never quite settle',
}

const where = (ctx: CastContext): string => REGION_FLAVOUR[ctx.system.region]

/* ------------------------------------------------------------------------ *
 * Social families — the evidence is handed over, on terms.
 * ------------------------------------------------------------------------ */

const TRADER_NAMES = ['Veth', 'Ilquen', 'Mosca', 'Harrow', 'Qeb', 'Andessa', 'Roul']
const ARCHIVIST_NAMES = ['Senn', 'Odrath', 'Calverine', 'Ipp', 'Maro']
const CASTAWAY_NAMES = ['Ede Varga', 'Tomas Reel', 'Sana Oduya', 'Piotr Ilyin', 'Merit Okonkwo']

const trader: SceneTemplate = {
  id: 'trader',
  figure: (rng) => ({ name: `Broker ${rng.pick(TRADER_NAMES)}`, label: 'Trader' }),
  variants: [
    (ctx) => [
      { speaker: null, text: `A trade barque hangs off ${ctx.system.name}'s outer marker, running its lights in the pattern that means open for business.` },
      { speaker: 'figure', text: `“The lost ship. Word travels, Captain. You want charts, rumours, anything at all about the shape of this sky. That is what I sell.”` },
      { speaker: 'science', text: `Off-channel: “Brokers hear things, Captain, and some of what they hear is true. I would listen, and then check every word of it.”` },
      { speaker: 'figure', text: `“I hold ${account(ctx)} of the rift you are chasing. We can talk about the price, but not for very long.”` },
    ],
    (ctx) => [
      { speaker: null, text: `Two hours out from ${ctx.system.name}, a small fast hull matches course without being asked, close enough to read the scorch marks on the Ithaca's flank.` },
      { speaker: 'figure', text: `“That is rift-burn on your plating, Captain. Ships carrying that are all shopping for the same thing, and I carry it: ${account(ctx)}. I will not swear to where any of it came from.”` },
      { speaker: 'security', text: `“They matched our course before we ever hailed, Captain. They wanted this meeting. Keep that in mind when they name a price.”` },
    ],
    (ctx) => [
      { speaker: null, text: `${ctx.system.name} keeps a licensed exchange — three docks, one tariff board, and a broker's stall that has already printed your ship's silhouette on its awning.` },
      { speaker: 'figure', text: `“I flagged your hull the day the relay net first carried it, Captain, and I have been holding stock for you ever since. ${Account(ctx)} touching your anomaly, catalogued and priced before you ever made orbit.”` },
      { speaker: 'medical', text: `Quietly: “They knew we were coming before we did, Captain. I would like to know who else they have been selling to.”` },
    ],
    (ctx) => [
      { speaker: null, text: `The wideband at ${ctx.system.name} carries one voice, ${where(ctx)} — a broker's tender running a circuit no registry lists, its hold full of other people's knowledge.` },
      { speaker: 'figure', text: `“I keep no stall and no stacks, Captain. The inventory is in my head, which is why nobody has ever taxed it. ${Account(ctx)} of your rift, and I can recite any of them. The price does not move.”` },
      { speaker: 'science', text: `“Memory traders live on their reputation, Captain. One bad recollection and nobody pays them again. I would hear this one out.”` },
    ],
  ],
  options: () => [
    {
      id: 'pay',
      label: 'Pay their price',
      detail: '1 day · 4 fuel siphoned across',
      effect: { kind: 'collect', days: 1, fuel: 4 },
    },
    {
      id: 'haggle',
      label: 'Haggle it out of them',
      detail: `2 days alongside · costs nothing but time`,
      effect: { kind: 'collect', days: 2 },
    },
    { id: 'leave', label: 'Break contact', detail: 'The account stays theirs, for now', effect: { kind: 'dismiss' } },
  ],
}

const archive: SceneTemplate = {
  id: 'archive',
  figure: (rng) => ({ name: `Archivist ${rng.pick(ARCHIVIST_NAMES)}`, label: 'Faction archive' }),
  variants: [
    (ctx) => [
      { speaker: null, text: `${ctx.system.name} keeps an archive — climate-sealed stacks in orbit, older than the faction that guards them.` },
      { speaker: 'figure', text: `“Your request is noted. The stacks hold ${account(ctx)} touching on your anomaly. Access runs through the usual procedure, and the procedure is not quick.”` },
      { speaker: 'security', text: `Quietly: “Or it runs through whatever we are willing to hand the doorkeeper, Captain.”` },
    ],
    (ctx) => [
      { speaker: null, text: `The registry at ${ctx.system.name} answers the hail with a queue number. Somewhere below, ${where(ctx)}, there is a reading room that has been quiet for three hundred years.` },
      { speaker: 'figure', text: `“We are aware of your ship and your circumstances, Captain. The archive holds ${account(ctx)} relevant to your filing, and it will release them in the order the forms allow. I am sorry. Urgency has never moved that order.”` },
      { speaker: 'science', text: `“Archives this old are indexed by accretion, Captain. Finding a record takes far longer than reading it. Their procedure may honestly be the quickest route through their own stacks.”` },
    ],
    (ctx) => [
      { speaker: null, text: `${ctx.system.name}'s archive was a warship once; the gun deck is a reading gallery now, and the fire-control room signs the visitor passes.` },
      { speaker: 'figure', text: `“Everything the old crews logged about your rift is bound in the after stacks. ${Account(ctx)}, by our catalogue. The war is long over and so is the navy that fought it, Captain, but the filing rules have not changed. We can come to terms, or you can wait.”` },
      { speaker: 'medical', text: `“A warship that ended up a library, Captain. I would not have minded serving on this one.”` },
    ],
  ],
  options: () => [
    {
      id: 'formal',
      label: 'File the request and wait',
      detail: '2 days of procedure · costs nothing',
      effect: { kind: 'collect', days: 2 },
    },
    {
      id: 'consideration',
      label: 'A quiet consideration for the archivist',
      detail: '1 day · 3 fuel finds its way to their tender',
      effect: { kind: 'collect', days: 1, fuel: 3 },
    },
    { id: 'leave', label: 'Withdraw the request', effect: { kind: 'dismiss' } },
  ],
}

const castaway: SceneTemplate = {
  id: 'castaway',
  figure: (rng) => ({ name: rng.pick(CASTAWAY_NAMES), label: 'Castaway' }),
  variants: [
    (ctx) => [
      { speaker: null, text: `A distress transponder, decades out of date, chirps from a habitat module in a slow orbit around ${ctx.system.name}.` },
      { speaker: 'figure', text: `“You're — you came through it too, didn't you. The light that goes wrong. I can hear it in your drive note. Nobody else sounds like us.”` },
      { speaker: 'medical', text: `“One person, alive and talking, Captain. Whatever they know, they have had years to turn it over.”` },
      { speaker: 'figure', text: `“I kept records. ${account(ctx)}, everything I could fix about where the rift touches. Come alongside and they are yours. I only want the company.”` },
    ],
    (ctx) => [
      { speaker: null, text: `A lifeboat rides a powered-down orbit at ${ctx.system.name}, hull striped with patch-welds in a dozen mismatched alloys. Somebody has been keeping it alive by hand for a very long time.` },
      { speaker: 'figure', text: `“Careful on approach, the port thruster does not read true. You are the first hull I have seen ${where(ctx)} in six years, and the first one that ever sounded like mine did. You came through it as well. So you will want what I have.”` },
      { speaker: 'security', text: `“One lifeboat, one heat signature, nothing live on the boards, Captain. This is not an ambush.”` },
      { speaker: 'figure', text: `“${Account(ctx)}, and I kept them on paper. Nothing I stored in a machine survived the surges. Come and read them.”` },
    ],
    (ctx) => [
      { speaker: null, text: `The habitable world at ${ctx.system.name} has one fire burning on its night side, and the fire is arranged in a signal square older than any code aboard.` },
      { speaker: 'medical', text: `“That is a distress layout from the first survey era, Captain. Whoever set it learned the pattern a lifetime ago, and they are still lighting it.”` },
      { speaker: 'figure', text: `“I stopped counting the years a long while back. I never stopped watching the sky, though, and it does things out here that I can put names to. ${Account(ctx)}, if you will sit with me long enough to hear them.”` },
    ],
  ],
  options: () => [
    {
      id: 'aboard',
      label: 'Bring them aboard',
      detail: '2 days · they talk freely over mess rations',
      effect: { kind: 'collect', days: 2 },
    },
    {
      id: 'airlock',
      label: 'Keep it to airlock range',
      detail: '1 day · guarded answers, but answers',
      effect: { kind: 'collect', days: 1 },
    },
    { id: 'leave', label: 'Log the contact and stand off', effect: { kind: 'dismiss' } },
  ],
}

const memory: SceneTemplate = {
  id: 'memory',
  variants: [
    (ctx) => [
      { speaker: null, text: `Nothing hails the ship at ${ctx.system.name}. The prompt comes from inside it.` },
      { speaker: 'science', text: `“Captain, this system. I have seen this sky before, or something close to it. Give me a watch with the old survey logs and I will pin it down.”` },
    ],
    (ctx) => [
      { speaker: null, text: `${ctx.system.name} resolves in the forward ports, and somebody on the bridge goes quiet mid-sentence.` },
      { speaker: 'science', text: `“That configuration. I have read about this place, Captain, before we were taken. Let me work it up against the library properly before I say anything I cannot stand behind.”` },
    ],
    (ctx) => [
      { speaker: null, text: `The night watch logs it first: a junior rating standing too long at the mess viewport, ${where(ctx)}, sketching the starfield on a ration wrapper from memory.` },
      { speaker: 'medical', text: `“They came to me about the dreams before anyone saw the sketch, Captain. I do not think this is trauma. I think they are remembering a chart they learned years ago, and it is coming back in pieces.”` },
      { speaker: 'science', text: `“Then we do it properly. Controlled sessions, everything cross-checked against the survey library. If it holds up, it goes on the plot like anything else we paid for.”` },
    ],
    (ctx) => [
      { speaker: null, text: `${ctx.system.name} is on no chart aboard, but the ship's own survey library flags a partial match, buried in an appendix nobody has opened since the anomaly.` },
      { speaker: 'science', text: `“Somebody aboard annotated this appendix years ago, Captain, and the handwriting is one of ours. Between the margin notes and what they still remember, I think we can assemble a real account of this sky.”` },
    ],
  ],
  options: () => [
    {
      id: 'recall',
      label: 'Give them the watch',
      detail: '1 day · the recollection goes on the plot',
      effect: { kind: 'collect', days: 1 },
    },
    { id: 'later', label: 'Not now', effect: { kind: 'dismiss' } },
  ],
}

/* ------------------------------------------------------------------------ *
 * Hazardous families — the evidence is defended; the option is the mission.
 * ------------------------------------------------------------------------ */

const derelict: SceneTemplate = {
  id: 'derelict',
  variants: [
    (ctx) => [
      { speaker: null, text: `The contact at ${ctx.system.name} is a ship, and the ship is dead — cold hull, no rotation, running lights burned out years ago.` },
      { speaker: 'security', text: `“No power, no gravity, and no idea what the structure is doing. There is a log core in there somewhere, if it survived the cold.”` },
      { speaker: 'science', text: `“If the core survived, it is worth the walk, Captain. A ship's own log is the best account we are likely to get for free.”` },
    ],
    (ctx) => [
      { speaker: null, text: `${ctx.system.name}'s debris field has a centre: a hulk, holed and silent, keeping station where its crew left it.` },
      { speaker: 'security', text: `“I have cut into wrecks like this before, Captain. Most of it is slow and dull, and then something moves. My team, and I set the order of entry.”` },
    ],
    (ctx) => [
      { speaker: null, text: `The wreck at ${ctx.system.name} died under way: drive plume shadows are burned into the hull ahead of the breach, ${where(ctx)}. She was running from something when it caught her.` },
      { speaker: 'science', text: `“A ship that was running will have logged what it was running from, Captain. I would very much like to read that.”` },
      { speaker: 'security', text: `“And whatever holed her did it fast and clean. I want that on the record before anyone calls this wreck safe.”` },
    ],
  ],
  options: () => [
    { id: 'plan', label: 'Plan the boarding', detail: 'Choose the team and the approach', effect: { kind: 'mission' } },
    { id: 'hold', label: 'Stand off', detail: 'The log stays where it is', effect: { kind: 'dismiss' } },
  ],
}

const ruins: SceneTemplate = {
  id: 'ruins',
  variants: [
    (ctx) => [
      { speaker: null, text: `The survey pass over ${ctx.system.name} finds right angles where geology makes none: stonework, half-buried, older than anyone's species.` },
      { speaker: 'science', text: `“There is writing down there, Captain. Whoever cut it was recording what they actually saw, which is more than I can say for most of our sources. I need to get close enough to read it.”` },
      { speaker: 'security', text: `“Unstable galleries, unknown ground. If we go, we go carefully.”` },
    ],
    (ctx) => [
      { speaker: null, text: `From orbit the structures at ${ctx.system.name} read as a single carved line kilometres long, ${where(ctx)}. It was cut to be legible from space, and most of it still is.` },
      { speaker: 'science', text: `“Whoever cut a line that size meant it to be read from orbit, Captain. The weathered sections need close work at the base, which means boots on the ground, and mine among them.”` },
      { speaker: 'medical', text: `“Masonry that old comes down without warning. I will have the medbay standing by.”` },
    ],
    (ctx) => [
      { speaker: null, text: `The ruins at ${ctx.system.name} are underwater — a drowned precinct in a shallow tidal sea, its galleries flooding and draining twice a day.` },
      { speaker: 'science', text: `“The water preserved the inscriptions, Captain, and it rules out every shortcut. The inner chamber drains at low tide and fills again a few hours later. We work in that window or not at all.”` },
      { speaker: 'security', text: `“A clock on the mission before we have even landed. Wonderful. Team stays roped, and nobody chases an artefact into a gallery that is filling.”` },
    ],
  ],
  options: () => [
    { id: 'plan', label: 'Plan the expedition', detail: 'Choose the team and the approach', effect: { kind: 'mission' } },
    { id: 'hold', label: 'Mark it and stand off', effect: { kind: 'dismiss' } },
  ],
}

const holdout: SceneTemplate = {
  id: 'holdout',
  variants: [
    (ctx) => [
      { speaker: null, text: `Somebody answers the hail at ${ctx.system.name} with a warning shot across the wideband and a demand that the ship keep its distance.` },
      { speaker: 'security', text: `“Barricaded and armed, Captain, and frightened with it. People who have held a line that long usually know what they were holding it against.”` },
      { speaker: 'medical', text: `“There will be wounded in there, Captain. There always are. That gives us something to offer them.”` },
    ],
    (ctx) => [
      { speaker: null, text: `The mining habitat at ${ctx.system.name} has sealed its docking ring from the inside. Through the wideband static, ${where(ctx)}, a voice counts off a perimeter warning on a loop. It sounds young, and it sounds exhausted.` },
      { speaker: 'security', text: `“That warning has been on a loop so long the voice has gone hoarse re-recording it, Captain. They have been under siege before, or believe they have, and they will read us as the next one.”` },
      { speaker: 'medical', text: `“That voice is exhausted, Captain. Whatever else is behind that ring, somebody in there is at the end of themselves. I would rather we arrived as help.”` },
    ],
    (ctx) => [
      { speaker: null, text: `${ctx.system.name}'s survivors hold a gutted orbital yard — floodlights on the approaches, welded plate over every window, and a flag nobody recognises painted across the main doors.` },
      { speaker: 'science', text: `“They have watched the rift from that yard for years, Captain, and nobody keeps records like that any more. They stayed for it. They will not hand it over for nothing.”` },
      { speaker: 'security', text: `“Every yard like that has an approach the people inside have stopped thinking about. Give me an hour with the schematics before you choose how we do this.”` },
    ],
  ],
  options: () => [
    { id: 'plan', label: 'Plan the approach', detail: 'Choose the team and how you go in', effect: { kind: 'mission' } },
    { id: 'hold', label: 'Keep our distance', effect: { kind: 'dismiss' } },
  ],
}

const listeningPost: SceneTemplate = {
  id: 'listening-post',
  variants: [
    (ctx) => [
      { speaker: null, text: `${ctx.system.name} is transmitting, and not to the ship. An automated station, old and still powered, repeating itself into the dark for nobody at all.` },
      { speaker: 'science', text: `“That loop has structure, Captain. Somebody built this thing to listen to the rift, and it has been listening a very long time.”` },
      { speaker: 'security', text: `“Old and still drawing power, Captain. Whoever left it may well have rigged it against visitors.”` },
    ],
    (ctx) => [
      { speaker: null, text: `Three antenna spines rise off the ice moon at ${ctx.system.name}, ${where(ctx)}, all three aimed at the same empty point in the sky. The station beneath them still draws power. Nothing has answered it in centuries.` },
      { speaker: 'science', text: `“It is asking something, Captain, not announcing it. The same signal on the same schedule, aimed at the same coordinates. Whatever came back is in that core, and I would like to read it.”` },
      { speaker: 'security', text: `“Stations like that are usually left with something watching the door, Captain. We sweep the approaches before anyone touches the core.”` },
    ],
    (ctx) => [
      { speaker: null, text: `The signal at ${ctx.system.name} is hidden inside the pulsar's own beat: a listening post tucked under the loudest thing in this sky by somebody who did not want it found.` },
      { speaker: 'security', text: `“Something hidden that carefully is usually defended to match, Captain. Whoever put it there was expecting the wrong sort of visitor.”` },
      { speaker: 'science', text: `“And it has been recording the rift under that cover ever since. The archive should be clean. It is worth a careful walk, Captain.”` },
    ],
  ],
  options: () => [
    { id: 'plan', label: 'Plan the entry', detail: 'Choose the team and the approach', effect: { kind: 'mission' } },
    { id: 'hold', label: 'Log the signal and stand off', effect: { kind: 'dismiss' } },
  ],
}

/* ------------------------------------------------------------------------ *
 * Recruitment — somebody at the station wants a berth.
 * ------------------------------------------------------------------------ */

const RECRUIT_PITCH: Record<string, { intro: string; pitch: string }> = {
  gunnery: {
    intro: 'is leaning on the dock rail watching your gun mounts with a professional eye',
    pitch:
      '“Those mounts are laid half a degree lazy, Captain. I could see it from the dock. I have run fire control on three hulls and I would like a fourth. Take me on and your volleys land harder.”',
  },
  research: {
    intro: 'finds your science officer first, and the two of them are already arguing methodology',
    pitch:
      '“Your bench is doing months of work with one pair of hands, Captain. I have spent eleven years on rift-adjacent research and nowhere to publish any of it. Take me on and everything on that bench finishes sooner.”',
  },
  comms: {
    intro: 'addresses your comms array in three languages before switching, politely, to yours',
    pitch:
      '“I read every script in this sector, Captain, and most of the dead ones. What your translation matrix takes a day over, I can do in an afternoon. And I would very much like to be somewhere else.”',
  },
}

/** Cast per site from state.recruits; not part of the static family tables. */
function recruitScene(state: GameState, systemId: string, system: StarSystem): SceneInstance {
  const specialist = state.recruits.sites[systemId]!
  const flavour = RECRUIT_PITCH[specialist.focus]!
  const figure: SceneFigure = {
    name: specialist.name,
    label: 'Looking for a berth',
    portrait: specialist.portrait,
  }
  return {
    at: systemId,
    templateId: 'recruit',
    figure,
    beats: [
      {
        speaker: null,
        text: `Dockside at ${system.name}, somebody ${flavour.intro}.`,
      },
      { speaker: 'figure', text: flavour.pitch },
    ],
    options: [
      {
        id: 'sign',
        label: `Take ${specialist.name} on`,
        detail: '1 day of orientation · their bonus is permanent',
        effect: { kind: 'recruit' },
      },
      { id: 'decline', label: 'Wish them luck ashore', effect: { kind: 'dismiss' } },
    ],
  }
}

/* ------------------------------------------------------------------------ *
 * The gateway threshold — the finale is a place, not a screen-swap (R9).
 * ------------------------------------------------------------------------ */

/**
 * Cast when the ship stands at the gateway with the Long Jump proven right:
 * the arrival is the run's last scene, and its commit option performs the
 * transit. Standing off is allowed, and the inspector's openScene brings
 * the threshold back.
 */
function gatewayScene(state: GameState, system: StarSystem): SceneInstance {
  const officer = {} as Record<OfficerRole, string>
  for (const role of ['captain', 'security', 'science', 'medical'] as OfficerRole[]) {
    officer[role] = shortName(state.roster.find((o) => o.role === role), `the ${role} officer`)
  }
  const failed = state.jumps.filter((j) => !j.correct).length

  return {
    at: system.id,
    templateId: 'gateway',
    figure: null,
    beats: [
      {
        speaker: null,
        text:
          `${system.name}. The drive spools down and nobody speaks, because the forward ports are ` +
          `full of it: the rift's far mouth, standing open in the dark exactly where the plot said ` +
          `it would be. The anomaly that swallowed the ship has a far side, and it is right ` +
          `there.`,
      },
      {
        speaker: 'science',
        text:
          `“Telemetry confirms it, Captain. The structure matches the signature we came in on, ` +
          `inverted. The shielding will hold and the drive will answer. This is the one.”` +
          (failed > 0 ? ` A pause. “This time.”` : ''),
      },
      {
        speaker: 'security',
        text: `“Approach is clear on every board, Captain. Nothing out there is moving on us.”`,
      },
      {
        speaker: 'medical',
        text:
          `“The whole ship's company is on the bridge, Captain. I did not order them here and neither ` +
          `did you. Say the word where they can hear it.”`,
      },
    ],
    options: [
      {
        id: 'commit',
        label: 'Take everyone home',
        detail: 'The transit home',
        effect: { kind: 'transit' },
      },
      {
        id: 'hold',
        label: 'Hold at the threshold',
        detail: 'Hold position and go when you are ready',
        effect: { kind: 'dismiss' },
      },
    ],
  }
}

/** Whether the run stands at its proven doorway: the last scene casts. */
function atProvenGateway(state: GameState, systemId: string): boolean {
  return (
    systemId === state.mystery.gateway &&
    state.ship.at === systemId &&
    state.jumps.some((j) => j.correct)
  )
}

/* ------------------------------------------------------------------------ */

const SOCIAL_FAMILIES: Partial<Record<ClueSourceKind, SceneTemplate>> = {
  'alien-trader': trader,
  'faction-archive': archive,
  castaway,
  'crew-memory': memory,
}

const SITE_FAMILIES: Record<string, SceneTemplate> = {
  derelict,
  ruins,
  holdout,
  'listening-post': listeningPost,
}

function cluesWaitingAt(state: GameState, systemId: string): Clue[] {
  return state.mystery.clues.filter(
    (clue) => clue.source.at === systemId && !state.collected.includes(clue.id),
  )
}

/**
 * The template family a system's evidence casts, judged from the run's
 * static clue placement (collected or not), so the answer never shifts
 * mid-run.
 */
function familyIdFor(state: GameState, systemId: string): string | null {
  const clues = state.mystery.clues.filter((c) => c.source.at === systemId)
  if (clues.length === 0) return null
  const site = dominantSite(clues.map((c) => c.source.kind))
  if (site) return SITE_FAMILIES[site.type]!.id
  return (SOCIAL_FAMILIES[clues[0]!.source.kind] ?? castaway).id
}

/**
 * Variant rotation (R9): each system that casts a family gets that family's
 * next variant in a fixed order, so one run never replays the same beats
 * until a family has more systems than the pool holds. Pure per seed — the
 * ordinal comes from the static clue placement, so replays are unaffected
 * by collection order.
 */
function variantIndex(state: GameState, templateId: string, systemId: string, count: number): number {
  const systems = new Set<string>()
  for (const clue of state.mystery.clues) systems.add(clue.source.at)
  const family = [...systems].filter((id) => familyIdFor(state, id) === templateId).sort()
  const ordinal = family.indexOf(systemId)
  return ordinal < 0 ? 0 : ordinal % count
}

/**
 * Cast the scene for the ship's current position, or null when the system
 * holds nothing (searched systems and empty space stay quiet on purpose —
 * silence has to keep meaning something).
 */
export function castScene(state: GameState, systemId: string): SceneInstance | null {
  const system = state.galaxy.systems.find((s) => s.id === systemId)
  if (!system) return null

  // The threshold outranks everything: once the Long Jump has proven the
  // gateway, arriving there plays the finale, whatever else the system held.
  if (atProvenGateway(state, systemId)) return gatewayScene(state, system)

  const clues = state.searched.includes(systemId) ? [] : cluesWaitingAt(state, systemId)
  if (clues.length === 0) {
    // No evidence (left) here — but a station may still hold a recruit.
    if (state.recruits.sites[systemId]) return recruitScene(state, systemId, system)
    return null
  }

  const site = dominantSite(clues.map((c) => c.source.kind))
  const template = site
    ? SITE_FAMILIES[site.type]!
    : (SOCIAL_FAMILIES[clues[0]!.source.kind] ?? castaway)

  const rng = createRng(`${state.seed}:scene:${systemId}`)
  const figure = template.figure ? template.figure(rng) : null

  const officer = {} as Record<OfficerRole, string>
  for (const role of ['captain', 'security', 'science', 'medical'] as OfficerRole[]) {
    officer[role] = shortName(state.roster.find((o) => o.role === role), `the ${role} officer`)
  }

  const ctx: CastContext = { system, clues, site, officer, figure, rng }
  const variant = variantIndex(state, template.id, systemId, template.variants.length)
  const beats = template.variants[variant]!(ctx)

  // A component waiting here is worth a line of its own: the science officer
  // flags it, so the player knows this stop feeds the technological track.
  for (const component of state.parts.sites[systemId] ?? []) {
    beats.push({
      speaker: 'science',
      text:
        component === 'engine'
          ? '“And Captain, the survey return shows drive machinery down there that no yard in this sector built. That is a core segment. If we are ever going to build the rift drive, we do not leave without it.”'
          : '“One more thing on the scan, Captain. Lattice-work with rift-grade shielding signatures. That is a segment the return transit needs. We should not leave without it.”',
    })
  }

  return {
    at: systemId,
    templateId: template.id,
    figure,
    beats,
    options: template.options(ctx),
  }
}
