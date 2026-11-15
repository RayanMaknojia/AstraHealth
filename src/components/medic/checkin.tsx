import { useState } from "react";
import { Check, Camera, ArrowUpRight } from "lucide-react";
import { CHECKIN_INPUTS, CHECKIN_SYMPTOMS } from "@/data/nasaSpaceflightData";
import { CHECKIN_SCHEDULE } from "@/data/phase3Data";
import { getDueCheckins } from "@/services/checkinService";
import { indicatorsToVitals } from "@/services/healthEvaluator";
import { getMedicationList } from "@/services/guidanceService";
import { addJournalEntry, listJournal } from "@/services/wellbeingService";
import type {
  CheckinSlot,
  CheckinExtras,
  VitalsInput,
  Rating5,
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
import { PhotoCheck } from "./photo-check";
import { statusStyle } from "./status";
import { EXAM_GUIDES, type ExamGuideId } from "./exam-guidance";
import { notify } from "./use-mission";

type SaveInput = {
  slot: CheckinSlot;
  values?: VitalsInput;
  extras?: CheckinExtras;
  symptoms?: string[];
};
function RequiredMark() {
  return (
    <>
      <span className="required-mark" aria-hidden="true">
        *
      </span>{" "}
    </>
  );
}
function Rating({
  label,
  value,
  onChange,
  help,
  required = false,
}: {
  label: string;
  value: number | undefined;
  onChange: (n: number) => void;
  help?: string;
  required?: boolean;
}) {
  const id = label.toLowerCase().replaceAll(/[^a-z0-9]/g, "-");
  return (
    <Field>
      <FieldLabel htmlFor={id}>
        <span className="required-field-heading">
          {label}
          {required && <RequiredMark />}
        </span>
        <output>
          {value === undefined ? "Choose a rating" : `${value}/5`}
        </output>
      </FieldLabel>
      <input
        id={id}
        type="range"
        min={1}
        max={5}
        step={1}
        value={value ?? 3}
        required={required}
        aria-required={required}
        aria-label={label}
        aria-valuetext={
          value === undefined ? "Not yet provided" : `${value} out of 5`
        }
        onPointerUp={(e) => onChange(Number(e.currentTarget.value))}
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
  onJournalHistory,
  onGuidance,
}: {
  model: MissionModel;
  save: (input: SaveInput) => Promise<boolean>;
  busy: boolean;
  onJournalHistory: () => void;
  onGuidance: (id: ExamGuideId) => void;
}) {
  const profile = model.profile;
  const suggested = nextScheduledCheckin(profile)?.slot ?? "morning";
  const [slot, setSlot] = useState<CheckinSlot>(suggested),
    [values, setValues] = useState<VitalsInput>({}),
    [symptoms, setSymptoms] = useState<string[]>([]);
  const [extras, setExtras] = useState<CheckinExtras>({}),
    [stress, setStress] = useState<number | undefined>(undefined),
    [pain, setPain] = useState(0),
    [region, setRegion] = useState(""),
    [medications, setMedications] = useState<string[]>([]),
    [food, setFood] = useState(""),
    [hydration, setHydration] = useState(""),
    [team, setTeam] = useState(3),
    [examResults, setExamResults] = useState<Record<string, string>>({}),
    [examDone, setExamDone] = useState(false),
    [photoOpen, setPhotoOpen] = useState(false),
    [medDetails, setMedDetails] = useState<
      Record<string, { dose: string; time: string }>
    >({});
  const [journal, setJournal] = useState(""),
    [entries, setEntries] = useState(() => listJournal(profile.id)),
    [error, setError] = useState(""),
    [draftRevision, setDraftRevision] = useState(0);
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
  const manual = missing.length > 0;
  const weekly = slot === "weekly",
    extended = slot === "monthly";
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
      const required =
        key === "bodyTempC" || (weekly && key === "bloodSugarMgDl");
      return (
        <Field key={key}>
          <FieldLabel htmlFor={`value-${key}`}>
            <span className="required-field-heading">
              {spec.label}
              {required && <RequiredMark />}
            </span>
          </FieldLabel>
          <div className="numeric-reading">
            <input
              id={`value-${key}`}
              aria-label={spec.label}
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
              required={required}
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
    const requiredRatings = [
      ["Mood", values.mood],
      ["Sleep quality", extras.sleepQuality],
      ["Energy / fatigue", extras.fatigue],
      ["Stress", stress],
    ] as const;
    const missingRatings = requiredRatings
      .filter(([, v]) => v === undefined || v < 1 || v > 5)
      .map(([name]) => name);
    if (values.bodyTempC === undefined || missingRatings.length) {
      setError(
        `Complete all required measurements: ${[...(values.bodyTempC === undefined ? ["Body temperature"] : []), ...missingRatings].join(", ")}.`,
      );
      return;
    }
    if (
      weekly &&
      (!values.fasting || !extras.reactionMs || !food || !hydration)
    ) {
      setError(
        "Complete fasting glucose confirmation, food/hydration answers, and the 30-second reaction test.",
      );
      return;
    }
    if (extended && !examDone) {
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
          stress,
          pain,
          painRegion: region,
          medicationsTaken: medications.map((name) => ({
            name,
            ...medDetails[name],
          })),
          ...(weekly ? { food, hydrationLitres: Number(hydration) } : {}),
          ...(extended ? { examDone, teamCohesion: team, examResults } : {}),
        }),
      },
    });
    if (ok) {
      if (journal.trim()) saveJournal();
      setValues({});
      setExtras({});
      setSymptoms([]);
      setStress(undefined);
      setPain(0);
      setRegion("");
      setMedications([]);
      setMedDetails({});
      setFood("");
      setHydration("");
      setTeam(3);
      setExamResults({});
      setExamDone(false);
      setPhotoOpen(false);
      setJournal("");
      setDraftRevision((n) => n + 1);
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
              <strong style={statusStyle(statusOf(i))} className="health-value">
                {statusOf(i) === "no_data" ? "-" : i.value}
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
            <strong className="health-value" style={statusStyle("no_data")}>
              -<small> breaths/min</small>
            </strong>
            <Status status="no_data" />
            <small>No breathing sensor reading available</small>
          </div>
        </div>
        {missing.length > 0 && (
          <p className="manual-notice" role="status">
            Manual inputs are available: {missing.map((i) => i.name).join(", ")}{" "}
            is missing, unverified, or more than 6 hours old. Enter a fresh
            measurement below when available.
          </p>
        )}
      </Panel>
      <div className="scope-tabs" role="tablist" aria-label="Check-in cadence">
        {(["morning", "weekly", "monthly"] as CheckinSlot[])
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
                : s === "weekly"
                  ? "Weekly"
                  : "Daily"}
              {tasks.find((t) => t.slot === s)?.done ? " ✓" : ""}
            </button>
          ))}
      </div>
      <form onSubmit={submit}>
        <Panel
          title={
            slot === "morning" ? "Daily check-in" : CHECKIN_SCHEDULE[slot].title
          }
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
          <p className="required-fields-note">
            Fields marked <RequiredMark /> are required. Choose each daily
            rating before submitting.
          </p>
          <FieldGroup>
            <div className="checkin-fields">
              {inputs(["bodyTempC"])}
              <Rating
                label="Mood"
                required
                value={values.mood}
                onChange={(n) => setValues((v) => ({ ...v, mood: n }))}
                help="1 low · 5 great"
              />
              <Rating
                label="Sleep quality"
                required
                value={extras.sleepQuality}
                onChange={(n) =>
                  setExtras((x) => ({ ...x, sleepQuality: n as Rating5 }))
                }
                help="1 terrible · 5 great"
              />
              <Rating
                label="Energy / fatigue"
                required
                value={extras.fatigue}
                onChange={(n) =>
                  setExtras((x) => ({ ...x, fatigue: n as Rating5 }))
                }
                help="1 none · 5 exhausted"
              />
              <Rating
                label="Stress"
                required
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
              <Button
                type="button"
                variant="outline"
                onClick={() => setPhotoOpen(true)}
              >
                <Camera data-icon="inline-start" />
                Add photo
              </Button>
            )}
            <div className="checkin-fields">
              <Field>
                <FieldLabel htmlFor="pain">Pain (0-10)</FieldLabel>
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
                <FieldLabel htmlFor="pain-region">
                  <span className="required-field-heading">
                    Pain body region{pain > 0 && <RequiredMark />}
                  </span>
                </FieldLabel>
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
                  <div className="medication-taken-card" key={m.id}>
                    <label className="check-label">
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
                    {medications.includes(m.name) && (
                      <div className="medication-dose-fields">
                        <label>
                          <span className="required-field-heading">
                            Dose
                            <RequiredMark />
                          </span>
                          <input
                            aria-label={`${m.name} dose`}
                            required
                            value={medDetails[m.name]?.dose ?? ""}
                            placeholder="e.g. 500 mg"
                            onChange={(e) =>
                              setMedDetails((x) => ({
                                ...x,
                                [m.name]: {
                                  ...x[m.name],
                                  dose: e.target.value,
                                },
                              }))
                            }
                          />
                        </label>
                        <label>
                          <span className="required-field-heading">
                            Time
                            <RequiredMark />
                          </span>
                          <input
                            aria-label={`${m.name} time`}
                            required
                            type="time"
                            value={medDetails[m.name]?.time ?? ""}
                            onChange={(e) =>
                              setMedDetails((x) => ({
                                ...x,
                                [m.name]: {
                                  ...x[m.name],
                                  time: e.target.value,
                                },
                              }))
                            }
                          />
                        </label>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </FieldSet>
            {weekly && (
              <section className="cadence-section">
                <h3>Weekly measurements & food log</h3>
                <div className="checkin-fields">
                  {inputs(["bloodSugarMgDl"])}
                  <Field>
                    <FieldLabel htmlFor="mass">
                      <span className="required-field-heading">
                        Body mass (kg)
                        <RequiredMark />
                      </span>
                    </FieldLabel>
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
                      <span className="required-field-heading">
                        Food / nutrition questionnaire
                        <RequiredMark />
                      </span>
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
                      <span className="required-field-heading">
                        Water / fluids yesterday (litres)
                        <RequiredMark />
                      </span>
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
                    required
                    checked={values.fasting ?? false}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, fasting: e.target.checked }))
                    }
                  />
                  <span className="required-field-heading">
                    Fasting glucose measured before food
                    <RequiredMark />
                  </span>
                </label>
              </section>
            )}
            {extended && (
              <section className="cadence-section">
                <h3>Guided full health exam & questionnaires</h3>
                <p>
                  Complete the exam with a crewmate. Review circulation,
                  breathing, skin, movement, sleep, and team wellbeing; escalate
                  concerns using onboard guidance.
                </p>
                <ol className="monthly-exam-steps checkin-fields">
                  {EXAM_GUIDES.map((guide, n) => {
                    const item = guide.label;
                    return (
                      <li key={item}>
                        <label>
                          <span className="required-field-heading">
                            {n + 1}. {item}
                            <RequiredMark />
                          </span>
                          <select
                            aria-label={`Exam: ${item}`}
                            required
                            value={examResults[item] ?? ""}
                            onChange={(e) => {
                              const value = e.target.value;
                              setExamResults((x) => ({ ...x, [item]: value }));
                              if (value === "follow_up") onGuidance(guide.id);
                            }}
                          >
                            <option value="">Review with crewmate</option>
                            <option value="no_concerns">
                              No concerns noted
                            </option>
                            <option value="follow_up">
                              Concern noted: follow onboard guidance
                            </option>
                          </select>
                        </label>
                        {examResults[item] === "follow_up" && (
                          <Button
                            type="button"
                            variant="ghost"
                            className="exam-guidance-link"
                            onClick={() => onGuidance(guide.id)}
                          >
                            Open guidance
                            <ArrowUpRight data-icon="inline-end" />
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ol>
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
                      required
                      checked={examDone}
                      onChange={(e) => setExamDone(e.target.checked)}
                    />
                    <span className="required-field-heading">
                      Guided full health exam and sleep/team questionnaire
                      completed with a crewmate
                      <RequiredMark />
                    </span>
                  </label>
                )}
              </section>
            )}
            <div className="checkin-bottom-columns">
              <ReactionTest
                key={draftRevision}
                required={weekly}
                astronautId={profile.id}
                onResult={(ms) =>
                  setExtras((x) => ({ ...x, reactionMs: ms ?? undefined }))
                }
              />
              <section className="journal-section">
                <h3>JOURNAL</h3>
                <Field>
                  <FieldLabel htmlFor="journal">
                    Private journal entry
                  </FieldLabel>
                  <textarea
                    id="journal"
                    maxLength={10000}
                    rows={5}
                    value={journal}
                    onChange={(e) => setJournal(e.target.value)}
                    placeholder="Write freely about how you're feeling today: sleep quality, energy levels, mental focus, crew dynamics, workload stress, or anything unusual you noticed during EVA or daily tasks..."
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
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onJournalHistory}
                >
                  View past journal entries ({entries.length})
                  <ArrowUpRight data-icon="inline-end" />
                </Button>
              </section>
            </div>
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
      <PhotoCheck
        key={draftRevision}
        open={photoOpen}
        onClose={() => setPhotoOpen(false)}
        model={model}
        bodyLocation={region}
      />
    </div>
  );
}
