import { collapseToMajorSegments } from './majorSegments'
import { fetchRouteLeg } from './routing'
import { fetchWeatherBatch } from './weather'
import type {
  BreakEvent,
  BreakKind,
  ItinerarySegment,
  RouteLegStats,
  StopEvent,
  TripPlan,
  TripSettings,
  TripSummary,
  Waypoint,
} from './types'

function addMinutes(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * 60_000)
}

function recordBreak(
  breaks: BreakEvent[],
  state: { time: Date },
  kind: BreakKind,
  durationMinutes: number,
): void {
  breaks.push({ time: new Date(state.time), kind, durationMinutes })
  state.time = addMinutes(state.time, durationMinutes)
}

async function rideLeg(
  from: Waypoint,
  to: Waypoint,
  settings: TripSettings,
  state: {
    time: Date
    ridingSinceShortBreakMin: number
    ridingSinceLongBreakMin: number
    kmSinceFuel: number
  },
): Promise<RouteLegStats> {
  const leg = await fetchRouteLeg(from, to)
  const breaks: BreakEvent[] = []

  let remainingKm = leg.distanceKm
  let remainingRideMin = leg.durationMinutes
  let ridingMinutes = 0
  let distanceKm = 0

  while (remainingKm > 0.01) {
    const kmUntilFuel = settings.tankRangeKm - state.kmSinceFuel

    if (kmUntilFuel > 0 && remainingKm > kmUntilFuel + 0.01) {
      const fraction = kmUntilFuel / leg.distanceKm
      const rideMin = leg.durationMinutes * fraction
      state.time = addMinutes(state.time, rideMin)
      state.ridingSinceShortBreakMin += rideMin
      state.ridingSinceLongBreakMin += rideMin
      ridingMinutes += rideMin
      distanceKm += kmUntilFuel
      state.kmSinceFuel = 0
      recordBreak(breaks, state, 'fuel', settings.shortBreakDurationMinutes)
      state.ridingSinceShortBreakMin = 0
      remainingKm -= kmUntilFuel
      remainingRideMin -= rideMin
      continue
    }

    state.time = addMinutes(state.time, remainingRideMin)
    state.ridingSinceShortBreakMin += remainingRideMin
    state.ridingSinceLongBreakMin += remainingRideMin
    ridingMinutes += remainingRideMin
    distanceKm += remainingKm
    state.kmSinceFuel += remainingKm
    remainingKm = 0
  }

  return { distanceKm, ridingMinutes, breaks }
}

function applyWaypointBreaks(
  breaks: BreakEvent[],
  state: {
    time: Date
    ridingSinceShortBreakMin: number
    ridingSinceLongBreakMin: number
  },
  settings: TripSettings,
): void {
  if (state.ridingSinceLongBreakMin >= settings.longBreakEveryMinutes) {
    recordBreak(breaks, state, 'lunch', settings.longBreakDurationMinutes)
    state.ridingSinceShortBreakMin = 0
    state.ridingSinceLongBreakMin = 0
    return
  }

  if (state.ridingSinceShortBreakMin >= settings.shortBreakEveryMinutes) {
    recordBreak(breaks, state, 'short', settings.shortBreakDurationMinutes)
    state.ridingSinceShortBreakMin = 0
  }
}

function buildSegments(
  stops: StopEvent[],
  legs: RouteLegStats[],
  postStopBreaks: BreakEvent[][],
): ItinerarySegment[] {
  const segments: ItinerarySegment[] = []
  let legIdx = 0
  let segStart = 0

  while (legIdx < legs.length && segStart < stops.length - 1) {
    const from = stops[segStart]
    let distanceKm = 0
    let ridingMinutes = 0
    const breaks: BreakEvent[] = []

    while (legIdx < legs.length) {
      const leg = legs[legIdx]
      distanceKm += leg.distanceKm
      ridingMinutes += leg.ridingMinutes
      breaks.push(...leg.breaks)

      const destIdx = legIdx + 1
      const to = stops[destIdx]
      legIdx++

      const isLastLeg = legIdx >= legs.length
      if (to.waypoint.role !== 'via' || isLastLeg) {
        breaks.push(...(postStopBreaks[destIdx] ?? []))
        const breakMinutes = breaks.reduce((s, b) => s + b.durationMinutes, 0)
        segments.push({
          from,
          to,
          leg: {
            distanceKm,
            ridingMinutes,
            elapsedMinutes: ridingMinutes + breakMinutes,
            breaks,
          },
        })
        segStart = destIdx
        break
      }
    }
  }

  return segments
}

function buildSummary(
  legs: RouteLegStats[],
  postStopBreaks: BreakEvent[][],
  totalElapsedMinutes: number,
): TripSummary {
  let fuelStops = 0
  let shortBreaks = 0
  let lunchBreaks = 0

  for (const b of [...legs.flatMap((l) => l.breaks), ...postStopBreaks.flat()]) {
    if (b.kind === 'fuel') fuelStops++
    else if (b.kind === 'short') shortBreaks++
    else lunchBreaks++
  }

  return {
    totalDistanceKm: legs.reduce((s, l) => s + l.distanceKm, 0),
    totalRidingMinutes: legs.reduce((s, l) => s + l.ridingMinutes, 0),
    totalElapsedMinutes,
    fuelStops,
    shortBreaks,
    lunchBreaks,
  }
}

export async function buildTripPlan(
  waypoints: Waypoint[],
  settings: TripSettings,
  onProgress?: (msg: string) => void,
): Promise<TripPlan> {
  if (waypoints.length < 2) throw new Error('Need at least 2 waypoints')

  const stopDrafts: { time: Date; waypoint: Waypoint }[] = []
  const legs: RouteLegStats[] = []
  const postStopBreaks: BreakEvent[][] = []

  const state = {
    time: new Date(settings.departureIso),
    ridingSinceShortBreakMin: 0,
    ridingSinceLongBreakMin: 0,
    kmSinceFuel: 0,
  }

  stopDrafts.push({ time: new Date(state.time), waypoint: waypoints[0] })
  postStopBreaks.push([])

  for (let i = 0; i < waypoints.length - 1; i++) {
    onProgress?.(`Routing leg ${i + 1} of ${waypoints.length - 1}…`)
    legs.push(await rideLeg(waypoints[i], waypoints[i + 1], settings, state))
    stopDrafts.push({ time: new Date(state.time), waypoint: waypoints[i + 1] })

    const breaksAfter: BreakEvent[] = []
    if (i < waypoints.length - 2) {
      applyWaypointBreaks(breaksAfter, state, settings)
    }
    postStopBreaks.push(breaksAfter)
  }

  onProgress?.('Fetching weather…')
  const weathers = await fetchWeatherBatch(stopDrafts)

  const stops: StopEvent[] = stopDrafts.map((draft, i) => ({
    ...draft,
    weather: weathers[i],
  }))

  const departure = stops[0].time
  const totalElapsedMinutes =
    (state.time.getTime() - departure.getTime()) / 60_000

  const segments = collapseToMajorSegments(
    buildSegments(stops, legs, postStopBreaks),
    settings,
  )

  return {
    segments,
    summary: buildSummary(legs, postStopBreaks, totalElapsedMinutes),
  }
}
