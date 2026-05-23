import type { FuelPlace } from './fuelPlaces'

const STORAGE_KEY = 'motorcycle-trip-planner-fuel-places-v1'

export function loadUserFuelPlaces(): FuelPlace[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as FuelPlace[]
    return list.filter((p) => p.source === 'user')
  } catch {
    return []
  }
}

export function saveUserFuelPlaces(places: FuelPlace[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(places))
  } catch {
    // ignore quota errors
  }
}

export function addUserFuelPlace(
  places: FuelPlace[],
  place: Omit<FuelPlace, 'id' | 'source'>,
): FuelPlace[] {
  const next: FuelPlace = {
    ...place,
    id: crypto.randomUUID(),
    source: 'user',
  }
  const updated = [...places, next]
  saveUserFuelPlaces(updated)
  return updated
}

export function removeUserFuelPlace(
  places: FuelPlace[],
  id: string,
): FuelPlace[] {
  const updated = places.filter((p) => p.id !== id)
  saveUserFuelPlaces(updated)
  return updated
}

export function adoptOsmFuelPlace(
  places: FuelPlace[],
  osm: FuelPlace,
): FuelPlace[] {
  const exists = places.some(
    (p) => Math.abs(p.lat - osm.lat) < 0.0001 && Math.abs(p.lon - osm.lon) < 0.0001,
  )
  if (exists) return places
  const next: FuelPlace = {
    id: crypto.randomUUID(),
    name: osm.name,
    lat: osm.lat,
    lon: osm.lon,
    source: 'user',
    brand: osm.brand,
    notes: 'From map',
  }
  const updated = [...places, next]
  saveUserFuelPlaces(updated)
  return updated
}
