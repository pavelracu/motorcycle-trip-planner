const STORAGE_KEY = 'motorcycle-trip-planner-reverse-geocode-v1'

type CacheEntry = {
  name: string
  savedAt: string
}

type CacheStore = Record<string, CacheEntry>

let memory: CacheStore | null = null

export function geocodeCacheKey(lat: number, lon: number, precision = 4): string {
  return `${lat.toFixed(precision)},${lon.toFixed(precision)}`
}

function loadStore(): CacheStore {
  if (memory) return memory
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    memory = raw ? (JSON.parse(raw) as CacheStore) : {}
  } catch {
    memory = {}
  }
  return memory
}

function persistStore(store: CacheStore): void {
  memory = store
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // Quota exceeded — keep in-memory hits for this session
  }
}

export function getCachedReverseGeocode(
  lat: number,
  lon: number,
  precision = 4,
): string | undefined {
  const key = geocodeCacheKey(lat, lon, precision)
  return loadStore()[key]?.name
}

export function setCachedReverseGeocode(
  lat: number,
  lon: number,
  name: string,
  precision = 4,
): void {
  const key = geocodeCacheKey(lat, lon, precision)
  const store = { ...loadStore(), [key]: { name, savedAt: new Date().toISOString() } }
  persistStore(store)
}

export function reverseGeocodeCacheSize(): number {
  return Object.keys(loadStore()).length
}
