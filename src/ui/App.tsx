import { useEffect, useRef, useState } from 'react'
import { createCampaign } from '../engine/exploration/campaign.js'
import type { Campaign } from '../engine/exploration/campaign.js'
import { ExplorationDeck } from './ExplorationDeck.js'
import { OpeningBriefing } from './OpeningBriefing.js'
import { loadExploration } from './exploration-save.js'
import type { ExplorationSave } from './exploration-save.js'
import { browserStorage } from './save.js'
import { StartScreen } from './StartScreen.js'
import { useSound } from './sound.js'

/** Read the expedition autosave, if this browser allows storage. */
function readExpedition(): ExplorationSave {
  const storage = browserStorage()
  if (!storage) return { campaign: null, error: null }
  try { return loadExploration(storage) }
  catch { return { campaign: null, error: 'Expedition autosave cannot be read in this browser.' } }
}

export function App() {
  const [expedition, setExpedition] = useState<Campaign | null>(null)
  const [opening, setOpening] = useState<Campaign | null>(null)
  const [saved, setSaved] = useState<ExplorationSave>(readExpedition)
  const [storageBlocked] = useState(() => browserStorage() === null)
  const muted = useSound((s) => s.muted)
  const music = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const theme = new Audio('/assets/audio/starship-ithaca-theme.mp3')
    theme.loop = true
    theme.volume = 0.34
    theme.muted = useSound.getState().muted
    music.current = theme
    return () => { theme.pause(); music.current = null }
  }, [])
  useEffect(() => { if (music.current) music.current.muted = muted }, [muted])

  const leave = () => { setOpening(null); setExpedition(null); setSaved(readExpedition()) }
  const enter = (seed?: string, resume = false) => {
    const campaign = resume ? saved.campaign : createCampaign((seed || `explore-${Date.now().toString(36)}`).slice(0, 200))
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
        explorationSaved={!!saved.campaign}
        explorationError={saved.error}
        storageBlocked={storageBlocked}
      /></div>
}
