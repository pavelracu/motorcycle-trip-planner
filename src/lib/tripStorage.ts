import type { MultiDayTripPlan, TripDayRoute, TripSettings } from './types'

const STORAGE_KEY = 'motorcycle-trip-planner-trip-v1'

export function tripFingerprint(
  days: TripDayRoute[],
  settings: TripSettings,
): string {
  return JSON.stringify({
    days: days.map((d) => ({
      fileName: d.fileName,
      label: d.label,
      waypoints: d.waypoints.map((w) => [
        w.lat,
        w.lon,
        w.role,
        w.name,
        w.displayName,
      ]),
    })),
    settings,
  })
}

type SavedTripBundle = {
  fingerprint: string
  days: TripDayRoute[]
  settings: TripSettings
  plan: unknown
  output: string
  savedAt: string
}

function isDateKey(key: string): boolean {
  return (
    key === 'time' ||
    key === 'endTime' ||
    key.endsWith('Time') ||
    key.endsWith('Iso')
  )
}

function reviveDates(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(reviveDates)
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(obj)) {
      if (isDateKey(key) && typeof val === 'string' && !key.endsWith('Iso')) {
        out[key] = new Date(val)
      } else {
        out[key] = reviveDates(val)
      }
    }
    return out
  }
  return value
}

export function saveTripBundle(
  fingerprint: string,
  days: TripDayRoute[],
  settings: TripSettings,
  plan: MultiDayTripPlan,
  output: string,
): void {
  const bundle: SavedTripBundle = {
    fingerprint,
    days,
    settings,
    plan,
    output,
    savedAt: new Date().toISOString(),
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bundle))
  } catch {
    // Plan geometry may exceed quota — route cache still helps
  }
}

export function loadTripBundle(): {
  days: TripDayRoute[]
  settings: TripSettings
  plan: MultiDayTripPlan
  output: string
  savedAt: Date
} | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const bundle = JSON.parse(raw) as SavedTripBundle
    if (!bundle.days?.length || !bundle.plan) return null
    return {
      days: bundle.days,
      settings: bundle.settings,
      plan: reviveDates(bundle.plan) as MultiDayTripPlan,
      output: bundle.output ?? '',
      savedAt: new Date(bundle.savedAt),
    }
  } catch {
    return null
  }
}

export function loadCachedPlan(
  fingerprint: string,
): MultiDayTripPlan | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const bundle = JSON.parse(raw) as SavedTripBundle
    if (bundle.fingerprint !== fingerprint || !bundle.plan) return null
    return reviveDates(bundle.plan) as MultiDayTripPlan
  } catch {
    return null
  }
}

export function clearSavedTrip(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function formatSavedAt(d: Date): string {
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}
