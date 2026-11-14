/**
 * NASA HRP + Canadian Space Agency reference data for the Space Medic HUD.
 *
 * Sources fetched 2026-11-14 (see CHALLENGE_BRIEF.md):
 *  - NASA 5 Hazards of Human Spaceflight      https://www.nasa.gov/hrp/hazards/
 *  - NASA Risks of Human Spaceflight          https://www.nasa.gov/hrp/risks/
 *  - NASA Ongoing HRP Research                https://www.nasa.gov/hrp/ongoing-hrp-research/
 *  - CSA Monitoring Radiation for Astronauts  https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp
 *  - CSA Why Science in Space                 https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp
 *
 * Those pages are largely qualitative. Numeric thresholds that they do not
 * state (career radiation limit, dose rates, bone-loss rates, clinical vital
 * ranges) come from NASA-STD-3001 and peer-reviewed / clinical literature and
 * are tagged with `sources` so the UI can show provenance. Crew profiles are
 * fictional demo personas.
 */

import type {
  AstronautProfile,
  BodySystem,
  EnvironmentProfile,
  EnvironmentType,
  HazardName,
  HealthIndicator,
  HistoryPoint,
  IndicatorId,
  RoutineTask,
  SourceRef,
  SpaceflightHazard,
} from '@/types/astronaut'

// ── Sources ────────────────────────────────────────────────────────────────

export const SOURCES = {
  hazards: { label: 'NASA HRP — 5 Hazards of Human Spaceflight', url: 'https://www.nasa.gov/hrp/hazards/' },
  risks: { label: 'NASA HRP — Risks of Human Spaceflight', url: 'https://www.nasa.gov/hrp/risks/' },
  research: { label: 'NASA HRP — Ongoing Research', url: 'https://www.nasa.gov/hrp/ongoing-hrp-research/' },
  csaRadiation: {
    label: 'CSA — Monitoring radiation for astronaut health (2026-02-26)',
    url: 'https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp',
  },
  csaScience: {
    label: 'CSA — Why do we conduct science experiments in space?',
    url: 'https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp',
  },
  nasaStd3001: {
    label: 'NASA-STD-3001 Vol. 1 Rev. B — Crew Health (career radiation limit)',
    url: 'https://www.nasa.gov/ochmo/human-spaceflight-and-aviation-standards/',
  },
  msLRad: { label: 'Zeitlin et al., Science 2013 — MSL/RAD cruise dose', url: 'https://doi.org/10.1126/science.1235989' },
  lunarLnd: { label: "Zhang et al., Science Advances 2020 — Chang'e-4 LND lunar surface dose", url: 'https://doi.org/10.1126/sciadv.aaz1334' },
  boneLoss: { label: 'LeBlanc et al., J Musculoskelet Neuronal Interact 2007 — ISS bone loss', url: 'https://pubmed.ncbi.nlm.nih.gov/17396002/' },
  coreTemp: { label: 'Stahn et al., Scientific Reports 2017 — core temperature in space', url: 'https://doi.org/10.1038/s41598-017-15560-w' },
  sleep: { label: 'Barger et al., Lancet Neurology 2014 — astronaut sleep', url: 'https://doi.org/10.1016/S1474-4422(14)70122-X' },
  ada: { label: 'American Diabetes Association — Standards of Care (glycemic thresholds)', url: 'https://diabetesjournals.org/care' },
  aha: { label: 'American Heart Association — Blood pressure categories', url: 'https://www.heart.org/en/health-topics/high-blood-pressure' },
} as const satisfies Record<string, SourceRef>

// ── NASA HRP: 5 Hazards ────────────────────────────────────────────────────

