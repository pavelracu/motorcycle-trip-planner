import { formatDistance, formatDuration, formatTime } from './format'
import type { BreakEvent, TripPlan, Waypoint } from './types'

function breakSuffix(b: BreakEvent): string {
  const labels: Record<BreakEvent['kind'], string> = {
    fuel: '⛽ refuel',
    short: '☕ short break',
    lunch: '🍽️ lunch',
    'lunch-refuel': '🍽️⛽ lunch & refuel',
  }
  const kmPart =
    b.kmSinceLastFuel !== undefined
      ? ` · ${formatDistance(b.kmSinceLastFuel)} since last fill`
      : ''
  return `${labels[b.kind]} (+${formatDuration(b.durationMinutes)}${kmPart})`
}

function stopLine(
  time: Date,
  waypoint: Waypoint,
  weather?: { tempC: number; description: string },
  atStopBreaks?: BreakEvent[],
): string {
  const weatherPart = weather
    ? `${weather.tempC}°C ${weather.description}`
    : 'weather unavailable'
  const breakPart =
    atStopBreaks && atStopBreaks.length > 0
      ? ` — ${atStopBreaks.map(breakSuffix).join('; ')}`
      : ''
  return `${formatTime(time)}, ${waypoint.displayName}, ${weatherPart}${breakPart}`
}

function isMidLegBreak(kind: BreakEvent['kind']): boolean {
  return kind === 'fuel'
}

/** Breaks that belong on the arrival line (not mid-route fuel). */
function atStopBreaks(breaks: BreakEvent[]): BreakEvent[] {
  return breaks.filter((b) => !isMidLegBreak(b.kind))
}

export function planToText(plan: TripPlan): string {
  const lines: string[] = []

  for (let i = 0; i < plan.segments.length; i++) {
    const { from, to, leg } = plan.segments[i]

    if (i === 0) {
      lines.push(stopLine(from.time, from.waypoint, from.weather))
      lines.push('')
    }

    for (const b of leg.breaks) {
      if (isMidLegBreak(b.kind)) lines.push(`${formatTime(b.time)}, ${breakSuffix(b)}`)
    }

    const mergedAtStop = atStopBreaks(leg.breaks)
    lines.push(stopLine(to.time, to.waypoint, to.weather, mergedAtStop))

    lines.push('')
    lines.push(
      `${formatDistance(leg.distanceKm)}, ${formatDuration(leg.ridingMinutes)} riding · ${formatDuration(leg.elapsedMinutes)} total`,
    )
    if (i < plan.segments.length - 1) lines.push('')
  }

  const { summary } = plan
  lines.push('')
  lines.push('—')
  lines.push(
    `Total: ${formatDistance(summary.totalDistanceKm)} · ${formatDuration(summary.totalRidingMinutes)} riding · ${formatDuration(summary.totalElapsedMinutes)} on the road`,
  )
  const breakParts: string[] = []
  if (summary.fuelStops) breakParts.push(`${summary.fuelStops} fuel`)
  if (summary.lunchRefuelStops)
    breakParts.push(`${summary.lunchRefuelStops} lunch & refuel`)
  if (summary.lunchBreaks) breakParts.push(`${summary.lunchBreaks} lunch`)
  if (summary.shortBreaks) breakParts.push(`${summary.shortBreaks} short`)
  if (breakParts.length) lines.push(`Breaks: ${breakParts.join(', ')}`)

  return lines.join('\n')
}
