# Sprint Plan — Mindvalley Customer Cohorts

Generated from: `prd/mindvalley-customer-cohorts.md`
Date: 2026-04-10

---

## Sprint 1 — Data Pipeline + App Foundation

**Goal**: Ingest multi-source customer data into a unified daily feed and stand up a runnable app shell with role-based navigation.

**Capabilities delivered**:
- Daily batch ingestion from four data sources: purchase history, Quest progress, engagement signals, subscription tier
- Unified data store with freshness tracking
- Web application shell with login and role-based routing (Marketing, Content, Product)

**Acceptance criteria**:
1. The app loads in a browser and displays a login screen
2. After logging in, a user selects their role (Marketing, Content, or Product) and is routed to a dashboard layout specific to that role
3. Each dashboard displays a "Data as of [date]" freshness indicator showing the prior day's date
4. If the data pipeline has not run or fails, the dashboard displays a visible "data unavailable" warning instead of showing stale or empty charts
5. An admin view shows ingested record counts for each data source: purchase history, Quest progress, engagement signals, and subscription tier
6. Record counts in the admin view increase after each daily pipeline run
7. Navigating between role views (Marketing → Content → Product) does not require re-login
8. The app is accessible on both desktop and mobile browser at a minimum readable width

**Dependencies**: None — this is the foundation sprint.

---

## Sprint 2 — Cohort Identification Engine

**Goal**: Surface automatically identified and analyst-defined customer cohorts in the dashboard.

**Capabilities delivered**:
- ML-driven cohort clustering from ingested behavioral data
- Analyst UI for defining and managing rule-based cohorts
- Cohort list and detail views

**Acceptance criteria**:
1. The dashboard displays a list of automatically identified cohorts, each with a name, member count, and a one-line behavioral summary (e.g., "High engagement, near Quest completion — 3,400 members")
2. ML-identified cohorts appear without any analyst configuration — they are discovered automatically from the data
3. An analyst can create a rule-based cohort by defining at least one condition (e.g., "Quest progress greater than 80%") and saving it with a name
4. A newly created rule-based cohort appears in the cohort list within 24 hours of the next daily data refresh
5. Clicking any cohort opens a detail view showing member count, top behavioral signals, and the key data driving the segment
6. An analyst can edit an existing rule-based cohort's conditions and the updated segment is reflected after the next daily refresh
7. An analyst can delete a rule-based cohort; it is removed from the list immediately
8. Cohort member counts update daily as customers move between segments
9. The cohort list is searchable by name

**Dependencies**: Sprint 1 (data pipeline must be running)

---

## Sprint 3 — Behavior Forecasting

**Goal**: Each cohort displays multi-horizon behavioral predictions so teams know what is likely to happen before it does.

**Capabilities delivered**:
- 14–30 day churn and re-engagement likelihood per cohort
- 30+ day Quest completion trajectory per cohort
- Quarterly cohort growth/decline trend
- Confidence indicators on all forecasts

**Acceptance criteria**:
1. Each cohort detail view shows a 14-day churn probability expressed as a percentage (e.g., "72% likely to disengage within 14 days")
2. Each cohort detail view shows a 30-day re-engagement or next-purchase likelihood expressed as a percentage
3. Cohorts with members actively progressing through a Quest show a projected completion date range for the majority of those members
4. Each cohort detail view shows a quarterly trend indicator: whether the cohort is growing, stable, or shrinking, with a projected member count
5. Every forecast displays a confidence level (e.g., High / Medium / Low) alongside the prediction
6. Forecasts refresh daily — values visibly change as new data arrives
7. Clicking on a forecast shows the top 3 signals driving that prediction (e.g., "Login frequency down 40% over 14 days")
8. A cohort with fewer than 50 members displays a "too small to forecast" notice rather than an unreliable prediction

**Dependencies**: Sprint 2 (cohorts must be identified before forecasts can be attached to them)

---