export const SPACEFLIGHT_HAZARDS: SpaceflightHazard[] = [
  {
    name: 'Space Radiation',
    summary:
      'Invisible radiation beyond Earth’s protective atmosphere and magnetic field — considered one of the most hazardous aspects of spaceflight.',
    keyFacts: [
      'Radiation is invisible: you cannot feel it, so only dosimeters tell you your exposure.',
      'Neutron radiation makes up about 30% of total radiation on the ISS and is especially harmful biologically (CSA).',
      'NASA’s career limit is 600 mSv effective dose for every astronaut, regardless of age or sex (NASA-STD-3001).',
      'Typical ISS dose: ~0.3–0.8 mSv/day. Mars transit: ~1.8 mSv/day. Lunar surface: ~1.4 mSv/day.',
      'HRP tracks “Radiation-induced cancers” as its space-radiation risk; radiation also stresses the immune system.',
    ],
    affectedSystems: ['radiation_immune'],
    countermeasures: [
      'Wear your personal dosimeter at all times; read it daily.',
      'Shelter in the most shielded module (water/polyethylene walls) during solar particle events.',
      'Minimise time outside shielding (EVAs, rover traverses) when space weather is active.',
    ],
    sources: [SOURCES.hazards, SOURCES.csaRadiation, SOURCES.nasaStd3001, SOURCES.msLRad, SOURCES.lunarLnd],
  },
  {
    name: 'Isolation and Confinement',
    summary:
      'Small crews living in a small space for months can develop behavioural changes; crews are carefully chosen, trained, and supported to work as a team.',
    keyFacts: [
      'HRP risks: behavioural changes & psychiatric disorders, inadequate teamwork, inadequate sleep & irregular schedules.',
      'Astronauts average ~6 hours of sleep per night on orbit despite 8.5 hours being scheduled (Barger 2014).',
      'Artemis II ARCHeR study used wrist-worn actigraphy to track motion, sleep, and light exposure.',
    ],
    affectedSystems: ['behavioral'],
    countermeasures: [
      'Keep a fixed sleep window and use scheduled lighting.',
      'Daily mood check-in; talk early with a crewmate or behavioural health team.',
      'Protect private time and family conferences.',
    ],
    sources: [SOURCES.hazards, SOURCES.risks, SOURCES.research, SOURCES.sleep],
  },
  {
    name: 'Distance from Earth',
    summary:
      'Mars is ~140 million miles away on average — a ~3-year round trip versus ~3 days to the Moon. Medical help, supplies, and instructions get harder to receive.',
    keyFacts: [
      '“Planning and self-sufficiency will be key to successful deep space missions.” (NASA HRP)',
      'One-way communication delay: ~1.3 s to the Moon; ~4–24 minutes to Mars.',
      'Long missions mean less ability to rely on Earth for food, materials, and emergency medical help (CSA).',
    ],
    affectedSystems: ['cardiovascular', 'metabolic', 'behavioral'],
    countermeasures: [
      'Crew must self-assess and act: use this app’s action plans before waiting on Earth.',
      'Know the crew medical officer and onboard medical kit procedures.',
    ],
    sources: [SOURCES.hazards, SOURCES.csaScience],
  },
  {
    name: 'Gravity Fields',
    summary:
      'Microgravity in transit, ~1/6 g on the Moon, and 3/8 g on Mars for up to two years — muscles, bones, inner ear, and organs must adapt, then re-adapt on return.',
    keyFacts: [
      'Weightlessness produces effects similar to accelerated ageing and a sedentary lifestyle (CSA).',
      'Weight-bearing bones (hip, spine) lose ~1–1.5% mineral density per month without countermeasures (LeBlanc 2007).',
      'Fluids shift toward the head, linked to SANS — Spaceflight Associated Neuro-ocular Syndrome, identified in 2005 and described by NASA as its leading spaceflight-related health risk.',
      'HRP studies: Thigh Cuff (keeping fluid in the legs), B-Complex (vitamin B for eye/brain changes), Venous Haemostasis (clotting), Zero T2 (exercise without a treadmill).',
    ],
    affectedSystems: ['musculoskeletal', 'cardiovascular'],
    countermeasures: [
      '~2 hours of daily resistive + aerobic exercise.',
      'Adequate calcium, vitamin D, and protein intake.',
      'Fluid loading and compression garments before gravity transitions.',
    ],
    sources: [SOURCES.hazards, SOURCES.risks, SOURCES.research, SOURCES.csaScience, SOURCES.boneLoss],
  },
  {
    name: 'Hostile Closed Environments',
    summary:
      'A spacecraft is both home and machine. Temperature, pressure, lighting, noise, and microbes must be controlled; immune responses are tracked.',
    keyFacts: [
      'HRP risks: altered immune responses, host–microorganism interactions, hypoxia, decompression sickness, inadequate food & nutrition.',
      'Artemis II Immune Biomarkers study analysed blood and saliva to see how deep space changes immunity.',
      'Resting core body temperature rises ~1 °C during long-duration spaceflight (Stahn 2017).',
    ],
    affectedSystems: ['radiation_immune', 'metabolic'],
    countermeasures: [
      'Hand hygiene and surface cleaning schedule.',
      'Report fever early — closed cabins spread infection quickly.',
      'Follow the menu plan; log food and water intake.',
    ],
    sources: [SOURCES.hazards, SOURCES.risks, SOURCES.research, SOURCES.coreTemp],
  },
]

