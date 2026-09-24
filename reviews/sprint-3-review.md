# Sprint 3 Review
**Verdict**: PASS
**Attempt**: 1

---

## Acceptance Criteria

### AC1: 14-day churn probability shown as a percentage
**PASS** — All cohort detail pages render the text "likely to disengage within 14 days" with a live-computed percentage. Verified on `ml-high-value-engaged` (5%), `ml-at-risk-disengaged` (4%), and `rule-1` Active Subscribers (5%). The percentage is computed from two signals: engagement frequency drop (60% weight) and quest inactivity in the last 14 days (40% weight). Range is clamped to 2–95%. Values are drawn from live SQLite queries against `engagement_signals` and `quest_progress`.

### AC2: 30-day re-engagement likelihood shown as a percentage
**PASS** — All cohort detail pages render "likely to re-engage or purchase within 30 days" with a live-computed percentage. Verified: `ml-high-value-engaged` shows 40%, computed from gap-then-return behavior in `engagement_signals` (70% weight) plus recent purchases in `purchase_history` (30% weight). Clamped to 2–95%.

### AC3: Quest completion date range for cohorts with active Quest progress
**PASS** — Cohorts with average quest completion > 20% render a date range: "Majority completing in N–M days". Verified `ml-high-value-engaged` shows "1–59 days" (50% avg completion, ~1.7%/day rate). The optimistic/pessimistic split uses min/max/avg rate percentages from `quest_progress`. Cohorts below 20% avg completion display the graceful fallback notice ("Average quest completion is below 20%") rather than unreliable numbers. Both paths tested.

### AC4: Quarterly trend indicator with projected member count
**PASS** — Every cohort detail page renders a "growing / stable / shrinking" label plus "projected N members in 90 days". Verified on all five ML cohorts. The ratio uses `engagement_signals` count in the last 30 days vs. 31–90 days ago. All cohorts currently show "stable" because the seeded data spans only 7 days (all signals fall within the 30-day window, producing olderCount=0; the code correctly defaults ratio=1, trend=stable). This is correct behavior for the available data, not a bug.

### AC5: Confidence level shown on every forecast
**PASS** — Every forecast card renders a color-coded confidence badge. `ml-high-value-engaged` (2,028 members, multiple pipeline runs) shows "High confidence" (emerald) on all four forecasts. `ml-at-risk-disengaged` (484 members) shows "Medium confidence" (amber). `rule-6` (147 members, Tiny Elite) shows "Medium confidence". Logic: >=500 members + >=3 runs = High; >=100 members or >=2 runs = Medium; otherwise Low.

### AC6: Forecasts refresh on each page load (not hardcoded)
**PASS** — `export const dynamic = 'force-dynamic'` is set in `app/dashboard/cohorts/[id]/page.tsx`. `computeForecasts()` is called server-side on every request. The `computedAt` ISO timestamp differs between sequential requests to the same page: first load `2026-04-10T10:58:43.194Z`, second load `2026-04-10T10:59:04.764Z`. The "Refreshed HH:MM" display is rendered from `new Date(forecasts.computedAt).toLocaleTimeString()`. No hardcoded forecast values detected anywhere in the codebase.

### AC7: Clicking a forecast shows top 3 driving signals
**PASS (code-verified)** — The ForecastPanel is a `'use client'` component using `useState(false)` for each `ForecastCard`. A `<button onClick={() => setExpanded(prev => !prev)}>` wraps the card header. When `expanded && signals.length > 0`, a `<ul>` renders `signals.slice(0, 3)` with `signal.label` and `signal.detail` for each entry. All four forecasts receive exactly 3 signals from `forecasting.ts` (verified by code inspection). The page renders the instruction "Click any forecast to see the top 3 driving signals" in the panel header. Cannot test click interaction via curl (requires browser JS), but the wiring is fully correct and complete.

### AC8: Cohorts with fewer than 50 members show "too small to forecast" notice
**PASS** — Tested with two small cohorts: `rule-8` (23 members, "High Spenders Small") and `rule-7` (0 members, "Ultra Tiny"). Both render the "Too small to forecast" notice with the explanation "Forecasting requires at least 50 members to produce statistically meaningful predictions." No forecast cards appear. The 147-member cohort (`rule-6`) correctly shows forecast cards instead. The `computeForecasts()` function checks `memberCount < 50` and returns `tooSmall: true` with all forecast fields set to `null` before any DB queries run.

---

## Sprint 1 and 2 Integration

All Sprint 1 and 2 functionality remains intact:
- Login page renders correctly at `/login`
- All role-based dashboards load (`/dashboard/admin`, `/dashboard/cohorts`)
- `GET /api/cohorts` returns cohorts with member counts
- `POST /api/cohorts` creates new cohorts (tested, returned correct `memberCount`)
- `PUT /api/cohorts/:id` updates cohort name and conditions (verified)
- `DELETE /api/cohorts/:id` removes cohorts (verified)
- ML cohort detail pages retain all existing sections (member count card, behavioral signals, data note)
- Rule-based cohort detail pages retain edit/delete functionality and conditions view

---

## Quality Scores

- **Functionality**: 5/5 — All four forecast types computed from live SQL queries with no hardcoded values. All AC text strings verified in server-rendered HTML. Timestamp proves per-request recomputation.
- **Robustness**: 5/5 — Edge cases handled: <50 members shows notice instead of forecasts; quest completion <20% shows graceful fallback; empty customer ID arrays guarded; olderCount=0 defaults ratio to 1 (stable); all values clamped to valid ranges.
- **Integration**: 5/5 — All Sprint 1 and Sprint 2 routes, APIs, and UI sections remain fully functional. No regressions detected across login, cohort list, ML cohorts, and rule-based cohort CRUD.
