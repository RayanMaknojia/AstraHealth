import { useId, useState } from "react";
import { Pause, Play } from "lucide-react";
import type { BodySystem, StatusLevel } from "@/types/astronaut";
import { STATUS_COLORS, worstStatus } from "@/services/healthEvaluator";
import { Button } from "@/components/ui/button";
import { Status } from "./primitives";
import { statusOf } from "./status";
import type { MissionModel } from "./use-mission";

const systems: {
  id: BodySystem;
  label: string;
  organ: string;
  shape: string;
  detail: string;
}[] = [
  {
    id: "behavioral",
    label: "Brain & wellbeing",
    organ: "Brain",
    shape:
      "M49 21 C35 9 20 20 22 32 C9 37 11 54 20 59 C14 73 27 86 40 80 L49 86 L58 80 C73 88 85 74 80 62 C92 53 88 37 78 32 C80 19 64 10 51 21 Z",
    detail:
      "M50 23V81 M34 27Q26 40 39 45 M25 55Q40 49 40 65L33 73 M65 28Q76 41 62 46 M77 56Q61 50 61 66L67 73",
  },
  {
    id: "cardiovascular",
    label: "Heart & circulation",
    organ: "Heart",
    shape:
      "M44 34 L41 15 Q43 10 49 14 L53 30 L57 14 Q61 10 65 15 L63 33 L73 24 Q79 22 81 29 L70 42 C89 48 85 72 67 89 Q58 98 49 87 C22 73 17 53 28 39 Q35 30 44 34 Z",
    detail:
      "M45 37Q58 45 57 65L64 84 M29 49Q40 47 47 56 M59 56L74 50 M57 65L42 72",
  },
  {
    id: "metabolic",
    label: "Metabolism",
    organ: "Liver",
    shape:
      "M17 35 Q30 21 54 27 Q74 22 88 38 L82 56 Q69 61 57 52 Q43 75 22 72 Q11 59 17 35 Z",
    detail:
      "M55 29L57 51 M22 39Q35 33 46 37 M57 52Q50 49 43 54 M45 56Q43 70 50 74Q58 71 53 59",
  },
  {
    id: "musculoskeletal",
    label: "Bones & muscles",
    organ: "Bone",
    shape:
      "M24 18 C13 12 7 23 14 31 C7 41 18 49 27 40 L63 77 C56 87 66 96 74 88 C86 95 96 84 87 75 C95 64 83 55 75 63 L39 27 C47 17 34 8 24 18 Z",
    detail: "M31 32L68 71 M28 39L62 74 M19 23L24 27 M76 79L82 84",
  },
  {
    id: "radiation_immune",
    label: "Immune & radiation",
    organ: "Immune cell",
    shape:
      "M49 13 L59 19 L70 17 L76 28 L87 33 L84 46 L90 57 L80 66 L79 79 L64 81 L54 90 L43 83 L29 84 L24 72 L12 65 L17 53 L11 41 L22 32 L25 20 L39 21 Z",
    detail:
      "M35 42Q45 28 58 37Q75 42 65 56Q58 72 43 63Q29 59 35 42 Z M27 34L30 36 M71 30L69 34 M77 60L73 58 M28 66L32 63 M53 76V72",
  },
];

function Organ({ system }: { system: (typeof systems)[number] }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.9" />
          <stop offset="0.5" stopColor="currentColor" stopOpacity="0.4" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0.15" />
        </linearGradient>
      </defs>
      <path
        d={system.shape}
        fill={`url(#${id})`}
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d={system.detail}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.85"
      />
    </svg>
  );
}

export function OrganSystems({
  model,
  selected,
  onSelect,
}: {
  model: MissionModel;
  selected: BodySystem;
  onSelect: (system: BodySystem) => void;
}) {
  const [paused, setPaused] = useState(false);
  return (
    <section className="organ-systems" aria-label="Body system cards">
      <div className="organ-systems-heading">
        <div>
          <h2>Explore your body systems</h2>
          <p>Select a card or a region on the body.</p>
        </div>
        <Button
          variant="outline"
          aria-pressed={paused}
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? (
            <Play data-icon="inline-start" />
          ) : (
            <Pause data-icon="inline-start" />
          )}
          {paused ? "Resume rotation" : "Pause rotation"}
        </Button>
      </div>
      <div className="organ-cards" data-paused={paused}>
        {systems.map((system) => {
          const states = model.profile.indicators
            .filter((i) => i.system === system.id)
            .map(statusOf)
            .filter((s): s is StatusLevel => s !== "no_data");
          const status = states.length ? worstStatus(states) : "no_data";
          return (
            <button
              key={system.id}
              className="organ-card"
              aria-pressed={selected === system.id}
              onClick={() => onSelect(system.id)}
            >
              <span
                className="organ-viewport"
                style={{ color: STATUS_COLORS[status] }}
              >
                <span className="organ-spin">
                  <Organ system={system} />
                </span>
              </span>
              <span className="organ-card-name">{system.label}</span>
              <Status status={status} />
            </button>
          );
        })}
      </div>
    </section>
  );
}
