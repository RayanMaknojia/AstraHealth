/**
 * Mission Control Sync (pages doc §12): outbox of items waiting for Earth,
 * inbox of replies, and the link status (connected / waiting / blackout).
 *
 * Offline-first and simulated: runSync() "sends" queued items when a link
 * window is open and generates deterministic ground replies (flight-surgeon
 * photo reviews, alert acknowledgements). High-priority items (alerts, SOS)
 * always go first. Private requests never carry content.
 */

import { createStore, newId } from '@/services/_store'
import type {
  InboxMessage,
  LinkStatus,
  MissionState,
  SyncItem,
  SyncItemType,
  SyncPriority,
  SyncRunResult,
} from '@/types/astronaut'

interface SyncState {
  outbox: SyncItem[]
  inbox: InboxMessage[]
  lastSyncAt: Record<string, string | null>
}

const store = createStore<SyncState>('sync:v1', () => ({ outbox: [], inbox: [], lastSyncAt: {} }))

const SIZE_KB: Record<SyncItemType, number> = { checkin: 2, photo: 350, scan: 900, alert: 1, sos: 1, private_request: 1, report: 20 }
const PRIORITY_RANK: Record<SyncPriority, number> = { high: 0, normal: 1, low: 2 }
/** Mars legs get a link window of 2 h every 8 h (demo model). */
const DEEP_SPACE_WINDOW_EVERY_H = 8
const DEEP_SPACE_WINDOW_LENGTH_H = 2

export interface EnqueueInput {
  astronautId: string
  type: SyncItemType
  title: string
  summary: string
  missionDay: number
  priority?: SyncPriority
  refId?: string
  sizeKb?: number
}

/** Add an item to the outbox. Alerts and SOS default to high priority. */
export function enqueue(input: EnqueueInput): SyncItem {
  const item: SyncItem = {
    id: newId('out'),
    astronautId: input.astronautId,
    type: input.type,
    priority: input.priority ?? (input.type === 'alert' || input.type === 'sos' ? 'high' : 'normal'),
    title: input.title,
    summary: input.type === 'private_request' ? 'Private request (content not included)' : input.summary,
    createdAt: new Date().toISOString(),
    missionDay: input.missionDay,
    sizeKb: input.sizeKb ?? SIZE_KB[input.type],
    status: 'queued',
    ...(input.refId ? { refId: input.refId } : {}),
  }
  store.update((s) => ({ ...s, outbox: [...s.outbox, item] }))
  return item
}

/** Outbox, highest priority first, then oldest first. */
export function listOutbox(astronautId: string): SyncItem[] {
  return store
    .get()
    .outbox.filter((i) => i.astronautId === astronautId)
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.createdAt.localeCompare(b.createdAt))
}

export function listInbox(astronautId: string): InboxMessage[] {
  return store
    .get()
    .inbox.filter((m) => m.astronautId === astronautId)
    .sort((a, b) => b.at.localeCompare(a.at))
}

export function unreadCount(astronautId: string): number {
  return listInbox(astronautId).filter((m) => !m.read).length
}

export function markRead(messageId: string): void {
  store.update((s) => ({ ...s, inbox: s.inbox.map((m) => (m.id === messageId ? { ...m, read: true } : m)) }))
}

/** For admin / mission-control messages (e.g. "New landing date"). */
export function postInboxMessage(msg: Omit<InboxMessage, 'id' | 'at' | 'read'>): InboxMessage {
  const m: InboxMessage = { ...msg, id: newId('in'), at: new Date().toISOString(), read: false }
  store.update((s) => ({ ...s, inbox: [...s.inbox, m] }))
  return m
}

function relative(fromIso: string | null, now: Date): string {
  if (!fromIso) return 'Never synced'
  const mins = Math.max(0, Math.round((now.getTime() - Date.parse(fromIso)) / 60_000))
  if (mins < 1) return 'Last sync just now'
  if (mins < 60) return `Last sync ${mins} min ago`
  const h = Math.round(mins / 60)
  return h < 48 ? `Last sync ${h} h ago` : `Last sync ${Math.round(h / 24)} days ago`
}

