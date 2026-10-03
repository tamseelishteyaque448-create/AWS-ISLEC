"use client";

import { useEffect } from "react";

export default function BuildProveError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Build & Prove screen failed to load.", error.digest);
  }, [error.digest]);

  return (
    <section className="build-empty panel" role="alert">
      <h2>Build & Prove is temporarily unavailable.</h2>
      <p className="muted">Your work has not been changed. Please try again.</p>
      <button className="button button-secondary" type="button" onClick={reset}>Try again</button>
    </section>
  );
}
