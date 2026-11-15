/**
 * QA dataset: one realistic (fictional) astronaut whose mission log walks
 * every limit in health_rules.md - just inside, exactly on, and just outside
 * each boundary - in the mission phase where that rule applies.
 *
 * EXPECTED values come from health_rules.md (the team's single source of
 * truth), NOT from the code, so a mismatch means doc and code disagree.
 *
 * Astronaut: Cdr. Lena Ortiz (fictional), Mars conjunction-class mission.
 *   Launch 2027-03-01. Earth orbit days 0-3, deep space (0 g) 3-183,
 *   Mars orbit 183-186, Mars surface (0.38 g, 8.2 psia habitat) 186-686,
 *   flight home 686-866.
 */

export type Expected = "nominal" | "caution" | "critical" | "no_data";

export const QA_ASTRONAUT = {
  id: "qa_lena_ortiz",
  name: "Cdr. Lena Ortiz (QA, fictional)",
  agency: "NASA",
  destination: "MARS" as const,
  launchDate: "2027-03-01",
  preflightMassKg: 64,
  /** Career dose before this mission, mSv (one earlier ISS expedition). */
  priorCareerDoseMSv: 120,
  /** Earth-mode baseline from pre-flight training (mean, sd, n). */
  baseline: {
    heart_rate: { mean: 60, sd: 4, n: 14 },
    blood_sugar: { mean: 85, sd: 4, n: 6 },
    spo2: { mean: 98, sd: 0.8, n: 14 },
  },
  reactionBaselineMs: 300,
};

/** Vital-sign check-ins: evaluated with the real mission state for `day`. */
export interface VitalsCase {
  id: string;
  day: number;
  /** What happened, in plain words (what a crew log would say). */
  scenario: string;
  rule: string;
  input: {
    heartRateBpm?: number;
    systolicMmHg?: number;
    diastolicMmHg?: number;
    bodyTempC?: number;
    spo2Pct?: number;
    sleepHours?: number;
    sleepRecentNights?: number[];
    mood?: number;
    moodRecentDays?: number[];
    bloodSugarMgDl?: number;
    fasting?: boolean;
    radiationDailyMSv?: number;
    radiationMissionMSv?: number;
    boneDensityChangePct?: number;
  };
  /** Use the astronaut's personal baseline for this check-in. */
  useBaseline?: boolean;
  expect: Partial<
    Record<
      | "heart_rate"
      | "blood_pressure"
      | "body_temp"
      | "spo2"
      | "sleep_hours"
      | "mood"
      | "blood_sugar"
      | "radiation_dose"
      | "bone_density",
      Expected
    >
  >;
}

const PRE = -10; // pre-flight training, Earth limits
const ORBIT = 1; // leaving Earth (0 g, short delay)
const TRANSIT = 40; // deep space, before day 60 in 0 g
const TRANSIT_LATE = 120; // deep space, > 60 days continuous 0 g
const LANDED = 190; // Mars surface, inside the post-landing window
const MARS = 300; // Mars surface habitat, well after landing

