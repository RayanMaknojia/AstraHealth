import { lazy, Suspense } from "react";
import { statusOf, statusStyle } from "./status";
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
  Sparkles,
  Camera,
  Check,
} from "lucide-react";
import type { HealthIndicator } from "@/types/astronaut";
import { THRESHOLDS, CABIN_LIMITS } from "@/data/nasaSpaceflightData";
import {
  STATUS_COLORS,
  ESCALATION_MODE_LABELS,
} from "@/services/healthEvaluator";
import { formatTripBarLabel } from "@/services/missionTimeline";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Panel, Status, Meter } from "./primitives";
const VitalChart = lazy(() =>
  import("./charts").then((m) => ({ default: m.VitalChart })),
);
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
export function TripBar({
  model,
  onTimeline,
}: {
  model: MissionModel;
  onTimeline: () => void;
}) {
  const state = model.missionState;
  return (
    <button
      className="trip-bar"
      onClick={onTimeline}
      aria-label="Open mission timeline"
    >
      <div className="trip-top">
        <span>
          <Orbit size={16} /> {state.plan.name}
        </span>
        <span>{formatTripBarLabel(state)}</span>
      </div>
      <div className="trip-route">
        <span>EARTH</span>
        <div className="trip-track">
          {state.plan.phases.map((p) => (
            <span
              key={p.order}
              title={`${p.name}: days ${p.startDay}–${p.endDay}`}
              style={{
                flex: Math.max(1, p.endDay - p.startDay),
                background:
                  p.endDay <= state.missionDay ? "var(--primary)" : undefined,
              }}
            />
          ))}
          <i style={{ left: `${state.progress * 100}%` }} />
        </div>
        <span>
          {state.plan.destination === "EARTH_TRAINING"
            ? "EARTH"
            : state.plan.destination}
        </span>
        <ArrowUpRight size={14} />
      </div>
    </button>
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
export function Tasks({
  model,
  toggle,
  full = false,
  onOpen,
}: {
  model: MissionModel;
  toggle: (id: string) => void;
  full?: boolean;
  onOpen?: () => void;
}) {
  const tasks = model.profile.routine;
  const completed = tasks.filter((t) => t.completed).length;
  const xp = tasks.filter((t) => t.completed).reduce((sum, t) => sum + t.xp, 0);
  const total = tasks.reduce((sum, t) => sum + t.xp, 0);
  return (
    <Panel
      title={full ? "Your countermeasure checklist" : "Today's countermeasures"}
      accessory={
        <span className="meta">
          {completed}/{tasks.length} complete
        </span>
      }
    >
      <div className="tasks-content">
        <div className="task-list">
          {(full ? tasks : tasks.slice(0, 5)).map((t) => (
            <label className={`task ${t.completed ? "done" : ""}`} key={t.id}>
              <input
                type="checkbox"
                checked={t.completed}
                onChange={() => toggle(t.id)}
              />
              <span className="task-check">
                {t.completed && <Check size={13} />}
              </span>
              <span>
                {t.title}
                <small>
                  {t.frequency} · +{t.xp} XP
                </small>
              </span>
            </label>
          ))}
        </div>
        <div
          className="readiness"
          style={
            {
              "--readiness": `${model.report.readinessScore}%`,
            } as React.CSSProperties
          }
        >
          <div>
            <strong>
              {model.report.readinessScore}
              <small>/100</small>
            </strong>
            <span>READINESS</span>
          </div>
        </div>
      </div>
      {!full && onOpen && (
        <Button variant="ghost" className="view-tasks" onClick={onOpen}>
          View all {tasks.length} countermeasures{" "}
          <ArrowRight data-icon="inline-end" />
        </Button>
      )}
      <div className="xp-row">
        <span>Countermeasure XP</span>
        <strong>
          {xp} / {total}
        </strong>
      </div>
      <Meter value={total ? (xp / total) * 100 : 0} label="Countermeasure XP" />
      {full && (
        <p className="fine-print">
          Checklist progress is kept for this session. Real check-in streaks,
          badges and crew leaderboard are coming in Phase 3. Consistency is
          celebrated; health values are never ranked.
        </p>
      )}
    </Panel>
  );
}
export function Briefing({
  model,
  onOpen,
  full = false,
}: {
  model: MissionModel;
  onOpen?: () => void;
  full?: boolean;
}) {
  const { briefing, profile, missionState } = model;
  const hr = profile.indicators.find((i) => i.id === "heart_rate")!;
  const allMissing = profile.indicators.every((i) => statusOf(i) === "no_data");
  return (
    <Panel
      title="Medical briefing"
      accessory={<span className="meta">Updated {briefing.lastUpdated}</span>}
    >
      <div className="briefing-heading">
        <Status status={allMissing ? "no_data" : briefing.overallStatus} />
        <h3>{briefing.headline}</h3>
      </div>
      <div className="briefing-body">
        <div>
          <p>{briefing.plainEnglishSummary}</p>
          <p className="briefing-escalation">
            {ESCALATION_MODE_LABELS[briefing.escalationMode]}
          </p>
          {onOpen && (
            <Button variant="ghost" onClick={onOpen}>
              Full briefing <ArrowUpRight data-icon="inline-end" />
            </Button>
          )}
        </div>
        {!full && (
          <div className="briefing-chart">
            <span className="meta">Heart rate · last 7 days</span>
            <Suspense
              fallback={<div className="chart-empty">Loading trend…</div>}
            >
              <VitalChart
                indicator={hr}
                state={missionState}
                compact
                range={7}
              />
            </Suspense>
          </div>
        )}
      </div>
      {full && (
        <div className="full-briefing">
          <h3>Trajectory warnings</h3>
          {briefing.emergingRisks.length ? (
            briefing.emergingRisks.map((r, n) => (
              <div
                className="risk"
                key={`${r.indicatorId}:${n}`}
                style={statusStyle(r.severity)}
              >
                <strong>{r.explanation}</strong>
                <p>{r.preventiveAction}</p>
              </div>
            ))
          ) : (
            <p>No emerging trajectory warnings.</p>
          )}
          <h3>Recommended tool checks</h3>
          <ul>
            {briefing.recommendedToolChecks.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <h3>Environment alerts</h3>
          {briefing.environmentAlerts.length ? (
            briefing.environmentAlerts.map((s) => <p key={s}>{s}</p>)
          ) : (
            <p>No active environment alerts.</p>
          )}
        </div>
      )}
    </Panel>
  );
}
export function Home({
  model,
  toggle,
  onTrend,
  onPage,
}: {
  model: MissionModel;
  toggle: (id: string) => void;
  onTrend: (id: string) => void;
  onPage: (page: string) => void;
}) {
  const state = model.missionState;
  const exposure = state.exposure;
  const limit = THRESHOLDS.radiation.careerLimitMSv;
  const radiation = model.profile.indicators.find(
    (i) => i.id === "radiation_dose",
  )!;
  const active = [
    ...model.briefing.environmentAlerts,
    ...model.briefing.emergingRisks.map((r) => r.explanation),
  ];
  return (
    <>
      <TripBar model={model} onTimeline={() => onPage("Mission Timeline")} />
      <div className="vital-grid">
        {vitalIds.map((id) => {
          const i = model.profile.indicators.find((i) => i.id === id)!;
          return (
            <VitalTile key={id} indicator={i} onClick={() => onTrend(id)} />
          );
        })}
      </div>
      <div className="home-main">
        <Briefing model={model} onOpen={() => onPage("Medical briefing")} />
        <Tasks model={model} toggle={toggle} onOpen={() => onPage("Streaks")} />
      </div>
      <div className="exposure-grid">
        <div>
          <Radiation />
          <section>
            <h3>Radiation exposure</h3>
            <strong>
              {exposure.totalRadiationMSv.toFixed(1)} <small>mSv</small>
            </strong>
            <span>
              Modeled mission total ·{" "}
              {((exposure.totalRadiationMSv / limit) * 100).toFixed(1)}% of{" "}
              {limit} mSv
            </span>
            <Meter
              value={(exposure.totalRadiationMSv / limit) * 100}
              label="Mission radiation exposure"
            />
            <small>
              Dosimeter: {radiation.value ?? "—"} mSv ·{" "}
              <button onClick={() => onTrend("radiation_dose")}>
                View history
              </button>
            </small>
          </section>
        </div>
        <div>
          <Bone />
          <section>
            <h3>Estimated bone loss</h3>
            <strong>
              {exposure.estBoneLossPct.toFixed(1)} <small>%</small>
            </strong>
            <span>Compared with preflight · modeled estimate</span>
            <small>{exposure.days0g.toFixed(0)} days in microgravity</small>
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
            <small>
              {state.nextPhase
                ? `${state.nextPhase.name} in ${state.daysToNextPhase} days`
                : "Final mission phase"}
            </small>
          </section>
        </div>
      </div>
      <section className="cabin-strip">
        <h2>
          <Wind size={17} />
          Cabin readings
        </h2>
        {model.environmentTick ? (
          model.environmentTick.cabinEvaluation.params.map((p) => (
            <div
              key={p.param}
              style={{ color: STATUS_COLORS[p.status] }}
              title={p.message}
            >
              <span>
                {CABIN_LIMITS.find((c) => c.param === p.param)?.label ??
                  p.param}
              </span>
              <strong>
                {p.value}{" "}
                <small>
                  {CABIN_LIMITS.find((c) => c.param === p.param)?.unit}
                </small>
              </strong>
            </div>
          ))
        ) : (
          <p>
            Awaiting cabin telemetry.{" "}
            {model.lastEvent === "Awaiting wearable sync"
              ? "Run a wearable sync or enable live mode."
              : ""}
          </p>
        )}
        <Button variant="ghost" size="sm" onClick={() => onPage("Habitat")}>
          <ArrowUpRight data-icon="inline-end" />
          <span className="sr-only">Open habitat</span>
        </Button>
      </section>
      <div className="home-footer-grid">
        <Panel
          title="Active alerts"
          accessory={<Badge variant="outline">{active.length}</Badge>}
        >
          {active.length ? (
            <ul className="active-alerts">
              {active.slice(0, 3).map((s) => (
                <li key={s}>
                  <Sparkles size={14} />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No active alerts.</p>
          )}
          {active.length > 3 && (
            <Button variant="ghost" onClick={() => onPage("Medical briefing")}>
              View all {active.length} alerts
            </Button>
          )}
        </Panel>
        <Panel title="A moment for yourself">
          <p>
            Keep your next check-in on course. Small, consistent actions make a
            long mission possible.
          </p>
          <Button variant="outline" onClick={() => onPage("Check-in")}>
            Log vitals <ArrowRight data-icon="inline-end" />
          </Button>
          <Button variant="ghost" onClick={() => onPage("Photo Check")}>
            <Camera data-icon="inline-start" />
            Photo Check
          </Button>
        </Panel>
      </div>
    </>
  );
}
