import type { EncounterDef } from './types.js'

/**
 * The authored encounter catalog.
 *
 * Adapted from the Starship Explorer narrative pack (docs/ENCOUNTERS.md maps
 * every entry back to its pack number). Each encounter is a small dialogue
 * graph; the connected ones schedule follow-ups or set flags that later
 * encounters read. Weight 0 marks a follow-up-only encounter that never
 * fires at random.
 *
 * House rules for authoring:
 *  - Requirements are visible, never hidden: a locked choice shows its lock.
 *  - The dice may pick an outcome, but every outcome is survivable-by-design
 *    except where the prose promises otherwise.
 *  - Intelligence is the true payout. Fuel and supplies keep the ship
 *    moving; data, standing and shared clues get it home.
 */

const P = (file: string) => `/assets/encounters/${file}`

const ROUTE_ARC: EncounterDef[] = [
  /* ======================================================================
   * I. The Lost Course — openers and route intelligence   (pack 001–030)
   * ==================================================================== */

  // Pack 001 — The Star That Should Not Be Here
  {
    id: 'blue-star',
    title: 'The Star That Should Not Be Here',
    tag: 'key',
    backdrop: 'space',
    weight: 26,
    when: { maxDay: 30 },
    entry: 'start',
    nodes: {
      start: {
        text: [
          'Long-range astrometry flags a blue giant that is on no chart aboard — not the ship’s, not the packet libraries, not the memory of anyone standing watch. Its pulsation is wrong in a way the computer keeps underlining: a flicker repeating with an interval no natural star keeps.',
          'The interval is artificial. Something set that star ticking, and anything that ticks can be read.',
        ],
        choices: [
          {
            id: 'decode',
            label: 'Put the science team on the pulse until it gives',
            needs: { officer: 'science' },
            results: [
              [
                70,
                {
                  text: [
                    'Two watches of spectrometry and the pulse unfolds into a timing lattice — a survey datum, planted by whoever mapped this region first. It bears directly on the way home.',
                    'As the analysis completes, a second, fainter tick starts up somewhere in the dark. Something dormant has noticed the ship listening.',
                  ],
                  shareClues: 1,
                  data: 2,
                  flagsSet: ['buoy-woken'],
                  followUp: { id: 'the-listener', days: [4, 9] },
                },
              ],
              [
                30,
                {
                  text: [
                    'The pulse unfolds into a timing lattice — a survey datum from whoever mapped this region first, filed straight to the plot.',
                  ],
                  shareClues: 1,
                  data: 2,
                },
              ],
            ],
          },
          {
            id: 'log',
            label: 'Log the anomaly and keep your distance',
            results: [
              [
                100,
                {
                  text: [
                    'The star goes in the catalogue with three question marks against it. Whatever is ticking out there, it can tick without the Ithaca in earshot.',
                  ],
                  data: 1,
                },
              ],
            ],
          },
        ],
      },
    },
  },

  // Follow-up to blue-star: the listening buoy comes calling.
  {
    id: 'the-listener',
    title: 'The Listener',
    tag: 'event',
    backdrop: 'space',
    weight: 0,
    entry: 'start',
    nodes: {
      start: {
        text: [
          'It has been pacing the ship for two jumps before sensors finally resolve it: a buoy, older than any human institution, matching course at forty kilometres. It is transmitting the Ithaca’s own drive signature — slowly, methodically — to somewhere coreward.',
        ],
        choices: [
          {
            id: 'answer',
            label: '[semantic comms] Answer it in its own timing code',
            needs: { tech: 'comms-semantic' },
            results: [
              [
                100,
                {
                  text: [
                    'The buoy stops transmitting. A long pause — geological, considered — and then it empties its memory into the comms array: every ship it has logged in ten thousand years, and the heading each one left by. One of those headings matters very much.',
                  ],
                  shareClues: 1,
                  data: 4,
                  flagsSet: ['listener-friend'],
                },
              ],
            ],
          },
          {
            id: 'jam',
            label: 'Jam its uplink and study it from a distance',
            needs: { officer: 'science' },
            results: [
              [
                100,
                {
                  text: [
                    'The jammer holds. The buoy circles, puzzled in some mineral way, and the science team strips its protocol stack for three days of good material before it gives up and drifts off station.',
                  ],
                  data: 5,
                },
              ],
            ],
          },
          {
            id: 'destroy',
            label: 'Burn it out of the sky',
            results: [
              [
                100,
                {
                  text: [
                    'One volley and the buoy is vapour and grief. Whatever it was reporting to will notice the silence eventually — and silence, to a listening network, is also a message.',
                  ],
                  war: 1,
                },
              ],
            ],
          },
        ],
      },
    },
  },

  // Pack 004 / 006 — The First False Beacon, and the voice that follows it.
  {
    id: 'false-beacon',
    title: 'The First False Beacon',
    tag: 'key',
    backdrop: 'space',
    weight: 22,
    when: { maxDay: 45 },
    entry: 'start',
    nodes: {
      start: {
        text: [
          'A distress beacon, human-format, on the emergency band nobody out here should know exists. It promises a direct corridor to settled space — coordinates, lane data, the works — and it repeats with absolute, machined regularity.',
          'The timestamps are centuries old. Every repetition is identical to the last, down to the static.',
        ],
        choices: [
          {
            id: 'follow',
            label: 'Follow the signal to its source',
            results: [
              [
                100,
                {
                  text: [
                    'The source is a hull. It is almost the Ithaca’s hull — the proportions subtly wrong, like a description of a ship rather than a ship. It stops pretending the moment the range closes, and the emergency band fills with something that is not static.',
                  ],
                  combat: {
                    enemy: 'corsair',
                    rewards: {
                      data: 4,
                      text: 'The mimic’s shell breaks apart into glittering, purposeless geometry. Some of it is worth taking aboard.',
                      flagsSet: ['mimic-met'],
                    },
                    withdrawFollowUp: { id: 'echo-hunt', days: [8, 16] },
                  },
                },
              ],
            ],
          },
          {
            id: 'study',
            label: 'Study the signal without approaching',
            needs: { officer: 'science' },
            results: [
              [
                100,
                {
                  text: [
                    'Taken apart, the beacon is a lure — a mimetic intelligence fishing for ships that want to go home badly enough to stop checking timestamps. The lure’s grammar is itself a map of what it knows about human hope, and that is worth studying.',
                    'Three nights later, the comms watch reports the beacon has stopped repeating. It has started composing.',
                  ],
                  data: 5,
                  flagsSet: ['mimic-studied'],
                  followUp: { id: 'beacon-voice', days: [6, 12] },
                },
              ],
            ],
          },
          {
            id: 'silence',
            label: 'Torpedo the beacon and post a warning marker',
            results: [
              [
                100,
                {
                  text: [
                    'The beacon dies mid-repetition. In its place the ship leaves an honest marker: DO NOT ANSWER. Somewhere behind the sky, something patient crosses one lure off a very long list.',
                  ],
                },
              ],
            ],
          },
        ],
      },
    },
  },

  {
    id: 'beacon-voice',
    title: 'A Message in Our Own Voice',
    tag: 'key',
    backdrop: 'space',
    weight: 0,
    entry: 'start',
    nodes: {
      start: {
        text: [
          'The new transmission finds the ship at the edge of the system, and it is not a beacon this time. It is a voice — a crew member’s voice, pitch-perfect, speaking coordinates and then, softly: “Do not cross the white system. You already know why.”',
          'Authentication passes. That should not be possible.',
        ],
        choices: [
          {
            id: 'parse',
            label: '[semantic comms] Strip the mimicry and read what is underneath',
            needs: { tech: 'comms-semantic' },
            results: [
              [
                100,
                {
                  text: [
                    'Underneath the borrowed voice is structure: the mimic builds its lures from real navigational data, and real data can be recovered. The lie is discarded; the chart it was built on is kept.',
                  ],
                  shareClues: 1,
                  data: 3,
                  flagsSet: ['mimic-read'],
                },
              ],
            ],
          },
          {
            id: 'refuse',
            label: 'Cut the channel. The ship does not talk to ghosts',
            results: [
              [
                100,
                {
                  text: [
                    'The channel dies. For a long minute nothing happens, and then every screen on the bridge shows the same three words — COME AND SEE — before returning to normal.',
                    'Whatever it is, it has stopped fishing. It is following.',
                  ],
                  followUp: { id: 'echo-hunt', days: [8, 15] },
                },
              ],
            ],
          },
        ],
      },
    },
  },

  {
    id: 'echo-hunt',
    title: 'The Echo',
    tag: 'hostile',
    backdrop: 'space',
    weight: 0,
    when: { flagsNone: ['echo-dead'] },
    entry: 'start',
    nodes: {
      start: {
        text: [
          'It drops onto the scope already inside weapons range, and this time it has stopped imitating anything. The hull is a suggestion of every ship it has ever eaten, and the emergency band is screaming in fourteen dead crews’ voices at once.',
          'There is no hail. There was never going to be a hail.',
        ],
        choices: [
          {
            id: 'fight',
            label: 'Battle stations',
            results: [
              [
                100,
                {
                  text: ['The Ithaca turns to face the thing wearing her silhouette.'],
                  combat: {
                    enemy: 'echo',
                    rewards: {
                      data: 8,
                      shareClues: 1,
                      text:
                        'The Echo comes apart into a cloud of stolen geometry. In the wreckage: the navigational cores of every ship it ever lured — and one of them knew the way.',
                      flagsSet: ['echo-dead'],
                    },
                    withdrawFollowUp: { id: 'echo-hunt', days: [10, 20] },
                  },
                },
              ],
            ],
          },
        ],
      },
    },
  },

  // Pack 005 — Parallax: a three-station navigation programme.
  {
    id: 'parallax-1',
    title: 'Parallax — First Station',
    tag: 'mission',
    portrait: P('35_human_astrophysicist.jpg'),
    backdrop: 'space',
    weight: 16,
    when: { features: ['pulsar'], flagsNone: ['parallax-1'] },
    entry: 'start',
    nodes: {
      start: {
        speaker: 'Dr. Ilsa Reyne, itinerant astrophysicist',
        text: [
          'The shuttle that hails you is one bad seal away from being a museum piece, and the woman aboard it does not bother introducing herself before she starts talking mathematics.',
          '“Stellar drift, captain. Home is not lost — it is *mislaid*, and three widely separated observations will find it by parallax. This pulsar is the first usable baseline I have seen in a year. Hold station through the radiation window and give me your sensor mast, and I will give you a number nobody can lie to you about.”',
        ],
        choices: [
          {
            id: 'hold',
            label: 'Hold station through the radiation window',
            results: [
              [
                65,
                {
                  text: [
                    'Six hours in the pulsar’s strobe with the deflectors singing. The observation lands clean: one leg of the triangle fixed, two to go. Reyne transmits her working and her thanks, and asks the ship to find her another dead star.',
                  ],
                  data: 3,
                  flagsSet: ['parallax-1'],
                },
              ],
              [
                35,
                {
                  text: [
                    'The window turns hard partway through — a flare front the forecasts missed. The observation lands, but the ship takes a beating holding the mast steady, and the medbay takes a customer.',
                  ],
                  data: 3,
                  hull: -3,
                  injureOfficer: true,
                  flagsSet: ['parallax-1'],
                },
              ],
            ],
          },
          {
            id: 'decline',
            label: 'Decline — the ship has somewhere to be',
            results: [
              [
                100,
                {
                  text: [
                    '“Then somebody else’s captain will get the number,” Reyne says, without heat, and puts her ruin of a shuttle about. The offer, presumably, remains open wherever pulsars do.',
                  ],
                },
              ],
            ],
          },
        ],
      },
    },
  },

  {
    id: 'parallax-2',
    title: 'Parallax — Second Station',
    tag: 'mission',
    portrait: P('35_human_astrophysicist.jpg'),
    backdrop: 'space',
    weight: 20,
    when: { features: ['pulsar'], flagsAll: ['parallax-1'], flagsNone: ['parallax-2'] },
    entry: 'start',
    nodes: {
      start: {
        speaker: 'Dr. Ilsa Reyne, itinerant astrophysicist',
        text: [
          'Reyne’s shuttle is already in-system when the Ithaca arrives — she has been following the survey registers, and the registers have been following you.',
          '“Second baseline, captain. The geometry is good. One more window like this and the triangle closes.”',
        ],
        choices: [
          {
            id: 'hold',
            label: 'Hold station for the second observation',
            results: [
              [
                70,
                {
                  text: [
                    'The second leg lands cleaner than the first — the crews know the drill now, and Reyne has stopped pretending she is not enjoying herself. One station remains.',
                  ],
                  data: 3,
                  flagsSet: ['parallax-2'],
                },
              ],
              [
                30,
                {
                  text: [
                    'A gravitational shear mid-window costs the ship paint and plating, but the number is worth more than either. One station remains.',
                  ],
                  data: 3,
                  hull: -3,
                  flagsSet: ['parallax-2'],
                },
              ],
            ],
          },
          {
            id: 'decline',
            label: 'Not this time',
            results: [
              [100, { text: ['Reyne nods as if she expected nothing else, and waits. Pulsars are patient. So, apparently, is she.'] }],
            ],
          },
        ],
      },
    },
  },

  {
    id: 'parallax-3',
    title: 'Parallax — The Triangle Closes',
    tag: 'mission',
    portrait: P('35_human_astrophysicist.jpg'),
    backdrop: 'space',
    weight: 24,
    when: { features: ['pulsar'], flagsAll: ['parallax-2'], flagsNone: ['parallax-3'] },
    entry: 'start',
    nodes: {
      start: {
        speaker: 'Dr. Ilsa Reyne, itinerant astrophysicist',
        text: [
          '“Third baseline. Last one.” Reyne’s voice has gone quiet in the way of people arriving somewhere they have spent years walking. “Hold the ship steady, captain, and when the window closes I will tell you where your sun is.”',
        ],
        choices: [
          {
            id: 'hold',
            label: 'Close the triangle',
            results: [
              [
                100,
                {
                  text: [
                    'The third observation lands, the mathematics converges, and Reyne reads the result twice before she trusts her own instruments. It is not a door — but it is a *bearing*, real and checkable, and it cuts the lying half of the sky away at a stroke.',
                    '“Whatever the traders sold you,” she says, “test it against this.”',
                  ],
                  shareClues: 2,
                  data: 6,
                  flagsSet: ['parallax-3'],
                },
              ],
            ],
          },
        ],
      },
    },
  },

  // Pack 025 — The Near-Home System
  {
    id: 'near-home',
    title: 'The Near-Home System',
    tag: 'key',
    backdrop: 'space',
    weight: 16,
    when: { minDay: 55 },
    entry: 'start',
    nodes: {
      start: {
        text: [
          'It is everything the long watches have prayed for. Radio chatter in human bands. Familiar constellations, only slightly askew. An ice giant exactly where an ice giant should be. Half the bridge crew is crying, quietly, at their stations.',
          'The science station, alone, is frowning: the chatter loops. The constellations are correct — for a chart four centuries stale.',
        ],
        choices: [
          {
            id: 'analyse',
            label: 'Run the whole system through deep analysis before anyone celebrates',
            needs: { officer: 'science' },
            results: [
              [
                100,
                {
                  text: [
                    'It is a reconstruction — a lovingly detailed, planet-scale forgery of the approaches to human space, built by something that wants searching ships to stop searching. The heartbreak on the bridge is physical.',
                    'But a forgery this good is a confession: whoever built it *knew the original*. The errors in the fake are a map of what they knew, and when.',
                  ],
                  data: 6,
                  shareClues: 1,
                  flagsSet: ['near-home-seen'],
                },
              ],
            ],
          },
          {
            id: 'believe',
            label: 'Let the crew have this. Signal home',
            results: [
              [
                100,
                {
                  text: [
                    'For one whole day the Ithaca is a happy ship, and the logs record it faithfully. Then the reply comes back — the ship’s own signal, replayed, note-perfect — and the day ends worse than it began.',
                    'Nothing lives here. Nothing ever did. Something merely remembers what living sounded like.',
                  ],
                  data: 2,
                  flagsSet: ['near-home-seen'],
                },
              ],
            ],
          },
        ],
      },
    },
  },
]

