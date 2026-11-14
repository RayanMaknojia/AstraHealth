/**
 * Phase 3 reference data: check-in schedule, gamification, exercise / body mass /
 * reaction rules, Photo Check guidance, triage trees, procedures and the demo
 * medical kit. Rules match health_rules.md ("Coming in Phase 3" table) and
 * astronaut_health_monitor_pages.md. Demo crew data is fictional and SIMULATED.
 */

import { isoDaysAgo } from '@/data/nasaSpaceflightData'
import type {
  BadgeId,
  CheckinScheduleItem,
  CheckinSlot,
  GuidedProcedure,
  Medication,
  SkinLabel,
  StatusLevel,
  TriageSymptom,
  TriageTree,
  UltrasoundScanType,
} from '@/types/astronaut'

// ── Check-in schedule (pages doc §3, based on ISS practice) ────────────────

export const CHECKIN_SCHEDULE: Record<CheckinSlot, CheckinScheduleItem> = {
  morning: {
    slot: 'morning',
    title: 'Morning check-in',
    required: true,
    estMinutes: 2,
    fields: ['Sleep hours', 'Sleep quality (1–5)', 'Mood (1–5)', 'Resting heart rate', 'Blood pressure', 'Temperature', 'SpO2', 'Symptoms checklist'],
  },
  evening: {
    slot: 'evening',
    title: 'Evening check-in',
    required: false,
    estMinutes: 1,
    fields: ['Fatigue (1–5)', 'Nausea / appetite (1–5)', 'Exercise minutes and type', 'Headache (yes / no)', 'Notes'],
  },
  weekly: {
    slot: 'weekly',
    title: 'Weekly check',
    required: true,
    estMinutes: 5,
    fields: ['Body mass', 'Food log questionnaire', 'Fasting blood glucose', '60-second reaction test'],
  },
  monthly: {
    slot: 'monthly',
    title: 'Monthly health exam',
    required: true,
    estMinutes: 15,
    fields: ['Guided full health exam with a crewmate', 'Sleep and team questionnaire'],
  },
  eye_exam: {
    slot: 'eye_exam',
    title: 'Eye exam',
    required: true,
    estMinutes: 10,
    fields: ['Vision test (on-screen chart and Amsler grid)', 'Guided eye ultrasound'],
  },
}

/** Days 30 and 90, then every 90 days (pages doc §3). */
export function eyeExamDays(totalDays: number): number[] {
  const out = [30]
  for (let d = 90; d <= totalDays; d += 90) out.push(d)
  return out.filter((d) => d <= totalDays)
}

export const MONTHLY_EVERY_DAYS = 30
export const WEEK_DAYS = 7

// ── Gamification (pages doc §7) ────────────────────────────────────────────

export const BADGE_DEFS: Record<BadgeId, { label: string; description: string; team: boolean }> = {
  streak_7: { label: '7-day streak', description: 'Morning check-in 7 days in a row', team: false },
  streak_30: { label: '30-day streak', description: 'Morning check-in 30 days in a row', team: false },
  streak_100: { label: '100-day streak', description: 'Morning check-in 100 days in a row', team: false },
  weekly_all: { label: 'All weekly tasks', description: 'Every weekly task done this week', team: false },
  monthly_exam: { label: 'Monthly exam', description: 'Monthly health exam done', team: false },
  exercise_6: { label: 'Exercise goal', description: 'Exercise goal met 6 days in a week', team: false },
  team_steady_orbit: { label: 'Steady Orbit', description: 'Crew check-ins ≥ 90% this week', team: true },
}

export const TEAM_GOAL_PCT = 90

// ── Exercise, body mass, reaction (health_rules.md Phase 3 table) ──────────

export const EXERCISE_RULES = {
  /** ISS crews: ~2 h per day. */
  goalMinutes: 120,
  watchBelowMinutes: 120,
  alertBelowMinutes: 60,
  alertConsecutiveDays: 3,
  /** Goal days per week (ISS: 6 days on, 1 off). */
  daysPerWeekGoal: 6,
} as const

