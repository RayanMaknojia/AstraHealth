import { useEffect, useMemo, useState } from "react";
import { ScanLine } from "lucide-react";
import { STATUS_COLORS, worstStatus } from "@/services/healthEvaluator";
import {
  getBodyMassSummary,
  getExerciseSummary,
} from "@/services/exerciseService";
import {
  listReactions,
  evaluateReaction,
  getReactionBaseline,
} from "@/services/wellbeingService";
import { listCheckins } from "@/services/checkinService";
import type {
  ScanResult,
  BodySystem,
  DisplayStatus,
  IndicatorId,
  StatusLevel,
} from "@/types/astronaut";
import { Button } from "@/components/ui/button";
import { statusOf } from "./status";
import type { MissionModel } from "./use-mission";
import humanModel from "./assets/human-model.webp";
const regions: {
  id: string;
  label: string;
  system: BodySystem;
  at: number;
  ids: IndicatorId[];
  shape: string;
}[] = [
  {
    id: "legs",
    label: "Bones and muscle",
    system: "musculoskeletal",
    at: 0.25,
    ids: ["bone_density"],
    shape:
      "M123 250L144 263L146 338L140 439L118 439L120 335Z M177 250L156 263L154 338L160 439L182 439L180 335Z",
  },
  {
    id: "abdomen",
    label: "Metabolism",
    system: "metabolic",
    at: 0.5,
    ids: ["blood_sugar"],
    shape: "M121 179Q150 190 179 179L177 237Q150 257 123 237Z",
  },
  {
    id: "chest",
    label: "Heart and circulation",
    system: "cardiovascular",
    at: 0.65,
    ids: ["heart_rate", "blood_pressure"],
    shape: "M116 86Q150 73 184 86L180 167Q150 181 120 167Z",
  },
  {
    id: "arms",
    label: "Immune and radiation",
    system: "radiation_immune",
    at: 0.72,
    ids: ["body_temp", "radiation_dose"],
    shape:
      "M104 87L116 104L101 162L77 228L62 221L83 154Z M196 87L184 104L199 162L223 228L238 221L217 154Z",
  },
  {
    id: "neck",
    label: "Breathing and oxygen",
    system: "cardiovascular",
    at: 0.84,
    ids: ["spo2"],
    shape: "M139 63L161 63L166 81L134 81Z",
  },
  {
    id: "head",
    label: "Brain and wellbeing",
    system: "behavioral",
    at: 0.96,
    ids: ["mood", "sleep_hours"],
    shape: "M150 12C124 12 123 40 130 55Q150 74 170 55C177 40 176 12 150 12Z",
  },
];
function regionState(r: (typeof regions)[number], model: MissionModel) {
  const indicators = model.profile.indicators.filter((i) =>
    r.ids.includes(i.id),
  );
  const states: DisplayStatus[] = indicators.map(statusOf);
  const reasons = indicators.map(
    (i) =>
      `${i.name}: ${i.value ?? "not measured"} ${i.unit}. ${model.report.indicators.find((x) => x.id === i.id)?.message ?? ""}`,
  );
  if (r.id === "legs" || r.id === "abdomen") {
    const mass = getBodyMassSummary(model.profile.id, model.profile.missionDay);
    states.push(mass.status);
    reasons.push(mass.message);
  }
  if (r.id === "legs") {
    const exercise = getExerciseSummary(
      model.profile.id,
      model.profile.missionDay,
    );
    states.push(exercise.status);
    reasons.push(exercise.message);
  }
  if (r.id === "head") {
    const reaction = listReactions(model.profile.id)
      .filter((x) => x.day <= model.profile.missionDay)
      .at(-1);
    if (reaction) {
      const result = evaluateReaction(
        reaction.ms,
        getReactionBaseline(model.profile.id),
      );
      states.push(result.status);
      reasons.push(result.message);
    }
    reasons.push("Stress: see latest check-in; no graded sensor reading.");
  }
  if (r.id === "neck")
    reasons.push("Breathing rate: no sensor reading available.");
  if (r.id === "arms") {
    const symptoms = listCheckins(
      model.profile.id,
      model.profile.missionDay,
      1,
    ).flatMap((x) => x.symptoms);
    if (symptoms.includes("skin problem"))
      reasons.push("Skin symptom reported; review in Photo Check.");
  }
  const known = states.filter((s): s is StatusLevel => s !== "no_data");
  return {
    status: (known.length ? worstStatus(known) : "no_data") as DisplayStatus,
    reason: reasons.join(" "),
  };
}

