import { Component, Fragment } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface CrashState {
  error: Error | null
  /** Bumped on recovery so the game remounts from the title screen. */
  attempt: number
}

/**
 * Without this, any rendering fault blanks the whole page. Expedition saves
 * are written after an accepted action renders, so the last autosave predates
 * the fault and the title screen can resume from it.
 */
export class CrashBoundary extends Component<{ children: ReactNode }, CrashState> {
  override state: CrashState = { error: null, attempt: 0 }

  static getDerivedStateFromError(error: Error): Partial<CrashState> {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Starship Ithaca stopped rendering', error, info.componentStack)
  }

  override render() {
    const { error, attempt } = this.state
    if (!error) return <Fragment key={attempt}>{this.props.children}</Fragment>
    return (
      <main className="crash-screen">
        <section role="alert" aria-labelledby="crash-title">
          <span className="exp-eyebrow">ISS ITHACA / SYSTEM FAULT</span>
          <h1 id="crash-title">The ship’s computer stopped responding.</h1>
          <p>Your saved progress is kept. Return to the title screen to resume from your last autosave.</p>
          <div className="crash-actions">
            <button className="exp-button primary" onClick={() => this.setState({ error: null, attempt: attempt + 1 })}>
              Return to title screen
            </button>
            <button className="exp-button" onClick={() => window.location.reload()}>Reload page</button>
          </div>
          <details>
            <summary>Technical details</summary>
            <pre>{error.message}</pre>
          </details>
        </section>
      </main>
    )
  }
}
