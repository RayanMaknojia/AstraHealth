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
  Clock3,
  CalendarCheck2,
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
import { getCheckinReminder, formatOnboardTime } from "./checkin-schedule";
import { HumanScan } from "./human-scan";
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
  const destination = {
    EARTH_TRAINING: { emoji: "🌍", label: "Earth" },
    ISS: { emoji: "🛰️", label: "International Space Station" },
    MARS: { emoji: "🔴", label: "Mars" },
    MOON: { emoji: "🌕", label: "Moon" },
  }[state.plan.destination];
  const progress = Math.max(0, Math.min(1, state.progress));
  return (
    <button
      className="trip-bar mission-journey"
      onClick={onTimeline}
      aria-label="Open mission timeline"
    >
      <div className="journey-heading">
        <h2>Mission journey</h2>
        <span>{state.plan.name}</span>
        <ArrowUpRight size={18} />
      </div>
      <div className="journey-details">
        <div className="mission-day">
          <strong>Day {state.missionDay}</strong>
          <span>of {state.plan.totalDays}</span>
        </div>
        <div className="journey-phase">
          <strong>{state.phase.name}</strong>
          <span>
            {formatTripBarLabel(state).split(" · ").slice(2).join(" · ") ||
              (state.missionDay < 0
                ? "Earth baseline collection"
                : "Mission complete")}
          </span>
        </div>
      </div>
      <div className="trip-route">
        <span
          className="journey-endpoint"
          role="img"
          aria-label="Earth"
          title="Earth"
        >
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
                title={`${p.name} ends on day ${p.endDay}`}
              />
            ))}
          <span
            className="journey-spacecraft"
            style={{ left: `${progress * 100}%` }}
            role="img"
            aria-label={`Spacecraft at ${Math.round(progress * 100)} percent`}
          >
            <span>🚀</span>
            <small>{Math.round(progress * 100)}%</small>
          </span>
        </div>
        <span
          className="journey-endpoint"
          role="img"
          aria-label={destination.label}
          title={destination.label}
        >
          {destination.emoji}
        </span>
      </div>
      <div className="journey-phases">
        {state.plan.phases.map((p) => (
          <span
            key={p.order}
            className={p.order === state.phase.order ? "current" : ""}
            style={{ flex: Math.max(1, p.endDay - p.startDay) }}
            title={`${p.name}: Day ${p.startDay}–${p.endDay}`}
          >
            {p.name}
          </span>
        ))}
      </div>
    </button>
  );
}
export function CheckinReminder({
  model,
  onCheckin,
}: {
  model: MissionModel;
  onCheckin: () => void;
}) {
  const reminder = getCheckinReminder(
    model.missionState.missionDay,
    model.onboardMinute,
    model.checkins,
    model.scheduleStartedDay,
  );
  const slot = reminder.slot === "morning" ? "Morning" : "Evening";
  const heading =
    reminder.state === "overdue"
      ? `${slot} check-in overdue`
      : reminder.state === "due"
        ? `${slot} check-in due`
        : "Next check-in";
  return (
    <section
      className={`checkin-reminder ${reminder.state}`}
      aria-label="Check-in reminder"
    >
      <div className="reminder-label">
        <CalendarCheck2 size={18} />
        <h2>{heading}</h2>
        {reminder.optional && <span>Optional</span>}
      </div>
      <div className="reminder-time">
        <Clock3 size={22} />
        <strong>{formatOnboardTime(reminder.minute)}</strong>
        <span>
          {reminder.day === model.missionState.missionDay
            ? "Today"
            : `Day ${reminder.day}`}
          <small>Onboard time</small>
        </span>
      </div>
      <p>
        {reminder.state === "overdue"
          ? `Please complete the check-in due on Day ${reminder.day} at ${formatOnboardTime(reminder.minute)}.`
          : reminder.state === "due"
            ? "A few readings to start your day."
            : "Your readings are saved for this session."}
      </p>
      <Button onClick={onCheckin}>
        {reminder.state === "overdue"
          ? "Complete overdue check-in"
          : "Start check-in"}
        <ArrowRight data-icon="inline-end" />
      </Button>
      <small className="schedule-note">
        Demo schedule · morning 08:00 / evening 20:00
      </small>
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
      <div className="home-mission-band">
        <TripBar model={model} onTimeline={() => onPage("Mission Timeline")} />
        <CheckinReminder model={model} onCheckin={() => onPage("Check-in")} />
      </div>
      <div className="home-health-layout">
        <div className="home-health-main">
          <Panel
            title="Your readings"
            accessory={<span className="meta">{model.lastEvent}</span>}
            className="readings-panel"
          >
            <div className="vital-grid">
              {vitalIds.map((id) => {
                const i = model.profile.indicators.find((i) => i.id === id)!;
                return (
                  <VitalTile
                    key={id}
                    indicator={i}
                    onClick={() => onTrend(id)}
                  />
                );
              })}
            </div>
          </Panel>
          <div className="home-briefing">
            <Briefing model={model} onOpen={() => onPage("Medical briefing")} />
          </div>
        </div>
        <HumanScan model={model} onBodyMap={() => onPage("Body Map")} />
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
      <Tasks model={model} toggle={toggle} onOpen={() => onPage("Streaks")} />
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
        <Panel title="Your next check-in">
          <p>
            Check-in reminders use onboard mission time. Accepted manual
            readings and symptom reports complete the offered check-in for this
            session.
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