/** NASA HRP risk register (https://www.nasa.gov/hrp/risks/), grouped as published. */
export const HRP_RISKS = {
  physiology: [
    'Altered immune system responses',
    'Altered sensorimotor and vestibular function',
    'Cardiovascular adaptations',
    'Decompression sickness',
    'Host-microorganism interactions',
    'Hypoxia',
    'Inadequate food and nutrition',
    'Injury and compromised performance from spacewalks',
    'Reduced cardiorespiratory and musculoskeletal fitness',
    'Spaceflight Associated Neuro-ocular Syndrome (SANS)',
    'Spaceflight-induced bone changes',
  ],
  behavioralPerformanceHumanFactors: [
    'Behavioral changes and psychiatric disorders',
    'Inadequate teamwork',
    'Inadequate sleep and irregular schedules',
    'Inadequate systems operations support',
    'Injury from dynamic loads',
  ],
  spaceRadiation: ['Radiation-induced cancers'],
} as const

/** Ongoing HRP studies (https://www.nasa.gov/hrp/ongoing-hrp-research/). */
export const HRP_RESEARCH: { name: string; mission: 'Artemis II' | 'Low Earth Orbit'; focus: string; systems: BodySystem[] }[] = [
  { name: 'ARCHeR', mission: 'Artemis II', focus: 'Wrist actigraphy of well-being, activity, sleep, and light exposure in deep space.', systems: ['behavioral'] },
  { name: 'Immune Biomarkers', mission: 'Artemis II', focus: 'Blood and saliva samples to track immune changes in deep space.', systems: ['radiation_immune'] },
  { name: 'Artemis II Standard Measures', mission: 'Artemis II', focus: 'Consistent crew health dataset for future researchers.', systems: ['cardiovascular', 'musculoskeletal', 'behavioral'] },
  { name: 'B-Complex', mission: 'Low Earth Orbit', focus: 'Whether daily B-vitamins prevent or reduce brain and eye changes.', systems: ['metabolic'] },
  { name: 'Brain Fluid Pressure', mission: 'Low Earth Orbit', focus: 'How pressure inside the skull relates to eye and brain changes (SANS).', systems: ['cardiovascular'] },
  { name: 'CIPHER', mission: 'Low Earth Orbit', focus: 'Multi-system study of how the body changes in orbit.', systems: ['cardiovascular', 'musculoskeletal', 'metabolic', 'behavioral', 'radiation_immune'] },
  { name: 'Simulating Manual Piloting for Moon Landings', mission: 'Low Earth Orbit', focus: 'How gravity transitions affect piloting performance.', systems: ['behavioral'] },
  { name: 'Spacecraft Occupant Protection', mission: 'Low Earth Orbit', focus: 'Crew discomfort during re-entry combined with vehicle sensor data.', systems: ['musculoskeletal'] },
  { name: 'Spinal Fluid Biomarkers', mission: 'Low Earth Orbit', focus: 'Spinal-fluid markers linked to space-related brain and eye changes.', systems: ['cardiovascular'] },
  { name: 'Standard Measures', mission: 'Low Earth Orbit', focus: 'Consistent physiological and psychological measurements across crews.', systems: ['cardiovascular', 'behavioral'] },
  { name: 'Thigh Cuff', mission: 'Low Earth Orbit', focus: 'Tight thigh cuffs to keep fluid in the legs and help prevent eye disorders.', systems: ['cardiovascular'] },
  { name: 'Venous Haemostasis', mission: 'Low Earth Orbit', focus: 'Differences that may change blood flow and clotting in space.', systems: ['cardiovascular'] },
  { name: 'Zero T2', mission: 'Low Earth Orbit', focus: 'Health effects of exercising without a treadmill.', systems: ['musculoskeletal', 'cardiovascular'] },
]

// ── CSA radiation monitoring ──────────────────────────────────────────────

