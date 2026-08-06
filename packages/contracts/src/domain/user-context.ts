import type { GeoLocation } from "./shared";

export interface ScheduleItem {
  title: string;
  startTime: string;
  location?: string;
}

/**
 * A user's current situational context — the Personalization Engine's input
 * for turning a Decision into a targeted Recommendation.
 */
export interface UserContext {
  userId: string;
  /** Open string — "student" | "staff" | "visitor" | ... depending on deployment. */
  role?: string;
  location?: GeoLocation;
  currentActivity?: string;
  upcomingSchedule?: ScheduleItem[];
  preferences?: Record<string, unknown>;
  updatedAt: string;
}
