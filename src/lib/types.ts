/** via = pass-through; stop = forced itinerary stop ([stop] prefix); pin = normal map pin */
export type WaypointRole = 'pin' | 'via' | 'stop'

export interface Waypoint {
  name: string
  displayName: string
  lat: number
  lon: number
  role: WaypointRole
}

export interface TripSettings {
  departureIso: string
  tankRangeKm: number
  shortBreakEveryMinutes: number
  shortBreakDurationMinutes: number
  longBreakEveryMinutes: number
  longBreakDurationMinutes: number
  autoViaMaxLegKm: number
  /** Itinerary only lists stops at least this many km apart (plus fuel/lunch/short/[stop]). 0 = all stops. */
  majorStopMinKm: number
}

export interface WeatherAtStop {
  tempC: number
  description: string
}

export interface StopEvent {
  time: Date
  waypoint: Waypoint
  weather?: WeatherAtStop
}

export type BreakKind = 'fuel' | 'short' | 'lunch'

export interface BreakEvent {
  time: Date
  kind: BreakKind
  durationMinutes: number
}

export interface RouteLegStats {
  distanceKm: number
  ridingMinutes: number
  breaks: BreakEvent[]
}

export interface LegSummary extends RouteLegStats {
  elapsedMinutes: number
}

export interface ItinerarySegment {
  from: StopEvent
  to: StopEvent
  leg: LegSummary
}

export interface TripSummary {
  totalDistanceKm: number
  totalRidingMinutes: number
  totalElapsedMinutes: number
  fuelStops: number
  shortBreaks: number
  lunchBreaks: number
}

export interface TripPlan {
  segments: ItinerarySegment[]
  summary: TripSummary
}
