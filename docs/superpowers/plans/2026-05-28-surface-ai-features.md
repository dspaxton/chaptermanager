# Surface AI Features (Round 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface two already-implemented AI backend features — ride route suggestions and member engagement insights — in the React frontend.

**Architecture:** Frontend-only (Approach A). Two new components (`RideSuggestions`, `EngagementInsights`) reused as inline sub-views of existing pages. "Suggest a Ride" is an inline panel on the Rides page whose results can prefill the existing create form via router state. Engagement insights live behind a `Directory | Insights` tab on the Members page, fetched on-demand. No backend, route, nav, or `api.ts` changes.

**Tech Stack:** React 18, TypeScript, react-router-dom, @tanstack/react-query v5, react-hook-form, react-hot-toast, lucide-react, TailwindCSS (existing `card`/`btn-*`/`badge-*`/`input` utility classes).

**Reference spec:** `docs/superpowers/specs/2026-05-28-surface-ai-features-design.md`

**Verification note:** The frontend has no test framework (no test deps/scripts in `frontend/package.json`). Verification per task is `npx tsc --noEmit` (typecheck) + `npm run lint`, plus manual click-through at the end. All commands run from `frontend/`.

**Backend response shapes (confirmed, do not change backend):**
- `POST /ai/ride-suggestions` → `{ success, data: { suggestions: RideSuggestion[] } }` where `RideSuggestion = { title, description, estimatedDistance?, estimatedDuration? /* minutes */, difficulty?, waypoints?: string[], safetyNotes?: string[] }`. `suggestions` can be `[]` if the model's JSON failed to parse.
- `GET /ai/engagement-analysis` → `{ success, data: { inactiveMembers: InactiveMember[], totalInactive: number, recommendations: string } }` where `InactiveMember = { id, name, daysInactive, totalRides, totalMeetings, lastRide: string|null, lastMeeting: string|null }`. `recommendations` is a free-text blob. Endpoint is officer+ only and uncached.
- The axios client methods (`aiApi.getRideSuggestions(data)`, `aiApi.getEngagementAnalysis()`) return the raw axios response, so payload is at `response.data.data.*`.

---

### Task 1: Create the `RideSuggestions` component

**Files:**
- Create: `frontend/src/components/RideSuggestions.tsx`

- [ ] **Step 1: Write the component**

Create `frontend/src/components/RideSuggestions.tsx` with this exact content:

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Sparkles, MapPin, Clock, Bike, X, ArrowRight } from 'lucide-react';
import { aiApi } from '../lib/api';
import toast from 'react-hot-toast';

interface SuggestionFormData {
  startLocation: string;
  preferredDistance: number;
  difficulty: number;
  date?: string;
  groupSize?: number;
}

interface RideSuggestion {
  title: string;
  description: string;
  estimatedDistance?: number;
  estimatedDuration?: number; // minutes
  difficulty?: number;
  waypoints?: string[];
  safetyNotes?: string[];
}

interface RideSuggestionsProps {
  onClose: () => void;
}

