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
    return indicator.history.filter((p) => p.day >= latest - range);
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
  const projectionDays = Math.min(14, indicator.projectedDaysToThreshold ?? 0);
  const chartPoints: {
    day: number;
    value?: number;
    baseline: number;
    projected?: number;
  }[] = points.map((p, n) => ({
    ...p,
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
          margin={{ top: 15, right: 14, bottom: 5, left: 0 }}
        >
          <CartesianGrid
            stroke="#203041"
            strokeDasharray="3 6"
            vertical={false}
          />
          <XAxis
            dataKey="day"
            type="number"
            domain={["dataMin", "dataMax"]}
            tick={{ fill: "#8a9fb4", fontSize: 10 }}
            tickFormatter={(v) => `D${Math.floor(v)}`}
            axisLine={false}
            tickLine={false}
            minTickGap={30}
          />
          <YAxis
            domain={[min, max]}
            tick={{ fill: "#8a9fb4", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={compact ? 38 : 45}
            tickFormatter={(v) => Number(v.toFixed(1)).toString()}
          />
          <Tooltip
            contentStyle={chartTooltip}
            labelFormatter={(v) => `Mission day ${Number(v).toFixed(2)}`}
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
            dataKey="value"
            name={indicator.name}
            stroke="#5fe2e7"
            dot={false}
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
}: {
  profile: AstronautProfile;
  state: MissionState;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [range, setRange] = useState(30);
  const [guide, setGuide] = useState<HealthIndicator | null>(null);
  const indicator =
    profile.indicators.find((i) => i.id === selectedId) ??
    profile.indicators[0];
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
            {profile.indicators.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          History range
          <select
            value={range}
            onChange={(e) => setRange(Number(e.target.value))}
          >
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={2000}>Whole mission</option>
          </select>
        </label>
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
          <span>Actual reading</span>
          <span>Personal baseline</span>
          <span>Projected drift (when available)</span>
          <small>Phase markers · Reference bands from health rules</small>
        </div>
        <p className="fine-print">
          Bands show range boundaries. Pattern and personal-baseline alerts are
          evaluated by the health service. Blood pressure plots the systolic
          value.
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
              <XAxis dataKey="day" tick={{ fill: "#8a9fb4", fontSize: 11 }} />
              <YAxis
                domain={[0, Math.max(dose, exposures.at(-1)!.dose * 1.1)]}
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