export const BODY_MASS_RULES = {
  /** % change from preflight: Normal within 3%, Watch 3–5% loss, Alert > 5% loss. */
  watchLossPct: 3,
  alertLossPct: 5,
  /** Large gain is also worth a look (fluid, diet). */
  watchGainPct: 5,
} as const

export const REACTION_RULES = {
  /** Slower than baseline: Normal ≤ 10%, Watch 10–20%, Alert > 20%. */
  watchSlowerPct: 10,
  alertSlowerPct: 20,
  /** Tests used to set the baseline (Earth mode / first tests). */
  baselineTests: 3,
} as const

/**
 * No-exercise bone loss is estimated at 1.5× the countermeasure rate in the reference doc formula
 * (bed-rest / early-ISS data). Estimate — label it as such in the UI.
 */
export const BONE_NO_EXERCISE_MULTIPLIER = 1.5

/** Simulated demo crew history so streaks, leaderboard and exercise pages have data. */
export const DEMO_CREW_ACTIVITY: Record<string, { streakDays: number; missedDaysAgo: number[]; exerciseCompliance: number; preflightKg: number; massTrendPctPerWeek: number; reactionBaselineMs: number }> = {
  'crew-iss': { streakDays: 32, missedDaysAgo: [33, 40], exerciseCompliance: 0.95, preflightKg: 64.5, massTrendPctPerWeek: -0.15, reactionBaselineMs: 285 },
  'crew-mars': { streakDays: 21, missedDaysAgo: [22, 29, 31], exerciseCompliance: 0.75, preflightKg: 78.2, massTrendPctPerWeek: -0.4, reactionBaselineMs: 290 },
  'crew-moon': { streakDays: 9, missedDaysAgo: [10, 14], exerciseCompliance: 0.55, preflightKg: 71.0, massTrendPctPerWeek: -0.6, reactionBaselineMs: 300 },
}

// ── Photo Check (pages doc §4) ─────────────────────────────────────────────

export const SKIN_CONFIDENCE_MIN = 0.7

export const SKIN_LABELS: Record<SkinLabel, string> = {
  laceration: 'Laceration (cut)',
  burn: 'Burn',
  bruise: 'Bruise',
  abrasion: 'Abrasion (scrape)',
  normal: 'Normal skin',
  unsure: 'Unsure',
}

/** Offline "first look" keywords (file name + notes). The real onboard model would replace this. */
export const SKIN_KEYWORDS: Record<Exclude<SkinLabel, 'unsure'>, string[]> = {
  laceration: ['cut', 'lacer', 'slice', 'gash', 'cable', 'blade', 'knife', 'sharp', 'bleed'],
  burn: ['burn', 'scald', 'hot', 'heater', 'blister', 'thermal'],
  bruise: ['bruise', 'bump', 'hit', 'knock', 'contusion', 'purple'],
  abrasion: ['scrape', 'graze', 'abrasion', 'rub', 'friction', 'scuff'],
  normal: ['normal', 'healthy', 'baseline', 'clear', 'checkup'],
}

