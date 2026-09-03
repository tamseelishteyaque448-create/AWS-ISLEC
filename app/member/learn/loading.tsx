export default function Loading() {
  return <div className="grid" aria-busy="true" aria-label="Loading learning paths">
    {Array.from({ length: 3 }, (_, index) => (
      <article className="panel" key={index}>
        <span className="tag">Loading</span>
        <h2 style={{ marginTop: 18 }}>Loading learning path…</h2>
        <p className="muted">Fetching the latest practical challenges.</p>
      </article>
    ))}
  </div>;
}
