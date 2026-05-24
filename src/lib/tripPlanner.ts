import { pointAlongPath, type LatLng } from './geo'
import {
  kmAfterFuelToLegEnd,
  shouldDeferShortBreak,
  shouldFuelAtWaypoint,
  shouldMergeLunchWithFuel,
} from './lookahead'
import { buildMapMarkers } from './mapData'
import { collapseToMajorSegments } from './majorSegments'
import { fetchRouteLeg, type RouteLeg } from './routing'
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

type PlannerState = {
  time: Date
  ridingSinceShortBreakMin: number
  ridingSinceLongBreakMin: number
  kmSinceFuel: number
  kmFromStart: number
  shortBreakPending: boolean
}

function advanceRidingKm(state: PlannerState, km: number): void {
  state.kmSinceFuel += km
  state.kmFromStart += km
}

function addMinutes(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * 60_000)
}

function markShortBreakDue(state: PlannerState, settings: TripSettings): void {
  if (state.ridingSinceShortBreakMin < settings.shortBreakEveryMinutes) return
  state.shortBreakPending = true
}

/** Max km past a fuel point before we snap the fill to the leg's destination waypoint. */
function fuelAnchorKm(settings: TripSettings, leg: RouteLeg): number {
  const avgKmh =
    leg.distanceKm > 0.01 ? (leg.distanceKm / leg.durationMinutes) * 60 : 80
  return Math.max(8, (settings.restToleranceMinutes / 60) * avgKmh)
}

function recordBreak(
  breaks: BreakEvent[],
  state: PlannerState,
  kind: BreakKind,
  durationMinutes: number,
  lat: number,
  lon: number,
  kmSinceLastFuel?: number,
): void {
  breaks.push({
    time: new Date(state.time),
    kind,
    durationMinutes,
    lat,
    lon,
    kmFromStart: state.kmFromStart,
    ...(kmSinceLastFuel !== undefined ? { kmSinceLastFuel } : {}),
  })
  state.time = addMinutes(state.time, durationMinutes)
}