export const SKIN_GUIDANCE: Record<SkinLabel, { status: StatusLevel; firstAid: string[]; escalateWhen: string[] }> = {
  laceration: {
    status: 'caution',
    firstAid: ['Clean with saline.', 'Apply firm pressure for 10 minutes.', 'Close small cuts with adhesive strips.', 'Cover with a sterile dressing.'],
    escalateWhen: ['Bleeding for more than 10 minutes', 'Deep or gaping wound', 'Signs of infection (redness spreading, pus, fever)'],
  },
  burn: {
    status: 'caution',
    firstAid: ['Cool with clean water for 20 minutes (no ice).', 'Remove rings or tight items nearby.', 'Cover loosely with a non-stick dressing.', 'Do not pop blisters.'],
    escalateWhen: ['Larger than your palm', 'On the face, hands, joints or genitals', 'White, leathery or painless skin', 'Signs of infection'],
  },
  bruise: {
    status: 'nominal',
    firstAid: ['Cold pack for 15 minutes, several times today.', 'Rest the area.'],
    escalateWhen: ['Very painful or swelling fast', 'Can’t move the joint', 'Bruising with no injury (possible bleeding problem)'],
  },
  abrasion: {
    status: 'caution',
    firstAid: ['Rinse with saline and remove debris.', 'Apply antibiotic ointment from the kit.', 'Cover with a breathable dressing; change daily.'],
    escalateWhen: ['Debris you can’t remove', 'Signs of infection', 'Not healing after 5 days'],
  },
  normal: {
    status: 'nominal',
    firstAid: ['No treatment needed.', 'Re-photograph if anything changes.'],
    escalateWhen: ['New redness, swelling, rash or pain'],
  },
  unsure: {
    status: 'caution',
    firstAid: ['Keep the area clean and covered.', 'Take another photo in good light, 15–20 cm away, without flash glare.'],
    escalateWhen: ['Sent to the flight surgeon for review — escalate sooner if it gets worse.'],
  },
}

export const ULTRASOUND_GUIDES: Record<UltrasoundScanType, { label: string; bodyLocation: string; steps: string[]; goodImage: string }> = {
  eye: {
    label: 'Eye (optic nerve sheath)',
    bodyLocation: 'Eye',
    steps: ['Close the eye; put a thick layer of gel on the closed eyelid.', 'Hold the probe lightly across the lid — no pressure on the eye.', 'Tilt slowly until the dark optic nerve appears behind the eyeball.', 'Hold still and capture.'],
    goodImage: 'Round dark eyeball with a dark stripe (optic nerve) straight behind it.',
  },
  neck_vein: {
    label: 'Neck vein (internal jugular)',
    bodyLocation: 'Neck',
    steps: ['Turn your head slightly away from the side being scanned.', 'Place the probe across the neck, just above the collarbone.', 'Find the round artery and the larger, squashable vein next to it.', 'Capture without pressing (pressing flattens the vein).'],
    goodImage: 'Two dark circles: a small round artery and a larger oval vein.',
  },
  heart: {
    label: 'Heart (parasternal view)',
    bodyLocation: 'Chest',
    steps: ['Lie or strap in on your back.', 'Place the probe left of the breastbone, 3rd–4th rib space, marker toward the right shoulder.', 'Angle until all four chambers or the long axis appear.', 'Capture a still image at the end of breathing out.'],
    goodImage: 'Moving heart walls and valves clearly visible, chambers dark.',
  },
  bladder: {
    label: 'Bladder',
    bodyLocation: 'Lower abdomen',
    steps: ['Place the probe just above the pubic bone, pointing slightly down.', 'Find the dark, fluid-filled bladder.', 'Capture both a sideways and an up-down view.'],
    goodImage: 'Dark rounded bladder with a clear bright outline.',
  },
  other: {
    label: 'Other (as instructed by the flight surgeon)',
    bodyLocation: 'Other',
    steps: ['Follow the flight surgeon’s written instructions.', 'Use plenty of gel and light pressure.', 'Capture still images from two directions.'],
    goodImage: 'Area of interest in the centre, not too dark or blurry.',
  },
}

/** Quality-check thresholds on browser pixel stats (photoCheckService.computeImageStats). */
export const IMAGE_QUALITY = { minBrightness: 35, maxBrightness: 225, minSharpness: 40, minBytes: 2_000 } as const

// ── Guidance and triage (pages doc §11) ────────────────────────────────────

const q = (id: string, question: string, yes: string, no: string) => ({ kind: 'question' as const, id, question, yes, no })
const o = (id: string, level: 'self_care' | 'crew_alert' | 'flight_surgeon', title: string, steps: string[]) => ({ kind: 'outcome' as const, id, level, title, steps })

