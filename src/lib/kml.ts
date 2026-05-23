import { createWaypoint } from './waypointName'
import type { Waypoint } from './types'

function parseCoords(text: string): { lat: number; lon: number } {
  const [lon, lat] = text.trim().split(/[\s,]+/).map(Number)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error('Invalid coordinates in KML')
  }
  return { lat, lon }
}

export function parseKmlWaypoints(xml: string): Waypoint[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const parseError = doc.querySelector('parsererror')
  if (parseError) throw new Error('Invalid KML file')

  const placemarks = [...doc.querySelectorAll('Placemark')]
  const waypoints: Waypoint[] = []

  for (const pm of placemarks) {
    const name = pm.querySelector('name')?.textContent?.trim() || 'Unnamed'
    const point = pm.querySelector('Point > coordinates')
    if (point?.textContent) {
      const { lat, lon } = parseCoords(point.textContent)
      waypoints.push(createWaypoint(name, lat, lon))
    }
  }

  if (waypoints.length >= 2) return waypoints

  throw new Error('No Point placemarks found in KML. Add pins in My Maps and export again.')
}