export const CSA_RADIATION_MONITORING = {
  neutronShareOfIssDose: 0.3,
  summary:
    'Radiation is one of the key challenges for astronauts beyond Earth’s atmosphere. Neutrons contribute about 30% of total ISS radiation and can cause serious biological damage.',
  instruments: [
    { name: 'CANS — Canadian Active Neutron Spectrometer', detail: 'Compact, autonomous neutron monitor that works continuously; CSA awarded Bubble Technology Industries a $5.5 M contract (2026).' },
    { name: 'Bubble detectors', detail: 'Predecessor to CANS, used on the ISS (e.g. by CSA astronaut David Saint-Jacques).' },
    { name: 'Radi-N / Radi-N2', detail: 'Canadian ISS neutron-dosimetry experiments using bubble detectors.' },
    { name: 'MOSFET', detail: 'Canadian solid-state radiation dosimetry experiment on the ISS.' },
    { name: 'EVARM', detail: 'Canadian dosimeters worn during spacewalks (EVA radiation monitoring).' },
  ],
  earthApplications: ['Cancer therapy', 'Aircrew radiation protection', 'Nuclear threat detection', 'Public safety'],
  issTestbedYears: 25,
  issExperimentsAtAnyTime: 200,
  sources: [SOURCES.csaRadiation, SOURCES.csaScience],
} as const

// ── Thresholds used by healthEvaluator.ts ─────────────────────────────────

/**
 * Bands are inclusive of the lower bound. "caution" covers values outside
 * nominal; "critical" covers values outside caution.
 */
export const THRESHOLDS = {
  bloodSugar: {
    // ADA: <70 hypoglycaemia (L1), <54 clinically significant (L2); ≥200 random = hyperglycaemia.
    criticalLow: 54,
    cautionLow: 70,
    nominalHighFasting: 100,
    nominalHighNonFasting: 140,
    cautionHigh: 200, // ≥ this is critical
    fastingCautionHigh: 126, // ≥126 fasting = diabetes-range
  },
  heartRate: { criticalLow: 40, cautionLow: 50, cautionHigh: 100, criticalHigh: 120 },
  bloodPressure: {
    // AHA categories; hypotension guard for orthostatic intolerance after gravity transitions.
    systolicCriticalLow: 80,
    systolicCautionLow: 90,
    systolicCautionHigh: 130,
    systolicCriticalHigh: 160,
    diastolicCautionLow: 60,
    diastolicCautionHigh: 80,
    diastolicCriticalHigh: 100,
  },
  bodyTemp: {
    // Spaceflight core temp runs ~1 °C high (Stahn 2017) — cabin thermometers read peripheral temp.
    criticalLow: 35.0,
    cautionLow: 36.0,
    cautionHigh: 37.6,
    criticalHigh: 38.5,
  },
  sleep: { criticalLow: 5, cautionLow: 7, cautionHigh: 10 },
  mood: { criticalAtOrBelow: 3, cautionAtOrBelow: 6 },
  radiation: {
    careerLimitMSv: 600, // NASA-STD-3001
    thirtyDayLimitMSv: 250, // NASA short-term blood-forming organ limit (mGy-Eq), used as guide
    cautionCareerFraction: 0.5,
    criticalCareerFraction: 0.8,
    dailyCautionMSv: 2, // above any routine environment baseline
    dailyCriticalMSv: 10, // indicative of a solar particle event
  },
  boneDensity: { cautionAtOrBelowPct: -3, criticalAtOrBelowPct: -6 },
} as const

// ── Mission environments ──────────────────────────────────────────────────

