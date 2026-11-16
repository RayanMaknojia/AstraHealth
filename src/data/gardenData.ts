/**
 * Station Garden: a garden the whole crew grows together (More → Station Garden).
 *
 * Why a garden: crews on long missions miss nature, and astronauts growing plants on
 * the ISS (NASA's Veggie experiments) reported it lifted their mood. Here every healthy
 * habit earns a seed, and everyone plants in one shared garden. Nothing is zero-sum.
 */

import type { PlantKind } from '@/types/astronaut'

export const GARDEN = {
  /** One garden per crew code; everyone using this deployment shares it. */
  crew: 'station',
  cols: 12,
  rows: 5,
  /** How often an open garden checks the server for crewmates' plants. */
  pollMs: 15_000,
  /** Crew goal: plants this many together in 7 days and the aurora lights up. */
  weeklyGoal: 12,
  /** Real days after planting for each growth stage: sprout, young, grown, blooming. */
  stageDays: [0, 1, 3, 6] as const,
} as const

export interface PlantSpec {
  kind: PlantKind
  label: string
  biome: 'Meadow' | 'Forest' | 'Water garden' | 'Alpine'
  /** Total plants in the garden needed to unlock it. */
  unlockAt: number
}

/** Biomes unlock as the whole crew's garden grows (a shared milestone, not a race). */
export const PLANTS: PlantSpec[] = [
  { kind: 'grass', label: 'Grass', biome: 'Meadow', unlockAt: 0 },
  { kind: 'flower', label: 'Flower', biome: 'Meadow', unlockAt: 0 },
  { kind: 'fern', label: 'Fern', biome: 'Meadow', unlockAt: 0 },
  { kind: 'tree', label: 'Tree', biome: 'Forest', unlockAt: 10 },
  { kind: 'mushroom', label: 'Mushrooms', biome: 'Forest', unlockAt: 10 },
  { kind: 'reed', label: 'Reeds', biome: 'Water garden', unlockAt: 22 },
  { kind: 'lily', label: 'Water lily', biome: 'Water garden', unlockAt: 22 },
  { kind: 'pine', label: 'Pine', biome: 'Alpine', unlockAt: 36 },
  { kind: 'crystal', label: 'Star crystal', biome: 'Alpine', unlockAt: 36 },
]

/**
 * Seeds: each habit earns at most one seed a day (counted on this device), from
 * `welcomeDays` before the astronaut first opened the garden. About 1-5 seeds a day.
 */
export const SEED_RULES = {
  sleepGoodHours: 7,
  workoutGoalMinutes: 120,
  welcomeDays: 7,
} as const

/**
 * Starter garden: a few plants from simulated crewmates so the dome is not empty on
 * day one. Always labelled "simulated"; a real plant on the same plot replaces it.
 */
export const STARTER_PLANTS: { kind: PlantKind; col: number; row: number; name: string; daysAgo: number }[] = [
  { kind: 'fern', col: 1, row: 3, name: 'Pilot Reyes', daysAgo: 9 },
  { kind: 'flower', col: 3, row: 4, name: 'Engineer Novak', daysAgo: 7 },
  { kind: 'grass', col: 5, row: 2, name: 'Specialist Okoye', daysAgo: 8 },
  { kind: 'flower', col: 8, row: 3, name: 'Pilot Reyes', daysAgo: 4 },
  { kind: 'fern', col: 10, row: 1, name: 'Engineer Novak', daysAgo: 2 },
  { kind: 'grass', col: 6, row: 4, name: 'Specialist Okoye', daysAgo: 1 },
]
