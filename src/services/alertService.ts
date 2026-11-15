/**
 * Override layer (pages doc "Override Pages"): full-screen alerts that cover
 * any page until someone taps Confirm. Every raise is logged and puts a
 * high-priority item in the sync outbox; every confirm logs who and when.
 *
 *  O1 critical_health  - any fresh Alert-level vital
 *  O2 cabin_emergency  - CO2 > 3 mmHg for ≥ 1 h, pressure out of limits, inspired O2 < 127 mmHg
 *  O3 radiation_storm  - active solar particle event with shelter advised
 *  O4 sos              - SOS button, or an O1 left unconfirmed for 10 minutes
 *  Banner              - comms blackout / waiting for link (not full screen)
 *
 * Call syncOverrides() after every evaluation or tick; it raises new problems,
 * never re-raises one that's still open, and waits a cool-down before raising
 * the same problem again after it was confirmed.
 */

import { CABIN_STANDARD_LIMITS as L } from '@/data/nasaSpaceflightData'
import { inspiredO2MmHg } from '@/services/environmentFeed'
import { createStore, missionTimestamp, newId } from '@/services/_store'
import { enqueue, getLinkStatus } from '@/services/syncService'
import type { BannerAlert, MissionState, OverrideAlert, OverrideInputs, OverrideKind } from '@/types/astronaut'

/** After a confirm, the same problem can be raised again after this many minutes (real time). */
export const REARM_AFTER_MINUTES = 60
/** An O1 left unconfirmed this long escalates to SOS. */
export const UNCONFIRMED_SOS_AFTER_MINUTES = 10
/** CO2 above the limit for this long → Cabin Emergency. */
export const CO2_SUSTAINED_HOURS = 1

interface AlertState {
  alerts: OverrideAlert[]
}

const store = createStore<AlertState>('alerts:v1', () => ({ alerts: [] }))

export const OVERRIDE_TITLES: Record<OverrideKind, string> = {
  critical_health: 'Critical Health Alert',
  cabin_emergency: 'Cabin Emergency',
  radiation_storm: 'Radiation Storm',
  sos: 'Medical Emergency (SOS)',
}

type Candidate = Omit<OverrideAlert, 'id' | 'astronautId' | 'raisedAt' | 'missionDay' | 'missionTimestamp'>

function healthCandidates(input: OverrideInputs): Candidate[] {
  const { report, profile } = input
  const byId = new Map(profile.indicators.map((i) => [i.id, i]))
  return report.indicators
    .filter((e) => e.status === 'critical' && byId.get(e.id)?.dataState === 'fresh')
    .map((e) => {
      const ind = byId.get(e.id)!
      return {
        kind: 'critical_health' as const,
        key: `critical_health:${e.id}`,
        title: OVERRIDE_TITLES.critical_health,
        headline: `${ind.name}: ${e.value}${ind.unit === '/5' ? '/5' : ` ${ind.unit}`}`,
        details: [e.message, `Rule: ${e.thresholdNote}`],
        steps: e.actionPlan.steps.slice(0, 5),
        indicatorId: e.id,
      }
    })
}