export const VITALS_CASES: VitalsCase[] = [
  // ── Resting heart rate: Normal 50-100, Watch 40-49 / 101-120, Alert < 40 / > 120
  { id: "HR-01", day: PRE, scenario: "Very fit athlete's resting pulse", rule: "HR Alert < 40", input: { heartRateBpm: 39 }, expect: { heart_rate: "critical" } },
  { id: "HR-02", day: PRE, scenario: "Low resting pulse", rule: "HR Watch 40-49", input: { heartRateBpm: 40 }, expect: { heart_rate: "caution" } },
  { id: "HR-03", day: PRE, scenario: "Low resting pulse", rule: "HR Watch 40-49", input: { heartRateBpm: 49 }, expect: { heart_rate: "caution" } },
  { id: "HR-04", day: PRE, scenario: "Normal resting pulse", rule: "HR Normal 50-100", input: { heartRateBpm: 50 }, expect: { heart_rate: "nominal" } },
  { id: "HR-05", day: PRE, scenario: "Normal resting pulse", rule: "HR Normal 50-100", input: { heartRateBpm: 100 }, expect: { heart_rate: "nominal" } },
  { id: "HR-06", day: PRE, scenario: "Pulse up after a stressful sim", rule: "HR Watch 101-120", input: { heartRateBpm: 101 }, expect: { heart_rate: "caution" } },
  { id: "HR-07", day: PRE, scenario: "Pulse up after a stressful sim", rule: "HR Watch 101-120", input: { heartRateBpm: 120 }, expect: { heart_rate: "caution" } },
  { id: "HR-08", day: PRE, scenario: "Resting pulse very fast", rule: "HR Alert > 120", input: { heartRateBpm: 121 }, expect: { heart_rate: "critical" } },
  { id: "HR-09", day: TRANSIT, scenario: "Pulse 15% above her 60 bpm baseline", rule: "HR Watch ≥ 15% from baseline", input: { heartRateBpm: 69 }, useBaseline: true, expect: { heart_rate: "caution" } },
  { id: "HR-10", day: TRANSIT, scenario: "Pulse 13% above baseline", rule: "HR < 15% from baseline stays Normal", input: { heartRateBpm: 68 }, useBaseline: true, expect: { heart_rate: "nominal" } },
  { id: "HR-11", day: TRANSIT, scenario: "Pulse 15% below baseline", rule: "HR Watch ≥ 15% from baseline", input: { heartRateBpm: 51 }, useBaseline: true, expect: { heart_rate: "caution" } },

  // ── Blood pressure on Earth: systolic Normal 90-129, Watch 130-159 / 80-89, Alert ≥ 160 / < 80
  { id: "BP-01", day: PRE, scenario: "Systolic very low", rule: "BP Alert systolic < 80", input: { systolicMmHg: 79, diastolicMmHg: 65 }, expect: { blood_pressure: "critical" } },
  { id: "BP-02", day: PRE, scenario: "Systolic low", rule: "BP Watch systolic 80-89", input: { systolicMmHg: 80, diastolicMmHg: 65 }, expect: { blood_pressure: "caution" } },
  { id: "BP-03", day: PRE, scenario: "Systolic low", rule: "BP Watch systolic 80-89", input: { systolicMmHg: 89, diastolicMmHg: 65 }, expect: { blood_pressure: "caution" } },
  { id: "BP-04", day: PRE, scenario: "Normal blood pressure", rule: "BP Normal 90-129 / 60-84", input: { systolicMmHg: 90, diastolicMmHg: 60 }, expect: { blood_pressure: "nominal" } },
  { id: "BP-05", day: PRE, scenario: "Normal blood pressure", rule: "BP Normal 90-129 / 60-84", input: { systolicMmHg: 129, diastolicMmHg: 84 }, expect: { blood_pressure: "nominal" } },
  { id: "BP-06", day: PRE, scenario: "Systolic raised", rule: "BP Watch systolic 130-159", input: { systolicMmHg: 130, diastolicMmHg: 80 }, expect: { blood_pressure: "caution" } },
  { id: "BP-07", day: PRE, scenario: "Systolic raised", rule: "BP Watch systolic 130-159", input: { systolicMmHg: 159, diastolicMmHg: 80 }, expect: { blood_pressure: "caution" } },
  { id: "BP-08", day: PRE, scenario: "Systolic high", rule: "BP Alert systolic ≥ 160", input: { systolicMmHg: 160, diastolicMmHg: 80 }, expect: { blood_pressure: "critical" } },
  { id: "BP-09", day: PRE, scenario: "Diastolic low", rule: "BP Watch diastolic < 60 (Earth)", input: { systolicMmHg: 110, diastolicMmHg: 59 }, expect: { blood_pressure: "caution" } },
  { id: "BP-10", day: PRE, scenario: "Diastolic raised", rule: "BP Watch diastolic 85-99", input: { systolicMmHg: 120, diastolicMmHg: 85 }, expect: { blood_pressure: "caution" } },
  { id: "BP-11", day: PRE, scenario: "Diastolic raised", rule: "BP Watch diastolic 85-99", input: { systolicMmHg: 120, diastolicMmHg: 99 }, expect: { blood_pressure: "caution" } },
  { id: "BP-12", day: PRE, scenario: "Diastolic high", rule: "BP Alert diastolic ≥ 100", input: { systolicMmHg: 120, diastolicMmHg: 100 }, expect: { blood_pressure: "critical" } },
  // In flight (0 g): systolic 82-89 counts as Normal; diastolic Watch only < 55; Alert limits unchanged.
  { id: "BP-13", day: TRANSIT, scenario: "Expected in-flight BP drop", rule: "BP in flight: systolic 82 Normal", input: { systolicMmHg: 82, diastolicMmHg: 60 }, expect: { blood_pressure: "nominal" } },
  { id: "BP-14", day: TRANSIT, scenario: "In-flight BP a bit lower", rule: "BP in flight: systolic 81 Watch", input: { systolicMmHg: 81, diastolicMmHg: 60 }, expect: { blood_pressure: "caution" } },
  { id: "BP-15", day: TRANSIT, scenario: "In-flight BP too low", rule: "BP in flight: Alert < 80 unchanged", input: { systolicMmHg: 79, diastolicMmHg: 60 }, expect: { blood_pressure: "critical" } },
  { id: "BP-16", day: TRANSIT, scenario: "In-flight diastolic drop", rule: "BP in flight: diastolic 55 Normal", input: { systolicMmHg: 110, diastolicMmHg: 55 }, expect: { blood_pressure: "nominal" } },
  { id: "BP-17", day: TRANSIT, scenario: "In-flight diastolic too low", rule: "BP in flight: diastolic < 55 Watch", input: { systolicMmHg: 110, diastolicMmHg: 54 }, expect: { blood_pressure: "caution" } },
  { id: "BP-18", day: TRANSIT, scenario: "High BP in flight", rule: "BP in flight: high limits unchanged", input: { systolicMmHg: 130, diastolicMmHg: 80 }, expect: { blood_pressure: "caution" } },
  // Just landed on Mars after ~183 days in 0 g: Earth limits apply again for 14 days.
  { id: "BP-19", day: LANDED, scenario: "Dizzy after landing, low systolic", rule: "BP after landing: Earth limits (85 = Watch)", input: { systolicMmHg: 85, diastolicMmHg: 62 }, expect: { blood_pressure: "caution" } },

  // ── Body temperature: Normal 36.1-37.5, Watch 35.0-36.0 / 37.6-38.4, Alert ≥ 38.5 / < 35.0
  { id: "TEMP-01", day: PRE, scenario: "Cold after an EVA suit test", rule: "Temp Alert < 35.0", input: { bodyTempC: 34.9 }, expect: { body_temp: "critical" } },
  { id: "TEMP-02", day: PRE, scenario: "Cool", rule: "Temp Watch 35.0-36.0", input: { bodyTempC: 35.0 }, expect: { body_temp: "caution" } },
  { id: "TEMP-03", day: PRE, scenario: "Cool", rule: "Temp Watch 35.0-36.0", input: { bodyTempC: 36.0 }, expect: { body_temp: "caution" } },
  { id: "TEMP-04", day: PRE, scenario: "Normal temperature", rule: "Temp Normal 36.1-37.5", input: { bodyTempC: 36.1 }, expect: { body_temp: "nominal" } },
  { id: "TEMP-05", day: PRE, scenario: "Normal temperature", rule: "Temp Normal 36.1-37.5", input: { bodyTempC: 37.5 }, expect: { body_temp: "nominal" } },
  { id: "TEMP-06", day: PRE, scenario: "Slightly warm", rule: "Temp Watch 37.6-38.4", input: { bodyTempC: 37.6 }, expect: { body_temp: "caution" } },
  { id: "TEMP-07", day: PRE, scenario: "Low-grade fever", rule: "Temp Watch 37.6-38.4", input: { bodyTempC: 38.4 }, expect: { body_temp: "caution" } },
  { id: "TEMP-08", day: PRE, scenario: "Fever", rule: "Temp Alert ≥ 38.5", input: { bodyTempC: 38.5 }, expect: { body_temp: "critical" } },
  { id: "TEMP-09", day: TRANSIT, scenario: "Warm, day 40 in 0 g (no shift yet)", rule: "Temp: shift only after 60 days in 0 g", input: { bodyTempC: 37.7 }, expect: { body_temp: "caution" } },
  { id: "TEMP-10", day: TRANSIT_LATE, scenario: "Day 120 in 0 g, 'space fever' baseline", rule: "Temp after 60 d in 0 g: Normal up to 37.9", input: { bodyTempC: 37.9 }, expect: { body_temp: "nominal" } },
  { id: "TEMP-11", day: TRANSIT_LATE, scenario: "Day 120, warmer", rule: "Temp after 60 d in 0 g: Watch from 38.0", input: { bodyTempC: 38.0 }, expect: { body_temp: "caution" } },
  { id: "TEMP-12", day: TRANSIT_LATE, scenario: "Day 120, real fever", rule: "Temp after 60 d in 0 g: Alert still ≥ 38.5", input: { bodyTempC: 38.5 }, expect: { body_temp: "critical" } },

  // ── SpO2: Normal ≥ 95 (≥ 96 in 8.2 psia habitat), Watch 90-94 (90-95 habitat), Alert < 90
  { id: "SPO2-01", day: TRANSIT, scenario: "Normal oxygen", rule: "SpO2 Normal ≥ 95", input: { spo2Pct: 95 }, expect: { spo2: "nominal" } },
  { id: "SPO2-02", day: TRANSIT, scenario: "Slightly low oxygen", rule: "SpO2 Watch 90-94", input: { spo2Pct: 94 }, expect: { spo2: "caution" } },
  { id: "SPO2-03", day: TRANSIT, scenario: "Low oxygen", rule: "SpO2 Watch 90-94", input: { spo2Pct: 90 }, expect: { spo2: "caution" } },
  { id: "SPO2-04", day: TRANSIT, scenario: "Dangerously low oxygen", rule: "SpO2 Alert < 90", input: { spo2Pct: 89 }, expect: { spo2: "critical" } },
  { id: "SPO2-05", day: MARS, scenario: "Mars habitat (8.2 psia), normal", rule: "SpO2 habitat Normal ≥ 96", input: { spo2Pct: 96 }, expect: { spo2: "nominal" } },
  { id: "SPO2-06", day: MARS, scenario: "Mars habitat, 95%", rule: "SpO2 habitat Watch 90-95", input: { spo2Pct: 95 }, expect: { spo2: "caution" } },
  { id: "SPO2-07", day: MARS, scenario: "Mars habitat, very low", rule: "SpO2 habitat Alert < 90", input: { spo2Pct: 89 }, expect: { spo2: "critical" } },

  // ── Sleep: Normal ≥ 7; Watch 6-6.9 or one night < 6; Alert < 6 h for 3 nights in a row or any night < 4 h
  { id: "SLEEP-01", day: TRANSIT, scenario: "Good night", rule: "Sleep Normal ≥ 7 h", input: { sleepHours: 7, sleepRecentNights: [8, 7.5, 7] }, expect: { sleep_hours: "nominal" } },
  { id: "SLEEP-02", day: TRANSIT, scenario: "Slightly short night", rule: "Sleep Watch 6-6.9 h", input: { sleepHours: 6.9, sleepRecentNights: [8, 7.5, 6.9] }, expect: { sleep_hours: "caution" } },
  { id: "SLEEP-03", day: TRANSIT, scenario: "Short night", rule: "Sleep Watch 6-6.9 h", input: { sleepHours: 6, sleepRecentNights: [8, 7.5, 6] }, expect: { sleep_hours: "caution" } },
  { id: "SLEEP-04", day: TRANSIT, scenario: "One bad night (noisy fan)", rule: "Sleep: one night < 6 h = Watch", input: { sleepHours: 5.9, sleepRecentNights: [8, 7.5, 5.9] }, expect: { sleep_hours: "caution" } },
  { id: "SLEEP-05", day: TRANSIT, scenario: "Two short nights then one", rule: "Sleep: 2 short nights in a row = Watch", input: { sleepHours: 5.8, sleepRecentNights: [7.5, 5.5, 5.8] }, expect: { sleep_hours: "caution" } },
  { id: "SLEEP-06", day: TRANSIT, scenario: "Third night in a row under 6 h", rule: "Sleep Alert: < 6 h for 3 nights in a row", input: { sleepHours: 5.9, sleepRecentNights: [5.5, 5.8, 5.9] }, expect: { sleep_hours: "critical" } },
  { id: "SLEEP-07", day: TRANSIT, scenario: "Short nights broken by a good one", rule: "Sleep: streak must be consecutive", input: { sleepHours: 5.8, sleepRecentNights: [5.5, 7.2, 5.8] }, expect: { sleep_hours: "caution" } },
  { id: "SLEEP-08", day: TRANSIT, scenario: "Barely slept (alarm all night)", rule: "Sleep Alert: any night < 4 h", input: { sleepHours: 3.9, sleepRecentNights: [8, 8, 3.9] }, expect: { sleep_hours: "critical" } },
  { id: "SLEEP-09", day: TRANSIT, scenario: "Very short night", rule: "Sleep: 4.0 h is not < 4 → Watch", input: { sleepHours: 4, sleepRecentNights: [8, 8, 4] }, expect: { sleep_hours: "caution" } },
  { id: "SLEEP-10", day: TRANSIT, scenario: "Long recovery sleep", rule: "Sleep Normal 7-10 h", input: { sleepHours: 10, sleepRecentNights: [7, 7, 10] }, expect: { sleep_hours: "nominal" } },
  { id: "SLEEP-11", day: TRANSIT, scenario: "Slept 11 h, feeling unwell", rule: "Sleep Watch > 10 h", input: { sleepHours: 11, sleepRecentNights: [7, 7, 11] }, expect: { sleep_hours: "caution" } },

  // ── Mood (1-5): Normal 4-5; Watch 3 or one day at 1-2; Alert 1-2 for 3 days in a row
  { id: "MOOD-01", day: TRANSIT, scenario: "Feeling good", rule: "Mood Normal 4-5", input: { mood: 4, moodRecentDays: [4, 5, 4] }, expect: { mood: "nominal" } },
  { id: "MOOD-02", day: TRANSIT, scenario: "So-so day", rule: "Mood Watch 3", input: { mood: 3, moodRecentDays: [4, 4, 3] }, expect: { mood: "caution" } },
  { id: "MOOD-03", day: TRANSIT, scenario: "One bad day (missed family call)", rule: "Mood Watch: one day at 1-2", input: { mood: 2, moodRecentDays: [4, 4, 2] }, expect: { mood: "caution" } },
  { id: "MOOD-04", day: TRANSIT, scenario: "Two low days", rule: "Mood Watch: 2 low days", input: { mood: 1, moodRecentDays: [4, 2, 1] }, expect: { mood: "caution" } },
  { id: "MOOD-05", day: TRANSIT, scenario: "Third low day in a row", rule: "Mood Alert: 1-2 for 3 days in a row", input: { mood: 2, moodRecentDays: [2, 1, 2] }, expect: { mood: "critical" } },
  { id: "MOOD-06", day: TRANSIT, scenario: "Low days broken by a good one", rule: "Mood: streak must be consecutive", input: { mood: 1, moodRecentDays: [2, 4, 1] }, expect: { mood: "caution" } },

  // ── Glucose: fasting Normal 70-99, Watch 54-69 / 100-180, Alert < 54 / > 180; not fasting Normal 70-140
  { id: "GLU-01", day: PRE, scenario: "Hypoglycaemia", rule: "Glucose Alert < 54", input: { bloodSugarMgDl: 53, fasting: true }, expect: { blood_sugar: "critical" } },
  { id: "GLU-02", day: PRE, scenario: "Low sugar", rule: "Glucose Watch 54-69", input: { bloodSugarMgDl: 54, fasting: true }, expect: { blood_sugar: "caution" } },
  { id: "GLU-03", day: PRE, scenario: "Low sugar", rule: "Glucose Watch 54-69", input: { bloodSugarMgDl: 69, fasting: true }, expect: { blood_sugar: "caution" } },
  { id: "GLU-04", day: PRE, scenario: "Normal fasting", rule: "Glucose fasting Normal 70-99", input: { bloodSugarMgDl: 70, fasting: true }, expect: { blood_sugar: "nominal" } },
  { id: "GLU-05", day: PRE, scenario: "Normal fasting", rule: "Glucose fasting Normal 70-99", input: { bloodSugarMgDl: 99, fasting: true }, expect: { blood_sugar: "nominal" } },
  { id: "GLU-06", day: PRE, scenario: "Raised fasting", rule: "Glucose fasting Watch from 100", input: { bloodSugarMgDl: 100, fasting: true }, expect: { blood_sugar: "caution" } },
  { id: "GLU-07", day: PRE, scenario: "High fasting", rule: "Glucose Watch up to 180", input: { bloodSugarMgDl: 180, fasting: true }, expect: { blood_sugar: "caution" } },
  { id: "GLU-08", day: PRE, scenario: "Very high", rule: "Glucose Alert > 180", input: { bloodSugarMgDl: 181, fasting: true }, expect: { blood_sugar: "critical" } },
  { id: "GLU-09", day: PRE, scenario: "After a meal", rule: "Glucose not fasting Normal 70-140", input: { bloodSugarMgDl: 140, fasting: false }, expect: { blood_sugar: "nominal" } },
  { id: "GLU-10", day: PRE, scenario: "After a meal, high", rule: "Glucose not fasting Watch 141-180", input: { bloodSugarMgDl: 141, fasting: false }, expect: { blood_sugar: "caution" } },
  { id: "GLU-11", day: TRANSIT, scenario: "In range but unusual for her (baseline 85 ± 4)", rule: "Glucose Watch ≥ 3.5 SD from personal baseline", input: { bloodSugarMgDl: 106, fasting: false }, useBaseline: true, expect: { blood_sugar: "caution" } },

  // ── Radiation total (career incl. 120 mSv prior): Normal < 50% of 600, Watch 50-80%, Alert > 80%
  { id: "RAD-01", day: MARS, scenario: "Total just under half the career limit", rule: "Radiation Normal < 50%", input: { radiationMissionMSv: 179, radiationDailyMSv: 0.6 }, expect: { radiation_dose: "nominal" } },
  { id: "RAD-02", day: MARS, scenario: "Total reaches half the career limit", rule: "Radiation Watch 50-80%", input: { radiationMissionMSv: 180, radiationDailyMSv: 0.6 }, expect: { radiation_dose: "caution" } },
  { id: "RAD-03", day: MARS, scenario: "Total at 80% of the limit", rule: "Radiation Watch 50-80%", input: { radiationMissionMSv: 360, radiationDailyMSv: 0.6 }, expect: { radiation_dose: "caution" } },
  { id: "RAD-04", day: MARS, scenario: "Total over 80% of the limit", rule: "Radiation Alert > 80%", input: { radiationMissionMSv: 361, radiationDailyMSv: 0.6 }, expect: { radiation_dose: "critical" } },
  // Radiation today (ISS orbit, normal ~0.35 mSv/day): Watch ≥ 2 mSv/day or > 2× normal, Alert ≥ 10
  { id: "RAD-05", day: ORBIT, scenario: "Normal day in orbit", rule: "Radiation today: ≤ 2× normal is Normal", input: { radiationMissionMSv: 1, radiationDailyMSv: 0.69 }, expect: { radiation_dose: "nominal" } },
  { id: "RAD-06", day: ORBIT, scenario: "Dose above twice normal", rule: "Radiation today: > 2× normal = Watch", input: { radiationMissionMSv: 1, radiationDailyMSv: 0.71 }, expect: { radiation_dose: "caution" } },
  { id: "RAD-07", day: ORBIT, scenario: "Dose spike", rule: "Radiation today: ≥ 2 mSv/day = Watch", input: { radiationMissionMSv: 2, radiationDailyMSv: 2 }, expect: { radiation_dose: "caution" } },
  { id: "RAD-08", day: ORBIT, scenario: "Large spike, just below storm level", rule: "Radiation today: < 10 is not Alert", input: { radiationMissionMSv: 10, radiationDailyMSv: 9.9 }, expect: { radiation_dose: "caution" } },
  { id: "RAD-09", day: ORBIT, scenario: "Solar particle event dose", rule: "Radiation today: ≥ 10 mSv/day = Alert", input: { radiationMissionMSv: 10, radiationDailyMSv: 10 }, expect: { radiation_dose: "critical" } },

  // ── Bone density change: Normal > −5%, Watch −5% to −10%, Alert ≤ −10%
  { id: "BONE-01", day: MARS, scenario: "Expected bone loss", rule: "Bone Normal > −5%", input: { boneDensityChangePct: -4.9 }, expect: { bone_density: "nominal" } },
  { id: "BONE-02", day: MARS, scenario: "Bone loss reaches −5%", rule: "Bone Watch −5% to −10%", input: { boneDensityChangePct: -5 }, expect: { bone_density: "caution" } },
  { id: "BONE-03", day: MARS, scenario: "Bone loss −9.9%", rule: "Bone Watch −5% to −10%", input: { boneDensityChangePct: -9.9 }, expect: { bone_density: "caution" } },
  { id: "BONE-04", day: MARS, scenario: "Bone loss −10%", rule: "Bone Alert ≤ −10%", input: { boneDensityChangePct: -10 }, expect: { bone_density: "critical" } },
];

