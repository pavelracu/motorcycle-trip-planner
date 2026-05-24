import { getCachedReverseGeocode, setCachedReverseGeocode } from './reverseGeocodeCache'
import { fetchWeatherAt } from './weather'
import type { BreakEvent } from './types'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchPlaceName(lat: number, lon: number): Promise<string | undefined> {
  const cached = getCachedReverseGeocode(lat, lon)
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
  const addr = data.address
  if (!addr) return undefined

  const name =
    addr.city ||
    addr.town ||
    addr.village ||
    addr.municipality ||
    addr.county ||
    addr.state_district
  if (name) setCachedReverseGeocode(lat, lon, name)
  return name
}

function uniqueBreaks(breaks: BreakEvent[]): BreakEvent[] {
  const seen = new Set<BreakEvent>()
  const out: BreakEvent[] = []
  for (const b of breaks) {
    if (seen.has(b)) continue
    seen.add(b)
    out.push(b)
  }
  return out
}

export async function enrichBreakEvents(
  breaks: BreakEvent[],
  onProgress?: (msg: string) => void,
): Promise<void> {
  const list = uniqueBreaks(breaks)
  for (let i = 0; i < list.length; i++) {
    const b = list[i]
    onProgress?.(`Break locations ${i + 1}/${list.length}…`)

    const hadGeoCache = getCachedReverseGeocode(b.lat, b.lon) !== undefined
    const place = await fetchPlaceName(b.lat, b.lon)
    if (place) b.placeName = place

    b.weather = await fetchWeatherAt(b.lat, b.lon, b.time)

    if (!hadGeoCache && i < list.length - 1) await sleep(1100)
  }
}
