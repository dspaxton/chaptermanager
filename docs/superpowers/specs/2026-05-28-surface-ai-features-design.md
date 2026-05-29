# Surface AI Features (Round 1) — Design

**Date:** 2026-05-28
**Status:** Approved
**Scope:** Frontend-only. Surface two already-implemented AI backend features in the UI.

## Background

The AI service (`services/ai/main.py`) and the frontend API client (`frontend/src/lib/api.ts`)
already implement several AI features that have **no UI entry point**. This spec covers
surfacing two of them. The backend and `api.ts` client methods exist and are unchanged.

In scope this round:

1. **Ride route suggestions** — `aiApi.getRideSuggestions` → `POST /api/ai/ride-suggestions`
2. **Member engagement insights** — `aiApi.getEngagementAnalysis` → `GET /api/ai/engagement-analysis`

Explicitly **out of scope** (deferred to later rounds / separate specs):

- Safety briefing generator and smart search (next AI round)
- Backend caching, Anthropic model upgrade, AI-service CORS tightening
- Any shared AI-primitive abstraction (extract later when a third consumer exists)
- Persisting AI suggestions to the database

## Approach

Approach A — **minimal footprint, no new routes**. Surface both features as sub-views of
existing pages, reusing the established design vocabulary (`card`, `btn-primary`,
`badge-*`, `input`, react-query, react-hot-toast, lucide icons). Two new components plus
edits to three existing files. No new routes, no nav changes, no backend changes.

New files:

- `frontend/src/components/RideSuggestions.tsx`
- `frontend/src/components/EngagementInsights.tsx`

Edited files:

- `frontend/src/pages/Rides.tsx`
- `frontend/src/pages/RideCreate.tsx`
- `frontend/src/pages/Members.tsx`

## Feature 1: Ride Route Suggestions

### Placement & access

- A **"Suggest a Ride"** button in the `Rides.tsx` header, beside the existing "New Ride"
  link, gated by the existing `canCreate` check
  (`['admin', 'director', 'officer', 'road_captain']`).
- The button toggles an inline `RideSuggestions` panel rendered as a `card` (mirroring the
  existing filter card), shown below the header. No modal component is introduced.

### Input form (inside the panel)

| Field             | Type   | Required | Default |
|-------------------|--------|----------|---------|
| Start location    | text   | yes      | —       |
| Preferred distance| number | no       | 100 (mi)|
| Difficulty        | select 1–5 | no   | 2       |
| Date              | date   | no       | —       |
| Group size        | number | no       | —       |

A "Suggest routes" submit button triggers the call.

### Behaviour

- `useMutation` → `aiApi.getRideSuggestions(...)`.
- Pending: existing spinner pattern.
- Error: react-hot-toast with a friendly message. The backend returns HTTP 503 when
  Anthropic is unavailable — surface as "AI service is temporarily unavailable, please try
  again."
- Success: render up to 3 suggestion cards.

### Suggestion card

Displays: `title`, `description`, badges for `~distance` / `~duration` / `difficulty`,
a waypoints list, and a safety-notes list. Footer has a **"Use this ride"** button (shown
to all viewers — only officers/road captains can see the panel at all, and all of them can
create rides).

### "Use this ride" → prefilled create flow

- The button calls `navigate('/rides/new', { state: { prefill } })`.
- `RideCreate.tsx` reads `useLocation().state?.prefill` and merges it into react-hook-form
  `defaultValues` (prefill overrides the static defaults). A small "Prefilled from AI
  suggestion" banner appears when prefill is present.

**Field mapping** (suggestion → create form). The backend `RideSuggestion` shape differs
from the create form, so map carefully:

| Suggestion field        | Create form field    | Transform                          |
|-------------------------|----------------------|------------------------------------|
| `title`                 | `title`              | direct                             |
| `description`           | `description`        | direct                             |
| `estimatedDistance`     | `estimatedDistance`  | direct                             |
| `estimatedDuration` (minutes) | `estimatedDuration` (hours) | ÷ 60, rounded to nearest 0.5 |
| `difficulty`            | `difficultyLevel`    | direct (both 1–5)                  |
| `waypoints[]`           | `routeDescription`   | appended (joined, labelled)        |
| `safetyNotes[]`         | `routeDescription`   | appended (joined, labelled)        |

Note: `RideCreate` already converts the hours field back to minutes on submit
(`estimatedDuration * 60`), so the suggestion's minutes must be divided by 60 on prefill to
round-trip correctly.

## Feature 2: Member Engagement Insights

### Placement & access

- `Members.tsx` gains a `Directory | Insights` tab toggle below the page header
  (a `useState` tab switch; no routing).
- The **Insights** tab is rendered only for officer+ (`['admin', 'director', 'officer']`);
  other roles never see the tab. `Directory` remains the default tab.
- When `Insights` is active, the directory filters and member grid are hidden and the
  `EngagementInsights` component is shown.

### EngagementInsights component

- Initial state: explainer text + a **"Generate insights"** button. The call is deliberate
  (not auto-run) because the endpoint is uncached and spends tokens on every call.
- Data fetch: `useQuery` with `enabled: false` + manual `refetch`, and a long `staleTime`
  so the result persists across tab switches within the session. A **"Refresh"** button
  re-runs `refetch`.
- Pending: existing spinner.
- Error: react-hot-toast (same 503 handling as above).

### Rendered result

The endpoint returns `{ inactiveMembers: [...], totalInactive: number, recommendations: string }`.

- **Summary line:** "X members inactive (90+ days)" from `totalInactive`.
- **Inactive members list:** one row per member — name (links to `/members/:id`),
  `daysInactive`, `totalRides`, `totalMeetings`, `lastRide`, `lastMeeting`. Reuse the
  existing member-row styling.
- **Recommendations:** the backend returns this as a single free-text/markdown-ish blob,
  not a structured object. Render it in a `card` with `whitespace-pre-wrap` (no markdown
  parser needed).
- **All-engaged case:** when there are no inactive members, the backend returns a positive
  recommendations string ("Great news! All members are actively engaged.") — render it
  as-is.

## Types

Define **local TS interfaces** in each component matching the actual backend payloads. The
shared types (`EngagementAnalysisResponse`, `RideSuggestion` in `services/shared/types`)
are slightly out of sync with what the endpoints actually return, so they are not relied
upon here. No changes to `api.ts` are required.

## Error / loading / empty handling

Consistent with the existing app:

- Pending → existing spinner component/pattern.
- Error → react-hot-toast; the AI service's 503 surfaces as a friendly retry message.
- Empty → existing `card` + lucide-icon empty-state pattern.

## Verification

The frontend has no test framework wired (no test deps or scripts in
`frontend/package.json`), so verification is:

1. `tsc` / eslint clean on the changed files.
2. Manual click-through:
   - As an officer: open Rides → "Suggest a Ride" → fill form → suggestions render →
     "Use this ride" → create form is prefilled with correctly mapped fields (esp.
     duration hours and difficulty).
   - As an officer: Members → Insights tab → "Generate insights" → inactive list +
     recommendations render; "Refresh" re-runs; member links navigate to profiles.
   - As a regular member: the "Suggest a Ride" button and the Insights tab are both hidden.
3. Optionally add the two AI endpoints to `scripts/smoke-test.sh`.

## Risks / notes

- The engagement endpoint is uncached and synchronous against Claude; the on-demand button
  + session cache keeps token spend and latency under user control.
- Field-mapping correctness (duration minutes↔hours, difficulty) is the main correctness
  risk for the prefill flow and is the focus of manual verification.
