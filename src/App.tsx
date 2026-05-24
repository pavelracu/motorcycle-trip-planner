import { useEffect, useState, useTransition } from 'react'
import TripMap from './components/TripMap'
import { TripSettingsForm } from './components/TripSettingsForm'
import { labelFromFileName } from './lib/dayRouteLabel'
import { multiDayPlanToText } from './lib/exportText'
import { parseRouteFile } from './lib/parseRouteFile'
import { initRouteCache } from './lib/routing'
import { reverseGeocodeCacheSize } from './lib/reverseGeocodeCache'
import { buildMultiDayTripPlan } from './lib/multiDayPlanner'
import {
  clearSavedTrip,
  formatSavedAt,
  loadCachedPlan,
  loadTripBundle,
  saveTripBundle,
  tripFingerprint,
} from './lib/tripStorage'
import {
  adoptOsmFuelPlace,
  addUserFuelPlace,
  loadUserFuelPlaces,
  removeUserFuelPlace,
} from './lib/fuelPlaceStorage'
import type { FuelPlace } from './lib/fuelPlaces'

import type { MultiDayTripPlan, TripDayRoute, TripSettings } from './lib/types'

const DEFAULT_SETTINGS: TripSettings = {
  departureIso: '2026-05-25T06:00:00',
  dailyStartTime: '06:00',
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

export default function App() {
  const [days, setDays] = useState<TripDayRoute[]>([])
  const [settings, setSettings] = useState<TripSettings>(DEFAULT_SETTINGS)
  const [plan, setPlan] = useState<MultiDayTripPlan | null>(null)
  const [output, setOutput] = useState('')
  const [status, setStatus] = useState('')
  const [planning, setPlanning] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const [showFuelLayer, setShowFuelLayer] = useState(false)
  const [addFuelMode, setAddFuelMode] = useState(false)
  const [userFuelPlaces, setUserFuelPlaces] = useState<FuelPlace[]>([])

  useEffect(() => {
    const cachedRoutes = initRouteCache()
    setUserFuelPlaces(loadUserFuelPlaces())
    const saved = loadTripBundle()
    if (saved) {
      setDays(saved.days)
      setSettings(saved.settings)
      setPlan(saved.plan)
      setOutput(saved.plan ? multiDayPlanToText(saved.plan) : saved.output)
      const geoCache = reverseGeocodeCacheSize()
      setStatus(
        saved.needsRegenerate
          ? `Restored routes from ${formatSavedAt(saved.savedAt)} — click Generate to refresh the plan`
          : `Restored trip saved ${formatSavedAt(saved.savedAt)}${cachedRoutes > 0 ? ` · ${cachedRoutes} cached routes` : ''}${geoCache > 0 ? ` · ${geoCache} cached places` : ''}`,
      )
    } else if (cachedRoutes > 0) {
      setStatus(`${cachedRoutes} cached route legs ready`)
    }
  }, [])

  const busy = planning || isPending
  const totalWaypoints = days.reduce((n, d) => n + d.waypoints.length, 0)

  function updateSetting<K extends keyof TripSettings>(
    key: K,
    value: TripSettings[K],
  ) {
    setSettings((s) => ({ ...s, [key]: value }))
  }

  function reportProgress(msg: string) {
    startTransition(() => setStatus(msg))
  }

  async function onFiles(fileList: FileList | null) {
    if (!fileList?.length) return
    setError('')
    setPlan(null)
    setOutput('')

    const newDays: TripDayRoute[] = []
    const startIndex = days.length

    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i]
        const xml = await file.text()
        const wps = parseRouteFile(xml, file.name)
        newDays.push({
          id: crypto.randomUUID(),
          label: labelFromFileName(file.name, startIndex + i),
          fileName: file.name,
          waypoints: wps,
        })
      }
      setDays((prev) => [...prev, ...newDays])
      setOutput('')
      setStatus(
        `Added ${newDays.length} route file${newDays.length === 1 ? '' : 's'} (${days.length + newDays.length} day${days.length + newDays.length === 1 ? '' : 's'} total)`,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to parse route file')
    }
  }

  function removeDay(id: string) {
    setDays((prev) => prev.filter((d) => d.id !== id))
    setPlan(null)
    setOutput('')
  }

  function clearDays() {
    setDays([])
    setPlan(null)
    setOutput('')
    setStatus('')
    clearSavedTrip()
  }

  async function generate() {
    if (days.length === 0) {
      setError('Upload at least one route file')
      return
    }
    if (days.some((d) => d.waypoints.length < 2)) {
      setError('Each day needs at least 2 waypoints')
      return
    }
    setPlanning(true)
    setError('')
    try {
      const fingerprint = tripFingerprint(days, settings)
      const cached = loadCachedPlan(fingerprint)
      if (cached) {
        const text = multiDayPlanToText(cached)
        startTransition(() => {
          setPlan(cached)
          setOutput(text)
          setStatus('Loaded saved plan — no recalculation needed')
        })
        return
      }

      const trip = await buildMultiDayTripPlan(days, settings, reportProgress)
      const text = multiDayPlanToText(trip)
      saveTripBundle(fingerprint, days, settings, trip, text)
      startTransition(() => {
        setPlan(trip)
        setOutput(text)
        setStatus('Done — saved locally for next visit')
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

  function handleAddUserFuelPlace(place: Omit<FuelPlace, 'id' | 'source'>) {
    setUserFuelPlaces((prev) => addUserFuelPlace(prev, place))
    setAddFuelMode(false)
    setStatus(`Added fuel stop: ${place.name}`)
  }

  function handleSaveOsmFuelPlace(place: FuelPlace) {
    setUserFuelPlaces((prev) => adoptOsmFuelPlace(prev, place))
    setStatus(`Saved fuel stop: ${place.name}`)
  }

  function handleRemoveFuelPlace(id: string) {
    setUserFuelPlaces((prev) => removeUserFuelPlace(prev, id))
  }

  return (
    <div className="flex h-svh overflow-hidden bg-slate-950">
      <aside className="flex min-w-0 w-[min(100%,420px)] shrink-0 flex-col overflow-hidden border-r border-slate-800">
        <div className="shrink-0 border-b border-slate-800 px-4 py-4">
          <p className="text-xs font-medium uppercase tracking-widest text-amber-400/90">
            Motorcycle trip planner
          </p>
          <h1 className="mt-1 text-lg font-semibold text-white">Route & itinerary</h1>
        </div>

        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-4">
          <section className="mb-4 rounded-xl border border-slate-700/80 bg-slate-900/60 p-4">
            <h2 className="mb-2 text-sm font-medium text-white">Route files</h2>
            <input
              type="file"
              multiple
              accept=".gpx,.kml,application/gpx+xml,application/vnd.google-earth.kml+xml"
              className="block w-full text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-amber-500 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-950 hover:file:bg-amber-400"
              onChange={(e) => {
                void onFiles(e.target.files)
                e.target.value = ''
              }}
            />
            <p className="mt-2 text-xs text-slate-500">
              Upload one GPX/KML per riding day (e.g. day1.gpx … day5.gpx). Plans and
              routes are saved in this browser automatically.
            </p>
            {days.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {days.map((day) => (
                  <li
                    key={day.id}
                    className="flex items-start justify-between gap-2 rounded-lg bg-slate-800/60 px-2 py-1.5 text-xs"
                  >
                    <span className="min-w-0 text-slate-300">
                      <span className="font-medium text-amber-200/90">
                        {day.label}
                      </span>
                      <span className="block truncate text-slate-500">
                        {day.fileName} · {day.waypoints.length} waypoints
                      </span>
                    </span>
                    <button
                      type="button"
                      className="shrink-0 text-slate-500 hover:text-red-400"
                      onClick={() => removeDay(day.id)}
                      aria-label={`Remove ${day.label}`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {days.length > 0 ? (
              <button
                type="button"
                className="mt-2 text-xs text-slate-500 underline hover:text-slate-300"
                onClick={clearDays}
              >
                Clear all days
              </button>
            ) : null}
          </section>

          <TripSettingsForm
            settings={settings}
            onChange={updateSetting}
            multiDay={days.length > 1}
          />

          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || days.length === 0}
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
              <h2 className="mb-2 text-sm font-medium text-white">
                Itinerary{days.length > 1 ? ` · ${days.length} days` : ''}
              </h2>
              <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-amber-100/95">
                {output}
              </pre>
            </section>
          ) : days.length > 0 && !plan ? (
            <p className="text-xs text-slate-500">
              {totalWaypoints} waypoints across {days.length} day
              {days.length === 1 ? '' : 's'} — generate to see times and breaks.
            </p>
          ) : null}

          {userFuelPlaces.length > 0 ? (
            <section className="mb-4 min-w-0 rounded-xl border border-slate-700/80 bg-slate-900/60 p-4">
              <h2 className="mb-2 text-sm font-medium text-white">My fuel stops</h2>
              <ul className="space-y-2">
                {userFuelPlaces.map((place) => (
                  <li
                    key={place.id}
                    className="flex items-start justify-between gap-2 rounded-lg bg-slate-800/60 px-2 py-1.5 text-xs"
                  >
                    <span className="min-w-0 text-slate-300">
                      <span className="font-medium text-green-300/90">{place.name}</span>
                      {place.brand ? (
                        <span className="block text-slate-500">{place.brand}</span>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      className="shrink-0 text-slate-500 hover:text-red-400"
                      onClick={() => handleRemoveFuelPlace(place.id)}
                      aria-label={`Remove ${place.name}`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <TripMap
          days={days}
          plan={plan}
          showFuelLayer={showFuelLayer}
          addFuelMode={addFuelMode}
          userFuelPlaces={userFuelPlaces}
          onAddUserFuelPlace={handleAddUserFuelPlace}
          onSaveOsmFuelPlace={handleSaveOsmFuelPlace}
          onToggleFuelLayer={() => setShowFuelLayer((v) => !v)}
          onToggleAddFuelMode={() => setAddFuelMode((v) => !v)}
        />
      </main>
    </div>
  )
}
