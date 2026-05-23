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
  majorStopMinKm: number
  /** Lookahead: defer short break if fuel or lunch is within this many riding minutes. */
  restToleranceMinutes: number
  /** Lunch also refuels when tank is at least this fraction used (0.5 = half empty). */
  lunchRefuelMinTankUsed: number
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

export type BreakKind = 'fuel' | 'short' | 'lunch' | 'lunch-refuel'

export interface BreakEvent {
  time: Date
  kind: BreakKind
  durationMinutes: number
  lat: number
  lon: number
  /** Riding distance since the previous fill when this break was taken. */
  kmSinceLastFuel?: number
}

export type MapMarkerKind =
  | 'start'
  | 'end'
  | 'via'
  | 'pin'
  | 'major'
  | 'fuel'
  | 'short'
  | 'lunch'
  | 'lunch-refuel'

export interface MapMarker {
  lat: number
  lon: number
  kind: MapMarkerKind
  label: string
  typeLabel: string
  time?: Date
  kmSinceLastFuel?: number
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
  lunchRefuelStops: number
}

export interface TripPlan {
  segments: ItinerarySegment[]
  summary: TripSummary
  routeLine: [number, number][]
  markers: MapMarker[]
}
