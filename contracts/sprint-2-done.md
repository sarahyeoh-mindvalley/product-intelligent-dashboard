# Sprint 2 Contract — Cohort Identification Engine

**Status:** Complete  
**Build:** `pnpm build` passes with 0 errors

---

## What Was Built

### Database

- Added `rule_cohorts` table to `data/cohorts.db` (created on first use via `lib/db.ts` schema init)
  - Columns: `id INTEGER PRIMARY KEY`, `name TEXT`, `conditions TEXT` (JSON array), `created_at TEXT`, `updated_at TEXT`

### ML Clustering — `lib/clustering.ts`

- Server-side k-means (k=5) clustering in TypeScript with no external ML libraries
- Features per customer: avg engagement events/week, avg quest completion %, subscription tier level (0–4), total purchase amount, days since last activity
- Min-max normalization before clustering; deterministic centroid initialization (k-means++ variant)
- Named clusters (mapped by behavioral profile score):
  - **High-Value Engaged** — high engagement, active purchasers
  - **Quest Graduates** — near or past quest completion
  - **At-Risk Disengaged** — low recent activity, disengaging
  - **New Joiners** — recent starts, low quest completion
  - **Passive Subscribers** — active subscription, low engagement
- Results cached server-side for 1 hour
- Falls back to zero-member cohorts when no pipeline data exists

### Pages

#### `/dashboard/cohorts` — Cohort List

- Displays 5 ML-identified cohorts (auto-detected, no analyst configuration) with name, member count, and one-line behavioral summary
- Displays all analyst-defined rule-based cohorts with name, member count, and rendered condition pills
- Client-side search bar filters both ML and rule cohort lists by name
- "Create Cohort" button opens a modal form

#### `/dashboard/cohorts/[id]` — Cohort Detail

- Route format: `ml-<slug>` for ML cohorts (e.g. `ml-high-value-engaged`), `rule-<id>` for rule-based (e.g. `rule-1`)
- ML detail: shows member count, behavioral summary, centroid-derived top signals (avg quest completion, avg weekly engagement, most common tier, avg lifetime purchases, avg days since last activity), and explanation of data sources
- Rule detail: shows member count, condition count, inline edit form (name + conditions), and metadata (created/updated timestamps)

### API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/cohorts` | List all rule cohorts with live member counts |
| POST | `/api/cohorts` | Create a new rule cohort |
| GET | `/api/cohorts/[id]` | Get single rule cohort with live member count |
| PUT | `/api/cohorts/[id]` | Update a rule cohort's name and conditions |
| DELETE | `/api/cohorts/[id]` | Delete a rule cohort |

### Rule Cohort Conditions

Available fields: `quest_completion_pct`, `subscription_tier`, `total_purchases`, `days_since_activity`, `event_count_30d`  
Available operators: `gt`, `lt`, `eq`, `gte`, `lte`

`event_count_30d` filters on engagement events from the last 30 days.

### Sidebar Navigation

`/dashboard/cohorts` added to sidebar nav under "Cohorts" section, visible for all roles.

---

## Acceptance Criteria Verification

1. ✅ Dashboard displays ML cohorts with name, member count, and one-line behavioral summary
2. ✅ ML cohorts appear without analyst configuration — auto-discovered from data via k-means
3. ✅ Analyst can create a rule-based cohort with at least one condition and save with a name
4. ✅ Newly created cohort appears immediately in the cohort list (optimistic state update)
5. ✅ Clicking any cohort opens a detail view with member count, top behavioral signals, and key data driving the segment
6. ✅ Analyst can edit a rule-based cohort's conditions; updated segment reflects immediately via PUT API
7. ✅ Analyst can delete a rule-based cohort; removed from list immediately via DELETE API
8. ✅ Member counts recalculated on each page load via `export const dynamic = 'force-dynamic'` and `evaluateCohortMemberCount()`
9. ✅ Cohort list is searchable by name (client-side filter, no server round-trip)

---

## Files Changed / Created

- `lib/db.ts` — Added `rule_cohorts` table schema; CRUD functions; `evaluateCohortMemberCount()` with `event_count_30d` (30-day window); removed `type` field from `Cohort` interface
- `lib/clustering.ts` — Full k-means implementation; cluster name updated to "At-Risk Disengaged"; slug updated to `at-risk-disengaged`
- `app/dashboard/cohorts/page.tsx` — Server component; fetches ML cohorts + rule cohorts with live counts
- `app/dashboard/cohorts/CohortsClient.tsx` — Client component; search, create/edit/delete modal, ML and rule cohort cards
- `app/dashboard/cohorts/[id]/page.tsx` — Server component; routes `ml-<slug>` and `rule-<id>`; renders ML or rule detail
- `app/dashboard/cohorts/[id]/CohortDetailClient.tsx` — Client component; inline edit and delete for rule cohorts
- `app/api/cohorts/route.ts` — GET + POST handlers
- `app/api/cohorts/[id]/route.ts` — GET + PUT + DELETE handlers
- `components/Sidebar.tsx` — "All Cohorts" nav link added under Cohorts section
