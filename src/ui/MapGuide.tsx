/**
 * The chart briefing: one slide, shown the first time the captain takes the
 * Galaxy station, and reachable afterwards from the "?" on the map controls.
 *
 * It exists because the chart is the one screen the game never explains in
 * dialogue — the crew brief you on the mission, not on how to read an
 * instrument they assume you have used all your life. This is that
 * assumption, written down: how the chart is laid out, what the marks mean,
 * how to move. It teaches navigation only — nothing here hints at the answer.
 */
const GUIDE_KEY = 'starship-explorer-map-guide-seen'

/** Whether this browser has already been shown the chart briefing. */
export function guideSeen(storage: Storage = window.localStorage): boolean {
  try {
    return storage.getItem(GUIDE_KEY) === '1'
  } catch {
    // Private modes can refuse storage entirely; a briefing every time is a
    // far smaller failure than a chart that will not open.
    return false
  }
}

export function markGuideSeen(storage: Storage = window.localStorage): void {
  try {
    storage.setItem(GUIDE_KEY, '1')
  } catch {
    /* nothing to do: the briefing simply shows again next voyage */
  }
}

export function MapGuide({ onClose }: { onClose: () => void }) {
  return (
    <div className="guide-veil" role="dialog" aria-modal="true" aria-labelledby="map-guide-title">
      <div className="guide-card">
        <div className="guide-kicker">Astrogation · standing orders</div>
        <h2 id="map-guide-title">Reading the chart</h2>
        <p className="guide-lede">
          Ninety stars, and exactly one of them is the way home. The chart does not know which —
          it only shows you which ones your accounts still allow. It is drawn outward from the
          galactic core: the Shallows where the anomaly dropped you lie at the left edge, the
          Rift Margin at the right, and the voyage reads across the screen. Because the sector is
          wider across than it is deep, the two axes are drawn to different scales — trust the
          jumps and fuel the inspector quotes, never the distance your eye measures.
        </p>

        <div className="guide-columns">
          <section>
            <h3>The marks</h3>
            <ul>
              <li>
                <GuideMark>
                  <polygon points={hex(9, 9, 6.4)} fill="none" stroke="var(--color-amber)" strokeWidth={1.3} />
                  <circle cx={9} cy={9} r={2.2} fill="var(--color-amber)" />
                </GuideMark>
                <span>
                  <strong>Still possible</strong> — fits every account you trust, and pulses so the
                  field that is left can be found without reading a name. Nothing is amber until
                  you have trusted something: before that, every star is possible.
                </span>
              </li>
              <li>
                <GuideMark>
                  <polygon points={hex(9, 9, 5)} fill="none" stroke="var(--color-chart-dim)" strokeWidth={1} />
                  <circle cx={9} cy={9} r={1.6} fill="var(--color-chart-dim)" />
                </GuideMark>
                <span>
                  <strong>Ruled out</strong> — kept on the chart, because knowing what you have
                  eliminated is half of knowing anything. Stars the tank can no longer reach fade
                  further still.
                </span>
              </li>
              <li>
                <GuideMark>
                  <polygon points={hex(9, 9, 6.4)} fill="none" stroke="var(--color-course)" strokeWidth={1.3} />
                  <circle cx={9} cy={9} r={2.2} fill="var(--color-course)" />
                </GuideMark>
                <span>
                  <strong>The Ithaca</strong> — where you are, pinging. Lanes run between stars;
                  fuel is spent by the lane, and the dashed rings are the stars one lane out.
                </span>
              </li>
              <li>
                <GuideMark>
                  <circle cx={9} cy={9} r={7} fill="none" stroke="var(--color-phosphor)" strokeWidth={1} strokeDasharray="2.5 3" />
                  <circle cx={9} cy={9} r={2} fill="var(--color-phosphor)" />
                </GuideMark>
                <span>
                  <strong>Evidence</strong> — something waits there. Fly to it and respond to
                  collect the account.
                </span>
              </li>
              <li>
                <GuideMark>
                  <rect x={5.5} y={5.5} width={7} height={7} fill="none" stroke="var(--color-phosphor)" strokeWidth={1} transform="rotate(45 9 9)" />
                </GuideMark>
                <span>
                  <strong>Specialist</strong> — someone dockside is looking for a berth.
                </span>
              </li>
              <li>
                <GuideMark>
                  <path d="M 4 4 L 14 14 M 14 4 L 4 14" stroke="var(--color-alarm)" strokeWidth={1.3} />
                </GuideMark>
                <span>
                  <strong>Jump attempted</strong> — you bet the reserve on this star and the
                  anomaly was not there.
                </span>
              </li>
            </ul>
          </section>

          <section>
            <h3>Moving about</h3>
            <ul className="guide-keys">
              <li><kbd>drag</kbd><span>pan the chart</span></li>
              <li><kbd>scroll</kbd><span>zoom in and out</span></li>
              <li><kbd>+</kbd><kbd>−</kbd><span>zoom by steps</span></li>
              <li><kbd>0</kbd><span>reset the view</span></li>
              <li><kbd>←</kbd><kbd>↑</kbd><kbd>↓</kbd><kbd>→</kbd><span>step to the next star that way</span></li>
              <li><kbd>click</kbd><span>select a star</span></li>
              <li><kbd>⌕</kbd><span>find a star by name</span></li>
              <li><kbd>1</kbd>–<kbd>4</kbd><span>switch stations</span></li>
            </ul>
          </section>

          <section>
            <h3>The panel and the bar</h3>
            <p>
              Click a star and the <strong>inspector</strong> opens on the right: its catalogue
              entry, where it stands in your plot, what anything waiting there is, what the trip
              costs — and every order the ship can carry out from travelling the lanes to
              committing the Long Jump.
            </p>
            <p>
              The <strong>plot bar</strong> along the foot is the score. It counts the stars still
              standing and lists them; every name on it is a chip you can click to fly the
              selection straight there.
            </p>
            <p>
              <strong>Evidence</strong> raises the drawer of accounts. Trust one and the field
              narrows; doubt one and it widens again. Some of them are lies.
            </p>
          </section>
        </div>

        <div className="guide-foot">
          <button onClick={onClose} className="guide-go">Take the chart</button>
          <span className="guide-hint">The “?” beside the zoom brings this back.</span>
        </div>
      </div>
    </div>
  )
}

/** The system glyph, at legend size. */
function hex(x: number, y: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 90)
    return `${(x + r * Math.cos(a)).toFixed(1)},${(y + r * Math.sin(a)).toFixed(1)}`
  }).join(' ')
}

function GuideMark({ children }: { children: React.ReactNode }) {
  return (
    <svg width={18} height={18} viewBox="0 0 18 18" aria-hidden="true">
      {children}
    </svg>
  )
}
