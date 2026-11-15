/**
 * QA: run the QA astronaut's dataset through the app's real rule code and
 * compare with health_rules.md. Writes qa/QA_REPORT.md with every result.
 * Run: npm run qa
 */
import { afterAll, describe, expect, test } from "vitest";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  displayStatus,
  evaluateVitals,
} from "@/services/healthEvaluator";
import { getMissionState } from "@/services/missionTimeline";
import { evaluateCabin } from "@/services/environmentFeed";
import { assessEmergency } from "@/services/emergencyService";
import { evaluateBodyMass } from "@/services/exerciseService";
import { evaluateReaction } from "@/services/wellbeingService";
import { buildMissionPlan } from "@/data/nasaSpaceflightData";
import type {
  AstronautProfile,
  CabinReading,
  HealthIndicator,
  PersonalBaseline,
} from "@/types/astronaut";
import {
  BODY_MASS_CASES,
  CABIN_CASES,
  DISPLAY_CASES,
  ESCALATION_CASES,
  QA_ASTRONAUT,
  REACTION_CASES,
  SOS_CASES,
  VITALS_CASES,
} from "./astronaut-qa-dataset";

const plan = buildMissionPlan(
  QA_ASTRONAUT.id,
  QA_ASTRONAUT.destination,
  QA_ASTRONAUT.launchDate,
);
const baseline: PersonalBaseline = {
  astronautId: QA_ASTRONAUT.id,
  source: "earth_mode",
  values: QA_ASTRONAUT.baseline,
} as unknown as PersonalBaseline;

interface Row {
  section: string;
  id: string;
  scenario: string;
  rule: string;
  where: string;
  input: string;
  expected: string;
  actual: string;
  pass: boolean;
  note?: string;
}
const rows: Row[] = [];
const fmt = (o: object) =>
  Object.entries(o)
    .map(([k, v]) => `${k}=${Array.isArray(v) ? `[${v.join(", ")}]` : v}`)
    .join(" ");

function vitalsReport(day: number, input: object, useBaseline = false) {
  const state = getMissionState(plan, day);
  const report = evaluateVitals(input, state.environment.id, {
    missionState: state,
    baseline: useBaseline ? baseline : undefined,
    priorCareerDoseMSv: QA_ASTRONAUT.priorCareerDoseMSv,
  });
  return { state, report };
}

describe("Vital signs, patterns, baselines and space adjustments", () => {
  for (const c of VITALS_CASES)
    test(`${c.id} ${c.rule}`, () => {
      const { state, report } = vitalsReport(c.day, c.input, c.useBaseline);
      for (const [id, want] of Object.entries(c.expect)) {
        const got = report.indicators.find((e) => e.id === id);
        const actual = got?.status ?? "missing";
        rows.push({
          section: "Vitals",
          id: c.id,
          scenario: c.scenario,
          rule: c.rule,
          where: `Day ${c.day} · ${state.environment.label}`,
          input: fmt(c.input),
          expected: want,
          actual,
          pass: actual === want,
          note: got?.message,
        });
        expect(actual, `${c.id}: ${got?.message ?? ""}`).toBe(want);
      }
    });
});

describe("Cabin (NASA-STD-3001)", () => {
  const base: CabinReading = {
    timestamp: "QA",
    day: 0,
    module: "QA",
    co2MmHg: 2.0,
    tempC: 22,
    humidityPct: 45,
    cabinPsia: 14.7,
    o2Pct: 21,
    noiseDb: 55,
    lightPhase: "day",
  } as CabinReading;
  for (const c of CABIN_CASES)
    test(`${c.id} ${c.rule}`, () => {
      const ev = evaluateCabin({ ...base, ...c.reading });
      const p = ev.params.find((x) => x.param === c.param);
      const actual = p?.status ?? "missing";
      rows.push({
        section: "Cabin",
        id: c.id,
        scenario: c.scenario,
        rule: c.rule,
        where: "Cabin",
        input: fmt(c.reading),
        expected: c.expect,
        actual,
        pass: actual === c.expect,
        note: p?.message,
      });
      expect(actual, p?.message).toBe(c.expect);
    });
});

describe("SOS triggers", () => {
  for (const c of SOS_CASES)
    test(`${c.id} ${c.rule}`, () => {
      const { report } = vitalsReport(-10, c.vitals);
      const indicators = report.indicators.map((e) => ({
        id: e.id,
        value: e.value,
        status: e.status,
        dataState: "fresh",
      })) as unknown as HealthIndicator[];
      const a = assessEmergency({
        profile: { id: QA_ASTRONAUT.id, indicators } as unknown as AstronautProfile,
        report,
        text: c.text,
      });
      rows.push({
        section: "SOS",
        id: c.id,
        scenario: c.scenario,
        rule: c.rule,
        where: "Any",
        input: fmt(c.vitals) + (c.text ? ` note="${c.text}"` : ""),
        expected: c.expectSos ? "SOS" : "no SOS",
        actual: a.sos ? "SOS" : "no SOS",
        pass: a.sos === c.expectSos,
        note: a.reasons.join(" "),
      });
      expect(a.sos, a.reasons.join(" ")).toBe(c.expectSos);
    });
});