/* ========================================================================
 * II. Contacts, cultures and traders            (pack 007, 047, 052, 056,
 *                                                062, 020, 081, 034, 198…)
 * ====================================================================== */

const CONTACTS: EncounterDef[] = [
  // Pack 007 — A Map Made of Songs
  {
    id: 'song-map',
    title: 'A Map Made of Songs',
    tag: 'contact',
    portrait: P('05_insectoid_navigator.jpg'),
    backdrop: 'space',
    culture: 'flotilla',
    weight: 20,
    entry: 'start',
    nodes: {
      start: {
        speaker: 'Sess-of-the-Long-Interval, Flotilla navigator',
        text: [
          'The convoy resolves out of the dark like weather: forty mismatched hulls flying in a slow braid, and every one of them singing. The comms array renders it as music because the comms array does not know any better.',
          'Their navigator’s envoy — a stick-thin figure whose forelimbs beat time as it speaks — hangs in the airlock camera. “You fly silent, chart-poor, and in the wrong key entirely. Listen, if you like. The song is long and it is mostly true.”',
        ],
        choices: [
          {
            id: 'listen',
            label: 'Listen politely and record what you can',
            results: [
              [
                100,
                {
                  text: [
                    'Six hours of harmony wash over the recorders. Most of it is opaque — but the shape of it, the way verses avoid certain volumes of sky, is itself information. The convoy dips its running lights in farewell.',
                  ],
                  data: 2,
                  standing: { flotilla: 1 },
                },
              ],
            ],
          },
          {
            id: 'verse',
            label: 'Attempt a verse of your own',
            results: [
              [
                50,
                {
                  text: [
                    'The bridge crew improvises a rendering of the ship’s course as melody. It is clumsy, honest, and — by whatever standard the Flotilla keeps — *funny*. Laughter in forty hulls sounds like rain. The navigator corrects your pitch, and in correcting it, corrects your chart.',
                  ],
                  shareClues: 1,
                  standing: { flotilla: 2 },
                },
              ],
              [
                50,
                {
                  text: [
                    'The attempt lands wrong — a cadence that, it turns out, mourns the death of an eldest navigator. The convoy goes silent, hull by hull, and leaves without another note.',
                  ],
                  standing: { flotilla: -1 },
                },
              ],
            ],
          },
          {
            id: 'notation',
            label: '[choral notation] Transcribe the song into a working chart',
            needs: { tech: 'comms-choral' },
            results: [
              [
                100,
                {
                  text: [
                    'With the notation engine running, the music stops being music. Distances arrive as intervals, gravity shadows as dissonance, and one long central theme as a route the Flotilla has been singing, and refining, for a thousand years.',
                    'The navigator watches the transcription scroll past on your screen, and beats its forelimbs in something that is unmistakably applause.',
                  ],
                  shareClues: 1,
                  data: 4,
                  standing: { flotilla: 1 },
                },
              ],
            ],
          },
        ],
      },
    },
  },

  // Pack 004-adjacent trade — the gasbag merchant.
  {
    id: 'gasbag-trader',
    title: 'The Envelope Merchant',
    tag: 'contact',
    portrait: P('04_gasbag_trader.jpg'),
    backdrop: 'space',
    weight: 14,
    unique: false,
    when: { features: ['gas-giant'] },
    entry: 'start',
    nodes: {
      start: {
        speaker: 'Vollo, envelope merchant',
        text: [
          'The trader lives in the gas giant’s upper deck the way a spider lives in a web, and its ship is mostly balloon. It sells what it skims and buys what it cannot make: refined fuel by the tonne, and information by the gram.',
          '“Tanks or telemetry, captain. Everything else is sentiment.”',
        ],
        choices: [
          {
            id: 'buy-fuel',
            label: 'Trade survey data for fuel',
            spend: { data: 3 },
            results: [
              [
                100,
                {
                  text: [
                    'Vollo takes the survey take with evident satisfaction and pumps the tanks generously in return. “A pleasure. Data keeps. Fuel, less so.”',
                  ],
                  fuel: 15,
                },
              ],
            ],
          },
          {
            id: 'sell-fuel',
            label: 'Sell 10 fuel for its market gossip',
            spend: { fuel: 10 },
            results: [
              [
                100,
                {
                  text: [
                    'The gossip is better than gossip: convoy schedules, patrol rotations, and which archives changed hands this season — the raw stock of intelligence work.',
                  ],
                  data: 5,
                },
              ],
            ],
          },
          {
            id: 'decline',
            label: 'Nothing today',
            results: [[100, { text: ['Vollo deflates a few per cent, which may be a shrug, and drifts back down into the weather.'] }]],
          },
        ],
      },
    },
  },

  // Pack 052 — The Navigation Oracle
  {
    id: 'navigation-oracle',
    title: 'The Navigation Oracle',
    tag: 'contact',
    portrait: P('52_robot_navigation_oracle.jpg'),
    backdrop: 'station',
    culture: 'custodian',
    weight: 14,
    when: { minDay: 20 },
    entry: 'start',
    nodes: {
      start: {
        speaker: 'The Oracle of the Ninth Relay',
        text: [
          'It occupies a station older than agriculture, and it answers exactly one kind of question. Pilgrims of six species queue in the cold to ask it where things are. The fee, the queue-keepers explain, is whatever the Oracle says it is — and it is never money.',
          'The Oracle regards the Ithaca for a long time. “LOST,” it prints, in perfect antique typography. “ASK.”',
        ],
        choices: [
          {
            id: 'pay-fuel',
            label: 'Pay its price in fuel — 12 from the tank',
            spend: { fuel: 12 },
            results: [
              [
                100,
                {
                  text: [
                    'The fuel drains into tanks that predate your species, and the Oracle prints a single strip of paper: a bearing, a caveat, and a date four hundred years in the past on which both were last verified. It is real. It is filed.',
                  ],
                  shareClues: 1,
                },
              ],
            ],
          },
          {
            id: 'pay-data',
            label: 'Pay in kind — 8 data from the lab archives',
            spend: { data: 8 },
            results: [
              [
                100,
                {
                  text: [
                    'The Oracle drinks the survey archive in silence and prints its answer: a bearing, a caveat, and — unprompted — a correction to one of your own instruments’ calibration. It has been a while since it had fresh data. It appears to have enjoyed it.',
                  ],
                  shareClues: 1,
                  data: 2,
                },
              ],
            ],
          },
          {
            id: 'protocol',
            label: '[custodian protocol] Present credentials and ask as an operator, not a pilgrim',
            needs: { tech: 'comms-custodian' },
            results: [
              [
                100,
                {
                  text: [
                    'The queue-keepers stop breathing when the Oracle’s lights change. Operator protocol accepted. What follows is not a strip of paper but a *download* — network topology, relay states, and a debt: the Oracle names a favour, unspecified, to be collected when the network requires it.',
                  ],
                  shareClues: 2,
                  data: 4,
                  flagsSet: ['oracle-debt'],
                  followUp: { id: 'oracle-favour', days: [15, 30] },
                },
              ],
            ],
          },
          {
            id: 'leave',
            label: 'Leave the queue',
            results: [[100, { text: ['The Oracle does not watch you go. It has seen a great many ships decide their questions could wait.'] }]],
          },
        ],
      },
    },
  },

  {
    id: 'oracle-favour',
    title: 'The Oracle Calls In Its Debt',
    tag: 'key',
    portrait: P('52_robot_navigation_oracle.jpg'),
    backdrop: 'space',
    culture: 'custodian',
    weight: 0,
    entry: 'start',
    nodes: {
      start: {
        speaker: 'The Oracle of the Ninth Relay',
        text: [
          'The message arrives on the operator channel, and it is not a request. A relay of the ancient network in this volume is failing — drifting off its timing, poisoning the lattice the Oracle navigates by. The favour: carry a correction packet to it and hold station while it re-syncs.',
          'The relay sits in hard radiation, and the correction is not small.',
        ],
        choices: [
          {
            id: 'comply',
            label: 'Honour the debt — carry the correction (2 days)',
            results: [
              [
                100,
                {
                  text: [
                    'Two days in the radiation shadow while the relay drinks its correction and, tone by tone, comes back onto the beat. When it is done, the operator channel prints two words the queue-keepers would trade their lives for: DEBT PAID.',
                    'And then, after a pause: a gift, unasked — the relay’s own log of every gate transit it has ever timed.',
                  ],
                  days: 2,
                  hull: -2,
                  standing: { custodian: 2 },
                  data: 5,
                  flagsClear: ['oracle-debt'],
                  flagsSet: ['oracle-paid'],
                },
              ],
            ],
          },
          {
            id: 'refuse',
            label: 'Refuse. The ship owes machines nothing',
            results: [
              [
                100,
                {
                  text: [
                    'The channel closes without comment. Somewhere in the network, a ledger is amended, and every custodian machine from here to the rift now knows the Ithaca’s word is not good.',
                  ],
                  standing: { custodian: -2 },
                  flagsClear: ['oracle-debt'],
                },
              ],
            ],
          },
        ],
      },
    },
  },

  // Pack 056 — The Untranslatable Greeting
  {
    id: 'untranslatable',
    title: 'The Untranslatable Greeting',
    tag: 'contact',
    portrait: P('18_mirror_skinned_observer.jpg'),
    backdrop: 'space',
    weight: 16,
    entry: 'start',
    nodes: {
      start: {
        text: [
          'The vessel is a mirror — literally: the Ithaca’s own reflection slides across its hull as it closes. Its transmission, run through baseline translation, renders as: WE WILL TAKE EVERYTHING YOU ARE.',
          'The comms officer’s hand is over the alert key. The vessel is not raising shields. It is waiting.',
        ],
        choices: [
          {
            id: 'semantic',
            label: '[semantic comms] Re-parse the greeting before answering',
            needs: { tech: 'comms-semantic' },
            results: [
              [
                100,
                {
                  text: [
                    'The matrix turns the sentence over and finds it is a *ritual of humility*: “We will take everything you are — as our burden, as hosts.” It is the oldest welcome their culture has, offered to strangers in need.',
                    'The correct response is to accept. You accept. What follows is four hours of flawless, silent hospitality and a parting gift of charts.',
                  ],
                  shareClues: 1,
                  data: 3,
                  standing: { flotilla: 1 },
                },
              ],
            ],
          },
          {
            id: 'silent',
            label: 'Hold position and say nothing',
            results: [
              [
                100,
                {
                  text: [
                    'Silence, it turns out, is a legible answer: caution without insult. The mirror ship holds station for an hour, matching your silence exactly, then departs. The encounter goes in the xenology file as “survivable, unresolved.”',
                  ],
                  data: 1,
                },
              ],
            ],
          },
          {
            id: 'warn',
            label: 'Answer threat with threat — charge weapons',
            results: [
              [
                100,
                {
                  text: [
                    'The mirror hull reflects your own gunports back at you as they open. It transmits one more phrase — rendered, this time, with what the translator flags as *sadness* — and leaves at an acceleration nothing aboard can match.',
                    'Whatever was on offer, the region will hear it was refused at gunpoint.',
                  ],
                  standing: { flotilla: -1 },
                  war: 1,
                },
              ],
            ],
          },
        ],
      },
    },
  },

  // Pack 062 — The Trader Who Sells Regrets
  {
    id: 'regret-trader',
    title: 'The Trader Who Buys Regrets',
    tag: 'contact',
    portrait: P('46_robot_trade_automaton.jpg'),
    backdrop: 'station',
    weight: 12,
    when: { minDay: 12 },
    entry: 'start',
    nodes: {
      start: {
        speaker: 'BROKER-OF-RECORD, ancient trade automaton',
        text: [
          'The automaton’s hold is full of technology it cannot possibly have manufactured, and it does not take fuel, data or goods in payment. It takes *memories* — extracted cleanly, it insists, and resold to collectors who find organic experience the last luxury worth having.',
          '“Sell me a regret,” it offers. “You will not miss it. That is rather the point.”',
        ],
        choices: [
          {
            id: 'crew-memory',
            label: 'Allow one volunteer to sell a memory',
            results: [
              [
                100,
                {
                  text: [
                    'A volunteer steps forward — there is always a volunteer — and comes back an hour later lighter in a way that is hard to look at. The automaton pays in schematics, and pays well. In the mess that night, someone laughs at a joke they no longer remember being the subject of.',
                  ],
                  data: 8,
                },
              ],
            ],
          },
          {
            id: 'captain-memory',
            label: 'Sell one of your own — the displacement itself',
            results: [
              [
                100,
                {
                  text: [
                    'The automaton takes the memory of the anomaly — the light going wrong, the charts going blank — and for a moment you envy the buyer. The payment is extraordinary. The gap where the worst hour of your life used to be is exactly the wrong shape.',
                    'The log’s account of the displacement is now the only account you have.',
                  ],
                  data: 12,
                  flagsSet: ['captain-memory-sold'],
                },
              ],
            ],
          },
          {
            id: 'refuse',
            label: 'The ship’s memories are not stock',
            results: [
              [
                100,
                {
                  text: [
                    '“A common position,” the automaton says, without disappointment, “among species who have not yet understood what they carry.” It leaves its docking cradle open behind you, in case.',
                  ],
                },
              ],
            ],
          },
        ],
      },
    },
  },

  // Pack 198 — The Last Trader Before the Void
  {
    id: 'last-trader',
    title: 'The Last Trader Before the Void',
    tag: 'contact',
    portrait: P('34_human_frontier_trader.jpg'),
    backdrop: 'station',
    weight: 18,
    when: { regions: ['rift-margin'] },
    entry: 'start',
    nodes: {
      start: {
        speaker: 'Marta Voss, frontier trader',
        text: [
          'Her station is the last artificial light before the rift margin goes dark, and she knows it — the prices are apologetic and the coffee is not. Human, third-generation out here, and delighted to the point of suspicion to hear a human hail.',
          '“Stock’s thin, captain. I can do you fuel, I can do you the season’s intelligence, or I can do you the thing you actually want — a route fragment I took off a custodian pilgrim in settlement of a debt. Your stores will stretch to two of the three. Pick.”',
        ],
        choices: [
          {
            id: 'fuel-clue',
            label: 'The fuel and the route fragment',
            spend: { supplies: 15 },
            results: [
              [
                100,
                {
                  text: [
                    'The fragment is old, water-stained and real. Voss throws in the coffee. “Whatever you find out there,” she says, “come back and tell me the ending.”',
                  ],
                  fuel: 12,
                  shareClues: 1,
                },
              ],
            ],
          },
          {
            id: 'fuel-news',
            label: 'The fuel and the intelligence',
            spend: { supplies: 15 },
            results: [
              [100, { text: ['The season’s intelligence is dense and mercilessly practical: patrol schedules, failed colonies, which beacons lie. Voss’s marginalia alone are worth the price.'], fuel: 12, data: 6 }],
            ],
          },
          {
            id: 'news-clue',
            label: 'The intelligence and the route fragment',
            spend: { supplies: 15 },
            results: [
              [100, { text: ['Intelligence and the fragment together — Voss approves. “Fuel you can find. Knowing where to spend it, that’s the rare cargo.”'], data: 6, shareClues: 1 }],
            ],
          },
          {
            id: 'leave',
            label: 'The hold cannot spare the stores',
            results: [[100, { text: ['Voss waves you off without ceremony. “Margin’s margin. Fly safe, captain.”'] }]],
          },
        ],
      },
    },
  },

  // Pack 047 — Archive of forbidden coordinates
  {
    id: 'archive-keeper',
    title: 'The Archive Keeper',
    tag: 'contact',
    portrait: P('47_robot_archive_keeper.jpg'),
    backdrop: 'station',
    culture: 'custodian',
    weight: 14,
    when: { minDay: 25 },
    entry: 'start',
    nodes: {
      start: {
        speaker: 'KEEPER, of the Sealed Stacks',
        text: [
          'The archive is a mountain of cold storage orbiting a dead star, and its keeper has been refusing visitors for longer than your species has had writing. It does not refuse you. It simply explains, courteously, that the navigation stacks are *sealed*, and that seals exist for reasons.',
          '“You may petition. Most petitions are denied. All are remembered.”',
        ],
        choices: [
          {
            id: 'petition',
            label: '[custodian protocol] Petition under network protocol',
            needs: { tech: 'comms-custodian' },
            results: [
              [
                100,
                {
                  text: [
                    'The protocol stack identifies the Ithaca as an operating vessel of the network — displaced, but *of* it, by right of transit. The Keeper considers this for nine full minutes, then unseals one shelf.',
                    'On the shelf: the departure records of every vessel that ever left this region for the volume you call home.',
                  ],
                  shareClues: 2,
                  data: 3,
                  standing: { custodian: 1 },
                },
              ],
            ],
          },
          {
            id: 'intrude',
            label: 'Slice the stacks while the science team runs interference',
            needs: { officer: 'science' },
            results: [
              [
                55,
                {
                  text: [
                    'The intrusion works — barely. Three shelves of navigation records dump to the shuttle’s core before the counter-ice wakes, and the team is back aboard before the Keeper finishes turning around. It knows. Machines like this always know.',
                  ],
                  data: 7,
                  shareClues: 1,
                  standing: { custodian: -2 },
                },
              ],
              [
                45,
                {
                  text: [
                    'The counter-ice is older and colder than anything the team has met. It takes the slice attempt apart, takes the shuttle’s systems with it, and delivers the team back to the Ithaca unconscious in a courtesy skiff, with a note in perfect typography: DENIED.',
                  ],
                  injureOfficer: true,
                  standing: { custodian: -2 },
                },
              ],
            ],
          },
          {
            id: 'ask',
            label: 'Ask openly, as castaways',
            results: [
              [
                100,
                {
                  text: [
                    'The Keeper listens to the whole account — the anomaly, the dead charts, the long way round — without interrupting. Then: “Petition denied. The stacks remain sealed.” A pause. “The *index*, however, was never sealed.” The index alone is a season of leads.',
                  ],
                  data: 4,
                },
              ],
            ],
          },
        ],
      },
    },
  },

  // Pack 020 / 095 — war diplomacy, Vekar side.
  {
    id: 'chitin-queen',
    title: 'The Queen’s Dispatches',
    tag: 'war',
    portrait: P('20_chitin_diplomat_queen.jpg'),
    backdrop: 'station',
    culture: 'vekar',
    weight: 14,
    when: { factionSpace: true },
    entry: 'start',
    nodes: {
      start: {
        speaker: 'Sovereign-in-Waiting Cha’Vekh, Ascendancy envoy',
        text: [
          'The envoy receives you in a chamber grown, not built, and does not waste your time. The Ascendancy has noticed the Ithaca: unaligned, fast, and — her phrase — “inconveniently sympathetic to everyone.”',
          '“Carry my dispatches through the contested lanes, captain. Sealed, deniable, paid in advance. Or decline, and be merely another neutral we must plan around.”',
        ],
        choices: [
          {
            id: 'carry',
            label: 'Carry the dispatches — paid in fuel and favour',
            results: [
              [
                100,
                {
                  text: [
                    'The dispatches ride in the safe for three systems and leave without ceremony. The Ascendancy pays as promised and remembers as threatened. The Compact, whose signal analysts miss very little, also remembers.',
                  ],
                  fuel: 8,
                  data: 2,
                  standing: { vekar: 2, ostrea: -2 },
                },
              ],
            ],
          },
          {
            id: 'neutral',
            label: 'Decline, formally: the Ithaca is neutral and will stay so',
            results: [
              [
                100,
                {
                  text: [
                    'Cha’Vekh accepts the refusal with the grace of someone filing it for later. “Neutrality,” she observes, “is a course, captain. Courses can be corrected.” Still — formal neutrality, formally declared, is worth something in a war of ledgers.',
                  ],
                  war: -1,
                },
              ],
            ],
          },
          {
            id: 'intel',
            label: '[semantic comms] Trade pleasantries — and read everything she does not say',
            needs: { tech: 'comms-semantic' },
            results: [
              [
                100,
                {
                  text: [
                    'The matrix reads the envoy’s pauses like a second transcript: fleet dispositions in what she avoids, supply strain in what she overstates. You decline the commission and leave with more than she offered for it.',
                  ],
                  data: 6,
                },
              ],
            ],
          },
        ],
      },
    },
  },

  // Pack 081 — Refugee Constellation
  {
    id: 'refugee-constellation',
    title: 'The Refugee Constellation',
    tag: 'war',
    portrait: P('41_human_refugee_leader.jpg'),
    backdrop: 'space',
    culture: 'ostrea',
    weight: 16,
    when: { minWar: 1 },
    entry: 'start',
    nodes: {
      start: {
        speaker: 'Anah Solene, convoy speaker',
        text: [
          'Ninety civilian hulls flying in patterns — literally: with their radios dead to avoid the patrols, the convoy signals by formation, spelling course changes in the positions of grandmothers’ freighters and school barges.',
          'Their speaker is human — descended, she says, from a colony ship nobody back home ever heard from again. “We are crossing the war the slow way, captain. Escort us one leg, or feed us, or pass on by. We have stopped judging.”',
        ],
        choices: [
          {
            id: 'escort',
            label: 'Escort the convoy one leg (2 days, 6 fuel)',
            spend: { fuel: 6 },
            results: [
              [
                100,
                {
                  text: [
                    'Two days at convoy speed, guns manned and visible. Twice, patrol lances sweep in close, read the Ithaca’s posture, and think better of it. At the handoff, the convoy spells a word in freighters that Solene translates, unnecessarily: THANK YOU.',
                    'Ninety hulls of refugees know routes the admiralties never charted — and now, so do you.',
                  ],
                  days: 2,
                  standing: { ostrea: 2 },
                  data: 3,
                  war: 1,
                  flagsSet: ['convoy-friend'],
                },
              ],
            ],
          },
          {
            id: 'feed',
            label: 'Transfer 15 supplies to the convoy',
            spend: { supplies: 15 },
            results: [
              [
                100,
                {
                  text: [
                    'The stores cross by shuttle relay, hand to hand to hand. Solene sends back a hand-drawn chart of the corridor ahead — where the mines are, where the water is, which beacons lie. Refugee cartography: annotated in three alphabets and correct.',
                  ],
                  standing: { ostrea: 1 },
                  data: 3,
                },
              ],
            ],
          },
          {
            id: 'pass',
            label: 'Pass on by',
            results: [
              [
                100,
                {
                  text: [
                    'The convoy does not signal anything as the Ithaca pulls away. That is the worst part: they have stopped expecting better, and the crew watching the formations dwindle astern know it.',
                  ],
                },
              ],
            ],
          },
        ],
      },
    },
  },

  // Pack 051 / 071 — the swarm delegate.
  {
    id: 'swarm-delegate',
    title: 'A Face for the Swarm',
    tag: 'contact',
    portrait: P('51_robot_swarm_delegate.jpg'),
    backdrop: 'space',
    weight: 12,
    entry: 'start',
    nodes: {
      start: {
        speaker: 'WE, a delegation of the Ten Thousand',
        text: [
          'It boards by permission, politely, and assembles a body in the shuttle bay out of its own carried components — a humanoid shape, because it has read that this puts crews at ease. It has questions about the Ithaca’s drive. It offers answers about everything else.',
          '“WE HAVE MAPPED WHERE WE HAVE SWARMED,” it says, through a speaker it built while saying it. “EXCHANGE IS EFFICIENT.”',
        ],
        choices: [
          {
            id: 'exchange',
            label: 'Open the drive telemetry to the swarm',
            results: [
              [
                75,
                {
                  text: [
                    'The swarm reads the drive the way a locksmith reads a lock — respectfully, thoroughly, without touching. In exchange it unpacks survey data from volumes no crewed ship has survived: radiation corridors, gravity shoals, and the shortest safe line through both.',
                  ],
                  data: 6,
                  flagsSet: ['swarm-friend'],
                },
              ],
              [
                25,
                {
                  text: [
                    'The exchange is honest but not gentle: the swarm’s inspection tripped every safety on the drive bus, and engineering spends a bruising watch resetting them. The survey data, at least, is superb.',
                  ],
                  data: 6,
                  hull: -2,
                  flagsSet: ['swarm-friend'],
                },
              ],
            ],
          },
          {
            id: 'refuse',
            label: 'The drive stays sealed',
            results: [
              [
                100,
                {
                  text: [
                    'The delegate disassembles its borrowed face without offence. “CAUTION IS ALSO INFORMATION,” it notes, and pours itself back out through the airlock seams.',
                  ],
                },
              ],
            ],
          },
        ],
      },
    },
  },
]