function cabinCandidates(input: OverrideInputs): Candidate[] {
  const out: Candidate[] = []
  const hist = input.cabinHistory ?? []
  const latest = input.environmentTick?.cabin ?? hist[hist.length - 1]
  if (hist.length) {
    const lastDay = hist[hist.length - 1].day
    const lastHour = hist.filter((r) => r.day >= lastDay - CO2_SUSTAINED_HOURS / 24)
    const spanH = lastHour.length > 1 ? (lastHour[lastHour.length - 1].day - lastHour[0].day) * 24 : 0
    if (lastHour.length >= 2 && spanH >= CO2_SUSTAINED_HOURS * 0.75 && lastHour.every((r) => r.co2MmHg > L.co2AlertMmHg)) {
      const avg = Math.round((lastHour.reduce((a, r) => a + r.co2MmHg, 0) / lastHour.length) * 100) / 100
      const rising = lastHour[lastHour.length - 1].co2MmHg - lastHour[0].co2MmHg
      out.push({
        kind: 'cabin_emergency',
        key: 'cabin_emergency:co2',
        title: OVERRIDE_TITLES.cabin_emergency,
        headline: `CO2 ${avg} mmHg for over ${CO2_SUSTAINED_HOURS} h`,
        details: [`Limit: ${L.co2AlertMmHg} mmHg (1 h average).`, rising > 0.1 ? `Rising ${Math.round(rising * 100) / 100} mmHg in the last hour.` : 'Holding steady above the limit.'],
        steps: ['Put on a mask or move to a well-ventilated module.', 'Check CO2 scrubber status and clear vents.', 'Report to the crew and Mission Control.', 'Re-check CO2 every 15 minutes.'],
      })
    }
  }
  if (latest && (latest.cabinPsia < L.pressureLowPsia || latest.cabinPsia > L.pressureHighPsia))
    out.push({
      kind: 'cabin_emergency',
      key: 'cabin_emergency:pressure',
      title: OVERRIDE_TITLES.cabin_emergency,
      headline: `Cabin pressure ${latest.cabinPsia} psia`,
      details: [`Allowed ${L.pressureLowPsia}-${L.pressureHighPsia} psia.`],
      steps: ['Follow the leak / rapid-depress procedure.', 'Move to the safe module and close the hatch.', 'Masks on if pressure keeps falling.', 'Report to Mission Control.'],
    })
  if (latest) {
    const o2 = inspiredO2MmHg(latest.cabinPsia, latest.o2Pct)
    if (o2 < L.minInspiredO2MmHg)
      out.push({
        kind: 'cabin_emergency',
        key: 'cabin_emergency:o2',
        title: OVERRIDE_TITLES.cabin_emergency,
        headline: `Inspired O2 ${o2} mmHg`,
        details: [`Minimum ${L.minInspiredO2MmHg} mmHg.`],
        steps: ['Put on emergency O2 masks now.', 'Check life support and O2 supply.', 'Check SpO2 on every crew member.', 'Report to Mission Control.'],
      })
  }
  return out
}

function radiationCandidates(input: OverrideInputs): Candidate[] {
  const ev = input.environmentTick?.activeEvent
  if (!ev?.shelterAdvised) return []
  const dose = input.profile.indicators.find((i) => i.id === 'radiation_dose')
  const total = typeof dose?.value === 'number' ? dose.value + input.profile.priorCareerDoseMSv : null
  return [
    {
      kind: 'radiation_storm',
      key: `radiation_storm:${ev.id}`,
      title: OVERRIDE_TITLES.radiation_storm,
      headline: 'Go to the storm shelter now',
      details: [
        ev.summary,
        ...(total !== null ? [`Career dose so far ${Math.round(total)} mSv (${Math.round((total / 600) * 100)}% of the 600 mSv limit).`] : []),
      ],
      steps: ['Move to the storm shelter / most shielded module.', 'Bring your dosimeter; keep it on.', 'Stop EVAs and rover traverses.', 'Stay until the all-clear; log dosimeter readings hourly.'],
    },
  ]
}

function raise(astronautId: string, c: Candidate, missionDay: number): OverrideAlert {
  const alert: OverrideAlert = { ...c, id: newId('ovr'), astronautId, raisedAt: new Date().toISOString(), missionDay, missionTimestamp: missionTimestamp(missionDay) }
  const out = enqueue({ astronautId, type: c.kind === 'sos' ? 'sos' : 'alert', title: `${c.title}: ${c.headline}`, summary: c.details[0] ?? c.headline, missionDay, priority: 'high', refId: alert.id })
  const withOutbox = { ...alert, outboxItemId: out.id }
  store.update((s) => ({ alerts: [...s.alerts, withOutbox] }))
  return withOutbox
}

/** All problems that should be on screen right now, without raising anything. */
export function evaluateOverrides(input: OverrideInputs): Candidate[] {
  return [...healthCandidates(input), ...cabinCandidates(input), ...radiationCandidates(input)]
}

/**
 * Raise any new override (deduplicated by key, with a re-arm cool-down after confirm)
 * and return the astronaut's unconfirmed overrides, most severe kind first.
 */
