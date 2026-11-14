import { useState } from "react";
import { ArrowUpRight, Pause, Play } from "lucide-react";
import {
  STATUS_COLORS,
  worstStatus,
  STATUS_LABELS,
} from "@/services/healthEvaluator";
import type { BodySystem, DisplayStatus, StatusLevel } from "@/types/astronaut";
import { Button } from "@/components/ui/button";
import type { MissionModel } from "./use-mission";
import { statusOf } from "./status";
import humanModel from "./assets/human-model.webp";

const systems: { id: BodySystem; label: string }[] = [
  { id: "behavioral", label: "Brain & mood" },
  { id: "cardiovascular", label: "Heart & circulation" },
  { id: "radiation_immune", label: "Immune & radiation" },
  { id: "metabolic", label: "Metabolism" },
  { id: "musculoskeletal", label: "Bones & muscles" },
];
/** The user's “human like model”: a visual scan, never a diagnostic image or sensor. */
export function HumanScan({
  model,
  onBodyMap,
}: {
  model: MissionModel;
  onBodyMap: () => void;
}) {
  const [paused, setPaused] = useState(false);
  const systemStatus = (id: BodySystem): DisplayStatus => {
    const fresh = model.profile.indicators
      .filter((i) => i.system === id)
      .map(statusOf)
      .filter((s): s is StatusLevel => s !== "no_data");
    return fresh.length ? worstStatus(fresh) : "no_data";
  };
  return (
    <section
      className="human-scan-panel"
      aria-label="Body systems visualization"
    >
      <div className="scan-panel-heading">
        <h2>Body systems</h2>
        <span>Human model</span>
      </div>
      <div className="human-scan-stage">
        <div className="scan-stage-guides" aria-hidden="true" />
        <img
          src={humanModel}
          alt="Standing translucent human anatomy model"
          width={512}
          height={768}
        />
        <div
          className="scan-sweep"
          aria-hidden="true"
          style={{ animationPlayState: paused ? "paused" : "running" }}
        >
          <span />
        </div>
        <div className="scan-scale" aria-hidden="true">
          <span>+</span>
          <span>+</span>
          <span>+</span>
          <span>+</span>
        </div>
      </div>
      <div className="scan-system-list">
        {systems.map((s) => {
          const status = systemStatus(s.id);
          return (
            <div key={s.id} title={`${s.label}: ${STATUS_LABELS[status]}`}>
              <span style={{ background: STATUS_COLORS[status] }} />
              <span>{s.label}</span>
              <span className="sr-only">{STATUS_LABELS[status]}</span>
            </div>
          );
        })}
      </div>
      <p className="scan-caption-text">
        Simulated visualization, not a diagnostic scan.
      </p>
      <div className="scan-controls">
        <Button
          variant="outline"
          className="scan-motion-control"
          aria-pressed={paused}
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? (
            <Play data-icon="inline-start" />
          ) : (
            <Pause data-icon="inline-start" />
          )}
          {paused ? "Resume scan" : "Pause scan"}
        </Button>
        <span className="reduced-motion-note">Reduced motion enabled</span>
        <Button variant="ghost" onClick={onBodyMap}>
          Open Body Map
          <ArrowUpRight data-icon="inline-end" />
        </Button>
      </div>
    </section>
  );
}