export const ENVIRONMENTS: Record<EnvironmentType, EnvironmentProfile> = {
  ISS_ORBIT: {
    id: 'ISS_ORBIT',
    label: 'ISS (Low Earth Orbit)',
    description: 'Space station ~400 km up, still partly protected by Earth’s magnetic field.',
    gravityG: 0,
    typicalDoseRateMSvPerDay: 0.5,
    commDelay: '< 1 s (near real-time)',
    commDelaySecondsMax: 1,
    notes: [
      'Flight surgeons reachable in near real-time.',
      'Neutrons ≈ 30% of total dose (CSA).',
      'Emergency return to Earth possible within hours.',
    ],
  },
  LUNAR_BASE: {
    id: 'LUNAR_BASE',
    label: 'Lunar Base',
    description: 'Surface habitat on the Moon, outside Earth’s magnetosphere.',
    gravityG: 0.166,
    typicalDoseRateMSvPerDay: 1.4,
    commDelay: '~1.3 s one-way',
    commDelaySecondsMax: 1.3,
    notes: ['~3 days from Earth (NASA HRP).', 'Lunar dust is an extra closed-environment hazard.'],
  },
  MARS_TRANSIT: {
    id: 'MARS_TRANSIT',
    label: 'Mars Transit',
    description: 'Deep-space cruise between Earth and Mars in microgravity.',
    gravityG: 0,
    typicalDoseRateMSvPerDay: 1.8,
    commDelay: '4–24 min one-way',
    commDelaySecondsMax: 1440,
    notes: [
      'Mars ≈ 140 million miles away; whole mission ≈ 3 years (NASA HRP).',
      'Crew must act on medical issues before Earth can respond.',
      'Highest continuous radiation exposure of any profile.',
    ],
  },
  SURFACE_ROVER: {
    id: 'SURFACE_ROVER',
    label: 'Pressurised Rover',
    description: 'Multi-day surface traverse in a small pressurised rover with thin shielding.',
    gravityG: 0.166,
    typicalDoseRateMSvPerDay: 1.4,
    commDelay: '~1.3 s via relay (may drop out)',
    commDelaySecondsMax: 1.3,
    notes: [
      'Very confined: 2 crew, limited exercise equipment.',
      'Return to base storm shelter if a solar event is forecast.',
    ],
  },
}

// ── Plain-English indicator guides ────────────────────────────────────────

export interface IndicatorGuide {
  id: IndicatorId
  system: BodySystem
  name: string
  unit: string
  hazardLink: HazardName
  howToMeasure: string
  whyNeeded: string
  measurableInSpace: boolean
}

