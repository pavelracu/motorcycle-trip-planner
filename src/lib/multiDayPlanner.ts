import type { LatLng } from './geo'
import { applyAutoVia } from './consolidateWaypoints'
import { enrichWaypointsWithLocality } from './locality'
import { buildTripPlan } from './tripPlanner'
import type {
  DayPlan,
  MapMarker,
  MultiDayTripPlan,
  TripDayRoute,
  TripPlan,
  TripSettings,
  TripSummary,
} from './types'

export const DAY_ROUTE_COLORS = [
  '#fbbf24',
  '#38bdf8',
  '#a78bfa',
  '#fb7185',
  '#34d399',
  '#f97316',
  '#818cf8',
]

function parseDailyStartTime(time: string): { hours: number; minutes: number } {
  const [h, m] = time.split(':').map((part) => Number(part))
  return {
    hours: Number.isFinite(h) ? h : 6,
    minutes: Number.isFinite(m) ? m : 0,
  }
}

/** Next calendar day at dailyStartTime, after the previous riding day ended. */
export function nextDayDepartureIso(
  previousEndTime: Date,
  dailyStartTime: string,
): string {
  const { hours, minutes } = parseDailyStartTime(dailyStartTime)
  const next = new Date(previousEndTime)
  next.setDate(next.getDate() + 1)
  next.setHours(hours, minutes, 0, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}T${pad(hours)}:${pad(minutes)}:00`
}

function mergeSummaries(days: DayPlan[]): TripSummary {
  return days.reduce(
    (acc, day) => ({
      totalDistanceKm: acc.totalDistanceKm + day.summary.totalDistanceKm,
      totalRidingMinutes:
        acc.totalRidingMinutes + day.summary.totalRidingMinutes,
      totalElapsedMinutes:
        acc.totalElapsedMinutes + day.summary.totalElapsedMinutes,
      fuelStops: acc.fuelStops + day.summary.fuelStops,
      shortBreaks: acc.shortBreaks + day.summary.shortBreaks,
      lunchBreaks: acc.lunchBreaks + day.summary.lunchBreaks,
      lunchRefuelStops: acc.lunchRefuelStops + day.summary.lunchRefuelStops,
    }),
    {
      totalDistanceKm: 0,
      totalRidingMinutes: 0,
      totalElapsedMinutes: 0,
      fuelStops: 0,
      shortBreaks: 0,
      lunchBreaks: 0,
      lunchRefuelStops: 0,
    },
  )
}

function posKey(lat: number, lon: number): string {
  return `${lat.toFixed(5)},${lon.toFixed(5)}`
}

function mergeDayMarkers(dayPlans: DayPlan[]): MapMarker[] {
  const byPos = new Map<string, MapMarker>()

  for (let dayIdx = 0; dayIdx < dayPlans.length; dayIdx++) {
    const day = dayPlans[dayIdx]
    const isFirstDay = dayIdx === 0
    const isLastDay = dayIdx === dayPlans.length - 1

    for (const marker of day.markers) {
      let kind = marker.kind
      if (!isFirstDay && kind === 'start') {
        kind = 'major'
      }
      if (!isLastDay && kind === 'end') {
        kind = 'major'
      }

      const merged: MapMarker = {
        ...marker,
        kind,
        dayLabel: day.label,
        typeLabel:
          kind !== marker.kind
            ? kind === 'major'
              ? 'Major stop'
              : marker.typeLabel
            : marker.typeLabel,
      }

      const key = posKey(marker.lat, marker.lon)
      const existing = byPos.get(key)
      if (!existing) {
        byPos.set(key, merged)
        continue
      }

      if (merged.time && (!existing.time || merged.time < existing.time)) {
        existing.time = merged.time
      }
      if (merged.dayLabel && existing.dayLabel !== merged.dayLabel) {
        existing.dayLabel = `${existing.dayLabel} · ${merged.dayLabel}`
      }
      if (
        merged.kind === 'fuel' ||
        merged.kind === 'lunch' ||
        merged.kind === 'lunch-refuel' ||
        merged.kind === 'short'
      ) {
        existing.kind = merged.kind
        existing.typeLabel = merged.typeLabel
        existing.kmSinceLastFuel = merged.kmSinceLastFuel
      }
    }
  }

  return [...byPos.values()]
}

function dayEndTime(plan: TripPlan, departureIso: string): Date {
  const departure = new Date(departureIso)
  return new Date(departure.getTime() + plan.summary.totalElapsedMinutes * 60_000)
}

export async function buildMultiDayTripPlan(
  days: TripDayRoute[],
  settings: TripSettings,
  onProgress?: (msg: string) => void,
): Promise<MultiDayTripPlan> {
  if (days.length === 0) throw new Error('Add at least one route file')
  if (days.some((d) => d.waypoints.length < 2)) {
    throw new Error('Each day needs at least 2 waypoints')
  }

  const dayPlans: DayPlan[] = []
  let departureIso = settings.departureIso

  for (let i = 0; i < days.length; i++) {
    const dayRoute = days[i]
    onProgress?.(`Day ${i + 1} of ${days.length}: resolving places…`)

    const resolved = dayRoute.waypoints.map((w) => ({ ...w }))
    await enrichWaypointsWithLocality(resolved, onProgress)

    onProgress?.(`Day ${i + 1} of ${days.length}: routing…`)
    const routed = await applyAutoVia(
      resolved,
      settings.autoViaMaxLegKm,
      onProgress,
    )

    const daySettings = { ...settings, departureIso }
    onProgress?.(`Day ${i + 1} of ${days.length}: planning breaks…`)
    const plan = await buildTripPlan(routed, daySettings, onProgress)

    const endTime = dayEndTime(plan, departureIso)
    dayPlans.push({
      ...plan,
      dayIndex: i,
      label: dayRoute.label,
      departureIso,
      endTime,
    })

    if (i < days.length - 1) {
      departureIso = nextDayDepartureIso(endTime, settings.dailyStartTime)
    }
  }

  return {
    days: dayPlans,
    summary: mergeSummaries(dayPlans),
    routeLines: dayPlans.map((day, i) => ({
      dayIndex: i,
      label: day.label,
      line: day.routeLine,
      color: DAY_ROUTE_COLORS[i % DAY_ROUTE_COLORS.length],
    })),
    markers: mergeDayMarkers(dayPlans),
  }
}

export function allWaypointsFromDays(days: TripDayRoute[]): LatLng[] {
  const points: LatLng[] = []
  for (const day of days) {
    for (const w of day.waypoints) {
      const last = points[points.length - 1]
      if (last && last[0] === w.lat && last[1] === w.lon) continue
      points.push([w.lat, w.lon])
    }
  }
  return points
}
