"use client";

export function EventDetailError({ reset }: { reset: () => void }) {
  return <section className="admin-member-error" role="alert"><h2>Event details are temporarily unavailable.</h2><p>Please try again in a moment.</p><button className="button button-secondary" type="button" onClick={reset}>Try again</button></section>;
}
