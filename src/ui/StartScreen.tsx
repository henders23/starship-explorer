export function StartScreen({ onBegin }: { onBegin: () => void }) {
  return (
    <div className="start-screen">
      <div className="start-art" aria-hidden="true" />
      <div className="start-veil" aria-hidden="true" />
      <div className="start-copy">
        <div className="eyebrow">ISS Indefatigable · Corvette 05</div>
        <h1>
          Starship <em>Explorer</em>
        </h1>
        <p>
          The rift threw you across a strange sky. Somewhere in the evidence is the
          way home — and the crew is watching you read it.
        </p>
        <button className="start-begin" onClick={onBegin}>
          Take command <span>›</span>
        </button>
      </div>
    </div>
  )
}
