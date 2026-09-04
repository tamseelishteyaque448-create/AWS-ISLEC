export const events = [
  { date: "28 AUG", startsAt: "2026-08-28T18:00:00Z", title: "Ship it: a serverless study hall", type: "Virtual", time: "18:00 UTC", status: "Upcoming", context: "Bring the project you are stuck on. We will make progress together, one small deployment at a time.", attendance: "Open study hall" },
  { date: "03 SEP", startsAt: "2026-09-03T16:30:00Z", title: "Designing for the cloud", type: "Workshop", time: "16:30 UTC", status: "Upcoming", context: "A hands-on session for making technical decisions that serve both the system and the people using it.", attendance: "Guided workshop" },
  { date: "11 SEP", startsAt: "2026-09-11T19:00:00Z", title: "Community demo night", type: "Showcase", time: "19:00 UTC", status: "Upcoming", context: "Share a rough edge, a small win, or the question your latest build gave you. First versions welcome.", attendance: "Show and tell" },
  { date: "15 AUG", startsAt: "2026-08-15T18:00:00Z", title: "Patterns for a calmer serverless stack", type: "Study hall", time: "Recap available", status: "Past", context: "Members compared notes on resilient serverless patterns and left with experiments to try in their own builds.", attendance: "24 builders joined" },
  { date: "08 AUG", startsAt: "2026-08-08T18:00:00Z", title: "First deploy celebration", type: "Community", time: "Recap available", status: "Past", context: "A room full of first launches, useful feedback, and proof that progress gets easier when it is shared.", attendance: "18 first deploys" },
];

export function getEventStatus(event: (typeof events)[number], now = new Date()) {
  return new Date(event.startsAt) > now ? "Upcoming" : "Past";
}
