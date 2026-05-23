import { createWaypoint } from './waypointName'
import type { Waypoint } from './types'

function parseCoord(el: Element, tag: 'lat' | 'lon'): number {
  const v = el.getAttribute(tag)
  if (!v) throw new Error(`Missing ${tag} on waypoint`)
  return Number.parseFloat(v)
}

function fromElement(el: Element, fallbackName: string): Waypoint {
  const name = el.querySelector('name')?.textContent?.trim() || fallbackName
  return createWaypoint(name, parseCoord(el, 'lat'), parseCoord(el, 'lon'))
}

export function parseGpxWaypoints(xml: string): Waypoint[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const parseError = doc.querySelector('parsererror')
  if (parseError) throw new Error('Invalid GPX file')

  const wpts = [...doc.querySelectorAll('wpt')]
  if (wpts.length >= 2) {
    return wpts.map((wpt, i) => fromElement(wpt, `Waypoint ${i + 1}`))
  }

  const rtepts = [...doc.querySelectorAll('rtept')]
  if (rtepts.length >= 2) {
    return rtepts.map((pt, i) => fromElement(pt, `Point ${i + 1}`))
  }

  const trkpts = [...doc.querySelectorAll('trkpt')]
  if (trkpts.length >= 2) {
    const step = Math.max(1, Math.floor(trkpts.length / 25))
    const sampled = trkpts.filter((_, i) => i % step === 0 || i === trkpts.length - 1)
    return sampled.map((pt, i) => fromElement(pt, `Point ${i + 1}`))
  }

  throw new Error(
    'No usable waypoints found. Export waypoints from Google My Maps as GPX (wpt) or use a route with rtept/trkpt.',
  )
}
