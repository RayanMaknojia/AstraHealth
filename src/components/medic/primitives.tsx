import type { ReactNode } from "react";
import { Orbit, Plus } from "lucide-react";
import type { DisplayStatus } from "@/types/astronaut";
import { statusStyle } from "./status";
export function Status({ status }: { status: DisplayStatus }) {
  return (
    <span className="health-status-text" style={statusStyle(status)}>
      <span aria-hidden="true">
        {status === "nominal"
          ? "✓"
          : status === "caution"
            ? "!"
            : status === "critical"
              ? "✕"
              : "?"}
      </span>{" "}
      {
        {
          nominal: "Optimal",
          caution: "Borderline",
          critical: "Alert",
          no_data: "No data",
        }[status]
      }
    </span>
  );
}
/**
 * Visible watermark for SI-generated (AI-generated) imagery, required by the
 * NASA Space Apps SI rules. Details: README (SI use).
 */
export function SiBadge({ label = "SI-generated" }: { label?: string }) {
  return (
    <span
      className="si-badge"
      title="Created with Super Intelligence (AI) tools. See the README."
    >
      {label}
    </span>
  );
}
export function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <Orbit />
        <Plus />
      </span>
      <span>
        ASTRA<span>HEALTH</span>
      </span>
    </div>
  );
}
export function Panel({
  title,
  accessory,
  children,
  className = "",
}: {
  title: string;
  accessory?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`med-panel ${className}`}>
      <div className="panel-heading">
        <h2>{title}</h2>
        {accessory}
      </div>
      {children}
    </section>
  );
}
export function PageTitle({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}
export function Meter({ value, label }: { value: number; label: string }) {
  return (
    <div
      className="med-meter"
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function NumberedInstructions({ text }: { text: string }) {
  const steps = text
    .split(/(?:^|\s)\d+[).]\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return (
    <ol>
      {steps.map((step, n) => (
        <li key={n}>{step}</li>
      ))}
    </ol>
  );
}
