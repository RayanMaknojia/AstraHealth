import {
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  Heart,
  Thermometer,
  Moon,
  Smile,
  Wind,
  Radiation,
  Bone,
  Orbit,
} from "lucide-react";
import type { HealthIndicator } from "@/types/astronaut";
import { THRESHOLDS } from "@/data/nasaSpaceflightData";
import { ESCALATION_MODE_LABELS } from "@/services/healthEvaluator";
import { formatTripBarLabel } from "@/services/missionTimeline";
import { Button } from "@/components/ui/button";
import { Panel, Status, Meter } from "./primitives";
import { statusOf, statusStyle } from "./status";
import { nextScheduledCheckin } from "./checkin-schedule";
import type { MissionModel } from "./use-mission";
const icons = {
  heart_rate: Heart,
  blood_pressure: Activity,
  body_temp: Thermometer,
  spo2: Wind,
  sleep_hours: Moon,
  mood: Smile,
  blood_sugar: Activity,
  bone_density: Bone,
  radiation_dose: Radiation,
};
const vitalIds = [
  "heart_rate",
  "blood_pressure",
  "body_temp",
  "spo2",
  "sleep_hours",
  "mood",
];
export function TripBar({ model }: { model: MissionModel }) {
  const state = model.missionState;
  const destination = {
    EARTH_TRAINING: { emoji: "🌍", label: "Earth" },
    ISS: { emoji: "🛰️", label: "International Space Station" },
    MARS: { emoji: "🔴", label: "Mars" },
    MOON: { emoji: "🌕", label: "Moon" },
  }[state.plan.destination];
  const progress = Math.max(0, Math.min(1, state.progress));
  return (
    <section
      className="trip-bar mission-journey compact-journey"
      aria-label="Mission journey"
    >
      <div className="compact-journey-label">
        <strong>Day {state.missionDay}</strong>
        <span>
          {formatTripBarLabel(state).split(" · ").slice(1).join(" — ")}
        </span>
        <small>
          {state.missionDay} / {state.plan.totalDays} days
        </small>
      </div>
      <div className="trip-route">
        <span className="journey-endpoint" role="img" aria-label="Earth">
          🌍
        </span>
        <div
          className="trip-track"
          role="progressbar"
          aria-label="Mission progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          <span
            className="journey-progress-fill"
            style={{ transform: `scaleX(${progress})` }}
          />
          {state.plan.phases
            .filter((p) => p.endDay < state.plan.totalDays)
            .map((p) => (
              <span
                key={p.order}
                className="phase-tick"
                style={{ left: `${(p.endDay / state.plan.totalDays) * 100}%` }}
                title={p.name}
              />
            ))}
          <span
            className="journey-spacecraft"
            style={{ left: `${progress * 100}%` }}
            role="img"
            aria-label="Spacecraft"
          >
            <span>🚀</span>
          </span>
        </div>
        <span
          className="journey-endpoint"
          role="img"
          aria-label={destination.label}
        >
          {destination.emoji}
        </span>
      </div>
    </section>
  );
}
export function CheckinReminder({
  model,
  onCheckin,
}: {
  model: MissionModel;
  onCheckin: () => void;
}) {
  const task = nextScheduledCheckin(model.profile);
  const details =
    task?.slot === "weekly"
      ? "Body mass, fasting glucose, reaction test"
      : task?.slot === "eye_exam"
        ? "Vision and eye ultrasound"
        : task?.slot === "monthly"
          ? "Guided exam and sleep/team questionnaire"
          : task?.slot === "evening"
            ? "Optional evening reflection"
            : "Temperature, wellbeing and symptoms";
  return (
    <section className="compact-checkin" aria-label="Check-in reminder">
      <p>
        {task ? (
          <>
            <strong>Next: {task.title}</strong>{" "}
            <span>
              — {task.dueReason} ({details})
            </span>
          </>
        ) : (
          <>
            <strong>All scheduled check-ins complete.</strong>{" "}
            <span>
              Morning check-in returns on day {model.profile.missionDay + 1}.
            </span>
          </>
        )}
      </p>
      <Button onClick={onCheckin}>
        Open Check-in
        <ArrowRight data-icon="inline-end" />
      </Button>
    </section>
  );
}
export function VitalTile({
  indicator,
  onClick,
}: {
  indicator: HealthIndicator;
  onClick: () => void;
}) {
  const Icon = icons[indicator.id];
  const status = statusOf(indicator);
  const Trend =
    indicator.trend === "drifting_caution" ||
    indicator.trend === "rapid_decline"
      ? ArrowUpRight
      : indicator.trend === "improving"
        ? ArrowDownRight
        : ArrowRight;
  return (
    <button
      className="vital-tile"
      style={statusStyle(status)}
      onClick={onClick}
    >
      <div className="vital-label">
        <Icon size={18} />
        <span>{indicator.name}</span>
        <Trend size={13} />
      </div>
      <div className="vital-value">
        {status === "no_data" ? "—" : indicator.value}
        <small>{indicator.unit}</small>
      </div>
      <div className="vital-bottom">
        <Status status={status} />
        {indicator.simulated && <span>Simulated</span>}
      </div>
      <small className="last-reading">
        {status === "no_data"
          ? "Reading overdue or missing"
          : (indicator.history.at(-1)?.timestamp ??
            `Day ${indicator.lastMeasuredDay}`)}
      </small>
    </button>
  );
}
function shortSummary(text: string) {
  const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z])/);
  let out = "";
  for (const sentence of sentences) {
    if (out && out.length + sentence.length > 430) break;
    out += (out ? " " : "") + sentence;
  }
  return out || text;
}
export function Briefing({
  model,
  onOpen,
  onBodyMap,
  full = false,
}: {
  model: MissionModel;
  onOpen?: () => void;
  onBodyMap?: () => void;
  full?: boolean;
}) {
  const b = model.briefing;
  const allMissing = model.profile.indicators.every(
    (i) => statusOf(i) === "no_data",
  );
  const alerts = [
    ...b.environmentAlerts,
    ...b.emergingRisks.map((r) => r.explanation),
  ];
  return (
    <Panel
      title="Medical briefing"
      className={full ? "briefing-full" : "briefing-compact"}
      accessory={<span className="meta">Updated {b.lastUpdated}</span>}
    >
      <div className="briefing-heading">
        <Status status={allMissing ? "no_data" : b.overallStatus} />
        <h3>{b.headline}</h3>
      </div>
      <p className="briefing-summary">
        {full ? b.plainEnglishSummary : shortSummary(b.plainEnglishSummary)}
      </p>
      {alerts.length > 0 && (
        <div className="briefing-alerts">
          <h3>Active alerts & trajectory warnings</h3>
          <ul>
            {(full ? alerts : alerts.slice(0, 3)).map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="briefing-escalation">
        {ESCALATION_MODE_LABELS[b.escalationMode]}
      </p>
      <div className="briefing-actions">
        {onOpen && (
          <Button variant="outline" onClick={onOpen}>
            Full briefing
            <ArrowUpRight data-icon="inline-end" />
          </Button>
        )}
        {onBodyMap && (
          <Button variant="ghost" onClick={onBodyMap}>
            View Body Map & Countermeasures
            <ArrowRight data-icon="inline-end" />
          </Button>
        )}
      </div>
      {full && (
        <div className="full-briefing">
          <h3>Recommended tool checks</h3>
          <ul>
            {b.recommendedToolChecks.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          {b.emergingRisks.map((r, n) => (
            <div
              className="risk"
              key={r.indicatorId + n}
              style={statusStyle(r.severity)}
            >
              <strong>{r.explanation}</strong>
              <p>{r.preventiveAction}</p>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
export function Home({
  model,
  onTrend,
  onPage,
  onBriefing,
}: {
  model: MissionModel;
  onTrend: (id: string) => void;
  onPage: (page: string) => void;
  onBriefing: () => void;
}) {
  const state = model.missionState,
    exposure = state.exposure,
    limit = THRESHOLDS.radiation.careerLimitMSv;
  return (
    <div className="revised-home">
      <TripBar model={model} />
      <CheckinReminder model={model} onCheckin={() => onPage("Check-in")} />
      <section
        aria-label="Primary vitals"
        className="vital-grid revised-vitals"
      >
        {vitalIds.map((id) => (
          <VitalTile
            key={id}
            indicator={model.profile.indicators.find((i) => i.id === id)!}
            onClick={() => onTrend(id)}
          />
        ))}
      </section>
      <Briefing
        model={model}
        onOpen={onBriefing}
        onBodyMap={() => onPage("Body Map")}
      />
      <section
        className="exposure-grid compact-exposure"
        aria-label="Mission exposure"
      >
        <div>
          <Radiation />
          <section>
            <h3>Radiation exposure</h3>
            <strong>
              {exposure.totalRadiationMSv.toFixed(1)} <small>mSv</small>
            </strong>
            <span>
              Modeled ·{" "}
              {((exposure.totalRadiationMSv / limit) * 100).toFixed(1)}% of{" "}
              {limit} mSv
            </span>
            <Meter
              value={(exposure.totalRadiationMSv / limit) * 100}
              label="Mission radiation exposure"
            />
          </section>
        </div>
        <div>
          <Bone />
          <section>
            <h3>Estimated bone loss</h3>
            <strong>
              {exposure.estBoneLossPct.toFixed(1)} <small>%</small>
            </strong>
            <span>Modeled estimate vs preflight</span>
          </section>
        </div>
        <div>
          <Orbit />
          <section>
            <h3>Current gravity</h3>
            <strong>
              {state.environment.gravityG} <small>g</small>
            </strong>
            <span>{state.environment.label}</span>
          </section>
        </div>
      </section>
    </div>
  );
}
