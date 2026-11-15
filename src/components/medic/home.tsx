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
  Globe,
  Satellite,
  Navigation2,
  RefreshCw,
  Sparkles,
  ShieldAlert,
} from "lucide-react";
import type {
  AiBriefing,
  BodySystem,
  BriefingLine,
  HealthIndicator,
  ScanResult,
} from "@/types/astronaut";
import { THRESHOLDS } from "@/data/nasaSpaceflightData";
import {
  ESCALATION_MODE_LABELS,
  STATUS_COLORS,
} from "@/services/healthEvaluator";
import { Button } from "@/components/ui/button";
import { Panel, Status, Meter } from "./primitives";
import { statusOf, statusStyle } from "./status";
import { getDueCheckins, listCheckins } from "@/services/checkinService";
import { HomeScan } from "./home-scan";
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
  const destination =
    state.plan.destination === "ISS"
      ? { Icon: Satellite, label: "ISS" }
      : state.plan.destination === "EARTH_TRAINING"
        ? { Icon: Globe, label: "Earth" }
        : {
            Icon: state.plan.destination === "MOON" ? Moon : Orbit,
            label: state.plan.destination === "MOON" ? "Moon" : "Mars",
          };
  const progress = Math.max(0, Math.min(1, state.progress));
  return (
    <section
      className="trip-bar mission-journey compact-journey"
      aria-label="Mission journey"
    >
      <div className="trip-route">
        <span className="journey-endpoint" role="img" aria-label="Earth">
          <Globe size={16} />
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
            <Navigation2 size={14} />
          </span>
        </div>
        <span
          className="journey-endpoint"
          role="img"
          aria-label={destination.label}
        >
          <destination.Icon size={16} />
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
  const tasks = getDueCheckins(model.profile);
  const day = model.profile.missionDay;
  const recent = listCheckins(model.profile.id, day, day + 1);
  const reminders = (
    [
      { slot: "morning", label: "Daily", period: 1 },
      { slot: "weekly", label: "Weekly", period: 7 },
      { slot: "monthly", label: "Monthly", period: 30 },
    ] as const
  ).map(({ slot, label, period }) => {
    const task = tasks.find((t) => t.slot === slot);
    const previous = recent
      .filter((r) => r.slot === slot && !r.excused && r.missionDay < day)
      .sort((a, b) => b.missionDay - a.missionDay)[0];
    const previousEnd =
      period === 1 ? day - 1 : Math.floor(day / period) * period - 1;
    const previousStart = period === 1 ? previousEnd : previousEnd - period + 1;
    const overdue =
      !task?.done &&
      !task?.excused &&
      previousEnd >= 0 &&
      (period !== 30 || day >= 60) &&
      (!previous || previous.missionDay < previousStart);
    const daysLeft =
      period === 30 && day < 30 ? 30 - day : period - 1 - (day % period);
    const hours = Math.max(0, Math.ceil((1440 - model.onboardMinute) / 60));
    const text = task?.done
      ? "Done ✓"
      : task?.excused
        ? "Excused"
        : overdue
          ? `Overdue: due day ${previousEnd}`
          : period === 1
            ? `${hours} h left`
            : `${daysLeft} days left`;
    return (
      <p
        key={slot}
        className={overdue ? "reminder-overdue" : "reminder-countdown"}
      >
        <strong>{label} check-in</strong>
        <span>{text}</span>
      </p>
    );
  });
  return (
    <section
      className="compact-checkin all-checkin-reminders"
      aria-label="Check-in reminders"
    >
      <div>{reminders}</div>
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
      <div className="vital-value" style={{ color: `var(--status)` }}>
        {status === "critical" && (
          <span className="vital-critical-symbol" aria-label="Alert">
            ✕{" "}
          </span>
        )}
        {status === "no_data" ? "-" : indicator.value}
        <small>{indicator.unit}</small>
      </div>
      <div className="vital-bottom">
        {status !== "critical" && <Status status={status} />}
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
function BriefingText({
  text,
  omitCriticalLabel = false,
}: {
  text: string;
  omitCriticalLabel?: boolean;
}) {
  if (omitCriticalLabel)
    text = text
      .replace(/Overall status: Alert\.\s*/g, "")
      .replace(/\s*\(Alert\)/g, "");
  const words: Record<
    string,
    { label: string; status: "nominal" | "caution" | "critical" }
  > = {
    Optimal: { label: "Optimal", status: "nominal" },
    Normal: { label: "Optimal", status: "nominal" },
    Borderline: { label: "Borderline", status: "caution" },
    Watch: { label: "Borderline", status: "caution" },
    Alert: { label: "Alert", status: "critical" },
  };
  return text
    .split(/\b(Optimal|Borderline|Alert|Normal|Watch)\b/g)
    .map((part, n) =>
      words[part] ? (
        <span
          className="inline-health-status"
          key={n}
          style={{ color: STATUS_COLORS[words[part].status] }}
        >
          {words[part].label}
        </span>
      ) : (
        part
      ),
    );
}
function engineLabel(ai: AiBriefing) {
  const t = new Date(ai.createdAt).toISOString().slice(11, 16);
  return ai.engine === "gemini"
    ? `AI briefing · ${t} UTC`
    : `Offline rules · ${t} UTC${ai.fallbackReason ? ` (${ai.fallbackReason})` : ""}`;
}
function Lines({ lines }: { lines: BriefingLine[] }) {
  return (
    <ul className="briefing-lines">
      {lines.map((l, n) => (
        <li key={l.label + n} data-status={l.status}>
          <span
            className="briefing-dot"
            aria-hidden="true"
            style={{ background: STATUS_COLORS[l.status] }}
          />
          <strong>{l.label}</strong>
          <span
            className="briefing-line-status"
            style={{ color: STATUS_COLORS[l.status] }}
          >
            {l.status === "nominal"
              ? "Normal"
              : l.status === "caution"
                ? "Watch"
                : l.status === "critical"
                  ? "Alert"
                  : ""}
          </span>
          <span className="briefing-line-text">{l.text}</span>
        </li>
      ))}
    </ul>
  );
}
function FullAiBriefing({ ai }: { ai: AiBriefing }) {
  return (
    <div className="full-briefing ai-briefing" data-engine={ai.engine}>
      {ai.sosRecommended && (
        <div className="risk" style={statusStyle("critical")}>
          <strong>
            <ShieldAlert size={15} /> SOS recommended
          </strong>
          <p>{ai.sosReason}</p>
        </div>
      )}
      {ai.interimSteps.length > 0 && (
        <>
          <h3>Do this now</h3>
          <ol>
            {ai.interimSteps.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ol>
        </>
      )}
      <h3>Last check-in{ai.lastCheckin ? ` · ${ai.lastCheckin.when}` : ""}</h3>
      {ai.sectionNotes?.checkin && <p>{ai.sectionNotes.checkin}</p>}
      {ai.lastCheckin ? (
        <Lines lines={ai.lastCheckin.lines} />
      ) : (
        <p>No check-in recorded yet.</p>
      )}
      <h3>Last 24 hours</h3>
      {ai.sectionNotes?.last24h && <p>{ai.sectionNotes.last24h}</p>}
      <Lines lines={ai.last24h} />
      <h3>Past 7 days</h3>
      {ai.sectionNotes?.sevenDay && <p>{ai.sectionNotes.sevenDay}</p>}
      <Lines lines={ai.sevenDay} />
      {ai.concerns.length > 0 && (
        <>
          <h3>Concerns</h3>
          {ai.concerns.map((c, n) => (
            <div
              className="risk"
              key={c.title + n}
              style={statusStyle(c.status)}
            >
              <strong>{c.title}</strong>
              <p>{c.detail}</p>
              {c.action && <p>→ {c.action}</p>}
            </div>
          ))}
        </>
      )}
      {ai.recommendations.length > 0 && (
        <>
          <h3>Recommended next checks</h3>
          <ol>
            {ai.recommendations.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ol>
        </>
      )}
      <p className="fine-print">
        {engineLabel(ai)} · Trigger: {ai.trigger} · Based on{" "}
        {ai.basedOn.readings} readings from the last 7 days
        {ai.basedOn.uploads ? `, ${ai.basedOn.uploads} photos/uploads` : ""}.
        Colours come from the health rules; decision support, not diagnosis.
      </p>
    </div>
  );
}
export function Briefing({
  model,
  onOpen,
  onBodyMap,
  onRefresh,
  full = false,
}: {
  model: MissionModel;
  onOpen?: () => void;
  onBodyMap?: () => void;
  onRefresh?: () => void;
  full?: boolean;
}) {
  const rules = model.briefing;
  const ai = model.aiBriefing;
  const b = ai
    ? {
        ...rules,
        overallStatus: ai.overallStatus,
        headline: ai.headline,
        plainEnglishSummary: ai.summary,
      }
    : rules;
  const allMissing = model.profile.indicators.every(
    (i) => statusOf(i) === "no_data",
  );
  const outdated =
    ai && ai.rulesStatusAtCreation !== model.report.overallStatus;
  const alerts = [
    ...rules.environmentAlerts,
    ...rules.emergingRisks.map((r) => r.explanation),
  ];
  return (
    <Panel
      title="Medical briefing"
      className={full ? "briefing-full" : "briefing-compact"}
      accessory={
        <span className="meta" data-testid="briefing-meta">
          {model.briefingWorking ? (
            <>
              <Sparkles size={12} /> Writing briefing…
            </>
          ) : ai ? (
            engineLabel(ai)
          ) : (
            `Updated ${rules.lastUpdated}`
          )}
        </span>
      }
    >
      <div className="briefing-heading">
        <h3 style={allMissing ? { color: STATUS_COLORS.no_data } : undefined}>
          {/^(ALERT|WATCH|NORMAL|OPTIMAL|BORDERLINE):/i.test(b.headline) ? (
            <>
              <span
                className="briefing-headline-status"
                style={{
                  color:
                    STATUS_COLORS[allMissing ? "no_data" : b.overallStatus],
                }}
              >
                {b.overallStatus === "critical"
                  ? "✕ "
                  : b.overallStatus === "caution"
                    ? "! "
                    : "✓ "}
                {b.headline.match(/^[^:]+:/)?.[0]}
              </span>
              {b.headline.replace(/^[^:]+:/, "")}
            </>
          ) : (
            b.headline
          )}
        </h3>
      </div>
      <p className="briefing-summary">
        <BriefingText
          omitCriticalLabel={b.overallStatus === "critical"}
          text={
            full ? b.plainEnglishSummary : shortSummary(b.plainEnglishSummary)
          }
        />
      </p>
      {outdated && !model.briefingWorking && (
        <p className="fine-print" role="status">
          New readings since this briefing; it will update shortly.
        </p>
      )}
      {alerts.length > 0 && (!ai || full) && (
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
            <ArrowRight data-icon="inline-end" />
          </Button>
        )}
        {onRefresh && (
          <Button
            variant="ghost"
            onClick={onRefresh}
            disabled={model.briefingWorking}
            aria-label="Refresh briefing"
          >
            <RefreshCw data-icon="inline-start" />
            {model.briefingWorking ? "Writing…" : "Refresh"}
          </Button>
        )}
        {onBodyMap && (
          <Button variant="ghost" onClick={onBodyMap}>
            View Body Map & Countermeasures
            <ArrowRight data-icon="inline-end" />
          </Button>
        )}
      </div>
      {full && ai && <FullAiBriefing ai={ai} />}
      {full && !ai && (
        <div className="full-briefing">
          <h3>Recommended tool checks</h3>
          <ol>
            {rules.recommendedToolChecks.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          {rules.emergingRisks.map((r, n) => (
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
  onBodySystem,
  onScan,
  onRefreshBriefing,
}: {
  model: MissionModel;
  onTrend: (id: string) => void;
  onPage: (page: string) => void;
  onBriefing: () => void;
  onBodySystem: (system: BodySystem) => void;
  onScan?: () => Promise<ScanResult | null>;
  onRefreshBriefing?: () => void;
}) {
  const state = model.missionState,
    exposure = state.exposure,
    limit = THRESHOLDS.radiation.careerLimitMSv;
  return (
    <div className="revised-home">
      <CheckinReminder model={model} onCheckin={() => onPage("Check-in")} />
      <div className="home-health-columns">
        <div className="home-health-content">
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
            onRefresh={onRefreshBriefing}
          />
        </div>
        <HomeScan model={model} onSelect={onBodySystem} onScan={onScan} />
      </div>
      <section
        className="exposure-grid compact-exposure"
        aria-label="Mission exposure"
      >
        <div>
          <Radiation />
          <section>
            <h3>Radiation exposure</h3>
            <strong
              className="health-value"
              style={statusStyle(
                statusOf(
                  model.profile.indicators.find(
                    (i) => i.id === "radiation_dose",
                  )!,
                ),
              )}
            >
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
            <strong
              className="health-value"
              style={statusStyle(
                statusOf(
                  model.profile.indicators.find(
                    (i) => i.id === "bone_density",
                  )!,
                ),
              )}
            >
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
