export default function Loading() {
  return (
    <section className="project-discovery-loading" aria-busy="true" aria-label="Loading project discovery">
      <div className="project-discovery-loading-toolbar" />
      <div className="project-discovery-loading-grid">
        {Array.from({ length: 4 }, (_, index) => <div className="project-discovery-loading-card" key={index} />)}
      </div>
    </section>
  );
}
