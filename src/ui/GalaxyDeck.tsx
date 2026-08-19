import { useEffect, useState } from 'react'
import { CommandRail } from './CommandRail.js'
import { EvidenceDrawer } from './EvidenceDrawer.js'
import { guideSeen, MapGuide, markGuideSeen } from './MapGuide.js'
import { StarMap } from './StarMap.js'

/**
 * The Galaxy station: the chart, full bleed, with the command rail docked
 * along its foot and the evidence drawer rising over it on request. Nothing
 * is docked to the side any more — the sky is the screen, and everything
 * else floats on top of it or lifts off it.
 */
export function GalaxyDeck() {
  const [evidenceOpen, setEvidenceOpen] = useState(false)
  // The chart briefing plays once per browser, the first time the station is
  // taken. After that it is on the "?" control, never in the way.
  const [guideOpen, setGuideOpen] = useState(() => !guideSeen())

  useEffect(() => {
    if (guideOpen) markGuideSeen()
  }, [guideOpen])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setGuideOpen(false)
      setEvidenceOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="galaxy-deck relative h-full min-h-0 overflow-hidden">
      <StarMap evidenceOpen={evidenceOpen} onOpenGuide={() => setGuideOpen(true)} />
      {evidenceOpen && <EvidenceDrawer onClose={() => setEvidenceOpen(false)} />}
      <CommandRail
        evidenceOpen={evidenceOpen}
        onToggleEvidence={() => setEvidenceOpen((open) => !open)}
      />
      {guideOpen && <MapGuide onClose={() => setGuideOpen(false)} />}
    </div>
  )
}
