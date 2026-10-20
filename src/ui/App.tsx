import { useEffect, useRef, useState } from 'react'
import { createCampaign, reduceCampaign } from '../engine/exploration/campaign.js'
import type { Campaign } from '../engine/exploration/campaign.js'
import { ExplorationDeck } from './ExplorationDeck.js'
import { OpeningBriefing } from './OpeningBriefing.js'
import { loadExploration } from './exploration-save.js'
import type { ExplorationSave } from './exploration-save.js'
import { browserStorage } from './save.js'
import { StartScreen } from './StartScreen.js'
import { useSound, useSoundscape } from './sound.js'

/** Open Expedition is the only playable campaign. Legacy save keys remain untouched. */
function readExpedition(): ExplorationSave {
  const storage = browserStorage()
  if (!storage) return { campaign: null, error: null }
  try { return loadExploration(storage) }
  catch { return { campaign: null, error: 'Expedition autosave cannot be read in this browser.' } }
}

/** Archived ship-hub modules retain this type for historical compilation. */
export type Screen = 'ship' | 'galaxy' | 'loadout' | 'lab'

export function App() {
  const [expedition, setExpedition] = useState<Campaign | null>(null)
  const [opening, setOpening] = useState<Campaign | null>(null)
  const [saved, setSaved] = useState<ExplorationSave>(readExpedition)
  const [storageBlocked] = useState(() => browserStorage() === null)
  const muted = useSound((s) => s.muted)
  const music = useRef<HTMLAudioElement | null>(null)
  const hum = useRef<HTMLAudioElement | null>(null)
  const scene = useSoundscape((s) => s.scene)

  useEffect(() => {
    const theme = new Audio('/assets/audio/starship-ithaca-theme.mp3')
    theme.loop = true
    theme.volume = 0.34
    theme.muted = useSound.getState().muted
    music.current = theme
    // The Lodestar's engine hum, from the first build's bridge, under everything aboard.
    const engines = new Audio('/assets/audio/ship-ambient.mp3')
    engines.loop = true
    engines.volume = 0
    engines.muted = useSound.getState().muted
    hum.current = engines
    return () => { theme.pause(); engines.pause(); music.current = null; hum.current = null }
  }, [])
  useEffect(() => { for (const audio of [music.current, hum.current]) if (audio) audio.muted = muted }, [muted])
  // Aboard, the hum sits under the theme; at battle stations the engines swell and the music ducks.
  const aboard = !!expedition
  useEffect(() => {
    const theme = music.current, engines = hum.current
    if (!theme || !engines) return
    const battle = aboard && scene === 'battle'
    const target = { theme: battle ? 0.12 : 0.34, hum: !aboard ? 0 : battle ? 0.3 : 0.1 }
    if (aboard) void engines.play().catch(() => {})
    const start = { theme: theme.volume, hum: engines.volume }, began = performance.now()
    let frame = 0
    const fade = (now: number) => {
      // A frame timestamp can precede the fade starting; clamp so volumes stay in range.
      const t = Math.max(0, Math.min(1, (now - began) / 1200))
      theme.volume = start.theme + (target.theme - start.theme) * t
      engines.volume = start.hum + (target.hum - start.hum) * t
      if (t < 1) frame = requestAnimationFrame(fade)
      else if (!aboard) engines.pause()
    }
    frame = requestAnimationFrame(fade)
    return () => cancelAnimationFrame(frame)
  }, [aboard, scene])

  const leave = () => { setOpening(null); setExpedition(null); setSaved(readExpedition()) }
  const enter = (seed?: string, resume = false, hardcore = false) => {
    const fresh = resume ? null : createCampaign((seed || `explore-${Date.now().toString(36)}`).slice(0, 200))
    const begun = fresh && reduceCampaign(fresh, { type: 'begin' })
    const campaign = resume ? saved.campaign : hardcore ? reduceCampaign(begun!, { type: 'hardcore' }) : begun
    if (!campaign) return
    void music.current?.play().catch(() => {})
    if (resume) setExpedition(campaign)
    else setOpening(campaign)
  }

  return opening ? <OpeningBriefing
    onBack={() => setOpening(null)}
    onComplete={() => { setExpedition(opening); setOpening(null) }}
  /> : expedition
    ? <ExplorationDeck initial={expedition} onExit={leave} />
    : <div className="crt app-shell h-full"><StartScreen
        onExplore={enter}
        explorationSaved={!!saved.campaign && saved.campaign.outcome !== 'lost'}
        explorationError={saved.error}
        storageBlocked={storageBlocked}
      /></div>
}