export default function RideSuggestions({ onClose }: RideSuggestionsProps) {
  const navigate = useNavigate();
  const [suggestions, setSuggestions] = useState<RideSuggestion[] | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<SuggestionFormData>({
    defaultValues: { preferredDistance: 100, difficulty: 2 },
  });

  const suggestMutation = useMutation({
    mutationFn: (data: SuggestionFormData) =>
      aiApi.getRideSuggestions({
        startLocation: data.startLocation,
        preferredDistance: data.preferredDistance ? Number(data.preferredDistance) : undefined,
        difficulty: data.difficulty ? Number(data.difficulty) : undefined,
        date: data.date || undefined,
        groupSize: data.groupSize ? Number(data.groupSize) : undefined,
      }),
    onSuccess: (response) => {
      setSuggestions(response.data?.data?.suggestions || []);
    },
    onError: () => {
      toast.error('AI service is temporarily unavailable, please try again.');
    },
  });

  const onSubmit = (data: SuggestionFormData) => {
    setSuggestions(null);
    suggestMutation.mutate(data);
  };

  const useSuggestion = (s: RideSuggestion) => {
    const routeParts: string[] = [];
    if (s.description) routeParts.push(s.description);
    if (s.waypoints?.length) routeParts.push('Waypoints:\n- ' + s.waypoints.join('\n- '));
    if (s.safetyNotes?.length) routeParts.push('Safety notes:\n- ' + s.safetyNotes.join('\n- '));

    const prefill = {
      title: s.title,
      description: s.description,
      estimatedDistance: s.estimatedDistance,
      // minutes -> hours, rounded to nearest 0.5 (RideCreate converts hours back to minutes on submit)
      estimatedDuration: s.estimatedDuration ? Math.round((s.estimatedDuration / 60) * 2) / 2 : undefined,
      difficultyLevel: s.difficulty,
      routeDescription: routeParts.join('\n\n'),
    };
    navigate('/rides/new', { state: { prefill } });
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-display font-semibold flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-hog-orange-500" />
          Suggest a Ride
        </h2>
        <button onClick={onClose} className="btn-ghost p-2" aria-label="Close suggestions">
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">
            Start Location <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            className="input w-full"
            placeholder="e.g., Downtown Dealership"
            {...register('startLocation', { required: 'Start location is required' })}
          />
          {errors.startLocation && (
            <p className="text-red-500 text-sm mt-1">{errors.startLocation.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Preferred Distance (miles)</label>
          <input type="number" className="input w-full" {...register('preferredDistance')} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Difficulty</label>
          <select className="input w-full" {...register('difficulty')}>
            <option value={1}>1 - Easy (New riders welcome)</option>
            <option value={2}>2 - Moderate</option>
            <option value={3}>3 - Intermediate</option>
            <option value={4}>4 - Challenging</option>
            <option value={5}>5 - Expert Only</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Date (optional)</label>
          <input type="date" className="input w-full" {...register('date')} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Group Size (optional)</label>
          <input type="number" className="input w-full" placeholder="e.g., 12" {...register('groupSize')} />
        </div>

        <div className="md:col-span-2 flex justify-end">
          <button type="submit" className="btn-primary" disabled={suggestMutation.isPending}>
            {suggestMutation.isPending ? 'Thinking...' : 'Suggest Routes'}
          </button>
        </div>
      </form>

      {suggestMutation.isPending && (
        <div className="text-center py-8">
          <div className="animate-spin w-8 h-8 border-2 border-hog-orange-500 border-t-transparent rounded-full mx-auto" />
        </div>
      )}

      {suggestions && suggestions.length === 0 && !suggestMutation.isPending && (
        <div className="text-center py-8 text-hog-black-400">
          No suggestions came back. Try adjusting your inputs and asking again.
        </div>
      )}

      {suggestions && suggestions.length > 0 && (
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {suggestions.map((s, idx) => (
            <div key={idx} className="bg-hog-black-800/50 rounded-lg p-4 flex flex-col">
              <h3 className="font-display font-semibold text-lg mb-2">{s.title}</h3>
              <div className="flex flex-wrap gap-2 mb-2">
                {s.estimatedDistance != null && (
                  <span className="badge-orange text-xs flex items-center gap-1">
                    <Bike className="w-3 h-3" />~{s.estimatedDistance} mi
                  </span>
                )}
                {s.estimatedDuration != null && (
                  <span className="badge-blue text-xs flex items-center gap-1">
                    <Clock className="w-3 h-3" />~{Math.round((s.estimatedDuration / 60) * 10) / 10} h
                  </span>
                )}
                {s.difficulty != null && (
                  <span className="badge-gray text-xs">Difficulty {s.difficulty}/5</span>
                )}
              </div>
              <p className="text-sm text-hog-black-400 mb-3">{s.description}</p>

              {s.waypoints && s.waypoints.length > 0 && (
                <div className="text-sm mb-2">
                  <p className="font-medium flex items-center gap-1 mb-1">
                    <MapPin className="w-4 h-4 text-hog-orange-500" />Waypoints
                  </p>
                  <ul className="list-disc list-inside text-hog-black-400 space-y-0.5">
                    {s.waypoints.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}

              {s.safetyNotes && s.safetyNotes.length > 0 && (
                <div className="text-sm mb-3">
                  <p className="font-medium mb-1">Safety Notes</p>
                  <ul className="list-disc list-inside text-hog-black-400 space-y-0.5">
                    {s.safetyNotes.map((n, i) => <li key={i}>{n}</li>)}
                  </ul>
                </div>
              )}

              <button
                onClick={() => useSuggestion(s)}
                className="btn-primary mt-auto flex items-center justify-center gap-2"
              >
                Use this ride <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck and lint**

Run (from `frontend/`):
```bash
npx tsc --noEmit && npm run lint
```
Expected: no errors. (The component is not yet imported anywhere; that is fine — `tsc` still checks it.)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/RideSuggestions.tsx
git commit -m "feat(frontend): add RideSuggestions AI panel component"
```

---

### Task 2: Wire the "Suggest a Ride" panel into the Rides page

**Files:**
- Modify: `frontend/src/pages/Rides.tsx`

- [ ] **Step 1: Add imports and toggle state**

In `frontend/src/pages/Rides.tsx`, update the lucide import line (currently
`import { Bike, Calendar, MapPin, Users, Plus, Filter } from 'lucide-react';`) to add `Sparkles`:

```tsx
import { Bike, Calendar, MapPin, Users, Plus, Filter, Sparkles } from 'lucide-react';
```

Add the component import directly below the existing `import { clsx } from 'clsx';` line:

```tsx
import RideSuggestions from '../components/RideSuggestions';
```

Inside the `Rides` function, immediately after the line `const [page, setPage] = useState(1);`, add:

```tsx
  const [showSuggestions, setShowSuggestions] = useState(false);
```

- [ ] **Step 2: Add the "Suggest a Ride" button beside "New Ride"**

In the header block, replace this existing fragment:

```tsx
        {canCreate && (
          <Link to="/rides/new" className="btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            New Ride
          </Link>
        )}
```

with:

```tsx
        {canCreate && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSuggestions((v) => !v)}
              className="btn-secondary"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Suggest a Ride
            </button>
            <Link to="/rides/new" className="btn-primary">
              <Plus className="w-4 h-4 mr-2" />
              New Ride
            </Link>
          </div>
        )}
```

- [ ] **Step 3: Render the panel**

Immediately after the closing `</div>` of the header block (the `<div className="flex items-center justify-between">...</div>`) and before the `{/* Filters */}` comment, add:

```tsx
      {canCreate && showSuggestions && (
        <RideSuggestions onClose={() => setShowSuggestions(false)} />
      )}
```

- [ ] **Step 4: Typecheck and lint**

```bash
npx tsc --noEmit && npm run lint
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Rides.tsx
git commit -m "feat(frontend): add Suggest a Ride panel toggle to Rides page"
```

---

### Task 3: Prefill the create form from a suggestion

**Files:**
- Modify: `frontend/src/pages/RideCreate.tsx`

- [ ] **Step 1: Import `useLocation` and read prefill state**

In `frontend/src/pages/RideCreate.tsx`, change the router import line
(currently `import { useNavigate } from 'react-router-dom';`) to:

```tsx
import { useNavigate, useLocation } from 'react-router-dom';
```

Inside the `RideCreate` function, replace this block:

```tsx
  const navigate = useNavigate();
  const [showRsvpOptions, setShowRsvpOptions] = useState(false);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<RideFormData>({
    defaultValues: {
      rideType: 'chapter_ride',
      difficultyLevel: 2,
      rsvpRequired: false,
    },
  });
```

with:

```tsx
  const navigate = useNavigate();
  const location = useLocation();
  const prefill = (location.state as { prefill?: Partial<RideFormData> } | null)?.prefill;
  const [showRsvpOptions, setShowRsvpOptions] = useState(false);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<RideFormData>({
    defaultValues: {
      rideType: 'chapter_ride',
      difficultyLevel: 2,
      rsvpRequired: false,
      ...prefill,
    },
  });
```

- [ ] **Step 2: Show a "prefilled from AI" banner**

In the returned JSX, locate the header block that ends with the closing `</div>` after the
`<p className="text-hog-black-400 mt-1">Plan a chapter ride or event</p>` element. Immediately
after that header `</div>` (and before `<form ...>`), add:

```tsx
      {prefill && (
        <div className="bg-hog-orange-500/10 border border-hog-orange-500/30 rounded-lg p-4 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-hog-orange-400" />
          <p className="text-sm text-hog-orange-400">
            Prefilled from an AI suggestion. Review and edit the details before creating.
          </p>
        </div>
      )}
```

Update the lucide import (currently `import { ArrowLeft, Bike } from 'lucide-react';`) to include `Sparkles`:

```tsx
import { ArrowLeft, Bike, Sparkles } from 'lucide-react';
```

- [ ] **Step 3: Typecheck and lint**

```bash
npx tsc --noEmit && npm run lint
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/RideCreate.tsx
git commit -m "feat(frontend): prefill ride create form from AI suggestion"
```

---

### Task 4: Create the `EngagementInsights` component

**Files:**
- Create: `frontend/src/components/EngagementInsights.tsx`

- [ ] **Step 1: Write the component**

Create `frontend/src/components/EngagementInsights.tsx` with this exact content:

```tsx
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Sparkles, RefreshCw, UserX, CheckCircle } from 'lucide-react';
import { aiApi } from '../lib/api';
import toast from 'react-hot-toast';

interface InactiveMember {
  id: string;
  name: string;
  daysInactive: number;
  totalRides: number;
  totalMeetings: number;
  lastRide: string | null;
  lastMeeting: string | null;
}

interface EngagementData {
  inactiveMembers: InactiveMember[];
  totalInactive: number;
  recommendations: string;
}

export default function EngagementInsights() {
  const { data, isFetching, isError, refetch } = useQuery({
    queryKey: ['engagement-analysis'],
    queryFn: async () => {
      try {
        const res = await aiApi.getEngagementAnalysis();
        return res.data.data as EngagementData;
      } catch (err) {
        toast.error('AI service is temporarily unavailable, please try again.');
        throw err;
      }
    },
    enabled: false,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  // Initial state: nothing generated yet, not loading, no error.
  if (!data && !isFetching && !isError) {
    return (
      <div className="card text-center py-12">
        <Sparkles className="w-12 h-12 text-hog-orange-500 mx-auto mb-4" />
        <h3 className="font-display font-semibold text-lg mb-2">Member Engagement Insights</h3>
        <p className="text-hog-black-400 max-w-md mx-auto mb-6">
          Generate an AI analysis of member engagement: who has gone quiet, trends, and
          recommended outreach. This makes a live AI request.
        </p>
        <button onClick={() => refetch()} className="btn-primary">
          <Sparkles className="w-4 h-4 mr-2" />
          Generate Insights
        </button>
      </div>
    );
  }

  if (isFetching) {
    return (
      <div className="card text-center py-12">
        <div className="animate-spin w-8 h-8 border-2 border-hog-orange-500 border-t-transparent rounded-full mx-auto" />
        <p className="text-hog-black-400 mt-4">Analyzing member engagement...</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="card text-center py-12">
        <p className="text-hog-black-400 mb-4">Could not load engagement insights.</p>
        <button onClick={() => refetch()} className="btn-secondary">
          <RefreshCw className="w-4 h-4 mr-2" />
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-hog-black-400">
          {data.totalInactive > 0
            ? `${data.totalInactive} member${data.totalInactive === 1 ? '' : 's'} inactive (90+ days)`
            : 'All members are actively engaged'}
        </p>
        <button onClick={() => refetch()} className="btn-secondary" disabled={isFetching}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </button>
      </div>

      {data.inactiveMembers.length > 0 ? (
        <div className="card">
          <h3 className="font-display font-semibold text-lg mb-4 flex items-center gap-2">
            <UserX className="w-5 h-5 text-hog-orange-500" />
            Inactive Members
          </h3>
          <div className="space-y-2">
            {data.inactiveMembers.map((m) => (
              <Link
                key={m.id}
                to={`/members/${m.id}`}
                className="flex items-center justify-between p-3 rounded-lg bg-hog-black-800/50 hover:bg-hog-black-800 transition-colors"
              >
                <span className="font-medium">{m.name}</span>
                <span className="text-sm text-hog-black-400">
                  {m.daysInactive >= 999 ? 'No recorded activity' : `${m.daysInactive} days inactive`}
                  {' • '}{m.totalRides} rides • {m.totalMeetings} meetings
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="card text-center py-8">
          <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-3" />
          <p className="text-hog-black-400">No inactive members flagged.</p>
        </div>
      )}

      <div className="card">
        <h3 className="font-display font-semibold text-lg mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-hog-orange-500" />
          Recommendations
        </h3>
        <p className="text-sm text-hog-black-300 whitespace-pre-wrap">{data.recommendations}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck and lint**

```bash
npx tsc --noEmit && npm run lint
```
Expected: no errors. (Not yet imported anywhere; `tsc` still checks it.)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/EngagementInsights.tsx
git commit -m "feat(frontend): add EngagementInsights AI component"
```

---

### Task 5: Add `Directory | Insights` tabs to the Members page

**Files:**
- Modify: `frontend/src/pages/Members.tsx`

- [ ] **Step 1: Add imports, auth, and tab state**

In `frontend/src/pages/Members.tsx`, update the lucide import line
(currently `import { Search, Users, Filter } from 'lucide-react';`) to add `Sparkles`:

```tsx
import { Search, Users, Filter, Sparkles } from 'lucide-react';
```

Add these imports below the existing `import { clsx } from 'clsx';` line:

```tsx
import { useAuthStore } from '../stores/authStore';
import EngagementInsights from '../components/EngagementInsights';
```

Inside the `Members` function, replace the first two state lines:

```tsx
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
```

with:

```tsx
  const { user } = useAuthStore();
  const canViewInsights = ['admin', 'director', 'officer'].includes(user?.role || '');
  const [tab, setTab] = useState<'directory' | 'insights'>('directory');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
```

- [ ] **Step 2: Add the tab bar and gate the directory content**

Replace the existing header block:

```tsx
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Members</h1>
          <p className="text-hog-black-400 mt-1">
            {members.length > 0 ? `${members.length} ${statusFilter || 'total'} members` : 'Chapter member directory'}
          </p>
        </div>
      </div>
```

with:

```tsx
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Members</h1>
          <p className="text-hog-black-400 mt-1">
            {tab === 'insights'
              ? 'AI engagement insights'
              : members.length > 0
                ? `${members.length} ${statusFilter || 'total'} members`
                : 'Chapter member directory'}
          </p>
        </div>
      </div>

      {canViewInsights && (
        <div className="flex gap-2 border-b border-hog-black-800">
          <button
            onClick={() => setTab('directory')}
            className={clsx(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === 'directory'
                ? 'border-hog-orange-500 text-hog-orange-500'
                : 'border-transparent text-hog-black-400 hover:text-hog-black-200'
            )}
          >
            <Users className="w-4 h-4 mr-2 inline" />
            Directory
          </button>
          <button
            onClick={() => setTab('insights')}
            className={clsx(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === 'insights'
                ? 'border-hog-orange-500 text-hog-orange-500'
                : 'border-transparent text-hog-black-400 hover:text-hog-black-200'
            )}
          >
            <Sparkles className="w-4 h-4 mr-2 inline" />
            Insights
          </button>
        </div>
      )}

      {tab === 'insights' && canViewInsights && <EngagementInsights />}
```

- [ ] **Step 3: Wrap the directory (filters + list) so it only shows on the directory tab**

The remaining JSX is the `{/* Filters */}` card and the `{/* Member list */}` card. Wrap
both in a `tab === 'directory'` guard. Change the opening of the Filters card from:

```tsx
      {/* Filters */}
      <div className="card">
```

to:

```tsx
      {tab === 'directory' && (
      <>
      {/* Filters */}
      <div className="card">
```

Then, at the very end of the component, change the closing of the member-list block from:

```tsx
        ) : (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-hog-black-600 mx-auto mb-4" />
            <p className="text-hog-black-400">No members found</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

to:

```tsx
        ) : (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-hog-black-600 mx-auto mb-4" />
            <p className="text-hog-black-400">No members found</p>
          </div>
        )}
      </div>
      </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Typecheck and lint**

```bash
npx tsc --noEmit && npm run lint
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Members.tsx
git commit -m "feat(frontend): add engagement Insights tab to Members page"
```

---

### Task 6: Full build + manual verification

**Files:** none (verification only)

- [ ] **Step 1: Full production build**

```bash
npm run build
```
Expected: `tsc && vite build` completes with no type errors and a successful bundle.

- [ ] **Step 2: Manual click-through**

Bring the stack up if needed (`docker-compose up -d` from repo root) and log in as an
officer/admin (`admin@chapter.local`). Verify:

1. **Rides → Suggest a Ride** (officer only): button visible beside "New Ride"; clicking
   toggles the panel; submitting the form shows a spinner then up to 3 suggestion cards
   (or the "no suggestions" message). The close (X) hides the panel.
2. **Use this ride:** clicking "Use this ride" navigates to the create form, which is
   prefilled — confirm **title**, **description**, **estimated distance**, **difficulty**,
   **route description** (with waypoints/safety notes), and that **estimated duration shows
   hours** (e.g. a 180-minute suggestion shows `3`). The orange "Prefilled from an AI
   suggestion" banner is visible.
3. **Members → Insights** (officer only): the `Directory | Insights` tabs appear; Insights
   shows the "Generate Insights" button; clicking it shows a spinner then the inactive-member
   list (rows link to member profiles) + recommendations text; "Refresh" re-runs it.
4. **Permission gating:** log in as a regular member — the "Suggest a Ride" button is hidden
   on Rides, and the Insights tab is hidden on Members (only the directory shows).

- [ ] **Step 3: Confirm no uncommitted plan-related changes remain**

```bash
git status --short
```
Expected: clean working tree for the files this plan touched (any pre-existing unrelated
working-tree changes are out of scope and left as-is).

---

## Notes for the implementer

- **Do not modify the backend or `api.ts`.** All endpoints and client methods already exist.
- **react-query v5:** use `isPending` (mutations), `isFetching`/`gcTime` (queries) — already reflected above.
- **Role sets** are intentional and mirror the backend: "Suggest a Ride" uses
  `['admin','director','officer','road_captain']` (matches `canCreate`); Insights uses
  `['admin','director','officer']` (matches the engagement endpoint's own gate, so road
  captains do not see Insights).
- **Duration round-trip:** `RideCreate` multiplies the hours field by 60 on submit, so the
  prefill divides the suggestion's minutes by 60. Keep these consistent if either changes.
