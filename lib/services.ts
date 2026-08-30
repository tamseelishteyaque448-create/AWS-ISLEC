import { activities, type Activity } from "@/data/activities";
import { badges } from "@/data/badges";
import { challenges } from "@/data/challenges";
import { events } from "@/data/events";
import { projects } from "@/data/projects";
import { currentUser, leaders } from "@/data/users";

export type IslecRepository = {
  getProfile: () => typeof currentUser;
  getActivities: () => Activity[];
  getBadges: () => typeof badges;
  getChallenges: () => typeof challenges;
  getEvents: () => typeof events;
  getProjects: () => typeof projects;
  getLeaders: () => typeof leaders;
};

export const mockRepository: IslecRepository = {
  getProfile: () => currentUser,
  getActivities: () => activities,
  getBadges: () => badges,
  getChallenges: () => challenges,
  getEvents: () => events,
  getProjects: () => projects,
  getLeaders: () => leaders,
};