## Sprint 4 — Feature Release Impact Forecasting

**Goal**: Connect product feature releases to cohort and KPI changes, both retrospectively and as forward-looking projections.

**Capabilities delivered**:
- Feature release log with historical entries from Mindvalley's existing release data
- Post-release attribution: KPI/cohort impact of past releases
- Pre-release forecasting: projected KPI/cohort impact of planned features

**Acceptance criteria**:
1. The product team dashboard displays a feature release log listing past releases with their dates and descriptions
2. Selecting a past release shows a before/after KPI comparison (WAU, weekly retention rate, revenue) for the 30-day window around the release date
3. The post-release attribution view identifies which cohorts were most positively and most negatively impacted by a selected release
4. An analyst can add a planned future feature release by entering a name, description, and target date
5. Selecting a planned release shows a forecasted impact on WAU, retention rate, and revenue, broken down by cohort
6. Pre-release forecasts display the number of historical releases used to generate the projection and their average accuracy
7. The product team dashboard shows planned features ranked by projected net cohort impact score, highest first
8. Post-release attribution clearly distinguishes between correlation and directional signal — it does not claim causation without sufficient data

**Dependencies**: Sprint 3 (cohort forecasts must exist before release impact can be overlaid on them)

---

## Sprint 5 — Recommendation Engine + Role-Based Dashboard

**Goal**: Each role sees tailored, actionable recommendations derived from cohort insights and forecasts, with an act-on tracking mechanism.

**Capabilities delivered**:
- Role-specific recommendation generation (Marketing, Content, Product)
- Projected impact displayed alongside each recommendation
- Recommendation act-on tracking
- Aggregate act-on rate metric visible to all roles

**Acceptance criteria**:
1. The Marketing dashboard shows cohorts ranked by intervention potential, each labeled with a recommended action type (Reactivation, Upsell, or Win-back)
2. Each marketing cohort recommendation displays a projected revenue impact range (e.g., "+$18K–$32K if 30% of cohort converts")
3. The Content dashboard shows cohorts with unmet content needs, each displayed as a content gap brief (e.g., "Quest-completing cohort — 3,400 users — no next Quest recommended")
4. Each content gap shows the cohort size and an estimated engagement opportunity if the gap is filled
5. The Product dashboard shows planned features ranked by projected cohort impact score with the top impacted cohort named for each feature
6. The Product dashboard shows a "Top wins from past releases" section listing the 3 releases with the strongest positive cohort impact
7. Every recommendation links back to the cohort detail view and the forecast that generated it
8. A user can mark any recommendation as "Acted On" with a single click; the recommendation is visually marked and logged with a timestamp
9. A dashboard-wide act-on rate metric (acted-on recommendations ÷ total surfaced recommendations × 100) is visible on all three role views
10. Recommendations older than 30 days without an act-on are automatically marked as "Expired" and removed from the active list

**Dependencies**: Sprints 3 and 4 (recommendations synthesize both behavior forecasts and release impact signals)

---

## Dependency Graph

```
Sprint 1 (Data Pipeline + App Shell)
    └── Sprint 2 (Cohort Identification)
            └── Sprint 3 (Behavior Forecasting)
                    └── Sprint 4 (Feature Release Impact)
                            └── Sprint 5 (Recommendation Engine + Dashboard)
```

All sprints are sequential. Each sprint requires the prior sprint to be functional before work begins.

---

## Build Notes

- **Data sources**: purchase history, Quest progress, engagement signals, subscription tier — all from existing Mindvalley systems, daily batch cadence
- **"Same-day insights"** means data from the prior day, refreshed each morning — not real-time
- **No external integrations in v1**: the product stops at the recommendation; users execute in their own tools
- **ML models**: cohort clustering and behavior forecasting — data scientists own the models; analysts configure cohort rules via the dashboard
- **Feature release history**: existing Mindvalley release data is the training set for pre-release forecasting; data quality may require cleanup before Sprint 4
