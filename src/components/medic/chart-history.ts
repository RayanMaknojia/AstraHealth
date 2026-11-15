import type { HistoryPoint } from "@/types/astronaut";

/** Multi-day history uses one daily average; intraday keeps individual sources. */
export function historyForRange(
  history: HistoryPoint[],
  missionDay: number,
  range: number,
) {
  const day = Math.floor(missionDay);
  const current = history.filter(
    (p) => p.day < day + 1 && p.day >= Math.max(0, day - range),
  );
  if (range === 1)
    return current
      .filter((p) => Math.floor(p.day) === day)
      .map((p) => ({ ...p, today: true, sources: p.source }));
  const groups = new Map<number, typeof current>();
  for (const p of current) {
    const d = Math.floor(p.day);
    if (d > day) continue;
    groups.set(d, [...(groups.get(d) ?? []), p]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([d, readings]) => {
      const sources = [...new Set(readings.map((p) => p.source))];
      return {
        day: d,
        value: readings.reduce((s, p) => s + p.value, 0) / readings.length,
        baseline:
          readings.reduce((s, p) => s + p.baseline, 0) / readings.length,
        source: sources.length === 1 ? sources[0] : "mixed",
        sources: sources.join(", "),
        today: d === day,
      };
    });
}
