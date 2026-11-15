import { useEffect, useRef, useState } from "react";
import { scoreReactionTrials } from "@/services/wellbeingService";
import { Button } from "@/components/ui/button";
/** Collect real reaction times; the backend scores and records the final result on check-in submission. */
export function ReactionTest({
  onResult,
}: {
  onResult: (ms: number | null) => void;
}) {
  const [running, setRunning] = useState(false),
    [ready, setReady] = useState(false),
    [remaining, setRemaining] = useState(60),
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
    setRemaining(60);
    setRunning(true);
    refs.current.end = performance.now() + 60000;
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
        : "Too soon — wait for the signal.",
    );
    window.clearTimeout(refs.current.timer);
    signal();
  };
  return (
    <section className="reaction-test">
      <h3>60-second reaction test</h3>
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
        {running ? "Test in progress" : "Start 60-second test"}
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
    </section>
  );
}
