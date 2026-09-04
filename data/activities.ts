export type Activity = {
  id: string;
  type: "project" | "lesson" | "badge" | "event" | "challenge";
  title: string;
  detail: string;
  date: string;
  points: number;
};

export const activities: Activity[] = [
  { id: "activity-1", type: "project", title: "Updated Signal Garden", detail: "Added request tracing to the API", date: "Today", points: 80 },
  { id: "activity-2", type: "lesson", title: "Completed Open book", detail: "AWS fundamentals path", date: "Yesterday", points: 120 },
  { id: "activity-3", type: "badge", title: "Earned First deploy", detail: "Your first app is live", date: "18 Aug", points: 250 },
  { id: "activity-4", type: "event", title: "Joined study hall", detail: "Serverless patterns", date: "15 Aug", points: 40 },
];
