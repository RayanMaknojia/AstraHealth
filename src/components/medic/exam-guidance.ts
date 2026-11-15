/** UI guidance only. Uses existing onboard procedures; does not diagnose or score exam findings. */
export const EXAM_GUIDES = [
  {
    id: "circulation",
    label: "Circulation",
    title: "Circulation examination",
    procedureId: "blood_pressure",
    steps: [
      "Review symptoms and recent heart-rate and blood-pressure readings with a crewmate.",
      "Rest and use the approved blood-pressure procedure below to take a measurement when needed.",
      "Record the examination result. For new chest pain, fainting or a marked change, follow onboard triage and escalation guidance.",
    ],
  },
  {
    id: "breathing",
    label: "Breathing",
    title: "Breathing examination",
    steps: [
      "Rest comfortably and tell your crewmate about any breathlessness, cough or chest discomfort.",
      "Observe breathing at rest and review available oxygen and breathing-sensor readings. Do not invent a missing measurement.",
      "Check cabin air information and record changes. New or severe breathing difficulty needs immediate onboard medical guidance.",
    ],
  },
  {
    id: "skin",
    label: "Skin",
    title: "Skin examination",
    procedureId: "wound_care",
    steps: [
      "With consent, inspect the area of concern in good light and note its location and any pain or change.",
      "For a cut or wound, follow the approved wound-care procedure below. Use Photo Check for a first-look assessment if appropriate.",
      "Record the finding and follow onboard guidance for spreading redness, worsening pain, burns or other concerning changes.",
    ],
  },
  {
    id: "movement",
    label: "Movement",
    title: "Movement examination",
    steps: [
      "Use a stable restraint or support and ask a crewmate to assist. Describe any pain, weakness or difficulty moving.",
      "Check comfortable, gentle movement of the affected area. Stop if it causes pain or dizziness; do not perform a new loaded test.",
      "Review the exercise and countermeasure record, then document any limitation and seek crew medical guidance for a new deficit.",
    ],
  },
  {
    id: "sleep",
    label: "Sleep",
    title: "Sleep assessment",
    steps: [
      "Review recent watch sleep duration and your own sleep-quality and fatigue ratings.",
      "Discuss interruptions, shift timing, cabin light or noise, and medicines with your crewmate or medical officer as appropriate.",
      "Record concerns and follow the sleep and workload guidance for fatigue. Use the journal privately if you wish; sharing it is not required.",
    ],
  },
  {
    id: "crew-wellbeing",
    label: "Crew wellbeing",
    title: "Crew wellbeing assessment",
    steps: [
      "Choose a private, respectful setting and ask how the crewmate is coping with workload, stress and team dynamics.",
      "Review self-reported mood, stress and team-cohesion ratings with consent. Do not require access to a private journal.",
      "Record the agreed examination outcome. Escalate an immediate safety concern through onboard medical procedures and offer appropriate support.",
    ],
  },
  {
    id: "eye-exam",
    label: "Eye Exam (SANS / visual acuity & ocular check)",
    title: "Eye Exam: SANS, visual acuity and ocular check",
    procedureId: "eye_ultrasound",
    steps: [
      "Use the approved onboard visual-acuity chart at its specified distance and with the usual corrective lenses. Have a trained crewmate assist.",
      "Check each eye as directed by the approved protocol and report new blur, distortion, discomfort or other visual change.",
      "Perform an ocular assessment or eye ultrasound only with the approved equipment and trained guidance below. Do not press on the eye.",
      "Record whether a change was noticed and follow the crew medical or flight-surgeon review procedure. This checklist does not diagnose SANS.",
    ],
  },
] as const;
export type ExamGuideId = (typeof EXAM_GUIDES)[number]["id"];
