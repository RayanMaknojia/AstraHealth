import { useEffect, useId, useMemo, useState } from "react";
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
  BodySystem,
  DisplayStatus,
  IndicatorId,
  StatusLevel,
} from "@/types/astronaut";
import { Button } from "@/components/ui/button";
import { statusOf } from "./status";
import type { MissionModel } from "./use-mission";
import humanModel from "./assets/human-model.webp";
// The same silhouette defines the neutral body, image mask and status-fill boundary.
const BODY_OUTLINE =
  "M150 12 C134 12 127 24 128 41 C129 54 136 63 140 66 L139 77 C126 79 112 82 105 91 C98 103 96 120 91 139 L80 174 L63 216 C57 225 54 239 59 247 Q63 251 65 240 Q66 254 70 251 L75 233 L86 219 L102 184 L114 147 L117 175 L116 211 Q114 233 118 250 C114 277 119 309 121 337 L117 412 L113 432 Q106 444 119 444 L135 444 Q144 442 140 429 L143 347 L150 281 L157 347 L160 429 Q156 442 165 444 L181 444 Q194 444 187 432 L183 412 L179 337 C181 309 186 277 182 250 Q186 233 184 211 L183 175 L186 147 L198 184 L214 219 L225 233 L230 251 Q234 254 235 240 Q237 251 241 247 C246 239 243 225 237 216 L220 174 L209 139 C204 120 202 103 195 91 C188 82 174 79 161 77 L160 66 C164 63 171 54 172 41 C173 24 166 12 150 12 Z";
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
    shape: "M100 245H200V450H100Z",
  },
  {
    id: "abdomen",
    label: "Metabolism",
    system: "metabolic",
    at: 0.5,
    ids: ["blood_sugar"],
    shape: "M110 174H190V254H110Z",
  },
  {
    id: "chest",
    label: "Heart and circulation",
    system: "cardiovascular",
    at: 0.65,
    ids: ["heart_rate", "blood_pressure"],
    shape: "M103 88H197V179H103Z",
  },
  {
    id: "arms",
    label: "Immune and radiation",
    system: "radiation_immune",
    at: 0.72,
    ids: ["body_temp", "radiation_dose"],
    shape: "M40 85H119V264H40Z M181 85H260V264H181Z",
  },
  {
    id: "neck",
    label: "Breathing and oxygen",
    system: "cardiovascular",
    at: 0.84,
    ids: ["spo2"],
    shape: "M132 65H168V89H132Z",
  },
  {
    id: "head",
    label: "Brain and wellbeing",
    system: "behavioral",
    at: 0.96,
    ids: ["mood", "sleep_hours"],
    shape: "M122 9H178V68H122Z",
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

export function HomeScan({
  model,
  onSelect,
}: {
  model: MissionModel;
  onSelect: (system: BodySystem) => void;
}) {
  const clipId = useId().replace(/:/g, "");
  const [startAt, setStartAt] = useState<number | null>(null);
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
    <section className="home-scan" aria-label="Body scan">
      <div className="home-scan-heading">
        <h2>Body scan</h2>
        <span>Latest onboard readings</span>
      </div>
      <div
        className="human-scan-stage home-scan-stage"
        data-scan-progress={progress.toFixed(2)}
      >
        <svg
          className="anatomy-hotspots"
          viewBox="0 0 300 450"
          role="group"
          aria-label="Scanned body regions"
        >
          <defs>
            <clipPath id={`${clipId}-body`}>
              <path d={BODY_OUTLINE} />
            </clipPath>
            <clipPath id={`${clipId}-reveal`}>
              <rect
                className="scan-reveal-window"
                x="0"
                y={450 * (1 - progress)}
                width="300"
                height={450 * progress}
              />
            </clipPath>
            <linearGradient id={`${clipId}-beam`}>
              <stop stopColor="#9ee9f7" stopOpacity="0" />
              <stop offset=".5" stopColor="#d2f8ff" />
              <stop offset="1" stopColor="#9ee9f7" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={BODY_OUTLINE} fill="#475569" />
          <g clipPath={`url(#${clipId}-body)`}>
            <image
              href={humanModel}
              x="0"
              y="0"
              width="300"
              height="450"
              opacity=".36"
              style={{ filter: "grayscale(1)" }}
            />
            <g clipPath={`url(#${clipId}-reveal)`}>
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
                    style={{ color: STATUS_COLORS[data.status] }}
                  >
                    <title>
                      {r.label}. {data.reason}
                    </title>
                    <path
                      d={r.shape}
                      fill="currentColor"
                      fillOpacity={0.55}
                      stroke="none"
                    />
                  </g>
                );
              })}
            </g>
          </g>
          <path
            d={BODY_OUTLINE}
            fill="none"
            stroke="#9cafc1"
            strokeWidth=".7"
            opacity=".5"
            pointerEvents="none"
          />
          {startAt !== null && (
            <line
              className="scan-beam"
              x1="35"
              x2="265"
              y1={450 * (1 - progress)}
              y2={450 * (1 - progress)}
              stroke={`url(#${clipId}-beam)`}
              strokeWidth="1.8"
              pointerEvents="none"
            />
          )}
        </svg>
      </div>
      <div className="home-scan-footer">
        <Button
          disabled={startAt !== null}
          onClick={() => {
            setProgress(0);
            setCompletedAt("");
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
