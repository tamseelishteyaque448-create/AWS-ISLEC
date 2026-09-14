"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <section className="admin-member-error"><h2>The project is temporarily unavailable.</h2><p>Please try again.</p><button className="button button-secondary" type="button" onClick={reset}>Try again</button></section>;
}
