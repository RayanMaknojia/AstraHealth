import { useState } from "react";
import { Pause, Play } from "lucide-react";
import { STATUS_COLORS, worstStatus } from "@/services/healthEvaluator";
import type { BodySystem, DisplayStatus, StatusLevel } from "@/types/astronaut";
import { Button } from "@/components/ui/button";
import { Status } from "./primitives";
import type { MissionModel } from "./use-mission";
import { statusOf } from "./status";
import humanModel from "./assets/human-model.webp";
const zones: {
  id: BodySystem;
  region: string;
  label: string;
  shape: string;
}[] = [
  {
    id: "behavioral",
    region: "headMind",
    label: "Brain & wellbeing",
    shape:
      "M150 12 C124 12 123 40 130 55 Q150 74 170 55 C177 40 176 12 150 12Z",
  },
  {
    id: "cardiovascular",
    region: "chestHeart",
    label: "Heart & circulation",
    shape: "M116 86 Q150 73 184 86 L180 167 Q150 181 120 167Z",
  },
  {
    id: "metabolic",
    region: "abdomenMetabolism",
    label: "Metabolism",
    shape: "M121 179 Q150 190 179 179 L177 237 Q150 257 123 237Z",
  },
  {
    id: "musculoskeletal",
    region: "musculoskeletal",
    label: "Bones & muscles",
    shape:
      "M123 250 L144 263 L146 338 L140 439 L118 439 L120 335Z M177 250 L156 263 L154 338 L160 439 L182 439 L180 335Z",
  },
  {
    id: "radiation_immune",
    region: "general",
    label: "Immune & radiation",
    shape:
      "M104 87 L116 104 L101 162 L77 228 L62 221 L83 154Z M196 87 L184 104 L199 162 L223 228 L238 221 L217 154Z",
  },
];
/** “Human like model”: five-second bottom-to-top visual scan; not a diagnostic sensor. */
export function HumanScan({
  model,
  selected,
  onSelect,
}: {
  model: MissionModel;
  selected: BodySystem;
  onSelect: (s: BodySystem) => void;
}) {
  const [paused, setPaused] = useState(false);
  const state = (id: BodySystem): DisplayStatus => {
    const fresh = model.profile.indicators
      .filter((i) => i.system === id)
      .map(statusOf)
      .filter((s): s is StatusLevel => s !== "no_data");
    return fresh.length ? worstStatus(fresh) : "no_data";
  };
  return (
    <section
      className="human-scan-panel interactive-anatomy"
      aria-label="Interactive anatomical explorer"
    >
      <div className="scan-panel-heading">
        <h2>Body systems</h2>
        <span>Select a region</span>
      </div>
      <div className="human-scan-stage">
        <img
          src={humanModel}
          alt="Standing human anatomical model"
          width={540}
          height={810}
        />
        <svg
          className="anatomy-hotspots"
          viewBox="0 0 300 450"
          role="group"
          aria-label="Select a body system"
        >
          {zones.map((z) => (
            <g
              key={z.id}
              role="button"
              data-region={z.region}
              tabIndex={0}
              aria-label={z.label}
              aria-pressed={selected === z.id}
              onClick={() => onSelect(z.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(z.id);
                }
              }}
              className="anatomy-zone"
              style={{ color: STATUS_COLORS[state(z.id)] }}
            >
              <title>{z.label}</title>
              <path
                d={z.shape}
                fill="currentColor"
                fillOpacity={selected === z.id ? 0.25 : 0.06}
                stroke="currentColor"
                strokeWidth={selected === z.id ? 1.6 : 0.7}
              />
            </g>
          ))}
        </svg>
        <div
          className="scan-sweep"
          aria-hidden="true"
          style={{ animationPlayState: paused ? "paused" : "running" }}
        >
          <span />
        </div>
      </div>
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
        <span className="meta">Simulated anatomical view</span>
      </div>
      <div className="anatomy-system-buttons">
        {zones.map((z) => (
          <button
            key={z.id}
            onClick={() => onSelect(z.id)}
            aria-pressed={selected === z.id}
          >
            <span>{z.label}</span>
            <Status status={state(z.id)} />
          </button>
        ))}
      </div>
    </section>
  );
}
