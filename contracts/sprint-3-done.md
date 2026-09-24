# Sprint 3 Contract — Behavior Forecasting

**Status:** Complete  
**Build:** `pnpm build` passes with 0 errors

---

## What was built

### New files

- **`lib/forecasting.ts`** — Server-side forecasting engine. Computes four multi-horizon behavioral predictions from live SQLite data using statistical heuristics. No hardcoded values.
- **`components/ForecastPanel.tsx`** — Client component rendering all four forecast cards with expandable accordion to show top 3 driving signals per forecast.

### Modified files

- **`app/dashboard/cohorts/[id]/page.tsx`** — Both ML and rule-based cohort detail routes now compute forecasts server-side before rendering, passing `CohortForecasts` to the respective components.
- **`app/dashboard/cohorts/[id]/CohortDetailClient.tsx`** — Accepts optional `forecasts` prop and renders `<ForecastPanel>` between the stats and cohort rules sections.

---

## Acceptance criteria fulfilled

1. **14-day churn probability** — Displayed as `"72% likely to disengage within 14 days"`. Computed from % of members with engagement event counts below 50% of their historical weekly baseline (60%) and % with no quest activity in last 14 days (40%). Range clamped to 2–95%.

2. **30-day re-engagement likelihood** — Displayed as `"X% likely to re-engage or purchase within 30 days"`. Computed from % of members showing gap-then-return patterns in engagement_signals (7+ day gaps, 70% weight) plus % with recent purchases (30% weight).

3. **Quest completion date range** — Shown when cohort average quest completion > 20%. Projects earliest/latest days-to-100% using optimistic and pessimistic completion rate ranges derived from `quest_progress` started_at/last_activity_at/completion_percentage.

4. **Quarterly trend** — Shows "growing / stable / shrinking" plus projected member count in 90 days. Based on ratio of active members last 30 days vs 31–90 days ago in `engagement_signals`. Compounded projection to 90 days.

5. **Confidence level** — Every forecast card shows a color-coded badge:
   - **High**: ≥500 members and ≥3 pipeline runs (emerald)
   - **Medium**: ≥100 members or ≥2 runs (amber)
   - **Low**: <100 members or 1 run (rose)
   - **Too small**: <50 members (gray — whole panel replaced with notice)

6. **Forecasts refresh daily** — All forecasts are computed server-side on every page load (`export const dynamic = 'force-dynamic'`). The refresh timestamp is displayed in the panel header.

7. **Clicking shows top 3 signals** — Each forecast card is an expandable accordion button. Clicking it reveals the 3 driving signals as bullet points with label + detail text.

8. **Too-small notice** — Cohorts with fewer than 50 members see a centered "Too small to forecast" notice with explanation instead of forecast cards.

---

## Forecasting heuristics (data sources)

| Forecast | Data source | Heuristic |
|----------|-------------|-----------|
| 14-day churn | `engagement_signals`, `quest_progress` | % members with recent events < 50% of historical weekly avg + % with no quest activity in 14 days |
| 30-day re-engagement | `engagement_signals`, `purchase_history` | % members with 7+ day engagement gaps who returned + % with recent purchases |
| Quest completion | `quest_progress` | Remaining completion % / current rate per day → optimistic and pessimistic range |
| Quarterly trend | `engagement_signals`, `pipeline_runs` | Active members last 30d vs 31–90d ago → growth ratio compounded to 90 days |

---

## Sprint 1–2 preservation

- All existing routes, API handlers, clustering, DB functions, sidebar nav, login, and role dashboards are unchanged.
- ML cohort detail page retains all existing sections (member count, behavioral signals, data note).
- Rule-based cohort detail page retains edit, delete, and conditions view.
