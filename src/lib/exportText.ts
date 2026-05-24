import { formatDate, formatDistance, formatDuration, formatTime } from './format'
import type { BreakEvent, DayPlan, MultiDayTripPlan, TripPlan, Waypoint } from './types'

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
): string {
  const weatherPart = weather
    ? `${weather.tempC}°C ${weather.description}`
    : 'weather unavailable'
  return `${formatTime(time)}, ${waypoint.displayName}, ${weatherPart}`
}

function appendSegmentBreaks(lines: string[], breaks: BreakEvent[]): void {
  const sorted = [...breaks].sort(
    (a, b) => a.time.getTime() - b.time.getTime(),
  )
  for (const b of sorted) {
    lines.push(`${formatTime(b.time)}, ${breakSuffix(b)}`)
  }
}

function appendSummaryLines(lines: string[], summary: TripPlan['summary']): void {
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
}

export function planToText(plan: TripPlan): string {
  const lines: string[] = []

  for (let i = 0; i < plan.segments.length; i++) {
    const { from, to, leg } = plan.segments[i]

    if (i === 0) {
      lines.push(stopLine(from.time, from.waypoint, from.weather))
      lines.push('')
    }

    appendSegmentBreaks(lines, leg.breaks)
    lines.push(stopLine(to.time, to.waypoint, to.weather))

    lines.push('')
    lines.push(
      `${formatDistance(leg.distanceKm)}, ${formatDuration(leg.ridingMinutes)} riding · ${formatDuration(leg.elapsedMinutes)} total`,
    )
    if (i < plan.segments.length - 1) lines.push('')
  }

  lines.push('')
  lines.push('—')
  appendSummaryLines(lines, plan.summary)

  return lines.join('\n')
}

function dayPlanToText(day: DayPlan): string {
  const lines: string[] = []
  const headerDate = formatDate(new Date(day.departureIso))
  lines.push(`=== ${day.label} — ${headerDate} ===`)
  lines.push('')

  for (let i = 0; i < day.segments.length; i++) {
    const { from, to, leg } = day.segments[i]

    if (i === 0) {
      lines.push(stopLine(from.time, from.waypoint, from.weather))
      lines.push('')
    }

    appendSegmentBreaks(lines, leg.breaks)
    lines.push(stopLine(to.time, to.waypoint, to.weather))

    lines.push('')
    lines.push(
      `${formatDistance(leg.distanceKm)}, ${formatDuration(leg.ridingMinutes)} riding · ${formatDuration(leg.elapsedMinutes)} total`,
    )
    if (i < day.segments.length - 1) lines.push('')
  }

  lines.push('')
  lines.push(`Day total: ${formatDistance(day.summary.totalDistanceKm)} · ${formatDuration(day.summary.totalRidingMinutes)} riding · ${formatDuration(day.summary.totalElapsedMinutes)} on the road`)

  return lines.join('\n')
}

export function multiDayPlanToText(plan: MultiDayTripPlan): string {
  if (plan.days.length === 1) return planToText(plan.days[0])

  const lines: string[] = []
  for (let i = 0; i < plan.days.length; i++) {
    if (i > 0) lines.push('')
    lines.push(dayPlanToText(plan.days[i]))
  }

  lines.push('')
  lines.push('———')
  lines.push(`Trip total (${plan.days.length} days)`)
  appendSummaryLines(lines, plan.summary)

  return lines.join('\n')
}
