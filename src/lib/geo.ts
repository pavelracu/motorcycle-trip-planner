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
