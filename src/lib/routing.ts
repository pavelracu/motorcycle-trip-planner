import {
  hydrateRouteCacheFromStorage,
  loadPersistedRouteLeg,
  persistRouteLeg,
} from './routeCacheStorage'
import { haversineKm, type LatLng } from './geo'
import type { Waypoint } from './types'

export interface RouteLeg {
  distanceKm: number
  durationMinutes: number
  path: LatLng[]
}

const routeCache = new Map<string, Promise<RouteLeg>>()

function routeKey(a: { lat: number; lon: number }, b: { lat: number; lon: number }): string {
  return `${a.lon},${a.lat};${b.lon},${b.lat}`
}

export function clearRouteCache(): void {
  routeCache.clear()
}

export function initRouteCache(): number {
  return hydrateRouteCacheFromStorage(routeCache)
}

function fallbackLeg(a: Waypoint, b: Waypoint): RouteLeg {
  const path: LatLng[] = [
    [a.lat, a.lon],
    [b.lat, b.lon],
  ]
  const distanceKm = haversineKm(path[0], path[1]) * 1.25
  const durationMinutes = (distanceKm / 75) * 60
  return { distanceKm, durationMinutes, path }
}

function decodeGeoJsonLine(
  coordinates: [number, number][],
): LatLng[] {
  return coordinates.map(([lon, lat]) => [lat, lon])
}

async function fetchRouteLegUncached(a: Waypoint, b: Waypoint): Promise<RouteLeg> {
  const coords = `${a.lon},${a.lat};${b.lon},${b.lat}`
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`

  try {
    const res = await fetch(url)
    if (!res.ok) return fallbackLeg(a, b)
    const data = (await res.json()) as {
      routes?: {
        distance: number
        duration: number
        geometry?: { coordinates: [number, number][] }
      }[]
    }
    const route = data.routes?.[0]
    if (!route) return fallbackLeg(a, b)
    const path = route.geometry?.coordinates?.length
      ? decodeGeoJsonLine(route.geometry.coordinates)
      : ([
          [a.lat, a.lon],
          [b.lat, b.lon],
        ] satisfies LatLng[])
    return {
      distanceKm: route.distance / 1000,
      durationMinutes: route.duration / 60,
      path,
    }
  } catch {
    return fallbackLeg(a, b)
  }
}

export function fetchRouteLeg(a: Waypoint, b: Waypoint): Promise<RouteLeg> {
  const key = routeKey(a, b)
  const cached = routeCache.get(key)
  if (cached) return cached

  const persisted = loadPersistedRouteLeg(key)
  if (persisted) {
    const promise = Promise.resolve(persisted)
    routeCache.set(key, promise)
    return promise
  }

  const promise = fetchRouteLegUncached(a, b).then((leg) => {
    persistRouteLeg(key, leg)
    return leg
  })
  routeCache.set(key, promise)
  return promise
}
