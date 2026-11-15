import { getDueCheckins } from "@/services/checkinService";
import { MONTHLY_EVERY_DAYS, WEEK_DAYS } from "@/data/phase3Data";
import type { AstronautProfile, CheckinTaskDue } from "@/types/astronaut";
export function formatOnboardTime(minute: number) {
  return `${String(Math.floor(minute / 60) % 24).padStart(2, "0")}:${String(Math.floor(minute) % 60).padStart(2, "0")}`;
}
/** Cadence presentation over the backend's persisted schedule. Weekly/extended checks include daily basics. */
export function visibleSchedule(profile: AstronautProfile): CheckinTaskDue[] {
  const tasks = getDueCheckins(profile);
  return tasks.filter((t) => t.slot !== "eye_exam" && t.slot !== "evening");
}
export function nextScheduledCheckin(profile: AstronautProfile) {
  const pending = visibleSchedule(profile).filter(
    (t) => t.due && !t.done && !t.excused,
  );
  const day = profile.missionDay;
  return (
    pending.find(
      (t) => day > 0 && day % MONTHLY_EVERY_DAYS === 0 && t.slot === "monthly",
    ) ??
    pending.find(
      (t) => day > 0 && day % WEEK_DAYS === 0 && t.slot === "weekly",
    ) ??
    pending.find((t) => t.slot === "morning") ??
    pending.find((t) => t.required) ??
    pending[0] ??
    null
  );
}
