import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Rocket, Trophy, Users, Timer } from "lucide-react";
import { RACE_RULES } from "@/data/ghostRaceData";
import {
  evaluateReaction,
  getReactionBaseline,
  recordReaction,
} from "@/services/wellbeingService";
import {
  dailyCourse,
  gateResult,
  getBoard,
  getGhosts,
  saveRun,
  scoreRun,
} from "@/services/ghostRaceService";
import type { RaceGateResult, RaceRun } from "@/types/astronaut";
import { Button } from "@/components/ui/button";
import { Status } from "./primitives";
import { statusStyle } from "./status";

type Phase = "idle" | "countdown" | "running" | "done";
const COUNTDOWN_MS = 3000;
const MAX_TOTAL =
  RACE_RULES.gates * (RACE_RULES.maxPoints - RACE_RULES.floorPoints);
const ordinal = (n: number) =>
  n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`;

/**
 * Ghost Run - Reaction test: race today's docking course against your crewmates'
 * ghosts. Each green docking light is one reaction trial (a psychomotor vigilance
 * test, the kind used to track alertness and fatigue), so every run also measures
 * reaction speed and compares it with the astronaut's own baseline:
 *  - in the weekly check-in, the median is saved with the check-in (onResult);
 *  - played from More, it is saved to the health record straight away.
 */
export function GhostRun({
  astronautId,
  name,
  missionDay,
  mode,
  required = false,
  onResult,
}: {
  astronautId: string;
  name: string;
  missionDay: number;
  /** "checkin": part of the weekly check-in (saved on submit); "play": More page (saved now). */
  mode: "checkin" | "play";
  required?: boolean;
  onResult?: (medianMs: number | null) => void;
}) {
  const day = Math.floor(missionDay);
  const course = useMemo(() => dailyCourse(day), [day]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [t, setT] = useState(0);
  const [results, setResults] = useState<RaceGateResult[]>([]);
  const [feedback, setFeedback] = useState("");
  const [run, setRun] = useState<RaceRun | null>(null);
  const [saved, setSaved] = useState(false);
  const baseline = getReactionBaseline(astronautId);
  // Ghosts and the board change only when a run is saved, not every frame.
  const [snap, setSnap] = useState(() => ({
    ghosts: getGhosts(astronautId, day),
    board: getBoard(astronautId, day),
  }));
  const { ghosts, board } = snap;
  const live = useRef({
    start: 0,
    gate: 0,
    falseStarts: 0,
    results: [] as RaceGateResult[],
    frame: 0,
  });

  const finish = useCallback(() => {
    cancelAnimationFrame(live.current.frame);
    const scored = scoreRun({
      astronautId,
      name,
      missionDay: day,
      gates: live.current.results,
    });
    saveRun(scored);
    setRun(scored);
    // Played from More: this run is a reaction test of its own, saved right away.
    // In the check-in it is saved when the check-in is submitted (onResult).
    if (mode === "play" && scored.medianMs !== null) {
      try {
        recordReaction(astronautId, day, scored.medianMs);
        setSaved(true);
      } catch {
        setSaved(false);
      }
    }
    setPhase("done");
    // Ghosts stay as raced; the board now includes this run.
    setSnap((s) => ({ ...s, board: getBoard(astronautId, day) }));
    onResult?.(scored.medianMs);
  }, [astronautId, name, day, onResult, mode]);

  const resolveGate = useCallback(
    (result: RaceGateResult) => {
      const L = live.current;
      L.results = [...L.results, result];
      L.gate += 1;
      L.falseStarts = 0;
      setResults(L.results);
      setFeedback(
        result.outcome === "missed"
          ? "Missed that one"
          : `${result.rtMs} ms · +${result.points}`,
      );
      if (L.gate >= course.gates.length) finish();
    },
    [course, finish],
  );

  // Game clock: advances the race and times out unanswered lights.
  useEffect(() => {
    if (phase !== "countdown" && phase !== "running") return;
    const tick = () => {
      const L = live.current;
      const now = performance.now() - L.start;
      setT(now);
      if (phase === "countdown" && now >= 0) setPhase("running");
      const gate = course.gates[L.gate];
      if (
        phase === "running" &&
        gate &&
        now > gate.atMs + RACE_RULES.windowMs
      ) {
        resolveGate(gateResult(null, L.falseStarts));
      }
      if (L.gate < course.gates.length) L.frame = requestAnimationFrame(tick);
    };
    live.current.frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(live.current.frame);
  }, [phase, course, resolveGate]);

  const press = useCallback(() => {
    const L = live.current;
    if (phase !== "running") return;
    const gate = course.gates[L.gate];
    if (!gate) return;
    const now = performance.now() - L.start;
    const rt = now - gate.atMs;
    if (rt < RACE_RULES.falseStartBelowMs) {
      L.falseStarts += 1;
      setFeedback("Too early: wait for green");
      return;
    }
    resolveGate(gateResult(rt, L.falseStarts));
  }, [phase, course, resolveGate]);

  // Space bar docks while a run is on.
  useEffect(() => {
    if (phase !== "running" && phase !== "countdown") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      e.preventDefault();
      press();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, press]);

  const start = () => {
    setSnap({
      ghosts: getGhosts(astronautId, day),
      board: getBoard(astronautId, day),
    });
    live.current = {
      start: performance.now() + COUNTDOWN_MS,
      gate: 0,
      falseStarts: 0,
      results: [],
      frame: 0,
    };
    setResults([]);
    setRun(null);
    setSaved(false);
    setFeedback("");
    setT(-COUNTDOWN_MS);
    setPhase("countdown");
    onResult?.(null);
  };

  const gateIndex = results.length;
  const gate = course.gates[gateIndex];
  const green = phase === "running" && gate !== undefined && t >= gate.atMs;
  const myTotal = results.reduce((a, r) => a + r.points, 0);
  const ghostTotal = (path: { atMs: number; total: number }[]) => {
    let total = 0;
    for (const p of path) if (p.atMs <= t) total = p.total;
    return phase === "done" ? (path.at(-1)?.total ?? 0) : total;
  };
  const lanes = [
    {
      key: "you",
      name: `You (${name.split(" ").slice(-1)[0]})`,
      total: myTotal,
      ghost: false,
      simulated: false,
    },
    ...ghosts.map((g) => ({
      key: g.runId,
      name: g.name,
      total: phase === "idle" ? 0 : ghostTotal(g.path),
      ghost: true,
      simulated: g.simulated,
    })),
  ];
  const rank =
    run !== null ? 1 + ghosts.filter((g) => g.score > run.score).length : null;
  const beat = run
    ? ghosts.filter((g) => g.score < run.score).map((g) => g.name)
    : [];
  // Reaction speed vs the astronaut's own baseline (same rules as the old reaction test).
  const ms = run?.medianMs ?? null;
  const verdict = ms === null ? null : evaluateReaction(ms, baseline);
  const reactionStatus =
    ms === null
      ? "no_data"
      : baseline === null
        ? ms > 350
          ? "caution"
          : "nominal"
        : (verdict?.status ?? "no_data");
  const reactionText =
    ms === null
      ? "No valid presses this run, so no reaction time. Race again and press only on green."
      : baseline === null
        ? `${ms} ms. Baseline being set. Optimal reference: 250 to 350 ms.`
        : verdict?.status === "critical"
          ? `${ms} ms. Much slower than your usual (${verdict.slowerPct}%). Rest, and retest later; avoid EVA, robotics and piloting until it recovers.`
          : verdict?.status === "caution"
            ? `${ms} ms. A bit slower than your usual (${verdict.slowerPct}%). Check your sleep and stress.`
            : ms < baseline
              ? `${ms} ms. Faster than your usual. Nice.`
              : `${ms} ms. Your reaction time is in your optimal range.`;
  const weekPct = Math.min(
    100,
    Math.round((board.crewWeek.total / board.crewWeek.target) * 100),
  );

  return (
    <section className="docking-run" aria-label="Ghost Run, reaction test">
      <div className="dock-head">
        <div>
          <h3>
            Ghost Run · Reaction test
            {required && (
              <span className="required-mark" aria-hidden="true">
                *{" "}
              </span>
            )}
          </h3>
          <p>
            Day {day} course · {course.gates.length} docking lights · about{" "}
            {Math.round(course.durationMs / 1000)} s. Press <b>Space</b> or tap
            the dock the moment the light turns green. Race your crewmates’
            ghosts; every point also counts toward the crew’s weekly target.
          </p>
        </div>
        {phase === "idle" || phase === "done" ? (
          <Button type="button" onClick={start}>
            <Rocket data-icon="inline-start" />
            {phase === "done" ? "Race again" : "Start run"}
          </Button>
        ) : (
          <span className="dock-timer" role="timer">
            <Timer size={16} aria-hidden="true" />
            {phase === "countdown"
              ? `Starting in ${Math.max(1, Math.ceil(-t / 1000))}`
              : `Light ${Math.min(gateIndex + 1, course.gates.length)} of ${course.gates.length}`}
          </span>
        )}
      </div>

      <div className="dock-track" aria-hidden="true">
        {lanes.map((lane) => (
          <div
            key={lane.key}
            className={`dock-lane ${lane.ghost ? "ghost" : "you"}`}
          >
            <span className="dock-name">
              {lane.name}
              {lane.simulated && <em> · simulated</em>}
            </span>
            <span className="dock-rail">
              <span
                className="dock-ship"
                style={{
                  left: `calc(${(Math.min(lane.total, MAX_TOTAL) / MAX_TOTAL) * 100}% - 14px)`,
                }}
              >
                <Rocket size={22} />
              </span>
              <span className="dock-station" />
            </span>
            <span className="dock-score">{lane.total.toLocaleString()}</span>
          </div>
        ))}
      </div>

      <button
        type="button"
        className={`dock-target ${green ? "go" : ""} ${phase}`}
        disabled={phase !== "running" && phase !== "countdown"}
        onPointerDown={(e) => {
          e.preventDefault();
          press();
        }}
        aria-label={green ? "Dock now" : "Docking light"}
      >
        {phase === "idle"
          ? "Docking light"
          : phase === "countdown"
            ? "Get ready…"
            : phase === "done"
              ? "Docked"
              : green
                ? "DOCK NOW"
                : "Hold…"}
      </button>
      <p className="dock-feedback" role="status" aria-live="polite">
        {phase === "running" || phase === "countdown" ? feedback : ""}
      </p>

      {phase === "done" && run && (
        <div className="dock-results">
          <div className="dock-result-main">
            <Trophy aria-hidden="true" />
            <div>
              <strong>
                {run.score.toLocaleString()} points · {ordinal(rank ?? 1)} of{" "}
                {ghosts.length + 1}
              </strong>
              <span>
                {beat.length
                  ? `You beat ${beat.join(", ")}.`
                  : "Every ghost got you this time. Race again?"}
                {board.personalBest === run.score && " New personal best!"}
              </span>
            </div>
          </div>
          <div className="dock-stats">
            <span>
              Personal best{" "}
              <b>{(board.personalBest ?? run.score).toLocaleString()}</b>
            </span>
            <span>
              Station record today{" "}
              <b>{board.stationRecord?.score.toLocaleString() ?? "-"}</b>{" "}
              {board.stationRecord &&
                `(${board.stationRecord.name}${board.stationRecord.simulated ? ", simulated" : ""})`}
            </span>
            <span>
              Reaction (median) <b>{run.medianMs ?? "-"} ms</b> · {run.lapses}{" "}
              slow · {run.misses} missed · {run.falseStarts} early
            </span>
          </div>
          <div className="dock-week">
            <span>
              <Users size={16} aria-hidden="true" /> Crew target, days{" "}
              {board.crewWeek.days[0]}–{board.crewWeek.days[1]}:{" "}
              <b>
                {board.crewWeek.total.toLocaleString()} /{" "}
                {board.crewWeek.target.toLocaleString()}
              </b>
              {weekPct >= 100 && " · reached! Crew movie night unlocked."}
            </span>
            <span className="dock-week-bar">
              <span style={{ width: `${weekPct}%` }} />
            </span>
          </div>
          <div className="dock-reaction">
            <h4>Reaction speed</h4>
            <p className="reaction-result" style={statusStyle(reactionStatus)}>
              <Status status={reactionStatus} /> {reactionText}
            </p>
            <small>
              Reaction speed follows alertness: slower than your usual often
              comes with short sleep, fatigue or stress.{" "}
              {baseline === null
                ? "A personal baseline is set after three saved tests."
                : `Your baseline: ${baseline} ms.`}{" "}
              {mode === "checkin"
                ? "Finish the check-in to save this test."
                : saved
                  ? "Saved to your health record."
                  : ""}
            </small>
          </div>
          <small>
            Simulated crewmates race until real crewmates run today’s course.
          </small>
        </div>
      )}
    </section>
  );
}
