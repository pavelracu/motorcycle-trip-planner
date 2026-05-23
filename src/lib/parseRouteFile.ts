import { parseGpxWaypoints } from './gpx'
import { parseKmlWaypoints } from './kml'
import type { Waypoint } from './types'

export function parseRouteFile(xml: string, filename: string): Waypoint[] {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.kml') || lower.endsWith('.kmz')) {
    return parseKmlWaypoints(xml)
  }
  return parseGpxWaypoints(xml)
}