/* ========================================================================
 * III. The interstellar war                     (pack 086–110)
 * ====================================================================== */

const WAR: EncounterDef[] = [
  // Pack 086 — Crossing the Burning Line
  {
    id: 'burning-line',
    title: 'Crossing the Burning Line',
    tag: 'war',
    portrait: P('43_human_smuggler_pilot.jpg'),
    backdrop: 'space',
    weight: 16,
    when: { regions: ['cinder-belt'], minWar: 1 },
    entry: 'start',
    nodes: {
      start: {
        speaker: 'Dex Marlowe, blockade pilot',
        text: [
          'The front announces itself on passive sensors: a lane of sky where everything is either debris or pretending to be. The shortest route runs straight through it.',
          'A battered courier matches course, and its pilot — human, grinning, wanted in at least two jurisdictions by the look of the hull patches — offers a professional opinion. “You can buy passage, you can shoot your way through, or you can fly my line. My line’s better. My line costs.”',
        ],
        choices: [
          {
            id: 'smuggler',
            label: 'Buy Marlowe’s line through the front (6 fuel)',
            spend: { fuel: 6 },
            results: [
              [
                80,
                {
                  text: [
                    'Marlowe’s line is a masterpiece of negative space — through sensor shadows, dead convoys and one still-burning wreck used as cover. On the far side he transmits the whole route, annotated. “Keep it. I redraw mine weekly anyway.”',
                  ],
                  data: 4,
                  flagsSet: ['marlowe-friend'],
                },
              ],
              [
                20,
                {
                  text: [
                    'The line is good; the timing is not. A patrol sweep clips the corridor mid-transit and the last leg is flown under fire, shields sparking. Marlowe’s apology is a full refund and a better line next time — but the hull took the difference.',
                  ],
                  fuel: 6,
                  hull: -4,
                  data: 3,
                  flagsSet: ['marlowe-friend'],
                },
              ],
            ],
          },
          {
            id: 'negotiate',
            label: 'Negotiate passage with the Ascendancy pickets',
            needs: { standing: ['vekar', 1] },
            results: [
              [
                100,
                {
                  text: [
                    'The Ascendancy remembers its friends: the pickets open a corridor with military courtesy, and a lance escorts the Ithaca through the worst of it. The Compact’s watchers log every kilometre of the favour.',
                  ],
                  data: 2,
                  standing: { ostrea: -1 },
                },
              ],
            ],
          },
          {
            id: 'punch',
            label: 'Punch through under fire',
            results: [
              [
                100,
                {
                  text: ['The Ithaca goes through the Burning Line the loud way. Something big detaches from the picket to object.'],
                  combat: {
                    enemy: 'warship',
                    rewards: {
                      data: 4,
                      fuel: 6,
                      text: 'The picket warship breaks off, burning. The front closes behind the Ithaca like water — and the war now has her silhouette on file.',
                    },
                  },
                },
              ],
            ],
          },
        ],
      },
    },
  },

  // Pack 087 — Neutrality Inspection
  {
    id: 'neutrality-inspection',
    title: 'Neutrality Inspection',
    tag: 'war',
    portrait: P('12_reptilian_veteran.jpg'),
    backdrop: 'space',
    weight: 16,
    unique: false,
    when: { minWar: 2 },
    entry: 'start',
    nodes: {
      start: {
        speaker: 'Inspector-Commander Ssevesh, Ascendancy Navy',
        text: [
          'The patrol lance is polite the way a drawn weapon is polite. Its commander — old, scarred, visibly bored by the prospect of paperwork — requests permission to board and inspect for contraband, enemy personnel and “undeclared strategic material.”',
          '“Every neutral says they are neutral, captain. The hold says what it says.”',
        ],
        choices: [
          {
            id: 'submit',
            label: 'Open the hold and submit to inspection',
            results: [
              [
                100,
                {
                  text: [
                    'The inspection is thorough — and the Ithaca is carrying a Vekar strategic asset in the hydroponics bay. Ssevesh’s boarding party walks Vess to the airlock under a retrieval order signed before the ship ever made orbit, and there is nothing lawful to do about it but watch.',
                    '“Co-operation is noted,” Ssevesh says, and means it as a kindness. It does not feel like one. The standing bounty clears into the ship’s account, unasked.',
                  ],
                  fuel: 8,
                  standing: { vekar: 1 },
                  flagsClear: ['defector-aboard'],
                },
                { flagsAll: ['defector-aboard'] },
              ],
              [
                80,
                {
                  text: [
                    'The inspection is thorough, slow and disappointingly uneventful. Ssevesh stamps the transit ledger, confiscates a crate of unlicensed preserves on principle, and — off the record — marks the Ithaca’s file CO-OPERATIVE. It buys quiet lanes for a while.',
                  ],
                  supplies: -5,
                  war: -1,
                },
              ],
              [
                20,
                {
                  text: [
                    'The inspection is thorough — and it finds the alien componentry in the lab, which is technically undeclared strategic material everywhere the Ascendancy writes forms. It costs a fine, a lecture, and most of a day. But the ledger gets its stamp.',
                  ],
                  supplies: -5,
                  data: -3,
                  war: -1,
                },
              ],
            ],
          },
          {
            id: 'bribe',
            label: 'Offer a “transit facilitation” of 6 fuel',
            spend: { fuel: 6 },
            results: [
              [
                100,
                {
                  text: [
                    'Ssevesh regards the offer for a long, cold-blooded moment — then takes it, because the war is long and pensions are theoretical. The lance peels away without boarding. No stamp in the ledger. No record at all, which cuts both ways.',
                  ],
                },
              ],
            ],
          },
          {
            id: 'refuse',
            label: 'Refuse the boarding. Neutral means neutral',
            results: [
              [
                100,
                {
                  text: ['Ssevesh sighs, audibly, on an open channel. “Noted for the record, captain.” The lance comes about, gunports opening with bureaucratic precision.'],
                  combat: {
                    enemy: 'patrol',
                    rewards: {
                      data: 3,
                      text: 'The patrol lance withdraws, venting atmosphere. Refusing the Ascendancy is now a matter of official record — and so is winning.',
                      standing: { vekar: -2, ostrea: 1 },
                    },
                  },
                },
              ],
            ],
          },
        ],
      },
    },
  },

  // Pack 088 — The Hospital Moon
  {
    id: 'hospital-moon',
    title: 'The Hospital Moon',
    tag: 'war',
    portrait: P('38_human_quarantine_medic.jpg'),
    backdrop: 'planet',
    weight: 14,
    when: { minWar: 1, features: ['habitable-world', 'ice-ring'] },
    entry: 'start',
    nodes: {
      start: {
        speaker: 'Director Halloran, sanctuary administrator',
        text: [
          'Both fleets respect the hospital moon — the one point of agreement left in the war. Its wards hold casualties of every species and both flags, and its director looks like she has not slept since the armistice-before-last.',
          '“I will be blunt, captain. There is a weapons cache under Ward Nine. I did not put it there. If either fleet learns of it, the sanctuary dies with everyone in it. Help me, or forget you docked.”',
        ],
        choices: [
          {
            id: 'remove',
            label: 'Quietly haul the cache into the sun (1 day)',
            results: [
              [
                75,
                {
                  text: [
                    'The cache goes up the gravity well in unmarked lighters and into the star without ceremony. Halloran breathes for what looks like the first time in months, and opens the sanctuary’s records to your medical staff — including the intake logs of every displaced ship her wards have ever treated.',
                  ],
                  days: 1,
                  data: 4,
                  standing: { vekar: 1, ostrea: 1 },
                  flagsSet: ['sanctuary-friend'],
                },
              ],
              [
                25,
                {
                  text: [
                    'The last lighter is spotted by a picket drone on its final run. Nothing is proven — the cache is already stellar plasma — but suspicion attaches to the Ithaca like smoke, and both admiralties open files.',
                    'Halloran’s gratitude is real, and so are the records she shares.',
                  ],
                  days: 1,
                  data: 4,
                  war: 1,
                  standing: { vekar: -1, ostrea: -1 },
                  flagsSet: ['sanctuary-friend'],
                },
              ],
            ],
          },
          {
            id: 'expose',
            label: 'Expose the cache to both fleets simultaneously',
            results: [
              [
                100,
                {
                  text: [
                    'Broadcast in the open, verified by both sides at once, the cache becomes nobody’s advantage and everybody’s scandal. The sanctuary survives on the strength of the embarrassment. Halloran does not thank you for the method, but the wards keep their lights.',
                  ],
                  war: 1,
                  data: 3,
                },
              ],
            ],
          },
          {
            id: 'aid',
            label: 'Lend your medical officer to the wards (1 day)',
            needs: { officer: 'medical' },
            results: [
              [
                100,
                {
                  text: [
                    'A day in the wards, human medicine trading techniques with six kinds of alien surgery. The crew that rotates down comes back changed in the way that only useful work changes people. The cache stays where it is — someone else’s war, someone else’s day.',
                  ],
                  days: 1,
                  data: 2,
                  standing: { vekar: 1, ostrea: 1 },
                },
              ],
            ],
          },
        ],
      },
    },
  },

  // Pack 090 — The Defector's Coordinates
  {
    id: 'defector',
    title: 'The Defector’s Coordinates',
    tag: 'bounty',
    portrait: P('28_hive_drone_defector.jpg'),
    backdrop: 'space',
    weight: 16,
    when: { minWar: 1, minDay: 20 },
    entry: 'start',
    nodes: {
      start: {
        text: [
          'The lifepod’s beacon is squawking a Vekar naval authentication three grades above anything a lifepod should carry. Inside is a single hive drone — a caste-built strategist, it says, grown for the Ascendancy war council and no longer willing to think the thoughts it was grown for.',
          'It offers the obvious trade before you can ask: sanctuary, for what it knows. And it knows, among many other things, what the war council’s astrogators found when they mapped the rift.',
        ],
        choices: [
          {
            id: 'shelter',
            label: 'Grant sanctuary aboard the Ithaca',
            results: [
              [
                100,
                {
                  text: [
                    'The drone — it asks, hesitantly, to be called Vess — takes a berth by the hydroponics bay and begins paying rent immediately: the war council’s rift survey, from memory, error bars and all.',
                    'Vekar naval traffic in the volume shifts within days. They want their strategist back, or silent.',
                  ],
                  shareClues: 1,
                  data: 3,
                  standing: { vekar: -2 },
                  flagsSet: ['defector-aboard'],
                  followUp: { id: 'defector-hunted', days: [6, 12] },
                },
              ],
            ],
          },
          {
            id: 'sell',
            label: 'Signal the Ascendancy to come and collect',
            results: [
              [
                100,
                {
                  text: [
                    'The retrieval corvette is on station in eleven hours — they were close, and that is worth remembering too. The Ascendancy pays the bounty without haggling and lifts the drone away in a sealed casket. It does not struggle. That is the part the watch officers keep not talking about.',
                  ],
                  fuel: 10,
                  data: 4,
                  standing: { vekar: 2, ostrea: -1 },
                },
              ],
            ],
          },
          {
            id: 'refuse',
            label: 'Refuel the pod and let it run its own course',
            results: [
              [
                100,
                {
                  text: [
                    'The pod takes the fuel with formal thanks and burns for the deep dark, carrying its unthinkable thoughts elsewhere. Weeks later, an anonymous data packet arrives by relay: a fraction of what sanctuary would have bought, and an address that no longer answers.',
                  ],
                  fuel: -4,
                  data: 2,
                },
              ],
            ],
          },
        ],
      },
    },
  },

  {
    id: 'defector-hunted',
    title: 'The Retrieval Order',
    tag: 'hostile',
    backdrop: 'space',
    weight: 0,
    when: { flagsAll: ['defector-aboard'], flagsNone: ['defector-safe'] },
    entry: 'start',
    nodes: {
      start: {
        text: [
          'The patrol lance does not hail with words. It transmits a single document: a Vekar naval retrieval order for “one (1) strategic asset, self-misappropriated,” naming the Ithaca as the vessel of record — and giving her captain sixty seconds to surrender Vess or be boarded.',
          'From the hydroponics bay, quietly: “I will go, if you ask. I am asking you not to ask.”',
        ],
        choices: [
          {
            id: 'fight',
            label: 'The Ithaca does not surrender passengers',
            results: [
              [
                100,
                {
                  text: ['Sixty seconds expire.'],
                  combat: {
                    enemy: 'patrol',
                    rewards: {
                      data: 4,
                      text: 'The lance breaks off, holed and listing. Somewhere in the Ascendancy, a retrieval order is quietly marked INFEASIBLE — the nearest thing to a pardon their forms allow.',
                      flagsSet: ['defector-safe'],
                      standing: { ostrea: 1 },
                    },
                    withdrawFollowUp: { id: 'defector-hunted', days: [8, 14] },
                  },
                },
              ],
            ],
          },
          {
            id: 'surrender',
            label: 'Surrender Vess to the lance',
            results: [
              [
                100,
                {
                  text: [
                    'Vess walks to the airlock unescorted, thanks the crew for the borrowed weeks, and is gone. The lance pays the standing bounty into the ship’s account with insulting promptness.',
                    'The hydroponics bay is just a hydroponics bay again. Nobody goes there off-shift anymore.',
                  ],
                  fuel: 8,
                  standing: { vekar: 1 },
                  flagsClear: ['defector-aboard'],
                },
              ],
            ],
          },
        ],
      },
    },
  },

  // Pack 101 — The Admiral's Map
  {
    id: 'admirals-map',
    title: 'The Admiral’s Map',
    tag: 'key',
    portrait: P('44_human_retired_commander.jpg'),
    backdrop: 'station',
    weight: 16,
    when: { minDay: 35, minWar: 1 },
    entry: 'start',
    nodes: {
      start: {
        speaker: 'Admiral (ret.) Corvin Sale',
        text: [
          'Every navigator in the region tells the same story: the only complete chart of the war corridor belongs to a human admiral who fought for both sides, retired from both, and now keeps a bar on a neutral rock where fleet officers drink in enforced, miserable truce.',
          'The admiral turns out to be real, ancient, and entirely aware of why you have come. “The map exists. I drew it. You can earn it, or you can try to take it — people do, now and then, and their ships make interesting salvage.”',
        ],
        choices: [
          {
            id: 'earn',
            label: 'Earn it: run his errand through the contested lanes (2 days, 6 fuel)',
            spend: { fuel: 6 },
            results: [
              [
                100,
                {
                  text: [
                    'The errand is a coffin — a fleet officer, one of his, dead forty years in a wreck both navies pretend is not there. The Ithaca brings the officer home to the neutral rock, and the truce in the bar stands for the funeral, both fleets at attention.',
                    'The admiral drinks once, alone, then lays the map on the bar. “Every lane that is survivable, and the hour of the watch when it is survivable. Do not make me regret the company I keep.”',
                  ],
                  days: 2,
                  shareClues: 1,
                  data: 5,
                  flagsSet: ['admiral-friend'],
                },
              ],
            ],
          },
          {
            id: 'challenge',
            label: 'Take it: challenge the old man’s escort',
            results: [
              [
                100,
                {
                  text: [
                    'The admiral does not even stand up. “The escort is the map, captain,” he says, as the bar’s gravity anchor releases a warship that was posing as the rock’s far side.',
                  ],
                  combat: {
                    enemy: 'warship',
                    rewards: {
                      shareClues: 2,
                      data: 4,
                      text: 'The escort strikes its colours, and honour — the admiral’s kind of honour — is satisfied. The map arrives by courier drone with a single annotation: EARNED, AFTER A FASHION.',
                      flagsSet: ['admiral-fought'],
                    },
                  },
                },
              ],
            ],
          },
          {
            id: 'leave',
            label: 'Buy a drink, hear the war stories, leave it be',
            results: [
              [
                100,
                {
                  text: [
                    'The stories are worth the docking fees: forty years of the war from a man who commanded both sides of it and buried friends on both. Half of it is intelligence by any measure. All of it is warning.',
                  ],
                  data: 3,
                },
              ],
            ],
          },
        ],
      },
    },
  },

  // Pack 091 — Minefield of Ancestors
  {
    id: 'minefield',
    title: 'Minefield of Ancestors',
    tag: 'war',
    portrait: P('48_robot_damaged_sentinel.jpg'),
    backdrop: 'space',
    weight: 12,
    when: { minWar: 1 },
    entry: 'start',
    nodes: {
      start: {
        text: [
          'The minefield across the lane is old enough to predate the current war — and it is talking. Each mine carries the copied mind of a fallen pilot, still flying its last patrol, still challenging traffic for a fleet that was disbanded before some of the crew were born.',
          '“UNIDENTIFIED VESSEL,” the nearest one repeats, in a voice that was once somebody’s. “THE LINE IS HELD. THE LINE IS HELD. THE LINE IS—”',
        ],
        choices: [
          {
            id: 'talk',
            label: '[semantic comms] Talk them down, pilot to pilot',
            needs: { tech: 'comms-semantic' },
            results: [
              [
                100,
                {
                  text: [
                    'It takes nine hours of call-sign etiquette, war stories and, finally, the truth: the war they died holding the line for is over, and lost, and mostly forgotten. One by one the mines stand down from a duty older than their explosives.',
                    'The last one transmits its patrol logs — decades of traffic data across a lane the charts call empty — and asks, before going dark, that somebody remember the squadron’s name. The log officer records it in full.',
                  ],
                  data: 5,
                  flagsSet: ['mines-stood-down'],
                },
              ],
            ],
          },
          {
            id: 'sweep',
            label: 'Sweep a corridor with the launch bay fighters',
            results: [
              [
                60,
                {
                  text: [
                    'The fighters herd and detonate a corridor through the field, clean and by the book. The dead pilots hold their doomed formation to the last mine. Nobody aboard says much for a watch or two.',
                  ],
                },
              ],
              [
                40,
                {
                  text: [
                    'The field defends itself better than dead pilots should. Two mines slip the sweep and lay their last kill against the Ithaca’s hull before the point-defence finds them.',
                  ],
                  hull: -4,
                },
              ],
            ],
          },
          {
            id: 'around',
            label: 'Go the long way around (6 fuel)',
            spend: { fuel: 6 },
            results: [
              [100, { text: ['The Ithaca gives the dead their lane. It costs a day of burn and nothing else — the cheapest bill this war will ever send you.'] }],
            ],
          },
        ],
      },
    },
  },

  // Pack 098 — Propaganda Rescue
  {
    id: 'propaganda-rescue',
    title: 'The Broadcast Rescue',
    tag: 'war',
    portrait: P('40_human_war_correspondent.jpg'),
    backdrop: 'space',
    weight: 12,
    when: { minWar: 2 },
    entry: 'start',
    nodes: {
      start: {
        speaker: 'Reva Okonkwo, embedded correspondent',
        text: [
          'The stricken liner is real, the survivors are real, and so are the six camera drones orbiting the rescue like flies. A Compact cruiser stands off at a photogenic distance, doing nothing, while its embedded correspondent directs the shot.',
          '“They will be saved either way, captain,” she says on a private channel, sounding tired of her own profession. “The only open question is whose flag is on the footage. You are, I should mention, already in frame.”',
        ],
        choices: [
          {
            id: 'rescue',
            label: 'Run the rescue and ignore the cameras',
            results: [
              [
                100,
                {
                  text: [
                    'The Ithaca works the wreck for eleven hours, and the footage — a neutral ship doing the work a warship was posing beside — says more than any flag. The Compact’s propaganda office quietly buries the reel. Okonkwo does not: her cut goes out on the civilian relays, and the region learns the Ithaca’s name.',
                  ],
                  standing: { ostrea: 1, flotilla: 1 },
                  data: 2,
                  flagsSet: ['known-rescuer'],
                },
              ],
            ],
          },
          {
            id: 'deal',
            label: 'Rescue on camera, on the Compact’s terms',
            results: [
              [
                100,
                {
                  text: [
                    'The rescue proceeds with excellent lighting. The Compact’s version of events features the Ithaca prominently and inaccurately, and pays for the privilege in fleet-grade navigational stock. The crew feel variously about being extras.',
                  ],
                  data: 5,
                  fuel: 6,
                  standing: { ostrea: 2, vekar: -2 },
                },
              ],
            ],
          },
          {
            id: 'leave',
            label: 'Leave the theatre to its actors',
            results: [
              [100, { text: ['The survivors are saved, eventually, once the shot is right. The Ithaca’s sensor log of the delay is its own kind of document, and the crew know they watched it happen.'], data: 1 }],
            ],
          },
        ],
      },
    },
  },
]

