import L from 'leaflet'
import { useEffect, useMemo } from 'react'
import {
  CircleMarker,
  MapContainer,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet'
import { formatDistance, formatTime } from '../lib/format'
import type { LatLng } from '../lib/geo'
import { MARKER_TYPE_LABELS } from '../lib/markerLabels'
import type { MapMarker, TripPlan, Waypoint } from '../lib/types'
import 'leaflet/dist/leaflet.css'

const MARKER_STYLE: Record<
  MapMarker['kind'],
  { color: string; radius: number; fillOpacity: number }
> = {
  start: { color: '#22c55e', radius: 9, fillOpacity: 0.95 },
  end: { color: '#ef4444', radius: 9, fillOpacity: 0.95 },
  major: { color: '#3b82f6', radius: 8, fillOpacity: 0.9 },
  pin: { color: '#94a3b8', radius: 5, fillOpacity: 0.75 },
  via: { color: '#64748b', radius: 4, fillOpacity: 0.5 },
  fuel: { color: '#f59e0b', radius: 7, fillOpacity: 0.95 },
  short: { color: '#a855f7', radius: 7, fillOpacity: 0.95 },
  lunch: { color: '#eab308', radius: 7, fillOpacity: 0.95 },
  'lunch-refuel': { color: '#ec4899', radius: 8, fillOpacity: 0.95 },
}

function FitBounds({ points }: { points: LatLng[] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length < 2) return
    const bounds = L.latLngBounds(points.map(([lat, lon]) => [lat, lon]))
    map.fitBounds(bounds, { padding: [48, 48] })
  }, [map, points])
  return null
}

function MarkerPopup({ marker }: { marker: MapMarker }) {
  return (
    <div className="min-w-[140px] text-sm text-slate-900">
      <p className="font-semibold">{marker.label}</p>
      <p className="text-slate-600">{marker.typeLabel}</p>
      {marker.time ? (
        <p className="mt-1 text-slate-500">Arrival {formatTime(marker.time)}</p>
      ) : null}
      {marker.kmSinceLastFuel !== undefined ? (
        <p className="mt-1 text-slate-600">
          {formatDistance(marker.kmSinceLastFuel)} since last fill
        </p>
      ) : null}
    </div>
  )
}

function MapLegend() {
  const items: { color: string; label: string }[] = [
    { color: '#22c55e', label: 'Departure' },
    { color: '#3b82f6', label: 'Major stop' },
    { color: '#f59e0b', label: 'Fuel' },
    { color: '#eab308', label: 'Lunch' },
    { color: '#ec4899', label: 'Lunch & refuel' },
    { color: '#a855f7', label: 'Short break' },
    { color: '#64748b', label: 'Via' },
    { color: '#ef4444', label: 'Arrival' },
  ]
  return (
    <div className="absolute bottom-4 right-4 z-[1000] max-w-[200px] rounded-lg border border-slate-600/80 bg-slate-950/90 px-3 py-2 text-xs text-slate-300 shadow-lg backdrop-blur">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2 py-0.5">
          <span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: item.color }}
          />
          {item.label}
        </div>
      ))}
    </div>
  )
}

export default function TripMap({
  waypoints,
  plan,
}: {
  waypoints: Waypoint[]
  plan: TripPlan | null
}) {
  const routeLine = useMemo((): LatLng[] => {
    if (plan?.routeLine.length) return plan.routeLine
    return waypoints.map((w) => [w.lat, w.lon])
  }, [plan, waypoints])

  const markers = useMemo((): MapMarker[] => {
    if (plan?.markers.length) return plan.markers
    if (waypoints.length === 0) return []
    const list: MapMarker[] = [
      {
        lat: waypoints[0].lat,
        lon: waypoints[0].lon,
        kind: 'start',
        label: waypoints[0].displayName,
        typeLabel: MARKER_TYPE_LABELS.start,
      },
    ]
    for (let i = 1; i < waypoints.length - 1; i++) {
      const w = waypoints[i]
      list.push({
        lat: w.lat,
        lon: w.lon,
        kind: w.role === 'via' ? 'via' : 'pin',
        label: w.displayName,
        typeLabel: MARKER_TYPE_LABELS[w.role === 'via' ? 'via' : 'pin'],
      })
    }
    if (waypoints.length > 1) {
      const end = waypoints[waypoints.length - 1]
      list.push({
        lat: end.lat,
        lon: end.lon,
        kind: 'end',
        label: end.displayName,
        typeLabel: MARKER_TYPE_LABELS.end,
      })
    }
    return list
  }, [plan, waypoints])

  const center = useMemo((): LatLng => {
    if (waypoints.length > 0) return [waypoints[0].lat, waypoints[0].lon]
    return [39.5, -8]
  }, [waypoints])

  if (waypoints.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-900 text-slate-500">
        Upload a route file to see the map
      </div>
    )
  }

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={center}
        zoom={8}
        className="h-full w-full bg-slate-900"
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={routeLine} />
        {routeLine.length >= 2 ? (
          <Polyline
            positions={routeLine}
            pathOptions={{ color: '#fbbf24', weight: 4, opacity: 0.85 }}
          />
        ) : null}
        {markers.map((m, i) => {
          const style = MARKER_STYLE[m.kind]
          return (
            <CircleMarker
              key={`${m.kind}-${m.lat}-${m.lon}-${i}`}
              center={[m.lat, m.lon]}
              radius={style.radius}
              pathOptions={{
                color: '#0f172a',
                weight: 1.5,
                fillColor: style.color,
                fillOpacity: style.fillOpacity,
              }}
            >
              <Popup>
                <MarkerPopup marker={m} />
              </Popup>
            </CircleMarker>
          )
        })}
      </MapContainer>
      <MapLegend />
    </div>
  )
}
