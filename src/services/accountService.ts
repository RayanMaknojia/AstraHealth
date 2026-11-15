/**
 * Accounts - one admin (mission control) creates every astronaut account;
 * astronauts only log in with name + PIN and land on a running dashboard.
 * Persists to localStorage so it works offline (falls back to memory when
 * storage is unavailable); admin edits (e.g. launch delays) apply immediately
 * and would sync when a link returns.
 *
 * DEMO-GRADE AUTH ONLY - PINs are hashed with a non-cryptographic hash and
 * stored in the browser. Not real security.
 */

import { CREW_PROFILES, buildEmptyProfile, type EmptyProfileSeed } from '@/data/nasaSpaceflightData'
import { getPhaseForDay, missionDayFromDate } from '@/services/missionTimeline'
import type { AstronautProfile, AuthSession, CrewAccount, CrewRole, MissionDestination, MissionPlan } from '@/types/astronaut'

/** Demo logins for the title slide / README (reference doc §8). */
export const DEMO_LOGINS = [
  { login: 'admin', pin: '0000', shows: 'Account and mission setup screen' },
  { login: 'mars_crew', pin: '1111', shows: 'Dashboard on day 45 of a Mars trip' },
  { login: 'iss_crew', pin: '2222', shows: 'Dashboard on the ISS' },
  { login: 'moon_crew', pin: '3333', shows: 'Dashboard on the Moon surface' },
] as const

const STORAGE_KEY = 'space-medic:accounts:v1'

/** Demo-only PIN hash (FNV-1a, salted with the login). */
export function hashPin(login: string, pin: string): string {
  let h = 0x811c9dc5
  for (const ch of `${login.toLowerCase()}:${pin}:space-medic`) {
    h ^= ch.charCodeAt(0)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

interface MissionEdit {
  launchDate?: string
  totalDays?: number
}

interface Store {
  version: 1
  accounts: CrewAccount[]
  /** Astronauts created by admin (demo crew live in src/data). */
  created: EmptyProfileSeed[]
  missionEdits: Record<string, MissionEdit>
  session: AuthSession | null
}

function seedStore(): Store {
  const demo = (login: string, pin: string, displayName: string, crewRole: CrewRole, astronautId: string): CrewAccount => ({
    id: `acct-${login}`,
    login,
    displayName,
    userRole: 'astronaut',
    crewRole,
    pinHash: hashPin(login, pin),
    astronautId,
  })
  const byLogin = (login: string) => CREW_PROFILES.find((p) => p.login === login)!
  const pinFor = (login: string) => DEMO_LOGINS.find((d) => d.login === login)!.pin
  return {
    version: 1,
    accounts: [
      { id: 'acct-admin', login: 'admin', displayName: 'Mission Control', userRole: 'admin', pinHash: hashPin('admin', pinFor('admin')), astronautId: null },
      ...['iss_crew', 'mars_crew', 'moon_crew'].map((login) => {
        const p = byLogin(login)
        return demo(login, pinFor(login), p.name, p.crewRole, p.id)
      }),
    ],
    created: [],
    missionEdits: {},
    session: null,
  }
}

// ── Persistence (localStorage with in-memory fallback) ─────────────────────

let memory: Store | null = null

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

function load(): Store {
  if (memory) return memory
  const ls = storage()
  try {
    const raw = ls?.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Store
      if (parsed.version === 1 && Array.isArray(parsed.accounts)) return (memory = parsed)
    }
  } catch {
    /* corrupted storage → reseed */
  }
  return (memory = seedStore())
}

function save(store: Store): void {
  memory = store
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    /* storage full / private mode → memory only */
  }
}

function publicAccount(a: CrewAccount): Omit<CrewAccount, 'pinHash'> {
  const { pinHash: _hash, ...rest } = a
  void _hash
  return rest
}

/** Wipe local accounts back to the four demo logins (useful before a judging run). */
export function resetDemoAccounts(): void {
  save(seedStore())
}

// ── Sessions ───────────────────────────────────────────────────────────────

/** Returns a session, or null for a wrong login/PIN. Login is case-insensitive and may be the display name. */
export function authenticate(login: string, pin: string): AuthSession | null {
  const store = load()
  const key = login.trim().toLowerCase()
  const account = store.accounts.find((a) => a.login.toLowerCase() === key || a.displayName.toLowerCase() === key)
  if (!account || account.pinHash !== hashPin(account.login, pin.trim())) return null
  const session: AuthSession = { account: publicAccount(account), startedAt: new Date().toISOString() }
  save({ ...store, session })
  return session
}

export function logout(): void {
  save({ ...load(), session: null })
}

export function getCurrentSession(): AuthSession | null {
  return load().session
}

// ── Profiles ───────────────────────────────────────────────────────────────

function applyMissionEdit(plan: MissionPlan, edit?: MissionEdit): MissionPlan {
  if (!edit) return plan
  let phases = plan.phases.map((p) => ({ ...p }))
  const totalDays = edit.totalDays ?? plan.totalDays
  if (edit.totalDays !== undefined) {
    phases = phases.filter((p) => p.startDay < totalDays)
    if (phases.length) phases[phases.length - 1].endDay = totalDays
  }
  return { ...plan, launchDate: edit.launchDate ?? plan.launchDate, totalDays, phases }
}