export const TRIAGE_TREES: Record<TriageSymptom, TriageTree> = {
  headache: {
    symptom: 'headache',
    label: 'Headache',
    start: 'h1',
    nodes: {
      h1: q('h1', 'Is it the worst headache of your life, or did it start suddenly like a thunderclap?', 'h_er', 'h2'),
      h2: q('h2', 'Do you have vision changes, weakness, confusion or trouble speaking?', 'h_er', 'h3'),
      h3: q('h3', 'Is cabin CO2 above 2.8 mmHg, or do others have headaches too?', 'h_air', 'h4'),
      h4: q('h4', 'Has it lasted more than 24 hours or kept coming back for 3 days?', 'h_crew', 'h_self'),
      h_er: o('h_er', 'flight_surgeon', 'Possible serious problem', ['Stop work and lie or strap in.', 'Tell the crew medical officer now.', 'Record BP, HR and SpO2.', 'Escalate to the ground immediately.']),
      h_air: o('h_air', 'crew_alert', 'Likely from cabin air', ['Move to a better-ventilated module.', 'Check CO2 scrubber status.', 'Re-check in 1 hour.']),
      h_crew: o('h_crew', 'crew_alert', 'Ongoing headache', ['Tell the crew medical officer.', 'Check BP and do a vision check (SANS).', 'Log it in today’s check-in.']),
      h_self: o('h_self', 'self_care', 'Mild headache', ['Drink 500 mL of water.', 'Take a pain reliever from the kit as directed.', 'Rest and check again in 2 hours.']),
    },
  },
  chest_pain: {
    symptom: 'chest_pain',
    label: 'Chest pain',
    start: 'c1',
    nodes: {
      c1: q('c1', 'Is the pain crushing or spreading to the arm, jaw or back, or are you short of breath or sweating?', 'c_er', 'c2'),
      c2: q('c2', 'Is your heart rate over 120 or below 40, or SpO2 below 90%?', 'c_er', 'c3'),
      c3: q('c3', 'Does it hurt more when you press on the spot or move your arm?', 'c_mus', 'c_crew'),
      c_er: o('c_er', 'flight_surgeon', 'Possible heart or lung emergency', ['Stop all activity and strap in.', 'Call the crew medical officer and press SOS.', 'Record ECG, BP, HR and SpO2.', 'Follow the cardiac emergency procedure.']),
      c_mus: o('c_mus', 'self_care', 'Likely muscle strain', ['Rest the area.', 'Cold pack for 15 minutes.', 'Re-check if it changes or you feel short of breath.']),
      c_crew: o('c_crew', 'crew_alert', 'Unexplained chest pain', ['Tell the crew medical officer now.', 'Record ECG, BP and HR.', 'Rest until it is checked.']),
    },
  },
  dizziness: {
    symptom: 'dizziness',
    label: 'Dizziness',
    start: 'd1',
    nodes: {
      d1: q('d1', 'Did you faint or nearly faint?', 'd_crew', 'd2'),
      d2: q('d2', 'Did you land in gravity in the last 2 weeks, or does it happen when you stand up?', 'd_orth', 'd3'),
      d3: q('d3', 'Does it come with nausea and happen when you move your head (first days in 0 g)?', 'd_sms', 'd_self'),
      d_crew: o('d_crew', 'crew_alert', 'Fainting', ['Lie down with legs raised (in gravity).', 'Tell the crew medical officer.', 'Do the standing BP test.']),
      d_orth: o('d_orth', 'crew_alert', 'Low BP on standing (re-adaptation)', ['Rise slowly; sit first, then stand.', 'Drink fluids with salt tablets.', 'Wear compression garments.', 'Do the standing BP test daily.']),
      d_sms: o('d_sms', 'self_care', 'Space motion sickness', ['Move your head slowly.', 'Keep a fixed visual reference.', 'Use anti-nausea medicine from the kit if needed.']),
      d_self: o('d_self', 'self_care', 'Mild dizziness', ['Sit or strap in.', 'Drink water.', 'Check BP and blood sugar.']),
    },
  },
  nausea: {
    symptom: 'nausea',
    label: 'Nausea',
    start: 'n1',
    nodes: {
      n1: q('n1', 'Are you vomiting repeatedly, or is there blood?', 'n_crew', 'n2'),
      n2: q('n2', 'Is it your first 3 days in 0 g, or does head movement make it worse?', 'n_sms', 'n3'),
      n3: q('n3', 'Do you also have a fever or belly pain?', 'n_crew', 'n_self'),
      n_crew: o('n_crew', 'crew_alert', 'Needs a check', ['Tell the crew medical officer.', 'Sip fluids; record temperature.', 'Escalate if it doesn’t settle in 6 hours.']),
      n_sms: o('n_sms', 'self_care', 'Space motion sickness', ['Move slowly; limit head turns.', 'Small, bland meals.', 'Anti-nausea medicine from the kit as directed.']),
      n_self: o('n_self', 'self_care', 'Mild nausea', ['Small sips of water.', 'Rest and re-check in 2 hours.']),
    },
  },
  burn: {
    symptom: 'burn',
    label: 'Burn',
    start: 'b1',
    nodes: {
      b1: q('b1', 'Is it bigger than your palm, or on the face, hands, joints or genitals?', 'b_crew', 'b2'),
      b2: q('b2', 'Is the skin white, leathery or painless?', 'b_crew', 'b_self'),
      b_crew: o('b_crew', 'flight_surgeon', 'Serious burn', ['Cool with water for 20 minutes.', 'Cover loosely with non-stick dressing.', 'Take a Photo Check and send for review.', 'Tell the crew medical officer.']),
      b_self: o('b_self', 'self_care', 'Minor burn', ['Cool with water for 20 minutes.', 'Cover loosely; don’t pop blisters.', 'Take a Photo Check to track healing.']),
    },
  },
  cut: {
    symptom: 'cut',
    label: 'Cut',
    start: 'k1',
    nodes: {
      k1: q('k1', 'Is it bleeding after 10 minutes of firm pressure?', 'k_crew', 'k2'),
      k2: q('k2', 'Is it deep, gaping, or longer than 2 cm?', 'k_crew', 'k_self'),
      k_crew: o('k_crew', 'crew_alert', 'Needs closing', ['Keep firm pressure on it.', 'Tell the crew medical officer.', 'Take a Photo Check and send for review.']),
      k_self: o('k_self', 'self_care', 'Small cut', ['Clean with saline.', 'Close with adhesive strips and cover.', 'Take a Photo Check to track healing.']),
    },
  },
  eye_change: {
    symptom: 'eye_change',
    label: 'Eye or vision change',
    start: 'e1',
    nodes: {
      e1: q('e1', 'Did you lose vision suddenly, or see flashes or a curtain?', 'e_er', 'e2'),
      e2: q('e2', 'Is it blurry near vision or a change over days (possible SANS)?', 'e_sans', 'e3'),
      e3: q('e3', 'Is there something in your eye (dust, debris)?', 'e_debris', 'e_self'),
      e_er: o('e_er', 'flight_surgeon', 'Urgent eye problem', ['Stop work.', 'Tell the crew medical officer now.', 'Escalate to the ground immediately.']),
      e_sans: o('e_sans', 'crew_alert', 'Possible SANS', ['Do the vision test (chart + Amsler grid).', 'Do the guided eye ultrasound.', 'Send both for review.']),
      e_debris: o('e_debris', 'self_care', 'Debris in the eye', ['Don’t rub.', 'Flush with the eyewash kit.', 'Tell a crewmate if it isn’t better in 1 hour.']),
      e_self: o('e_self', 'self_care', 'Mild eye irritation', ['Use lubricating drops.', 'Rest your eyes from screens.', 'Re-check tomorrow.']),
    },
  },
  fever: {
    symptom: 'fever',
    label: 'Fever',
    start: 'f1',
    nodes: {
      f1: q('f1', 'Is your temperature 38.5 °C or higher?', 'f2', 'f_self'),
      f2: q('f2', 'Do you have a stiff neck, rash, confusion or trouble breathing?', 'f_er', 'f_crew'),
      f_er: o('f_er', 'flight_surgeon', 'Possible serious infection', ['Tell the crew medical officer now.', 'Record temperature, HR, BP and SpO2.', 'Escalate to the ground immediately.']),
      f_crew: o('f_crew', 'crew_alert', 'Fever', ['Take a fever reducer from the kit as directed.', 'Wear a mask; limit contact.', 'Drink fluids; re-check every 2 hours.']),
      f_self: o('f_self', 'self_care', 'Slightly raised temperature', ['Rest and hydrate.', 'Remember: resting temperature runs higher after 60 days in 0 g.', 'Re-check in 4 hours.']),
    },
  },
}

