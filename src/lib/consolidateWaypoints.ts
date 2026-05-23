import { fetchRouteLeg } from './routing'
import type { Waypoint } from './types'

export async function applyAutoVia(
  waypoints: Waypoint[],
  maxLegKm: number,
  onProgress?: (msg: string) => void,
): Promise<Waypoint[]> {
  if (waypoints.length < 3 || maxLegKm <= 0) return waypoints

  const candidates: { index: number; from: Waypoint; to: Waypoint }[] = []
  for (let i = 1; i < waypoints.length - 1; i++) {
    const wp = waypoints[i]
    if (wp.role !== 'pin') continue
    candidates.push({ index: i, from: waypoints[i - 1], to: wp })
  }

  if (candidates.length === 0) return waypoints

  onProgress?.(`Checking ${candidates.length} legs for auto-via…`)

  const legs = await Promise.all(
    candidates.map((c) => fetchRouteLeg(c.from, c.to)),
  )

  for (let j = 0; j < candidates.length; j++) {
    if (legs[j].distanceKm < maxLegKm) {
      waypoints[candidates[j].index].role = 'via'
    }
  }

  return waypoints
}
