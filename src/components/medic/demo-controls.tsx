import { Activity, Sun, ChevronDown } from "lucide-react";
import { ANOMALY_LABELS } from "@/services/wearableStream";
import { createDemoInput } from "@/services/ingestionEngine";
import { DEMO_LOGINS } from "@/services/accountService";
import type { AnomalyKind } from "@/types/astronaut";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { useMission } from "./use-mission";
export function DemoControls({
  controller,
  onSwitchCrew,
}: {
  controller: ReturnType<typeof useMission>;
  onSwitchCrew: (login: string) => void;
}) {
  const [anomaly, setAnomaly] = useState<AnomalyKind>("fever");
  const { model, wearable, feed, busy, submit, changeDay, result } = controller;
  const sync = () => {
    wearable.current?.tickOnce();
    feed.current?.tickOnce();
  };
  return (
    <details className="demo-bar">
      <summary>
        <Activity size={16} />
        <strong>Mission Control</strong>
        <span>Demo controls</span>
        <ChevronDown size={15} />
      </summary>
      <div className="demo-tools">
        <label className="demo-crew">
          Demo crew
          <select
            aria-label="Demo crew"
            value={model.profile.login}
            onChange={(e) => onSwitchCrew(e.target.value)}
          >
            {!DEMO_LOGINS.some((d) => d.login === model.profile.login) && (
              <option value={model.profile.login}>{model.profile.login}</option>
            )}
            {DEMO_LOGINS.filter((d) => d.login !== "admin").map((d) => (
              <option key={d.login} value={d.login}>
                {d.login}
              </option>
            ))}
          </select>
        </label>
        <Button variant="outline" onClick={sync}>
          +15m Wearable Sync
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            feed.current?.triggerSolarEvent();
            feed.current?.tickOnce();
            wearable.current?.injectAnomaly("solar_flare");
            wearable.current?.tickOnce();
          }}
        >
          <Sun data-icon="inline-start" />
          Trigger Solar Storm Shelter Alert
        </Button>
        <select
          aria-label="Anomaly type"
          value={anomaly}
          onChange={(e) => setAnomaly(e.target.value as AnomalyKind)}
        >
          {Object.entries(ANOMALY_LABELS)
            .filter(([id]) => id !== "solar_flare")
            .map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
        </select>
        <Button
          variant="outline"
          onClick={() => {
            wearable.current?.injectAnomaly(anomaly);
            wearable.current?.tickOnce();
          }}
        >
          Inject
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => void submit(createDemoInput("valid_ultrasound"))}
        >
          Test Valid Ultrasound
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => void submit(createDemoInput("invalid_file"))}
        >
          Test Invalid File
        </Button>
        <label className="day-slider">
          Mission day <b>{model.profile.missionDay}</b>
          <input
            aria-label="Mission day"
            type="range"
            min={0}
            max={model.profile.mission.totalDays}
            value={model.profile.missionDay}
            onChange={(e) => void changeDay(Number(e.target.value))}
          />
        </label>
      </div>
      {result && (
        <div className="demo-result" role="status">
          <strong>
            {result.verdict.accepted
              ? "Accepted & Normalized"
              : "Rejected: Non-Biomedical Data"}
          </strong>
          <span>
            {result.verdict.accepted
              ? result.artifact.extractedSummary
              : result.verdict.rejectionReason}
          </span>
        </div>
      )}
    </details>
  );
}
