import { MARKER_TYPE_LABELS } from './markerLabels'
import type { LatLng } from './geo'
import type { BreakEvent, MapMarker, StopEvent, TripPlan, Waypoint } from './types'

function posKey(lat: number, lon: number): string {
  return `${lat.toFixed(5)},${lon.toFixed(5)}`
}

const BREAK_KINDS = new Set<MapMarker['kind']>([
  'fuel',
  'lunch',
  'lunch-refuel',
  'short',
])

function upsertMarker(map: Map<string, MapMarker>, marker: MapMarker): void {
  const key = posKey(marker.lat, marker.lon)
  const existing = map.get(key)
  if (!existing) {
    map.set(key, marker)
    return
  }
  if (marker.time && (!existing.time || marker.time < existing.time)) {
    existing.time = marker.time
  }
  if (marker.kmFromStart !== undefined) {
    existing.kmFromStart = marker.kmFromStart
  }
  if (BREAK_KINDS.has(marker.kind)) {
    existing.kind = marker.kind
    existing.typeLabel = marker.typeLabel
    existing.label = marker.label
    if (marker.kmSinceLastFuel !== undefined) {
      existing.kmSinceLastFuel = marker.kmSinceLastFuel
    }
  }
}

function markerKindForStop(
  index: number,
  stopCount: number,
  waypoint: Waypoint,
  isMajor: boolean,
): MapMarker['kind'] {
  if (index === 0) return 'start'
  if (index === stopCount - 1) return 'end'
  if (waypoint.role === 'via') return 'via'
  if (isMajor) return 'major'
  return 'pin'
}

export function buildPreviewLine(waypoints: Waypoint[]): LatLng[] {
  return waypoints.map((w) => [w.lat, w.lon])
}

export function buildMapMarkers(
  _waypoints: Waypoint[],
  stops: StopEvent[],
  segments: TripPlan['segments'],
  allBreaks: BreakEvent[],
): MapMarker[] {
  const byPos = new Map<string, MapMarker>()
  const majorIds = new Set(
    segments.map((s) => posKey(s.to.waypoint.lat, s.to.waypoint.lon)),
  )

  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i]
    const w = stop.waypoint
    const key = posKey(w.lat, w.lon)
    const kind = markerKindForStop(i, stops.length, w, majorIds.has(key))

    upsertMarker(byPos, {
      lat: w.lat,
      lon: w.lon,
      kind,
      label: w.displayName,
      typeLabel: MARKER_TYPE_LABELS[kind],
      time: stop.time,
      kmFromStart: stop.kmFromStart,
    })
  }

  for (const b of allBreaks) {
    const isFill = b.kind === 'fuel' || b.kind === 'lunch-refuel'
    upsertMarker(byPos, {
      lat: b.lat,
      lon: b.lon,
      kind: b.kind,
      label: MARKER_TYPE_LABELS[b.kind],
      typeLabel: MARKER_TYPE_LABELS[b.kind],
      time: b.time,
      kmFromStart: b.kmFromStart,
      ...(isFill && b.kmSinceLastFuel !== undefined
        ? { kmSinceLastFuel: b.kmSinceLastFuel }
        : {}),
    })
  }

  return [...byPos.values()]
}
