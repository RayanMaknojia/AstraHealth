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
import { confirmOverride, raiseSos, getBanner } from "@/services/alertService";
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
import { MissionClock } from "./mission-clock";
import { Home, Briefing, TripBar } from "./home";
import { useMission, notify } from "./use-mission";
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
    [moreTab, setMoreTab] = useState("Cabin readings"),
    [system, setSystem] = useState<BodySystem | null>(null),
    [briefingOpen, setBriefingOpen] = useState(false),
    [crewNotified, setCrewNotified] = useState(false);
  const active = model.overrides[0];
  const banner = getBanner(model.missionState, model.profile.id);
  const go = (target: string) => {
    startTransition(() => setPage(target));
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const trend = (id: string) => {
    setSystem(null);
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
    raiseSos({
      astronautId: model.profile.id,
      name: model.profile.name,
      location: model.missionState.phase.name,
      missionDay: model.profile.missionDay,
    });
    refresh();
  };
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
                if (n.name === "Trends") setSystem(null);
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
            Device-local records
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
          <TripBar model={model} />
          <MissionClock model={model} />
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
          >
            <div className="page-live">
              <span className={demo ? "paused-dot" : "live-dot"} />
              {demo ? "DEMO · MANUAL SYNC" : "LIVE · EVERY 15s"}
              <small>{model.lastEvent.replace(/Day \d+\s*/g, "").trim()}</small>
            </div>
          </PageTitle>
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
              />
            )}{" "}
            {page === "Check-in" && (
              <Checkin
                key={model.profile.id}
                model={model}
                save={saveCheckin}
                busy={busy}
                onJournalHistory={() => {
                  setMoreTab("Past journal entries");
                  go("More");
                }}
              />
            )}{" "}
            {page === "Body Map" && (
              <BodyMap
                model={model}
                toggle={toggleTask}
                selected={bodySystem}
                onSelect={setBodySystem}
                onTrends={(s) => {
                  setSystem(s);
                  setIndicator(
                    model.profile.indicators.find((i) => i.system === s)!.id,
                  );
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
                system={system}
                clearSystem={() => setSystem(null)}
              />
            )}{" "}
            {page === "More" && (
              <More model={model} onLogout={onLogout} initialTab={moreTab} />
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
            onBodyMap={() => {
              setBriefingOpen(false);
              go("Body Map");
            }}
          />
        </SheetContent>
      </Sheet>
      <Dialog open={!!active} onOpenChange={() => {}}>
        <DialogContent className="critical-dialog" showCloseButton={false}>
          <DialogTitle>{active?.title}</DialogTitle>
          <DialogDescription>
            Follow the onboard protocol and confirm to acknowledge this alert.
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
                    confirmOverride(active.id, model.profile.name);
                    setCrewNotified(false);
                    refresh();
                    notify(
                      "Alert confirmed",
                      "Acknowledgment saved on this device.",
                    );
                  }}
                >
                  <Check data-icon="inline-start" />
                  Confirm
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
