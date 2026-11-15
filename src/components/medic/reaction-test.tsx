import { useEffect, useRef, useState } from "react";
import {
  scoreReactionTrials,
  evaluateReaction,
  getReactionBaseline,
} from "@/services/wellbeingService";
import { Status } from "./primitives";
import { statusStyle } from "./status";
import { Button } from "@/components/ui/button";
/** Collect real reaction times; the backend scores and records the final result on check-in submission. */
export function ReactionTest({
  onResult,
  astronautId,
}: {
  onResult: (ms: number | null) => void;
  astronautId: string;
}) {
  const [running, setRunning] = useState(false),
    [ready, setReady] = useState(false),
    [remaining, setRemaining] = useState(30),
    [trials, setTrials] = useState<number[]>([]),
    [message, setMessage] = useState("");
  const refs = useRef({
    end: 0,
    signal: 0,
    timer: 0,
    interval: 0,
    trials: [] as number[],
  });
  const result = scoreReactionTrials(trials);
  const baseline = getReactionBaseline(astronautId);
  const ms = result.medianMs;
  const evaluated = ms === null ? null : evaluateReaction(ms, baseline);
  const resultStatus =
    baseline === null && ms !== null
      ? ms > 350
        ? "caution"
        : "nominal"
      : (evaluated?.status ?? "no_data");
  const explanation =
    ms === null
      ? ""
      : baseline === null
        ? `${ms} ms. Baseline being set. Optimal reference: 250 to 350 ms.`
        : `${ms} ms. ${evaluated?.status === "critical" ? "Much slower than your usual. Rest and retest later." : evaluated?.status === "caution" ? "A bit slower than your usual. Check your sleep and stress." : ms < baseline ? "Faster than your usual. Nice." : "Your reaction time is in your optimal range."}`;
  const clear = () => {
    window.clearTimeout(refs.current.timer);
    window.clearInterval(refs.current.interval);
  };
  useEffect(
    () => () => {
      window.clearTimeout(refs.current.timer);
      window.clearInterval(refs.current.interval);
    },
    [],
  );
  const signal = () => {
    setReady(false);
    refs.current.signal = 0;
    refs.current.timer = window.setTimeout(
      () => {
        refs.current.signal = performance.now();
        setReady(true);
      },
      1000 + Math.random() * 2000,
    );
  };
  const finish = () => {
    clear();
    setRunning(false);
    setReady(false);
    setRemaining(0);
    const score = scoreReactionTrials(refs.current.trials);
    onResult(score.medianMs);
    setMessage(
      score.medianMs === null
        ? "No valid trials. Start a new test and tap only after the signal."
        : `Median reaction: ${score.medianMs} ms. Saved with your check-in.`,
    );
  };
  const start = () => {
    clear();
    refs.current.trials = [];
    setTrials([]);
    onResult(null);
    setMessage("");
    setRemaining(30);
    setRunning(true);
    refs.current.end = performance.now() + 30000;
    signal();
    refs.current.interval = window.setInterval(() => {
      const seconds = Math.max(
        0,
        Math.ceil((refs.current.end - performance.now()) / 1000),
      );
      setRemaining(seconds);
      if (!seconds) finish();
    }, 100);
  };
  const tap = () => {
    if (!running) return;
    const ms = refs.current.signal
      ? performance.now() - refs.current.signal
      : 0;
    refs.current.trials.push(ms);
    setTrials([...refs.current.trials]);
    setMessage(
      refs.current.signal
        ? `${Math.round(ms)} ms`
        : "Too soon - wait for the signal.",
    );
    window.clearTimeout(refs.current.timer);
    signal();
  };
  return (
    <section className="reaction-test">
      <h3>30-second reaction test</h3>
      <p>
        Wait for “Tap now”, then click or press Space on the target. Early taps
        and long lapses are excluded by the health service.
      </p>
      <div className="reaction-status">
        <span role="timer">{remaining} seconds</span>
        <span>{result.validTrials} valid trials</span>
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={start}
        disabled={running}
      >
        {running ? "Test in progress" : "Start 30-second test"}
      </Button>
      <button
        type="button"
        disabled={!running}
        className={`reaction-target ${ready ? "ready" : ""}`}
        onClick={tap}
      >
        {running ? (ready ? "Tap now" : "Wait for signal…") : "Reaction target"}
      </button>
      <p role="status">{message}</p>
      {!running && remaining === 0 && ms !== null && (
        <p className="reaction-result" style={statusStyle(resultStatus)}>
          <Status status={resultStatus} /> {explanation}
        </p>
      )}
      <small>
        Finish the check-in to save this test.{" "}
        {baseline === null
          ? "A personal baseline is established after three saved tests."
          : `Your baseline: ${baseline} ms.`}
      </small>
    </section>
  );
}