export function syncOverrides(input: OverrideInputs, now: Date = new Date()): OverrideAlert[] {
  const astronautId = input.profile.id
  const existing = store.get().alerts.filter((a) => a.astronautId === astronautId)
  for (const c of evaluateOverrides(input)) {
    const open = existing.find((a) => a.key === c.key && !a.confirmedAt)
    if (open) continue
    const lastConfirmed = existing.filter((a) => a.key === c.key && a.confirmedAt).sort((a, b) => b.confirmedAt!.localeCompare(a.confirmedAt!))[0]
    if (lastConfirmed && now.getTime() - Date.parse(lastConfirmed.confirmedAt!) < REARM_AFTER_MINUTES * 60_000) continue
    raise(astronautId, c, input.missionState.missionDay)
  }
  checkUnconfirmed(astronautId, input.missionState.missionDay, now)
  return getActiveOverrides(astronautId)
}

const KIND_RANK: Record<OverrideKind, number> = { sos: 0, cabin_emergency: 1, radiation_storm: 2, critical_health: 3 }

export function getActiveOverrides(astronautId: string): OverrideAlert[] {
  return store
    .get()
    .alerts.filter((a) => a.astronautId === astronautId && !a.confirmedAt)
    .sort((a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind] || a.raisedAt.localeCompare(b.raisedAt))
}

/** Full log (raised + confirmed), newest first - for Admin and the Sync page. */
export function getOverrideLog(astronautId?: string): OverrideAlert[] {
  return store
    .get()
    .alerts.filter((a) => !astronautId || a.astronautId === astronautId)
    .sort((a, b) => b.raisedAt.localeCompare(a.raisedAt))
}

/** Confirm an override (logs who and when). Returns the updated alert, or null if not found. */
export function confirmOverride(alertId: string, confirmedBy: string): OverrideAlert | null {
  let updated: OverrideAlert | null = null
  store.update((s) => ({
    alerts: s.alerts.map((a) => {
      if (a.id !== alertId || a.confirmedAt) return a
      updated = { ...a, confirmedBy, confirmedAt: new Date().toISOString() }
      return updated
    }),
  }))
  return updated
}

/** O4: SOS button. Always raises a new alert and a high-priority outbox item. */
export function raiseSos(input: { astronautId: string; name: string; location?: string; missionDay: number; reason?: string }): OverrideAlert {
  return raise(
    input.astronautId,
    {
      kind: 'sos',
      key: `sos:${Date.now()}`,
      title: OVERRIDE_TITLES.sos,
      headline: `${input.name} needs help${input.location ? ` - ${input.location}` : ''}`,
      details: [input.reason ?? 'SOS button pressed.', 'High-priority message queued for the ground.'],
      steps: ['Check: are they responding? Are they breathing?', 'Get the medical kit and the AED.', 'Record vitals now (HR, BP, SpO2) - one tap below.', 'Follow the matching Guidance page; tell Mission Control.'],
    },
    input.missionDay,
  )
}

/** O4 auto-escalation: an O1 left unconfirmed for UNCONFIRMED_SOS_AFTER_MINUTES becomes an SOS. */
export function checkUnconfirmed(astronautId: string, missionDay: number, now: Date = new Date()): OverrideAlert | null {
  const active = getActiveOverrides(astronautId)
  if (active.some((a) => a.kind === 'sos')) return null
  const stale = active.find((a) => a.kind === 'critical_health' && now.getTime() - Date.parse(a.raisedAt) >= UNCONFIRMED_SOS_AFTER_MINUTES * 60_000)
  if (!stale) return null
  return raiseSos({ astronautId, name: 'Crew member', missionDay, reason: `No response to "${stale.headline}" for ${UNCONFIRMED_SOS_AFTER_MINUTES} minutes.` })
}

/** Thin top banner (not a full override): comms blackout or waiting for a link window. */
export function getBanner(missionState: MissionState, astronautId: string, now: Date = new Date()): BannerAlert | null {
  const link = getLinkStatus(missionState, astronautId, now)
  if (link.state === 'blackout')
    return {
      kind: 'comms_blackout',
      message: `Earth link down (solar conjunction). Expected back in ${link.blackoutEndsInDays} day${link.blackoutEndsInDays === 1 ? '' : 's'}. Data saved and queued.`,
      expectedBackInDays: link.blackoutEndsInDays,
    }
  if (link.state === 'waiting') return { kind: 'link_waiting', message: `Waiting for link - next window in ~${link.nextWindowInHours} h. Data saved and queued.` }
  return null
}

export function resetAlerts(): void {
  store.reset()
}
