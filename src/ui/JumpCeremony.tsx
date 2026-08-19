import { useEffect, useMemo, useState } from 'react'
import type { SystemId } from '../engine/worldgen/types.js'
import { useDispatch, useGame, useNavPlot } from './store.js'

/**
 * The commit, staged. The whole game funnels into this moment, so it gets a
 * ceremony instead of an instant state swap: the send-off (coloured by how
 * narrow the plot actually is), the burn, then the reveal. On success the
 * ending overlay takes the stage; on failure this shows the cost before
 * handing back a galaxy that just got larger again.
 */
export function JumpCeremony({
  target,
  name,
  onClose,
}: {
  target: SystemId
  name: string
  onClose: () => void
}) {
  const dispatch = useDispatch()
  const outcome = useGame((s) => s.state.outcome)
  const jumps = useGame((s) => s.state.jumps)
  const shipAt = useGame((s) => s.state.ship.at)
  const fuel = useGame((s) => s.state.ship.fuel)
  const systems = useGame((s) => s.state.galaxy.systems)
  const { candidates, candidateSet } = useNavPlot()
  const [phase, setPhase] = useState<'burn' | 'result'>('burn')

  // The send-off, judged once, at the moment of commitment.
  const sendOff = useMemo(() => {
    if (!candidateSet.has(target))
      return 'Your own plot rules this star out. The bridge is very quiet while the reserve burns.'
    if (candidates.length === 1)
      return 'The plot names one star, and this is it. The whole ship’s company is on the bridge to watch.'
    if (candidates.length <= 3)
      return `The plot still admits ${candidates.length} stars. Someone exhales, slowly, as the drive charges.`
    return `The plot still admits ${candidates.length} stars. The ship jumps on your conviction, not its arithmetic.`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      dispatch({ type: 'plotTheJump', target })
      setPhase('result')
    }, 2600)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Success: the ship arrives at the threshold and the gateway scene owns
  // the stage (a run that ends some other way hands off to its ending).
  const arrived = jumps[jumps.length - 1]?.correct === true
  useEffect(() => {
    if (phase === 'result' && (outcome !== 'seeking' || arrived)) onClose()
  }, [phase, outcome, arrived, onClose])

  if (phase === 'result' && (outcome !== 'seeking' || arrived)) return null

  const lastJump = jumps[jumps.length - 1]
  const failed = phase === 'result' && lastJump && !lastJump.correct
  const displacedName = systems.find((s) => s.id === shipAt)?.name ?? shipAt

  return (
    <div className="jump-ceremony">
      <div className="jump-veil" aria-hidden="true" />
      {phase === 'burn' || !failed ? (
        <div className="jump-copy">
          <div className="eyebrow">The Long Jump</div>
          <h2>{name}</h2>
          <p>{sendOff}</p>
          <div className="jump-charge" aria-hidden="true"><i /></div>
          <span className="jump-note">The reserve burns. The light goes wrong.</span>
        </div>
      ) : (
        <div className="jump-copy is-failed">
          <div className="eyebrow">Attempt {jumps.length}</div>
          <h2>The anomaly was not there.</h2>
          <p>
            The rift spat the ship out at {displacedName} with {fuel} fuel and a scarred drive.
            The plot was wrong somewhere — an account you trusted, lying quietly this whole time.
            The galaxy just got larger again.
          </p>
          <button className="jump-continue" onClick={onClose}>
            Back to the chart <span>›</span>
          </button>
        </div>
      )}
    </div>
  )
}
