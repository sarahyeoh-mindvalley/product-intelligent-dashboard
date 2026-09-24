# Sprint 4 — Feature Release Impact Forecasting

## Status: Complete

## What was built

### New database tables
- `feature_releases` — stores past and planned feature releases with id, name, description, release_date, status (released/planned), created_at
- `release_cohort_impacts` — stores per-release, per-cohort impact scores with cohort_id, cohort_type, impact_score, direction, created_at
- Both tables are created in `lib/db.ts` via `initSchema()` on first DB access

### Seeded data
8 historical Mindvalley feature releases seeded automatically on first use via `seedFeatureReleases()`:
- Quest Streak Reminders (82 days ago)
- Community Feed Redesign (70 days ago)
- Offline Download Support (58 days ago)
- Personalized Quest Recommendations (47 days ago)
- Live Session Calendar Integration (35 days ago)
- Progress Milestone Badges (24 days ago)
- AI-Powered Journal Prompts (14 days ago)
- Peer Accountability Groups (6 days ago)

### New library: `lib/releases.ts`
- `computeReleaseKpiComparison(releaseDate)` — computes WAU, retention, revenue before/after 30-day windows
- `computeCohortImpacts(releaseDate)` — compares avg engagement per ML cohort member before vs after release date; ranked by delta
- `computeForecastAccuracy()` — counts historical releases, computes average accuracy from KPI delta variance
- `computePlannedReleaseForecast(releaseId)` — projects WAU/retention/revenue change using historical averages; breaks down by cohort
- `getRankedPlannedReleases()` — returns planned releases sorted by net weighted cohort impact score

### New API routes
- `GET /api/releases` — list all releases
- `POST /api/releases` — create a new planned release (name, description, release_date, status)
- `GET /api/releases/[id]` — get full release detail including KPI comparison (released) or forecast (planned)

### New pages
- `/dashboard/releases` — lists past releases (release log) and planned releases ranked by net cohort impact; includes "Add Planned Release" form
- `/dashboard/releases/[id]` — release detail page showing:
  - For released: before/after KPI cards (WAU, retention %, revenue) + causation disclaimer
  - For planned: forecasted KPI change cards + accuracy metadata
  - For all: cohort attribution / forecasted cohort impact sorted by impact score; top 2 positive and top 2 negative highlighted

### Updated product dashboard (`/dashboard/product`)
- Replaced placeholder with live feature prioritization table (planned features ranked by impact score)
- Quick-stat cards: past release count, planned count, forecast accuracy, data source status
- Recent releases list with links to detail pages

### Updated Sidebar
- Added "Product" section with "Releases" nav link pointing to `/dashboard/releases`

## Acceptance criteria checklist

1. Feature release log displays on product dashboard and /dashboard/releases — **done**
2. Selecting a past release shows before/after KPI comparison (WAU, retention, revenue) for 30-day window — **done**
3. Post-release attribution identifies top 2 positively and top 2 negatively impacted cohorts — **done**
4. Analyst can add a planned future release via form (name, description, target date) — **done**
5. Selecting a planned release shows forecasted WAU/retention/revenue impact by cohort — **done**
6. Pre-release forecasts display historical release count and average accuracy — **done**
7. Product dashboard shows planned features ranked by projected net cohort impact score — **done**
8. Post-release attribution clearly labels results as directional signal, not proven causation — **done** (amber warning banners on KPI comparison and cohort attribution sections)

## Build
`pnpm build` passes with 0 errors. All 18 routes generated successfully.