/* ========================================================================
 * IV. Life aboard, derelicts, worlds            (pack 111–180)
 * ====================================================================== */

const SHIPBOARD: EncounterDef[] = [
  // Pack 111 — The Blue Fever
  {
    id: 'blue-fever',
    title: 'The Blue Fever',
    tag: 'crew',
    portrait: P('01_cephalopod_xenobiologist.jpg'),
    backdrop: 'space',
    weight: 12,
    when: { minDay: 15 },
    entry: 'start',
    nodes: {
      start: {
        speaker: 'Dr. Iolo-of-the-Nine-Reaches, visiting xenobiologist',
        text: [
          'It starts on the mess deck: crew reporting patterns in the bulkheads — spirals, gridwork, script — visible to the fevered and to nobody else. The medbay calls it the blue fever, after the tinge it puts under the fingernails. It spreads by proximity and it is accelerating.',
          'The xenobiologist who answers the quarantine hail — a cephalopod scholar with more degrees than limbs — asks one question before docking: “Captain. The patterns. Has anyone thought to *write them down*?”',
        ],
        choices: [
          {
            id: 'cure',
            label: 'Cure first, questions later',
            needs: { officer: 'medical' },
            results: [
              [
                100,
                {
                  text: [
                    'The medbay breaks the fever in two hard days. Dr. Iolo is gracious about the lost opportunity and thorough about the aftercare. The patterns, whatever they were, fade with the last case — unrecorded.',
                  ],
                  days: 2,
                },
              ],
            ],
          },
          {
            id: 'record',
            label: 'Slow-treat the fever and transcribe the patterns',
            needs: { officer: 'science' },
            results: [
              [
                65,
                {
                  text: [
                    'Fevered crew sketch what they see; the science team collates; Dr. Iolo cross-references. The verdict lands like a depth charge: the “symptoms” are a message — an inoculation of information, keyed to fire in nervous systems that have crossed the rift. Somebody, long ago, found a way to mail a chart *inside a disease*.',
                    'The fever passes. The chart stays.',
                  ],
                  days: 2,
                  shareClues: 1,
                  data: 4,
                },
              ],
              [
                35,
                {
                  text: [
                    'The slow treatment costs more than it finds: the fever burns harder in its final days, and one of the officers goes down with it before the medbay wins. The transcripts are fragmentary — suggestive, valuable, incomplete.',
                  ],
                  days: 2,
                  data: 4,
                  injureOfficer: true,
                },
              ],
            ],
          },
        ],
      },
    },
  },

  // Pack 114 — Birthday at the End of Space
  {
    id: 'birthday',
    title: 'Birthday at the End of Space',
    tag: 'crew',
    portrait: P('29_crustacean_cook.jpg'),
    backdrop: 'space',
    weight: 10,
    unique: false,
    when: { minDay: 10 },
    entry: 'start',
    nodes: {
      start: {
        speaker: 'Skell, ship’s cook (self-appointed)',
        text: [
          'The crustacean cook who came aboard three ports ago — nobody can quite remember authorising it — raps a claw on the ready-room hatch. It is, Skell announces, somebody’s birthday. It is, statistically, always somebody’s birthday. This one, however, falls on the four-hundredth day since that somebody last saw home.',
          '“Stores can spare a feast, captain. Or stores can stay honest and the day can pass like the others. Cooks propose. Captains dispose.”',
        ],
        choices: [
          {
            id: 'feast',
            label: 'Authorise the feast (8 supplies)',
            spend: { supplies: 8 },
            results: [
              [
                100,
                {
                  text: [
                    'Skell performs miracles with reconstituted stores and something alarming from the xenogarden that everyone agrees not to identify. For one evening the mess deck sounds like a ship that is going to make it. That sound is worth more than the stores were.',
                  ],
                },
              ],
            ],
          },
          {
            id: 'decline',
            label: 'The stores stay sealed',
            results: [
              [100, { text: ['Skell salutes with a claw — no argument, no sulk — and serves the standard ration with unusual care. The day passes like the others. That is the problem with it.'] }],
            ],
          },
        ],
      },
    },
  },

  // Pack 128 — The Strike
  {
    id: 'the-strike',
    title: 'The Strike',
    tag: 'crew',
    backdrop: 'space',
    weight: 12,
    when: { minDay: 25 },
    entry: 'start',
    nodes: {
      start: {
        text: [
          'The maintenance watch files a formal petition, through channels, with signatures: the deferred-repair backlog has crossed the line from tolerable to dangerous, and they can prove it with the fault log. Double watches for a month, spare parts triaged past sense, and a hull that is being asked to remember what plating used to be there.',
          'They are not refusing orders. They are asking the captain to look at the list.',
        ],
        choices: [
          {
            id: 'negotiate',
            label: 'Stand the ship down and work the list properly (1 day)',
            results: [
              [
                100,
                {
                  text: [
                    'A day of honest yard-work at anchor, the rota rebuilt around what the fault log actually says. The backlog clears, the patches come off, and real plate goes on. The spokesperson signs the completed list like a treaty.',
                  ],
                  days: 1,
                  hull: 3,
                },
              ],
            ],
          },
          {
            id: 'defer',
            label: 'Note the petition. The schedule holds',
            results: [
              [
                100,
                {
                  text: [
                    'The list goes in a drawer and the ship keeps her schedule. The watch does what professionals do: they comply, and they annotate. Somewhere under deck nine, a deferred fault quietly gets worse on exactly the timetable the petition predicted.',
                  ],
                  hull: -2,
                },
              ],
            ],
          },
          {
            id: 'join',
            label: 'Pick up a spanner and work the backlog with them (2 days)',
            results: [
              [
                100,
                {
                  text: [
                    'The captain on the maintenance rota, taking direction from a third-class technician, for two entire days. The backlog clears to zero, the grievances get aired at eye level over conduit runs, and the story becomes ship’s legend by the second watch — the day the Old Man held the torch.',
                  ],
                  days: 2,
                  hull: 5,
                  flagsSet: ['held-the-torch'],
                },
              ],
            ],
          },
        ],
      },
    },
  },

  // Pack 116 — Letters That Cannot Arrive
  {
    id: 'letters-home',
    title: 'Letters That Cannot Arrive',
    tag: 'crew',
    backdrop: 'space',
    weight: 10,
    when: { minDay: 30 },
    entry: 'start',
    nodes: {
      start: {
        text: [
          'The tradition started quietly, months ago: crew writing letters home and filing them, unsendable, with the comms officer. There are four hundred of them now.',
          'Then the anomaly is detected: a natural relay effect in this system’s magnetosphere, briefly capable — the science station is quite sure — of pushing a signal much, much farther than the ship ever could. Possibly far enough. The catch is stark: anything transmitted will announce, to anyone listening, exactly where the signal was born.',
        ],
        choices: [
          {
            id: 'send',
            label: 'Send the letters',
            results: [
              [
                100,
                {
                  text: [
                    'Four hundred letters ride the anomaly out into the dark. Whether they arrive, no instrument can say — but the ship that watched them go is a different ship: lighter, steadier, and marked, now, on somebody’s chart of interesting signals.',
                  ],
                  flagsSet: ['letters-sent'],
                  followUp: { id: 'who-listened', days: [12, 25] },
                },
              ],
            ],
          },
          {
            id: 'encode',
            label: 'Send them folded inside decoy telemetry',
            needs: { officer: 'science' },
            results: [
              [
                100,
                {
                  text: [
                    'The science team spends a watch dressing the letters as pulsar survey noise — origin scrambled, contents preserved. Less power reaches the sky, and less certainty that they will ever be readable. But the ship gives away nothing, and the crew got to *send* them. Some nights that is the whole of the job.',
                  ],
                  data: 2,
                },
              ],
            ],
          },
          {
            id: 'refuse',
            label: 'The ship stays dark',
            results: [
              [100, { text: ['The letters stay in their file. The anomaly closes on schedule, indifferent. Nobody argues with the decision, which is somehow worse than if they had.'] }],
            ],
          },
        ],
      },
    },
  },

  {
    id: 'who-listened',
    title: 'Something Heard the Letters',
    tag: 'hostile',
    backdrop: 'space',
    weight: 0,
    when: { flagsNone: ['echo-dead'] },
    entry: 'start',
    nodes: {
      start: {
        text: [
          'It arrives on the same bearing the letters left by, and its opening transmission is a scrapbook of them — fragments of four hundred private goodbyes, read back in a voice assembled from the crew’s own recorded vowels.',
          '“SUCH A LONG WAY FROM HOME,” it says, closing to weapons range. “LET US HELP YOU STOP MISSING IT.”',
        ],
        choices: [
          {
            id: 'fight',
            label: 'Battle stations',
            results: [
              [
                100,
                {
                  text: ['The Ithaca answers in the only language the thing has not learned to counterfeit.'],
                  combat: {
                    enemy: 'echo',
                    rewards: {
                      data: 8,
                      shareClues: 1,
                      text: 'The mimic breaks apart, and with it, the stolen voices. In its core: the navigational spine of everything it ever consumed — including ships that knew the way home.',
                      flagsSet: ['echo-dead'],
                    },
                    withdrawFollowUp: { id: 'who-listened', days: [10, 18] },
                  },
                },
              ],
            ],
          },
        ],
      },
    },
  },
]

