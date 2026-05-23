import { distanceToRouteKm, samplePointsAlongRoute, type LatLng } from './geo'

export interface FuelPlace {
  id: string
  name: string
  lat: number
  lon: number
  source: 'osm' | 'user'
  brand?: string
  notes?: string
}

export const FUEL_CORRIDOR_KM = 10

export function fuelPlaceKey(lat: number, lon: number): string {
  return `${lat.toFixed(5)},${lon.toFixed(5)}`
}

function labelFromOsmTags(tags: Record<string, string>): string {
  return (
    tags.brand ||
    tags.operator ||
    tags.name ||
    tags['name:en'] ||
    'Gas station'
  )
}

function parseOsmElements(
  elements: {
    type: string
    id: number
    lat?: number
    lon?: number
    center?: { lat: number; lon: number }
    tags?: Record<string, string>
  }[],
): FuelPlace[] {
  const byKey = new Map<string, FuelPlace>()
  for (const el of elements) {
    const lat = el.lat ?? el.center?.lat
    const lon = el.lon ?? el.center?.lon
    if (lat === undefined || lon === undefined) continue
    const key = fuelPlaceKey(lat, lon)
    if (byKey.has(key)) continue
    const tags = el.tags ?? {}
    byKey.set(key, {
      id: `osm-${el.type}-${el.id}`,
      name: labelFromOsmTags(tags),
      lat,
      lon,
      source: 'osm',
      brand: tags.brand,
    })
  }
  return [...byKey.values()]
}

/** Fetch fuel stations within `radiusKm` of the route corridor. */
export async function fetchFuelPlacesNearRoute(
  route: LatLng[],
  radiusKm = FUEL_CORRIDOR_KM,
): Promise<FuelPlace[]> {
  if (route.length < 2) return []

  const samples = samplePointsAlongRoute(route)
  const radiusM = Math.round(radiusKm * 1000)
  const aroundClauses = samples
    .map(([lat, lon]) => `node["amenity"="fuel"](around:${radiusM},${lat},${lon})`)
    .join(';\n  ')

  const query = `
[out:json][timeout:45];
(
  ${aroundClauses};
);
out body;
`

  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: `data=${encodeURIComponent(query)}`,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  if (!res.ok) throw new Error('Could not load fuel stations')

  const data = (await res.json()) as {
    elements?: {
      type: string
      id: number
      lat?: number
      lon?: number
      center?: { lat: number; lon: number }
      tags?: Record<string, string>
    }[]
  }

  const places = parseOsmElements(data.elements ?? [])
  return places.filter(
    (p) => distanceToRouteKm([p.lat, p.lon], route) <= radiusKm + 0.5,
  )
}

export async function reverseFuelPlaceName(lat: number, lon: number): Promise<string> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18`
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'en' },
    })
    if (!res.ok) return 'Fuel stop'
    const data = (await res.json()) as {
      address?: { fuel?: string; amenity?: string; village?: string; town?: string }
      name?: string
    }
    return (
      data.address?.fuel ||
      data.name ||
      data.address?.village ||
      data.address?.town ||
      'Fuel stop'
    )
  } catch {
    return 'Fuel stop'
  }
}
