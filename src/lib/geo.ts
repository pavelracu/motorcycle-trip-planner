export type LatLng = [number, number]

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371
  const dLat = ((b[0] - a[0]) * Math.PI) / 180
  const dLon = ((b[1] - a[1]) * Math.PI) / 180
  const lat1 = (a[0] * Math.PI) / 180
  const lat2 = (b[0] * Math.PI) / 180
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

export function pointAlongPath(path: LatLng[], fraction: number): LatLng {
  if (path.length === 0) return [0, 0]
  if (path.length === 1 || fraction <= 0) return path[0]
  if (fraction >= 1) return path[path.length - 1]

  const segments: number[] = []
  let total = 0
  for (let i = 1; i < path.length; i++) {
    const len = haversineKm(path[i - 1], path[i])
    segments.push(len)
    total += len
  }
  if (total === 0) return path[0]

  let remaining = total * fraction
  for (let i = 0; i < segments.length; i++) {
    if (remaining <= segments[i]) {
      const t = remaining / segments[i]
      const a = path[i]
      const b = path[i + 1]
      return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]
    }
    remaining -= segments[i]
  }
  return path[path.length - 1]
}

/** Shortest distance from a point to a route polyline (km). */
export function distanceToRouteKm(point: LatLng, route: LatLng[]): number {
  if (route.length === 0) return Number.POSITIVE_INFINITY
  if (route.length === 1) return haversineKm(point, route[0])

  let min = Number.POSITIVE_INFINITY
  for (let i = 1; i < route.length; i++) {
    min = Math.min(min, distancePointToSegmentKm(point, route[i - 1], route[i]))
  }
  return min
}

function distancePointToSegmentKm(p: LatLng, a: LatLng, b: LatLng): number {
  const ax = a[0]
  const ay = a[1]
  const bx = b[0]
  const by = b[1]
  const px = p[0]
  const py = p[1]
  const dx = bx - ax
  const dy = by - ay
  if (dx === 0 && dy === 0) return haversineKm(p, a)

  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  const proj: LatLng = [ax + t * dx, ay + t * dy]
  return haversineKm(p, proj)
}

/** Sample points along a route for corridor searches (e.g. fuel stations). */
export function samplePointsAlongRoute(
  route: LatLng[],
  intervalKm = 20,
  maxSamples = 35,
): LatLng[] {
  if (route.length === 0) return []
  if (route.length === 1) return [route[0]]

  let total = 0
  for (let i = 1; i < route.length; i++) {
    total += haversineKm(route[i - 1], route[i])
  }
  if (total < 0.01) return [route[0]]

  const count = Math.min(maxSamples, Math.max(2, Math.ceil(total / intervalKm) + 1))
  const samples: LatLng[] = []
  for (let i = 0; i < count; i++) {
    samples.push(pointAlongPath(route, count === 1 ? 0 : i / (count - 1)))
  }
  return samples
}