function withMissionDay(profile: AstronautProfile, missionDay: number): AstronautProfile {
  const phase = getPhaseForDay(profile.mission, missionDay)
  return { ...profile, missionDay, environment: phase.environment, habitat: phase.habitat, missionLengthDays: profile.mission.totalDays }
}

function buildProfile(store: Store, astronautId: string): AstronautProfile | null {
  const edit = store.missionEdits[astronautId]
  const demo = CREW_PROFILES.find((p) => p.id === astronautId)
  if (demo) {
    const mission = applyMissionEdit(demo.mission, edit)
    // Demo crew: launch dates are "N days ago", so the day derived from the date equals the seeded day.
    return withMissionDay({ ...demo, mission }, edit?.launchDate ? missionDayFromDate(mission.launchDate) : demo.missionDay)
  }
  const seed = store.created.find((c) => c.id === astronautId)
  if (!seed) return null
  const base = buildEmptyProfile(seed)
  const mission = applyMissionEdit(base.mission, edit)
  return withMissionDay({ ...base, mission }, missionDayFromDate(mission.launchDate))
}

/** Profile linked to a session (null for admin). Mission day is derived from the launch date. */
export function getProfileForSession(session: AuthSession): AstronautProfile | null {
  return session.account.astronautId ? buildProfile(load(), session.account.astronautId) : null
}

/** All astronaut profiles (demo crew + admin-created), e.g. for a crew selector. */
export function listProfiles(): AstronautProfile[] {
  const store = load()
  return store.accounts
    .filter((a) => a.astronautId)
    .map((a) => buildProfile(store, a.astronautId!))
    .filter((p): p is AstronautProfile => p !== null)
}

// ── Admin only ────────────────────────────────────────────────────────────

export interface NewAstronautInput {
  name: string
  login: string
  pin: string
  crewRole: CrewRole
  destination: MissionDestination
  /** ISO date. */
  launchDate: string
  notes?: string[]
}

export class AccountError extends Error {}

export function listAccounts(): Omit<CrewAccount, 'pinHash'>[] {
  return load().accounts.map(publicAccount)
}

const ROLE_LABELS: Record<CrewRole, string> = {
  commander: 'Commander',
  pilot: 'Pilot',
  specialist: 'Mission Specialist',
  flight_engineer: 'Flight Engineer',
  medical_officer: 'Crew Medical Officer',
}

/**
 * Create an astronaut + login. New astronauts have no readings: every indicator is grey
 * (missing) until they log in and do Earth-mode check-ins, which become their baseline.
 * Throws AccountError for a duplicate login or invalid input.
 */
export function createAstronaut(input: NewAstronautInput): AstronautProfile {
  const store = load()
  const login = input.login.trim().toLowerCase()
  if (!/^[a-z0-9_]{3,24}$/.test(login)) throw new AccountError('Login must be 3-24 letters, numbers or underscores.')
  if (!/^\d{4,8}$/.test(input.pin)) throw new AccountError('PIN must be 4-8 digits.')
  if (!input.name.trim()) throw new AccountError('Name is required.')
  if (Number.isNaN(Date.parse(input.launchDate))) throw new AccountError('Launch date must be a valid date (YYYY-MM-DD).')
  if (store.accounts.some((a) => a.login.toLowerCase() === login)) throw new AccountError(`Login "${login}" already exists.`)

  const id = `crew-${login}`
  const seed: EmptyProfileSeed = {
    id,
    name: input.name.trim(),
    role: ROLE_LABELS[input.crewRole],
    crewRole: input.crewRole,
    login,
    destination: input.destination,
    launchDate: input.launchDate.slice(0, 10),
    missionDay: missionDayFromDate(input.launchDate),
    notes: input.notes ?? [],
  }
  const account: CrewAccount = {
    id: `acct-${login}`,
    login,
    displayName: seed.name,
    userRole: 'astronaut',
    crewRole: input.crewRole,
    pinHash: hashPin(login, input.pin),
    astronautId: id,
  }
  const next = { ...store, accounts: [...store.accounts, account], created: [...store.created, seed] }
  save(next)
  return buildProfile(next, id)!
}

/** Handle delays: edit launch date / mission length; the trip bar updates. */
export function updateMissionDates(astronautId: string, changes: { launchDate?: string; totalDays?: number }): AstronautProfile {
  const store = load()
  if (changes.launchDate !== undefined && Number.isNaN(Date.parse(changes.launchDate)))
    throw new AccountError('Launch date must be a valid date (YYYY-MM-DD).')
  if (changes.totalDays !== undefined && !(changes.totalDays > 0)) throw new AccountError('Mission length must be positive.')
  const prev = store.missionEdits[astronautId] ?? {}
  const edit: MissionEdit = {
    ...prev,
    ...(changes.launchDate !== undefined ? { launchDate: changes.launchDate.slice(0, 10) } : {}),
    ...(changes.totalDays !== undefined ? { totalDays: Math.round(changes.totalDays) } : {}),
  }
  const next = { ...store, missionEdits: { ...store.missionEdits, [astronautId]: edit } }
  const profile = buildProfile(next, astronautId)
  if (!profile) throw new AccountError(`No astronaut with id "${astronautId}".`)
  save(next)
  return profile
}
