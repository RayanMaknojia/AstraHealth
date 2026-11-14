import { statusOf } from "./status";
import { getCheckinReminder } from "./checkin-schedule";
import { lazy, Suspense, startTransition, useEffect, useState } from "react";
import {
  Home as HomeIcon,
  ClipboardList,
  ScanLine,
  ChartNoAxesCombined,
  Award,
  Ellipsis,
  LogOut,
  Radio,
  ShieldAlert,
  ArrowRight,
  Activity,
  Sun,
  FlaskConical,
  Upload,
  X,
  ChevronDown,
  Satellite,
  Camera,
  Check,
} from "lucide-react";
import type { AnomalyKind, AstronautProfile } from "@/types/astronaut";
import { DEMO_LOGINS } from "@/services/accountService";
import { CHECKIN_INPUTS } from "@/data/nasaSpaceflightData";
import { ANOMALY_LABELS } from "@/services/wearableStream";
import { createDemoInput } from "@/services/ingestionEngine";
import {
  formatDelay,
  STATUS_COLORS,
  ESCALATION_MODE_LABELS,
} from "@/services/healthEvaluator";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Brand, PageTitle, Panel, Status } from "./primitives";
import { useMission, notify } from "./use-mission";
import { Home, Tasks, Briefing, TripBar } from "./home";
const Checkin = lazy(() =>
  import("./checkin").then((m) => ({ default: m.Checkin })),
);
const BodyMap = lazy(() =>
  import("./body-map").then((m) => ({ default: m.BodyMap })),
);
const Trends = lazy(() =>
  import("./charts").then((m) => ({ default: m.Trends })),
);
const nav = [
  { name: "Home", icon: HomeIcon },
  { name: "Check-in", icon: ClipboardList },
  { name: "Body Map", icon: ScanLine },
  { name: "Trends", icon: ChartNoAxesCombined },
  { name: "Streaks", icon: Award },
  { name: "More", icon: Ellipsis },
];
const future = [
  "Photo Check",
  "Habitat",
  "Exercise & Bone",
  "Sleep, Mood & Journal",
  "Guidance & Triage",
  "Mission Control Sync",
];
const descriptions: Record<string, string> = {
  Home: "Continuous care. A clearer picture of your mission.",
  "Check-in": "A few readings. A better picture of how you feel.",
  "Body Map": "Understand your health, one system at a time.",
  Trends: "Your personal baseline. Your changing environment.",
  Streaks: "Small actions. Stronger missions.",
  More: "Everything you need for the journey ahead.",
  "Medical briefing": "Plain-English guidance, continuously updated onboard.",
  "Mission Timeline":
    "Every phase changes the journey. See what changes for you.",
};
export function Workspace({
  initialProfile,
  onLogout,
  onSwitchCrew,
}: {
  initialProfile: AstronautProfile;
  onLogout: () => void;
  onSwitchCrew: (login: string) => void;
}) {
  const controller = useMission(initialProfile);
  const {
    model,
    demo,
    setDemo,
    changeDay,
    submit,
    busy,
    result,
    wearable,
    feed,
    toggleTask,
  } = controller;
  const nextCheckin = getCheckinReminder(
    model.missionState.missionDay,
    model.onboardMinute,
    model.checkins,
    model.scheduleStartedDay,
  );
  const [page, setPage] = useState("Home");
  const [indicator, setIndicator] = useState("heart_rate");
  const [sos, setSos] = useState(false);
  const [ack, setAck] = useState("");
  const [showDemo, setShowDemo] = useState(false);
  const [anomaly, setAnomaly] = useState<AnomalyKind>("fever");
  const [crewNotified, setCrewNotified] = useState(false);
  const critical = model.profile.indicators.filter(
    (i) => statusOf(i) === "critical",
  );
  const shelter = model.environmentTick?.activeEvent?.shelterAdvised;
  const criticalKey = [
    ...critical.map((i) => i.id),
    ...(model.briefing.overallStatus === "critical" ? ["briefing"] : []),
    ...(shelter ? [model.environmentTick!.activeEvent!.id] : []),
  ]
    .sort()
    .join(":");
  const [observedCritical, setObservedCritical] = useState(criticalKey);
  if (observedCritical !== criticalKey) {
    setObservedCritical(criticalKey);
    setAck("");
    setCrewNotified(false);
  }
  const override = !!criticalKey && ack !== criticalKey;
  const showCritical = override || (!sos && !!criticalKey);
  const overall = model.profile.indicators.every(
    (i) => statusOf(i) === "no_data",
  )
    ? "no_data"
    : model.briefing.overallStatus;
  const go = (target: string) => {
    startTransition(() => setPage(target));
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const trend = (id: string) => {
    setIndicator(id);
    go("Trends");
  };
  const sync = () => {
    wearable.current?.tickOnce();
    feed.current?.tickOnce();
  };
  const solar = () => {
    feed.current?.triggerSolarEvent();
    feed.current?.tickOnce();
    wearable.current?.injectAnomaly("solar_flare");
    wearable.current?.tickOnce();
  };
  useEffect(() => {
    document.title = `Space Medic · ${page}`;
  }, [page]);
  return (
    <div className="workspace">
      <aside className="mission-sidebar">
        <Brand />
        <div className="sidebar-label">ONBOARD HEALTH</div>
        <nav aria-label="Main navigation">
          {nav.map((n) => (
            <button
              key={n.name}
              aria-label={n.name}
              className={page === n.name ? "active" : ""}
              aria-current={page === n.name ? "page" : undefined}
              onClick={() => go(n.name)}
            >
              <n.icon size={19} />
              <span>{n.name}</span>
              {page === n.name && <span className="nav-active-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-mission">
          <Satellite size={27} />
          <span>
            Far from Earth.
            <br />
            <strong>Never on your own.</strong>
          </span>
          <div className="connection">
            <span />
            Offline capable
          </div>
        </div>
        <div className="crew-identity">
          <span className="crew-avatar">{model.profile.agency}</span>
          <div>
            <strong>{model.profile.name}</strong>
            <small>{model.profile.role}</small>
          </div>
        </div>
        <button
          className="logout-button"
          aria-label="Log out"
          onClick={onLogout}
        >
          <LogOut size={16} />
          <span>Log out</span>
        </button>
      </aside>
      <div className="workspace-main">
        <header className="topbar">
          <div className="top-mission">
            <span
              className="status-dot"
              style={{ background: STATUS_COLORS[overall] }}
            />
            <strong>
              <span className="header-mission-day">
                Day {model.missionState.missionDay}
              </span>
              <span className="header-mission-phase">
                {model.missionState.phase.name}
              </span>
            </strong>
          </div>
          <span className="earth-delay">
            <Radio size={15} />
            Earth delay{" "}
            <b>{formatDelay(model.missionState.earthDelaySeconds)}</b>
          </span>
          <label className="demo-toggle">
            Demo mode
            <Switch
              checked={demo}
              onCheckedChange={setDemo}
              aria-label="Demo mode"
            />
          </label>
          <Button variant="destructive" onClick={() => setSos(true)}>
            <ShieldAlert data-icon="inline-start" />
            SOS
          </Button>
        </header>
        <main className="mission-content">
          <PageTitle
            title={
              page === "Home"
                ? "Mission overview"
                : page === "Streaks"
                  ? "Consistency is your superpower."
                  : page === "More"
                    ? "For the journey ahead."
                    : page === "Check-in"
                      ? "Let’s check in."
                      : page === "Body Map"
                        ? "A view from within."
                        : page === "Trends"
                          ? "The bigger picture."
                          : page === "Mission Timeline"
                            ? "Your mission, mapped."
                            : page === "Medical briefing"
                              ? "Your onboard briefing."
                              : page
            }
            description={
              page === "Home"
                ? `${model.profile.name} · ${model.profile.agency}`
                : (descriptions[page] ?? "The next chapter of onboard care.")
            }
          >
            <div className="page-live">
              <span className={demo ? "paused-dot" : "live-dot"} />
              {demo ? "DEMO · MANUAL SYNC" : "LIVE · EVERY 15s"}
              <small>{model.lastEvent}</small>
            </div>
          </PageTitle>
          {demo && (
            <details
              className="demo-bar"
              open={showDemo}
              onToggle={(e) => setShowDemo(e.currentTarget.open)}
            >
              <summary>
                <Activity size={16} />
                <strong>Mission Control</strong>
                <span>Demo controls</span>
                <ChevronDown size={15} />
              </summary>
              <div className="demo-tools">
                <label className="demo-crew">
                  Demo crew
                  <select
                    aria-label="Demo crew"
                    value={model.profile.login}
                    onChange={(e) => onSwitchCrew(e.target.value)}
                  >
                    {!DEMO_LOGINS.some(
                      (d) => d.login === model.profile.login,
                    ) && (
                      <option value={model.profile.login}>
                        {model.profile.login}
                      </option>
                    )}
                    {DEMO_LOGINS.filter((d) => d.login !== "admin").map((d) => (
                      <option key={d.login} value={d.login}>
                        {d.login}
                      </option>
                    ))}
                  </select>
                </label>
                <Button variant="outline" onClick={sync}>
                  <Activity data-icon="inline-start" />
                  +15m Wearable Sync
                </Button>
                <Button variant="outline" onClick={solar}>
                  <Sun data-icon="inline-start" />
                  Trigger Solar Storm Shelter Alert
                </Button>
                <div className="anomaly-control">
                  <select
                    aria-label="Anomaly type"
                    value={anomaly}
                    onChange={(e) => setAnomaly(e.target.value as AnomalyKind)}
                  >
                    {Object.entries(ANOMALY_LABELS)
                      .filter(([key]) => key !== "solar_flare")
                      .map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                  </select>
                  <Button
                    variant="outline"
                    onClick={() => {
                      wearable.current?.injectAnomaly(anomaly);
                      wearable.current?.tickOnce();
                    }}
                  >
                    Inject
                  </Button>
                </div>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    void submit(createDemoInput("valid_ultrasound"))
                  }
                >
                  <Upload data-icon="inline-start" />
                  Test Valid Ultrasound
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => void submit(createDemoInput("invalid_file"))}
                >
                  <FlaskConical data-icon="inline-start" />
                  Test Invalid File
                </Button>
                <label className="day-slider">
                  Mission day <b>{model.missionState.missionDay}</b>
                  <input
                    type="range"
                    aria-label="Mission day"
                    min={0}
                    max={model.profile.mission.totalDays}
                    value={model.missionState.missionDay}
                    onChange={(e) => void changeDay(Number(e.target.value))}
                  />
                </label>
              </div>
              {result && (
                <div className="demo-result" role="status">
                  <strong>
                    {result.verdict.accepted
                      ? "Accepted & Normalized"
                      : "Rejected: Non-Biomedical Data"}
                  </strong>
                  <span>
                    {result.verdict.accepted
                      ? result.artifact.extractedSummary
                      : result.verdict.rejectionReason}
                  </span>
                </div>
              )}
            </details>
          )}
          <Suspense
            fallback={<div className="chart-empty">Loading onboard view…</div>}
          >
            {page === "Home" && (
              <Home
                model={model}
                toggle={toggleTask}
                onTrend={trend}
                onPage={go}
              />
            )}
            {page === "Check-in" && (
              <Checkin
                profile={model.profile}
                submit={submit}
                busy={busy}
                result={result}
                photo={() => go("Photo Check")}
                slotLabel={
                  nextCheckin.slot === "morning"
                    ? "Morning"
                    : "Evening (optional)"
                }
              />
            )}
            {page === "Body Map" && (
              <BodyMap model={model} photo={() => go("Photo Check")} />
            )}
            {page === "Trends" && (
              <Trends
                profile={model.profile}
                state={model.missionState}
                selectedId={indicator}
                onSelect={setIndicator}
              />
            )}
            {page === "Medical briefing" && <Briefing model={model} full />}
            {page === "Streaks" && (
              <>
                <Tasks model={model} toggle={toggleTask} full />
                <Panel title="Crew streaks & badges">
                  <div className="coming-soon">
                    <Award size={38} />
                    <h3>Steady habits. Shared progress.</h3>
                    <p>
                      Real streaks, crew consistency goals, badges and
                      leaderboard are coming soon.
                    </p>
                    <span className="meta">
                      Phase 3 · Consistency only, never health values
                    </span>
                  </div>
                </Panel>
              </>
            )}
            {page === "More" && (
              <div className="more-grid">
                {[...future, "Mission Timeline", "Medical briefing"].map(
                  (name, n) => (
                    <button key={name} onClick={() => go(name)}>
                      <span>
                        {name === "Photo Check" ? (
                          <Camera />
                        ) : name === "Medical briefing" ? (
                          <Activity />
                        ) : (
                          <Satellite />
                        )}
                      </span>
                      <h2>{name}</h2>
                      <p>
                        {n < future.length
                          ? "Coming soon · Phase 3"
                          : "Open your live mission view"}
                      </p>
                      <ArrowUpRightIcon />
                    </button>
                  ),
                )}
              </div>
            )}
            {page === "More" && (
              <section className="account-actions">
                <div>
                  <strong>{model.profile.name}</strong>
                  <small>{model.profile.role}</small>
                </div>
                <Button variant="outline" onClick={onLogout}>
                  <LogOut data-icon="inline-start" />
                  Log out
                </Button>
              </section>
            )}
            {page === "Mission Timeline" && (
              <>
                <TripBar model={model} onTimeline={() => setShowDemo(true)} />
                <div className="timeline-phases">
                  {model.profile.mission.phases.map((p) => (
                    <Panel
                      key={p.order}
                      title={p.name}
                      accessory={
                        <span className="meta">
                          Day {p.startDay}–{p.endDay}
                        </span>
                      }
                    >
                      <p>
                        {p.environment.replaceAll("_", " ")} ·{" "}
                        {p.habitat.replaceAll("_", " ")}
                      </p>
                      {p.order === model.missionState.phase.order && (
                        <span className="current-phase">You are here</span>
                      )}
                    </Panel>
                  ))}
                </div>
                <p className="fine-print">
                  Use the Mission Day slider in Mission Control to explore phase
                  changes, gravity, exposure and Earth delay.
                </p>
              </>
            )}
            {future.includes(page) && (
              <Panel title={page}>
                <div className="coming-soon">
                  <Satellite size={46} />
                  <h3>A new layer of care is on its way.</h3>
                  <p>
                    {page === "Photo Check"
                      ? "Skin first-look analysis and guided ultrasound capture are coming in Phase 3. You can already upload clinical files from Check-in."
                      : "This workflow is coming soon with the Phase 3 services."}
                  </p>
                  <span className="meta">Coming soon</span>
                  <Button variant="outline" onClick={() => go("Check-in")}>
                    Go to Check-in <ArrowRight data-icon="inline-end" />
                  </Button>
                </div>
              </Panel>
            )}
          </Suspense>
          <footer className="mission-footer">
            <span>
              <Radio size={12} />
              Onboard intelligence · Offline first
            </span>
            <span>
              Simulated mission data · Decision support, not diagnosis
            </span>
            <span>SPACE MEDIC / 2026</span>
          </footer>
        </main>
      </div>
      <Dialog
        open={override || sos}
        onOpenChange={(open) => {
          if (!open && !override) setSos(false);
        }}
      >
        <DialogContent
          className={showCritical ? "critical-dialog" : "sos-dialog"}
          showCloseButton={!override}
        >
          <DialogTitle>
            {showCritical
              ? shelter
                ? "Go to shelter now"
                : "Critical health alert"
              : "Medical emergency · SOS"}
          </DialogTitle>
          <DialogDescription>
            {showCritical
              ? "Pause your activity. Follow the onboard action protocol."
              : "Emergency support flows are coming in Phase 3."}
          </DialogDescription>
          {showCritical ? (
            <>
              <ShieldAlert className="override-icon" />
              <div className="override-reading">
                {shelter ? (
                  <>
                    <h3>Solar particle event active</h3>
                    <p>{model.environmentTick?.activeEvent?.summary}</p>
                  </>
                ) : critical.length ? (
                  critical.map((i) => (
                    <section key={i.id}>
                      <Status status="critical" />
                      <h3>{i.name}</h3>
                      <strong>
                        {i.value} <small>{i.unit}</small>
                      </strong>
                      <p>
                        Normal reference:{" "}
                        {CHECKIN_INPUTS.find((spec) => spec.indicator === i.id)
                          ?.normalText ?? "See the onboard field guide"}
                      </p>
                      <p>
                        {
                          model.report.indicators.find((e) => e.id === i.id)
                            ?.thresholdNote
                        }
                      </p>
                    </section>
                  ))
                ) : (
                  <h3>{model.briefing.headline}</h3>
                )}
              </div>
              <h3>Do this now</h3>
              <p className="escalation-rule">
                {ESCALATION_MODE_LABELS[model.report.escalationMode]}
              </p>
              <ol>
                {(shelter
                  ? [
                      "Move to the designated radiation shelter now.",
                      "Gather the crew and follow the onboard shelter protocol.",
                      "Monitor the dosimeter and report when the Earth link permits.",
                    ]
                  : critical.length
                    ? [...new Set(critical.flatMap((i) => i.actionPlan.steps))]
                    : [model.briefing.plainEnglishSummary]
                ).map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              <div className="override-actions">
                <Button
                  variant="outline"
                  onClick={() => {
                    sync();
                    notify(
                      "Retake requested",
                      "A new simulated wearable reading has been taken.",
                    );
                  }}
                >
                  Retake reading
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setCrewNotified(true);
                    notify(
                      "Crew notification recorded locally",
                      "This demo does not send messages. Notify your crewmates directly.",
                    );
                  }}
                >
                  {crewNotified ? "Recorded locally" : "Notify crew"}
                </Button>
                <Button
                  onClick={() => {
                    setAck(criticalKey);
                    setSos(false);
                    setCrewNotified(false);
                    notify(
                      "Alert confirmed",
                      "Acknowledged for this session. Active risks remain in your briefing.",
                    );
                  }}
                >
                  <Check data-icon="inline-start" />
                  Confirm
                </Button>
              </div>
              <p className="fine-print">
                Demo acknowledgment stays in this session. No real emergency
                messages are sent.
              </p>
            </>
          ) : (
            <>
              <p>
                Current crew member: <strong>{model.profile.name}</strong>
              </p>
              <p>
                Emergency dispatch and the cabin/SOS override workflows are not
                connected yet. Contact your crew directly using the onboard
                protocol.
              </p>
              <Button variant="outline" onClick={() => setSos(false)}>
                <X data-icon="inline-start" />
                Close
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
function ArrowUpRightIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M7 17 17 7M7 7h10v10" />
    </svg>
  );
}