const KPI_LABEL: Record<string, string> = {
  heart_rate: "Heart rate",
  body_temp: "Temperature",
  spo2: "SpO2",
  systolic: "Blood pressure",
};
export function HomeScan({
  model,
  onSelect,
  onScan,
}: {
  model: MissionModel;
  onSelect: (system: BodySystem) => void;
  /** Generates new readings (Python server or browser fallback) while the beam runs. */
  onScan?: () => Promise<ScanResult | null>;
}) {
  const [startAt, setStartAt] = useState<number | null>(null);
  const [scanInfo, setScanInfo] = useState<string>("");
  const [progress, setProgress] = useState(0);
  const [completedAt, setCompletedAt] = useState("");
  useEffect(() => {
    if (startAt === null) return;
    let frame = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - startAt) / 5000);
      setProgress(p);
      if (p < 1) frame = requestAnimationFrame(tick);
      else {
        setCompletedAt(new Date().toISOString().slice(11, 19) + " UTC");
        setStartAt(null);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [startAt]);
  const complete = Boolean(completedAt);
  const regionData = useMemo(
    () => regions.map((r) => ({ r, data: regionState(r, model) })),
    [model],
  );

  return (
    <section
      className="home-scan"
      aria-label="Body scan"
      data-scan-result={scanInfo || undefined}
    >
      <div className="home-scan-heading">
        <h2>Body scan</h2>
        <span>Latest onboard readings</span>
      </div>
      <div
        className="human-scan-stage home-scan-stage"
        data-scan-progress={progress.toFixed(2)}
      >
        <img
          src={humanModel}
          alt="Human body; select a region after the scan completes"
          width={540}
          height={810}
        />
        <svg
          className="anatomy-hotspots"
          viewBox="0 0 300 450"
          role="group"
          aria-label="Scanned body regions"
        >
          {regionData.map(({ r, data }) => {
            const revealed = progress >= r.at;
            return (
              <g
                key={r.id}
                role="button"
                tabIndex={complete ? 0 : -1}
                aria-disabled={!complete}
                aria-label={`${r.label}: ${revealed ? { nominal: "Optimal", caution: "Borderline", critical: "Alert", no_data: "No data" }[data.status] : "Not scanned"}. ${data.reason}`}
                data-region={r.id}
                data-status={revealed ? data.status : "no_data"}
                onClick={() => {
                  if (complete) onSelect(r.system);
                }}
                onKeyDown={(e) => {
                  if (complete && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    onSelect(r.system);
                  }
                }}
                style={{
                  color: STATUS_COLORS[revealed ? data.status : "no_data"],
                }}
              >
                <title>
                  {r.label}. {data.reason}
                </title>
                {r.id === "neck" && (
                  // Invisible padding: the neck is small, so give it a 24 px+ touch target.
                  <rect x="126" y="57" width="48" height="30" fill="transparent" />
                )}
                <path
                  d={r.shape}
                  fill="currentColor"
                  fillOpacity={revealed ? 0.48 : 0.08}
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
              </g>
            );
          })}
        </svg>
        {startAt !== null && (
          <div
            className="home-scan-line"
            aria-hidden="true"
            style={{ bottom: `${progress * 100}%` }}
          />
        )}
      </div>
      <div className="home-scan-footer">
        <Button
          disabled={startAt !== null}
          onClick={() => {
            setProgress(0);
            setCompletedAt("");
            setScanInfo("");
            if (onScan)
              void onScan().then((s) => {
                if (!s) return setScanInfo("Scan readings could not be saved.");
                const r = s.readings;
                setScanInfo(
                  `${s.generator === "python" ? "Body scanner" : "Onboard scanner"}: HR ${r.heart_rate} bpm · ${r.body_temp} °C · SpO2 ${r.spo2}% · BP ${r.systolic}/${r.diastolic}${s.anomaly ? `. ${KPI_LABEL[s.anomaly.kpi] ?? s.anomaly.kpi}: ${s.anomaly.level === "critical" ? "Alert" : "Watch"}` : ""}`,
                );
              });
            if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
              setProgress(1);
              setCompletedAt(new Date().toISOString().slice(11, 19) + " UTC");
            } else setStartAt(performance.now());
          }}
        >
          <ScanLine data-icon="inline-start" />
          {startAt !== null
            ? "Scanning…"
            : complete
              ? "Scan again"
              : "Start scan"}
        </Button>
        <p role="status">
          {complete
            ? `Scan complete · ${completedAt}`
            : startAt !== null
              ? "Reading latest data from feet to head"
              : "Ready when you are"}
        </p>
        <small>Visual review of existing data, not a diagnostic sensor.</small>
      </div>
    </section>
  );
}
