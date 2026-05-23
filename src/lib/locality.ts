import type { Waypoint } from './types'

const localityCache = new Map<string, string>()

const STREET_LIKE =
  /^(calle|carretera|avenida|av\.|praça|praça|plaza|rua|estrada|ma-|bo\s|paseo|camino|travessa)/i

function cacheKey(lat: number, lon: number): string {
  return `${lat.toFixed(4)},${lon.toFixed(4)}`
}

function localityFromAddress(address: Record<string, string>): string | undefined {
  return (
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    address.county ||
    address.state_district
  )
}

function keepCustomDisplayName(wp: Waypoint): boolean {
  if (wp.role === 'stop') return true
  const n = wp.displayName
  if (n.length < 40 && !STREET_LIKE.test(n)) return true
  return false
}

async function fetchLocality(lat: number, lon: number): Promise<string | undefined> {
  const key = cacheKey(lat, lon)
  const cached = localityCache.get(key)
  if (cached) return cached

  const url = new URL('https://nominatim.openstreetmap.org/reverse')
  url.searchParams.set('lat', String(lat))
  url.searchParams.set('lon', String(lon))
  url.searchParams.set('format', 'json')
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('zoom', '12')

  const res = await fetch(url, {
    headers: { 'Accept-Language': 'en', 'User-Agent': 'MotorcycleTripPlanner/1.0' },
  })
  if (!res.ok) return undefined

  const data = (await res.json()) as { address?: Record<string, string> }
  const name = data.address ? localityFromAddress(data.address) : undefined
  if (name) localityCache.set(key, name)
  return name
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function enrichWaypointsWithLocality(
  waypoints: Waypoint[],
  onProgress?: (msg: string) => void,
): Promise<void> {
  for (let i = 0; i < waypoints.length; i++) {
    const wp = waypoints[i]
    if (keepCustomDisplayName(wp)) continue

    onProgress?.(`Resolving city ${i + 1}/${waypoints.length}…`)
    const city = await fetchLocality(wp.lat, wp.lon)
    if (city) wp.displayName = city

    if (i < waypoints.length - 1) await sleep(1100)
  }
}
