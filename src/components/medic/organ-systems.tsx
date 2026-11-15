import type { CSSProperties } from "react";
import type { BodySystem, DisplayStatus } from "@/types/astronaut";
import { ORGAN_SYSTEMS, STATUS_GLOW, tiltHandlers } from "./organ-systems-data";

/**
 * One organ illustration (a plain <img>, never warped or replaced) with a
 * gentle float, pointer tilt, two slow-rotating dashed scanner rings and a
 * soft radial glow in the system's status colour.
 */
export function OrganView({
  system,
  status,
  className,
}: {
  system: BodySystem;
  status: DisplayStatus;
  className?: string;
}) {
  const s = ORGAN_SYSTEMS.find((x) => x.id === system)!;
  return (
    <span
      className={`organ-view ${className ?? ""}`}
      data-status={status}
      style={{ "--glow": STATUS_GLOW[status] } as CSSProperties}
    >
      <span className="organ-glow" aria-hidden="true" />
      <span className="organ-tilt">
        <img
          className="organ-float"
          src={s.image}
          alt={`${s.label}, anatomical illustration`}
          width={900}
          height={900}
          decoding="async"
          draggable={false}
        />
      </span>
      <svg
        className="organ-rings"
        viewBox="-100 -100 200 200"
        aria-hidden="true"
      >
        <g className="organ-ring organ-ring-a">
          <ellipse rx="88" ry="30" />
        </g>
        <g className="organ-ring organ-ring-b">
          <ellipse rx="80" ry="24" />
        </g>
      </svg>
    </span>
  );
}

export function OrganSystems({
  selected,
  onSelect,
  statuses,
}: {
  selected: BodySystem;
  onSelect: (s: BodySystem) => void;
  statuses: Record<BodySystem, DisplayStatus>;
}) {
  return (
    <section className="organ-systems organ-rows" aria-label="Body systems">
      <div className="organ-cards">
        {ORGAN_SYSTEMS.map((system) => (
          <button
            key={system.id}
            className="organ-card"
            title={system.label}
            aria-label={system.label}
            aria-pressed={selected === system.id}
            onClick={() => onSelect(system.id)}
            {...tiltHandlers}
          >
            <span className="organ-model organ-stage">
              <OrganView system={system.id} status={statuses[system.id]} />
            </span>
            <span className="organ-card-name">{system.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
