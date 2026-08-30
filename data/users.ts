export type User = { name: string; handle: string; role: string; points: number; streak: number };
export const currentUser: User = { name: "Alex Morgan", handle: "@alexm", role: "Cloud builder", points: 1840, streak: 12 };
export const leaders = [
  { rank: 1, name: "Maya Chen", handle: "@mayac", points: 3120 },
  { rank: 2, name: "Alex Morgan", handle: "@alexm", points: 1840 },
  { rank: 3, name: "Jon Bell", handle: "@jonb", points: 1660 },
];