/** Cabin readings (NASA-STD-3001). Fields not under test are kept normal. */
export interface CabinCase {
  id: string;
  scenario: string;
  rule: string;
  reading: { co2MmHg?: number; tempC?: number; humidityPct?: number; cabinPsia?: number; o2Pct?: number };
  param: "co2_mmhg" | "temp_c" | "humidity_pct" | "cabin_psia" | "ppo2_mmhg";
  expect: Expected;
}

export const CABIN_CASES: CabinCase[] = [
  { id: "CAB-01", scenario: "CO2 normal", rule: "CO2 Normal < 2.5", reading: { co2MmHg: 2.4 }, param: "co2_mmhg", expect: "nominal" },
  { id: "CAB-02", scenario: "CO2 at long-term target", rule: "CO2 Watch 2.5-3.0", reading: { co2MmHg: 2.5 }, param: "co2_mmhg", expect: "caution" },
  { id: "CAB-03", scenario: "CO2 at 1-hour limit", rule: "CO2 Watch 2.5-3.0", reading: { co2MmHg: 3.0 }, param: "co2_mmhg", expect: "caution" },
  { id: "CAB-04", scenario: "CO2 over the 1-hour limit", rule: "CO2 Alert > 3.0", reading: { co2MmHg: 3.01 }, param: "co2_mmhg", expect: "critical" },
  { id: "CAB-05", scenario: "Cabin cool, in band", rule: "Temp Normal 18-27", reading: { tempC: 18 }, param: "temp_c", expect: "nominal" },
  { id: "CAB-06", scenario: "Cabin slightly cold", rule: "Temp Watch: outside by ≤ 2", reading: { tempC: 16 }, param: "temp_c", expect: "caution" },
  { id: "CAB-07", scenario: "Cabin cold", rule: "Temp Alert: outside by > 2", reading: { tempC: 15.9 }, param: "temp_c", expect: "critical" },
  { id: "CAB-08", scenario: "Cabin warm, in band", rule: "Temp Normal 18-27", reading: { tempC: 27 }, param: "temp_c", expect: "nominal" },
  { id: "CAB-09", scenario: "Cabin slightly hot", rule: "Temp Watch: outside by ≤ 2", reading: { tempC: 29 }, param: "temp_c", expect: "caution" },
  { id: "CAB-10", scenario: "Cabin hot", rule: "Temp Alert: outside by > 2", reading: { tempC: 29.1 }, param: "temp_c", expect: "critical" },
  { id: "CAB-11", scenario: "Dry air, in band", rule: "Humidity Normal 25-75", reading: { humidityPct: 25 }, param: "humidity_pct", expect: "nominal" },
  { id: "CAB-12", scenario: "Air too dry", rule: "Humidity Watch: outside by ≤ 10", reading: { humidityPct: 15 }, param: "humidity_pct", expect: "caution" },
  { id: "CAB-13", scenario: "Air very dry", rule: "Humidity Alert: outside by > 10", reading: { humidityPct: 14 }, param: "humidity_pct", expect: "critical" },
  { id: "CAB-14", scenario: "Humid, in band", rule: "Humidity Normal 25-75", reading: { humidityPct: 75 }, param: "humidity_pct", expect: "nominal" },
  { id: "CAB-15", scenario: "Air too humid", rule: "Humidity Watch: outside by ≤ 10", reading: { humidityPct: 85 }, param: "humidity_pct", expect: "caution" },
  { id: "CAB-16", scenario: "Air very humid", rule: "Humidity Alert: outside by > 10", reading: { humidityPct: 86 }, param: "humidity_pct", expect: "critical" },
  { id: "CAB-17", scenario: "Sea-level cabin pressure", rule: "Pressure Normal 5-15 psia", reading: { cabinPsia: 14.7 }, param: "cabin_psia", expect: "nominal" },
  { id: "CAB-18", scenario: "Pressure leak", rule: "Pressure Alert outside 5-15", reading: { cabinPsia: 4.9 }, param: "cabin_psia", expect: "critical" },
  { id: "CAB-19", scenario: "Over-pressure", rule: "Pressure Alert outside 5-15", reading: { cabinPsia: 15.1 }, param: "cabin_psia", expect: "critical" },
  { id: "CAB-20", scenario: "ISS air (14.7 psia, 21% O2)", rule: "Inspired O2 Normal ≥ 135 mmHg", reading: { cabinPsia: 14.7, o2Pct: 21 }, param: "ppo2_mmhg", expect: "nominal" },
  { id: "CAB-21", scenario: "Mars habitat air (8.2 psia, 34% O2)", rule: "Inspired O2 Watch 127-134 (normal for habitat)", reading: { cabinPsia: 8.2, o2Pct: 34 }, param: "ppo2_mmhg", expect: "caution" },
  { id: "CAB-22", scenario: "Habitat O2 drops (8.2 psia, 30% O2)", rule: "Inspired O2 Alert < 127", reading: { cabinPsia: 8.2, o2Pct: 30 }, param: "ppo2_mmhg", expect: "critical" },
];

