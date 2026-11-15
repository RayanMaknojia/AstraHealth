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
  IndicatorId,
  CabinReading,
} from "@/types/astronaut";
import {
  applyIndicatorUpdates,
  evaluateProfile,
} from "@/services/healthEvaluator";
import {
  createInitialBriefing,
  updateBriefing,
} from "@/services/briefingEngine";
import { CHECKIN_INPUTS } from "@/data/nasaSpaceflightData";
import {
  listCheckins,
  submitCheckin as saveScheduledCheckin,
  getDueCheckins,
} from "@/services/checkinService";
import { syncOverrides } from "@/services/alertService";
import { formatOnboardTime } from "./checkin-schedule";
import {
  createWearableStream,
  STREAM_START_MINUTE_OF_DAY,
} from "@/services/wearableStream";
import { createEnvironmentFeed } from "@/services/environmentFeed";
import { getMissionState } from "@/services/missionTimeline";
import { ingest } from "@/services/ingestionEngine";
import { toast } from "@/components/ui/toast";

export function notify(title: string, description?: string) {
  toast.add({ title, description, timeout: 4500 });
}
function restoredProfile(profile: AstronautProfile) {
  const updates: IndicatorUpdate[] = [];
  for (const record of listCheckins(
    profile.id,
    profile.missionDay,
    Math.max(30, profile.missionDay + 1),
  )
    .filter((r) => r.missionDay <= profile.missionDay && !r.excused)
    .reverse()) {
    if (!record.values) continue;
    let minute = 0;
    try {
      minute = JSON.parse(record.extras?.notes ?? "{}").onboardMinute ?? 0;
    } catch {
      /* Legacy plain-text notes have no onboard timestamp. */
    }
    const day = record.missionDay + minute / 1440;
    const add = (id: IndicatorId, value: number | string, unit: string) =>
      updates.push({
        id,
        value,
        unit,
        source: "manual_slider",
        timestamp: `Day ${record.missionDay} ${formatOnboardTime(minute)}`,
        day,
      });
    for (const spec of CHECKIN_INPUTS) {
      const v = record.values[spec.key];
      if (
        typeof v === "number" &&
        spec.indicator !== "blood_pressure" &&
        spec.key !== "radiationDailyMSv"
      )
        add(spec.indicator, v, spec.unit);
    }
    if (
      record.values.systolicMmHg !== undefined &&
      record.values.diastolicMmHg !== undefined
    )
      add(
        "blood_pressure",
        `${record.values.systolicMmHg}/${record.values.diastolicMmHg}`,
        "mmHg",
      );
  }
  return updates.length
    ? applyIndicatorUpdates(profile, updates, {
        missionState: getMissionState(profile.mission, profile.missionDay),
      }).profile
    : profile;
}
function hydrate(inputProfile: AstronautProfile) {
  const profile = restoredProfile(inputProfile);
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
          const revised = await updateBriefing(old.briefing, change, {
            profile: next.profile,
            missionState: next.missionState,
            indicators: next.profile.indicators,
          });
          if (ticket !== generation.current) return;
          commit({
            ...old,
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
          revised.changes.forEach((message) => notify(message));
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
    [commit, demo],
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
      );
      if (ticket !== generation.current) return;
      commit({
        ...old,
        ...evaluated,
        profile: { ...profile, routine: current.current.profile.routine },
        briefing: revised.briefing,
        environmentTick: null,
        lastEvent: `Mission day ${day}`,
        onboardMinute: STREAM_START_MINUTE_OF_DAY,
        cabinHistory: [],
      });
      setStreamDay(day);
      revised.changes.forEach((message) => notify(message));
    } catch (error) {
      notify(
        "Unable to change mission day",
        error instanceof Error ? error.message : "Please try again.",
      );
    }
  };
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
      if (response.verdict.accepted) {
        const applied = await event(response.updates, {
          kind: "artifact",
          artifact: response.artifact,
        });
        if (applied !== true || ticket !== generation.current) return;
        notify("Accepted & Normalized", response.artifact.extractedSummary);
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
  };
}
