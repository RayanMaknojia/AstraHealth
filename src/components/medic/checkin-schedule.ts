/** Temporary, session-only onboard schedule. Replace with Claude's Phase 3 scheduler when available. */
export type CheckinSlot = "morning" | "evening";
export interface CheckinStamp {
  day: number;
  slot: CheckinSlot;
  completedDay: number;
  completedMinute: number;
}
export interface CheckinReminder {
  day: number;
  minute: number;
  slot: CheckinSlot;
  state: "upcoming" | "due" | "overdue";
  optional: boolean;
}
export const ONBOARD_CHECKIN_TIMES = {
  morning: 8 * 60,
  evening: 20 * 60,
} as const;
export function formatOnboardTime(minute: number) {
  return `${String(Math.floor(minute / 60) % 24).padStart(2, "0")}:${String(Math.floor(minute) % 60).padStart(2, "0")}`;
}
export function getCheckinReminder(
  day: number,
  minute: number,
  records: readonly CheckinStamp[],
  startedDay = day,
): CheckinReminder {
  const completed = (d: number, slot: CheckinSlot) =>
    records.some((r) => r.day === d && r.slot === slot);
  const now = day * 1440 + minute;
  for (let d = Math.min(startedDay, day); d <= day; d++) {
    const due = d * 1440 + ONBOARD_CHECKIN_TIMES.morning;
    if (!completed(d, "morning") && now >= due)
      return {
        day: d,
        minute: ONBOARD_CHECKIN_TIMES.morning,
        slot: "morning",
        state: now === due ? "due" : "overdue",
        optional: false,
      };
  }
  if (!completed(day, "morning"))
    return {
      day,
      minute: ONBOARD_CHECKIN_TIMES.morning,
      slot: "morning",
      state: "upcoming",
      optional: false,
    };
  if (!completed(day, "evening"))
    return {
      day,
      minute: ONBOARD_CHECKIN_TIMES.evening,
      slot: "evening",
      state: minute < ONBOARD_CHECKIN_TIMES.evening ? "upcoming" : "due",
      optional: true,
    };
  return {
    day: day + 1,
    minute: ONBOARD_CHECKIN_TIMES.morning,
    slot: "morning",
    state: "upcoming",
    optional: false,
  };
}
