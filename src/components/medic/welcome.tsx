import { useCallback, useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { speak } from "@/services/voice";
import { Brand } from "./primitives";

/** How long the welcome stays on screen before fading into the dashboard. */
const SHOW_MS = 2600;
const FADE_MS = 450;

/**
 * Full-screen login welcome: shows "Welcome, Commander Okafor" and speaks it with the
 * device's built-in voice. Tap, click, Esc, Enter or Space skips it. Any health alert
 * waits until it is gone (Workspace holdAlerts).
 */
export function WelcomeScreen({
  text,
  onDone,
}: {
  text: string;
  onDone: () => void;
}) {
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);
  const host = useRef<HTMLDivElement>(null);
  const finished = useRef(false);

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    const el = host.current;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (el && !reduced) {
      el.dataset.leaving = "true";
      setTimeout(() => doneRef.current(), FADE_MS);
    } else doneRef.current();
  }, []);

  useEffect(() => {
    void speak(text);
    const timer = setTimeout(finish, SHOW_MS);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        finish();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, [text, finish]);

  const [greeting, ...rest] = text.split(", ");
  const name = rest.join(", ");
  return (
    <div
      ref={host}
      className="welcome-screen"
      role="status"
      aria-live="polite"
      onClick={finish}
      style={{ "--welcome-fade": `${FADE_MS}ms` } as CSSProperties}
    >
      <div className="welcome-orbit" aria-hidden="true">
        <span className="welcome-ring welcome-ring-one" />
        <span className="welcome-ring welcome-ring-two" />
      </div>
      <div className="welcome-content">
        <Brand />
        <h1>
          {name ? (
            <>
              <span className="welcome-greeting">{greeting},</span>
              <span className="welcome-name">{name}</span>
            </>
          ) : (
            <span className="welcome-name">{text}</span>
          )}
        </h1>
        <p className="welcome-skip">Tap or press Esc to continue</p>
      </div>
    </div>
  );
}