/** SOS: life-threatening single vitals, red-flag words, or ≥ 2 vitals at Alert at once. */
export interface SosCase {
  id: string;
  scenario: string;
  rule: string;
  vitals: VitalsCase["input"];
  text?: string;
  expectSos: boolean;
}

export const SOS_CASES: SosCase[] = [
  { id: "SOS-01", scenario: "SpO2 84%", rule: "SOS: SpO2 < 85", vitals: { spo2Pct: 84 }, expectSos: true },
  { id: "SOS-02", scenario: "SpO2 85%", rule: "SOS: 85 is not < 85", vitals: { spo2Pct: 85 }, expectSos: false },
  { id: "SOS-03", scenario: "Resting HR 151", rule: "SOS: HR > 150", vitals: { heartRateBpm: 151 }, expectSos: true },
  { id: "SOS-04", scenario: "Resting HR 150", rule: "SOS: 150 is not > 150", vitals: { heartRateBpm: 150 }, expectSos: false },
  { id: "SOS-05", scenario: "Resting HR 34", rule: "SOS: HR < 35", vitals: { heartRateBpm: 34 }, expectSos: true },
  { id: "SOS-06", scenario: "Temperature 40.0", rule: "SOS: temp ≥ 40", vitals: { bodyTempC: 40 }, expectSos: true },
  { id: "SOS-07", scenario: "Temperature 39.9", rule: "SOS: 39.9 is single Alert, not SOS", vitals: { bodyTempC: 39.9 }, expectSos: false },
  { id: "SOS-08", scenario: "BP 180/90", rule: "SOS: systolic ≥ 180", vitals: { systolicMmHg: 180, diastolicMmHg: 90 }, expectSos: true },
  { id: "SOS-09", scenario: "BP 150/120", rule: "SOS: diastolic ≥ 120", vitals: { systolicMmHg: 150, diastolicMmHg: 120 }, expectSos: true },
  { id: "SOS-10", scenario: "BP 79/50", rule: "SOS: systolic < 80", vitals: { systolicMmHg: 79, diastolicMmHg: 50 }, expectSos: true },
  { id: "SOS-11", scenario: "Glucose 53", rule: "SOS: glucose < 54", vitals: { bloodSugarMgDl: 53, fasting: true }, expectSos: true },
  { id: "SOS-12", scenario: "Glucose 301", rule: "SOS: glucose > 300", vitals: { bloodSugarMgDl: 301, fasting: false }, expectSos: true },
  { id: "SOS-13", scenario: "Glucose 300", rule: "SOS: 300 is single Alert, not SOS", vitals: { bloodSugarMgDl: 300, fasting: false }, expectSos: false },
  { id: "SOS-14", scenario: "Fever plus fast pulse", rule: "SOS: ≥ 2 vitals at Alert at once", vitals: { heartRateBpm: 125, bodyTempC: 38.6 }, expectSos: true },
  { id: "SOS-15", scenario: "Chest pain in the check-in note", rule: "SOS: red-flag words", vitals: { heartRateBpm: 80 }, text: "Feeling chest pain since breakfast", expectSos: true },
  { id: "SOS-16", scenario: "Self-harm thoughts in the note", rule: "SOS: self-harm is always immediate", vitals: { mood: 2 }, text: "I keep thinking I want to hurt myself", expectSos: true },
  { id: "SOS-17", scenario: "Ordinary tired note", rule: "No SOS without red flags", vitals: { heartRateBpm: 72 }, text: "Tired after a long EVA prep day", expectSos: false },
];

