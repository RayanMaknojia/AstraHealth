/**
 * Accounts — one admin (mission control) creates every astronaut account;
 * astronauts only log in with name + PIN and land on a running dashboard.
 * Persists to localStorage so it works offline; admin edits (e.g. launch
 * delays) apply immediately and would sync when a link returns.
 *
 * DEMO-GRADE AUTH ONLY — not real security.
 *
 * STATUS: Step-1 contract stub — signatures are final, bodies come in Step 2.
 */

import type { AstronautProfile, AuthSession, CrewAccount, CrewRole, MissionDestination } from '@/types/astronaut'
import { notImplemented } from './_notImplemented'

/** Demo logins for the title slide / README (reference doc §8). */
export const DEMO_LOGINS = [
  { login: 'admin', pin: '0000', shows: 'Account and mission setup screen' },
  { login: 'mars_crew', pin: '1111', shows: 'Dashboard on day 45 of a Mars trip' },
  { login: 'iss_crew', pin: '2222', shows: 'Dashboard on the ISS' },
  { login: 'moon_crew', pin: '3333', shows: 'Dashboard on the Moon surface' },
] as const

/** Returns a session, or null for a wrong login/PIN. */
export function authenticate(_login: string, _pin: string): AuthSession | null {
  return notImplemented('authenticate')
}

export function logout(): void {
  notImplemented('logout')
}

export function getCurrentSession(): AuthSession | null {
  return notImplemented('getCurrentSession')
}

/** Profile linked to a session (null for admin). */
export function getProfileForSession(_session: AuthSession): AstronautProfile | null {
  return notImplemented('getProfileForSession')
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

export function listAccounts(): Omit<CrewAccount, 'pinHash'>[] {
  return notImplemented('listAccounts')
}

export function createAstronaut(_input: NewAstronautInput): AstronautProfile {
  return notImplemented('createAstronaut')
}

/** Handle delays: edit launch date / mission length; the trip bar updates. */
export function updateMissionDates(_astronautId: string, _changes: { launchDate?: string; totalDays?: number }): AstronautProfile {
  return notImplemented('updateMissionDates')
}
