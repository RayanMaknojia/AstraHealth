import { statusOf } from "./status";
import { useState } from "react";
import { UploadCloud, Check, ArrowRight } from "lucide-react";
import { CHECKIN_INPUTS, CHECKIN_SYMPTOMS } from "@/data/nasaSpaceflightData";
import { ACCEPTED_FILE_TYPES } from "@/services/ingestionEngine";
import { indicatorsToVitals, STATUS_COLORS } from "@/services/healthEvaluator";
import type {
  AstronautProfile,
  IngestionInput,
  IngestionResult,
  VitalsInput,
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
export function Checkin({
  profile,
  submit,
  busy,
  result,
  photo,
  slotLabel = "Morning",
}: {
  profile: AstronautProfile;
  submit: (input: IngestionInput) => Promise<void>;
  busy: boolean;
  result: IngestionResult | null;
  photo: () => void;
  slotLabel?: string;
}) {
  const [values, setValues] = useState<VitalsInput>(() =>
    indicatorsToVitals(profile.indicators),
  );
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [drag, setDrag] = useState(false);
  const upload = (file?: File) => {
    if (file && !busy)
      void submit({ file, fileName: file.name, mimeType: file.type });
  };
  return (
    <div className="checkin-layout">
      <Panel
        title="Your daily check-in"
        accessory={<span className="meta">{slotLabel} · ~2 minutes</span>}
      >
        <p className="section-intro">
          Start with your latest readings. Only checked measurements are
          submitted; confirm each value before saving.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit({ manualValues: { ...values, symptoms } });
          }}
        >
          <FieldGroup>
            {CHECKIN_INPUTS.map((spec) => {
              const value = values[spec.key];
              const enabled = typeof value === "number";
              return (
                <Field key={spec.key} className="checkin-field">
                  <div className="reading-label">
                    <FieldLabel htmlFor={spec.key}>{spec.label}</FieldLabel>
                    <label className="include-reading">
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) =>
                          setValues((v) => {
                            const next = { ...v };
                            if (e.target.checked)
                              Object.assign(next, {
                                [spec.key]: Math.min(
                                  spec.max,
                                  Math.max(
                                    spec.min,
                                    Number(
                                      indicatorsToVitals(profile.indicators)[
                                        spec.key
                                      ] ?? spec.min,
                                    ),
                                  ),
                                ),
                              });
                            else delete next[spec.key];
                            return next;
                          })
                        }
                      />
                      Include reading
                    </label>
                  </div>
                  <div className="slider-row">
                    <input
                      id={spec.key}
                      aria-label={spec.label}
                      type="range"
                      min={spec.min}
                      max={spec.max}
                      step={spec.step}
                      value={enabled ? value : spec.min}
                      disabled={!enabled}
                      onChange={(e) =>
                        setValues((v) => ({
                          ...v,
                          [spec.key]: Number(e.target.value),
                        }))
                      }
                    />
                    <input
                      type="number"
                      aria-label={`${spec.label} value`}
                      min={spec.min}
                      max={spec.max}
                      step={spec.step}
                      value={enabled ? value : ""}
                      disabled={!enabled}
                      onChange={(e) =>
                        setValues((v) => ({
                          ...v,
                          [spec.key]: Number(e.target.value),
                        }))
                      }
                    />
                    <span>{spec.unit}</span>
                  </div>
                  <small>Normal: {spec.normalText}</small>
                </Field>
              );
            })}
            <label className="check-label">
              <input
                type="checkbox"
                checked={values.fasting ?? false}
                onChange={(e) =>
                  setValues((v) => ({ ...v, fasting: e.target.checked }))
                }
              />
              Blood glucose measured fasting
            </label>
            <FieldSet>
              <FieldLegend>How are you feeling?</FieldLegend>
              <div className="symptom-grid">
                {CHECKIN_SYMPTOMS.map((symptom) => (
                  <label key={symptom} className="check-label">
                    <input
                      type="checkbox"
                      checked={symptoms.includes(symptom)}
                      onChange={(e) =>
                        setSymptoms((v) =>
                          e.target.checked
                            ? [...v, symptom]
                            : v.filter((s) => s !== symptom),
                        )
                      }
                    />
                    {symptom}
                  </label>
                ))}
              </div>
            </FieldSet>
            {symptoms.includes("skin problem") && (
              <Button variant="outline" type="button" onClick={photo}>
                Add photo <ArrowRight data-icon="inline-end" />
              </Button>
            )}
          </FieldGroup>
          <Button
            disabled={busy}
            type="submit"
            size="lg"
            className="submit-checkin"
          >
            <Check data-icon="inline-start" />
            {busy ? "Evaluating readings…" : "Save check-in"}
          </Button>
        </form>
      </Panel>
      <div className="checkin-side">
        <Panel title="Diagnostic dropzone">
          <label
            className={`dropzone ${drag ? "dragging" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              upload(e.dataTransfer.files[0]);
            }}
          >
            <UploadCloud size={36} />
            <strong>Drop a clinical file here</strong>
            <span>Ultrasound, lab results, or a voice log</span>
            <span className="upload-cta">Choose file</span>
            <input
              type="file"
              accept={ACCEPTED_FILE_TYPES}
              disabled={busy}
              onChange={(e) => {
                upload(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <small>Images · PDF · CSV · Text · Audio</small>
          </label>
          <p className="fine-print">
            Biomedical relevance checked first. Accepted media is normalized
            once into a clinical summary.
          </p>
        </Panel>
        {result && (
          <Panel
            title={
              result.verdict.accepted
                ? "Accepted & Normalized"
                : "Rejected: Non-Biomedical Data"
            }
          >
            <p
              role="status"
              style={{
                color: result.verdict.accepted
                  ? STATUS_COLORS[result.artifact.severity]
                  : STATUS_COLORS.caution,
              }}
            >
              {result.verdict.accepted
                ? result.artifact.extractedSummary
                : result.verdict.rejectionReason}
            </p>
            <div className="result-indicators">
              {result.artifact.mappedIndicators.map((id) => {
                const i = profile.indicators.find((i) => i.id === id);
                return i ? (
                  <div key={id}>
                    <span>
                      {i.name}: {i.value} {i.unit}
                    </span>
                    <Status status={statusOf(i)} />
                  </div>
                ) : null;
              })}
            </div>
            <p className="fine-print">
              {result.engine === "offline_mock"
                ? "Offline evaluation"
                : "Gemini-assisted evaluation"}{" "}
              · Decision support, not diagnosis
            </p>
          </Panel>
        )}
        <Panel title="Your next steps">
          <p>
            Symptoms are valid check-in data. Reporting how you feel is part of
            taking care of the crew.
          </p>
          <p className="fine-print">
            Evening, weekly and monthly schedules, real streaks, and badges
            arrive in Phase 3.
          </p>
        </Panel>
      </div>
    </div>
  );
}
