import { useEffect, useState } from "react";
import { Check, Camera, Trash2 } from "lucide-react";
import { CHECKIN_INPUTS, CHECKIN_SYMPTOMS } from "@/data/nasaSpaceflightData";
import { CHECKIN_SCHEDULE, ULTRASOUND_GUIDES } from "@/data/phase3Data";
import { getDueCheckins } from "@/services/checkinService";
import { indicatorsToVitals } from "@/services/healthEvaluator";
import { getMedicationList, listProcedures } from "@/services/guidanceService";
import {
  addJournalEntry,
  listJournal,
  deleteJournalEntry,
} from "@/services/wellbeingService";
import type {
  CheckinSlot,
  CheckinExtras,
  VitalsInput,
  Rating5,
  UltrasoundScanType,
} from "@/types/astronaut";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldLegend,
} from "@/components/ui/field";
import { Panel, Status } from "./primitives";
import { statusOf } from "./status";
import { nextScheduledCheckin, visibleSchedule } from "./checkin-schedule";
import { ReactionTest } from "./reaction-test";
import type { MissionModel } from "./use-mission";
import { notify } from "./use-mission";

type SaveInput = {
  slot: CheckinSlot;
  values?: VitalsInput;
  extras?: CheckinExtras;
  symptoms?: string[];
};
function LocalPreview({ label }: { label: string }) {
  const [url, setUrl] = useState(""),
    [error, setError] = useState("");
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  return (
    <section className="local-preview">
      <label>
        <Camera size={18} />
        {label}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (!file.type.startsWith("image/")) {
              setError("Choose an image file.");
              return;
            }
            setError("");
            setUrl(URL.createObjectURL(file));
            e.target.value = "";
          }}
        />
      </label>
      <p>Preview only; image not retained after refresh</p>
      {error && <p role="alert">{error}</p>}
      {url && (
        <>
          <img src={url} alt={`${label} local preview`} />
          <Button type="button" variant="outline" onClick={() => setUrl("")}>
            Remove preview
          </Button>
        </>
      )}
    </section>
  );
}
function Rating({
  label,
  value,
  onChange,
  help,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  help?: string;
}) {
  const id = label.toLowerCase().replaceAll(/[^a-z0-9]/g, "-");
  return (
    <Field>
      <FieldLabel htmlFor={id}>
        {label} <output>{value}/5</output>
      </FieldLabel>
      <input
        id={id}
        type="range"
        min={1}
        max={5}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {help && <small>{help}</small>}
    </Field>
  );
}
export function Checkin({
  model,
  save,
  busy,
}: {
  model: MissionModel;
  save: (input: SaveInput) => Promise<boolean>;
  busy: boolean;
}) {
  const profile = model.profile;
  const suggested = nextScheduledCheckin(profile)?.slot ?? "morning";
  const [slot, setSlot] = useState<CheckinSlot>(suggested),
    [values, setValues] = useState<VitalsInput>(() => {
      const v = indicatorsToVitals(profile.indicators);
      return { bodyTempC: v.bodyTempC, mood: v.mood, sleepHours: v.sleepHours };
    }),
    [symptoms, setSymptoms] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false),
    [override, setOverride] = useState(false),
    [extras, setExtras] = useState<CheckinExtras>({
      sleepQuality: 3,
      fatigue: 3,
    }),
    [energy, setEnergy] = useState(3),
    [stress, setStress] = useState(3),
    [pain, setPain] = useState(0),
    [region, setRegion] = useState(""),
    [medications, setMedications] = useState<string[]>([]),
    [food, setFood] = useState(""),
    [hydration, setHydration] = useState(""),
    [team, setTeam] = useState(3),
    [examDone, setExamDone] = useState(false),
    [visionDone, setVisionDone] = useState(false),
    [scanType, setScanType] = useState<UltrasoundScanType>("eye");
  const [journal, setJournal] = useState(""),
    [entries, setEntries] = useState(() => listJournal(profile.id)),
    [error, setError] = useState("");
  const currentDay = profile.missionDay + model.onboardMinute / 1440;
  const wearableIds = ["heart_rate", "blood_pressure", "spo2", "sleep_hours"];
  const wearableReadings = wearableIds.map(
    (id) => profile.indicators.find((i) => i.id === id)!,
  );
  const missing = wearableReadings.filter(
    (i) =>
      statusOf(i) === "no_data" ||
      !i.history.length ||
      currentDay - i.history.at(-1)!.day > 6 / 24,
  );
  const manual = override || missing.length > 0;
  const weekly = slot === "weekly",
    extended = slot === "monthly" || slot === "eye_exam";
  const available = visibleSchedule(profile);
  const tasks = getDueCheckins(profile);
  const source = indicatorsToVitals(profile.indicators);
  if (slot === "morning" && !available.some((t) => t.slot === "morning"))
    setSlot(suggested);
  const field = (key: string) => CHECKIN_INPUTS.find((s) => s.key === key)!;
  const inputs = (keys: string[]) =>
    keys.map((key) => {
      const spec = field(key);
      const value = values[spec.key];
      return (
        <Field key={key}>
          <FieldLabel htmlFor={`value-${key}`}>{spec.label}</FieldLabel>
          <div className="numeric-reading">
            <input
              id={`value-${key}`}
              type="number"
              min={spec.min}
              max={spec.max}
              step={spec.step}
              value={typeof value === "number" ? value : ""}
              onChange={(e) =>
                setValues((v) => ({
                  ...v,
                  [spec.key]:
                    e.target.value === "" ? undefined : Number(e.target.value),
                }))
              }
              required={
                key === "bodyTempC" || (weekly && key === "bloodSugarMgDl")
              }
            />
            <span>{spec.unit}</span>
          </div>
          <small>Normal reference: {spec.normalText}</small>
        </Field>
      );
    });
  const saveJournal = () => {
    if (!journal.trim()) return;
    addJournalEntry(profile.id, profile.missionDay, journal);
    setJournal("");
    setEntries(listJournal(profile.id));
    notify("Journal saved on this device only");
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!manual && !confirmed) {
      setError(
        "Confirm the shirt/watch readings or choose “Something’s off” to enter them manually.",
      );
      return;
    }
    if (
      weekly &&
      (!values.fasting || !extras.reactionMs || !food || !hydration)
    ) {
      setError(
        "Complete fasting glucose confirmation, food/hydration answers, and the 60-second reaction test.",
      );
      return;
    }
    if (extended && !(slot === "eye_exam" ? visionDone : examDone)) {
      setError("Confirm that you completed the guided exam before saving.");
      return;
    }
    const wearableValues: VitalsInput = manual
      ? {}
      : {
          heartRateBpm: source.heartRateBpm,
          systolicMmHg: source.systolicMmHg,
          diastolicMmHg: source.diastolicMmHg,
          spo2Pct: source.spo2Pct,
          sleepHours: source.sleepHours,
        };
    const ok = await save({
      slot,
      values: {
        ...wearableValues,
        ...values,
        ...(weekly ? { fasting: true } : {}),
      },
      symptoms,
      extras: {
        ...extras,
        notes: JSON.stringify({
          energy,
          stress,
          pain,
          painRegion: region,
          medicationsTaken: medications,
          ...(weekly ? { food, hydrationLitres: Number(hydration) } : {}),
          ...(extended
            ? { examDone, visionDone, teamCohesion: team, scanType }
            : {}),
        }),
      },
    });
    if (ok) {
      if (journal.trim()) saveJournal();
      setError("");
    }
  };
  return (
    <div className="revised-checkin">
      <Panel title="Shirt / watch & latest readings">
        <p>
          Review the latest HR, BP, SpO₂ and sleep readings. Breathing is shown
          only when a sensor provides it.
        </p>
        <div className="wearable-header">
          {wearableReadings.map((i) => (
            <div key={i.id}>
              <h3>{i.name}</h3>
              <strong>
                {statusOf(i) === "no_data" ? "—" : i.value}
                <small> {i.unit}</small>
              </strong>
              <Status status={statusOf(i)} />
              <small>
                {i.history.at(-1)?.source === "wearable_auto"
                  ? "Wearable · simulated"
                  : i.history.at(-1)?.source === "manual_slider"
                    ? "Manual"
                    : "Latest profile reading"}
              </small>
            </div>
          ))}
          <div>
            <h3>Breathing</h3>
            <strong>
              —<small> breaths/min</small>
            </strong>
            <Status status="no_data" />
            <small>No breathing sensor reading available</small>
          </div>
        </div>
        <div className="wearable-confirm">
          <Button
            variant={confirmed ? "default" : "outline"}
            onClick={() => {
              setConfirmed(true);
              setOverride(false);
              setValues((v) => ({
                ...v,
                heartRateBpm: source.heartRateBpm,
                systolicMmHg: source.systolicMmHg,
                diastolicMmHg: source.diastolicMmHg,
                spo2Pct: source.spo2Pct,
                sleepHours: source.sleepHours,
              }));
            }}
          >
            <Check data-icon="inline-start" />
            Looks right ✓
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setOverride(true);
              setConfirmed(false);
              setValues((v) => ({
                ...v,
                heartRateBpm: source.heartRateBpm,
                systolicMmHg: source.systolicMmHg,
                diastolicMmHg: source.diastolicMmHg,
                spo2Pct: source.spo2Pct,
                sleepHours: source.sleepHours,
              }));
            }}
          >
            Something’s off
          </Button>
        </div>
        {missing.length > 0 && (
          <p className="manual-notice" role="status">
            Manual inputs are available: {missing.map((i) => i.name).join(", ")}{" "}
            is missing, unverified, or more than 6 hours old. Please confirm or
            retake these measurements.
          </p>
        )}
      </Panel>
      <div className="scope-tabs" role="tablist" aria-label="Check-in cadence">
        {(
          [
            "morning",
            "weekly",
            "monthly",
            "eye_exam",
            "evening",
          ] as CheckinSlot[]
        )
          .filter(
            (s) =>
              s !== "morning" || available.some((t) => t.slot === "morning"),
          )
          .map((s) => (
            <button
              key={s}
              role="tab"
              aria-selected={slot === s}
              onClick={() => {
                setSlot(s);
                setError("");
              }}
            >
              {s === "monthly"
                ? "Monthly / Extended"
                : s === "eye_exam"
                  ? "Eye / vision exam"
                  : s === "weekly"
                    ? "Weekly"
                    : s === "evening"
                      ? "Evening (optional)"
                      : "Morning"}
              {tasks.find((t) => t.slot === s)?.done ? " ✓" : ""}
            </button>
          ))}
      </div>
      <form onSubmit={submit}>
        <Panel
          title={CHECKIN_SCHEDULE[slot].title}
          accessory={
            <span className="meta">
              ~{CHECKIN_SCHEDULE[slot].estMinutes} min ·{" "}
              {tasks.find((t) => t.slot === slot)?.dueReason}
            </span>
          }
        >
          <p className="section-intro">
            {weekly
              ? "Weekly checks include today’s daily basics and replace the morning form on every seventh mission day."
              : extended
                ? "Extended checks include daily basics plus the guided exam."
                : "Your daily wellbeing and symptoms."}{" "}
            Measurements are evaluated by the shared health service.
          </p>
          <FieldGroup>
            <div className="checkin-fields">
              {inputs(["bodyTempC", "mood"])}
              <Rating
                label="Sleep quality"
                value={extras.sleepQuality ?? 3}
                onChange={(n) =>
                  setExtras((x) => ({ ...x, sleepQuality: n as Rating5 }))
                }
                help="1 terrible · 5 great"
              />
              <Rating
                label="Energy"
                value={energy}
                onChange={setEnergy}
                help="1 low · 5 energetic"
              />
              <Rating
                label="Fatigue"
                value={extras.fatigue ?? 3}
                onChange={(n) =>
                  setExtras((x) => ({ ...x, fatigue: n as Rating5 }))
                }
                help="1 none · 5 exhausted"
              />
              <Rating
                label="Stress"
                value={stress}
                onChange={setStress}
                help="1 low · 5 high"
              />
              {manual &&
                inputs([
                  "heartRateBpm",
                  "systolicMmHg",
                  "diastolicMmHg",
                  "spo2Pct",
                  "sleepHours",
                ])}
            </div>
            <FieldSet>
              <FieldLegend>Symptoms</FieldLegend>
              <div className="symptom-grid">
                {CHECKIN_SYMPTOMS.map((s) => (
                  <label className="check-label" key={s}>
                    <input
                      type="checkbox"
                      checked={symptoms.includes(s)}
                      onChange={(e) =>
                        setSymptoms((x) =>
                          e.target.checked
                            ? [...x, s]
                            : x.filter((v) => v !== s),
                        )
                      }
                    />
                    {s === "eye or vision change"
                      ? "Vision change"
                      : s[0].toUpperCase() + s.slice(1)}
                  </label>
                ))}
              </div>
            </FieldSet>
            {symptoms.includes("skin problem") && (
              <LocalPreview label="Skin image / camera" />
            )}
            <div className="checkin-fields">
              <Field>
                <FieldLabel htmlFor="pain">Pain (0–10)</FieldLabel>
                <input
                  id="pain"
                  type="range"
                  min={0}
                  max={10}
                  step={1}
                  value={pain}
                  onChange={(e) => setPain(Number(e.target.value))}
                />
                <output>{pain}/10</output>
              </Field>
              <Field>
                <FieldLabel htmlFor="pain-region">Pain body region</FieldLabel>
                <input
                  id="pain-region"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  required={pain > 0}
                  placeholder="e.g. lower back"
                />
              </Field>
            </div>
            <FieldSet>
              <FieldLegend>Medications taken</FieldLegend>
              <div className="meds-taken">
                {getMedicationList().map((m) => (
                  <label className="check-label" key={m.id}>
                    <input
                      type="checkbox"
                      checked={medications.includes(m.name)}
                      onChange={(e) =>
                        setMedications((x) =>
                          e.target.checked
                            ? [...x, m.name]
                            : x.filter((v) => v !== m.name),
                        )
                      }
                    />
                    {m.name}
                    <Status status={m.status} />
                  </label>
                ))}
              </div>
            </FieldSet>
            {weekly && (
              <section className="cadence-section">
                <h3>Weekly measurements & food log</h3>
                <div className="checkin-fields">
                  {inputs(["bloodSugarMgDl"])}
                  <Field>
                    <FieldLabel htmlFor="mass">Body mass (kg)</FieldLabel>
                    <input
                      id="mass"
                      type="number"
                      min={1}
                      max={400}
                      step={0.1}
                      required
                      value={extras.bodyMassKg ?? ""}
                      onChange={(e) =>
                        setExtras((x) => ({
                          ...x,
                          bodyMassKg: Number(e.target.value),
                        }))
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="food">
                      Food / nutrition questionnaire
                    </FieldLabel>
                    <select
                      id="food"
                      value={food}
                      required
                      onChange={(e) => setFood(e.target.value)}
                    >
                      <option value="">Select an answer</option>
                      <option value="met_plan">Ate the planned meals</option>
                      <option value="reduced_intake">
                        Less than the planned intake
                      </option>
                      <option value="needs_review">
                        Needs crew medical review
                      </option>
                    </select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="hydration">
                      Water / fluids yesterday (litres)
                    </FieldLabel>
                    <input
                      id="hydration"
                      type="number"
                      min={0}
                      max={20}
                      step={0.1}
                      value={hydration}
                      onChange={(e) => setHydration(e.target.value)}
                      required
                    />
                  </Field>
                </div>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={values.fasting ?? false}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, fasting: e.target.checked }))
                    }
                  />
                  Fasting glucose measured before food
                </label>
                <ReactionTest
                  onResult={(ms) =>
                    setExtras((x) => ({ ...x, reactionMs: ms ?? undefined }))
                  }
                />
              </section>
            )}
            {extended && (
              <section className="cadence-section">
                <h3>Guided full health exam & questionnaires</h3>
                <p>
                  Complete the exam with a crewmate. Review circulation,
                  breathing, skin, movement, vision, sleep, and team wellbeing;
                  escalate concerns using onboard guidance.
                </p>
                <Rating
                  label="Team cohesion"
                  value={team}
                  onChange={setTeam}
                  help="1 strained · 5 strong"
                />
                {slot === "monthly" && (
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={examDone}
                      onChange={(e) => setExamDone(e.target.checked)}
                    />
                    Guided full health exam and sleep/team questionnaire
                    completed with a crewmate
                  </label>
                )}
                <details className="procedure">
                  <summary>Vision / eye ultrasound procedure</summary>
                  <ol>
                    {listProcedures()
                      .find((p) => p.id === "eye_ultrasound")
                      ?.steps.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                  </ol>
                  <p>
                    Amsler grid / on-screen vision assessment: follow the
                    approved onboard vision protocol. This app does not replace
                    calibrated examination equipment.
                  </p>
                </details>
                <Field>
                  <FieldLabel htmlFor="scan-type">
                    Periodic scan type
                  </FieldLabel>
                  <select
                    id="scan-type"
                    value={scanType}
                    onChange={(e) =>
                      setScanType(e.target.value as UltrasoundScanType)
                    }
                  >
                    {Object.entries(ULTRASOUND_GUIDES).map(([key, g]) => (
                      <option key={key} value={key}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <ol>
                  {ULTRASOUND_GUIDES[scanType].steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
                <p>{ULTRASOUND_GUIDES[scanType].goodImage}</p>
                <LocalPreview key={scanType} label="Ultrasound / exam image" />
                {slot === "eye_exam" && (
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={visionDone}
                      onChange={(e) => setVisionDone(e.target.checked)}
                    />
                    Vision assessment and guided eye exam completed
                  </label>
                )}
              </section>
            )}
            <section className="journal-section">
              <h3>JOURNAL</h3>
              <Field>
                <FieldLabel htmlFor="journal">Private journal entry</FieldLabel>
                <textarea
                  id="journal"
                  maxLength={10000}
                  rows={5}
                  value={journal}
                  onChange={(e) => setJournal(e.target.value)}
                  placeholder="Write freely about how you're feeling today—sleep quality, energy levels, mental focus, crew dynamics, workload stress, or anything unusual you noticed during EVA or daily tasks..."
                />
              </Field>
              <p>
                Stored on this device only. Never synced, shared with crew, or
                sent to AI. Images are not saved with your journal.
              </p>
              <Button
                type="button"
                variant="outline"
                disabled={!journal.trim()}
                onClick={saveJournal}
              >
                Save journal entry
              </Button>
              {entries.length > 0 && (
                <details>
                  <summary>Journal history ({entries.length})</summary>
                  {entries.map((entry) => (
                    <article className="journal-entry" key={entry.id}>
                      <strong>Day {entry.missionDay}</strong>
                      <p>{entry.text}</p>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          deleteJournalEntry(entry.id);
                          setEntries(listJournal(profile.id));
                        }}
                      >
                        <Trash2 data-icon="inline-start" />
                        Delete entry
                      </Button>
                    </article>
                  ))}
                </details>
              )}
            </section>
          </FieldGroup>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <Button
            type="submit"
            disabled={busy}
            size="lg"
            className="submit-checkin"
          >
            <Check data-icon="inline-start" />
            {busy ? "Saving check-in…" : "Save check-in"}
          </Button>
        </Panel>
      </form>
    </div>
  );
}
