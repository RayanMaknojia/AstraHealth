import { statusOf } from "./status";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import type { BodySystem, DisplayStatus } from "@/types/astronaut";
import {
  STATUS_COLORS,
  ESCALATION_MODE_LABELS,
  worstStatus,
} from "@/services/healthEvaluator";
import { Button } from "@/components/ui/button";
import { Panel, Status } from "./primitives";
import { VitalChart, Guide } from "./charts";
import type { MissionModel } from "./use-mission";
const SYSTEM_LABELS: Record<BodySystem, string> = {
  cardiovascular: "Heart & circulation",
  musculoskeletal: "Bones & muscles",
  radiation_immune: "Immune & radiation",
  metabolic: "Metabolism",
  behavioral: "Brain & wellbeing",
};
const regions: { id: BodySystem; path: string; cx: number; cy: number }[] = [
  {
    id: "behavioral",
    path: "M150 30 C127 30 123 49 125 66 C127 86 137 96 150 96 C163 96 173 86 175 66 C177 49 173 30 150 30Z",
    cx: 150,
    cy: 59,
  },
  {
    id: "cardiovascular",
    path: "M112 121 Q130 112 150 116 Q170 112 188 121 L182 195 Q165 211 150 216 Q135 211 118 195 Z",
    cx: 150,
    cy: 158,
  },
  {
    id: "metabolic",
    path: "M120 207 Q150 227 180 207 L181 260 Q150 280 119 260 Z",
    cx: 150,
    cy: 243,
  },
  {
    id: "radiation_immune",
    path: "M102 124 L115 136 L104 191 L84 240 L67 233 L78 180 L86 140Z M198 124 L185 136 L196 191 L216 240 L233 233 L222 180 L214 140Z",
    cx: 91,
    cy: 183,
  },
  {
    id: "musculoskeletal",
    path: "M119 273 Q150 288 181 273 L187 320 L179 401 L172 459 L151 459 L153 385 L150 329 L147 385 L149 459 L128 459 L121 401 L113 320Z",
    cx: 150,
    cy: 334,
  },
];
export function BodyMap({
  model,
  photo,
}: {
  model: MissionModel;
  photo: () => void;
}) {
  const [selected, setSelected] = useState<BodySystem>("cardiovascular");
  const [guide, setGuide] = useState<string | null>(null);
  const { profile, report, missionState } = model;
  const zoneStatus = (system: BodySystem): DisplayStatus => {
    const fresh = profile.indicators.filter(
      (i) => i.system === system && statusOf(i) !== "no_data",
    );
    if (!fresh.length) return "no_data";
    const backend =
      report.systems.find((s) => s.system === system)?.status ?? "nominal";
    return worstStatus([
      backend,
      ...fresh
        .map((i) => statusOf(i))
        .filter(
          (s): s is "nominal" | "caution" | "critical" => s !== "no_data",
        ),
    ]);
  };
  const indicators = profile.indicators.filter((i) => i.system === selected);
  return (
    <div className="body-layout">
      <Panel
        title="Your systems at a glance"
        accessory={<span className="meta">Select a zone</span>}
      >
        <div className="body-canvas">
          <div className="body-grid" />
          <svg
            viewBox="0 0 300 500"
            role="img"
            aria-label="Interactive body systems map"
          >
            <defs>
              <filter id="body-glow">
                <feGaussianBlur stdDeviation="3" />
              </filter>
              <linearGradient id="body-shade" x2="1" y2="1">
                <stop stopColor="#1c3342" />
                <stop offset="1" stopColor="#0b1824" />
              </linearGradient>
            </defs>
            <g stroke="#385263" strokeWidth="1.2" fill="url(#body-shade)">
              <path d="M150 24 C124 24 116 47 120 69 Q124 92 138 100 L138 108 L108 114 Q91 119 84 137 L67 191 L57 243 L63 270 L75 272 L84 249 L98 211 L111 176 L109 242 L108 279 L106 320 L117 406 L120 462 L112 477 L145 477 L149 410 L150 352 L151 410 L155 477 L188 477 L180 462 L183 406 L194 320 L192 279 L191 242 L189 176 L202 211 L216 249 L225 272 L237 270 L243 243 L233 191 L216 137 Q209 119 192 114 L162 108 L162 100 Q176 92 180 69 C184 47 176 24 150 24Z" />
              <path
                d="M150 115 V279 M120 199 Q150 214 180 199 M150 300 V342"
                fill="none"
              />
            </g>
            {regions.map((r) => {
              const status = zoneStatus(r.id);
              return (
                <g
                  key={r.id}
                  role="button"
                  tabIndex={0}
                  aria-label={SYSTEM_LABELS[r.id]}
                  aria-pressed={selected === r.id}
                  onClick={() => setSelected(r.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelected(r.id);
                    }
                  }}
                  className={`body-zone ${status === "critical" ? "critical-pulse" : ""}`}
                  style={{ color: STATUS_COLORS[status] }}
                >
                  <title>{SYSTEM_LABELS[r.id]}</title>
                  <path
                    d={r.path}
                    fill="currentColor"
                    opacity={selected === r.id ? 0.33 : 0.14}
                  />
                  <path
                    d={r.path}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={selected === r.id ? 2 : 1}
                  />
                  <circle cx={r.cx} cy={r.cy} r="4" fill="currentColor" />
                </g>
              );
            })}
            <path
              d="M25 75 V25 H75 M225 25 H275 V75 M25 425 V475 H75 M225 475 H275 V425"
              fill="none"
              stroke="#456272"
              strokeWidth="1"
            />
          </svg>
          <span className="scan-caption">
            SYSTEM SCAN · SIMULATED TELEMETRY
          </span>
        </div>
        <div className="body-legend">
          {(["nominal", "caution", "critical", "no_data"] as const).map((s) => (
            <Status key={s} status={s} />
          ))}
        </div>
        <div className="system-pickers">
          {regions.map((r) => (
            <button
              key={r.id}
              className={selected === r.id ? "selected" : ""}
              onClick={() => setSelected(r.id)}
            >
              <span style={{ background: STATUS_COLORS[zoneStatus(r.id)] }} />
              {SYSTEM_LABELS[r.id]}
            </button>
          ))}
        </div>
      </Panel>
      <Panel
        title={SYSTEM_LABELS[selected]}
        accessory={<Status status={zoneStatus(selected)} />}
      >
        <div className="system-detail">
          {indicators.map((i) => (
            <section key={i.id}>
              <div className="detail-kpi">
                <h3>{i.name}</h3>
                <Status status={statusOf(i)} />
              </div>
              <div className="chart-value">
                {i.value ?? "—"} <small>{i.unit}</small>
              </div>
              <p>
                {report.indicators.find((e) => e.id === i.id)?.message ??
                  "Awaiting a fresh reading."}
              </p>
              {i.simulated && <small className="meta">Simulated</small>}
              <VitalChart
                indicator={i}
                state={missionState}
                compact
                range={14}
              />
              <h4>What you can do</h4>
              <ul>
                {i.actionPlan.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
              <Button variant="outline" onClick={() => setGuide(i.id)}>
                How to measure <ArrowRight data-icon="inline-end" />
              </Button>
            </section>
          ))}
        </div>
        <p className="escalation-rule">
          {ESCALATION_MODE_LABELS[report.escalationMode]}
        </p>
        <Button variant="ghost" onClick={photo}>
          Add photo <ArrowRight data-icon="inline-end" />
        </Button>
      </Panel>
      <Guide
        indicator={profile.indicators.find((i) => i.id === guide) ?? null}
        onClose={() => setGuide(null)}
      />
    </div>
  );
}
