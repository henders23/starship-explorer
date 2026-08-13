export function StartScreen({ onBegin }: { onBegin: () => void }) {
  return (
    <div className="start-screen">
      <div className="start-art" aria-hidden="true" />
      <div className="start-veil" aria-hidden="true" />
      <div className="start-copy">
        <h1>
          Starship <em>Explorer</em>
        </h1>
        <p>Bring you and your crew home</p>
        <button className="start-begin" onClick={onBegin}>
          Take command <span>›</span>
        </button>
      </div>
    </div>
  )
}