/** Link status from the mission state: blackout at solar conjunction, windows on Mars legs, always on near Earth. */
export function getLinkStatus(missionState: MissionState, astronautId: string, now: Date = new Date()): LinkStatus {
  const lastSyncAt = store.get().lastSyncAt[astronautId] ?? null
  const base = { earthDelaySeconds: missionState.earthDelaySeconds, lastSyncAt, lastSyncText: relative(lastSyncAt, now) }
  const blackout = missionState.activeAlerts.find((a) => a.kind === 'comm_blackout')
  if (blackout)
    return { ...base, state: 'blackout', nextWindowInHours: null, blackoutEndsInDays: Math.max(0, Math.ceil(blackout.activeToDay - missionState.missionDay)) }
  if (missionState.escalationMode === 'act_then_report') {
    const hour = now.getUTCHours() + now.getUTCMinutes() / 60
    const intoCycle = hour % DEEP_SPACE_WINDOW_EVERY_H
    if (intoCycle < DEEP_SPACE_WINDOW_LENGTH_H) return { ...base, state: 'connected', nextWindowInHours: 0 }
    return { ...base, state: 'waiting', nextWindowInHours: Math.round((DEEP_SPACE_WINDOW_EVERY_H - intoCycle) * 10) / 10 }
  }
  return { ...base, state: 'connected', nextWindowInHours: 0 }
}

function groundReply(item: SyncItem): Omit<InboxMessage, 'id' | 'at' | 'read'> | null {
  const common = { astronautId: item.astronautId, missionDay: item.missionDay, ...(item.refId ? { refId: item.refId } : {}) }
  switch (item.type) {
    case 'photo':
      return { ...common, from: 'flight_surgeon', type: 'photo_review', title: `Photo reviewed: ${item.title}`, body: `Flight surgeon review: ${item.summary}. Agree with the first-look result. Keep it clean and covered, re-photograph in 24 h, and escalate if it gets worse.` }
    case 'scan':
      return { ...common, from: 'flight_surgeon', type: 'photo_review', title: `Scan reviewed: ${item.title}`, body: 'Flight surgeon review: image quality is adequate. No action needed now; repeat at the next scheduled exam.' }
    case 'alert':
      return { ...common, from: 'flight_surgeon', type: 'reply', title: `Alert received: ${item.title}`, body: 'We have your alert and readings. Continue the onboard action plan; we will follow up at the next private medical conference.' }
    case 'sos':
      return { ...common, from: 'mission_control', type: 'reply', title: 'SOS received', body: 'Mission Control has your SOS. Flight surgeon is on console. Follow the onboard triage steps and send vitals every 15 minutes.' }
    case 'private_request':
      return { ...common, from: 'flight_surgeon', type: 'reply', title: 'Private conference scheduled', body: 'Your private medical conference request is confirmed for the next communication window.' }
    default:
      return null
  }
}

/**
 * Run a sync now (the UI can call this on a timer or a "Sync now" button).
 * Short delay: queued → received at once. Long delay: queued → sent now, received on the next run.
 * Does nothing during a blackout or outside a link window.
 */
export function runSync(missionState: MissionState, astronautId: string, now: Date = new Date()): SyncRunResult {
  const link = getLinkStatus(missionState, astronautId, now)
  if (link.state !== 'connected') return { link, sent: 0, received: 0, newInbox: [] }
  const instant = missionState.earthDelaySeconds <= 60
  let sent = 0
  let received = 0
  const replies: InboxMessage[] = []
  const nowIso = now.toISOString()
  store.update((s) => {
    const outbox = s.outbox.map((item) => {
      if (item.astronautId !== astronautId || item.status === 'received') return item
      if (item.status === 'queued' && !instant) {
        sent++
        return { ...item, status: 'sent' as const }
      }
      received++
      const reply = groundReply(item)
      if (reply) replies.push({ ...reply, id: newId('in'), at: nowIso, read: false })
      return { ...item, status: 'received' as const }
    })
    return { outbox, inbox: [...s.inbox, ...replies], lastSyncAt: { ...s.lastSyncAt, [astronautId]: nowIso } }
  })
  return { link: { ...link, lastSyncAt: nowIso, lastSyncText: relative(nowIso, now) }, sent, received, newInbox: replies }
}

/** Clear all sync data (demo reset). */
export function resetSync(): void {
  store.reset()
}
