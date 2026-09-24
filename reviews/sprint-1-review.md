# Sprint 1 Review
**Verdict**: PASS
**Attempt**: 2

---

## Acceptance Criteria

### AC1: The app loads in a browser and displays a login screen
**PASS** — `pnpm build` completed with 0 errors and 0 TypeScript failures (all 11 routes compiled, including 9 dynamic server-rendered). Dev server started on port 3099. `GET /` returned HTTP 307 redirecting to `/login`. `GET /login` returned HTTP 200 with fully-rendered login screen containing: name input field, 4 role selector buttons (Marketing, Content, Product, Admin) with descriptions, and an "Access Dashboard" submit button. Confirmed via `curl http://localhost:3099/login`.

### AC2: After logging in, a user selects their role and is routed to a dashboard layout specific to that role
**PASS** — `POST /api/auth/login` with `{"name":"Test User","role":"Marketing"}` returned `{"ok":true,"redirectTo":"/dashboard/marketing"}` and set the `mv_session` cookie. Each of the four dashboard routes (`/dashboard/marketing`, `/dashboard/content`, `/dashboard/product`, `/dashboard/admin`) returned HTTP 200 with authenticated cookie, each rendering a distinct page title and role-specific layout and content. Unauthenticated requests to `/dashboard/marketing` returned HTTP 307 redirect to `/login`.

### AC3: Each dashboard displays a "Data as of [date]" freshness indicator showing the prior day's date
**PASS** — `scripts/pipeline.ts` now calculates `run_date` using yesterday's date: `const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1); const runDate = yesterday.toISOString().split('T')[0]`. When run on 2026-04-10, `run_date` stored as `2026-04-09`. The live marketing dashboard confirmed: `Data as of <strong class="text-slate-700">Thursday, April 9, 2026</strong>` — correctly showing the prior day (yesterday = April 9, today = April 10). This was the fix from Attempt 1 failure and is verified working.

### AC4: If the data pipeline has not run or fails, the dashboard displays a visible "data unavailable" warning instead of showing stale or empty charts
**PASS** — `DataFreshnessBanner` renders a visible amber warning box with the message **"Data unavailable — the pipeline has not run yet or encountered an error. Charts will update after the next successful pipeline run."** when `status` is `'no_data'` or `'error'`. `getPipelineStatus()` in `lib/pipeline-status.ts` returns `no_data` when no successful run exists (null latestRun), and `error` on DB exceptions (try/catch block). Both paths confirmed in source code. The admin page also independently shows "No pipeline runs yet" placeholder when `allRuns.length === 0`.

### AC5: An admin view shows ingested record counts for each data source: purchase history, Quest progress, engagement signals, and subscription tier
**PASS** — `GET /dashboard/admin` returned HTTP 200 with all four source cards rendered with actual cumulative counts: **7,931** (Purchase History), **21,378** (Quest Progress), **53,443** (Engagement Signals), **17,289** (Subscription Tiers). Source counts shown are cumulative totals from `getCumulativeSourceCounts()` in `lib/db.ts`, with label "Total records (all runs)". A per-run history table also shows individual per-run record counts for the last 10 runs. All four source names confirmed in rendered HTML.

### AC6: Record counts in the admin view increase after each daily pipeline run
**PASS** — Two consecutive pipeline runs on the same day (2026-04-10) produced visibly different per-run counts due to the time-based seed component (`DAILY_SEED = ... + (Date.now() % 10000)`): Run 5: 1,347 / 3,596 / 8,989 / 2,898; Run 6: 1,348 / 3,598 / 8,994 / 2,899. The admin view now shows **cumulative totals** via `getCumulativeSourceCounts()`, so after each run the displayed totals grow: cumulative before run 6 was 6,583 / 17,780 / 44,449 / 14,390; cumulative after run 6 was 7,931 / 21,378 / 53,443 / 17,289 — confirmed by directly querying `cohorts.db`. The label explicitly reads "Total records (all runs)" so the cumulative intent is visible to the user.

### AC7: Navigating between role views (Marketing → Content → Product) does not require re-login
**PASS** — The `Sidebar` component's `switchRole()` function calls `POST /api/auth/login` with the existing `session.name` and new role, updating the `mv_session` cookie without any password prompt or re-authentication screen. Tested: established a Marketing session, called the login API with `role=Content`, confirmed `GET /dashboard/content` returned HTTP 200 with the same cookie — no re-login step required. The role switch is purely a cookie update, confirmed in `app/api/auth/login/route.ts`.

### AC8: The app is accessible on both desktop and mobile browser at a minimum readable width
**PASS** — `Sidebar.tsx` now implements full mobile responsiveness: on `< sm` viewports (below 640px), the desktop sidebar is hidden (`hidden sm:flex` at line 220) and replaced with a fixed top bar containing a hamburger button (`sm:hidden fixed top-0` at line 182). The hamburger opens a slide-in sidebar overlay (`sm:hidden fixed ... w-64 transform transition-transform duration-200`) with a semi-transparent backdrop. Closing the overlay is supported via close button and backdrop click. `app/dashboard/layout.tsx` adds `pt-12` on mobile to account for the fixed top bar (`pt-12 sm:pt-0` at line 18), preventing content from being occluded. Desktop behavior (always-visible sidebar) is unchanged. `width=device-width, initial-scale=1` viewport meta confirmed in rendered HTML.

---

## Quality Scores
- **Functionality**: 4/5 — All 8 acceptance criteria pass end-to-end. Core auth, routing, role switching, pipeline ingestion, freshness indicator (correct prior-day date), data unavailable warning, admin record counts, and mobile layout all work. Minor deduction: the in-browser pipeline trigger uses `execSync` shelling out to `tsx` (noted as a known limitation), which is fragile in dev and not production-ready.
- **Robustness**: 3/5 — Error handling is present for login validation (empty name, invalid role), pipeline failures (DB error caught → `'error'` status displayed), and cookie parsing (try/catch in `getSession`). The `getCumulativeSourceCounts()` in db.ts has no error handling — a DB failure there would propagate an unhandled exception from the Admin page server component. The time-based seed (`Date.now() % 10000`) is good enough for demo purposes but counts can still be very close on near-simultaneous runs (as seen: 1,347 vs 1,348 purchases). No session revocation mechanism exists (acceptable per known limitations).
- **Integration**: 4/5 — All components wire together cohesively: login → cookie → layout guard → role dashboard → pipeline status → freshness banner. DB, pipeline script, API routes, and UI form a consistent data flow with no broken imports or missing modules. Build is clean with 0 TypeScript or compilation errors.
