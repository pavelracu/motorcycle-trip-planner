import { useEffect, useState } from 'react'
import { CircleMarker, Popup, useMapEvents } from 'react-leaflet'
import {
  boundsFromPoints,
  fetchFuelPlacesInBounds,
  reverseFuelPlaceName,
  type FuelPlace,
} from '../lib/fuelPlaces'
import type { LatLng } from '../lib/geo'

const OSM_STYLE = {
  color: '#475569',
  radius: 4,
  fillColor: '#94a3b8',
  fillOpacity: 0.85,
}
const USER_STYLE = {
  color: '#14532d',
  radius: 6,
  fillColor: '#22c55e',
  fillOpacity: 0.95,
}

function MapClickAddFuel({
  active,
  onPick,
}: {
  active: boolean
  onPick: (lat: number, lon: number) => void
}) {
  useMapEvents({
    click(e) {
      if (!active) return
      onPick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

function FuelPopup({
  place,
  isSaved,
  onSave,
}: {
  place: FuelPlace
  isSaved: boolean
  onSave?: () => void
}) {
  return (
    <div className="min-w-[140px] text-sm text-slate-900">
      <p className="font-semibold">{place.name}</p>
      <p className="text-slate-600">
        {place.source === 'user' ? 'My fuel stop' : 'Gas station'}
      </p>
      {place.brand ? <p className="text-slate-500">{place.brand}</p> : null}
      {place.notes ? <p className="text-slate-500">{place.notes}</p> : null}
      {onSave && !isSaved ? (
        <button
          type="button"
          className="mt-2 rounded bg-amber-500 px-2 py-1 text-xs font-medium text-slate-950"
          onClick={onSave}
        >
          Add to my fuel stops
        </button>
      ) : null}
      {isSaved ? <p className="mt-2 text-xs text-green-700">Saved</p> : null}
    </div>
  )
}

export default function FuelPlacesLayer({
  routePoints,
  enabled,
  addMode,
  userPlaces,
  onAddUserPlace,
  onSaveOsmPlace,
}: {
  routePoints: LatLng[]
  enabled: boolean
  addMode: boolean
  userPlaces: FuelPlace[]
  onAddUserPlace: (place: Omit<FuelPlace, 'id' | 'source'>) => void
  onSaveOsmPlace: (place: FuelPlace) => void
}) {
  const [osmPlaces, setOsmPlaces] = useState<FuelPlace[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!enabled || routePoints.length < 2) {
      setOsmPlaces([])
      return
    }
    const bounds = boundsFromPoints(routePoints)
    if (!bounds) return

    let cancelled = false
    setLoading(true)
    setError('')
    fetchFuelPlacesInBounds(bounds)
      .then((places) => {
        if (!cancelled) setOsmPlaces(places)
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load fuel stations')
          setOsmPlaces([])
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [enabled, routePoints])

  async function handleMapPick(lat: number, lon: number) {
    const name = await reverseFuelPlaceName(lat, lon)
    onAddUserPlace({ name, lat, lon })
  }

  function isSaved(place: FuelPlace): boolean {
    return userPlaces.some(
      (p) =>
        Math.abs(p.lat - place.lat) < 0.0001 && Math.abs(p.lon - place.lon) < 0.0001,
    )
  }

  const showOsm = enabled && osmPlaces.length > 0

  return (
    <>
      <MapClickAddFuel
        active={addMode}
        onPick={(lat, lon) => void handleMapPick(lat, lon)}
      />
      {enabled && loading ? (
        <div className="pointer-events-none absolute left-3 top-[4.5rem] z-[1000] rounded bg-slate-950/80 px-2 py-1 text-xs text-slate-300">
          Loading gas stations…
        </div>
      ) : null}
      {enabled && error ? (
        <div className="pointer-events-none absolute left-3 top-[4.5rem] z-[1000] max-w-[200px] rounded bg-red-950/80 px-2 py-1 text-xs text-red-200">
          {error}
        </div>
      ) : null}
      {userPlaces.map((place) => (
        <CircleMarker
          key={place.id}
          center={[place.lat, place.lon]}
          radius={USER_STYLE.radius}
          pathOptions={{
            color: USER_STYLE.color,
            weight: 2,
            fillColor: USER_STYLE.fillColor,
            fillOpacity: USER_STYLE.fillOpacity,
          }}
        >
          <Popup>
            <FuelPopup place={place} isSaved />
          </Popup>
        </CircleMarker>
      ))}
      {showOsm
        ? osmPlaces.map((place) => (
            <CircleMarker
              key={place.id}
              center={[place.lat, place.lon]}
              radius={OSM_STYLE.radius}
              pathOptions={{
                color: OSM_STYLE.color,
                weight: 1,
                fillColor: OSM_STYLE.fillColor,
                fillOpacity: OSM_STYLE.fillOpacity,
              }}
            >
              <Popup>
                <FuelPopup
                  place={place}
                  isSaved={isSaved(place)}
                  onSave={() => onSaveOsmPlace(place)}
                />
              </Popup>
            </CircleMarker>
          ))
        : null}
    </>
  )
}
