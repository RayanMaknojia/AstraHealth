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
  CabinLimit,
  CrewRole,
  DataModality,
  EnvironmentProfile,
  EnvironmentType,
  MissionDestination,
  MissionPhase,
  MissionPlan,
  PersonalBaseline,
  ReferenceRange,
  VitalsInput,
  HazardName,
  HazardRiskEntry,
  HealthIndicator,
  HistoryPoint,
  IndicatorId,
  RoutineTask,
  SourceRef,
  SpaceflightHazard,
} from '@/types/astronaut'

// ── Sources ────────────────────────────────────────────────────────────────

export const SOURCES = {
  hazards: { label: 'NASA HRP - 5 Hazards of Human Spaceflight', url: 'https://www.nasa.gov/hrp/hazards/' },
  risks: { label: 'NASA HRP - Risks of Human Spaceflight', url: 'https://www.nasa.gov/hrp/risks/' },
  research: { label: 'NASA HRP - Ongoing Research', url: 'https://www.nasa.gov/hrp/ongoing-hrp-research/' },
  csaRadiation: {
    label: 'CSA - Monitoring radiation for astronaut health (2026-02-26)',
    url: 'https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp',
  },
  csaScience: {
    label: 'CSA - Why do we conduct science experiments in space?',
    url: 'https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp',
  },
  nasaStd3001: {
    label: 'NASA-STD-3001 Vol. 1 Rev. B - Crew Health (career radiation limit)',
    url: 'https://www.nasa.gov/ochmo/human-spaceflight-and-aviation-standards/',
  },
  msLRad: { label: 'Zeitlin et al., Science 2013 - MSL/RAD cruise dose', url: 'https://doi.org/10.1126/science.1235989' },
  lunarLnd: { label: "Zhang et al., Science Advances 2020 - Chang'e-4 LND lunar surface dose", url: 'https://doi.org/10.1126/sciadv.aaz1334' },
  boneLoss: { label: 'LeBlanc et al., J Musculoskelet Neuronal Interact 2007 - ISS bone loss', url: 'https://pubmed.ncbi.nlm.nih.gov/17396002/' },
  coreTemp: { label: 'Stahn et al., Scientific Reports 2017 - core temperature in space', url: 'https://doi.org/10.1038/s41598-017-15560-w' },
  sleep: { label: 'Barger et al., Lancet Neurology 2014 - astronaut sleep', url: 'https://doi.org/10.1016/S1474-4422(14)70122-X' },
  ada: { label: 'American Diabetes Association - Standards of Care (glycemic thresholds)', url: 'https://diabetesjournals.org/care' },
  aha: { label: 'American Heart Association - Blood pressure categories', url: 'https://www.heart.org/en/health-topics/high-blood-pressure' },
  // From astronaut_health_monitor_plan.md (team reference doc)
  std3001Vol2: { label: 'NASA-STD-3001 Vol. 2 §6 - Natural and induced environments', url: 'https://www.nasa.gov/reference/6-0-natural-and-induced-environments-vol-2' },
  ochmoCo2: { label: 'NASA OCHMO Technical Brief - Carbon dioxide', url: 'https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-004-carbon-dioxide.pdf' },
  ochmoRadiation: { label: 'NASA OCHMO Technical Brief - Radiation protection', url: 'https://www.nasa.gov/wp-content/uploads/2023/03/radiation-protection-technical-brief-ochmo.pdf' },
  explorationAtmosphere: { label: 'NASA NTRS - Exploration atmosphere (8.2 psia / 34% O2)', url: 'https://ntrs.nasa.gov/citations/20230015380' },
  partialGravity: { label: 'NASA NTRS - Partial gravity and human health', url: 'https://ntrs.nasa.gov/citations/20210019591' },
  issRadiation: { label: 'ISS crew radiation exposure (PMC10919966)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10919966' },
  marsRad: { label: 'SwRI - Curiosity RAD Mars surface radiation', url: 'https://swri.org/node/9140' },
  bpInSpace: { label: 'Norsk et al. 2015 - Blood pressure in space', url: 'https://pmc.ncbi.nlm.nih.gov/articles/4324706/' },
  spaceFever: { label: 'ESA - Space fever', url: 'https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/Research/Space_fever' },
  lunarDust: { label: 'Stony Brook Medicine - Lunar dust health risk', url: 'https://news.stonybrookmedicine.edu/news/breathing-lunar-dust-could-pose-health-risk-to-future-astronauts/' },
  marsFacts: { label: 'NASA NSSDC - Mars Fact Sheet', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html' },
  moonFacts: { label: 'NASA NSSDC - Moon Fact Sheet', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html' },
  osdr: { label: 'NASA Open Science Data Repository (OSDR)', url: 'https://osdr.nasa.gov' },
  radlab: { label: 'NASA OSDR RadLab', url: 'https://visualization.osdr.nasa.gov/radlab/' },
  donki: { label: 'NASA DONKI - Space weather (SEP events)', url: 'https://api.nasa.gov' },
} as const satisfies Record<string, SourceRef>

// ── NASA HRP: 5 Hazards ────────────────────────────────────────────────────

export const SPACEFLIGHT_HAZARDS: SpaceflightHazard[] = [
  {
    name: 'Space Radiation',
    summary:
      'Invisible radiation beyond Earth’s protective atmosphere and magnetic field - considered one of the most hazardous aspects of spaceflight.',
    keyFacts: [
      'Radiation is invisible: you cannot feel it, so only dosimeters tell you your exposure.',
      'Neutron radiation makes up about 30% of total radiation on the ISS and is especially harmful biologically (CSA).',
      'NASA’s career limit is 600 mSv effective dose for every astronaut, regardless of age or sex (NASA-STD-3001).',
      'Typical ISS dose: ~0.3-0.8 mSv/day. Mars transit: ~1.8 mSv/day. Lunar surface: ~1.4 mSv/day.',
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
      'Mars is ~140 million miles away on average - a ~3-year round trip versus ~3 days to the Moon. Medical help, supplies, and instructions get harder to receive.',
    keyFacts: [
      '“Planning and self-sufficiency will be key to successful deep space missions.” (NASA HRP)',
      'One-way communication delay: ~1.3 s to the Moon; ~4-24 minutes to Mars.',
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
      'Microgravity in transit, ~1/6 g on the Moon, and 3/8 g on Mars for up to two years - muscles, bones, inner ear, and organs must adapt, then re-adapt on return.',
    keyFacts: [
      'Weightlessness produces effects similar to accelerated ageing and a sedentary lifestyle (CSA).',
      'Weight-bearing bones (hip, spine) lose ~1-1.5% mineral density per month without countermeasures (LeBlanc 2007).',
      'Fluids shift toward the head, linked to SANS - Spaceflight Associated Neuro-ocular Syndrome, identified in 2005 and described by NASA as its leading spaceflight-related health risk.',
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
      'HRP risks: altered immune responses, host-microorganism interactions, hypoxia, decompression sickness, inadequate food & nutrition.',
      'Artemis II Immune Biomarkers study analysed blood and saliva to see how deep space changes immunity.',
      'Resting core body temperature rises ~1 °C during long-duration spaceflight (Stahn 2017).',
    ],
    affectedSystems: ['radiation_immune', 'metabolic'],
    countermeasures: [
      'Hand hygiene and surface cleaning schedule.',
      'Report fever early - closed cabins spread infection quickly.',
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
    { name: 'CANS - Canadian Active Neutron Spectrometer', detail: 'Compact, autonomous neutron monitor that works continuously; CSA awarded Bubble Technology Industries a $5.5 M contract (2026).' },
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
  // All values below follow health_rules.md (reconciled team rules).
  bloodSugar: {
    // ADA: <70 hypoglycaemia (L1), <54 clinically significant (L2). Pages doc: Alert > 180.
    criticalLow: 54,
    cautionLow: 70,
    /** Fasting: Watch from 100. */
    nominalHighFasting: 100,
    /** Not fasting: Watch above 140. */
    nominalHighNonFasting: 140,
    /** Alert above this (both). */
    criticalHigh: 180,
  },
  heartRate: { criticalLow: 40, cautionLow: 50, cautionHigh: 100, criticalHigh: 120, baselineWatchFraction: 0.15 },
  bloodPressure: {
    // AHA categories (pages doc). Low limits relax in flight - see SPACE_ADJUSTMENT_RULES.bloodPressure.
    systolicCriticalLow: 80,
    systolicCautionLow: 90,
    systolicCautionHigh: 130,
    systolicCriticalHigh: 160,
    diastolicCautionLow: 60,
    diastolicCautionHigh: 85,
    diastolicCriticalHigh: 100,
  },
  bodyTemp: {
    // Normal 36.1-37.5; Watch 35.0-36.0 / 37.6-38.4; Alert ≥ 38.5 or < 35.0.
    criticalLow: 35.0,
    cautionLow: 36.1,
    cautionHigh: 37.6,
    criticalHigh: 38.5,
  },
  sleep: {
    // Normal ≥ 7 h (target 8.5). One night < 6 h = Watch; Alert = < 6 h for 3 nights in a row, or any night < 4 h.
    criticalLow: 6,
    consecutiveNightsForAlert: 3,
    severeSingleNight: 4,
    cautionLow: 7,
    target: 8.5,
    cautionHigh: 10,
  },
  mood: {
    // 1-5 scale. Normal 4-5; Watch 3 or a single day at 1-2; Alert = 1-2 for 3 days in a row.
    scaleMax: 5,
    cautionAtOrBelow: 3,
    criticalAtOrBelow: 2,
    consecutiveDaysForAlert: 3,
  },
  radiation: {
    careerLimitMSv: 600, // NASA-STD-3001
    thirtyDayLimitMSv: 250, // NASA short-term blood-forming organ limit (mGy-Eq), used as guide
    cautionCareerFraction: 0.5,
    criticalCareerFraction: 0.8,
    dailyCautionMSv: 2, // above any routine environment baseline
    dailyCriticalMSv: 10, // indicative of a solar particle event
  },
  // A normal 6-month ISS stay loses ~6-9% at the hip, so Watch/Alert flag unusual loss.
  boneDensity: { cautionAtOrBelowPct: -5, criticalAtOrBelowPct: -10 },
  spo2: {
    // Normal ≥ 95%; Alert < 90% everywhere. In the 8.2 psia / 34% O2 habitat (close to the 127 mmHg
    // inspired-O2 floor) only the early-warning Watch is tightened to < 96%.
    cautionLow: 95,
    criticalLow: 90,
    lowPressureHabitatPsia: 10.3,
    habitatCautionLow: 96,
    habitatCriticalLow: 90,
  },
} as const

// ── Check-in inputs (slider ranges for the UI) ──────────────────────────

export interface CheckinInputSpec {
  key: keyof Omit<VitalsInput, 'fasting' | 'symptoms'>
  indicator: IndicatorId
  label: string
  unit: string
  min: number
  max: number
  step: number
  /** Shown next to the field ("normal range"). */
  normalText: string
}

/** Use these for the Daily Check-in sliders so ranges/units always match the backend rules. */
export const CHECKIN_INPUTS: CheckinInputSpec[] = [
  { key: 'sleepHours', indicator: 'sleep_hours', label: 'Sleep last night', unit: 'h', min: 0, max: 14, step: 0.1, normalText: '≥ 7 h (target 8.5 h)' },
  { key: 'mood', indicator: 'mood', label: 'Mood', unit: '/5', min: 1, max: 5, step: 1, normalText: '4-5' },
  { key: 'heartRateBpm', indicator: 'heart_rate', label: 'Resting heart rate', unit: 'bpm', min: 30, max: 180, step: 1, normalText: '50-100 bpm' },
  { key: 'systolicMmHg', indicator: 'blood_pressure', label: 'Blood pressure (top)', unit: 'mmHg', min: 60, max: 200, step: 1, normalText: '90-129 mmHg' },
  { key: 'diastolicMmHg', indicator: 'blood_pressure', label: 'Blood pressure (bottom)', unit: 'mmHg', min: 30, max: 130, step: 1, normalText: '60-84 mmHg' },
  { key: 'bodyTempC', indicator: 'body_temp', label: 'Body temperature', unit: '°C', min: 34, max: 41, step: 0.1, normalText: '36.1-37.5 °C' },
  { key: 'spo2Pct', indicator: 'spo2', label: 'Blood oxygen (SpO2)', unit: '%', min: 80, max: 100, step: 1, normalText: '≥ 95%' },
  { key: 'bloodSugarMgDl', indicator: 'blood_sugar', label: 'Blood sugar', unit: 'mg/dL', min: 40, max: 300, step: 1, normalText: '70-99 fasting, 70-140 after food' },
  { key: 'radiationDailyMSv', indicator: 'radiation_dose', label: 'Dosimeter, last 24 h', unit: 'mSv', min: 0, max: 20, step: 0.01, normalText: 'depends on location' },
  { key: 'boneDensityChangePct', indicator: 'bone_density', label: 'Bone density change', unit: '%', min: -20, max: 5, step: 0.1, normalText: 'above −5%' },
]

/** Symptom checklist for the morning check-in (pages doc §3). "Skin problem" should offer "Add photo". */
export const CHECKIN_SYMPTOMS = [
  'headache',
  'nausea',
  'dizziness',
  'congestion',
  'back pain',
  'eye or vision change',
  'skin problem',
  'other',
] as const

// ── Spaceflight physiology adjustments (reference doc §6) ────────────────

export const SPACE_ADJUSTMENT_RULES = {
  bodyTemp: {
    /** Continuous days in 0 g before the shift applies. */
    after0gDays: 60,
    /** Top of Normal rises from 37.5 to 37.9 °C (Watch starts at 38.0). Alert stays at 38.5. */
    shiftC: 0.4,
  },
  bloodPressure: {
    /** 24 h BP runs 8-10 mmHg lower in flight (Norsk 2015) → the LOW limits relax by this much. */
    inFlightSystolicRelax: 8,
    inFlightDiastolicRelax: 5,
    /** Relaxation is switched off for this many days after landing (fainting risk on standing). */
    offAfterLandingDays: 14,
  },
  sleep: { targetHours: 8.5, alertBelowHours: 6 },
  spo2: { lowPressureHabitatPsia: 10.3 },
} as const

/** Expected rate of change used to decide whether a trend is meaningful (units per day). */
export const TREND_SENSITIVITY: Record<IndicatorId, { meaningfulPerDay: number; sdFloor: number }> = {
  heart_rate: { meaningfulPerDay: 0.4, sdFloor: 3 },
  blood_pressure: { meaningfulPerDay: 0.5, sdFloor: 4 },
  blood_sugar: { meaningfulPerDay: 0.8, sdFloor: 6 },
  body_temp: { meaningfulPerDay: 0.04, sdFloor: 0.2 },
  spo2: { meaningfulPerDay: 0.12, sdFloor: 1 },
  sleep_hours: { meaningfulPerDay: 0.05, sdFloor: 0.5 },
  mood: { meaningfulPerDay: 0.04, sdFloor: 0.5 },
  radiation_dose: { meaningfulPerDay: 0, sdFloor: 0 }, // judged vs environment dose rate instead
  bone_density: { meaningfulPerDay: 0, sdFloor: 0 }, // judged vs expected gravity-scaled loss instead
}

/** Days without a reading before an indicator is "stale" (painted grey). */
export const STALE_AFTER_DAYS: Record<IndicatorId, number> = {
  heart_rate: 1,
  blood_pressure: 2,
  blood_sugar: 2,
  body_temp: 1,
  spo2: 1,
  sleep_hours: 2,
  mood: 2,
  radiation_dose: 2,
  bone_density: 10,
}

// ── Reference tables (reference doc §5, §6, §9) ───────────────────────────

export const REFERENCE_RANGES: ReferenceRange[] = [
  { indicator: 'body_temp', unit: '°C', earthLow: 36.1, earthHigh: 37.2, spaceShift: 'Rises about 1 °C over ~2.5 months; faster during exercise.', appRule: 'Normal 36.1-37.5 °C; after day 60 in 0 g Normal goes up to 37.9 °C. Alert ≥ 38.5 °C.', sources: [SOURCES.coreTemp, SOURCES.spaceFever] },
  { indicator: 'blood_pressure', unit: 'mmHg', earthLow: null, earthHigh: 120, spaceShift: '24 h BP drops 8-10 mmHg.', appRule: 'Lower BP is expected in flight, so low limits relax by 8/5 mmHg (not after landing).', sources: [SOURCES.bpInSpace, SOURCES.aha] },
  { indicator: 'heart_rate', unit: 'bpm', earthLow: 60, earthHigh: 100, spaceShift: 'Unchanged in long ISS stays.', appRule: 'Keep Earth range.', sources: [SOURCES.aha] },
  { indicator: 'sleep_hours', unit: 'hrs', earthLow: 7, earthHigh: 9, spaceShift: '~6 h average on ISS vs 8.5 h scheduled.', appRule: 'Target 8.5 h. One night < 6 h = Watch; Alert after 3 nights < 6 h in a row (or any night < 4 h).', sources: [SOURCES.sleep] },
  { indicator: 'blood_sugar', unit: 'mg/dL', earthLow: 70, earthHigh: 99, spaceShift: 'No clear shift.', appRule: 'Earth range (fasting), personal baseline from first readings.', sources: [SOURCES.ada, SOURCES.osdr] },
  { indicator: 'spo2', unit: '%', earthLow: 95, earthHigh: 100, spaceShift: 'Watch in 8.2 psi habitat (close to O2 floor).', appRule: 'Tighter alert on Moon / Mars.', sources: [SOURCES.explorationAtmosphere, SOURCES.std3001Vol2] },
  { indicator: 'bone_density', unit: '%', earthLow: null, earthHigh: null, spaceShift: 'Loses 1-1.5% per month in 0 g.', appRule: 'Estimate by gravity: (1.25/30)·(1 − g) %/day; track exercise.', sources: [SOURCES.boneLoss, SOURCES.partialGravity] },
  { indicator: 'mood', unit: '/5', earthLow: 4, earthHigh: 5, spaceShift: 'Isolation and distance from Earth.', appRule: 'Daily check-in on a 1-5 scale; Alert only after 3 low days in a row.', sources: [SOURCES.hazards] },
  { indicator: 'radiation_dose', unit: 'mSv', earthLow: null, earthHigh: null, spaceShift: '~0.35 mSv/day ISS, ~1.84 transit, ~1.37 Moon, ~0.64 Mars surface.', appRule: 'Career limit 600 mSv; ≤ 250 mSv per solar storm.', sources: [SOURCES.nasaStd3001, SOURCES.ochmoRadiation] },
]

export const CABIN_LIMITS: CabinLimit[] = [
  { param: 'co2_mmhg', label: 'Cabin CO2', unit: 'mmHg', nominalHigh: 2.5, watch: 2.5, alert: 3.0, note: '1 h average ≤ 3 mmHg; 7-day average < 2.5 mmHg keeps headache risk < 1%. Headaches at 2.8-4.5 mmHg; fatigue, poor sleep, nausea above 4.5 mmHg.' },
  { param: 'temp_c', label: 'Cabin temperature', unit: '°C', nominalLow: 18, nominalHigh: 27, note: 'Comfort band 18 °C (at 75% humidity) to 27 °C (at 25% humidity).' },
  { param: 'humidity_pct', label: 'Relative humidity', unit: '%', nominalLow: 25, nominalHigh: 75, note: 'Comfort band 25-75%.' },
  { param: 'cabin_psia', label: 'Cabin pressure', unit: 'psia', nominalLow: 5, nominalHigh: 15, note: 'Allowed 5-15 psia (34.5-103 kPa). ISS 14.7; Moon/Mars habitats 8.2.' },
  { param: 'ppo2_mmhg', label: 'Inspired oxygen (ppO2)', unit: 'mmHg', watch: 135, alert: 127, note: 'Minimum inspired O2 127 mmHg. The 8.2 psia / 34% O2 habitat sits just above it (~128 mmHg).' },
]

export const CABIN_STANDARD_LIMITS = {
  co2WatchMmHg: 2.5,
  co2AlertMmHg: 3.0,
  co2SymptomMmHg: 4.5,
  minInspiredO2MmHg: 127,
  o2WatchMmHg: 135,
  tempLowC: 18,
  tempHighC: 27,
  humidityLowPct: 25,
  humidityHighPct: 75,
  pressureLowPsia: 5,
  pressureHighPsia: 15,
  /** Radiation dose limit per solar storm event. */
  perStormLimitMSv: 250,
} as const

export const HAZARD_RISK_MAP: HazardRiskEntry[] = [
  { hazard: 'Space Radiation', risk: 'Radiation-induced cancers', indicators: ['radiation_dose'], why: 'Space radiation damages DNA and raises lifetime cancer risk; it also weakens the immune system.', action: 'Wear your dosimeter, shelter during solar storms, limit time outside shielding.', escalateToGround: true },
  { hazard: 'Space Radiation', risk: 'Altered immune system responses', indicators: ['body_temp', 'radiation_dose'], why: 'Radiation and stress weaken immunity, so infections and fevers appear more easily.', action: 'Hand hygiene, sleep, and report any fever early.', escalateToGround: false },
  { hazard: 'Isolation and Confinement', risk: 'Behavioral changes and psychiatric disorders', indicators: ['mood'], why: 'Months in a small space far from family can lower mood and cause conflict.', action: 'Daily mood check-in; talk to a crewmate; protect private time.', escalateToGround: true },
  { hazard: 'Isolation and Confinement', risk: 'Inadequate sleep and irregular schedules', indicators: ['sleep_hours', 'mood'], why: 'Noise, light and odd day lengths cut sleep, which harms mood, reaction time and immunity.', action: 'Fixed sleep window, eye mask, scheduled lighting; target 8.5 h.', escalateToGround: false },
  { hazard: 'Distance from Earth', risk: 'Inadequate systems operations support (medical autonomy)', indicators: ['heart_rate', 'blood_pressure', 'spo2'], why: 'With long signal delays the crew must act before Earth can answer.', action: 'Follow onboard action plans first, then report.', escalateToGround: true },
  { hazard: 'Gravity Fields', risk: 'Spaceflight-induced bone changes', indicators: ['bone_density'], why: 'Without weight on the skeleton, hips and spine lose 1-1.5% of mineral per month.', action: '~2 h daily resistive + aerobic exercise; calcium, vitamin D, protein.', escalateToGround: false },
  { hazard: 'Gravity Fields', risk: 'Cardiovascular adaptations', indicators: ['heart_rate', 'blood_pressure'], why: 'Fluid shifts to the head; the heart de-conditions; standing up after landing can cause fainting.', action: 'Aerobic exercise; fluid loading and compression garments before landing.', escalateToGround: true },
  { hazard: 'Gravity Fields', risk: 'Spaceflight Associated Neuro-ocular Syndrome (SANS)', indicators: ['blood_pressure'], why: 'Head-ward fluid shift is linked to eye and brain changes.', action: 'Weekly vision check; report blurry vision.', escalateToGround: true },
  { hazard: 'Hostile Closed Environments', risk: 'Hypoxia', indicators: ['spo2'], why: 'Low-pressure habitats run close to the oxygen floor; a life-support fault can lower blood oxygen fast.', action: 'Daily SpO2 check; know the emergency O2 mask location.', escalateToGround: true },
  { hazard: 'Hostile Closed Environments', risk: 'Host-microorganism interactions', indicators: ['body_temp'], why: 'Germs spread easily in a closed cabin while immunity is weakened.', action: 'Hand hygiene, masks when ill, report fevers.', escalateToGround: false },
  { hazard: 'Hostile Closed Environments', risk: 'Inadequate food and nutrition', indicators: ['blood_sugar'], why: 'Packaged food, less activity and insulin resistance shift blood sugar.', action: 'Stick to the meal plan and daily exercise.', escalateToGround: false },
]

// ── Mission environments ──────────────────────────────────────────────────

export const ENVIRONMENTS: Record<EnvironmentType, EnvironmentProfile> = {
  // Values from astronaut_health_monitor_plan.md §4/§7; some are midpoints of published ranges.
  EARTH: {
    id: 'EARTH',
    label: 'Earth (training / baseline)',
    description: 'Pre-launch Earth mode: readings become the personal baseline for the mission.',
    gravityG: 1,
    dayLengthHours: 24,
    typicalDoseRateMSvPerDay: 0.01,
    commDelay: 'None',
    commDelaySecondsMin: 0,
    commDelaySecondsMax: 0,
    dustRisk: 'none',
    cabinPsia: 14.7,
    cabinO2Pct: 21,
    notes: ['Collect normal readings here - they become your personal baseline.'],
    sources: [],
  },
  EARTH_ORBIT: {
    id: 'EARTH_ORBIT',
    label: 'Earth Orbit (ISS)',
    description: 'Station ~400 km up, still partly protected by Earth’s magnetic field.',
    gravityG: 0,
    dayLengthHours: 1.5,
    typicalDoseRateMSvPerDay: 0.35,
    commDelay: '< 1 s (near real-time)',
    commDelaySecondsMin: 0,
    commDelaySecondsMax: 1,
    dustRisk: 'none',
    cabinPsia: 14.7,
    cabinO2Pct: 21,
    notes: [
      '90-minute orbit: ~16 sunrises a day disrupt sleep.',
      'Neutrons ≈ 30% of total dose (CSA).',
      'Flight surgeon reachable in near real-time.',
    ],
    sources: [SOURCES.issRadiation, SOURCES.csaRadiation],
  },
  DEEP_SPACE: {
    id: 'DEEP_SPACE',
    label: 'Deep Space Transit',
    description: 'Cruise outside Earth’s magnetosphere in microgravity - highest continuous radiation.',
    gravityG: 0,
    dayLengthHours: null,
    typicalDoseRateMSvPerDay: 1.84,
    commDelay: 'Grows from seconds to minutes',
    commDelaySecondsMin: 1,
    commDelaySecondsMax: 1440,
    dustRisk: 'none',
    cabinPsia: 14.7,
    cabinO2Pct: 21,
    notes: ['No natural day - keep a strict light/sleep schedule.', 'Crew must act on medical issues before Earth can respond.'],
    sources: [SOURCES.msLRad],
  },
  MARS_ORBIT: {
    id: 'MARS_ORBIT',
    label: 'Mars Orbit & Landing',
    description: 'Arrival, orbit insertion and descent - microgravity until touchdown.',
    gravityG: 0,
    dayLengthHours: null,
    typicalDoseRateMSvPerDay: 1.8,
    commDelay: '4-24 min one-way',
    commDelaySecondsMin: 240,
    commDelaySecondsMax: 1440,
    dustRisk: 'none',
    cabinPsia: 14.7,
    cabinO2Pct: 21,
    notes: ['Prepare for gravity transition: hydrate and plan standing BP checks after landing.'],
    sources: [SOURCES.marsFacts],
  },
  MARS_SURFACE: {
    id: 'MARS_SURFACE',
    label: 'Mars Surface Base',
    description: 'Habitat at 0.38 g; thin CO2 atmosphere outside (avg 6.36 mb).',
    gravityG: 0.38,
    dayLengthHours: 24.65,
    typicalDoseRateMSvPerDay: 0.64,
    commDelay: '4-24 min one-way (2-3 week blackout at solar conjunction)',
    commDelaySecondsMin: 240,
    commDelaySecondsMax: 1440,
    dustRisk: 'moderate',
    cabinPsia: 8.2,
    cabinO2Pct: 34,
    notes: [
      'Sol is ~40 min longer than an Earth day - sleep can drift.',
      '0.38 g is likely not enough to fully protect bone and muscle (estimate).',
      'Fine dust: keep airlock hygiene.',
    ],
    sources: [SOURCES.marsRad, SOURCES.marsFacts, SOURCES.partialGravity, SOURCES.explorationAtmosphere],
  },
  MOON_SURFACE: {
    id: 'MOON_SURFACE',
    label: 'Moon Surface Base',
    description: 'Habitat at 0.165 g with no atmosphere or magnetic field; ~2.6× ISS dose.',
    gravityG: 0.165,
    dayLengthHours: 708,
    typicalDoseRateMSvPerDay: 1.37,
    commDelay: '~1.3 s one-way',
    commDelaySecondsMin: 1.3,
    commDelaySecondsMax: 1.3,
    dustRisk: 'high',
    cabinPsia: 8.2,
    cabinO2Pct: 34,
    notes: [
      '~2 weeks of light then ~2 weeks of dark - use scheduled lighting.',
      '“Lunar hay fever”: dust causes sneezing, watery eyes, sore throat.',
    ],
    sources: [SOURCES.lunarLnd, SOURCES.moonFacts, SOURCES.lunarDust, SOURCES.explorationAtmosphere],
  },
}

/** One-way delay above this (seconds) → act now on onboard guidance, then report. */
export const ACT_THEN_REPORT_DELAY_S = 60

// ── Mission plans (phase schedules) ───────────────────────────────────────

export function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

/** Template phase schedules (reference doc §7). Launch dates are set per crew. */
export const MISSION_TEMPLATES: Record<MissionDestination, Omit<MissionPlan, 'id' | 'launchDate'>> = {
  EARTH_TRAINING: {
    name: 'Pre-flight training (Earth mode)',
    destination: 'EARTH_TRAINING',
    totalDays: 30,
    phases: [{ order: 1, name: 'Earth training', startDay: 0, endDay: 30, environment: 'EARTH', habitat: 'ground' }],
  },
  ISS: {
    name: 'ISS Expedition (180 days)',
    destination: 'ISS',
    totalDays: 180,
    phases: [
      { order: 1, name: 'Launch & docking', startDay: 0, endDay: 2, environment: 'EARTH_ORBIT', habitat: 'spacecraft' },
      { order: 2, name: 'Living on the ISS', startDay: 2, endDay: 178, environment: 'EARTH_ORBIT', habitat: 'station' },
      { order: 3, name: 'Return to Earth', startDay: 178, endDay: 180, environment: 'EARTH_ORBIT', habitat: 'spacecraft' },
    ],
  },
  MOON: {
    name: 'Lunar surface mission (30 days)',
    destination: 'MOON',
    totalDays: 30,
    phases: [
      { order: 1, name: 'Flying to the Moon', startDay: 0, endDay: 3, environment: 'DEEP_SPACE', habitat: 'spacecraft' },
      { order: 2, name: 'Living on the Moon', startDay: 3, endDay: 27, environment: 'MOON_SURFACE', habitat: 'moon_base' },
      { order: 3, name: 'Flying home', startDay: 27, endDay: 30, environment: 'DEEP_SPACE', habitat: 'spacecraft' },
    ],
  },
  MARS: {
    name: 'Mars conjunction-class mission (866 days)',
    destination: 'MARS',
    totalDays: 866,
    phases: [
      { order: 1, name: 'Leaving Earth', startDay: 0, endDay: 3, environment: 'EARTH_ORBIT', habitat: 'spacecraft' },
      { order: 2, name: 'Flying to Mars', startDay: 3, endDay: 183, environment: 'DEEP_SPACE', habitat: 'spacecraft' },
      { order: 3, name: 'Mars orbit and landing', startDay: 183, endDay: 186, environment: 'MARS_ORBIT', habitat: 'spacecraft' },
      { order: 4, name: 'Living on Mars', startDay: 186, endDay: 686, environment: 'MARS_SURFACE', habitat: 'mars_base' },
      { order: 5, name: 'Flying home', startDay: 686, endDay: 866, environment: 'DEEP_SPACE', habitat: 'spacecraft' },
    ],
  },
}

export function buildMissionPlan(id: string, destination: MissionDestination, launchDate: string): MissionPlan {
  const t = MISSION_TEMPLATES[destination]
  return { id, launchDate, ...t, phases: t.phases.map((ph) => ({ ...ph })) }
}

/** Reference doc: bone_loss_per_day = (1.25 / 30) × (1 − gravity_g), % per day. */
export const BONE_LOSS_PCT_PER_DAY_AT_0G = 1.25 / 30

/** Synthetic phases used before launch and after the mission ends. */
export const PRE_LAUNCH_PHASE: MissionPhase = {
  order: 0,
  name: 'Pre-launch (Earth mode)',
  startDay: Number.NEGATIVE_INFINITY,
  endDay: 0,
  environment: 'EARTH',
  habitat: 'ground',
}

export function postMissionPhase(plan: MissionPlan): MissionPhase {
  return {
    order: plan.phases.length + 1,
    name: 'Back on Earth',
    startDay: plan.totalDays,
    endDay: Number.POSITIVE_INFINITY,
    environment: 'EARTH',
    habitat: 'ground',
  }
}

/** Phase active on a (possibly fractional) mission day, including pre-launch / post-mission. */
export function phaseForDay(plan: MissionPlan, day: number): MissionPhase {
  if (day < 0) return PRE_LAUNCH_PHASE
  if (day >= plan.totalDays) return postMissionPhase(plan)
  return plan.phases.find((ph) => day >= ph.startDay && day < ph.endDay) ?? plan.phases[plan.phases.length - 1]
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
      '1) Wash and dry hands. 2) Insert a test strip into the glucometer. 3) Prick the side of a fingertip with a lancet. 4) Touch the drop to the strip (in microgravity the drop clings to your finger - just touch it). 5) Log the number and whether you have eaten in the last 8 hours.',
    whyNeeded:
      'Weightlessness and less physical activity make the body use insulin less effectively - CSA notes effects similar to a sedentary lifestyle and Type-2 diabetes research. A packaged-food diet and stress also shift sugar levels.',
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
      'Fluid shift in microgravity changes blood pressure and is linked to eye and brain changes (SANS). After landing, pressure can drop when standing - fainting risk during gravity transitions.',
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
      'Bones need weight to stay strong. In weightlessness the hips and spine can lose ~1-1.5% of their mineral each month - like years of ageing on Earth - raising fracture and kidney-stone risk.',
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
    unit: '/5',
    hazardLink: 'Isolation and Confinement',
    howToMeasure:
      '1) Find a quiet moment. 2) Ask yourself: “Overall, how am I feeling today?” 3) Tap 1 (very low) to 5 (great). Be honest - this is private unless it needs escalation.',
    whyNeeded:
      'Months in a small, isolated space far from family can lead to low mood, irritability, and team conflict. Spotting changes early lets the crew and support team help before it affects safety.',
    measurableInSpace: true,
  },
  spo2: {
    id: 'spo2',
    system: 'cardiovascular',
    name: 'Blood Oxygen (SpO2)',
    unit: '%',
    hazardLink: 'Hostile Closed Environments',
    howToMeasure:
      '1) Sit still for 1 minute with warm hands. 2) Clip the pulse oximeter on a fingertip (no nail polish). 3) Wait until the number stops changing (~30 s). 4) Log the % value.',
    whyNeeded:
      'Shows how well your blood carries oxygen. Moon and Mars habitats run at lower pressure (8.2 psi, 34% O2), close to the minimum safe oxygen level, so a small drop matters more there. A falling value can also mean a life-support or lung problem (e.g. lunar dust).',
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
  { id: 'log_vitals_am', title: 'Morning vitals: HR, BP, temperature', xp: 20, completed: false, frequency: 'daily', linkedSystem: 'cardiovascular', refreshesIndicator: 'blood_pressure' },
  { id: 'spo2_check', title: 'Pulse-oximeter SpO2 check', xp: 10, completed: false, frequency: 'daily', linkedSystem: 'cardiovascular', refreshesIndicator: 'spo2' },
  { id: 'dosimeter_read', title: 'Read and log personal dosimeter', xp: 10, completed: false, frequency: 'daily', linkedSystem: 'radiation_immune', refreshesIndicator: 'radiation_dose' },
  { id: 'glucose_check', title: 'Fasting blood sugar check', xp: 15, completed: false, frequency: 'daily', linkedSystem: 'metabolic', refreshesIndicator: 'blood_sugar' },
  { id: 'exercise_2h', title: 'Complete 2 h resistive + aerobic exercise', xp: 40, completed: false, frequency: 'daily', linkedSystem: 'musculoskeletal' },
  { id: 'sleep_log', title: 'Log sleep from actigraphy band (target 8.5 h)', xp: 10, completed: false, frequency: 'daily', linkedSystem: 'behavioral', refreshesIndicator: 'sleep_hours' },
  { id: 'mood_checkin', title: 'Mood check-in (1-5)', xp: 10, completed: false, frequency: 'daily', linkedSystem: 'behavioral', refreshesIndicator: 'mood' },
  { id: 'hydration', title: 'Drink ≥ 2 L water', xp: 10, completed: false, frequency: 'daily', linkedSystem: 'metabolic' },
  { id: 'bone_ultrasound', title: 'Guided bone ultrasound scan', xp: 50, completed: false, frequency: 'weekly', linkedSystem: 'musculoskeletal', refreshesIndicator: 'bone_density' },
  { id: 'eye_exam', title: 'Eye/vision check for SANS (OCT or Amsler grid)', xp: 40, completed: false, frequency: 'weekly', linkedSystem: 'cardiovascular' },
  { id: 'family_conference', title: 'Private family video conference', xp: 25, completed: false, frequency: 'weekly', linkedSystem: 'behavioral' },
]

// ── History generation (deterministic) ────────────────────────────────────

/** Small seeded PRNG so trend charts are stable across renders/builds. */
export function mulberry32(seed: number): () => number {
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
    out.push({ day: startDay + i, timestamp: `Day ${startDay + i}`, value: Math.round(value * f) / f, baseline: spec.baseline, source: 'wearable_auto' })
  }
  return out
}

// ── Crew profiles (fictional demo personas) ───────────────────────────────

const HISTORY_DAYS = 14

/** Where each indicator's daily history realistically comes from. */
const HISTORY_SOURCE: Record<IndicatorId, DataModality> = {
  heart_rate: 'wearable_auto',
  body_temp: 'wearable_auto',
  sleep_hours: 'wearable_auto',
  radiation_dose: 'wearable_auto', // personal active dosimeter
  blood_pressure: 'manual_slider',
  blood_sugar: 'manual_slider',
  mood: 'manual_slider',
  bone_density: 'ultrasound_image',
  spo2: 'wearable_auto',
}

function indicator(id: IndicatorId, value: number | string, history: HistoryPoint[]): HealthIndicator {
  const g = INDICATOR_GUIDES[id]
  const source = HISTORY_SOURCE[id]
  return {
    id,
    system: g.system,
    name: g.name,
    value,
    unit: g.unit,
    // Placeholders; recomputed by healthEvaluator at runtime.
    status: 'nominal',
    dataState: 'fresh',
    lastMeasuredDay: history[history.length - 1]?.day,
    trend: 'stable',
    hazardLink: g.hazardLink,
    howToMeasure: g.howToMeasure,
    whyNeeded: g.whyNeeded,
    actionPlan: { level: 'self_care', steps: [] },
    history: history.map((pt) => ({ ...pt, source })),
    simulated: true,
  }
}

/** Personal baseline from the first 7 readings (reference doc §9 scoring). */
function baselineFromHistory(astronautId: string, series: Partial<Record<IndicatorId, HistoryPoint[]>>): PersonalBaseline {
  const values: PersonalBaseline['values'] = {}
  for (const [id, h] of Object.entries(series) as [IndicatorId, HistoryPoint[]][]) {
    const first = h.slice(0, 7).map((pt) => pt.value)
    if (!first.length) continue
    const mean = first.reduce((a, v) => a + v, 0) / first.length
    const sd = Math.sqrt(first.reduce((a, v) => a + (v - mean) ** 2, 0) / first.length)
    values[id] = { mean: Math.round(mean * 100) / 100, sd: Math.round(sd * 100) / 100, n: first.length }
  }
  return { astronautId, source: 'first_7_days', values }
}

interface ProfileSeed {
  id: string
  name: string
  role: string
  crewRole: CrewRole
  agency: AstronautProfile['agency']
  age: number
  sex: AstronautProfile['sex']
  login: string
  destination: MissionDestination
  missionDay: number
  priorCareerDoseMSv: number
  notes: string[]
  seed: number
  hr: TrendSpec
  sys: TrendSpec
  dia: TrendSpec
  glucose: TrendSpec
  temp: TrendSpec
  sleep: TrendSpec
  mood: TrendSpec
  spo2: TrendSpec
}

/** Expected cumulative value at the START of a day, integrating a per-day rate over the phase schedule. */
function integrateOverPhases(plan: MissionPlan, untilDay: number, rate: (env: EnvironmentProfile) => number): number {
  let total = 0
  for (let d = 0; d < untilDay; d++) total += rate(ENVIRONMENTS[phaseForDay(plan, d).environment])
  return total
}

function phaseAwareCumulative(plan: MissionPlan, start: number, days: number, seed: number): HistoryPoint[] {
  const rand = mulberry32(seed)
  let total = integrateOverPhases(plan, start - 1, (e) => e.typicalDoseRateMSvPerDay)
  let expected = total
  const out: HistoryPoint[] = []
  for (let i = 0; i < days; i++) {
    const d = start + i
    const rate = ENVIRONMENTS[phaseForDay(plan, d - 1).environment].typicalDoseRateMSvPerDay
    total += rate + (rand() * 2 - 1) * rate * 0.15
    expected += rate
    out.push({ day: d, timestamp: `Day ${d}`, value: Math.round(total * 100) / 100, baseline: Math.round(expected * 100) / 100, source: 'wearable_auto' })
  }
  return out
}

function phaseAwareBoneLoss(plan: MissionPlan, start: number, days: number, seed: number): HistoryPoint[] {
  const rand = mulberry32(seed)
  const lossRate = (e: EnvironmentProfile) => -BONE_LOSS_PCT_PER_DAY_AT_0G * (1 - e.gravityG)
  let expected = integrateOverPhases(plan, start - 1, lossRate)
  const out: HistoryPoint[] = []
  for (let i = 0; i < days; i++) {
    const d = start + i
    expected += lossRate(ENVIRONMENTS[phaseForDay(plan, d - 1).environment])
    const value = expected + (rand() * 2 - 1) * 0.05
    out.push({ day: d, timestamp: `Day ${d}`, value: Math.round(value * 100) / 100, baseline: 0, source: 'ultrasound_image' })
  }
  return out
}

function buildProfile(p: ProfileSeed): AstronautProfile {
  const mission = buildMissionPlan(`mission-${p.id}`, p.destination, isoDaysAgo(p.missionDay))
  const phase = phaseForDay(mission, p.missionDay)
  const start = Math.max(1, p.missionDay - HISTORY_DAYS + 1)
  const days = p.missionDay - start + 1
  const last = (h: HistoryPoint[]) => h[h.length - 1].value

  const hr = generateHistory(p.hr, days, p.seed + 1, start)
  const sys = generateHistory(p.sys, days, p.seed + 2, start)
  const dia = generateHistory(p.dia, days, p.seed + 3, start)
  const glucose = generateHistory(p.glucose, days, p.seed + 4, start)
  const temp = generateHistory(p.temp, days, p.seed + 5, start)
  const sleep = generateHistory(p.sleep, days, p.seed + 6, start)
  const mood = generateHistory(p.mood, days, p.seed + 7, start)
  const spo2 = generateHistory(p.spo2, days, p.seed + 10, start)
  // Radiation + bone follow the phase schedule day by day (the body's "bank account").
  const radiation = phaseAwareCumulative(mission, start, days, p.seed + 8)
  const bone = phaseAwareBoneLoss(mission, start, days, p.seed + 9)

  return {
    id: p.id,
    name: p.name,
    role: p.role,
    crewRole: p.crewRole,
    agency: p.agency,
    age: p.age,
    sex: p.sex,
    login: p.login,
    mission,
    environment: phase.environment,
    habitat: phase.habitat,
    missionDay: p.missionDay,
    missionLengthDays: mission.totalDays,
    priorCareerDoseMSv: p.priorCareerDoseMSv,
    notes: p.notes,
    baseline: baselineFromHistory(p.id, { heart_rate: hr, blood_pressure: sys, blood_sugar: glucose, body_temp: temp, sleep_hours: sleep, mood, spo2 }),
    indicators: [
      indicator('heart_rate', last(hr), hr),
      // Chart series for BP tracks systolic; value carries both numbers.
      indicator('blood_pressure', `${Math.round(last(sys))}/${Math.round(last(dia))}`, sys),
      indicator('blood_sugar', last(glucose), glucose),
      indicator('body_temp', last(temp), temp),
      indicator('spo2', last(spo2), spo2),
      indicator('sleep_hours', last(sleep), sleep),
      indicator('mood', last(mood), mood),
      indicator('radiation_dose', last(radiation), radiation),
      indicator('bone_density', last(bone), bone),
    ],
    routine: DEFAULT_ROUTINE.map((t) => ({ ...t })),
  }
}

export interface EmptyProfileSeed {
  id: string
  name: string
  role: string
  crewRole: CrewRole
  agency?: AstronautProfile['agency']
  age?: number
  sex?: AstronautProfile['sex']
  login: string
  destination: MissionDestination
  launchDate: string
  missionDay: number
  notes?: string[]
}

/**
 * New astronaut created by admin: no readings yet, so every indicator is
 * value null / dataState 'missing' (renders grey) until Earth-mode check-ins.
 */
export function buildEmptyProfile(p: EmptyProfileSeed): AstronautProfile {
  const mission = buildMissionPlan(`mission-${p.id}`, p.destination, p.launchDate)
  const phase = phaseForDay(mission, p.missionDay)
  const ids = Object.keys(INDICATOR_GUIDES) as IndicatorId[]
  return {
    id: p.id,
    name: p.name,
    role: p.role,
    crewRole: p.crewRole,
    agency: p.agency ?? 'NASA',
    age: p.age ?? 40,
    sex: p.sex ?? 'female',
    login: p.login,
    mission,
    environment: phase.environment,
    habitat: phase.habitat,
    missionDay: p.missionDay,
    missionLengthDays: mission.totalDays,
    priorCareerDoseMSv: 0,
    notes: p.notes ?? [],
    baseline: { astronautId: p.id, source: 'population_default', values: {} },
    indicators: ids.map((id) => ({ ...indicator(id, 0, []), value: null, dataState: 'missing' as const, lastMeasuredDay: undefined, simulated: false })),
    routine: DEFAULT_ROUTINE.map((t) => ({ ...t })),
  }
}

/**
 * Fictional, SIMULATED demo crew (real daily vitals are not public - NASA LSDA
 * holds them by request only). Logins match the reference doc's demo accounts.
 */
export const CREW_PROFILES: AstronautProfile[] = [
  buildProfile({
    id: 'crew-iss',
    name: 'Cmdr. Maya Okafor',
    role: 'Commander',
    crewRole: 'commander',
    agency: 'NASA',
    age: 44,
    sex: 'female',
    login: 'iss_crew',
    destination: 'ISS',
    missionDay: 92,
    priorCareerDoseMSv: 85,
    notes: ['No known allergies.'],
    seed: 101,
    hr: { baseline: 62, drift: 0, noise: 3, decimals: 0 },
    sys: { baseline: 110, drift: 0.1, noise: 4, decimals: 0 }, // in-flight BP runs ~8-10 mmHg lower
    dia: { baseline: 70, drift: 0, noise: 3, decimals: 0 },
    glucose: { baseline: 92, drift: 0, noise: 6, decimals: 0 },
    temp: { baseline: 37.4, drift: 0, noise: 0.2, decimals: 1 }, // past day 60 in 0 g: ~+1 °C core shift
    sleep: { baseline: 6.3, drift: 0, noise: 0.5, decimals: 1 }, // ISS average ~6 h
    mood: { baseline: 4.3, drift: 0, noise: 0.5, decimals: 0 },
    spo2: { baseline: 98, drift: 0, noise: 0.8, decimals: 0 },
  }),
  buildProfile({
    id: 'crew-mars',
    name: 'Dr. Étienne Lavoie',
    role: 'Flight Engineer / Crew Medical Officer',
    crewRole: 'medical_officer',
    agency: 'CSA',
    age: 39,
    sex: 'male',
    login: 'mars_crew',
    destination: 'MARS',
    missionDay: 45, // "Day 45 · Flying to Mars"
    priorCareerDoseMSv: 120,
    notes: ['Penicillin allergy.'],
    seed: 202,
    hr: { baseline: 68, drift: 0.4, noise: 3, decimals: 0 },
    sys: { baseline: 116, drift: 0.5, noise: 4, decimals: 0 },
    dia: { baseline: 76, drift: 0.2, noise: 3, decimals: 0 },
    glucose: { baseline: 96, drift: 1.2, noise: 6, decimals: 0 },
    temp: { baseline: 37.0, drift: 0.01, noise: 0.2, decimals: 1 },
    sleep: { baseline: 6.4, drift: -0.03, noise: 0.5, decimals: 1 },
    mood: { baseline: 3.6, drift: -0.03, noise: 0.4, decimals: 0 },
    spo2: { baseline: 97, drift: 0, noise: 0.8, decimals: 0 },
  }),
  buildProfile({
    id: 'crew-moon',
    name: 'Spc. Kenji Arai',
    role: 'Mission Specialist / Geologist',
    crewRole: 'specialist',
    agency: 'JAXA',
    age: 35,
    sex: 'male',
    login: 'moon_crew',
    destination: 'MOON',
    missionDay: 21,
    priorCareerDoseMSv: 40,
    notes: ['Naturally low resting BP.', 'Dust sensitivity reported on day 9 (sneezing, watery eyes).'],
    seed: 303,
    hr: { baseline: 74, drift: 1.5, noise: 4, decimals: 0 },
    sys: { baseline: 112, drift: 0, noise: 5, decimals: 0 },
    dia: { baseline: 72, drift: 0, noise: 3, decimals: 0 },
    glucose: { baseline: 98, drift: 0, noise: 7, decimals: 0 },
    temp: { baseline: 37.1, drift: 0.11, noise: 0.15, decimals: 1 },
    sleep: { baseline: 6.0, drift: -0.08, noise: 0.4, decimals: 1 },
    mood: { baseline: 4.4, drift: -0.08, noise: 0.4, decimals: 0 },
    spo2: { baseline: 96, drift: -0.15, noise: 0.6, decimals: 0 }, // 8.2 psia habitat + dust
  }),
]

export const HAZARD_BY_NAME: Record<HazardName, SpaceflightHazard> = Object.fromEntries(
  SPACEFLIGHT_HAZARDS.map((h) => [h.name, h]),
) as Record<HazardName, SpaceflightHazard>
