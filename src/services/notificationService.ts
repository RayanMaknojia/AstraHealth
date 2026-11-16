/**
 * Notification box: every alert pop-up and every crew message is saved here, per astronaut.
 *
 * - "Notify crew" on a pop-up sends a copy to every other astronaut account in the database
 *   (demo crew and admin-created crew). Each copy lands in that person's own box.
 * - Each astronaut can mark items read, delete one, or delete all.
 * - Stored in localStorage on this device. Other tabs (other crew logged in on the same
 *   device) see new items right away through the browser "storage" event. On a real
 *   spacecraft, each crew device would receive these over the local network.
 */

import { newId } from '@/services/_store'
import { listProfiles } from '@/services/accountService'

export type NotificationKind = 'alert' | 'crew_alert' | 'sos' | 'system'

export interface CrewNotification {
  id: string
  /** Astronaut whose box this item is in. */
  toId: string
  fromId?: string
  fromName?: string
  kind: NotificationKind
  title: string
  body: string
  /** ISO time it was created (Earth UTC). */
  createdAt: string
  missionDay?: number
  read: boolean
  /** Same source event (e.g. an alert id), used to avoid saving duplicates. */
  ref?: string
}

const KEY = 'space-medic:notifications:v1'
const MAX_PER_PERSON = 200
let memory: CrewNotification[] = []
const listeners = new Set<() => void>()

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

/** Always read fresh, so items written by another tab show up. */
function readAll(): CrewNotification[] {
  const ls = storage()
  if (!ls) return memory
  try {
    const raw = ls.getItem(KEY)
    return raw ? (JSON.parse(raw) as CrewNotification[]) : []
  } catch {
    return []
  }
}

function writeAll(items: CrewNotification[]): void {
  memory = items
  try {
    storage()?.setItem(KEY, JSON.stringify(items))
  } catch {
    /* storage full / private mode: memory only */
  }
  listeners.forEach((fn) => fn())
}

function trim(items: CrewNotification[]): CrewNotification[] {
  const count = new Map<string, number>()
  // Newest first; keep the newest MAX_PER_PERSON per astronaut.
  return [...items]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .filter((n) => {
      const c = (count.get(n.toId) ?? 0) + 1
      count.set(n.toId, c)
      return c <= MAX_PER_PERSON
    })
}

/** Subscribe to changes from this tab and other tabs. Returns an unsubscribe function. */
export function subscribeNotifications(fn: () => void): () => void {
  listeners.add(fn)
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) fn()
  }
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(fn)
    if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage)
  }
}

/** One astronaut's box, newest first. */
export function listNotifications(toId: string): CrewNotification[] {
  return readAll()
    .filter((n) => n.toId === toId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function unreadCount(toId: string): number {
  return readAll().filter((n) => n.toId === toId && !n.read).length
}

/** Save one item. Skips it if the same astronaut already has an item with the same ref. */
export function addNotification(n: Omit<CrewNotification, 'id' | 'createdAt' | 'read'> & { read?: boolean }): CrewNotification | null {
  const all = readAll()
  if (n.ref && all.some((x) => x.toId === n.toId && x.ref === n.ref)) return null
  const item: CrewNotification = { ...n, id: newId('ntf'), createdAt: new Date().toISOString(), read: n.read ?? false }
  writeAll(trim([item, ...all]))
  return item
}

/** Save an alert pop-up in the astronaut's own box (once per alert). */
export function recordAlert(toId: string, alert: { id: string; title: string; headline: string; kind?: string }, missionDay?: number): void {
  addNotification({
    toId,
    kind: alert.kind === 'sos' ? 'sos' : 'alert',
    title: alert.title,
    body: alert.headline,
    missionDay,
    ref: `alert:${alert.id}`,
    read: true, // the person already saw it on screen
  })
}

/**
 * "Notify crew": send a copy to every other astronaut in the database.
 * Returns the names of the people notified.
 */
export function notifyCrew(
  from: { id: string; name: string },
  message: { title: string; body: string; kind?: NotificationKind; ref?: string },
  missionDay?: number,
): string[] {
  const others = listProfiles().filter((p) => p.id !== from.id)
  const kind = message.kind ?? 'crew_alert'
  for (const p of others)
    addNotification({
      toId: p.id,
      fromId: from.id,
      fromName: from.name,
      kind,
      title: `${from.name}: ${message.title}`,
      body: message.body,
      missionDay,
      ref: message.ref ? `${message.ref}:to:${p.id}` : undefined,
    })
  addNotification({
    toId: from.id,
    fromId: from.id,
    fromName: from.name,
    kind: 'system',
    title: others.length ? `You notified ${others.length} crewmate${others.length === 1 ? '' : 's'}` : 'No other crew accounts to notify',
    body: others.length ? `${message.title}. Sent to ${others.map((p) => p.name).join(', ')}.` : 'Ask mission control to add crew accounts.',
    missionDay,
    read: true,
  })
  return others.map((p) => p.name)
}

export function markAllRead(toId: string): void {
  writeAll(readAll().map((n) => (n.toId === toId ? { ...n, read: true } : n)))
}

export function deleteNotification(toId: string, id: string): void {
  writeAll(readAll().filter((n) => !(n.toId === toId && n.id === id)))
}

export function clearNotifications(toId: string): void {
  writeAll(readAll().filter((n) => n.toId !== toId))
}
