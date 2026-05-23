import type { LatLng } from './geo'

export interface FuelPlace {
  id: string
  name: string
  lat: number
  lon: number
  source: 'osm' | 'user'
  brand?: string
  notes?: string
}

export function fuelPlaceKey(lat: number, lon: number): string {
  return `${lat.toFixed(5)},${lon.toFixed(5)}`
}

export function boundsFromPoints(
  points: LatLng[],
  paddingDeg = 0.08,
): { south: number; west: number; north: number; east: number } | null {
  if (points.length === 0) return null
  let south = points[0][0]
  let north = points[0][0]
  let west = points[0][1]
  let east = points[0][1]
  for (const [lat, lon] of points) {
    south = Math.min(south, lat)
    north = Math.max(north, lat)
    west = Math.min(west, lon)
    east = Math.max(east, lon)
  }
  return {
    south: south - paddingDeg,
    west: west - paddingDeg,
    north: north + paddingDeg,
    east: east + paddingDeg,
  }
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

export async function fetchFuelPlacesInBounds(bounds: {
  south: number
  west: number
  north: number
  east: number
}): Promise<FuelPlace[]> {
  const { south, west, north, east } = bounds
  const query = `
[out:json][timeout:25];
(
  node["amenity"="fuel"](${south},${west},${north},${east});
  way["amenity"="fuel"](${south},${west},${north},${east});
);
out center 120;
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

  const byKey = new Map<string, FuelPlace>()
  for (const el of data.elements ?? []) {
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
