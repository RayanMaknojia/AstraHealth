import { lazy, Suspense, startTransition, useEffect, useState } from "react";
import {
  Home as HomeIcon,
  ClipboardList,
  ScanLine,
  ChartNoAxesCombined,
  Ellipsis,
  LogOut,
  Radio,
  ShieldAlert,
  Satellite,
  Check,
} from "lucide-react";
import type { AstronautProfile, BodySystem } from "@/types/astronaut";
import {
  formatDelay,
  ESCALATION_MODE_LABELS,
} from "@/services/healthEvaluator";
import { confirmOverride, getBanner } from "@/services/alertService";
import { formatEta, sosRecipients } from "@/services/emergencyService";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Brand, PageTitle } from "./primitives";
import { formatTripBarLabel } from "@/services/missionTimeline";
import { MissionClock } from "./mission-clock";
import { Home, Briefing, TripBar } from "./home";
import type { ExamGuideId } from "./exam-guidance";
import { useMission, notify } from "./use-mission";
import type { PendingSos } from "./use-mission";
import { DemoControls } from "./demo-controls";
const Checkin = lazy(() =>
  import("./checkin").then((m) => ({ default: m.Checkin })),
);
const BodyMap = lazy(() =>
  import("./body-map").then((m) => ({ default: m.BodyMap })),
);
const Trends = lazy(() =>
  import("./charts").then((m) => ({ default: m.Trends })),
);
const More = lazy(() => import("./more").then((m) => ({ default: m.More })));
const nav = [
  { name: "Home", icon: HomeIcon },
  { name: "Check-in", icon: ClipboardList },
  { name: "Body Map", icon: ScanLine },
  { name: "Trends", icon: ChartNoAxesCombined },
  { name: "More", icon: Ellipsis },
];
const primaryIndicators: Record<BodySystem, string> = {
  behavioral: "sleep_hours",
  cardiovascular: "heart_rate",
  metabolic: "blood_sugar",
  radiation_immune: "radiation_dose",
  musculoskeletal: "bone_density",
};
const titles: Record<string, string> = {
  Home: "Mission overview",
  "Check-in": "Check-in & journal",
  "Body Map": "Body Map & Countermeasures",
  Trends: "Health trends",
  More: "Cabin, guidance & references",
};
const descriptions: Record<string, string> = {
  "Check-in":
    "Scheduled readings, symptoms and private reflections in one place.",
  "Body Map": "Select a system to understand its status and what you can do.",
  Trends: "Compare actual readings, source, baseline and changes over time.",
  More: "Cabin conditions and guidance for NASA’s five spaceflight hazards.",
};
function SosCountdown({
  pending,
  recipients,
  onCancel,
  onSend,
}: {
  pending: PendingSos;
  recipients: ReturnType<typeof sosRecipients>;
  onCancel: () => void;
  onSend: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, []);
  const left = Math.max(0, Math.ceil((pending.endsAt - now) / 1000));
  const a = pending.assessment;
  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent
        className="critical-dialog sos-countdown"
        showCloseButton={false}
      >
        <DialogTitle>Emergency: sending SOS in {left} s</DialogTitle>
        <DialogDescription>
          {pending.trigger}: this looks too serious for onboard care alone.
        </DialogDescription>
        <ShieldAlert className="override-icon" />
        <h3>Why</h3>
        <ul>
          {a.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        {a.interimSteps.length > 0 && (
          <>
            <h3>Do this now</h3>
            <ol>
              {a.interimSteps.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ol>
          </>
        )}
        <h3>Will be alerted</h3>
        <ul>
          {recipients.map((r) => (
            <li key={r.id}>
              {r.name}: arrives in {formatEta(r.etaSeconds)}
            </li>
          ))}
        </ul>
        <div className="override-actions">
          <Button variant="outline" onClick={onCancel}>
            I&apos;m OK, cancel
          </Button>
          <Button variant="destructive" onClick={onSend}>
            <ShieldAlert data-icon="inline-start" />
            Send SOS now
          </Button>
        </div>
        <p className="fine-print">
          If nobody answers, the SOS is sent automatically. Simulated dispatch:
          messages are queued in Mission Control Sync, no real emergency call.
        </p>
      </DialogContent>
    </Dialog>
  );
}
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
    busy,
    wearable,
    feed,
    saveCheckin,
    toggleTask,
    refresh,
  } = controller;
  const [page, setPage] = useState("Home"),
    [indicator, setIndicator] = useState("heart_rate"),
    [bodySystem, setBodySystem] = useState<BodySystem>("cardiovascular"),
    [checkinOpened, setCheckinOpened] = useState(false),
    [guidanceTarget, setGuidanceTarget] = useState<ExamGuideId | null>(null),
    [moreTab, setMoreTab] = useState("Cabin readings"),
    [briefingOpen, setBriefingOpen] = useState(false),
    [crewNotified, setCrewNotified] = useState(false);
  const active = model.overrides[0];
  const banner = getBanner(model.missionState, model.profile.id);
  const go = (target: string) => {
    startTransition(() => {
      if (target === "Check-in") setCheckinOpened(true);
      setPage(target);
    });
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const trend = (id: string) => {
    setIndicator(id);
    go("Trends");
  };
  useEffect(() => {
    document.title = `Space Medic · ${page}`;
  }, [page]);
  useEffect(() => {
    const timer = window.setInterval(refresh, 30000);
    return () => window.clearInterval(timer);
  }, [refresh]);
  const sos = () => {
    void controller.sendSosNow("manual");
  };
  const recipients = sosRecipients(model.missionState);
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
              onClick={() => {
                go(n.name);
              }}
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
            Onboard health support.
            <br />
            <strong>Offline capable.</strong>
          </span>
          <div className="connection">
            <span />
            Educational Prototype · Offline Local Mode
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
          <div className="mission-header-left">
            <strong>Day {model.profile.missionDay}</strong>
            <span title={model.missionState.phase.name}>
              {formatTripBarLabel(model.missionState).split(" · ")[1] ??
                model.missionState.phase.name}
            </span>
          </div>
          <div className="mission-header-center">
            <MissionClock model={model} />
            <TripBar model={model} />
          </div>
          <div className="mission-header-actions">
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
            <Button variant="destructive" onClick={sos}>
              <ShieldAlert data-icon="inline-start" />
              SOS
            </Button>
          </div>
        </header>
        {banner && (
          <div className="comms-banner" role="status">
            {banner.message}
          </div>
        )}
        <main className="mission-content">
          <PageTitle
            title={titles[page]}
            description={
              page === "Home"
                ? `${model.profile.name} · ${model.profile.agency}`
                : descriptions[page]
            }
          />
          {demo && (
            <DemoControls controller={controller} onSwitchCrew={onSwitchCrew} />
          )}
          <Suspense
            fallback={<div className="chart-empty">Loading onboard view…</div>}
          >
            {page === "Home" && (
              <Home
                model={model}
                onTrend={trend}
                onPage={go}
                onBriefing={() => setBriefingOpen(true)}
                onBodySystem={(s) => {
                  setBodySystem(s);
                  go("Body Map");
                }}
                onScan={controller.scan}
                onRefreshBriefing={() =>
                  void controller.refreshBriefing("Refresh")
                }
              />
            )}{" "}
            {checkinOpened && (
              <div hidden={page !== "Check-in"}>
                <Checkin
                  key={model.profile.id}
                  model={model}
                  save={saveCheckin}
                  busy={busy}
                  onReport={controller.report}
                  onPhoto={controller.photoAssessed}
                  onRecords={() => {
                    setMoreTab("My records");
                    go("More");
                  }}
                  onGuidance={(id) => {
                    setGuidanceTarget(id);
                    setMoreTab("Guidance & triage");
                    go("More");
                  }}
                  onJournalHistory={() => {
                    setMoreTab("Past journal entries");
                    go("More");
                  }}
                />
              </div>
            )}{" "}
            {page === "Body Map" && (
              <BodyMap
                model={model}
                toggle={toggleTask}
                selected={bodySystem}
                onSelect={setBodySystem}
                onTrends={(s) => {
                  setIndicator(primaryIndicators[s]);
                  go("Trends");
                }}
              />
            )}
            {page === "Trends" && (
              <Trends
                profile={model.profile}
                state={model.missionState}
                selectedId={indicator}
                onSelect={setIndicator}
              />
            )}{" "}
            {page === "More" && (
              <More
                model={model}
                onLogout={onLogout}
                initialTab={moreTab}
                focusGuide={guidanceTarget}
                onCheckin={() => {
                  setGuidanceTarget(null);
                  go("Check-in");
                }}
              />
            )}
          </Suspense>
          <footer className="mission-footer">
            <span>
              <Radio size={12} />
              Onboard support · Offline first
            </span>
            <span>
              Simulated mission data · Decision support, not diagnosis
            </span>
            <span>SPACE MEDIC / 2026</span>
          </footer>
        </main>
      </div>
      <Sheet open={briefingOpen} onOpenChange={setBriefingOpen}>
        <SheetContent className="guide-dialog briefing-drawer">
          <SheetTitle>Full medical briefing</SheetTitle>
          <SheetDescription>
            Current status, alerts and recommended checks.
          </SheetDescription>
          <Briefing
            model={model}
            full
            onRefresh={() => void controller.refreshBriefing("Refresh")}
            onBodyMap={() => {
              setBriefingOpen(false);
              go("Body Map");
            }}
          />
        </SheetContent>
      </Sheet>
      {model.pendingSos && (
        <SosCountdown
          pending={model.pendingSos}
          recipients={recipients}
          onCancel={controller.cancelSos}
          onSend={() => void controller.sendSosNow("auto")}
        />
      )}
      <Dialog open={!!active && !model.pendingSos} onOpenChange={() => {}}>
        <DialogContent className="critical-dialog" showCloseButton={false}>
          <DialogTitle>{active?.title}</DialogTitle>
          <DialogDescription>
            {model.overrides.length > 1
              ? `${model.overrides.length} active alerts are listed below. Review each one, then Confirm all to acknowledge all listed alerts and return to the dashboard.`
              : "Follow the onboard protocol, then Confirm to acknowledge this alert and return to the dashboard."}
          </DialogDescription>
          {active && (
            <>
              <ShieldAlert className="override-icon" />
              <h3>{active.headline}</h3>
              {active.details.map((d) => (
                <p key={d}>{d}</p>
              ))}
              <h3>Do this now</h3>
              <ol>
                {active.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              {active.kind === "sos" && (
                <>
                  <h3>SOS sent to</h3>
                  <ul data-testid="sos-recipients">
                    {(model.lastSos?.overrideId === active.id
                      ? model.lastSos.recipients
                      : recipients
                    ).map((r) => (
                      <li key={r.id}>
                        {r.name}: arrives in {formatEta(r.etaSeconds)}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {model.overrides.slice(1).map((alert) => (
                <section
                  className="additional-override"
                  key={alert.id}
                  aria-label={alert.title}
                >
                  <h3>{alert.title}</h3>
                  <h4>{alert.headline}</h4>
                  {alert.details.map((detail) => (
                    <p key={detail}>{detail}</p>
                  ))}
                  <h4>Do this now</h4>
                  <ol>
                    {alert.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </section>
              ))}
              <p>{ESCALATION_MODE_LABELS[model.report.escalationMode]}</p>
              <div className="override-actions">
                <Button
                  variant="outline"
                  onClick={() => {
                    wearable.current?.tickOnce();
                    feed.current?.tickOnce();
                    notify(
                      "Retake requested",
                      "A fresh simulated wearable reading has been taken.",
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
                      "Crew notification noted",
                      "Tell your crewmates directly. Ground messages are queued by the alert service.",
                    );
                  }}
                >
                  {crewNotified ? "Crew notification noted" : "Notify crew"}
                </Button>
                <Button
                  onClick={() => {
                    // Acknowledge exactly the alerts rendered above before reevaluating.
                    // Confirming only an escalated SOS leaves its original alert open,
                    // which would immediately raise another SOS.
                    const displayedAlerts = model.overrides;
                    displayedAlerts.forEach((alert) =>
                      confirmOverride(alert.id, model.profile.name),
                    );
                    setCrewNotified(false);
                    refresh();
                    notify(
                      displayedAlerts.length > 1
                        ? `${displayedAlerts.length} alerts confirmed`
                        : "Alert confirmed",
                      "Acknowledgment saved on this device. Abnormal readings remain visible on the dashboard.",
                    );
                  }}
                >
                  <Check data-icon="inline-start" />
                  {model.overrides.length > 1 ? "Confirm all" : "Confirm"}
                </Button>
              </div>
              <p className="fine-print">
                Demo alert records and ground-message queue are stored locally.
                No real emergency dispatch.
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
