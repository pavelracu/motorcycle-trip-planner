import type { MapMarkerKind } from './types'

export const MARKER_TYPE_LABELS: Record<MapMarkerKind, string> = {
  start: 'Departure',
  end: 'Arrival',
  major: 'Major stop',
  pin: 'Waypoint',
  via: 'Via (routing only)',
  fuel: 'Fuel stop',
  short: 'Short break',
  lunch: 'Lunch',
  'lunch-refuel': 'Lunch & refuel',
}