describe("Escalation by Earth delay", () => {
  for (const c of ESCALATION_CASES)
    test(`${c.id} ${c.scenario}`, () => {
      const state = getMissionState(plan, c.day);
      rows.push({
        section: "Escalation",
        id: c.id,
        scenario: c.scenario,
        rule: "Short delay → contact flight surgeon; long → act, then report",
        where: `Day ${c.day} · ${state.environment.label}`,
        input: `delay ${state.earthDelaySeconds} s`,
        expected: c.expect,
        actual: state.escalationMode,
        pass: state.escalationMode === c.expect,
      });
      expect(state.escalationMode).toBe(c.expect);
    });
});

describe("Missing data is never green", () => {
  for (const c of DISPLAY_CASES)
    test(`${c.id} ${c.scenario}`, () => {
      const actual = displayStatus(
        c.indicator as unknown as Pick<HealthIndicator, "status" | "dataState" | "value">,
      );
      rows.push({
        section: "Missing data",
        id: c.id,
        scenario: c.scenario,
        rule: "No fresh reading → grey (No data)",
        where: "Any",
        input: fmt(c.indicator),
        expected: c.expect,
        actual,
        pass: actual === c.expect,
      });
      expect(actual).toBe(c.expect);
    });
});

describe("Body mass and reaction test", () => {
  for (const c of BODY_MASS_CASES)
    test(`${c.id} ${c.rule}`, () => {
      const r = evaluateBodyMass(QA_ASTRONAUT.preflightMassKg, c.kg);
      rows.push({
        section: "Body mass",
        id: c.id,
        scenario: c.scenario,
        rule: c.rule,
        where: "Weekly",
        input: `kg=${c.kg} (preflight ${QA_ASTRONAUT.preflightMassKg})`,
        expected: c.expect,
        actual: r.status,
        pass: r.status === c.expect,
        note: r.message,
      });
      expect(r.status, r.message).toBe(c.expect);
    });
  for (const c of REACTION_CASES)
    test(`${c.id} ${c.rule}`, () => {
      const r = evaluateReaction(c.ms, QA_ASTRONAUT.reactionBaselineMs);
      rows.push({
        section: "Reaction test",
        id: c.id,
        scenario: c.scenario,
        rule: c.rule,
        where: "Weekly",
        input: `ms=${c.ms} (baseline ${QA_ASTRONAUT.reactionBaselineMs})`,
        expected: c.expect,
        actual: r.status,
        pass: r.status === c.expect,
        note: r.message,
      });
      expect(r.status, r.message).toBe(c.expect);
    });
});

afterAll(() => {
  const failed = rows.filter((r) => !r.pass);
  const esc = (s: string) => s.replace(/\|/g, "\\|");
  const lines = [
    "# QA report: health rules",
    "",
    `QA astronaut: ${QA_ASTRONAUT.name} (Mars mission, launch ${QA_ASTRONAUT.launchDate}).`,
    "Expected results come from `health_rules.md`; actual results from the app's rule code.",
    "Generated by `npm run qa` (`qa/health-rules.qa.test.ts`).",
    "",
    `**${rows.length - failed.length} of ${rows.length} checks pass. ${failed.length} differ from health_rules.md.**`,
    "",
  ];
  if (failed.length) {
    lines.push("## Differences from health_rules.md", "", "| ID | Rule | Where | Input | Expected | App gives | App's message |", "|---|---|---|---|---|---|---|");
    for (const r of failed)
      lines.push(`| ${r.id} | ${esc(r.rule)} | ${esc(r.where)} | ${esc(r.input)} | ${r.expected} | **${r.actual}** | ${esc(r.note ?? "")} |`);
    lines.push("");
  }
  lines.push("## All checks", "", "| ID | Section | Scenario | Rule | Where | Input | Expected | Actual | Result |", "|---|---|---|---|---|---|---|---|---|");
  for (const r of rows)
    lines.push(`| ${r.id} | ${r.section} | ${esc(r.scenario)} | ${esc(r.rule)} | ${esc(r.where)} | ${esc(r.input)} | ${r.expected} | ${r.actual} | ${r.pass ? "✅" : "❌"} |`);
  writeFileSync(join(import.meta.dirname, "QA_REPORT.md"), lines.join("\n") + "\n");
});