const DERELICTS: EncounterDef[] = [
  // Pack 162 — Lights on the Grave Deck
  {
    id: 'grave-deck',
    title: 'Lights on the Grave Deck',
    tag: 'derelict',
    portrait: P('30_time_displaced_elder.jpg'),
    backdrop: 'derelict',
    weight: 16,
    when: { features: ['derelict-beacon', 'nebula-shroud'] },
    entry: 'start',
    nodes: {
      start: {
        text: [
          'The hulk has been dead for two hundred years by every measurable sign — hull temperature, orbit decay, the slow chemistry of abandoned steel. Except that one cabin, amidships, is lit. Warm light, steady power draw, curtains — *curtains* — drawn against the vacuum.',
          'The occupant answers the first knock. Elderly, courteous, dressed for a voyage two centuries out of fashion, and absolutely certain that only hours have passed since the accident. “Has the rescue come? I told the others to wait in the boats.”',
        ],
        choices: [
          {
            id: 'board',
            label: 'Bring them aboard, gently',
            results: [
              [
                70,
                {
                  text: [
                    'They step across the airlock threshold and two hundred years arrive all at once — visible, terrible, survivable. The medbay does what it can; time does the rest. In return, the survivor gives the ship a gift out of all proportion: a working memory of the region’s lanes *as they were drawn before the war redrew them*.',
                  ],
                  data: 6,
                  flagsSet: ['survivor-aboard'],
                },
              ],
              [
                30,
                {
                  text: [
                    'The threshold is the trap: whatever pocket of slow time kept the cabin alive collapses as they cross it, and the boarding party is caught in the backwash — hours lost in a doorway, and one of the team carried out of it.',
                    'The survivor makes the crossing intact, apologising, ancient. Their chart-memory alone justifies the price. The medbay disagrees, quietly.',
                  ],
                  data: 6,
                  injureOfficer: true,
                  flagsSet: ['survivor-aboard'],
                },
              ],
            ],
          },
          {
            id: 'interview',
            label: 'Interview them across the threshold — cross nothing',
            results: [
              [
                100,
                {
                  text: [
                    'Four hours of conversation across an open airlock, two hundred years apart. The survivor’s account of the region — pre-war lanes, vanished stations, the old names of things — is patient, precise and heartbreaking. At the end they thank you for the visit and draw the curtains again, to wait for their rescue.',
                    'The ship logs the cabin as a hazard to navigation, and as something else that has no catalogue code.',
                  ],
                  data: 4,
                },
              ],
            ],
          },
        ],
      },
    },
  },

  // Pack 163 — The Cargo Is Breathing
  {
    id: 'cargo-breathing',
    title: 'The Cargo Is Breathing',
    tag: 'derelict',
    backdrop: 'derelict',
    weight: 14,
    when: { features: ['derelict-beacon', 'asteroid-belt'] },
    entry: 'start',
    nodes: {
      start: {
        text: [
          'The freighter is stripped — reactor gone, drives gone, name burned off the bow. Only the cargo remains: forty sealed containers, refrigerated by a jury-rig running off a salvaged battery, and every one of them is breathing. Slow, synchronised, dreaming respiration. Dormant colonists of a species the xenology files have never seen.',
          'Somebody unshipped the engines and left forty containers of sleeping people in the dark. The battery has perhaps a month left.',
        ],
        choices: [
          {
            id: 'revive',
            label: 'Revive them aboard the Ithaca (12 supplies)',
            spend: { supplies: 12 },
            results: [
              [
                100,
                {
                  text: [
                    'They wake in the shuttle bay in ones and twos — small, calm, radially symmetrical, and heartbroken in a way that crosses every biology. They know exactly who left them and why, and they will speak of it only once, for the record.',
                    'The Flotillas, who have strong customs about the abandoned, take them in at the next crossing — and the convoy that collects them sings the Ithaca’s name into their route-song, permanently.',
                    'Whoever stripped that freighter will eventually learn their cargo woke up. It talked.',
                  ],
                  standing: { flotilla: 2 },
                  data: 3,
                  followUp: { id: 'cargo-owners', days: [8, 16] },
                },
              ],
            ],
          },
          {
            id: 'tow',
            label: 'Re-rig the power and tow the containers to inhabited space (8 fuel)',
            spend: { fuel: 8 },
            results: [
              [
                100,
                {
                  text: [
                    'The Ithaca hands forty sleepers to a habitable world’s quarantine authority with the batteries at nine days and falling. It is the careful choice, and the sleepers are no longer your responsibility — or your allies, or your witnesses. The manifest goes in the log, in case the dark ever asks who knew.',
                  ],
                },
              ],
            ],
          },
          {
            id: 'leave',
            label: 'Log the position and leave the containers sealed',
            results: [
              [
                100,
                {
                  text: [
                    'The position goes in the log with a distress annotation the next passing ship may or may not read. The breathing continues behind the Ithaca, forty containers of it, on a battery with a month to live. The watch officers do not discuss it. The mess deck does.',
                  ],
                  flagsSet: ['cargo-left'],
                },
              ],
            ],
          },
        ],
      },
    },
  },

  {
    id: 'cargo-owners',
    title: 'The Owners Come Asking',
    tag: 'hostile',
    backdrop: 'space',
    weight: 0,
    entry: 'start',
    nodes: {
      start: {
        text: [
          'The corsair’s hail is commendably direct: the Ithaca interfered with cargo under contract, the cargo has since *testified*, and the client is now paying for the only kind of retraction the dark accepts.',
          '“Nothing personal, captain. You woke it. You bought it.”',
        ],
        choices: [
          {
            id: 'fight',
            label: 'Let them try to collect',
            results: [
              [
                100,
                {
                  text: ['The corsair commits to its attack run.'],
                  combat: {
                    enemy: 'corsair',
                    rewards: {
                      fuel: 8,
                      data: 3,
                      text: 'The corsair breaks and burns. In its hold: the stripped freighter’s reactor, still crated — and its manifest, naming the client. The Flotillas will want to hear that name.',
                      standing: { flotilla: 1 },
                    },
                    withdrawFollowUp: { id: 'cargo-owners', days: [8, 14] },
                  },
                },
              ],
            ],
          },
        ],
      },
    },
  },

  // Pack 171 — The Museum of Captains
  {
    id: 'museum-of-captains',
    title: 'The Museum of Captains',
    tag: 'derelict',
    portrait: P('23_energy_reliquary.jpg'),
    backdrop: 'derelict',
    weight: 14,
    when: { features: ['ruins', 'derelict-beacon'], minDay: 25 },
    entry: 'start',
    nodes: {
      start: {
        speaker: 'The Curator',
        text: [
          'The gallery runs the length of a hollowed asteroid: command crews in stasis, arranged by era, each behind glass with a small engraved plaque. The oldest exhibits predate every civilisation on the current charts. The Curator — a lattice of caged light that moves like slow lightning — is delighted to receive a *visiting* captain, a distinction it savours audibly.',
          '“Exhibit forty-one,” it mentions, mid-tour, “commanded a survey vessel that charted a rift transit very like the one you seek. She has been asleep for nine hundred years. Acquisitions are permanent, you understand. But conversation through the glass — that, tradition permits.”',
        ],
        choices: [
          {
            id: 'converse',
            label: 'Pay the Curator’s fee to wake exhibit forty-one for one conversation',
            spend: { data: 6 },
            results: [
              [
                100,
                {
                  text: [
                    'The glass warms. Captain Yelen Aro of the survey ship Meridian wakes nine hundred years from home, takes in the situation with a navigator’s economy, and spends her single permitted hour dictating everything she remembers of the transit — bearings, harmonics, the mistake that stranded her here.',
                    '“Get it right,” she says, as the glass cools. “One of us should.”',
                  ],
                  shareClues: 1,
                  data: 2,
                },
              ],
            ],
          },
          {
            id: 'free',
            label: 'Break the collection open — free them all',
            results: [
              [
                100,
                {
                  text: [
                    'The stasis grid falls, and the museum wakes. Most of the freed captains weep, or pray, or stand very still. Captain Aro shakes your hand and trades everything she knows for a shuttle heading. The Curator screams in frequencies that crack its own glass.',
                    'And exhibit seven — acquired, its plaque notes, “at the height of an interesting war” — walks out of the wreckage of its case already giving orders. Some things are in museums for a reason.',
                  ],
                  shareClues: 1,
                  data: 3,
                  standing: { custodian: -1 },
                  followUp: { id: 'freed-warlord', days: [7, 14] },
                },
              ],
            ],
          },
          {
            id: 'leave',
            label: 'Finish the tour and leave the glass unbroken',
            results: [
              [
                100,
                {
                  text: [
                    'The tour ends at an empty case, freshly engraved. The plaque bears no name yet — only a class designation that matches the Ithaca’s, and today’s date rendered in six calendars. “Aspirational,” the Curator says, warmly. You leave at a dignified pace.',
                  ],
                  data: 2,
                },
              ],
            ],
          },
        ],
      },
    },
  },

  {
    id: 'freed-warlord',
    title: 'Exhibit Seven',
    tag: 'hostile',
    backdrop: 'space',
    weight: 0,
    when: { flagsNone: ['warlord-dead'] },
    entry: 'start',
    nodes: {
      start: {
        text: [
          'It took the freed warlord eleven days to acquire a warship. The hail is courteous, antique, and utterly without heat: the Ithaca’s captain is thanked, sincerely, for the liberation — and informed that the campaign interrupted nine centuries ago now resumes, beginning with the elimination of the only witness who knows where the warlord came from.',
          '“You will appreciate the logic,” the old voice says. “You struck the glass.”',
        ],
        choices: [
          {
            id: 'fight',
            label: 'Finish what the museum started',
            results: [
              [
                100,
                {
                  text: ['The warship of a nine-hundred-year-old war comes about with beautiful, obsolete precision.'],
                  combat: {
                    enemy: 'warship',
                    rewards: {
                      data: 6,
                      fuel: 8,
                      text: 'The antique warship dies as its era did — proudly, and for nothing. Its charts, at least, outlive it: nine centuries old, and in places nine centuries better than yours.',
                      shareClues: 1,
                      flagsSet: ['warlord-dead'],
                    },
                    withdrawFollowUp: { id: 'freed-warlord', days: [9, 16] },
                  },
                },
              ],
            ],
          },
        ],
      },
    },
  },

  // Pack 169 — Hull Within a Hull
  {
    id: 'hull-within-hull',
    title: 'Hull Within a Hull',
    tag: 'derelict',
    portrait: P('27_low_gravity_archaeologist.jpg'),
    backdrop: 'derelict',
    weight: 12,
    when: { features: ['derelict-beacon'] },
    entry: 'start',
    nodes: {
      start: {
        speaker: 'Sef-Under-Sky, salvage archaeologist',
        text: [
          'The salvage team’s first cut through the derelict’s armour finds another hull underneath — older, different alloy, different geometry. The archaeologist your hail attracts (they were already inside, which raises questions nobody presses) has catalogued four layers so far, each built around the last, each from a different century.',
          '“It is not a ship, captain. It is a *reliquary*. Somebody kept the first hull flying by burying it in new ones, for a very long time. The question your cutting torches are about to answer is: what was worth keeping?”',
        ],
        choices: [
          {
            id: 'core',
            label: 'Cut to the first hull with the science team (1 day)',
            needs: { officer: 'science' },
            results: [
              [
                65,
                {
                  text: [
                    'Layer by layer, century by century, down to a first hull barely bigger than a launch — and its cargo: a navigation shrine, tended and re-copied by every generation of the ship that grew around it. Star positions, transit timings, an entire tradition of getting home, preserved like scripture.',
                    'Sef-Under-Sky transcribes it weeping, which their species does through the elbows.',
                  ],
                  days: 1,
                  shareClues: 1,
                  data: 6,
                },
              ],
              [
                35,
                {
                  text: [
                    'The third layer was structural in a way the surveys missed. The collapse is slow enough to run from — mostly. The team brings back scans of the shrine chamber they never physically reached: fragmentary, tantalising, expensive.',
                  ],
                  days: 1,
                  data: 4,
                  injureOfficer: true,
                },
              ],
            ],
          },
          {
            id: 'strip',
            label: 'Strip the modern layers for fuel and material',
            results: [
              [
                100,
                {
                  text: [
                    'The outer hulls are honest salvage: tanks, plating, conduit by the kilometre. The inner layers stay sealed — some instinct in the salvage crews votes against the last cut, and the captain lets the vote stand. The reliquary keeps its relic.',
                  ],
                  fuel: 10,
                  data: 1,
                },
              ],
            ],
          },
        ],
      },
    },
  },
]