function rideLeg(
  _from: Waypoint,
  _to: Waypoint,
  legMeta: RouteLeg,
  legIdx: number,
  allLegs: RouteLeg[],
  settings: TripSettings,
  state: PlannerState,
): { stats: RouteLegStats; path: LatLng[] } {
  const breaks: BreakEvent[] = []
  const leg = legMeta

  let remainingKm = leg.distanceKm
  let remainingRideMin = leg.durationMinutes
  let ridingMinutes = 0
  let distanceKm = 0
  let riddenKm = 0

  while (remainingKm > 0.01) {
    if (state.kmSinceFuel >= settings.tankRangeKm - 0.01) {
      const [lat, lon] = pointAlongPath(
        leg.path,
        Math.min(1, riddenKm / leg.distanceKm),
      )
      recordBreak(
        breaks,
        state,
        'fuel',
        settings.shortBreakDurationMinutes,
        lat,
        lon,
        state.kmSinceFuel,
      )
      state.kmSinceFuel = 0
      state.ridingSinceShortBreakMin = 0
      state.shortBreakPending = false
      continue
    }

    const kmUntilFuel = settings.tankRangeKm - state.kmSinceFuel

    if (kmUntilFuel > 0 && remainingKm > kmUntilFuel + 0.01) {
      if (kmAfterFuelToLegEnd(remainingKm, kmUntilFuel) <= fuelAnchorKm(settings, leg)) {
        state.time = addMinutes(state.time, remainingRideMin)
        state.ridingSinceShortBreakMin += remainingRideMin
        state.ridingSinceLongBreakMin += remainingRideMin
        markShortBreakDue(state, settings)
        ridingMinutes += remainingRideMin
        distanceKm += remainingKm
        advanceRidingKm(state, remainingKm)
        remainingKm = 0
        continue
      }

      const fraction = kmUntilFuel / leg.distanceKm
      const rideMin = leg.durationMinutes * fraction
      state.time = addMinutes(state.time, rideMin)
      state.ridingSinceShortBreakMin += rideMin
      state.ridingSinceLongBreakMin += rideMin
      ridingMinutes += rideMin
      distanceKm += kmUntilFuel
      riddenKm += kmUntilFuel
      advanceRidingKm(state, kmUntilFuel)
      state.kmSinceFuel = 0
      markShortBreakDue(state, settings)

      const [lat, lon] = pointAlongPath(leg.path, riddenKm / leg.distanceKm)
      recordBreak(
        breaks,
        state,
        'fuel',
        settings.shortBreakDurationMinutes,
        lat,
        lon,
        settings.tankRangeKm,
      )
      state.ridingSinceShortBreakMin = 0
      state.shortBreakPending = false
      remainingKm -= kmUntilFuel
      remainingRideMin -= rideMin
      continue
    }

    const slackLimit =
      settings.shortBreakEveryMinutes + settings.restToleranceMinutes
    const deferShortBreak = shouldDeferShortBreak(
      legIdx,
      state.kmSinceFuel,
      state.ridingSinceLongBreakMin,
      state.ridingSinceShortBreakMin,
      allLegs,
      settings,
    )
    const mustTakeShortBreak =
      state.shortBreakPending &&
      (state.ridingSinceShortBreakMin >= slackLimit ||
        (state.ridingSinceShortBreakMin + remainingRideMin >= slackLimit &&
          !deferShortBreak))

    if (mustTakeShortBreak) {
      const overrun = slackLimit - state.ridingSinceShortBreakMin
      if (overrun > 0 && overrun < remainingRideMin) {
        const fraction = overrun / remainingRideMin
        const rideMin = remainingRideMin * fraction
        state.time = addMinutes(state.time, rideMin)
        state.ridingSinceShortBreakMin += rideMin
        state.ridingSinceLongBreakMin += rideMin
        ridingMinutes += rideMin
        distanceKm += remainingKm * fraction
        riddenKm += remainingKm * fraction
        advanceRidingKm(state, remainingKm * fraction)
        remainingKm *= 1 - fraction
        remainingRideMin -= rideMin

        const [lat, lon] = pointAlongPath(
          leg.path,
          Math.min(1, riddenKm / leg.distanceKm),
        )
        recordBreak(
          breaks,
          state,
          'short',
          settings.shortBreakDurationMinutes,
          lat,
          lon,
        )
        state.ridingSinceShortBreakMin = 0
        state.shortBreakPending = false
      } else {
        const [lat, lon] = pointAlongPath(
          leg.path,
          Math.min(1, riddenKm / leg.distanceKm),
        )
        recordBreak(
          breaks,
          state,
          'short',
          settings.shortBreakDurationMinutes,
          lat,
          lon,
        )
        state.ridingSinceShortBreakMin = 0
        state.shortBreakPending = false
        continue
      }
    }

    state.time = addMinutes(state.time, remainingRideMin)
    state.ridingSinceShortBreakMin += remainingRideMin
    state.ridingSinceLongBreakMin += remainingRideMin
    markShortBreakDue(state, settings)
    ridingMinutes += remainingRideMin
    distanceKm += remainingKm
    advanceRidingKm(state, remainingKm)
    remainingKm = 0
  }

  return {
    stats: { distanceKm, ridingMinutes, breaks },
    path: leg.path,
  }
}