export const INDICATOR_GUIDES: Record<IndicatorId, IndicatorGuide> = {
  blood_sugar: {
    id: 'blood_sugar',
    system: 'metabolic',
    name: 'Blood Sugar',
    unit: 'mg/dL',
    hazardLink: 'Hostile Closed Environments',
    howToMeasure:
      '1) Wash and dry hands. 2) Insert a test strip into the glucometer. 3) Prick the side of a fingertip with a lancet. 4) Touch the drop to the strip (in microgravity the drop clings to your finger — just touch it). 5) Log the number and whether you have eaten in the last 8 hours.',
    whyNeeded:
      'Weightlessness and less physical activity make the body use insulin less effectively — CSA notes effects similar to a sedentary lifestyle and Type-2 diabetes research. A packaged-food diet and stress also shift sugar levels.',
    measurableInSpace: true,
  },
  radiation_dose: {
    id: 'radiation_dose',
    system: 'radiation_immune',
    name: 'Radiation Dose',
    unit: 'mSv',
    hazardLink: 'Space Radiation',
    howToMeasure:
      '1) Keep your personal dosimeter clipped to your chest at all times. 2) Each morning, read the 24-hour and mission-total values from its display or the station network. 3) Enter both numbers here.',
    whyNeeded:
      'Space radiation is invisible and one of the most hazardous parts of spaceflight. It raises long-term cancer risk and weakens the immune system. Neutrons alone are ~30% of ISS radiation (CSA). NASA caps a whole career at 600 mSv.',
    measurableInSpace: true,
  },
  heart_rate: {
    id: 'heart_rate',
    system: 'cardiovascular',
    name: 'Resting Heart Rate',
    unit: 'bpm',
    hazardLink: 'Gravity Fields',
    howToMeasure:
      '1) Rest quietly for 5 minutes (strap in if floating). 2) Put on the chest strap or finger pulse oximeter. 3) Read the steady value after 30 seconds.',
    whyNeeded:
      'Without gravity, fluid shifts to your head and the heart does less work, so it can de-condition. A changing resting heart rate can signal dehydration, illness, stress, or rhythm problems.',
    measurableInSpace: true,
  },
  blood_pressure: {
    id: 'blood_pressure',
    system: 'cardiovascular',
    name: 'Blood Pressure',
    unit: 'mmHg',
    hazardLink: 'Gravity Fields',
    howToMeasure:
      '1) Rest 5 minutes, arm relaxed at heart level (use a foot restraint to stay still). 2) Wrap the automatic cuff 2 cm above the elbow crease. 3) Press start and stay silent. 4) Log both numbers: top (systolic) / bottom (diastolic).',
    whyNeeded:
      'Fluid shift in microgravity changes blood pressure and is linked to eye and brain changes (SANS). After landing, pressure can drop when standing — fainting risk during gravity transitions.',
    measurableInSpace: true,
  },
  bone_density: {
    id: 'bone_density',
    system: 'musculoskeletal',
    name: 'Bone Density Change',
    unit: '%',
    hazardLink: 'Gravity Fields',
    howToMeasure:
      '1) Weekly: complete the guided ultrasound scan of the heel/shin with the onboard probe (follow on-screen placement guide). 2) The software compares to your pre-flight scan and gives a % change. 3) Log that %.',
    whyNeeded:
      'Bones need weight to stay strong. In weightlessness the hips and spine can lose ~1–1.5% of their mineral each month — like years of ageing on Earth — raising fracture and kidney-stone risk.',
    measurableInSpace: true,
  },
  sleep_hours: {
    id: 'sleep_hours',
    system: 'behavioral',
    name: 'Sleep',
    unit: 'hrs',
    hazardLink: 'Isolation and Confinement',
    howToMeasure:
      '1) Wear the wrist actigraphy band overnight (like Artemis II ARCHeR). 2) In the morning, read total sleep time from the band, or estimate from when you fell asleep and woke. 3) Log hours.',
    whyNeeded:
      'Astronauts average only ~6 hours of sleep on orbit. Noise, light, 16 sunrises a day on the ISS, and stress disrupt sleep, which harms mood, reaction time, and immune function.',
    measurableInSpace: true,
  },
  mood: {
    id: 'mood',
    system: 'behavioral',
    name: 'Mood',
    unit: '/10',
    hazardLink: 'Isolation and Confinement',
    howToMeasure:
      '1) Find a quiet moment. 2) Ask yourself: “Overall, how am I feeling today?” 3) Rate 1 (very low) to 10 (excellent). Be honest — this is private unless it needs escalation.',
    whyNeeded:
      'Months in a small, isolated space far from family can lead to low mood, irritability, and team conflict. Spotting changes early lets the crew and support team help before it affects safety.',
    measurableInSpace: true,
  },
  body_temp: {
    id: 'body_temp',
    system: 'radiation_immune',
    name: 'Body Temperature',
    unit: '°C',
    hazardLink: 'Hostile Closed Environments',
    howToMeasure:
      '1) Don’t eat or drink for 15 minutes. 2) Place the digital thermometer under your tongue (or use the forehead scanner). 3) Keep your mouth closed until it beeps. 4) Log the value.',
    whyNeeded:
      'Fever is an early sign of infection, and the immune system is weakened in space while germs spread easily in a closed cabin. Body temperature also naturally runs about 1 °C higher during long missions.',
    measurableInSpace: true,
  },
}

// ── Routine tasks (gamification) ──────────────────────────────────────────

export const DEFAULT_ROUTINE: RoutineTask[] = [
  { id: 'log_vitals_am', title: 'Morning vitals: HR, BP, temperature', xp: 20, completed: false, frequency: 'daily' },
  { id: 'dosimeter_read', title: 'Read and log personal dosimeter', xp: 10, completed: false, frequency: 'daily' },
  { id: 'glucose_check', title: 'Fasting blood sugar check', xp: 15, completed: false, frequency: 'daily' },
  { id: 'exercise_2h', title: 'Complete 2 h resistive + aerobic exercise', xp: 40, completed: false, frequency: 'daily' },
  { id: 'sleep_log', title: 'Log sleep from actigraphy band', xp: 10, completed: false, frequency: 'daily' },
  { id: 'mood_checkin', title: 'Mood check-in (1–10)', xp: 10, completed: false, frequency: 'daily' },
  { id: 'hydration', title: 'Drink ≥ 2 L water', xp: 10, completed: false, frequency: 'daily' },
  { id: 'bone_ultrasound', title: 'Guided bone ultrasound scan', xp: 50, completed: false, frequency: 'weekly' },
  { id: 'eye_exam', title: 'Eye/vision check for SANS (OCT or Amsler grid)', xp: 40, completed: false, frequency: 'weekly' },
  { id: 'family_conference', title: 'Private family video conference', xp: 25, completed: false, frequency: 'weekly' },
]

