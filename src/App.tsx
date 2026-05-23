import { memo, useState, useTransition } from 'react'
import TripMap from './components/TripMap'
import { applyAutoVia } from './lib/consolidateWaypoints'
import { enrichWaypointsWithLocality } from './lib/locality'
import { planToText } from './lib/exportText'
import { parseRouteFile } from './lib/parseRouteFile'
import { clearRouteCache } from './lib/routing'
import { buildTripPlan } from './lib/tripPlanner'
import type { TripPlan, TripSettings, Waypoint } from './lib/types'

const DEFAULT_SETTINGS: TripSettings = {
  departureIso: '2026-05-25T06:00:00',
  tankRangeKm: 180,
  shortBreakEveryMinutes: 120,
  shortBreakDurationMinutes: 15,
  longBreakEveryMinutes: 240,
  longBreakDurationMinutes: 60,
  autoViaMaxLegKm: 50,
  majorStopMinKm: 60,
  restToleranceMinutes: 45,
  lunchRefuelMinTankUsed: 0.5,
}

const TripSettingsForm = memo(function TripSettingsForm({
  settings,
  onChange,
}: {
  settings: TripSettings
  onChange: <K extends keyof TripSettings>(key: K, value: TripSettings[K]) => void
}) {
  return (
    <section className="mb-4 rounded-xl border border-slate-700/80 bg-slate-900/60 p-4">
      <h2 className="mb-3 text-sm font-medium text-white">Trip settings</h2>
      <div className="grid gap-3">
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
          <span className="text-slate-400">Auto-via legs shorter than (km)</span>
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
          <span className="text-slate-400">Major stop every (km) — 0 shows all</span>
          <input
            type="number"
            min={0}
            max={300}
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white"
            value={settings.majorStopMinKm}
            onChange={(e) => onChange('majorStopMinKm', Number(e.target.value))}
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-400">
            Rest tolerance (min) — push to fuel / lunch
          </span>
          <input
            type="number"
            min={0}
            max={120}
            className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white"
            value={settings.restToleranceMinutes}
            onChange={(e) =>
              onChange('restToleranceMinutes', Number(e.target.value))
            }
          />
        </label>
      </div>
    </section>
  )
})

export default function App() {
  const [waypoints, setWaypoints] = useState<Waypoint[]>([])
  const [settings, setSettings] = useState<TripSettings>(DEFAULT_SETTINGS)
  const [plan, setPlan] = useState<TripPlan | null>(null)
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
    setPlan(null)
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
      const trip = await buildTripPlan(routed, settings, reportProgress)
      startTransition(() => {
        setWaypoints(routed)
        setPlan(trip)
        setOutput(planToText(trip))
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
    <div className="flex h-svh overflow-hidden bg-slate-950">
      <aside className="flex w-[min(100%,420px)] shrink-0 flex-col border-r border-slate-800">
        <div className="shrink-0 border-b border-slate-800 px-4 py-4">
          <p className="text-xs font-medium uppercase tracking-widest text-amber-400/90">
            Motorcycle trip planner
          </p>
          <h1 className="mt-1 text-lg font-semibold text-white">Route & itinerary</h1>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <section className="mb-4 rounded-xl border border-slate-700/80 bg-slate-900/60 p-4">
            <h2 className="mb-2 text-sm font-medium text-white">Route file</h2>
            <input
              type="file"
              accept=".gpx,.kml,application/gpx+xml,application/vnd.google-earth.kml+xml"
              className="block w-full text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-amber-500 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-950 hover:file:bg-amber-400"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void onFile(f)
              }}
            />
            <p className="mt-2 text-xs text-slate-500">
              Export KML from Google My Maps. Use <code className="text-amber-300/90">[via]</code>{' '}
              / <code className="text-amber-300/90">[stop]</code> on pin names to override.
            </p>
            {waypoints.length > 0 ? (
              <p className="mt-2 text-xs text-slate-400">
                {waypoints.length} waypoints loaded
              </p>
            ) : null}
          </section>

          <TripSettingsForm settings={settings} onChange={updateSetting} />

          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || waypoints.length < 2}
              onClick={() => void generate()}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-slate-950 disabled:opacity-40"
            >
              {busy ? 'Planning…' : 'Generate plan'}
            </button>
            {output ? (
              <button
                type="button"
                onClick={() => void copy()}
                className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200"
              >
                Copy
              </button>
            ) : null}
          </div>

          {error ? (
            <p className="mb-3 rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          ) : null}
          {status && !error ? (
            <p className="mb-3 text-xs text-slate-500">{status}</p>
          ) : null}

          {output ? (
            <section className="rounded-xl border border-slate-700/80 bg-black/40 p-3">
              <h2 className="mb-2 text-sm font-medium text-white">Itinerary</h2>
              <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-amber-100/95">
                {output}
              </pre>
            </section>
          ) : null}
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <TripMap waypoints={waypoints} plan={plan} />
      </main>
    </div>
  )
}
