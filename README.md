# Motorcycle Trip Planner

Plan multi-day motorcycle trips from GPX/KML files — timed itinerary, fuel stops, break rules, weather, and an interactive map.

**Live demo:** [pavelracu.com/ride](https://www.pavelracu.com/ride/)

## Features

- Upload one GPX/KML file per riding day
- OSRM routing with fuel, short break (every 2h), and lunch (every 4h) planning
- Smart break merging — defer short breaks toward upcoming fuel or lunch when within tolerance
- Multi-day trips with per-day start times and color-coded map routes
- Gas station layer (OSM, 10 km corridor along route) plus user-saved fuel pins
- Weather at each stop and break (Open-Meteo)
- Reverse-geocoded place names for breaks and waypoints
- Browser-local persistence for routes, plans, and geocode cache

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173), upload route files, and click **Generate plan**.

## Deploy (pavelracu.com/ride/)

```bash
npm run deploy:site
cd ../personal/codebase/pavelracu-site
wrangler pages deploy . --project-name=pavelracu
```

Builds with base path `/ride/` and copies static assets into the personal site repo, then deploy the whole site to Cloudflare Pages.

## Data & privacy

All trip data stays in your browser (`localStorage`). Routing uses the public [OSRM](https://project-osrm.org/) demo server; geocoding uses [Nominatim](https://nominatim.org/) (please respect their usage policy); fuel stations come from [OpenStreetMap](https://www.openstreetmap.org/) via Overpass.

## Tech stack

React 19 · Vite · TypeScript · Tailwind CSS v4 · Leaflet · Open-Meteo

## License

MIT — see [LICENSE](LICENSE).
