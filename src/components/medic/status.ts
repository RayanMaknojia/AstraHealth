import type { CSSProperties } from "react";
import type { DisplayStatus, HealthIndicator } from "@/types/astronaut";
import { displayStatus, STATUS_COLORS } from "@/services/healthEvaluator";
export function statusOf(i: HealthIndicator): DisplayStatus {
  return displayStatus({
    ...i,
    status:
      i.status === "nominal" && i.trend === "drifting_caution"
        ? "caution"
        : i.status,
  });
}
export function statusStyle(status: DisplayStatus): CSSProperties {
  return { "--status": STATUS_COLORS[status] } as CSSProperties;
}
