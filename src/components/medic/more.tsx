import { useState } from "react";
import {
  ArrowUpRight,
  ArrowLeft,
  LogOut,
  Cloud,
  Wind,
  Gauge,
  Thermometer,
  Droplets,
  Volume2,
  SunMoon,
  Radiation,
} from "lucide-react";
import {
  SPACEFLIGHT_HAZARDS,
  SOURCES,
  CABIN_LIMITS,
} from "@/data/nasaSpaceflightData";
import { summarizeCabin, isItMeOrTheAir } from "@/services/environmentFeed";
import { listCheckins } from "@/services/checkinService";
import {
  listTriageSymptoms,
  startTriage,
  answerTriage,
  triageOutcomeForMission,
  listProcedures,
  getMedicationList,
} from "@/services/guidanceService";
import type { TriageNode, TriageSymptom } from "@/types/astronaut";
import { Button } from "@/components/ui/button";
import { ExamGuidance } from "./exam-guidance-view";
import type { ExamGuideId } from "./exam-guidance";
import { JournalHistory } from "./journal-history";
import { statusStyle } from "./status";
import { statusOf } from "./status";
import { Panel, Status } from "./primitives";
import type { MissionModel } from "./use-mission";
import { MyRecords } from "./my-records";
import {
  NASA_DATA_CREDITS,
  SAA_THRESHOLD_UGY_PER_H,
} from "@/data/nasaOpenData";
import type { RadiationSample } from "@/types/astronaut";
export function More({
  model,
  onLogout,
  initialTab = "Cabin readings",
  focusGuide,
  onCheckin,
}: {
  model: MissionModel;
  onLogout: () => void;
  initialTab?: string;
  focusGuide?: ExamGuideId | null;
  onCheckin: () => void;
}) {
  const [tab, setTab] = useState(initialTab);
  const [symptom, setSymptom] = useState<TriageSymptom>("headache");
  const [node, setNode] = useState<TriageNode | null>(null);
  const cabin = summarizeCabin(model.cabinHistory);
  const symptoms = listCheckins(
    model.profile.id,
    model.profile.missionDay,
    1,
  ).flatMap((r) => r.symptoms);
  const air = isItMeOrTheAir(symptoms, model.cabinHistory);
  const outcome =
    node?.kind === "outcome"
      ? triageOutcomeForMission(node, model.missionState)
      : null;
  return (
    <>
      <div className="scope-tabs" role="tablist" aria-label="More sections">
        {[
          "Cabin readings",
          "My records",
          "Past journal entries",
          "Guidance & triage",
          "References",
        ].map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "My records" && (
        <div role="tabpanel" aria-label="My records">
          <MyRecords model={model} />
        </div>
      )}
      {tab === "Past journal entries" && (
        <div role="tabpanel" aria-label="Past journal entries">
          <JournalHistory astronautId={model.profile.id} />
        </div>
      )}
      {tab === "Cabin readings" && (
        <div role="tabpanel" aria-label="Cabin readings">
          <Panel
            title="Cabin environment"
            accessory={
              model.environmentTick ? (
                <Status status={model.environmentTick.cabinEvaluation.status} />
              ) : (
                <Status status="no_data" />
              )
            }
          >
            <p>
              Cabin conditions can influence your symptoms. Readings below come
              from the simulated environment feed.
            </p>
            <div className="cabin-metric-grid">
              {model.environmentTick ? (
                model.environmentTick.cabinEvaluation.params.map((p) => (
                  <div key={p.param} style={statusStyle(p.status)}>
                    <h3>
                      {(() => {
                        const Icon = {
                          co2_mmhg: Cloud,
                          temp_c: Thermometer,
                          humidity_pct: Droplets,
                          cabin_psia: Gauge,
                          ppo2_mmhg: Wind,
                        }[p.param];
                        return Icon ? <Icon size={20} /> : null;
                      })()}
                      {CABIN_LIMITS.find((c) => c.param === p.param)?.label ??
                        p.param}
                    </h3>
                    <strong className="health-value">
                      {p.value}
                      <small>
                        {" "}
                        {CABIN_LIMITS.find((c) => c.param === p.param)?.unit}
                      </small>
                    </strong>
                    <Status status={p.status} />
                    <p>{p.message}</p>
                  </div>
                ))
              ) : (
                <p className="empty-reading">
                  No cabin telemetry yet. Use +15m Wearable Sync in Mission
                  Control or switch off Demo mode to start the feed.
                </p>
              )}
              {cabin.latest && (
                <>
                  <div
                    style={statusStyle(
                      model.environmentTick?.cabinEvaluation.params.find(
                        (p) => p.param === "ppo2_mmhg",
                      )?.status ?? "no_data",
                    )}
                  >
                    <h3>
                      <Wind size={20} />
                      O₂ concentration
                    </h3>
                    <strong className="health-value">
                      {cabin.latest.o2Pct}
                      <small> %</small>
                    </strong>
                    <p>Interpret alongside cabin pressure and inspired O₂.</p>
                  </div>
                  <div
                    style={statusStyle(
                      statusOf(
                        model.profile.indicators.find(
                          (i) => i.id === "radiation_dose",
                        )!,
                      ),
                    )}
                  >
                    <h3>
                      <Radiation size={20} />
                      Radiation context
                    </h3>
                    <strong className="health-value">
                      {model.environmentTick?.radiation.doseRateMSvPerDay ??
                        "-"}
                      <small> mSv/day</small>
                    </strong>
                    <p>
                      {model.environmentTick?.activeEvent?.summary ??
                        model.missionState.environment.label}
                    </p>
                    <RadiationSourceNote
                      sample={model.environmentTick?.radiation}
                    />
                  </div>
                  <div>
                    <h3>
                      <Volume2 size={20} />
                      Noise
                    </h3>
                    <strong
                      style={statusStyle(
                        cabin.noiseAdvice
                          ? "caution"
                          : cabin.latest.noiseDb === undefined
                            ? "no_data"
                            : "nominal",
                      )}
                      className="health-value"
                    >
                      {cabin.latest.noiseDb ?? "-"}
                      <small> dB(A)</small>
                    </strong>
                    <p>{cabin.noiseAdvice ?? "Simulated cabin sound level"}</p>
                  </div>
                  <div>
                    <h3>
                      <SunMoon size={20} />
                      Light phase
                    </h3>
                    <strong>{cabin.latest.lightPhase ?? "Not measured"}</strong>
                    <p>Onboard lighting schedule</p>
                  </div>
                </>
              )}
            </div>
            <dl className="cabin-averages">
              <dt>CO₂ · 1 hour</dt>
              <dd>{cabin.co2Avg1h ?? "-"} mmHg</dd>
              <dt>6 hours</dt>
              <dd>{cabin.co2Avg6h ?? "-"} mmHg</dd>
              <dt>24 hours</dt>
              <dd>{cabin.co2Avg24h ?? "-"} mmHg</dd>
            </dl>
            {cabin.noiseAdvice && <p>{cabin.noiseAdvice}</p>}
            {cabin.latest?.lightPhase && (
              <p>Light phase: {cabin.latest.lightPhase}</p>
            )}
          </Panel>
          <Panel title="Is it me or the air?">
            <p>{air.explanation}</p>
            <ol>
              {air.actions.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </Panel>
        </div>
      )}
      {tab === "Guidance & triage" && (
        <div role="tabpanel" aria-label="Guidance and triage">
          <Panel title="Guidance & triage - NASA’s five hazards">
            <div className="hazard-list">
              {SPACEFLIGHT_HAZARDS.map((h) => (
                <details key={h.name}>
                  <summary>{h.name}</summary>
                  <p>{h.summary}</p>
                  <h3>What to watch</h3>
                  <ul>
                    {h.keyFacts.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                  <h3>Countermeasures</h3>
                  <ul>
                    {h.countermeasures.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          </Panel>
          <Panel title="Symptom triage">
            <p>
              Decision support, not diagnosis. If there is an immediate
              emergency, use SOS and notify the crew directly.
            </p>
            <div className="triage-start">
              <label>
                Symptom
                <select
                  value={symptom}
                  onChange={(e) => {
                    setSymptom(e.target.value as TriageSymptom);
                    setNode(null);
                  }}
                >
                  {listTriageSymptoms().map((s) => (
                    <option key={s.symptom} value={s.symptom}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <Button onClick={() => setNode(startTriage(symptom))}>
                Start triage
              </Button>
            </div>
            {node?.kind === "question" && (
              <section className="triage-step">
                <h3>{node.question}</h3>
                <div>
                  <Button
                    variant="outline"
                    onClick={() =>
                      setNode(answerTriage(symptom, node.id, true))
                    }
                  >
                    Yes
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      setNode(answerTriage(symptom, node.id, false))
                    }
                  >
                    No
                  </Button>
                </div>
              </section>
            )}
            {outcome && (
              <section className="triage-outcome">
                <Status status={outcome.status} />
                <h3>{outcome.title}</h3>
                <ol>
                  {outcome.steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
                <p>{outcome.escalationText}</p>
                <Button variant="ghost" onClick={() => setNode(null)}>
                  <ArrowLeft data-icon="inline-start" />
                  Start again
                </Button>
              </section>
            )}
          </Panel>
          <Panel title="Physical examination guidance">
            <p>
              Follow the approved onboard protocol. Your check-in draft stays
              available while you read.
            </p>
            <ExamGuidance focusGuide={focusGuide} onCheckin={onCheckin} />
          </Panel>
          <Panel title="Guided procedures">
            {listProcedures().map((p) => (
              <details key={p.id} className="procedure">
                <summary>{p.title}</summary>
                <ol>
                  {p.steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
                <ul>
                  {p.tips.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
                <Button variant="outline" onClick={onCheckin}>
                  <ArrowLeft data-icon="inline-start" />
                  Back to Check-in
                </Button>
              </details>
            ))}
          </Panel>
          <Panel title="Onboard medications">
            <div className="medication-list">
              {getMedicationList().map((m) => (
                <div key={m.id}>
                  <h3>{m.name}</h3>
                  <Status status={m.status} />
                  <p>
                    {m.use} · {m.qtyLeft} {m.unit}
                  </p>
                  <p>{m.statusText}</p>
                  {m.spaceNote && <small>{m.spaceNote}</small>}
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}
      {tab === "References" && (
        <div role="tabpanel" aria-label="References">
          <Panel title="References & clinical sources">
            <p>
              The application uses the repository’s reconciled health rules. It
              provides decision support and needs clinical validation before
              real-world use.
            </p>
            <h3>Real NASA data used in the app</h3>
            <ul className="reference-links">
              {NASA_DATA_CREDITS.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noreferrer">
                    {s.label}
                    <ArrowUpRight size={16} />
                  </a>
                </li>
              ))}
            </ul>
            <p className="fine-print">
              Astronaut vitals and cabin air are simulated: daily crew medical
              data is not public. Radiation on the ISS replays real RadLab
              measurements (absorbed dose × quality factor 2 ≈ dose equivalent);
              solar storms are based on real DONKI events with modelled doses.
            </p>
            <h3>References</h3>
            <ul className="reference-links">
              {Object.values(SOURCES).map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noreferrer">
                    {s.label}
                    <ArrowUpRight size={16} />
                  </a>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}
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
    </>
  );
}

/** Says where the radiation number comes from (real RadLab replay or simulated). */
function RadiationSourceNote({ sample }: { sample?: RadiationSample }) {
  if (!sample) return null;
  if (sample.source !== "radlab")
    return (
      <small className="radiation-source">Simulated for this location</small>
    );
  const when = sample.measuredAtUtc?.replace("T", " ").replace("Z", " UTC");
  const saa = (sample.absorbedUGyPerH ?? 0) > SAA_THRESHOLD_UGY_PER_H;
  return (
    <small className="radiation-source">
      Real ISS measurement · NASA OSDR RadLab, {sample.instrument},{" "}
      {sample.absorbedUGyPerH} µGy/h at {when}
      {saa ? " · South Atlantic Anomaly pass" : ""}
    </small>
  );
}
