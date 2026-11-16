/**
 * Guidance and Triage (pages doc §11): offline help when Earth is too far away.
 *  A. Symptom checker - yes/no decision trees → plain-English steps + a colour
 *     (self care / tell a crewmate / contact the ground).
 *  B. Guided procedures (BP, eye ultrasound, wound care, standing BP test).
 *  C. Medication list with expiry / low-stock colours.
 *  D. Escalation rule set automatically by Earth delay.
 * Decision support, not diagnosis.
 */

import { MEDICATIONS, MEDICATION_RULES as MR, PROCEDURES, TRIAGE_TREES } from '@/data/phase3Data'
import { ESCALATION_MODE_LABELS } from '@/services/healthEvaluator'
import { createStore } from '@/services/_store'
import type {
  ActionLevel,
  GuidedProcedure,
  MedicationStatus,
  MissionState,
  StatusLevel,
  TriageNode,
  TriageOutcome,
  TriageSymptom,
  TriageTree,
} from '@/types/astronaut'

export const TRIAGE_LEVEL_LABELS: Record<ActionLevel, string> = {
  self_care: 'Self care',
  crew_alert: 'Tell a crewmate',
  flight_surgeon: 'Contact the ground',
}

export const TRIAGE_LEVEL_STATUS: Record<ActionLevel, StatusLevel> = {
  self_care: 'nominal',
  crew_alert: 'caution',
  flight_surgeon: 'critical',
}

export function listTriageSymptoms(): { symptom: TriageSymptom; label: string }[] {
  return (Object.values(TRIAGE_TREES) as TriageTree[]).map((t) => ({ symptom: t.symptom, label: t.label }))
}

export function startTriage(symptom: TriageSymptom): TriageNode {
  const tree = TRIAGE_TREES[symptom]
  return tree.nodes[tree.start]
}

/** Answer the current question; returns the next question or the outcome. */
export function answerTriage(symptom: TriageSymptom, nodeId: string, yes: boolean): TriageNode {
  const tree = TRIAGE_TREES[symptom]
  const node = tree.nodes[nodeId]
  if (!node) throw new Error(`Unknown triage step "${nodeId}".`)
  if (node.kind === 'outcome') return node
  return tree.nodes[yes ? node.yes : node.no]
}

/**
 * Outcome adjusted for Earth delay: "contact the ground" becomes
 * "follow these steps now, then report" on long-delay legs.
 */
export function triageOutcomeForMission(outcome: TriageOutcome, missionState?: MissionState): TriageOutcome & { escalationText: string; status: StatusLevel } {
  const mode = missionState?.escalationMode ?? 'contact_ground'
  const escalationText =
    outcome.level === 'flight_surgeon'
      ? mode === 'act_then_report'
        ? 'Earth is too far for a live answer: follow these steps now, then report.'
        : ESCALATION_MODE_LABELS.contact_ground + '.'
      : outcome.level === 'crew_alert'
        ? 'Tell the crew medical officer.'
        : 'Self care is enough for now; re-check if it gets worse.'
  return { ...outcome, escalationText, status: TRIAGE_LEVEL_STATUS[outcome.level] }
}

export function listProcedures(): GuidedProcedure[] {
  return PROCEDURES
}

// ── Per-astronaut medication stock ─────────────────────────────────────────
// Every astronaut starts with the full kit (MEDICATIONS). Each check-in that logs a
// medication takes that amount off that astronaut's own count.

interface MedTake {
  medId: string
  amount: number
  day: number
  at: string
}
const medStore = createStore<Record<string, MedTake[]>>('medication-use:v1', () => ({}))

/** Units of a medication this astronaut has left. */
export function medicationLeft(astronautId: string, medId: string): number {
  const start = MEDICATIONS.find((m) => m.id === medId)?.qtyLeft ?? 0
  const used = (medStore.get()[astronautId] ?? []).filter((t) => t.medId === medId).reduce((sum, t) => sum + t.amount, 0)
  return Math.max(0, start - used)
}

/**
 * Take medication off this astronaut's stock (called when a check-in is saved).
 * Throws if an amount is not a whole number above 0 or is more than what is left.
 */
export function recordMedicationsTaken(astronautId: string, taken: { medId: string; amount: number }[], day: number): void {
  for (const t of taken) {
    const left = medicationLeft(astronautId, t.medId)
    if (!Number.isInteger(t.amount) || t.amount < 1) throw new Error('Amount taken must be a whole number above 0.')
    if (t.amount > left) throw new Error(`Only ${left} left of ${MEDICATIONS.find((m) => m.id === t.medId)?.name ?? t.medId}.`)
  }
  const at = new Date().toISOString()
  medStore.update((all) => ({
    ...all,
    [astronautId]: [...(all[astronautId] ?? []), ...taken.map((t) => ({ medId: t.medId, amount: t.amount, day, at }))],
  }))
}

/**
 * Medication list with status: red = expired or none left, yellow = expiring within 30 days or low stock.
 * Pass an astronautId to get that astronaut's own count.
 */
export function getMedicationList(astronautId?: string, now: Date = new Date()): MedicationStatus[] {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return MEDICATIONS.map((kit) => {
    const m = astronautId ? { ...kit, qtyLeft: medicationLeft(astronautId, kit.id) } : kit
    const days = Math.round((Date.parse(`${m.expiryDate}T00:00:00Z`) - today) / 86_400_000)
    let status: StatusLevel = 'nominal'
    let statusText = `Expires in ${days} days`
    if (days < 0) {
      status = 'critical'
      statusText = `Expired ${-days} day${days === -1 ? '' : 's'} ago - do not use`
    } else if (days <= MR.expiringWithinDays) {
      status = 'caution'
      statusText = days === 0 ? 'Expires today' : `Expires in ${days} day${days === 1 ? '' : 's'}`
    }
    if (m.qtyLeft === 0) {
      status = 'critical'
      statusText = `None left · ${statusText}`
    } else if (m.qtyLeft <= MR.lowStockAtOrBelow && status !== 'critical') {
      status = 'caution'
      statusText = `${statusText} · Low stock (${m.qtyLeft} ${m.unit})`
    }
    return { ...m, status, statusText }
  }).sort((a, b) => (b.status === 'critical' ? 2 : b.status === 'caution' ? 1 : 0) - (a.status === 'critical' ? 2 : a.status === 'caution' ? 1 : 0) || a.name.localeCompare(b.name))
}