// ── History generation (deterministic) ────────────────────────────────────

/** Small seeded PRNG so trend charts are stable across renders/builds. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface TrendSpec {
  baseline: number
  /** Change per day applied to the value (drift). */
  drift: number
  noise: number
  decimals: number
}

export function generateHistory(spec: TrendSpec, days: number, seed: number, startDay = 1): HistoryPoint[] {
  const rand = mulberry32(seed)
  const f = 10 ** spec.decimals
  const out: HistoryPoint[] = []
  for (let i = 0; i < days; i++) {
    const value = spec.baseline + spec.drift * i + (rand() * 2 - 1) * spec.noise
    out.push({ day: startDay + i, value: Math.round(value * f) / f, baseline: spec.baseline })
  }
  return out
}

/** Cumulative series (e.g. mission radiation dose). */
function generateCumulative(dailyRate: number, noise: number, days: number, seed: number, startDay = 1, start = 0): HistoryPoint[] {
  const rand = mulberry32(seed)
  let total = start
  const out: HistoryPoint[] = []
  for (let i = 0; i < days; i++) {
    total += dailyRate + (rand() * 2 - 1) * noise
    const expected = start + dailyRate * (i + 1)
    out.push({ day: startDay + i, value: Math.round(total * 100) / 100, baseline: Math.round(expected * 100) / 100 })
  }
  return out
}

// ── Crew profiles (fictional demo personas) ───────────────────────────────

const HISTORY_DAYS = 14

function indicator(
  id: IndicatorId,
  value: number | string,
  history: HistoryPoint[],
): HealthIndicator {
  const g = INDICATOR_GUIDES[id]
  return {
    id,
    system: g.system,
    name: g.name,
    value,
    unit: g.unit,
    // Placeholder; recomputed by healthEvaluator.evaluateIndicators() at runtime.
    status: 'nominal',
    hazardLink: g.hazardLink,
    howToMeasure: g.howToMeasure,
    whyNeeded: g.whyNeeded,
    actionPlan: { level: 'self_care', steps: [] },
    history,
  }
}

interface ProfileSeed {
  id: string
  name: string
  role: string
  agency: AstronautProfile['agency']
  age: number
  sex: AstronautProfile['sex']
  environment: EnvironmentType
  missionDay: number
  missionLengthDays: number
  priorCareerDoseMSv: number
  seed: number
  hr: TrendSpec
  sys: TrendSpec
  dia: TrendSpec
  glucose: TrendSpec
  temp: TrendSpec
  sleep: TrendSpec
  mood: TrendSpec
  boneMonthlyLossPct: number
}

function buildProfile(p: ProfileSeed): AstronautProfile {
  const start = p.missionDay - HISTORY_DAYS + 1
  const env = ENVIRONMENTS[p.environment]
  const last = (h: HistoryPoint[]) => h[h.length - 1].value

  const hr = generateHistory(p.hr, HISTORY_DAYS, p.seed + 1, start)
  const sys = generateHistory(p.sys, HISTORY_DAYS, p.seed + 2, start)
  const dia = generateHistory(p.dia, HISTORY_DAYS, p.seed + 3, start)
  const glucose = generateHistory(p.glucose, HISTORY_DAYS, p.seed + 4, start)
  const temp = generateHistory(p.temp, HISTORY_DAYS, p.seed + 5, start)
  const sleep = generateHistory(p.sleep, HISTORY_DAYS, p.seed + 6, start)
  const mood = generateHistory(p.mood, HISTORY_DAYS, p.seed + 7, start)
  const doseBefore = env.typicalDoseRateMSvPerDay * (start - 1)
  const radiation = generateCumulative(env.typicalDoseRateMSvPerDay, env.typicalDoseRateMSvPerDay * 0.15, HISTORY_DAYS, p.seed + 8, start, doseBefore)
  const dailyBoneLoss = p.boneMonthlyLossPct / 30
  const bone = generateHistory(
    { baseline: dailyBoneLoss * (start - 1), drift: dailyBoneLoss, noise: 0.05, decimals: 2 },
    HISTORY_DAYS,
    p.seed + 9,
    start,
  ).map((pt) => ({ ...pt, baseline: 0 }))

  return {
    id: p.id,
    name: p.name,
    role: p.role,
    agency: p.agency,
    age: p.age,
    sex: p.sex,
    environment: p.environment,
    missionDay: p.missionDay,
    missionLengthDays: p.missionLengthDays,
    priorCareerDoseMSv: p.priorCareerDoseMSv,
    indicators: [
      indicator('heart_rate', last(hr), hr),
      // Chart series for BP tracks systolic; value carries both numbers.
      indicator('blood_pressure', `${Math.round(last(sys))}/${Math.round(last(dia))}`, sys),
      indicator('blood_sugar', last(glucose), glucose),
      indicator('body_temp', last(temp), temp),
      indicator('sleep_hours', last(sleep), sleep),
      indicator('mood', last(mood), mood),
      indicator('radiation_dose', last(radiation), radiation),
      indicator('bone_density', last(bone), bone),
    ],
    routine: DEFAULT_ROUTINE.map((t) => ({ ...t })),
  }
}

