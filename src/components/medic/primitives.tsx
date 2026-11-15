import type { ReactNode } from "react";
import { Orbit, Plus } from "lucide-react";
import { STATUS_LABELS } from "@/services/healthEvaluator";
import type { DisplayStatus } from "@/types/astronaut";
import { statusStyle } from "./status";
import { Badge } from "@/components/ui/badge";
export function Status({ status }: { status: DisplayStatus }) {
  return (
    <Badge
      variant="outline"
      className={`health-status ${status === "critical" ? "critical-pulse" : ""}`}
      style={statusStyle(status)}
    >
      <span className="status-dot" />
      {status === "no_data" ? "Unknown" : STATUS_LABELS[status]}
    </Badge>
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
        SPACE<span>MEDIC</span>
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