export const PROCEDURES: GuidedProcedure[] = [
  { id: 'blood_pressure', title: 'Taking blood pressure', steps: ['Rest 5 minutes, arm relaxed at heart level.', 'Wrap the cuff 2 cm above the elbow crease.', 'Press start and stay still and silent.', 'Log both numbers.'], tips: ['Use a foot restraint to stay still in 0 g.', 'Measure at the same time each morning.'] },
  { id: 'eye_ultrasound', title: 'Guided eye ultrasound', steps: ['Close the eye and apply thick gel to the lid.', 'Rest the probe lightly across the lid.', 'Tilt to find the optic nerve behind the eyeball.', 'Capture a still image.'], tips: ['Never press on the eye.', 'Scan both eyes.'] },
  { id: 'wound_care', title: 'Wound care', steps: ['Wash hands and put on gloves.', 'Rinse the wound with saline.', 'Apply pressure until bleeding stops.', 'Close with strips if small; cover with a dressing.', 'Take a Photo Check.'], tips: ['Capture loose fluid and debris with gauze in 0 g.', 'Change the dressing daily.'] },
  { id: 'standing_bp', title: 'Standing BP test (after landing)', steps: ['Lie down for 5 minutes and measure BP and HR.', 'Stand up (a crewmate stands by).', 'Measure again at 1 minute and at 3 minutes.', 'Log all three readings and any dizziness.'], tips: ['A drop of 20 mmHg systolic, or feeling faint, means sit down and tell the crew medical officer.'] },
]