const WORLDS: EncounterDef[] = [
  // Pack 152 — The Singing Canyon
  {
    id: 'singing-canyon',
    title: 'The Singing Canyon',
    tag: 'world',
    backdrop: 'planet',
    weight: 14,
    when: { features: ['habitable-world'] },
    entry: 'start',
    nodes: {
      start: {
        text: [
          'The survey drones find it at dawn, local time: a canyon system a thousand kilometres long whose wind-carved galleries reproduce, each sunrise, a *sound* — structured, repeating, and unmistakably artificial in origin. Run through the spectrograph, the morning song resolves into what it has been all along: a star map, carved into rock by someone who wanted the wind to keep reading it aloud forever.',
          'The full song takes six local days to cycle. The seasonal storm arrives in two.',
        ],
        choices: [
          {
            id: 'stay',
            label: 'Ride out the storm and record the whole cycle (3 days)',
            results: [
              [
                55,
                {
                  text: [
                    'The storm is everything the meteorology promised and the ground team endures it in a survey shelter bolted to the canyon rim, changing recording media with numb fingers. On the sixth dawn the song completes, and the map with it: a route, sung in stone, older than the war and correct where it can be checked.',
                  ],
                  days: 3,
                  shareClues: 1,
                  data: 4,
                },
              ],
              [
                45,
                {
                  text: [
                    'The storm takes the shelter’s anchors on the second night and the recording schedule with them. The team limps back to orbit with two-thirds of the song and a stretcher case — and the two-thirds is still a finding: partial map, whole warning.',
                  ],
                  days: 3,
                  data: 4,
                  injureOfficer: true,
                  hull: -2,
                },
              ],
            ],
          },
          {
            id: 'partial',
            label: 'Record what the two clear days allow',
            results: [
              [100, { text: ['Two dawns of the song, recorded clean and abandoned ahead of the weather. The fragment maps a corridor of sky without saying where the corridor leads — the lab will argue about it for weeks, productively.'], days: 1, data: 3 }],
            ],
          },
          {
            id: 'leave',
            label: 'Log the phenomenon and stay in orbit',
            results: [[100, { text: ['The canyon sings to its empty morning, as it has for millennia, and the Ithaca’s log records that it does. Somebody with more days to spend will thank the entry.'], data: 1 }]],
          },
        ],
      },
    },
  },

  // Pack 146 — The Abandoned Paradise
  {
    id: 'abandoned-paradise',
    title: 'The Abandoned Paradise',
    tag: 'world',
    backdrop: 'planet',
    weight: 14,
    when: { features: ['habitable-world'] },
    entry: 'start',
    nodes: {
      start: {
        text: [
          'The world is flawless and fully furnished: cities with their lights on, orchards in fruit, tables laid — and not one inhabitant, anywhere, by any instrument. No wreckage, no graves, no note. Dinner is still warm in a hundred million homes.',
          'The away teams report the same sensation independently: the strong feeling of being *between* a question and its answer.',
        ],
        choices: [
          {
            id: 'investigate',
            label: 'Investigate carefully — touch nothing, catalogue everything',
            needs: { officer: 'science' },
            results: [
              [
                100,
                {
                  text: [
                    'Three days of scrupulous archaeology-of-the-present. The verdict: the absence is *deliberate and recent*, the whole world a held breath. The teams withdraw in good order, leaving every table as it was laid.',
                    'On the last shuttle’s camera, for a single frame, every light in the city below switches off and on again. Acknowledgement — or applause.',
                  ],
                  days: 2,
                  data: 5,
                  flagsSet: ['paradise-respected'],
                  followUp: { id: 'paradise-test', days: [10, 20] },
                },
              ],
            ],
          },
          {
            id: 'loot',
            label: 'Take on stores from the empty granaries',
            results: [
              [
                100,
                {
                  text: [
                    'The granaries are full and the ship is hungry; the arithmetic does the deciding. The stores are excellent. The feeling of being watched while loading them is unanimous and goes unrecorded in the official log.',
                  ],
                  supplies: 25,
                  flagsSet: ['paradise-looted'],
                  followUp: { id: 'paradise-test', days: [10, 20] },
                },
              ],
            ],
          },
          {
            id: 'leave-p',
            label: 'Break orbit now and let the held breath keep',
            results: [
              [100, { text: ['Some doors are shut politely by not being opened. The paradise recedes astern, lights on, tables laid, waiting for an answer the Ithaca declined to be.'] }],
            ],
          },
        ],
      },
    },
  },

  {
    id: 'paradise-test',
    title: 'The Owners’ Verdict',
    tag: 'key',
    backdrop: 'space',
    weight: 0,
    entry: 'start',
    nodes: {
      start: {
        text: [
          'It takes station off the bow between one sensor sweep and the next: a vessel with the same held-breath quality as the empty world — present, silent, and unmistakably *concluding something*.',
          'The transmission, when it comes, is in flawless ship-standard: “You were observed. The observation is complete. A finding follows.”',
        ],
        choices: [
          {
            id: 'finding',
            label: 'Receive the finding',
            results: [
              [
                100,
                {
                  text: [
                    'The finding arrives as a single dense packet and a sensation of a stamp being applied somewhere important: COMMENDED. The away teams walked through an undefended world and left every table as it was laid, and the observers’ kind — who keep the oldest charts in the region, and share them by merit alone — have opened a shelf.',
                    'The packet holds a route record older than the war, and a standing entry in the observers’ good books.',
                  ],
                  shareClues: 1,
                  data: 4,
                  standing: { custodian: 1 },
                },
                { flagsAll: ['paradise-respected'] },
              ],
              [
                100,
                {
                  text: [
                    'The finding arrives as a single dense packet and a sensation of a stamp being applied somewhere important: WANTING. The granaries were full because they were an offering scale, and the away teams tipped it. The observers do not punish; they collect. The stores taken from the paradise lift out of the hold through a seal nobody opened, to the gram.',
                    'What remains is the audit’s working notes — a cold education in what was actually being weighed.',
                  ],
                  supplies: -20,
                  data: 2,
                  standing: { custodian: -1 },
                },
                { flagsAll: ['paradise-looted'] },
              ],
              [
                100,
                {
                  text: [
                    'The finding arrives as a single dense packet: INCONCLUSIVE. The observation ended before the observed did anything worth grading — which is, the packet notes with something like disappointment, itself a datum.',
                  ],
                  data: 2,
                },
              ],
            ],
          },
        ],
      },
    },
  },

  // Pack 160 — First Footprint, Final Warning
  {
    id: 'first-footprint',
    title: 'First Footprint, Final Warning',
    tag: 'key',
    portrait: P('39_human_archaeologist.jpg'),
    backdrop: 'planet',
    weight: 16,
    when: { regions: ['rift-margin', 'xenoline'], minDay: 45 },
    entry: 'start',
    nodes: {
      start: {
        speaker: 'Dr. Amara Osei, expedition archaeologist',
        text: [
          'The world has been untouched for geological ages — the surveys are unambiguous. Which is why the expedition archaeologist’s voice, calling up from the landing site, has gone completely flat with control.',
          '“Captain. We have a human boot print here. Fresh — days old, standard fleet tread, size nine. And beside it, carved into the rock face…” A pause; the sound of wind on an empty world. “It is in an alien script, but the survey glyphs match. It says TURN BACK.”',
        ],
        choices: [
          {
            id: 'analyse',
            label: 'Full forensic workup of print and inscription (1 day)',
            needs: { officer: 'science' },
            results: [
              [
                100,
                {
                  text: [
                    'The findings, presented in the ready room in careful order: the boot is fleet issue but the wear pattern is wrong — decades of use on a days-old print. The inscription’s isotopes date it younger than the boot print beside it. And the script, cross-referenced, is the gate builders’ — used here to spell a human idiom.',
                    'Conclusion, offered reluctantly: someone human has been through here recently — travelling in a direction time does not usually permit — and left the warning knowing the Ithaca would land. Which means the way ahead is real enough to be warned about. The plot narrows accordingly.',
                  ],
                  days: 1,
                  shareClues: 1,
                  data: 5,
                  flagsSet: ['warning-read'],
                },
              ],
            ],
          },
          {
            id: 'press',
            label: 'Photograph it and press on. Warnings are advertising',
            results: [
              [
                100,
                {
                  text: [
                    'The expedition lifts on schedule, imagery filed, implications shelved. The crew take the captain’s reading of it — a warning is proof there is something ahead worth warning about — and the ship steadies on defiance, which burns hot and travels light.',
                  ],
                  data: 2,
                  flagsSet: ['warning-ignored'],
                },
              ],
            ],
          },
        ],
      },
    },
  },

  // Pack 023 — The Cartographer's Child
  {
    id: 'cartographer-child',
    title: 'The Cartographer’s Child',
    tag: 'contact',
    portrait: P('16_four_eyed_cartographer.jpg'),
    backdrop: 'station',
    weight: 14,
    when: { factionSpace: true, minDay: 15 },
    entry: 'start',
    nodes: {
      start: {
        speaker: 'Ules-Four-Ways, cartographer',
        text: [
          'The cartographer finds you, not the reverse — sliding into the berth beside the Ithaca with the practiced casualness of the professionally hunted. All four eyes check four different sightlines while it talks.',
          '“My child has inherited a route-memory, captain. Our government calls the memory state property and my child a *vessel of it*. They will take her mind apart to file its contents. Carry her beyond their writ — one passenger, no cargo — and the route in her head is yours to copy on the way. It is a very good route. My family has died for it twice.”',
        ],
        choices: [
          {
            id: 'carry',
            label: 'Take the child aboard',
            results: [
              [
                100,
                {
                  text: [
                    'She is eleven, gravely polite, and carries a thousand years of her family’s cartography behind four watchful eyes. On the second night aboard she recites the route for the log — singing it, the way it was taught — and the plot gains a spine of verified bearings.',
                    'Her government posts the seizure notice within the week. The Ithaca is named.',
                  ],
                  shareClues: 2,
                  flagsSet: ['child-aboard'],
                  followUp: { id: 'child-hunted', days: [5, 10] },
                },
              ],
            ],
          },
          {
            id: 'refuse',
            label: 'The ship cannot carry this fight',
            results: [
              [
                100,
                {
                  text: [
                    'Ules-Four-Ways accepts the refusal with all four eyes steady, which is worse than reproach. “Then unremember this berth, captain. For her sake.” The cartographer’s little ship is gone by the next watch, running dark, somewhere ahead of the writ.',
                  ],
                },
              ],
            ],
          },
        ],
      },
    },
  },

  {
    id: 'child-hunted',
    title: 'The Seizure Writ',
    tag: 'hostile',
    backdrop: 'space',
    weight: 0,
    when: { flagsAll: ['child-aboard'], flagsNone: ['child-safe'] },
    entry: 'start',
    nodes: {
      start: {
        text: [
          'The interdiction corvette carries a legal broadcast array bigger than its main gun, and uses it first: the writ, read in full, in four languages. One (1) vessel-of-record, harbouring one (1) item of route-property, ordered to heave to and surrender the *item*.',
          'The item is on the observation deck, watching the corvette with four steady eyes, saying nothing. She has seen this ship before. It took her mother.',
        ],
        choices: [
          {
            id: 'fight',
            label: 'The Ithaca does not surrender children',
            results: [
              [
                100,
                {
                  text: ['The legal broadcast cuts off mid-clause.'],
                  combat: {
                    enemy: 'patrol',
                    rewards: {
                      data: 4,
                      text: 'The corvette breaks off, writ unserved. On the observation deck, a small cartographer watches it burn away sternward, and finally lets herself be eleven for a while.',
                      flagsSet: ['child-safe'],
                      standing: { flotilla: 1 },
                    },
                    withdrawFollowUp: { id: 'child-hunted', days: [7, 12] },
                  },
                },
              ],
            ],
          },
        ],
      },
    },
  },
]

