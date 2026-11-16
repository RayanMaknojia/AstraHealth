import { useEffect, useState } from "react";
import type { MissionModel } from "./use-mission";
function hhmm(seconds: number) {
  const minute = Math.floor(seconds / 60);
  return `${String(Math.floor(minute / 60) % 24).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}
export function MissionClock({ model }: { model: MissionModel }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 15000);
    return () => window.clearInterval(id);
  }, []);
  const earth = now.toISOString().slice(11, 16);
  const state = model.missionState;
  const elapsed = model.profile.missionDay * 86400 + model.onboardMinute * 60;
  const transit =
    state.phase.environment === "DEEP_SPACE" ||
    state.phase.habitat === "spacecraft";
  const mars = state.phase.environment === "MARS_SURFACE";
  // Mars rover convention: touchdown is Sol 1. A sol is 24 h 39 min 35.244 s.
  const sinceLanding = elapsed - state.phase.startDay * 86400;
  const sol = Math.floor(Math.max(0, sinceLanding) / 88775.244) + 1;
  const local = transit
    ? `MET ${Math.floor(elapsed / 86400)}d ${hhmm(elapsed)}`
    : mars
      ? `${hhmm(((Math.max(0, sinceLanding) % 88775.244) * 86400) / 88775.244)} Sol ${sol}`
      : `${earth} ${state.plan.destination === "ISS" ? "GMT" : "UTC"}`;
  return (
    <div
      className="mission-clocks"
      title={
        mars
          ? "Mars local solar time. Sol 1 is the landing day; a sol is 24 h 39 min 35 s. Landing longitude is not configured, so the time of day is approximate."
          : transit
            ? "Mission elapsed time since launch. The mission day goes up at 00:00 UTC."
            : "ISS and Moon local clocks use Earth UTC."
      }
    >
      <span>
        Earth <b>{earth} UTC</b>
      </span>
      <span>
        Local <b>{local}</b>
      </span>
    </div>
  );
}
