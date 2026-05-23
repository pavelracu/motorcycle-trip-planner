import { formatDistance, formatDuration, formatTime } from './format'
import type { BreakEvent, TripPlan, Waypoint } from './types'

function stopLine(
  time: Date,
  waypoint: Waypoint,
  weather?: { tempC: number; description: string },
): string {
  const weatherPart = weather
    ? `${weather.tempC}°C ${weather.description}`
    : 'weather unavailable'
  return `${formatTime(time)}, ${waypoint.displayName}, ${weatherPart}`
}

function breakLine(b: BreakEvent): string {
  const labels: Record<BreakEvent['kind'], string> = {
    fuel: '⛽ Fuel stop',
    short: '☕ Short break',
    lunch: '🍽️ Lunch',
  }
  return `${formatTime(b.time)}, ${labels[b.kind]} (+${formatDuration(b.durationMinutes)})`
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
      if (b.kind === 'fuel') lines.push(breakLine(b))
    }
    lines.push(stopLine(to.time, to.waypoint, to.weather))
    for (const b of leg.breaks) {
      if (b.kind !== 'fuel') lines.push(breakLine(b))
    }

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
  if (summary.shortBreaks) breakParts.push(`${summary.shortBreaks} short`)
  if (summary.lunchBreaks) breakParts.push(`${summary.lunchBreaks} lunch`)
  if (breakParts.length) lines.push(`Breaks: ${breakParts.join(', ')}`)

  return lines.join('\n')
}
