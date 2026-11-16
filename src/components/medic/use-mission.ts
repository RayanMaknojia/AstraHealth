import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AstronautProfile,
  BriefingEvent,
  EnvironmentTick,
  IngestionInput,
  IngestionResult,
  IndicatorUpdate,
  WearableStreamController,
  EnvironmentFeedController,
  CheckinSlot,
  CheckinExtras,
  VitalsInput,
  CabinReading,
  AiBriefing,
  EmergencyAssessment,
  PhotoRecord,
  ScanResult,
  SosEvent,
} from "@/types/astronaut";
import {
  applyIndicatorUpdates,
  evaluateProfile,
} from "@/services/healthEvaluator";
import {
  createInitialBriefing,
  updateBriefing,
} from "@/services/briefingEngine";
import {
  listCheckins,
  submitCheckin as saveScheduledCheckin,
  getDueCheckins,
} from "@/services/checkinService";
import { syncOverrides } from "@/services/alertService";
import { missionDayFromDate } from "@/services/missionTimeline";
import { formatOnboardTime } from "./checkin-schedule";
import {
  createWearableStream,
  STREAM_START_MINUTE_OF_DAY,
} from "@/services/wearableStream";
import { createEnvironmentFeed } from "@/services/environmentFeed";
import { getMissionState } from "@/services/missionTimeline";
import { ingest } from "@/services/ingestionEngine";
import { toast } from "@/components/ui/toast";
import {
  latestBriefing,
  recordUpdates,
  saveScan,
  savePhoto,
  saveUpload,
} from "@/services/healthDb";
import { runScan } from "@/services/scanService";
import { generateBriefing } from "@/services/aiBriefing";
import {
  assessEmergency,
  closeSosIssues,
  noteSosDetection,
  sendSos,
  SOS_COUNTDOWN_SECONDS,
} from "@/services/emergencyService";
import { getActiveOverrides } from "@/services/alertService";

/** The rules-based briefing engine stays offline; Gemini writes the full briefing (aiBriefing.ts). */
const RULES_ONLY = { forceOffline: true } as const;
/** Pending automatic SOS (countdown dialog). */
export interface PendingSos {
  assessment: EmergencyAssessment;
  endsAt: number;
  trigger: string;
}