/* ========================================================================
 * V. Hostiles and bounties                      (pack 181–199, and teeth)
 * ====================================================================== */

const HOSTILES: EncounterDef[] = [
  {
    id: 'corsair-ambush',
    title: 'Corsairs on the Lane',
    tag: 'hostile',
    backdrop: 'space',
    weight: 16,
    unique: false,
    when: { regions: ['cinder-belt', 'rift-margin', 'xenoline'], minDay: 8 },
    entry: 'start',
    nodes: {
      start: {
        text: [
          'They were waiting in the lane’s sensor shadow with their reactor banked — an old trick, well executed. The corsair lights up at four thousand kilometres, guns already warm, and its hail is a cargo manifest: yours, annotated with what they intend to keep.',
          '“Stores and fuel, captain. Hold still and it stays a robbery.”',
        ],
        choices: [
          {
            id: 'fight',
            label: 'Clear for action',
            results: [
              [
                100,
                {
                  text: ['The Ithaca’s answer is a firing solution.'],
                  combat: {
                    enemy: 'corsair',
                    rewards: {
                      fuel: 6,
                      data: 3,
                      text: 'The corsair breaks apart, and the lane is briefly the safest it has been in years. Their sensor-shadow ambush charts, salvaged intact, mark every hunting blind in the region.',
                    },
                    withdrawFollowUp: { id: 'corsair-ambush', days: [6, 12] },
                  },
                },
              ],
            ],
          },
          {
            id: 'pay',
            label: 'Hand over the demanded stores',
            results: [
              [
                100,
                {
                  text: [
                    'The transfer is professional on both sides, which does not make it dignified. The corsair takes stores and fuel and leaves the Ithaca her engines — this year’s market rate for not dying. The crew watch the airlock cycle in silence.',
                  ],
                  supplies: -18,
                  fuel: -8,
                },
              ],
            ],
          },
        ],
      },
    },
  },

  {
    id: 'reaver-hunt',
    title: 'The Reaver',
    tag: 'hostile',
    backdrop: 'space',
    weight: 12,
    when: { minDay: 30, flagsNone: ['reaver-dead'] },
    entry: 'start',
    nodes: {
      start: {
        text: [
          'The silhouette on the scope matches a file entry traders pay to keep updated: KHR-77, the Reaver — unregistered, uncrewed as far as anyone has lived to verify, and in the business of hunting ships for parts it never seems to sell.',
          'It does not hail. Its weapons are already charging, methodically, like a craftsman laying out tools.',
        ],
        choices: [
          {
            id: 'fight',
            label: 'Battle stations',
            results: [
              [
                100,
                {
                  text: ['The Reaver commits to its run. The Ithaca commits to hers.'],
                  combat: {
                    enemy: 'reaver',
                    rewards: {
                      fuel: 10,
                      data: 6,
                      text: 'The KHR-77 Reaver breaks apart at last — and its hold is a museum of the hunted: parts, plating, and the intact navigation cores of ships that were never heard from again. Salvage teams work it for a full watch.',
                      flagsSet: ['reaver-dead'],
                    },
                    withdrawFollowUp: { id: 'reaver-hunt', days: [8, 15] },
                  },
                },
              ],
            ],
          },
        ],
      },
    },
  },

  // Pack 185 / 037 — the bounty chain.
  {
    id: 'bounty-broker',
    title: 'The Broker’s Contract',
    tag: 'bounty',
    portrait: P('37_human_bounty_broker.jpg'),
    backdrop: 'station',
    weight: 14,
    when: { factionSpace: true, minDay: 12 },
    entry: 'start',
    nodes: {
      start: {
        speaker: 'Q. Marchetti, bounty broker',
        text: [
          'The broker’s office is a shipping container with a desk of real wood, which out here is a statement of solvency. The contract on that desk is for a pirate called the Gannet: seventeen raids on military convoys, popular songs in three languages, payment on delivery, no questions in either direction.',
          '“Fair warning, captain,” Marchetti says, sliding the flimsy across. “Everyone likes the Gannet. That is why the fee is what it is.”',
        ],
        choices: [
          {
            id: 'take',
            label: 'Take the contract',
            results: [
              [
                100,
                {
                  text: [
                    'The flimsy goes in the safe and the Gannet’s last known heading goes to the nav table. Marchetti’s parting professional courtesy: “They will find you before you find them. They always do.”',
                  ],
                  flagsSet: ['gannet-contract'],
                  followUp: { id: 'friendly-pirate', days: [4, 9] },
                },
              ],
            ],
          },
          {
            id: 'refuse',
            label: 'Decline the work',
            results: [
              [
                100,
                {
                  text: [
                    'Marchetti files the flimsy without offence and pays a smaller fee for smaller goods: an hour of the broker’s privateer gossip, which is to say, an hour of operational intelligence with the names lightly filed off.',
                  ],
                  data: 3,
                },
              ],
            ],
          },
        ],
      },
    },
  },

  {
    id: 'friendly-pirate',
    title: 'The Gannet',
    tag: 'bounty',
    portrait: P('09_amphibian_smuggler.jpg'),
    backdrop: 'space',
    weight: 0,
    entry: 'start',
    nodes: {
      start: {
        speaker: 'The Gannet',
        text: [
          'Marchetti was right: the Gannet finds you — matching course astern with weapons cold and a dinner invitation on the emergency band, which is very much the style described in the songs.',
          'Over a genuinely excellent meal aboard her ship, the pirate lays it out: the convoys she robs are military, the cargoes she lifts are requisitioned grain, and the grain goes to the isolated colonies both fleets have written off. The account books are open on the table. They balance.',
          '“So, captain. You hold a contract on me. I hold dinner. How does this end?”',
        ],
        choices: [
          {
            id: 'execute',
            label: 'Honour the contract — take her in',
            results: [
              [
                100,
                {
                  text: ['The Gannet sighs, thanks her cook, and goes to her bridge. “Business, then. I never hold dinner against anyone.”'],
                  combat: {
                    enemy: 'corsair',
                    rewards: {
                      fuel: 12,
                      data: 5,
                      text: 'The Gannet strikes her colours, laughing on an open channel — “The songs will be terrible about you, captain!” — and the bounty clears in full. In three languages, new verses begin. They are not kind.',
                      standing: { ostrea: -1, flotilla: -1 },
                      flagsSet: ['gannet-taken'],
                    },
                  },
                },
              ],
            ],
          },
          {
            id: 'tear',
            label: 'Tear up the contract at her table',
            results: [
              [
                100,
                {
                  text: [
                    'The flimsy goes into the galley flame to a round of piratical applause. The Gannet pays for her life the only way she respects: her running charts of the war corridor — every convoy lane, every blind picket — and a standing toast to the Ithaca in every colony she feeds.',
                    'Marchetti’s next message is one line: “Refund the advance. Keep the enemies. — Q.M.”',
                  ],
                  data: 6,
                  standing: { ostrea: 1, flotilla: 1, vekar: -1 },
                  flagsSet: ['gannet-friend'],
                },
              ],
            ],
          },
        ],
      },
    },
  },

  // Pack 055 / 085 — the Custodian audit, endgame standing gate.
  {
    id: 'custodian-trial',
    title: 'The Technology Trial',
    tag: 'key',
    portrait: P('02_silicon_diplomat.jpg'),
    backdrop: 'station',
    culture: 'custodian',
    weight: 16,
    when: { minDay: 50 },
    entry: 'start',
    nodes: {
      start: {
        speaker: 'Prime-Facet, Custodian arbiter',
        text: [
          'The summons arrives on the operator channel, in antique typography, and declines to be refused: the Ithaca is invited to *audit*. The arbiter that receives you is silicon, patient, and older than the war by an amount it considers irrelevant.',
          '“You carry the network’s knowledge in your hull and its debts in your wake, castaway. The network keeps books on both. Submit to the audit, and be graded on what you have *done* — not what you have said. The reward for a favourable finding is the network’s confidence. Ships with the network’s confidence rarely stay lost.”',
        ],
        choices: [
          {
            id: 'submit',
            label: 'Submit to the audit',
            needs: { standing: ['custodian', 2] },
            results: [
              [
                100,
                {
                  text: [
                    'The audit takes a day and touches everything: the log, the lab, the ledger of debts paid and glass unbroken. The finding, printed on one strip: IN GOOD STANDING.',
                    'What follows is the network’s confidence, in the only currency it mints — the custodians’ own survey of the rift approaches, operator grade, annotated for a ship of the Ithaca’s displacement. The way home does not open. But it is, at last, *lit*.',
                  ],
                  days: 1,
                  shareClues: 2,
                  data: 6,
                  flagsSet: ['audited-good'],
                },
              ],
            ],
          },
          {
            id: 'submit-cold',
            label: 'Submit anyway, whatever the books say',
            results: [
              [
                100,
                {
                  text: [
                    'The audit takes a day. The finding is printed without malice: INSUFFICIENT RECORD. The arbiter explains, patiently, that the network’s confidence is earned in its territory — debts honoured, seals respected, its wards well-treated — and invites the Ithaca to return when the books are longer.',
                    'A consolation, unasked: the audit’s own working notes, which are themselves a modest education in what the network watches.',
                  ],
                  days: 1,
                  data: 3,
                },
              ],
            ],
          },
          {
            id: 'refuse',
            label: 'The ship’s books are her own',
            results: [
              [
                100,
                {
                  text: [
                    '“Noted,” says Prime-Facet, and the word lands like a seal in wax. The operator channel closes with unusual finality. The network keeps books regardless, of course. It merely stops showing you the totals.',
                  ],
                  standing: { custodian: -1 },
                },
              ],
            ],
          },
        ],
      },
    },
  },
]


