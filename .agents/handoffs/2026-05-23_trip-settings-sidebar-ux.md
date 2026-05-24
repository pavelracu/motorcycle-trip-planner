---
handoff: .agents/handoffs/2026-05-23_trip-settings-sidebar-ux.md
status: ready-for-implementation
updated: 2026-05-23
---

# Trip settings sidebar — scroll fix & compact layout

## Problem

Riders configuring a trip on [pavelracu.com/ride](https://www.pavelracu.com/ride/) see a **long Trip settings block** in a fixed-width sidebar (~420px). The panel shows **nested vertical scroll** (sidebar + inner content) and **horizontal scroll**, likely from absolutely positioned info tooltips (`overflow-visible`) and wide `datetime-local` inputs. Nine fields in a single column force excessive scrolling before users can reach **Generate plan**.

**User:** wants scrolling fixed and a shorter, clearer settings layout.

## Goals

1. **One vertical scroll** for the left panel content (no horizontal scrollbar).
2. **Reduce visible height** of Trip settings by ~40% for default state (collapsed advanced groups).
3. Preserve **ⓘ help** for every field without clipping or causing overflow.

## Requirements

### Must (P0)

- Sidebar content area: `overflow-x-hidden`, `min-w-0`; no horizontal scrollbar at 320–420px width.
- Info tooltips constrained to panel width (no `overflow-visible` bleed).
- Move **My fuel stops** inside the same scroll container as route files / settings (fix split scroll).

### Should (P1)

- **Collapsible sections** (`<details>`): Schedule open by default; Fuel, Breaks, Route & display collapsed by default (summary shows 1-line preview of key values).
- Shorter field labels where unambiguous (e.g. “Short every (h)” / “Short (min)”).

### Should (P2)

- **Two-column grid** for paired numeric fields within Breaks (interval + duration for short and lunch).
- Remove redundant intro line (“Hover or tap i…”) — discoverability via ⓘ on labels only.

## Acceptance criteria

- [ ] At 375px and 420px viewport width, sidebar has **no horizontal scroll** while interacting with all fields and tooltips.
- [ ] Only **one** vertical scrollbar for left-column content (header stays fixed).
- [ ] With default collapse state, Schedule + collapsed section headers visible without scrolling on a ~800px-tall window (or materially less scroll than today).
- [ ] All 9 settings remain editable; multi-day shows “Days 2+ start” inside Schedule when applicable.
- [ ] Tooltips readable and not clipped when opened (tap or hover).

## Out of scope (P3+)

- Separate settings modal / full-screen drawer.
- Presets (“Relaxed / Standard / Endurance”).
- Persist collapse state in localStorage.

## Open questions

- **Non-blocking:** Should Fuel merge into Breaks section UI (single “Stops” group)? Defer unless user asks.

## Implementation notes

- `src/App.tsx` — aside scroll wrapper, fuel stops placement.
- `src/components/TripSettingsForm.tsx` — layout refactor.
- `src/components/InfoTip.tsx` — tooltip positioning (`inset-x-0`, `max-w-full`).