/** Escalation by Earth signal delay. */
export const ESCALATION_CASES = [
  { id: "ESC-01", day: ORBIT, scenario: "Leaving Earth orbit", expect: "contact_ground" },
  { id: "ESC-02", day: TRANSIT, scenario: "Flying to Mars", expect: "act_then_report" },
  { id: "ESC-03", day: MARS, scenario: "Living on Mars", expect: "act_then_report" },
] as const;

/** Missing or stale data must be grey, never green. */
export const DISPLAY_CASES = [
  { id: "DATA-01", scenario: "Fresh normal reading", indicator: { status: "nominal", dataState: "fresh", value: 72 }, expect: "nominal" },
  { id: "DATA-02", scenario: "Overdue (stale) reading", indicator: { status: "nominal", dataState: "stale", value: 72 }, expect: "no_data" },
  { id: "DATA-03", scenario: "Never measured", indicator: { status: "nominal", dataState: "missing", value: null }, expect: "no_data" },
  { id: "DATA-04", scenario: "Fresh but empty value", indicator: { status: "nominal", dataState: "fresh", value: null }, expect: "no_data" },
] as const;

/** Phase 3 rules: body mass (preflight 64 kg) and reaction test (baseline 300 ms). */
export const BODY_MASS_CASES = [
  { id: "MASS-01", kg: 62.2, scenario: "Lost 2.8%", rule: "Mass Normal within 3%", expect: "nominal" },
  { id: "MASS-02", kg: 62.08, scenario: "Lost 3.0%", rule: "Mass Watch 3-5% loss", expect: "caution" },
  { id: "MASS-03", kg: 60.8, scenario: "Lost 5.0%", rule: "Mass Watch 3-5% loss", expect: "caution" },
  { id: "MASS-04", kg: 60.7, scenario: "Lost 5.2%", rule: "Mass Alert > 5% loss", expect: "critical" },
] as const;

export const REACTION_CASES = [
  { id: "REACT-01", ms: 330, scenario: "10% slower", rule: "Reaction Normal within 10%", expect: "nominal" },
  { id: "REACT-02", ms: 331, scenario: "Just over 10% slower", rule: "Reaction Watch 10-20% slower", expect: "caution" },
  { id: "REACT-03", ms: 360, scenario: "20% slower", rule: "Reaction Watch 10-20% slower", expect: "caution" },
  { id: "REACT-04", ms: 361, scenario: "Just over 20% slower", rule: "Reaction Alert > 20% slower", expect: "critical" },
] as const;