function applyWaypointBreaks(
  breaks: BreakEvent[],
  state: PlannerState,
  settings: TripSettings,
  at: Waypoint,
  hadFuelOnLeg: boolean,
  nextLegIdx: number,
  allLegs: RouteLeg[],
): void {
  const fuelAtWaypoint =
    !hadFuelOnLeg &&
    shouldFuelAtWaypoint(nextLegIdx, state.kmSinceFuel, allLegs, settings)
  const lunchDue =
    state.ridingSinceLongBreakMin >= settings.longBreakEveryMinutes

  if (lunchDue) {
    const mergeRefuel =
      !hadFuelOnLeg &&
      (shouldMergeLunchWithFuel(
        nextLegIdx,
        state.kmSinceFuel,
        allLegs,
        settings,
      ) ||
        fuelAtWaypoint)

    if (mergeRefuel) {
      recordBreak(
        breaks,
        state,
        'lunch-refuel',
        settings.longBreakDurationMinutes,
        at.lat,
        at.lon,
        state.kmSinceFuel,
      )
      state.kmSinceFuel = 0
    } else {
      recordBreak(
        breaks,
        state,
        'lunch',
        settings.longBreakDurationMinutes,
        at.lat,
        at.lon,
      )
    }

    state.ridingSinceShortBreakMin = 0
    state.ridingSinceLongBreakMin = 0
    state.shortBreakPending = false
    return
  }

  if (fuelAtWaypoint) {
    recordBreak(
      breaks,
      state,
      'fuel',
      settings.shortBreakDurationMinutes,
      at.lat,
      at.lon,
      state.kmSinceFuel,
    )
    state.kmSinceFuel = 0
    state.ridingSinceShortBreakMin = 0
    state.shortBreakPending = false
    return
  }

  if (hadFuelOnLeg) {
    state.shortBreakPending = false
    return
  }

  if (!state.shortBreakPending) return

  const slackExceeded =
    state.ridingSinceShortBreakMin >=
    settings.shortBreakEveryMinutes + settings.restToleranceMinutes
  const pushToAnchor =
    !slackExceeded &&
    shouldDeferShortBreak(
      nextLegIdx,
      state.kmSinceFuel,
      state.ridingSinceLongBreakMin,
      state.ridingSinceShortBreakMin,
      allLegs,
      settings,
    )

  if (at.role === 'stop' || slackExceeded || !pushToAnchor) {
    recordBreak(
      breaks,
      state,
      'short',
      settings.shortBreakDurationMinutes,
      at.lat,
      at.lon,
    )
    state.ridingSinceShortBreakMin = 0
    state.shortBreakPending = false
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
  let lunchRefuelStops = 0

  for (const b of [...legs.flatMap((l) => l.breaks), ...postStopBreaks.flat()]) {
    if (b.kind === 'fuel') fuelStops++
    else if (b.kind === 'short') shortBreaks++
    else if (b.kind === 'lunch') lunchBreaks++
    else if (b.kind === 'lunch-refuel') lunchRefuelStops++
  }

  return {
    totalDistanceKm: legs.reduce((s, l) => s + l.distanceKm, 0),
    totalRidingMinutes: legs.reduce((s, l) => s + l.ridingMinutes, 0),
    totalElapsedMinutes,
    fuelStops,
    shortBreaks,
    lunchBreaks,
    lunchRefuelStops,
  }
}

function concatPaths(paths: LatLng[][]): LatLng[] {
  const line: LatLng[] = []
  for (const path of paths) {
    if (path.length === 0) continue
    if (line.length === 0) {
      line.push(...path)
      continue
    }
    const last = line[line.length - 1]
    const first = path[0]
    if (last[0] === first[0] && last[1] === first[1]) {
      line.push(...path.slice(1))
    } else {
      line.push(...path)
    }
  }
  return line
}

export async function buildTripPlan(
  waypoints: Waypoint[],
  settings: TripSettings,
  onProgress?: (msg: string) => void,
): Promise<TripPlan> {
  if (waypoints.length < 2) throw new Error('Need at least 2 waypoints')

  onProgress?.('Precomputing route legs…')
  const precomputedLegs = await Promise.all(
    waypoints.slice(0, -1).map((from, i) => fetchRouteLeg(from, waypoints[i + 1])),
  )

  const stopDrafts: { time: Date; waypoint: Waypoint; kmFromStart: number }[] = []
  const legs: RouteLegStats[] = []
  const postStopBreaks: BreakEvent[][] = []
  const legPaths: LatLng[][] = []

  const state: PlannerState = {
    time: new Date(settings.departureIso),
    ridingSinceShortBreakMin: 0,
    ridingSinceLongBreakMin: 0,
    kmSinceFuel: 0,
    kmFromStart: 0,
    shortBreakPending: false,
  }

  stopDrafts.push({
    time: new Date(state.time),
    waypoint: waypoints[0],
    kmFromStart: 0,
  })
  postStopBreaks.push([])

  for (let i = 0; i < waypoints.length - 1; i++) {
    onProgress?.(`Planning leg ${i + 1} of ${waypoints.length - 1}…`)
    const { stats, path } = rideLeg(
      waypoints[i],
      waypoints[i + 1],
      precomputedLegs[i],
      i,
      precomputedLegs,
      settings,
      state,
    )
    legs.push(stats)
    legPaths.push(path)
    stopDrafts.push({
      time: new Date(state.time),
      waypoint: waypoints[i + 1],
      kmFromStart: state.kmFromStart,
    })

    const breaksAfter: BreakEvent[] = []
    const hadFuel = stats.breaks.some((b) => b.kind === 'fuel')
    if (i < waypoints.length - 2) {
      applyWaypointBreaks(
        breaksAfter,
        state,
        settings,
        waypoints[i + 1],
        hadFuel,
        i + 1,
        precomputedLegs,
      )
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

  const allBreaks = [
    ...legs.flatMap((l) => l.breaks),
    ...postStopBreaks.flat(),
  ]

  return {
    segments,
    summary: buildSummary(legs, postStopBreaks, totalElapsedMinutes),
    routeLine: concatPaths(legPaths),
    markers: buildMapMarkers(waypoints, stops, segments, allBreaks),
  }
}
