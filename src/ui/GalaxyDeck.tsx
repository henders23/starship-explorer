import { useEffect, useState } from 'react'
import { PlotBar } from './PlotBar.js'
import { EvidenceDrawer } from './EvidenceDrawer.js'
import { guideSeen, MapGuide, markGuideSeen } from './MapGuide.js'
import { StarMap } from './StarMap.js'
import { SystemPanel } from './SystemPanel.js'

/**
 * The Galaxy station: the chart, full bleed, with the inspector docked to its
 * right, the plot bar along its foot and the evidence drawer rising over that
 * on request. Nothing takes a column out of the sky permanently — the chart is
 * the screen, and everything else floats on top of it or lifts off it.
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
      <SystemPanel />
      {evidenceOpen && <EvidenceDrawer onClose={() => setEvidenceOpen(false)} />}
      <PlotBar
        evidenceOpen={evidenceOpen}
        onToggleEvidence={() => setEvidenceOpen((open) => !open)}
      />
      {guideOpen && <MapGuide onClose={() => setGuideOpen(false)} />}
    </div>
  )
}
