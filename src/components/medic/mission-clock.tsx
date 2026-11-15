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
  const sol = Math.floor(elapsed / 88775.244);
  const local = transit
    ? `MET ${Math.floor(elapsed / 86400)}d ${hhmm(elapsed)}`
    : mars
      ? `${hhmm(((elapsed % 88775.244) * 86400) / 88775.244)} Sol ${sol}`
      : `${earth} ${state.plan.destination === "ISS" ? "GMT" : "UTC"}`;
  return (
    <div
      className="mission-clocks"
      title={
        mars
          ? "Approximate mission-sol clock using a 24h 39m 35s sol; landing longitude is not configured."
          : transit
            ? "Mission elapsed time follows the onboard demo day and time."
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
