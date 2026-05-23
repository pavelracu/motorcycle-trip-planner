import { MARKER_TYPE_LABELS } from './markerLabels'
import type { LatLng } from './geo'
import type { BreakEvent, MapMarker, StopEvent, TripPlan, Waypoint } from './types'

function posKey(lat: number, lon: number): string {
  return `${lat.toFixed(5)},${lon.toFixed(5)}`
}

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
  if (
    marker.kind === 'fuel' ||
    marker.kind === 'lunch' ||
    marker.kind === 'lunch-refuel' ||
    marker.kind === 'short'
  ) {
    existing.kind = marker.kind
    existing.typeLabel = marker.typeLabel
  }
}

export function buildPreviewLine(waypoints: Waypoint[]): LatLng[] {
  return waypoints.map((w) => [w.lat, w.lon])
}

export function buildMapMarkers(
  waypoints: Waypoint[],
  stops: StopEvent[],
  segments: TripPlan['segments'],
  allBreaks: BreakEvent[],
): MapMarker[] {
  const byPos = new Map<string, MapMarker>()
  const majorIds = new Set(
    segments.map((s) => posKey(s.to.waypoint.lat, s.to.waypoint.lon)),
  )

  if (stops.length > 0) {
    const start = stops[0]
    upsertMarker(byPos, {
      lat: start.waypoint.lat,
      lon: start.waypoint.lon,
      kind: 'start',
      label: start.waypoint.displayName,
      typeLabel: MARKER_TYPE_LABELS.start,
      time: start.time,
    })
  }

  for (let i = 0; i < waypoints.length; i++) {
    const w = waypoints[i]
    const key = posKey(w.lat, w.lon)
    if (i === 0 || i === waypoints.length - 1) continue

    if (w.role === 'via') {
      upsertMarker(byPos, {
        lat: w.lat,
        lon: w.lon,
        kind: 'via',
        label: w.displayName,
        typeLabel: MARKER_TYPE_LABELS.via,
      })
    } else if (!majorIds.has(key)) {
      upsertMarker(byPos, {
        lat: w.lat,
        lon: w.lon,
        kind: 'pin',
        label: w.displayName,
        typeLabel: MARKER_TYPE_LABELS.pin,
      })
    }
  }

  const startKey =
    stops.length > 0 ? posKey(stops[0].waypoint.lat, stops[0].waypoint.lon) : ''
  const endKey =
    stops.length > 1
      ? posKey(stops[stops.length - 1].waypoint.lat, stops[stops.length - 1].waypoint.lon)
      : ''

  for (const seg of segments) {
    const w = seg.to.waypoint
    const key = posKey(w.lat, w.lon)
    if (key === startKey || key === endKey) continue
    upsertMarker(byPos, {
      lat: w.lat,
      lon: w.lon,
      kind: 'major',
      label: w.displayName,
      typeLabel: MARKER_TYPE_LABELS.major,
      time: seg.to.time,
    })
  }

  if (stops.length > 1) {
    const end = stops[stops.length - 1]
    upsertMarker(byPos, {
      lat: end.waypoint.lat,
      lon: end.waypoint.lon,
      kind: 'end',
      label: end.waypoint.displayName,
      typeLabel: MARKER_TYPE_LABELS.end,
      time: end.time,
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
      ...(isFill && b.kmSinceLastFuel !== undefined
        ? { kmSinceLastFuel: b.kmSinceLastFuel }
        : {}),
    })
  }

  return [...byPos.values()]
}
