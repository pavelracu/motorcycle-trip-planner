import type { WeatherAtStop, Waypoint } from './types'

const WMO: Record<number, string> = {
  0: 'clear',
  1: 'mainly clear',
  2: 'partly cloudy',
  3: 'overcast',
  45: 'foggy',
  48: 'foggy',
  51: 'light drizzle',
  53: 'drizzle',
  55: 'heavy drizzle',
  61: 'light rain',
  63: 'rain',
  65: 'heavy rain',
  71: 'light snow',
  73: 'snow',
  75: 'heavy snow',
  80: 'rain showers',
  81: 'rain showers',
  82: 'heavy rain showers',
  95: 'thunderstorm',
}

const weatherCache = new Map<string, Promise<WeatherAtStop | undefined>>()

async function fetchWeatherUncached(
  wp: Waypoint,
  at: Date,
): Promise<WeatherAtStop | undefined> {
  const date = at.toISOString().slice(0, 10)
  const hour = at.getHours()
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', String(wp.lat))
  url.searchParams.set('longitude', String(wp.lon))
  url.searchParams.set('hourly', 'temperature_2m,weather_code')
  url.searchParams.set('timezone', 'auto')
  url.searchParams.set('start_date', date)
  url.searchParams.set('end_date', date)

  try {
    const res = await fetch(url)
    if (!res.ok) return undefined
    const data = (await res.json()) as {
      hourly?: { time: string[]; temperature_2m: number[]; weather_code: number[] }
    }
    const hourly = data.hourly
    if (!hourly?.time?.length) return undefined

    let idx = hourly.time.findIndex((t) => new Date(t).getHours() === hour)
    if (idx < 0) idx = Math.min(hour, hourly.time.length - 1)

    const tempC = Math.round(hourly.temperature_2m[idx] ?? 0)
    const code = hourly.weather_code[idx] ?? 0
    return { tempC, description: WMO[code] ?? 'unknown' }
  } catch {
    return undefined
  }
}

export function fetchWeather(wp: Waypoint, at: Date): Promise<WeatherAtStop | undefined> {
  return fetchWeatherAt(wp.lat, wp.lon, at)
}

export function fetchWeatherAt(
  lat: number,
  lon: number,
  at: Date,
): Promise<WeatherAtStop | undefined> {
  const key = `${lat.toFixed(4)},${lon.toFixed(4)},${at.toISOString().slice(0, 13)}`
  const cached = weatherCache.get(key)
  if (cached) return cached

  const wp: Waypoint = {
    name: '',
    displayName: '',
    lat,
    lon,
    role: 'via',
  }
  const promise = fetchWeatherUncached(wp, at)
  weatherCache.set(key, promise)
  return promise
}

export function fetchWeatherBatch(
  stops: { waypoint: Waypoint; time: Date }[],
): Promise<(WeatherAtStop | undefined)[]> {
  return Promise.all(stops.map((s) => fetchWeather(s.waypoint, s.time)))
}
