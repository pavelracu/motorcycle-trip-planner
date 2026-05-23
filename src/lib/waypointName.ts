import type { Waypoint, WaypointRole } from './types'

const VIA_PREFIX = /^\s*\[via\]\s*/i
const STOP_PREFIX = /^\s*\[stop\]\s*/i

export function parseWaypointName(raw: string): {
  displayName: string
  role: WaypointRole | undefined
} {
  let name = raw.trim()
  let role: WaypointRole | undefined

  if (VIA_PREFIX.test(name)) {
    role = 'via'
    name = name.replace(VIA_PREFIX, '').trim()
  } else if (STOP_PREFIX.test(name)) {
    role = 'stop'
    name = name.replace(STOP_PREFIX, '').trim()
  }

  name = name.replace(/,\s*(Portugal|Spain|España)\s*$/i, '').trim()
  name = name.replace(/\s+/g, ' ')

  return { displayName: name || raw.trim(), role }
}

export function createWaypoint(name: string, lat: number, lon: number): Waypoint {
  const { displayName, role } = parseWaypointName(name)
  return {
    name,
    displayName,
    lat,
    lon,
    role: role ?? 'pin',
  }
}
