/**
 * Docking Run: a ghost-racing version of the psychomotor vigilance (reaction) test.
 *
 * Timing follows the usual reaction-test conventions used in the app: a press under
 * 100 ms is a false start, over 500 ms a lapse (slow, the standard PVT lapse), and no
 * press within 1000 ms a miss. The health service still scores the median reaction
 * time with its own rules (docs/health_rules.md: Normal / Watch / Alert vs baseline).
 */

export const RACE_RULES = {
  /** Docking lights per run. */
  gates: 12,
  /** Random wait before each light turns green (ms). */
  waitMinMs: 1400,
  waitMaxMs: 3200,
  /** A press within this window after the light counts; later = missed. */
  windowMs: 1000,
  falseStartBelowMs: 100,
  lapseOverMs: 500,
  /** Points for one light: fast presses score more, never below the floor. */
  maxPoints: 1000,
  floorPoints: 100,
  falseStartPenalty: 100,
  /**
   * Weekly crew goal: everyone's best daily score added up. Set so the simulated
   * crewmates alone (about 23,000 a day) can't reach it: the real crew has to play.
   */
  crewWeeklyTarget: 220_000,
} as const

/**
 * Simulated crewmates fill the track until real crewmates have run today's course.
 * Fictional, and always labelled "simulated" in the UI.
 */
export const SIMULATED_CREWMATES = [
  { id: 'sim-pilot', name: 'Pilot Reyes', meanMs: 285, sdMs: 35, slipChance: 0.04 },
  { id: 'sim-engineer', name: 'Engineer Novak', meanMs: 315, sdMs: 45, slipChance: 0.06 },
  { id: 'sim-specialist', name: 'Specialist Okoye', meanMs: 345, sdMs: 55, slipChance: 0.08 },
] as const