/** Demo medical kit. Expiry dates are relative to today so the colours always demo well. */
export const MEDICATIONS: Medication[] = [
  { id: 'med-acet', name: 'Acetaminophen 500 mg', use: 'Pain, fever', qtyLeft: 40, unit: 'tablets', expiryDate: isoDaysAgo(-400), spaceNote: 'Some medicines may be absorbed differently in space and degrade faster with radiation.' },
  { id: 'med-ibu', name: 'Ibuprofen 200 mg', use: 'Pain, inflammation', qtyLeft: 8, unit: 'tablets', expiryDate: isoDaysAgo(-220) },
  { id: 'med-prom', name: 'Promethazine 25 mg', use: 'Motion sickness, nausea', qtyLeft: 12, unit: 'tablets', expiryDate: isoDaysAgo(-20), spaceNote: 'Can cause drowsiness — no piloting or EVA after taking.' },
  { id: 'med-zolp', name: 'Zolpidem 5 mg', use: 'Sleep aid (as advised by flight surgeon)', qtyLeft: 15, unit: 'tablets', expiryDate: isoDaysAgo(-180) },
  { id: 'med-abx', name: 'Antibiotic ointment', use: 'Cuts, scrapes', qtyLeft: 2, unit: 'tubes', expiryDate: isoDaysAgo(3) },
  { id: 'med-saline', name: 'Sterile saline', use: 'Wound and eye rinse', qtyLeft: 10, unit: 'pouches', expiryDate: isoDaysAgo(-600) },
  { id: 'med-lube', name: 'Lubricating eye drops', use: 'Dry or irritated eyes', qtyLeft: 6, unit: 'vials', expiryDate: isoDaysAgo(-90) },
]

export const MEDICATION_RULES = { expiringWithinDays: 30, lowStockAtOrBelow: 5 } as const
