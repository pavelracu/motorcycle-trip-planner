import { formatDate, formatDistance, formatDuration, formatTime } from './format'
import type {
  BreakEvent,
  DayPlan,
  MultiDayTripPlan,
  StopEvent,
  TripPlan,
  WeatherAtStop,
  Waypoint,
} from './types'

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

function weatherText(weather?: WeatherAtStop): string {
  return weather
    ? `${weather.tempC}°C ${weather.description}`
    : 'weather unavailable'
}

function rideStatsSuffix(km?: number, ridingMinutes?: number): string {
  const parts: string[] = []
  if (km !== undefined && km > 0) parts.push(formatDistance(km))
  if (ridingMinutes !== undefined && ridingMinutes > 0) {
    parts.push(`${formatDuration(ridingMinutes)} riding`)
  }
  return parts.length ? ` · ${parts.join(' · ')}` : ''
}

function samePlace(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): boolean {
  return Math.abs(a.lat - b.lat) < 0.0002 && Math.abs(a.lon - b.lon) < 0.0002
}

function placeLabel(b: BreakEvent): string {
  return b.placeName ?? 'En route'
}

function formatBreakLine(b: BreakEvent, legRidingMinutes?: number): string {
  const stats = rideStatsSuffix(b.kmFromStart, legRidingMinutes)
  return `${formatTime(b.time)}, ${placeLabel(b)}, ${weatherText(b.weather)}, ${breakSuffix(b)}${stats}`
}

function formatStopLine(
  stop: StopEvent,
  atStopBreaks: BreakEvent[],
  legRidingMinutes?: number,
): string {
  const breakPart =
    atStopBreaks.length > 0
      ? `, ${atStopBreaks.map(breakSuffix).join('; ')}`
      : ''
  const stats = rideStatsSuffix(stop.kmFromStart, legRidingMinutes)
  return `${formatTime(stop.time)}, ${stop.waypoint.displayName}, ${weatherText(stop.weather)}${breakPart}${stats}`
}

function partitionBreaks(
  breaks: BreakEvent[],
  destination: Waypoint,
): { midRoute: BreakEvent[]; atDestination: BreakEvent[] } {
  const midRoute: BreakEvent[] = []
  const atDestination: BreakEvent[] = []
  for (const b of breaks) {
    if (samePlace(b, destination)) atDestination.push(b)
    else midRoute.push(b)
  }
  return { midRoute, atDestination }
}

function appendSegmentEvents(
  lines: string[],
  from: StopEvent,
  breaks: BreakEvent[],
  to: StopEvent,
): void {
  const sorted = [...breaks].sort(
    (a, b) => a.time.getTime() - b.time.getTime(),
  )
  const { midRoute, atDestination } = partitionBreaks(sorted, to.waypoint)

  let prevRiding = from.ridingMinutesFromStart ?? 0

  for (const b of midRoute) {
    const legMin = Math.max(0, (b.ridingMinutesFromStart ?? prevRiding) - prevRiding)
    lines.push(formatBreakLine(b, legMin > 0 ? legMin : undefined))
    prevRiding = b.ridingMinutesFromStart ?? prevRiding
  }

  const destLegMin = Math.max(
    0,
    (to.ridingMinutesFromStart ?? prevRiding) - prevRiding,
  )
  lines.push(
    formatStopLine(
      to,
      atDestination,
      destLegMin > 0 ? destLegMin : undefined,
    ),
  )
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
      lines.push(formatStopLine(from, [], undefined))
      lines.push('')
    }

    appendSegmentEvents(lines, from, leg.breaks, to)

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
      lines.push(formatStopLine(from, [], undefined))
      lines.push('')
    }

    appendSegmentEvents(lines, from, leg.breaks, to)

    lines.push('')
    lines.push(
      `${formatDistance(leg.distanceKm)}, ${formatDuration(leg.ridingMinutes)} riding · ${formatDuration(leg.elapsedMinutes)} total`,
    )
    if (i < day.segments.length - 1) lines.push('')
  }

  lines.push('')
  lines.push(
    `Day total: ${formatDistance(day.summary.totalDistanceKm)} · ${formatDuration(day.summary.totalRidingMinutes)} riding · ${formatDuration(day.summary.totalElapsedMinutes)} on the road`,
  )

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
