import { ArrowRight } from "lucide-react";
import type { BodySystem, DisplayStatus, StatusLevel } from "@/types/astronaut";
import {
  STATUS_COLORS,
  boundsFor,
  getSpaceAdjustments,
  ESCALATION_MODE_LABELS,
  worstStatus,
} from "@/services/healthEvaluator";
import { CHECKIN_INPUTS } from "@/data/nasaSpaceflightData";
import { Button } from "@/components/ui/button";
import { Panel, Status, NumberedInstructions } from "./primitives";
import { OrganSystems, OrganView } from "./organ-systems";
import { tiltHandlers } from "./organ-systems-data";
import { statusOf } from "./status";
import type { MissionModel } from "./use-mission";
const labels: Record<BodySystem, { name: string; function: string }> = {
  cardiovascular: {
    name: "Heart & circulation",
    function:
      "Moves blood and oxygen around your body. Changes in gravity affect circulation and blood pressure.",
  },
  behavioral: {
    name: "Brain & wellbeing",
    function:
      "Sleep, mood and attention help you make decisions and work safely with your crew.",
  },
  metabolic: {
    name: "Metabolism",
    function:
      "Regulates energy and blood sugar to support daily tasks and recovery.",
  },
  musculoskeletal: {
    name: "Bones & muscles",
    function:
      "Supports movement and strength. Resistance exercise helps counter reduced gravitational loading.",
  },
  radiation_immune: {
    name: "Immune & radiation",
    function:
      "Tracks radiation exposure and the signs used to assess immune and infection risks.",
  },
};
export function BodyMap({
  model,
  toggle,
  onTrends,
  selected,
  onSelect,
}: {
  model: MissionModel;
  selected: BodySystem;
  onSelect: (system: BodySystem) => void;
  toggle: (id: string) => void;
  onTrends: (system: BodySystem) => void;
}) {
  const indicators = model.profile.indicators.filter(
    (i) => i.system === selected,
  );
  const states = indicators
    .map(statusOf)
    .filter((s): s is StatusLevel => s !== "no_data");
  const status: DisplayStatus = states.length ? worstStatus(states) : "no_data";
  // Live status per system drives each organ model's glow colour.
  const statuses = Object.fromEntries(
    (Object.keys(labels) as BodySystem[]).map((sys) => {
      const known = model.profile.indicators
        .filter((i) => i.system === sys)
        .map(statusOf)
        .filter((s): s is StatusLevel => s !== "no_data");
      return [sys, known.length ? worstStatus(known) : "no_data"];
    }),
  ) as Record<BodySystem, DisplayStatus>;
  return (
    <div className="body-map-page">
      <div className="body-layout revised-body-map">
        <OrganSystems
          selected={selected}
          onSelect={onSelect}
          statuses={statuses}
        />
        <Panel
          title={labels[selected].name}
          accessory={<Status status={status} />}
        >
          <div className="system-hero">
            <div className="organ-hero-frame" {...tiltHandlers}>
              <OrganView
                key={selected}
                system={selected}
                status={status}
                className="organ-view-hero"
              />
            </div>
            <p className="system-function">{labels[selected].function}</p>
          </div>
          <div className="system-detail">
            {indicators.map((i) => {
              const bounds = boundsFor(
                i.id,
                getSpaceAdjustments(model.missionState),
                model.profile.priorCareerDoseMSv,
              );
              const normal = CHECKIN_INPUTS.filter((s) => s.indicator === i.id)
                .map((s) => s.normalText)
                .join(" / ");
              return (
                <section
                  key={i.id}
                  style={
                    {
                      "--status": STATUS_COLORS[statusOf(i)],
                    } as React.CSSProperties
                  }
                >
                  <div className="detail-kpi">
                    <h3>{i.name}</h3>
                    <Status status={statusOf(i)} />
                  </div>
                  <div
                    className="chart-value"
                    style={{ color: `var(--status)` }}
                  >
                    {statusOf(i) === "no_data" ? "-" : i.value}
                    <small> {i.unit}</small>
                  </div>
                  <p>
                    {model.report.indicators.find((e) => e.id === i.id)
                      ?.message ?? "No verified reading available."}
                  </p>
                  <p className="meta">
                    {i.simulated ? "Simulated · " : ""}
                    {i.history.at(-1)?.timestamp ?? "Not measured"}
                  </p>
                  <dl className="reference-ranges">
                    <dt>Normal reference</dt>
                    <dd>
                      {normal || "Phase-dependent; see current evaluation."}
                    </dd>
                    <dt>Watch boundaries</dt>
                    <dd>
                      {bounds.cautionLow !== undefined
                        ? `Below ${bounds.cautionLow} ${i.unit}`
                        : ""}
                      {bounds.cautionLow !== undefined &&
                      bounds.cautionHigh !== undefined
                        ? " / "
                        : ""}
                      {bounds.cautionHigh !== undefined
                        ? `From ${bounds.cautionHigh} ${i.unit}`
                        : ""}
                    </dd>
                    <dt>Alert boundaries</dt>
                    <dd>
                      {bounds.criticalLow !== undefined
                        ? `Below ${bounds.criticalLow} ${i.unit}`
                        : ""}
                      {bounds.criticalLow !== undefined &&
                      bounds.criticalHigh !== undefined
                        ? " / "
                        : ""}
                      {bounds.criticalHigh !== undefined
                        ? `From ${bounds.criticalHigh} ${i.unit}`
                        : ""}
                    </dd>
                  </dl>
                  <p className="fine-print">
                    Ranges are supplied by the health service; personal
                    baselines and repeated patterns also affect status.
                    {i.id === "blood_pressure"
                      ? " Numeric boundaries refer to systolic pressure."
                      : ""}
                  </p>
                  {i.spaceShiftNote && <p>{i.spaceShiftNote}</p>}
                  <h4>Actionable countermeasures</h4>
                  <ol>
                    {i.actionPlan.steps.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ol>
                  <details>
                    <summary>How to measure / Why needed</summary>
                    <NumberedInstructions text={i.howToMeasure} />
                    <p>{i.whyNeeded}</p>
                  </details>
                </section>
              );
            })}
          </div>
          <div className="system-countermeasure-tasks">
            <h3>Countermeasure checklist</h3>
            {model.profile.routine
              .filter((t) => t.linkedSystem === selected)
              .map((t) => (
                <label key={t.id} className="check-label">
                  <input
                    type="checkbox"
                    checked={t.completed}
                    onChange={() => toggle(t.id)}
                  />
                  {t.title}
                </label>
              ))}
          </div>
          <p className="escalation-rule">
            {ESCALATION_MODE_LABELS[model.report.escalationMode]}
          </p>
          <Button variant="outline" onClick={() => onTrends(selected)}>
            View trends for this system
            <ArrowRight data-icon="inline-end" />
          </Button>
        </Panel>
      </div>
    </div>
  );
}
