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
} from "@/types/astronaut";
import {
  applyIndicatorUpdates,
  evaluateProfile,
} from "@/services/healthEvaluator";
import {
  createInitialBriefing,
  updateBriefing,
} from "@/services/briefingEngine";
import { createWearableStream } from "@/services/wearableStream";
import { createEnvironmentFeed } from "@/services/environmentFeed";
import { getMissionState } from "@/services/missionTimeline";
import { ingest } from "@/services/ingestionEngine";
import { toast } from "@/components/ui/toast";

export function notify(title: string, description?: string) {
  toast.add({ title, description, timeout: 4500 });
}
function hydrate(profile: AstronautProfile) {
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
  const queue = useRef(Promise.resolve());
  const generation = useRef(0);
  const wearable = useRef<WearableStreamController | null>(null);
  const feed = useRef<EnvironmentFeedController | null>(null);
  const commit = useCallback((next: MissionModel) => {
    current.current = next;
    setModel(next);
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
            environmentTick: environmentTick ?? old.environmentTick,
            lastEvent:
              change.kind === "wearable_tick" ||
              change.kind === "environment_tick"
                ? change.tick.timestamp
                : revised.briefing.lastUpdated,
          });
          revised.changes.forEach((message) => notify(message));
        })
        .catch((error: unknown) => {
          if (ticket === generation.current)
            notify(
              "Update could not be applied",
              error instanceof Error
                ? error.message
                : "Please try again. Last good state retained.",
            );
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
        await event(response.updates, {
          kind: "artifact",
          artifact: response.artifact,
        });
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
  };
}