export const CREW_PROFILES: AstronautProfile[] = [
  buildProfile({
    id: 'crew-01',
    name: 'Cmdr. Maya Okafor',
    role: 'Commander',
    agency: 'NASA',
    age: 44,
    sex: 'female',
    environment: 'ISS_ORBIT',
    missionDay: 92,
    missionLengthDays: 180,
    priorCareerDoseMSv: 85,
    seed: 101,
    hr: { baseline: 62, drift: 0, noise: 3, decimals: 0 },
    sys: { baseline: 116, drift: 0.1, noise: 4, decimals: 0 },
    dia: { baseline: 74, drift: 0, noise: 3, decimals: 0 },
    glucose: { baseline: 92, drift: 0, noise: 6, decimals: 0 },
    temp: { baseline: 36.8, drift: 0, noise: 0.2, decimals: 1 },
    sleep: { baseline: 7.2, drift: 0, noise: 0.5, decimals: 1 },
    mood: { baseline: 8, drift: 0, noise: 0.8, decimals: 0 },
    boneMonthlyLossPct: -0.4, // good exercise compliance
  }),
  buildProfile({
    id: 'crew-02',
    name: 'Dr. Étienne Lavoie',
    role: 'Flight Engineer / Crew Medical Officer',
    agency: 'CSA',
    age: 39,
    sex: 'male',
    environment: 'MARS_TRANSIT',
    missionDay: 140,
    missionLengthDays: 210,
    priorCareerDoseMSv: 120,
    seed: 202,
    hr: { baseline: 68, drift: 0.4, noise: 3, decimals: 0 },
    sys: { baseline: 124, drift: 0.5, noise: 4, decimals: 0 },
    dia: { baseline: 80, drift: 0.2, noise: 3, decimals: 0 },
    glucose: { baseline: 112, drift: 1.2, noise: 8, decimals: 0 },
    temp: { baseline: 37.0, drift: 0, noise: 0.2, decimals: 1 },
    sleep: { baseline: 6.4, drift: -0.03, noise: 0.5, decimals: 1 },
    mood: { baseline: 6, drift: -0.05, noise: 0.8, decimals: 0 },
    boneMonthlyLossPct: -1.2,
  }),
  buildProfile({
    id: 'crew-03',
    name: 'Spc. Kenji Arai',
    role: 'Mission Specialist / Geologist',
    agency: 'JAXA',
    age: 35,
    sex: 'male',
    environment: 'SURFACE_ROVER',
    missionDay: 21,
    missionLengthDays: 30,
    priorCareerDoseMSv: 40,
    seed: 303,
    hr: { baseline: 74, drift: 1.5, noise: 4, decimals: 0 },
    sys: { baseline: 120, drift: 0, noise: 5, decimals: 0 },
    dia: { baseline: 78, drift: 0, noise: 3, decimals: 0 },
    glucose: { baseline: 98, drift: 0, noise: 7, decimals: 0 },
    temp: { baseline: 37.1, drift: 0.11, noise: 0.15, decimals: 1 },
    sleep: { baseline: 6.0, drift: -0.08, noise: 0.4, decimals: 1 },
    mood: { baseline: 7, drift: -0.1, noise: 0.6, decimals: 0 },
    boneMonthlyLossPct: -0.8,
  }),
]

export const HAZARD_BY_NAME: Record<HazardName, SpaceflightHazard> = Object.fromEntries(
  SPACEFLIGHT_HAZARDS.map((h) => [h.name, h]),
) as Record<HazardName, SpaceflightHazard>
