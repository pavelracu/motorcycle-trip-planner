import type { LatLng } from './geo'
import type { RouteLeg } from './routing'

const STORAGE_KEY = 'motorcycle-trip-planner-routes-v1'

type StoredLeg = {
  distanceKm: number
  durationMinutes: number
  path: LatLng[]
}

function readStore(): Record<string, StoredLeg> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Record<string, StoredLeg>
  } catch {
    return {}
  }
}

function writeStore(store: Record<string, StoredLeg>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // Quota exceeded — keep in-memory cache only
  }
}

export function loadPersistedRouteLeg(key: string): RouteLeg | null {
  const leg = readStore()[key]
  if (!leg?.path?.length) return null
  return leg
}

export function persistRouteLeg(key: string, leg: RouteLeg): void {
  const store = readStore()
  store[key] = {
    distanceKm: leg.distanceKm,
    durationMinutes: leg.durationMinutes,
    path: leg.path,
  }
  writeStore(store)
}

export function hydrateRouteCacheFromStorage(
  cache: Map<string, Promise<RouteLeg>>,
): number {
  const store = readStore()
  let count = 0
  for (const [key, leg] of Object.entries(store)) {
    if (cache.has(key)) continue
    cache.set(key, Promise.resolve(leg))
    count++
  }
  return count
}

export function clearPersistedRouteCache(): void {
  localStorage.removeItem(STORAGE_KEY)
}
