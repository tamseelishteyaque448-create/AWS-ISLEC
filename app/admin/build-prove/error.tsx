"use client";

export default function AdminBuildProveError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <section className="admin-build-error" role="alert">
    <div className="eyebrow">Build &amp; Prove</div>
    <h2>This admin view could not be loaded.</h2>
    <p>Your work has not been changed. Retry the request or return to the catalogue.</p>
    <div className="admin-build-error-actions">
      <button className="button" type="button" onClick={reset}>Try again</button>
      <a className="button button-secondary" href="/admin/build-prove">Return to catalogue</a>
    </div>
  </section>;
}
