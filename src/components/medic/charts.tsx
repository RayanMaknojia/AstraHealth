import { statusOf } from "./status";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Info, TrendingUp } from "lucide-react";
import type {
  HealthIndicator,
  MissionState,
  AstronautProfile,
  BodySystem,
} from "@/types/astronaut";
import {
  boundsFor,
  computeTrajectory,
  getSpaceAdjustments,
  STATUS_COLORS,
  ACTION_LABELS,
  ESCALATION_MODE_LABELS,
} from "@/services/healthEvaluator";
import { computeExposure } from "@/services/missionTimeline";
import { THRESHOLDS } from "@/data/nasaSpaceflightData";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Panel, Status } from "./primitives";
const chartTooltip = {
  background: "#101b29",
  border: "1px solid #293e51",
  borderRadius: 8,
  color: "#e6f0f7",
  fontSize: 12,
};
export function VitalChart({
  indicator,
  state,
  priorDose = 0,
  compact = false,
  range = 30,
}: {
  indicator: HealthIndicator;
  state: MissionState;
  priorDose?: number;
  compact?: boolean;
  range?: number;
}) {
  const points = useMemo(() => {
    const latest = indicator.history.at(-1)?.day ?? state.missionDay;
    return indicator.history.filter((p) =>
      range === 1
        ? p.day >= Math.floor(latest) && p.day < Math.floor(latest) + 1
        : p.day >= latest - range,
    );
  }, [indicator.history, range, state.missionDay]);
  const bounds = boundsFor(indicator.id, getSpaceAdjustments(state), priorDose);
  if (!points.length)
    return (
      <div className="chart-empty">
        No readings yet. Complete a check-in to start your history.
      </div>
    );
  const trajectory = computeTrajectory(indicator.id, indicator.history, {
    adjustments: getSpaceAdjustments(state),
    environment: state.phase.environment,
    priorCareerDoseMSv: priorDose,
    status: indicator.status,
  });
  const last = points.at(-1)!;
  const projectionDays =
    range === 1 ? 0 : Math.min(14, indicator.projectedDaysToThreshold ?? 0);
  const chartPoints: {
    day: number;
    value?: number;
    baseline: number;
    projected?: number;
    wearable?: number;
    manual?: number;
    synthetic?: number;
  }[] = points.map((p, n) => ({
    ...p,
    wearable: p.source === "wearable_auto" ? p.value : undefined,
    manual: [
      "manual_slider",
      "lab_document",
      "ultrasound_image",
      "voice_log",
    ].includes(p.source)
      ? p.value
      : undefined,
    synthetic: p.source === "environment_feed" ? p.value : undefined,
    ...(!compact && projectionDays > 0 && n === points.length - 1
      ? { projected: p.value }
      : {}),
  }));
  if (!compact && projectionDays > 0)
    chartPoints.push({
      day: last.day + projectionDays,
      baseline: last.baseline,
      projected: last.value + trajectory.slopePerDay * projectionDays,
    });
  const all = [
    ...points.flatMap((p) => [p.value, p.baseline]),
    ...chartPoints.flatMap((p) =>
      p.projected === undefined ? [] : [p.projected],
    ),
  ];
  const low = Math.min(...all);
  const high = Math.max(...all);
  const pad = Math.max((high - low) * 0.25, 1);
  const min = low - pad;
  const max = high + pad;
  const boundaries = [
    min,
    ...Object.values(bounds).filter(
      (v): v is number => v !== undefined && v > min && v < max,
    ),
    max,
  ].sort((a, b) => a - b);
  const bands = boundaries.slice(0, -1).map((from, n) => {
    const to = boundaries[n + 1];
    const mid = (from + to) / 2;
    const status =
      (bounds.criticalLow !== undefined && mid < bounds.criticalLow) ||
      (bounds.criticalHigh !== undefined && mid >= bounds.criticalHigh)
        ? "critical"
        : (bounds.cautionLow !== undefined && mid < bounds.cautionLow) ||
            (bounds.cautionHigh !== undefined && mid >= bounds.cautionHigh)
          ? "caution"
          : "nominal";
    return { from, to, status };
  });
  return (
    <div
      className={compact ? "vital-chart compact" : "vital-chart"}
      role="img"
      aria-label={`${indicator.name} actual readings and personal baseline over ${range} days`}
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <LineChart
          data={chartPoints}
          margin={{ top: 20, right: 20, bottom: 25, left: 16 }}
        >
          <CartesianGrid
            stroke="#203041"
            strokeDasharray="3 6"
            vertical={false}
          />
          <XAxis
            dataKey="day"
            type="number"
            domain={
              range === 1
                ? [Math.floor(last.day), Math.floor(last.day) + 1]
                : ["dataMin", "dataMax"]
            }
            tick={{ fill: "#8a9fb4", fontSize: 12 }}
            tickFormatter={(v) =>
              range === 1
                ? v === Math.floor(last.day) + 1
                  ? "24:00"
                  : `${String(Math.floor((v - Math.floor(v)) * 24)).padStart(2, "0")}:${String(Math.round((((v - Math.floor(v)) * 24) % 1) * 60) % 60).padStart(2, "0")}`
                : `D${Math.floor(v)}`
            }
            label={{
              value: range === 1 ? "Onboard time (hours)" : "Mission day",
              position: "insideBottom",
              offset: -16,
              fill: "#b9ccd8",
              fontSize: 12,
            }}
            axisLine={false}
            tickLine={false}
            minTickGap={30}
          />
          <YAxis
            domain={[min, max]}
            label={{
              value: indicator.unit,
              angle: -90,
              position: "insideLeft",
              offset: -6,
              fill: "#b9ccd8",
              fontSize: 12,
            }}
            tick={{ fill: "#8a9fb4", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={compact ? 38 : 45}
            tickFormatter={(v) => Number(v.toFixed(1)).toString()}
          />
          <Tooltip
            contentStyle={chartTooltip}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div style={chartTooltip}>
                  <strong>Mission day {Number(label).toFixed(3)}</strong>
                  <p>
                    Source:{" "}
                    {String(
                      payload[0]?.payload?.source ?? "Projected / baseline",
                    )}
                  </p>
                  {payload
                    .filter((x) => x.value !== undefined)
                    .map((x) => (
                      <p key={String(x.dataKey)}>
                        {x.name}: {Number(x.value).toFixed(1)} {indicator.unit}
                      </p>
                    ))}
                </div>
              ) : null
            }
          />
          {!compact &&
            bands.map((b) => (
              <ReferenceArea
                key={b.from}
                y1={b.from}
                y2={b.to}
                fill={STATUS_COLORS[b.status as keyof typeof STATUS_COLORS]}
                fillOpacity={0.045}
              />
            ))}
          {!compact &&
            state.plan.phases
              .filter(
                (p) =>
                  p.startDay >= points[0].day &&
                  p.startDay <= chartPoints.at(-1)!.day,
              )
              .map((p) => (
                <ReferenceLine
                  key={p.order}
                  x={p.startDay}
                  stroke="#60778d"
                  strokeDasharray="3 3"
                  label={{
                    value: p.name,
                    position: "insideTopRight",
                    fill: "#8a9fb4",
                    fontSize: 9,
                  }}
                />
              ))}
          <Line
            type="linear"
            dataKey="projected"
            name="Projected drift"
            stroke="#c6d9ea"
            strokeDasharray="3 4"
            dot={false}
            strokeWidth={1.5}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="baseline"
            name="Personal baseline"
            stroke="#6d859d"
            strokeDasharray="4 5"
            dot={false}
            strokeWidth={1}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="wearable"
            name="Wearable"
            stroke="#5fe2e7"
            dot={{ r: 3 }}
            connectNulls
            strokeWidth={2}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="manual"
            name="Manual / clinical entry"
            stroke="#7eb2ed"
            dot={{ r: 3 }}
            connectNulls
            strokeWidth={2}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="synthetic"
            name="Environment / synthetic"
            stroke="#d6e2e8"
            dot={{ r: 3 }}
            connectNulls
            strokeWidth={2}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
export function Guide({
  indicator,
  onClose,
}: {
  indicator: HealthIndicator | null;
  onClose: () => void;
}) {
  return (
    <Sheet
      open={!!indicator}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className="guide-dialog">
        <SheetTitle>{indicator?.name} · Field guide</SheetTitle>
        <SheetDescription>
          Onboard measurement and action protocol
        </SheetDescription>
        {indicator && (
          <>
            <Status status={statusOf(indicator)} />
            <h3>How to measure</h3>
            <p>{indicator.howToMeasure}</p>
            <h3>Why it matters</h3>
            <p>{indicator.whyNeeded}</p>
            {indicator.spaceShiftNote && (
              <>
                <h3>In this environment</h3>
                <p>{indicator.spaceShiftNote}</p>
              </>
            )}
            <h3>
              Action protocol · {ACTION_LABELS[indicator.actionPlan.level]}
            </h3>
            <ol>
              {indicator.actionPlan.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            {indicator.actionPlan.escalationMode && (
              <p>
                {ESCALATION_MODE_LABELS[indicator.actionPlan.escalationMode]}
              </p>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
export function Trends({
  profile,
  state,
  selectedId,
  onSelect,
  system,
  clearSystem,
}: {
  profile: AstronautProfile;
  state: MissionState;
  selectedId: string;
  onSelect: (id: string) => void;
  system?: BodySystem | null;
  clearSystem?: () => void;
}) {
  const [range, setRange] = useState(30);
  const [guide, setGuide] = useState<HealthIndicator | null>(null);
  const choices = profile.indicators.filter(
    (i) => !system || i.system === system,
  );
  const indicator = choices.find((i) => i.id === selectedId) ?? choices[0];
  const dose = THRESHOLDS.radiation.careerLimitMSv;
  const exposures = Array.from({ length: 41 }, (_, n) => {
    const day = Math.round((state.missionDay * n) / 40);
    return {
      day,
      dose: computeExposure(profile.mission, day).totalRadiationMSv,
    };
  });
  return (
    <>
      <div className="trend-controls">
        <label>
          Indicator
          <select
            value={indicator.id}
            onChange={(e) => onSelect(e.target.value)}
          >
            {choices.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </label>
        <div
          role="group"
          aria-label="History timeframe"
          className="timeframe-toggle"
        >
          {[
            { value: 1, label: "1D" },
            { value: 7, label: "7D" },
            { value: 30, label: "30D" },
            { value: 2000, label: "Mission" },
          ].map((t) => (
            <button
              key={t.value}
              aria-pressed={range === t.value}
              onClick={() => setRange(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>
        {system && (
          <Button variant="outline" onClick={clearSystem}>
            All systems
          </Button>
        )}
        <Button variant="outline" onClick={() => setGuide(indicator)}>
          <Info data-icon="inline-start" />
          Measurement guide
        </Button>
      </div>
      <Panel
        title={indicator.name}
        accessory={<Status status={statusOf(indicator)} />}
      >
        <div className="chart-value">
          {indicator.value ?? "—"} <small>{indicator.unit}</small>
        </div>
        <VitalChart
          indicator={indicator}
          state={state}
          priorDose={profile.priorCareerDoseMSv}
          range={range}
        />
        <div className="chart-key">
          <span>Wearable (teal)</span>
          <span>Manual / clinical (blue)</span>
          <span>Environment / synthetic (white)</span>
          <span>Personal baseline</span>
          <span>Projected drift (when available)</span>
          <small>Phase markers · Reference bands from health rules</small>
        </div>
        <p className="fine-print">
          {indicator.simulated ? "Simulated crew data. " : ""}1D shows the
          latest recorded mission day; source colors identify how data entered
          the app. Bands show range boundaries. Pattern and personal-baseline
          alerts are evaluated by the health service. Blood pressure plots the
          systolic value.
        </p>
        {indicator.projectedDaysToThreshold !== undefined && (
          <p className="trajectory">
            <TrendingUp size={16} />
            Projected threshold in about{" "}
            {Math.round(indicator.projectedDaysToThreshold)} days ·{" "}
            {indicator.trend.replaceAll("_", " ")}
          </p>
        )}
        <p>
          {profile.indicators.find((i) => i.id === indicator.id)
            ?.spaceShiftNote ?? indicator.whyNeeded}
        </p>
      </Panel>
      <Panel
        title="Cumulative radiation"
        accessory={<span className="meta">Mission model · mSv</span>}
      >
        <div className="vital-chart">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart data={exposures}>
              <CartesianGrid stroke="#203041" vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fill: "#b8ccd8", fontSize: 12 }}
                label={{
                  value: "Mission day",
                  position: "insideBottom",
                  offset: -6,
                  fill: "#b8ccd8",
                }}
              />
              <YAxis
                domain={[0, Math.max(dose, exposures.at(-1)!.dose * 1.1)]}
                label={{
                  value: "mSv",
                  angle: -90,
                  position: "insideLeft",
                  fill: "#b8ccd8",
                }}
                tick={{ fill: "#8a9fb4", fontSize: 11 }}
              />
              <Tooltip contentStyle={chartTooltip} />
              <ReferenceLine
                y={dose * THRESHOLDS.radiation.cautionCareerFraction}
                stroke={STATUS_COLORS.caution}
                strokeDasharray="4 4"
                label={{ value: "50%", fill: STATUS_COLORS.caution }}
              />
              <ReferenceLine
                y={dose * THRESHOLDS.radiation.criticalCareerFraction}
                stroke={STATUS_COLORS.critical}
                strokeDasharray="4 4"
                label={{ value: "80%", fill: STATUS_COLORS.critical }}
              />
              <ReferenceLine
                y={dose}
                stroke="#6b7280"
                label={{ value: `${dose} mSv`, fill: "#8a9fb4" }}
              />
              <Line
                type="monotone"
                dataKey="dose"
                stroke="#5fe2e7"
                dot={false}
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="fine-print">
          Modeled mission dose by phase; live dosimeter readings remain in the
          radiation indicator history. Career exposure before this mission:{" "}
          {profile.priorCareerDoseMSv} mSv.
        </p>
      </Panel>
      <Guide indicator={guide} onClose={() => setGuide(null)} />
    </>
  );
}