export function notify(title: string, description?: string) {
  toast.add({ title, description, timeout: 4500 });
}
/** Automatic warnings (status, trajectory, cabin) pop up at most once every 10 minutes. */
export const WARNING_GAP_MINUTES = 10;
let lastWarningAt = 0;
const lastWarningByText = new Map<string, number>();
/** Messages that answer something the user just did are always shown. */
const ACTION_RESULT =
  /^(Logged \d|Demo anomaly|New mission phase|File rejected|.+ added \()/;
function warn(message: string) {
  if (ACTION_RESULT.test(message)) return notify(message);
  const now = Date.now();
  const key = message.replace(/[\d.]+/g, "#").toLowerCase();
  const gap = WARNING_GAP_MINUTES * 60_000;
  if (now - lastWarningAt < gap) return;
  if (now - (lastWarningByText.get(key) ?? 0) < gap) return;
  lastWarningAt = now;
  lastWarningByText.set(key, now);
  notify(message);
}
function hydrate(profile: AstronautProfile) {
  // The profile was loaded from the health database (App.tsx), so stored wearable,
  // scan and check-in readings are already in its history.
  const evaluated = evaluateProfile(profile);
  const next = { ...profile, indicators: evaluated.indicators };
  return {
    profile: next,
    report: evaluated.report,
    missionState: evaluated.missionState,
    briefing: createInitialBriefing({
      profile: next,
      missionState: evaluated.missionState,
      indicators: next.indicators,
    }),
    environmentTick: null as EnvironmentTick | null,
    lastEvent: "Awaiting wearable sync",
    onboardMinute: STREAM_START_MINUTE_OF_DAY,
    cabinHistory: [] as CabinReading[],
    overrides: syncOverrides({
      profile: next,
      report: evaluated.report,
      missionState: evaluated.missionState,
    }),
    /** Full briefing written by Gemini (or offline rules), newest. */
    aiBriefing: null as AiBriefing | null,
    briefingWorking: false,
    lastScan: null as ScanResult | null,
    pendingSos: null as PendingSos | null,
    lastSos: null as SosEvent | null,
  };
}
export type MissionModel = ReturnType<typeof hydrate>;
export function useMission(initialProfile: AstronautProfile) {
  const [model, setModel] = useState(() => hydrate(initialProfile));
  const [demo, setDemo] = useState(true);
  const [streamDay, setStreamDay] = useState(initialProfile.missionDay);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<IngestionResult | null>(null);
  const current = useRef(model);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const generation = useRef(0);
  const wearable = useRef<WearableStreamController | null>(null);
  const feed = useRef<EnvironmentFeedController | null>(null);
  const commit = useCallback((next: MissionModel) => {
    const evaluated = {
      ...next,
      overrides: syncOverrides({
        profile: next.profile,
        report: next.report,
        missionState: next.missionState,
        environmentTick: next.environmentTick ?? undefined,
        cabinHistory: next.cabinHistory,
      }),
    };
    current.current = evaluated;
    setModel(evaluated);
  }, []);
  /** After any new input: is this too severe for onboard care? Opens the SOS countdown if so. */
  const checkEmergency = useCallback(
    (
      trigger: string,
      extra: Pick<
        Parameters<typeof assessEmergency>[0],
        "text" | "symptoms" | "photo" | "aiSos"
      > = {},
    ) => {
      const m = current.current;
      const a = assessEmergency({
        profile: m.profile,
        report: m.report,
        ...extra,
      });
      if (!a.sos || m.pendingSos) return a;
      // One automatic SOS per issue: later detections are only counted.
      if (!noteSosDetection(m.profile.id, a, m.profile.missionDay)) return a;
      if (getActiveOverrides(m.profile.id).some((o) => o.kind === "sos"))
        return a;
      commit({
        ...current.current,
        pendingSos: {
          assessment: a,
          endsAt: Date.now() + SOS_COUNTDOWN_SECONDS * 1000,
          trigger,
        },
      });
      return a;
    },
    [commit],
  );
  const briefingSeq = useRef(0);
  const lastBriefingAt = useRef(0);
  /** Write a new full briefing (Gemini via the Python server, or offline rules). */
  const refreshBriefing = useCallback(
    async (trigger: string) => {
      const seq = ++briefingSeq.current;
      lastBriefingAt.current = Date.now();
      commit({ ...current.current, briefingWorking: true });
      const m = current.current;
      const lastCheckin =
        listCheckins(m.profile.id, m.profile.missionDay, 30).find(
          (r) => !r.excused && r.missionDay <= m.profile.missionDay,
        ) ?? null;
      const emergency =
        m.pendingSos?.assessment ??
        assessEmergency({ profile: m.profile, report: m.report });
      try {
        const b = await generateBriefing({
          profile: m.profile,
          missionState: m.missionState,
          report: m.report,
          rulesBriefing: m.briefing,
          lastCheckin,
          emergency,
          trigger,
          onboardMinute: m.onboardMinute,
        });
        if (seq !== briefingSeq.current) return b;
        commit({ ...current.current, aiBriefing: b, briefingWorking: false });
        if (b.sosRecommended && !emergency.sos)
          checkEmergency(trigger, {
            aiSos: { recommended: true, reason: b.sosReason },
          });
        return b;
      } catch {
        if (seq === briefingSeq.current)
          commit({ ...current.current, briefingWorking: false });
        return null;
      }
    },
    [commit, checkEmergency],
  );
  const event = useCallback(
    (
      updates: IndicatorUpdate[],
      change: BriefingEvent,
      environmentTick?: EnvironmentTick,
    ) => {
      const ticket = generation.current;
      const work = queue.current
        .then(async () => {
          if (ticket !== generation.current) return;
          const old = current.current;
          const next = applyIndicatorUpdates(old.profile, updates, {
            ignoreStaleness: demo,
          });
          // Every new reading is appended to the health database.
          void recordUpdates(next.profile, updates).catch(() => undefined);
          const revised = await updateBriefing(
            old.briefing,
            change,
            {
              profile: next.profile,
              missionState: next.missionState,
              indicators: next.profile.indicators,
            },
            RULES_ONLY,
          );
          if (ticket !== generation.current) return;
          commit({
            ...current.current,
            ...next,
            profile: {
              ...next.profile,
              routine: current.current.profile.routine,
            },
            briefing: revised.briefing,
            onboardMinute:
              change.kind === "wearable_tick" ||
              change.kind === "environment_tick"
                ? (() => {
                    const time = change.tick.timestamp.match(/(\d{2}):(\d{2})/);
                    return time
                      ? Number(time[1]) * 60 + Number(time[2])
                      : old.onboardMinute;
                  })()
                : old.onboardMinute,
            environmentTick: environmentTick ?? old.environmentTick,
            cabinHistory: environmentTick
              ? (feed.current?.cabinHistory() ?? old.cabinHistory)
              : old.cabinHistory,
            lastEvent:
              change.kind === "wearable_tick" ||
              change.kind === "environment_tick"
                ? change.tick.timestamp
                : revised.briefing.lastUpdated,
          });
          revised.changes.forEach((message) => warn(message));
          if (change.kind === "wearable_tick")
            checkEmergency("Wearable reading");
          return true;
        })
        .catch((error: unknown) => {
          if (ticket === generation.current)
            notify(
              "Update could not be applied",
              error instanceof Error
                ? error.message
                : "Please try again. Last good state retained.",
            );
          return false;
        });
      queue.current = work;
      return work;
    },
    [commit, demo, checkEmergency],
  );
  const phaseOrder = model.missionState.phase.order;
  useEffect(() => {
    generation.current += 1;
    const snapshot = current.current;
    const w = createWearableStream({ profile: snapshot.profile });
    const f = createEnvironmentFeed({
      missionState: snapshot.missionState,
      startingMissionDoseMSv: Number(
        snapshot.profile.indicators.find((i) => i.id === "radiation_dose")
          ?.value ?? snapshot.missionState.exposure.totalRadiationMSv,
      ),
    });
    wearable.current = w;
    feed.current = f;
    const offW = w.subscribe((tick) => {
      void event(tick.updates, { kind: "wearable_tick", tick });
    });
    const offF = f.subscribe((tick) => {
      void event(tick.updates, { kind: "environment_tick", tick }, tick);
    });
    if (!demo) {
      w.start();
      f.start();
    }
    return () => {
      generation.current += 1;
      offW();
      offF();
      w.stop();
      f.stop();
      wearable.current = null;
      feed.current = null;
    };
  }, [demo, streamDay, event, phaseOrder]);
  const changeDay = async (day: number) => {
    const ticket = ++generation.current;
    const old = current.current;
    const state = getMissionState(old.profile.mission, day);
    const evaluated = evaluateProfile(old.profile, {
      missionState: state,
      ignoreStaleness: true,
    });
    const profile = {
      ...old.profile,
      missionDay: day,
      environment: state.phase.environment,
      habitat: state.phase.habitat,
      indicators: evaluated.indicators,
    };
    const briefing = createInitialBriefing({
      profile,
      missionState: state,
      indicators: profile.indicators,
    });
    try {
      const revised = await updateBriefing(
        briefing,
        { kind: "mission_day_change", missionDay: day },
        { profile, missionState: state, indicators: profile.indicators },
        RULES_ONLY,
      );
      if (ticket !== generation.current) return;
      commit({
        ...current.current,
        ...evaluated,
        profile: { ...profile, routine: current.current.profile.routine },
        briefing: revised.briefing,
        environmentTick: null,
        lastEvent: `Mission day ${day}`,
        onboardMinute: STREAM_START_MINUTE_OF_DAY,
        cabinHistory: [],
      });
      setStreamDay(day);
      revised.changes.forEach((message) => warn(message));
    } catch (error) {
      notify(
        "Unable to change mission day",
        error instanceof Error ? error.message : "Please try again.",
      );
    }
  };
  // Real mission clock: the day goes up at 00:00 UTC every 24 hours (mission elapsed time,
  // counted in Earth days like ISS operations). Checked every minute while the app is open.
  const changeDayRef = useRef(changeDay);
  useEffect(() => {
    changeDayRef.current = changeDay;
  });
  const realDay = useRef(initialProfile.missionDay);
  useEffect(() => {
    const tick = () => {
      const day = missionDayFromDate(current.current.profile.mission.launchDate);
      if (day > realDay.current) {
        realDay.current = day;
        void changeDayRef.current(day);
        notify(`Mission day ${day}`, "A new mission day has started (00:00 UTC).");
      }
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);
  const submit = async (input: IngestionInput) => {
    const ticket = generation.current;
    setBusy(true);
    try {
      const snapshot = current.current;
      const response = await ingest({
        ...input,
        astronautId: snapshot.profile.id,
        day: snapshot.missionState.missionDay,
        environment: snapshot.missionState.phase.environment,
      });
      if (ticket !== generation.current) return;
      setResult(response);
      void saveUpload(
        snapshot.profile.id,
        snapshot.profile.missionDay,
        response.artifact,
        input.text,
        input.file,
        input.fileName,
      ).catch(() => undefined);
      if (response.verdict.accepted) {
        const applied = await event(response.updates, {
          kind: "artifact",
          artifact: response.artifact,
        });
        if (applied !== true || ticket !== generation.current) return;
        notify("Accepted & Normalized", response.artifact.extractedSummary);
        checkEmergency("File / text upload", {
          text: `${input.text ?? ""} ${response.artifact.extractedSummary}`,
        });
        void refreshBriefing("File / text upload");
      } else
        notify(
          "Rejected: Non-Biomedical Data",
          response.verdict.rejectionReason,
        );
    } catch (error) {
      notify(
        "Unable to read input",
        error instanceof Error ? error.message : "Try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  const refresh = useCallback(() => commit({ ...current.current }), [commit]);
  // Load the newest stored briefing; write a fresh one when there is none for today.
  useEffect(() => {
    let live = true;
    const id = current.current.profile.id;
    void latestBriefing(id).then((b) => {
      if (!live || current.current.profile.id !== id) return;
      const today =
        b && b.missionDay === Math.floor(current.current.profile.missionDay);
      if (b && today) commit({ ...current.current, aiBriefing: b });
      // Re-write when there is none for today, or today's was written by the offline
      // rules more than 10 minutes ago (the AI may be reachable now, e.g. a key was added).
      const staleOffline =
        today &&
        b.engine !== "gemini" &&
        Date.now() - new Date(b.createdAt).getTime() > 10 * 60_000;
      if (!today || staleOffline) void refreshBriefing("Start of shift");
    });
    return () => {
      live = false;
    };
  }, [commit, refreshBriefing]);
  // Re-write the briefing when the rules-based status changes (at most once a minute).
  const overall = model.report.overallStatus;
  const aiStatus = model.aiBriefing?.rulesStatusAtCreation;
  useEffect(() => {
    if (!aiStatus || aiStatus === overall) return;
    if (Date.now() - lastBriefingAt.current < 60_000) return;
    void refreshBriefing("Status changed");
  }, [overall, aiStatus, refreshBriefing]);
  /** Home "Start scan": new readings → database → emergency check → new briefing. */
  const scan = async (): Promise<ScanResult | null> => {
    const m = current.current;
    const s = await runScan(m.profile, m.onboardMinute);
    void saveScan(s).catch(() => undefined);
    const applied = await event(s.updates, {
      kind: "manual_vitals",
      updates: s.updates,
    });
    if (applied !== true) return null;
    commit({ ...current.current, lastScan: s });
    checkEmergency("Body scan");
    void refreshBriefing("Body scan");
    return s;
  };
  /** A skin photo was assessed (Photo Check). */
  const photoAssessed = (record: PhotoRecord, image?: Blob | null) => {
    void savePhoto(record, image).catch(() => undefined);
    checkEmergency("Photo check", {
      photo: record,
      text: record.notes,
    });
    void refreshBriefing("Photo check");
  };
  /** "Report a problem": free text and/or a file (lab report, CSV, image...). */
  const report = async (text: string, file?: File | null) => {
    checkEmergency("Reported problem", { text });
    await submit({
      text: text || undefined,
      ...(file
        ? { file, fileName: file.name, mimeType: file.type || undefined }
        : {}),
    });
  };
  const sosSending = useRef(false);
  /** Send the SOS now (manual button, "Send now", or the countdown ran out). */
  const sendSosNow = useCallback(
    async (trigger: "manual" | "auto") => {
      if (sosSending.current) return;
      sosSending.current = true;
      try {
        const m = current.current;
        const a = m.pendingSos?.assessment;
        if (a) closeSosIssues(m.profile.id, a, "sent");
        const ev = await sendSos({
          profile: m.profile,
          missionState: m.missionState,
          trigger,
          reasons: a?.reasons ?? [],
          interimSteps: a?.interimSteps ?? [],
        });
        commit({ ...current.current, pendingSos: null, lastSos: ev });
        notify(
          "SOS sent",
          ev.recipients.map((r) => r.name.replace(/ \(.*\)/, "")).join(" · "),
        );
      } finally {
        sosSending.current = false;
      }
    },
    [commit],
  );
  /** "I'm OK": cancel the automatic SOS (not raised again for the same reasons for an hour). */
  const cancelSos = () => {
    const p = current.current.pendingSos;
    if (!p) return;
    closeSosIssues(current.current.profile.id, p.assessment, "cancelled");
    commit({ ...current.current, pendingSos: null });
    notify(
      "Automatic SOS cancelled",
      "It will not be sent again for this issue. Keep following the steps; press SOS any time if it gets worse.",
    );
  };

  // The countdown keeps running even if the dialog is hidden; when it ends, the SOS is sent.
  const sosDeadline = model.pendingSos?.endsAt;
  useEffect(() => {
    if (!sosDeadline) return;
    const t = window.setTimeout(
      () => void sendSosNow("auto"),
      Math.max(0, sosDeadline - Date.now()),
    );
    return () => window.clearTimeout(t);
  }, [sosDeadline, sendSosNow]);
  const saveCheckin = async (input: {
    slot: CheckinSlot;
    values?: VitalsInput;
    extras?: CheckinExtras;
    symptoms?: string[];
  }) => {
    const ticket = generation.current;
    setBusy(true);
    try {
      const snapshot = current.current;
      const day = snapshot.missionState.missionDay;
      let form: unknown = input.extras?.notes ?? "";
      try {
        form = JSON.parse(String(form));
      } catch {
        /* Preserve legacy notes. */
      }
      const response = await saveScheduledCheckin({
        ...input,
        profile: snapshot.profile,
        day,
        extras: {
          ...input.extras,
          notes: JSON.stringify({
            form,
            onboardMinute: snapshot.onboardMinute,
          }),
        },
      });
      if (ticket !== generation.current) return false;
      if (response.ingestion && !response.ingestion.verdict.accepted) {
        setResult(response.ingestion);
        notify(
          "Check-in saved; readings need review",
          response.ingestion.verdict.rejectionReason,
        );
        refresh();
        return false;
      }
      if (response.ingestion) {
        setResult(response.ingestion);
        const updates = response.ingestion.updates.map((u) => ({
          ...u,
          day: day + snapshot.onboardMinute / 1440,
          timestamp: `Day ${day} ${formatOnboardTime(snapshot.onboardMinute)}`,
        }));
        if (
          (await event(updates, {
            kind: "artifact",
            artifact: response.ingestion.artifact,
          })) !== true
        )
          return false;
      }
      if (
        input.slot !== "morning" &&
        input.slot !== "evening" &&
        getDueCheckins(current.current.profile).some(
          (t) => t.slot === "morning" && !t.done && !t.excused,
        )
      ) {
        // Extended and weekly forms include the daily basics; register that completion for the backend's consistency tracking.
        await saveScheduledCheckin({
          profile: current.current.profile,
          slot: "morning",
          day,
          values: input.values,
          symptoms: input.symptoms,
          extras: {
            notes: JSON.stringify({
              includedIn: input.slot,
              onboardMinute: snapshot.onboardMinute,
            }),
          },
        });
      }
      refresh();
      notify(response.message);
      checkEmergency("Check-in saved", {
        symptoms: input.symptoms,
        text: typeof input.extras?.notes === "string" ? input.extras.notes : "",
      });
      void refreshBriefing("Check-in saved");
      return true;
    } catch (error) {
      notify(
        "Unable to save check-in",
        error instanceof Error ? error.message : "Please try again.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  };
  const toggleTask = (id: string) => {
    const old = current.current;
    commit({
      ...old,
      profile: {
        ...old.profile,
        routine: old.profile.routine.map((t) =>
          t.id === id ? { ...t, completed: !t.completed } : t,
        ),
      },
    });
  };
  return {
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
    saveCheckin,
    refresh,
    scan,
    refreshBriefing,
    photoAssessed,
    report,
    sendSosNow,
    cancelSos,
  };
}
