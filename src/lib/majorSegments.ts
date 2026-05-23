import type { BreakEvent, ItinerarySegment, TripSettings } from './types'

function mergeSegments(a: ItinerarySegment, b: ItinerarySegment): ItinerarySegment {
  const breakMinutes = [...a.leg.breaks, ...b.leg.breaks].reduce(
    (s, x) => s + x.durationMinutes,
    0,
  )
  const ridingMinutes = a.leg.ridingMinutes + b.leg.ridingMinutes
  return {
    from: a.from,
    to: b.to,
    leg: {
      distanceKm: a.leg.distanceKm + b.leg.distanceKm,
      ridingMinutes,
      elapsedMinutes: ridingMinutes + breakMinutes,
      breaks: [...a.leg.breaks, ...b.leg.breaks],
    },
  }
}

function hasPostArrivalBreak(breaks: BreakEvent[]): boolean {
  return breaks.some((b) => b.kind === 'short' || b.kind === 'lunch')
}

function endsMajorSegment(
  seg: ItinerarySegment,
  isLast: boolean,
  minKm: number,
): boolean {
  if (isLast) return true
  if (seg.to.waypoint.role === 'stop') return true
  if (hasPostArrivalBreak(seg.leg.breaks)) return true
  if (seg.leg.distanceKm >= minKm) return true
  return false
}

export function collapseToMajorSegments(
  segments: ItinerarySegment[],
  settings: TripSettings,
): ItinerarySegment[] {
  const minKm = settings.majorStopMinKm
  if (minKm <= 0 || segments.length === 0) return segments

  const major: ItinerarySegment[] = []
  let acc: ItinerarySegment | null = null

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    acc = acc ? mergeSegments(acc, seg) : seg

    if (endsMajorSegment(acc, i === segments.length - 1, minKm)) {
      major.push(acc)
      acc = null
    }
  }

  if (acc) major.push(acc)
  return major
}
