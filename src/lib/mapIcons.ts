import L from 'leaflet'

function fuelDivIcon(opts: {
  size: number
  bg: string
  border: string
  emoji: string
}): L.DivIcon {
  const { size, bg, border, emoji } = opts
  const fontSize = Math.max(10, Math.round(size * 0.42))
  return L.divIcon({
    className: 'map-fuel-icon',
    html: `<div aria-hidden="true" style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;background:${bg};border:2px solid ${border};border-radius:9999px;box-shadow:0 2px 8px rgba(0,0,0,.5);font-size:${fontSize}px;line-height:1">${emoji}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

/** OSM gas stations along the route corridor */
export function osmFuelIcon(): L.DivIcon {
  return fuelDivIcon({
    size: 22,
    bg: '#f97316',
    border: '#ffffff',
    emoji: '⛽',
  })
}

/** User-saved fuel stops */
export function savedFuelIcon(): L.DivIcon {
  return fuelDivIcon({
    size: 26,
    bg: '#22c55e',
    border: '#ffffff',
    emoji: '⛽',
  })
}

/** Planner fuel stop */
export function plannedFuelIcon(): L.DivIcon {
  return fuelDivIcon({
    size: 24,
    bg: '#f59e0b',
    border: '#1e293b',
    emoji: '⛽',
  })
}

/** Planner lunch + refuel */
export function lunchRefuelIcon(): L.DivIcon {
  return fuelDivIcon({
    size: 26,
    bg: '#ec4899',
    border: '#ffffff',
    emoji: '⛽',
  })
}
