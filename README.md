# Motorcycle Trip Planner

Upload a GPX with waypoints from Google My Maps and get a timed itinerary with weather, distance, and riding duration between stops.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Export GPX from Google My Maps

1. Open your [My Maps](https://www.google.com/maps/d/) layer.
2. Click the three dots on the layer → **Export to KML/KMZ**.
3. Convert KML to GPX (e.g. [gpsvisualizer.com convert](https://www.gpsvisualizer.com/convert_input) or `gpsbabel`).
4. Ensure the GPX contains `<wpt>` elements (one per stop). The app also accepts route `<rtept>` or sampled `<trkpt>`.

## Defaults (Speed Twin 1200)

- Departure: **25 May 2026, 06:00**
- Tank range: **180 km** (practical; theoretical ~264 km at 5.3 L/100 km × 14 L)
- Short break: **15 min** every **2 h** riding (or fuel stop)
- Lunch: **60 min** every **4 h** riding

## Waypoint names

- `[via]` prefix — routed through, omitted from itinerary (e.g. `[via] curve on N4`)
- `[stop]` prefix — always shown as a stop
- Short legs (&lt; 25 km by default) between stops auto-merge as via
- Country suffixes (`, Portugal`, `, Spain`) are stripped from display names

## Output format

```
06:00, Barreiro, 16°C partly cloudy

11:18, Sevilla, 23°C mainly clear
11:18, 🍽️ Lunch (+1h)

176 kms, 2h 15m riding · 3h 31m total

—
Total: 620 kms · 9h riding · 11h 30m on the road
Breaks: 2 fuel, 1 lunch
```

Routing uses [OSRM](https://project-osrm.org/) (driving). Weather uses [Open-Meteo](https://open-meteo.com/) (no API key).
