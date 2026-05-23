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
import { DAY_ROUTE_COLORS } from '../lib/multiDayPlanner'
import type { LatLng } from '../lib/geo'
import { MARKER_TYPE_LABELS } from '../lib/markerLabels'
import FuelPlacesLayer from './FuelPlacesLayer'
import type { FuelPlace } from '../lib/fuelPlaces'
import type { MapMarker, MultiDayTripPlan, TripDayRoute } from '../lib/types'
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
      {marker.dayLabel ? (
        <p className="text-slate-500">{marker.dayLabel}</p>
      ) : null}
      {marker.time ? (
        <p className="mt-1 text-slate-500">Arrival {formatTime(marker.time)}</p>
      ) : null}
      {marker.kmFromStart !== undefined ? (
        <p className="text-slate-600">{formatDistance(marker.kmFromStart)}</p>
      ) : null}
      {marker.kmSinceLastFuel !== undefined ? (
        <p className="text-slate-500">
          {formatDistance(marker.kmSinceLastFuel)} since last fill
        </p>
      ) : null}
    </div>
  )
}

function MapLegend({
  dayLines,
  showFuelLayer,
}: {
  dayLines: { label: string; color: string }[]
  showFuelLayer: boolean
}) {
  const items: { color: string; label: string }[] = [
    { color: '#22c55e', label: 'Departure' },
    { color: '#3b82f6', label: 'Major stop' },
    { color: '#f59e0b', label: 'Planned fuel' },
    { color: '#eab308', label: 'Lunch' },
    { color: '#ec4899', label: 'Lunch & refuel' },
    { color: '#a855f7', label: 'Short break' },
    { color: '#64748b', label: 'Via' },
    { color: '#ef4444', label: 'Arrival' },
  ]
  if (showFuelLayer) {
    items.push({ color: '#94a3b8', label: 'Gas station (OSM)' })
  }
  items.push({ color: '#4ade80', label: 'My fuel stop' })
  return (
    <div className="absolute bottom-4 right-4 z-[1000] max-w-[220px] rounded-lg border border-slate-600/80 bg-slate-950/90 px-3 py-2 text-xs text-slate-300 shadow-lg backdrop-blur">
      {dayLines.length > 1 ? (
        <>
          <p className="mb-1 font-medium text-slate-200">Days</p>
          {dayLines.map((day) => (
            <div key={day.label} className="flex items-center gap-2 py-0.5">
              <span
                className="inline-block h-1 w-4 shrink-0 rounded"
                style={{ background: day.color }}
              />
              {day.label}
            </div>
          ))}
          <div className="my-1.5 border-t border-slate-700" />
        </>
      ) : null}
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

function previewMarkers(days: TripDayRoute[]): MapMarker[] {
  const list: MapMarker[] = []

  for (let dayIdx = 0; dayIdx < days.length; dayIdx++) {
    const wps = days[dayIdx].waypoints
    if (wps.length === 0) continue
    const isFirstDay = dayIdx === 0
    const isLastDay = dayIdx === days.length - 1

    if (isFirstDay) {
      list.push({
        lat: wps[0].lat,
        lon: wps[0].lon,
        kind: 'start',
        label: wps[0].displayName,
        typeLabel: MARKER_TYPE_LABELS.start,
        dayLabel: days[dayIdx].label,
      })
    }

    for (let i = 1; i < wps.length - 1; i++) {
      const w = wps[i]
      list.push({
        lat: w.lat,
        lon: w.lon,
        kind: w.role === 'via' ? 'via' : 'pin',
        label: w.displayName,
        typeLabel: MARKER_TYPE_LABELS[w.role === 'via' ? 'via' : 'pin'],
        dayLabel: days[dayIdx].label,
      })
    }

    if (wps.length > 1) {
      const end = wps[wps.length - 1]
      list.push({
        lat: end.lat,
        lon: end.lon,
        kind: isLastDay ? 'end' : 'major',
        label: end.displayName,
        typeLabel: isLastDay ? MARKER_TYPE_LABELS.end : MARKER_TYPE_LABELS.major,
        dayLabel: days[dayIdx].label,
      })
    }
  }

  return list
}

export default function TripMap({
  days,
  plan,
  showFuelLayer,
  addFuelMode,
  userFuelPlaces,
  onAddUserFuelPlace,
  onSaveOsmFuelPlace,
  onToggleFuelLayer,
  onToggleAddFuelMode,
}: {
  days: TripDayRoute[]
  plan: MultiDayTripPlan | null
  showFuelLayer: boolean
  addFuelMode: boolean
  userFuelPlaces: FuelPlace[]
  onAddUserFuelPlace: (place: Omit<FuelPlace, 'id' | 'source'>) => void
  onSaveOsmFuelPlace: (place: FuelPlace) => void
  onToggleFuelLayer: () => void
  onToggleAddFuelMode: () => void
}) {
  const routeLines = useMemo(() => {
    if (plan?.routeLines.length) return plan.routeLines
    return days.map((day, i) => ({
      dayIndex: i,
      label: day.label,
      line: day.waypoints.map((w) => [w.lat, w.lon] as LatLng),
      color: DAY_ROUTE_COLORS[i % DAY_ROUTE_COLORS.length],
    }))
  }, [plan, days])

  const fitPoints = useMemo((): LatLng[] => {
    const fromRoutes = routeLines.flatMap((r) => r.line)
    if (fromRoutes.length >= 2) return fromRoutes
    return days.flatMap((d) => d.waypoints.map((w) => [w.lat, w.lon] as LatLng))
  }, [routeLines, days])

  const markers = useMemo((): MapMarker[] => {
    if (plan?.markers.length) return plan.markers
    if (days.length === 0) return []
    return previewMarkers(days)
  }, [plan, days])

  const center = useMemo((): LatLng => {
    const first = days[0]?.waypoints[0]
    if (first) return [first.lat, first.lon]
    return [39.5, -8]
  }, [days])

  const hasRoutes = days.some((d) => d.waypoints.length > 0)

  if (!hasRoutes) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-900 text-slate-500">
        Upload route files to see the map
      </div>
    )
  }

  return (
    <div className={`relative h-full w-full${addFuelMode ? ' cursor-crosshair' : ''}`}>
      <div className="absolute left-3 top-3 z-[1000] flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onToggleFuelLayer}
          className={`rounded-lg border px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur ${
            showFuelLayer
              ? 'border-amber-500/60 bg-amber-500/20 text-amber-200'
              : 'border-slate-600/80 bg-slate-950/90 text-slate-300'
          }`}
        >
          Gas stations
        </button>
        <button
          type="button"
          onClick={onToggleAddFuelMode}
          className={`rounded-lg border px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur ${
            addFuelMode
              ? 'border-green-500/60 bg-green-500/20 text-green-200'
              : 'border-slate-600/80 bg-slate-950/90 text-slate-300'
          }`}
        >
          {addFuelMode ? 'Cancel add' : 'Add fuel stop'}
        </button>
      </div>
      {addFuelMode ? (
        <p className="pointer-events-none absolute left-3 top-14 z-[1000] rounded bg-amber-500/90 px-2 py-1 text-xs font-medium text-slate-950">
          Click the map to add a fuel stop
        </p>
      ) : null}
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
        <FitBounds points={fitPoints} />
        {routeLines.map((layer) =>
          layer.line.length >= 2 ? (
            <Polyline
              key={`route-${layer.dayIndex}`}
              positions={layer.line}
              pathOptions={{
                color: layer.color,
                weight: 4,
                opacity: 0.85,
              }}
            />
          ) : null,
        )}
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
        <FuelPlacesLayer
          routePoints={fitPoints}
          enabled={showFuelLayer}
          addMode={addFuelMode}
          userPlaces={userFuelPlaces}
          onAddUserPlace={onAddUserFuelPlace}
          onSaveOsmPlace={onSaveOsmFuelPlace}
        />
      </MapContainer>
      <MapLegend
        dayLines={routeLines.map((r) => ({ label: r.label, color: r.color }))}
        showFuelLayer={showFuelLayer}
      />
    </div>
  )
}
