# Sprint 1 Contract — Data Pipeline + App Foundation

**Sprint**: 1 of 5
**Status**: Complete (Retry 2 — fixes applied)
**Build**: `pnpm build` passes with 0 errors

---

## What Was Built

### Next.js Application Shell

- **Framework**: Next.js 16.2.3 (App Router) + TypeScript + Tailwind CSS v4
- **Package manager**: pnpm
- **Root route** (`/`): Redirects to dashboard if session exists, otherwise to `/login`
- **Login page** (`/login`): Clean login form — user enters their name and selects a role (Marketing, Content, Product, Admin). Uses cookie-based session. No OAuth, no passwords.
- **Dashboard layout** (`/dashboard/*`): Shared layout with a dark sidebar nav. All dashboard routes are protected — unauthenticated requests redirect to `/login`.
- **Role dashboards**:
  - `/dashboard/marketing` — Marketing team view
  - `/dashboard/content` — Content team view
  - `/dashboard/product` — Product team view
  - `/dashboard/admin` — Pipeline monitoring and run history

### Data Pipeline

- **Script**: `scripts/pipeline.ts` — run with `pnpm pipeline`
- **Database**: SQLite via `better-sqlite3`, stored at `data/cohorts.db`
- **Sources ingested per run**:
  1. **Purchase history** (~1,200–1,400 records): product names drawn from real Mindvalley Quest/product names, amounts, categories, purchase dates
  2. **Quest progress** (~3,200–3,600 records): quest names, categories, completion percentages (0–100%), last activity, start dates
  3. **Engagement signals** (~8,000–9,000 records): 15 event types (video_play, lesson_complete, community_post, meditation_session, etc.) across 5 sources (web, iOS, Android, email, push)
  4. **Subscription tiers** (~2,700–2,900 records): Free / Plus / Tribe / All Access / All Access + Live tiers with renewal dates and active status

- **Freshness tracking**: each run creates a `pipeline_runs` row with `run_date`, `completed_at`, and `status`. All source records reference their originating run via `pipeline_run_id`.
- **Record variance**: daily counts vary deterministically based on a date seed so consecutive runs show different numbers, simulating real data drift.

### Key UI Components

| Component | Purpose |
|-----------|---------|
| `Sidebar` | Dark left nav with role switcher — no re-login required when switching roles |
| `DataFreshnessBanner` | Shows "Data as of [date]" when pipeline has run; shows visible "data unavailable" warning when it hasn't |
| `DashboardHeader` | Page header shared by all role views; includes freshness indicator |
| `RunPipelineButton` | Admin page button to trigger a pipeline run in-browser |

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/auth/login` | POST | Set session cookie with name + role |
| `/api/auth/logout` | POST | Clear session cookie |
| `/api/pipeline/status` | GET | Return latest run + source counts (JSON) |
| `/api/pipeline/run` | POST | Trigger a pipeline run via the admin UI |

---

## Decisions Made

1. **Auth approach**: Cookie-based session with base64-encoded JSON. No JWT signing or OAuth — the sprint spec called for simple in-memory/cookie auth. Session persists 7 days. Role switching reuses the same cookie mechanism, no re-login needed.

2. **Separated `auth.ts` from `session.ts`**: `next/headers` (used for reading cookies) is only available in Server Components. Shared types and utilities (`roleToPath`, `encodeSession`, `VALID_ROLES`) live in `lib/auth.ts` which is importable from both server and client code. The `getSession()` function that reads cookies lives in `lib/session.ts` and is only imported by server components.

3. **SQLite via better-sqlite3**: Synchronous API fits well with Next.js App Router server components. `pnpm-workspace.yaml` was updated to add `better-sqlite3` and `esbuild` to `onlyBuiltDependencies` so native builds run correctly.

4. **Pipeline runs accumulate**: Each `pnpm pipeline` invocation creates a new `pipeline_runs` record. Source tables grow with each run (records are keyed to their run). The admin view shows per-run counts from the last 10 runs, so admins can see record growth over time.

5. **Mock data is date-seeded**: Daily variance uses `Math.sin(seed)` to give consistent-looking variation per day without pure randomness causing identical counts on back-to-back runs within the same day.

6. **`pnpm pipeline` command**: Uses `tsx` directly (`tsx scripts/pipeline.ts`) rather than `node --import tsx/esm`, which caused cycle errors with Node 25.

---

## Fixes Applied in Retry 2

1. **AC3 — Freshness indicator now shows yesterday's date**: `scripts/pipeline.ts` calculates `run_date` as yesterday (`new Date(); yesterday.setDate(yesterday.getDate() - 1)`), so the banner correctly displays the data vintage (prior day) rather than today.

2. **AC6 — Admin record counts grow on same-day re-runs**:
   - Seed now includes a time-based component (`Date.now() % 10000`) so each pipeline run within the same day produces different record counts.
   - Admin view now shows **cumulative totals** across all pipeline runs (`getCumulativeSourceCounts()`) instead of the latest run only, so counts visibly increase after each run.

3. **AC8 — Dashboard usable on mobile (375px+)**:
   - `Sidebar` component now hides on `< sm` breakpoint and replaces itself with a fixed top bar containing a hamburger button.
   - Hamburger opens a slide-in sidebar overlay with a backdrop.
   - Desktop sidebar unchanged (always visible on `sm` and above).
   - Dashboard layout adds `pt-12` on mobile to account for the fixed top bar, removing to `sm:pt-0` on desktop.

4. **Lint fixes**:
   - `react/no-unescaped-entities` in `app/dashboard/admin/page.tsx`: replaced `"Run Pipeline Now"` with `&ldquo;Run Pipeline Now&rdquo;`.
   - Unused `err` variable in `components/RunPipelineButton.tsx`: renamed to `_err`.

## Known Limitations

1. **No real data source connections**: All four sources are simulated with random data generators. Real Mindvalley system connections will require Sprint 2+ work on data contracts.

2. **In-browser pipeline trigger**: The `/api/pipeline/run` route shells out to `tsx` using the path in `node_modules/.bin/`. This works in dev but is not suitable for production deployments — a proper job queue or cron trigger would replace this.

3. **No session expiry enforcement on the server**: Session expiry is handled only by the cookie `maxAge`. There is no server-side session store or revocation mechanism.

4. **SQLite is single-writer**: Acceptable for daily batch ingestion; not suitable for concurrent writes in production.

5. **Sprint 1 dashboard views are shells**: Marketing, Content, and Product dashboards show pipeline health metrics and "available in Sprint 2/3/4" placeholders for cohort-specific content. This is by design — cohort identification is Sprint 2.
