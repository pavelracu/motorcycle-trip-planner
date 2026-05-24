import type { RouteLeg } from './routing'
import type { TripSettings } from './types'

/** Riding minutes until the next fuel stop from the start of legIdx. */
export function minutesUntilFuel(
  legIdx: number,
  kmSinceFuel: number,
  legs: RouteLeg[],
  tankRangeKm: number,
): number {
  let km = kmSinceFuel
  let minutes = 0

  for (let i = legIdx; i < legs.length; i++) {
    const { distanceKm, durationMinutes } = legs[i]
    if (distanceKm < 0.01) continue

    if (km + distanceKm >= tankRangeKm - 0.01) {
      const needKm = Math.max(0, tankRangeKm - km)
      return minutes + (needKm / distanceKm) * durationMinutes
    }

    km += distanceKm
    minutes += durationMinutes
  }

  return Number.POSITIVE_INFINITY
}

/** Riding minutes until lunch is due from the start of legIdx. */
export function minutesUntilLunch(
  legIdx: number,
  ridingSinceLongMin: number,
  legs: RouteLeg[],
  settings: TripSettings,
): number {
  let riding = ridingSinceLongMin
  let minutes = 0

  for (let i = legIdx; i < legs.length; i++) {
    const { durationMinutes } = legs[i]
    if (riding + durationMinutes >= settings.longBreakEveryMinutes) {
      const needMin = settings.longBreakEveryMinutes - riding
      return minutes + Math.max(0, needMin)
    }
    riding += durationMinutes
    minutes += durationMinutes
  }

  return Number.POSITIVE_INFINITY
}

/** Fuel should happen at the upcoming waypoint, not a few km into the next leg. */
export function shouldFuelAtWaypoint(
  legIdx: number,
  kmSinceFuel: number,
  legs: RouteLeg[],
  settings: TripSettings,
): boolean {
  if (kmSinceFuel < 0.01) return false
  if (kmSinceFuel >= settings.tankRangeKm - 0.01) return true
  return (
    minutesUntilFuel(legIdx, kmSinceFuel, legs, settings.tankRangeKm) <=
    settings.restToleranceMinutes
  )
}

/** Riding km after a mid-leg fuel stop until the end of the current leg. */
export function kmAfterFuelToLegEnd(
  remainingKm: number,
  kmUntilFuel: number,
): number {
  return remainingKm - kmUntilFuel
}

/** Lunch may include refuel only when the tank is low enough and a fuel stop is soon. */
export function shouldMergeLunchWithFuel(
  legIdx: number,
  kmSinceFuel: number,
  legs: RouteLeg[],
  settings: TripSettings,
): boolean {
  if (kmSinceFuel < settings.tankRangeKm * settings.lunchRefuelMinTankUsed) {
    return false
  }
  return (
    minutesUntilFuel(legIdx, kmSinceFuel, legs, settings.tankRangeKm) <=
    settings.restToleranceMinutes
  )
}

/** True when a short break should wait for an upcoming fuel or lunch stop. */
export function shouldDeferShortBreak(
  legIdx: number,
  kmSinceFuel: number,
  ridingSinceLongMin: number,
  ridingSinceShortMin: number,
  legs: RouteLeg[],
  settings: TripSettings,
): boolean {
  const slackLimit =
    settings.shortBreakEveryMinutes + settings.restToleranceMinutes
  if (ridingSinceShortMin >= slackLimit) return false

  const tolerance = settings.restToleranceMinutes
  const untilAnchor = Math.min(
    minutesUntilFuel(legIdx, kmSinceFuel, legs, settings.tankRangeKm),
    minutesUntilLunch(legIdx, ridingSinceLongMin, legs, settings),
  )
  return untilAnchor <= tolerance
}
