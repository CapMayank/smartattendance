/** Defaults for detecting a teacher's real arrival pattern and suggesting a shift change. */
export const SHIFT_DETECTION = {
  windowDays: 28,
  minDays: 10,
  minDaysLater: 15,
  minDeviationMin: 20,
  consistencyRatio: 0.7,
  toleranceMin: 15,
  departureMinGapMin: 180,
  matchStartMin: 15,
  matchEndMin: 30,
  dismissDays: 30,
  throttleHours: 6,
} as const
