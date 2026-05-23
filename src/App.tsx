import { memo, useState, useTransition } from 'react'
import { applyAutoVia } from './lib/consolidateWaypoints'
import { enrichWaypointsWithLocality } from './lib/locality'
import { planToText } from './lib/exportText'
import { parseRouteFile } from './lib/parseRouteFile'
import { clearRouteCache } from './lib/routing'
import { buildTripPlan } from './lib/tripPlanner'
import type { TripSettings, Waypoint } from './lib/types'

const DEFAULT_SETTINGS: TripSettings = {
  departureIso: '2026-05-25T06:00:00',
  tankRangeKm: 180,
  shortBreakEveryMinutes: 120,
  shortBreakDurationMinutes: 15,
  longBreakEveryMinutes: 240,
  longBreakDurationMinutes: 60,
  autoViaMaxLegKm: 50,
  majorStopMinKm: 60,
}

const TripSettingsForm = memo(function TripSettingsForm({
  settings,
  onChange,
}: {
  settings: TripSettings
  onChange: <K extends keyof TripSettings>(key: K, value: TripSettings[K]) => void
}) {
  return (
    <section className="mb-6 rounded-xl border border-slate-700/80 bg-slate-900/60 p-5">
      <h2 className="mb-4 text-lg font-medium text-white">2. Trip settings</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-slate-400">Departure</span>
          <input
            type="datetime-local"
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white"
            value={settings.departureIso.slice(0, 16)}
            onChange={(e) => onChange('departureIso', `${e.target.value}:00`)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-400">Tank range (km)</span>
          <input
            type="number"
            min={80}
            max={400}
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white"
            value={settings.tankRangeKm}
            onChange={(e) => onChange('tankRangeKm', Number(e.target.value))}
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-400">Short break every (h riding)</span>
          <input
            type="number"
            min={0.5}
            step={0.5}
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white"
            value={settings.shortBreakEveryMinutes / 60}
            onChange={(e) =>
              onChange('shortBreakEveryMinutes', Number(e.target.value) * 60)
            }
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-400">Short break duration (min)</span>
          <input
            type="number"
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white"
            value={settings.shortBreakDurationMinutes}
            onChange={(e) =>
              onChange('shortBreakDurationMinutes', Number(e.target.value))
            }
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-400">Lunch break every (h riding)</span>
          <input
            type="number"
            min={1}
            step={0.5}
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white"
            value={settings.longBreakEveryMinutes / 60}
            onChange={(e) =>
              onChange('longBreakEveryMinutes', Number(e.target.value) * 60)
            }
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-400">Lunch duration (min)</span>
          <input
            type="number"
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white"
            value={settings.longBreakDurationMinutes}
            onChange={(e) =>
              onChange('longBreakDurationMinutes', Number(e.target.value))
            }
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-400">
            Auto-via legs shorter than (km)
          </span>
          <input
            type="number"
            min={0}
            max={150}
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white"
            value={settings.autoViaMaxLegKm}
            onChange={(e) => onChange('autoViaMaxLegKm', Number(e.target.value))}
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-400">
            Major stop every (km) — 0 shows all
          </span>
          <input
            type="number"
            min={0}
            max={300}
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white"
            value={settings.majorStopMinKm}
            onChange={(e) => onChange('majorStopMinKm', Number(e.target.value))}
          />
        </label>
      </div>
    </section>
  )
})

export default function App() {
  const [waypoints, setWaypoints] = useState<Waypoint[]>([])
  const [settings, setSettings] = useState<TripSettings>(DEFAULT_SETTINGS)
  const [output, setOutput] = useState('')
  const [status, setStatus] = useState('')
  const [planning, setPlanning] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const busy = planning || isPending

  function updateSetting<K extends keyof TripSettings>(
    key: K,
    value: TripSettings[K],
  ) {
    setSettings((s) => ({ ...s, [key]: value }))
  }

  function reportProgress(msg: string) {
    startTransition(() => setStatus(msg))
  }

  async function onFile(file: File) {
    setError('')
    clearRouteCache()
    try {
      const xml = await file.text()
      const wps = parseRouteFile(xml, file.name)
      setWaypoints(wps)
      setOutput('')
      setStatus(`Loaded ${wps.length} waypoints from ${file.name}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to parse route file')
      setWaypoints([])
    }
  }

  async function generate() {
    if (waypoints.length < 2) {
      setError('Upload a route file with at least 2 waypoints')
      return
    }
    setPlanning(true)
    setError('')
    try {
      const resolved = waypoints.map((w) => ({ ...w }))
      await enrichWaypointsWithLocality(resolved, reportProgress)
      const routed = await applyAutoVia(
        resolved,
        settings.autoViaMaxLegKm,
        reportProgress,
      )
      const plan = await buildTripPlan(routed, settings, reportProgress)
      startTransition(() => {
        setWaypoints(routed)
        setOutput(planToText(plan))
        setStatus('Done')
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Planning failed')
    } finally {
      setPlanning(false)
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(output)
    setStatus('Copied to clipboard')
  }

  return (
    <div className="min-h-svh bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <header className="mb-8">
          <p className="text-sm font-medium uppercase tracking-widest text-amber-400/90">
            Motorcycle trip planner
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white">
            GPX → timed itinerary with weather
          </h1>
          <p className="mt-3 text-slate-400">
            Upload waypoints from Google My Maps (GPX). Plans riding time via
            OSRM, fuel stops at {settings.tankRangeKm} km, 15 min every 2h, lunch
            every 4h.
          </p>
        </header>

        <section className="mb-6 rounded-xl border border-slate-700/80 bg-slate-900/60 p-5">
          <h2 className="mb-3 text-lg font-medium text-white">1. Route file (GPX or KML)</h2>
          <input
            type="file"
            accept=".gpx,.kml,application/gpx+xml,application/vnd.google-earth.kml+xml"
            className="block w-full text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-amber-500 file:px-4 file:py-2 file:font-medium file:text-slate-950 hover:file:bg-amber-400"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onFile(f)
            }}
          />
          <p className="mt-3 text-xs text-slate-500">
            In Google My Maps: layer ⋮ → Export to KML/KMZ → download the .kml
            and upload it here. Prefix pin names with{' '}
            <code className="text-amber-300/90">[via]</code> to shape the route
            without a stop, or <code className="text-amber-300/90">[stop]</code>{' '}
            to force a stop. The itinerary shows major stops only (fuel, lunch,
            short breaks, and every {settings.majorStopMinKm} km).
          </p>
          {waypoints.length > 0 && (
            <ol className="mt-4 max-h-40 list-decimal overflow-y-auto pl-5 [content-visibility:auto]">
              {waypoints.map((w, i) => (
                <li
                  key={`${w.lat}-${w.lon}-${i}`}
                  className="text-sm text-slate-300"
                >
                  {i + 1}. {w.displayName}
                  {w.role === 'via' && (
                    <span className="ml-2 text-xs text-slate-500">
                      (via — hidden in itinerary)
                    </span>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>

        <TripSettingsForm settings={settings} onChange={updateSetting} />

        <div className="mb-6 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy || waypoints.length < 2}
            onClick={() => void generate()}
            className="rounded-lg bg-amber-500 px-5 py-2.5 font-medium text-slate-950 disabled:opacity-40"
          >
            {busy ? 'Planning…' : 'Generate trip plan'}
          </button>
          {output ? (
            <button
              type="button"
              onClick={() => void copy()}
              className="rounded-lg border border-slate-600 px-5 py-2.5 text-slate-200"
            >
              Copy output
            </button>
          ) : null}
        </div>

        {error ? (
          <p className="mb-4 rounded-lg bg-red-950/50 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        ) : null}
        {status && !error ? (
          <p className="mb-4 text-sm text-slate-500">{status}</p>
        ) : null}

        {output ? (
          <section className="rounded-xl border border-slate-700/80 bg-black/40 p-5">
            <h2 className="mb-3 text-lg font-medium text-white">Itinerary</h2>
            <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-amber-100/95">
              {output}
            </pre>
            <p className="mt-4 text-center text-xs text-slate-600">
              Arrival times are when you reach each stop; breaks after show fuel,
              short stops, and lunch. Weather from Open-Meteo for the arrival hour.
            </p>
          </section>
        ) : null}
      </div>
    </div>
  )
}
