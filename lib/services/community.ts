import "server-only";
import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { supabaseRepository } from "@/lib/services";
import { getPublicEvents } from "@/lib/services/events";
import { getPublicProjects } from "@/lib/services/projects";

export async function getPublicCommunitySnapshot() {
  const [learningPaths, events, projects] = await Promise.all([
    supabaseRepository.getPublicLearningCatalogue(),
    getPublicEvents(),
    getPublicProjects(),
  ]);

  return {
    learningPaths,
    challenges: learningPaths.flatMap((path) => path.challenges),
    events,
    projects,
  };
}

export type AdminCommunityOverview = {
  memberCount: number;
  publishedChallengeCount: number;
  activeProjectCount: number;
  upcomingEventCount: number;
  members: Array<{ id: string; fullName: string; handle: string; points: number }>;
  events: Array<{ id: string; title: string; eventType: string; startsAt: string }>;
  challenges: Array<{ id: string; title: string; detail: string; level: string; points: number }>;
  projects: Array<{ id: string; title: string; category: string; status: string; progress: number }>;
  activities: Array<{ id: string; title: string; detail: string; points: number; occurredAt: string }>;
};

export async function getAdminCommunityOverview(): Promise<AdminCommunityOverview> {
  await requireAdmin();
  const supabase = await createClient();
  const now = new Date().toISOString();
  const [membersResult, challengesResult, projectsResult, eventsResult, activitiesResult] = await Promise.all([
    supabase.from("profiles").select("id, full_name, handle, points", { count: "exact" }).order("points", { ascending: false }).order("created_at", { ascending: true }).limit(5),
    supabase.from("challenges").select("id, title, detail, level, points, learning_paths!inner(is_published)", { count: "exact" }).eq("is_published", true).eq("learning_paths.is_published", true).order("sort_order", { ascending: true }).limit(5),
    supabase.from("projects").select("id, title, category, status, progress", { count: "exact" }).eq("status", "in_progress").order("updated_at", { ascending: false }).limit(5),
    supabase.from("events").select("id, title, event_type, starts_at", { count: "exact" }).eq("status", "upcoming").gt("starts_at", now).order("starts_at", { ascending: true }).limit(3),
    supabase.from("activities").select("id, title, detail, points, occurred_at").order("occurred_at", { ascending: false }).limit(5),
  ]);

  if (membersResult.error || challengesResult.error || projectsResult.error || eventsResult.error || activitiesResult.error) {
    throw new Error("Unable to load the community overview.");
  }

  return {
    memberCount: membersResult.count ?? 0,
    publishedChallengeCount: challengesResult.count ?? 0,
    activeProjectCount: projectsResult.count ?? 0,
    upcomingEventCount: eventsResult.count ?? 0,
    members: (membersResult.data ?? []).map((member) => ({ id: member.id, fullName: member.full_name, handle: member.handle, points: member.points })),
    events: (eventsResult.data ?? []).map((event) => ({ id: event.id, title: event.title, eventType: event.event_type, startsAt: event.starts_at })),
    challenges: (challengesResult.data ?? []).map((challenge) => ({ id: challenge.id, title: challenge.title, detail: challenge.detail, level: challenge.level, points: challenge.points })),
    projects: projectsResult.data ?? [],
    activities: (activitiesResult.data ?? []).map((activity) => ({ id: activity.id, title: activity.title, detail: activity.detail, points: activity.points, occurredAt: activity.occurred_at })),
  };
}
