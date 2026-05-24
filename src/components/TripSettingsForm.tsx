import { memo, type ReactNode } from 'react'
import { InfoTip } from './InfoTip'
import type { TripSettings } from '../lib/types'

const inputClass =
  'mt-1 w-full min-w-0 max-w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white tabular-nums focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30'

function SettingLabel({
  label,
  help,
}: {
  label: string
  help: string
}) {
  return (
    <span className="flex min-w-0 items-center gap-0.5 text-slate-400">
      <span className="min-w-0 truncate">{label}</span>
      <InfoTip text={help} />
    </span>
  )
}

function SettingField({
  label,
  help,
  children,
  className = '',
}: {
  label: string
  help: string
  children: ReactNode
  className?: string
}) {
  return (
    <label className={`block min-w-0 text-sm ${className}`}>
      <SettingLabel label={label} help={help} />
      {children}
    </label>
  )
}

function SettingsSection({
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string
  summary: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-lg border border-slate-700/60 bg-slate-800/30 open:bg-slate-800/50"
    >
      <summary className="cursor-pointer list-none px-3 py-2.5 marker:content-none [&::-webkit-details-marker]:hidden">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
            {title}
          </span>
          <span
            className="shrink-0 text-slate-500 transition-transform group-open:rotate-180"
            aria-hidden
          >
            ▾
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs text-slate-500 group-open:hidden">
          {summary}
        </p>
      </summary>
      <div className="space-y-3 border-t border-slate-700/50 px-3 pb-3 pt-2">
        {children}
      </div>
    </details>
  )
}

function formatDeparture(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso.slice(0, 16)
  }
}

export const TripSettingsForm = memo(function TripSettingsForm({
  settings,
  onChange,
  multiDay,
}: {
  settings: TripSettings
  onChange: <K extends keyof TripSettings>(key: K, value: TripSettings[K]) => void
  multiDay: boolean
}) {
  const shortH = settings.shortBreakEveryMinutes / 60
  const lunchH = settings.longBreakEveryMinutes / 60

  const scheduleSummary = multiDay
    ? `${formatDeparture(settings.departureIso)} · days 2+ at ${settings.dailyStartTime}`
    : formatDeparture(settings.departureIso)

  const breaksSummary = `Short ${shortH}h/${settings.shortBreakDurationMinutes}m · Lunch ${lunchH}h/${settings.longBreakDurationMinutes}m · ±${settings.restToleranceMinutes}m`

  return (
    <section className="mb-4 min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-700/80 bg-slate-900/60 p-3">
      <h2 className="mb-2 text-sm font-medium text-white">Trip settings</h2>
      <div className="space-y-2">
        <SettingsSection title="Schedule" summary={scheduleSummary} defaultOpen>
          <SettingField
            label="Day 1 departure"
            help="Date and time you leave on the first riding day. All later stops on day 1 are timed from here."
          >
            <input
              type="datetime-local"
              className={inputClass}
              value={settings.departureIso.slice(0, 16)}
              onChange={(e) => onChange('departureIso', `${e.target.value}:00`)}
            />
          </SettingField>
          {multiDay ? (
            <SettingField
              label="Days 2+ start at"
              help="Clock time each following day begins (e.g. 06:00). Day 2 starts the morning after day 1 ends; day 3 the morning after day 2, and so on."
            >
              <input
                type="time"
                className={inputClass}
                value={settings.dailyStartTime}
                onChange={(e) => onChange('dailyStartTime', e.target.value)}
              />
            </SettingField>
          ) : null}
        </SettingsSection>

        <SettingsSection title="Fuel" summary={`${settings.tankRangeKm} km tank range`}>
          <SettingField
            label="Tank range (km)"
            help="Maximum riding distance before a fuel stop is scheduled. The planner picks stations along your route near this interval."
          >
            <input
              type="number"
              min={80}
              max={400}
              className={inputClass}
              value={settings.tankRangeKm}
              onChange={(e) => onChange('tankRangeKm', Number(e.target.value))}
            />
          </SettingField>
        </SettingsSection>

        <SettingsSection title="Breaks" summary={breaksSummary}>
          <div className="grid grid-cols-2 gap-3">
            <SettingField
              label="Short every (h)"
              help="Stretch / coffee stop interval, measured in riding time only (not clock time at standstills). A stop is added after this many hours in the saddle."
            >
              <input
                type="number"
                min={0.5}
                step={0.5}
                className={inputClass}
                value={shortH}
                onChange={(e) =>
                  onChange('shortBreakEveryMinutes', Number(e.target.value) * 60)
                }
              />
            </SettingField>
            <SettingField
              label="Short (min)"
              help="How long each short break lasts. Added to your itinerary and map timeline."
            >
              <input
                type="number"
                min={5}
                max={60}
                className={inputClass}
                value={settings.shortBreakDurationMinutes}
                onChange={(e) =>
                  onChange('shortBreakDurationMinutes', Number(e.target.value))
                }
              />
            </SettingField>
            <SettingField
              label="Lunch every (h)"
              help="Longer meal stop interval, again in riding hours. Can merge with a nearby fuel stop when the tank is low enough."
            >
              <input
                type="number"
                min={1}
                step={0.5}
                className={inputClass}
                value={lunchH}
                onChange={(e) =>
                  onChange('longBreakEveryMinutes', Number(e.target.value) * 60)
                }
              />
            </SettingField>
            <SettingField
              label="Lunch (min)"
              help="How long the lunch stop lasts. Shown separately from short breaks in the itinerary."
            >
              <input
                type="number"
                min={15}
                max={180}
                className={inputClass}
                value={settings.longBreakDurationMinutes}
                onChange={(e) =>
                  onChange('longBreakDurationMinutes', Number(e.target.value))
                }
              />
            </SettingField>
          </div>
          <SettingField
            label="Rest tolerance (min)"
            help="If fuel or lunch is due within this many riding minutes, a short break is postponed so you rest once instead of twice. After short-break interval + tolerance, a short break is forced anyway."
          >
            <input
              type="number"
              min={0}
              max={120}
              className={inputClass}
              value={settings.restToleranceMinutes}
              onChange={(e) =>
                onChange('restToleranceMinutes', Number(e.target.value))
              }
            />
          </SettingField>
        </SettingsSection>

        <SettingsSection
          title="Route & display"
          summary={`Auto-via under ${settings.autoViaMaxLegKm} km · Major every ${settings.majorStopMinKm || 'all'} km`}
        >
          <div className="grid grid-cols-2 gap-3">
            <SettingField
              label="Auto-via (km)"
              help="Before planning, any map pin with a road leg shorter than this becomes a via point (pass-through, no stop). Reduces clutter when GPX has many close waypoints. Set 0 to disable."
            >
              <input
                type="number"
                min={0}
                max={150}
                className={inputClass}
                value={settings.autoViaMaxLegKm}
                onChange={(e) => onChange('autoViaMaxLegKm', Number(e.target.value))}
              />
            </SettingField>
            <SettingField
              label="Major every (km)"
              help='Collapses the text itinerary so only "major" legs appear. A leg counts as major if it is at least this long, ends at a forced [stop], or has a break. Use 0 to list every leg.'
            >
              <input
                type="number"
                min={0}
                max={300}
                className={inputClass}
                value={settings.majorStopMinKm}
                onChange={(e) => onChange('majorStopMinKm', Number(e.target.value))}
              />
            </SettingField>
          </div>
        </SettingsSection>
      </div>
    </section>
  )
})
