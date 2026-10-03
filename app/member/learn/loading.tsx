export default function Loading() {
  return (
    <div className="build-loading" aria-busy="true" aria-label="Loading Build & Prove">
      {Array.from({ length: 4 }, (_, index) => (
        <article className="build-loading-card" key={index}>
          <span className="tag">Loading</span>
          <h2>Loading assigned work…</h2>
        </article>
      ))}
    </div>
  );
}
