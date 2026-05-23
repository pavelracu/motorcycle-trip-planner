import type { Waypoint } from './types'

export interface RouteLeg {
  distanceKm: number
  durationMinutes: number
}

const routeCache = new Map<string, Promise<RouteLeg>>()

function routeKey(a: { lat: number; lon: number }, b: { lat: number; lon: number }): string {
  return `${a.lon},${a.lat};${b.lon},${b.lat}`
}

export function clearRouteCache(): void {
  routeCache.clear()
}

function haversineKm(a: Waypoint, b: Waypoint): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLon = ((b.lon - a.lon) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

function fallbackLeg(a: Waypoint, b: Waypoint): RouteLeg {
  const distanceKm = haversineKm(a, b) * 1.25
  const durationMinutes = (distanceKm / 75) * 60
  return { distanceKm, durationMinutes }
}

async function fetchRouteLegUncached(a: Waypoint, b: Waypoint): Promise<RouteLeg> {
  const coords = `${a.lon},${a.lat};${b.lon},${b.lat}`
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=false`

  try {
    const res = await fetch(url)
    if (!res.ok) return fallbackLeg(a, b)
    const data = (await res.json()) as {
      routes?: { distance: number; duration: number }[]
    }
    const route = data.routes?.[0]
    if (!route) return fallbackLeg(a, b)
    return {
      distanceKm: route.distance / 1000,
      durationMinutes: route.duration / 60,
    }
  } catch {
    return fallbackLeg(a, b)
  }
}

export function fetchRouteLeg(a: Waypoint, b: Waypoint): Promise<RouteLeg> {
  const key = routeKey(a, b)
  const cached = routeCache.get(key)
  if (cached) return cached

  const promise = fetchRouteLegUncached(a, b)
  routeCache.set(key, promise)
  return promise
}