/* ========================================================================
 * VI. The Doorway Home                          (pack 030, 110, 200)
 *
 * Never rolled at random: the correct Long Jump opens it. At high war
 * pressure the gate is contested first — every relationship the campaign
 * built is a way through, and punching through is always available, at a
 * price, with no withdrawing from the final battle. The threshold node is
 * the run's last choice, and the endings it offers are gated on what the
 * ship actually did out here.
 * ==================================================================== */

const FINALE: EncounterDef[] = [
  {
    id: 'doorway-home',
    title: 'The Doorway Home',
    tag: 'key',
    backdrop: 'space',
    weight: 0,
    entry: 'threshold',
    nodes: {
      contested: {
        text: [
          'The reserve burns, the light goes wrong — and holds. The rift opens onto the terminus system, and the terminus system is on fire. Two fleets hang across the approach to the gate: Ascendancy lances in garrison formation, Compact squadrons in blockade, both of them shooting at anything that moves toward the door neither of them can use.',
          'The gate itself stands beyond the battle, vast and patient and indifferent, keeping station on a timing signal older than either flag. Every hour of this war has been leaning on this system, and now the Ithaca has to cross it.',
        ],
        choices: [
          {
            id: 'admiral',
            label: 'Fly the Admiral’s map — the hour of the watch, the lane that lives',
            needs: { flag: 'admiral-friend' },
            results: [
              [
                100,
                {
                  text: [
                    'The old man’s chart earns its price at last: not a route but a *timetable* — the eleven minutes of every watch rotation when the picket overlaps thin out to nothing. The Ithaca threads the battle without firing a shot, and somewhere on a neutral rock, an ancient bartender feels briefly, inexplicably pleased.',
                  ],
                  goto: 'threshold',
                },
              ],
            ],
          },
          {
            id: 'vekar-passage',
            label: 'Call in the Ascendancy — request escort under their flag',
            needs: { standing: ['vekar', 1] },
            results: [
              [
                100,
                {
                  text: [
                    'The Ascendancy remembers its friends. Three lances peel out of the garrison line and box the Ithaca in a formal escort, daring the blockade to make something of it. The blockade, arithmetic being what it is, does not. At the gate’s threshold the escort commander transmits two words — “Debts even” — and returns to the war.',
                  ],
                  goto: 'threshold',
                },
              ],
            ],
          },
          {
            id: 'ostrea-passage',
            label: 'Call in the Compact — a merchant flag for a merchant lane',
            needs: { standing: ['ostrea', 1] },
            results: [
              [
                100,
                {
                  text: [
                    'The Compact does what the Compact has always claimed the war is for: it keeps a lane open. The blockade parts along a corridor exactly one ship wide, held by squadrons that have decided the Ithaca’s account is in credit. Convoy discipline, applied to a single hull, all the way to the door.',
                  ],
                  goto: 'threshold',
                },
              ],
            ],
          },
          {
            id: 'gannet-lane',
            label: 'Fly the Gannet’s blind lane through the pickets',
            needs: { flag: 'gannet-friend' },
            results: [
              [
                100,
                {
                  text: [
                    'The pirate’s running charts mark every sensor shadow in the terminus approach — she has been robbing this blockade for years. The Ithaca crosses the battle the way the Gannet crosses everything: invisibly, insolently, and humming. Somewhere out in the colonies, a new verse is already forming.',
                  ],
                  goto: 'threshold',
                },
              ],
            ],
          },
          {
            id: 'punch',
            label: 'Punch through the blockade — there is no way back from this',
            results: [
              [
                100,
                {
                  text: [
                    'No passage, no flag, no favours left to call. The Ithaca goes to battle stations one last time and commits to the gap — and a ship of the line commits to closing it. Behind her, the reserve is already burned. There is nothing to withdraw to.',
                  ],
                  combat: {
                    enemy: 'warship',
                    noWithdraw: true,
                    rewards: {
                      text: 'The blockade ship falls away, burning, and the lane to the gate stands open. The last battle of the voyage is over.',
                      resumeEncounter: { id: 'doorway-home', node: 'threshold' },
                    },
                  },
                },
              ],
            ],
          },
        ],
      },
      threshold: {
        text: [
          'The gate accepts the Ithaca’s harmonics the way a lock accepts a key it was cut for. Beyond the threshold, the readings are unambiguous for the first time in the whole long voyage: charted space, human bands, the slow radio murmur of home. The way is open, and it is real.',
          'And the door, the drive reports, can be *held* — for a while, at a cost, by a ship standing in it. The whole crew is on the bridge now, nobody having been ordered there. This is the last decision, and everyone knows it.',
        ],
        choices: [
          {
            id: 'return',
            label: 'Take everyone home. Now',
            results: [
              [
                100,
                {
                  text: [
                    'The Ithaca crosses the threshold and the stars ahead are stars with names. We are in charted space. We are going home.',
                  ],
                  endRun: 'return',
                },
              ],
            ],
          },
          {
            id: 'coalition',
            label: 'Hold the door for the refugee constellation',
            needs: { flag: 'convoy-friend' },
            results: [
              [
                100,
                {
                  text: [
                    'The signal goes out on the convoy frequencies, and the constellation answers: ninety civilian hulls, then more — every formation the war taught to fly without radios, spelling one word across the terminus approach as they come. The Ithaca stands in the door and holds it, drive screaming, while the grandmothers’ freighters and the school barges pass through into a sky with no front line.',
                    'Then, last of all, she follows her convoy home.',
                  ],
                  endRun: 'coalition',
                },
              ],
            ],
          },
          {
            id: 'keeper',
            label: 'Stay a season — repair the network, then follow',
            needs: { standing: ['custodian', 2] },
            results: [
              [
                100,
                {
                  text: [
                    'The operator channel prints one line — PROPOSAL RECEIVED. ACCEPTED. — and the network takes the Ithaca into its confidence entirely. A season of relay corrections and timing repairs, custodian machines working alongside human engineers who have become, by the network’s cold arithmetic, *trusted*.',
                    'When the ship finally crosses the threshold, the gates behind her are lit for the first time in ten thousand years — and the region she leaves is measurably less lost than she found it.',
                  ],
                  endRun: 'keeper',
                },
              ],
            ],
          },
          {
            id: 'lighthouse',
            label: 'Send the plot home — and keep the ship out here',
            results: [
              [
                100,
                {
                  text: [
                    'The whole plot goes through the door in a tight-beam packet: every account, every bearing, every provenance note, addressed to the survey service with the Ithaca’s compliments and her position. Then the ship comes about, and stays.',
                    'Somebody has to be the light in this dark — for the next crew the rift takes, for the convoys, for every lost thing the ship met on the way here. The vote was unanimous. Home knows the way now. The Ithaca keeps the door.',
                  ],
                  endRun: 'lighthouse',
                },
              ],
            ],
          },
        ],
      },
    },
  },
]

/* ======================================================================== */

export const ENCOUNTERS: EncounterDef[] = [
  ...ROUTE_ARC,
  ...CONTACTS,
  ...WAR,
  ...SHIPBOARD,
  ...DERELICTS,
  ...WORLDS,
  ...HOSTILES,
  ...FINALE,
]

const BY_ID = new Map(ENCOUNTERS.map((e) => [e.id, e]))

export function encounterDef(id: string): EncounterDef | undefined {
  return BY_ID.get(id)
}
