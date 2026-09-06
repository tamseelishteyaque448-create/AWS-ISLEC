"use client";

import { useSyncExternalStore } from "react";

function format(value: string, timeZone?: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "full", timeStyle: "short", timeZone }).format(new Date(value));
}

export function EventDateTime({ startsAt, endsAt }: { startsAt: string; endsAt: string | null }) {
  const local = useSyncExternalStore(
    () => () => undefined,
    () => {
    const start = format(startsAt);
    const end = endsAt ? ` – ${new Intl.DateTimeFormat("en", { timeStyle: "short" }).format(new Date(endsAt))}` : "";
      return `${start}${end}`;
    },
    () => null,
  );
  const utcStart = format(startsAt, "UTC");
  const utcEnd = endsAt ? ` – ${new Intl.DateTimeFormat("en", { timeStyle: "short", timeZone: "UTC" }).format(new Date(endsAt))}` : "";
  return <><strong suppressHydrationWarning>{local ?? `${utcStart}${utcEnd}`}</strong><span>{`${utcStart}${utcEnd} UTC`}</span></>;
}
