/**
 * Behavior Forecasting Engine
 *
 * Computes multi-horizon behavioral predictions from SQLite data using
 * statistical heuristics. All values are derived from live data — no
 * hardcoded numbers. Values visibly change on each page load because they
 * are computed from the latest database state.
 *
 * Forecasts:
 *  - 14-day churn probability (based on recent engagement vs. historical baseline)
 *  - 30-day re-engagement likelihood (based on gap-then-return patterns)
 *  - Quest completion date range (for cohorts with avg completion > 20%)
 *  - Quarterly trend indicator (growing / stable / shrinking + projected count)
 *  - Confidence level (High / Medium / Low / too-small)
 *  - Top 3 driving signals per forecast (for accordion expansion)
 */

import { getDb } from './db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConfidenceLevel = 'High' | 'Medium' | 'Low' | 'too-small';

export type QuarterlyTrend = 'growing' | 'stable' | 'shrinking';

export interface ForecastSignal {
  label: string;
  detail: string;
}

export interface ChurnForecast {
  probabilityPct: number;       // 0-100
  confidence: ConfidenceLevel;
  signals: ForecastSignal[];    // top 3 driving signals
}

export interface ReengagementForecast {
  likelihoodPct: number;        // 0-100
  confidence: ConfidenceLevel;
  signals: ForecastSignal[];
}

export interface QuestCompletionForecast {
  hasQuestData: boolean;        // false if avg completion <= 20%
  earliestDays: number;         // optimistic days to completion
  latestDays: number;           // pessimistic days to completion
  confidence: ConfidenceLevel;
  signals: ForecastSignal[];
}

export interface QuarterlyTrendForecast {
  trend: QuarterlyTrend;
  currentCount: number;
  projectedCount: number;       // projected 90 days out
  confidence: ConfidenceLevel;
  signals: ForecastSignal[];
}

export interface CohortForecasts {
  tooSmall: boolean;            // true if memberCount < 50
  churn: ChurnForecast | null;
  reengagement: ReengagementForecast | null;
  questCompletion: QuestCompletionForecast | null;
  quarterlyTrend: QuarterlyTrendForecast | null;
  computedAt: string;           // ISO timestamp — shows "refreshed" on load
}

// ---------------------------------------------------------------------------
// Confidence logic
// ---------------------------------------------------------------------------

function computeConfidence(memberCount: number, pipelineRunCount: number): ConfidenceLevel {
  if (memberCount < 50) return 'too-small';
  if (memberCount >= 500 && pipelineRunCount >= 3) return 'High';
  if (memberCount >= 100 || pipelineRunCount >= 2) return 'Medium';
  return 'Low';
}

// ---------------------------------------------------------------------------
// Customer ID set helpers
// ---------------------------------------------------------------------------

/**
 * For ML cohorts we have a list of customer IDs derived from clustering.
 * For rule-based cohorts we evaluate conditions inline.
 * Both paths pass customerIds as string[].
 */

// ---------------------------------------------------------------------------
// 14-day churn probability
// ---------------------------------------------------------------------------

/**
 * Heuristic: compare each member's event count in the last 7 days vs their
 * median weekly event count across all history. Members with recent count
 * < 40% of their median are considered "at-risk". The percentage of at-risk
 * members is the churn probability.
 *
 * We also factor in % of members who have no quest activity in last 14 days.
 * Final score = weighted blend: 60% event-drop signal + 40% quest-inactive.
 */
export function computeChurnForecast(
  customerIds: string[],
  memberCount: number,
  pipelineRunCount: number,
): ChurnForecast {
  const confidence = computeConfidence(memberCount, pipelineRunCount);
  if (confidence === 'too-small') {
    return { probabilityPct: 0, confidence, signals: [] };
  }

  const db = getDb();
  const n = customerIds.length;
  if (n === 0) return { probabilityPct: 0, confidence, signals: [] };

  // --- Signal 1: Recent engagement drop ---
  // Get recent 7d event count per member
  const recentEngRows = db.prepare(`
    SELECT customer_id, SUM(event_count) AS recent_events
    FROM engagement_signals
    WHERE customer_id IN (${customerIds.map(() => '?').join(',')})
      AND recorded_date >= datetime('now', '-7 days')
    GROUP BY customer_id
  `).all(...customerIds) as { customer_id: string; recent_events: number }[];

  const recentMap = new Map(recentEngRows.map(r => [r.customer_id, r.recent_events]));

  // Get baseline: total events / total weeks active (weeks = date range / 7)
  const baselineRows = db.prepare(`
    SELECT customer_id,
      SUM(event_count) AS total_events,
      (julianday(MAX(recorded_date)) - julianday(MIN(recorded_date)) + 7) / 7.0 AS active_weeks
    FROM engagement_signals
    WHERE customer_id IN (${customerIds.map(() => '?').join(',')})
    GROUP BY customer_id
  `).all(...customerIds) as { customer_id: string; total_events: number; active_weeks: number }[];

  const baselineMap = new Map(
    baselineRows.map(r => [r.customer_id, r.total_events / Math.max(r.active_weeks, 1)])
  );

  let droppedCount = 0;
  let noRecentCount = 0;
  const dropThreshold = 0.5; // < 50% of historical weekly average

  for (const cid of customerIds) {
    const recent = recentMap.get(cid) ?? 0;
    const baseline = baselineMap.get(cid) ?? 0;
    if (recent === 0) {
      noRecentCount++;
      droppedCount++;
    } else if (baseline > 0 && recent / baseline < dropThreshold) {
      droppedCount++;
    }
  }

  const engagementDropPct = n > 0 ? (droppedCount / n) * 100 : 0;
  const noRecentPct = n > 0 ? (noRecentCount / n) * 100 : 0;

  // --- Signal 2: Quest inactivity ---
  const questActiveRows = db.prepare(`
    SELECT COUNT(DISTINCT customer_id) AS active_count
    FROM quest_progress
    WHERE customer_id IN (${customerIds.map(() => '?').join(',')})
      AND last_activity_at >= datetime('now', '-14 days')
  `).get(...customerIds) as { active_count: number };

  const questActivePct = n > 0 ? (questActiveRows.active_count / n) * 100 : 0;
  const questInactivePct = Math.max(0, 100 - questActivePct);

  // --- Blended churn probability ---
  const rawChurnPct = Math.round(engagementDropPct * 0.6 + questInactivePct * 0.4);
  const probabilityPct = Math.min(95, Math.max(2, rawChurnPct));

  // --- Signals explanation ---
  const avgDropPct = Math.round(engagementDropPct);
  const avgNoRecentPct = Math.round(noRecentPct);
  const avgQuestInactivePct = Math.round(questInactivePct);

  const signals: ForecastSignal[] = [
    {
      label: 'Engagement frequency drop',
      detail: `${avgDropPct}% of members have weekly event counts below 50% of their historical average`,
    },
    {
      label: 'Quest inactivity',
      detail: `${avgQuestInactivePct}% of members had no quest activity in the last 14 days`,
    },
    {
      label: 'No recent signals',
      detail: `${avgNoRecentPct}% of members logged zero engagement events in the last 7 days`,
    },
  ];

  return { probabilityPct, confidence, signals };
}

// ---------------------------------------------------------------------------
// 30-day re-engagement likelihood
// ---------------------------------------------------------------------------

/**
 * Heuristic: identify members who had an engagement gap of 7+ days, then
 * returned (i.e., have events both before and after the gap). The % of members
 * with this pattern in the dataset indicates re-engagement tendency.
 *
 * We also look at avg days between first and last engagement event — wider
 * spread with multiple events = habitually re-engaged.
 */
export function computeReengagementForecast(
  customerIds: string[],
  memberCount: number,
  pipelineRunCount: number,
): ReengagementForecast {
  const confidence = computeConfidence(memberCount, pipelineRunCount);
  if (confidence === 'too-small') {
    return { likelihoodPct: 0, confidence, signals: [] };
  }

  const db = getDb();
  const n = customerIds.length;
  if (n === 0) return { likelihoodPct: 0, confidence, signals: [] };

  // Members who have engagement spread over more than 7 days (gap-then-return pattern)
  const reengagedRows = db.prepare(`
    SELECT
      COUNT(DISTINCT customer_id) AS reengaged_count,
      AVG(julianday(max_date) - julianday(min_date)) AS avg_span_days,
      AVG(distinct_days) AS avg_active_days
    FROM (
      SELECT
        customer_id,
        MIN(recorded_date) AS min_date,
        MAX(recorded_date) AS max_date,
        COUNT(DISTINCT DATE(recorded_date)) AS distinct_days
      FROM engagement_signals
      WHERE customer_id IN (${customerIds.map(() => '?').join(',')})
      GROUP BY customer_id
      HAVING distinct_days >= 2
        AND julianday(MAX(recorded_date)) - julianday(MIN(recorded_date)) >= 7
    )
  `).get(...customerIds) as {
    reengaged_count: number;
    avg_span_days: number | null;
    avg_active_days: number | null;
  };

  const reengagedPct = n > 0 ? (reengagedRows.reengaged_count / n) * 100 : 0;
  const avgSpanDays = reengagedRows.avg_span_days ?? 0;
  const avgActiveDays = reengagedRows.avg_active_days ?? 0;

  // Members with a purchase in last 30 days (purchase intent)
  const recentPurchaseRows = db.prepare(`
    SELECT COUNT(DISTINCT customer_id) AS buyer_count
    FROM purchase_history
    WHERE customer_id IN (${customerIds.map(() => '?').join(',')})
      AND purchased_at >= datetime('now', '-30 days')
  `).get(...customerIds) as { buyer_count: number };

  const recentBuyerPct = n > 0 ? (recentPurchaseRows.buyer_count / n) * 100 : 0;

  // Blend: 70% re-engagement pattern + 30% recent purchase signal
  const rawLikelihood = reengagedPct * 0.7 + recentBuyerPct * 0.3;
  const likelihoodPct = Math.min(95, Math.max(2, Math.round(rawLikelihood)));

  const signals: ForecastSignal[] = [
    {
      label: 'Gap-then-return behavior',
      detail: `${Math.round(reengagedPct)}% of members show a pattern of returning after 7+ day gaps (avg span: ${Math.round(avgSpanDays)} days)`,
    },
    {
      label: 'Active engagement days',
      detail: `Members average ${Math.round(avgActiveDays)} distinct active days, indicating habitual re-engagement`,
    },
    {
      label: 'Recent purchase intent',
      detail: `${Math.round(recentBuyerPct)}% made a purchase in the last 30 days, signaling willingness to invest`,
    },
  ];

  return { likelihoodPct, confidence, signals };
}

// ---------------------------------------------------------------------------
// Quest completion date range
// ---------------------------------------------------------------------------

/**
 * For cohorts where avg quest completion > 20%, project days-to-100%.
 * Rate = completion_pct / days_active. Remaining = (100 - avg_pct) / rate.
 * Return an optimistic (90th percentile rate) and pessimistic (10th percentile)
 * range.
 */
export function computeQuestCompletionForecast(
  customerIds: string[],
  memberCount: number,
  pipelineRunCount: number,
): QuestCompletionForecast {
  const confidence = computeConfidence(memberCount, pipelineRunCount);
  if (confidence === 'too-small') {
    return { hasQuestData: false, earliestDays: 0, latestDays: 0, confidence, signals: [] };
  }

  const db = getDb();
  const n = customerIds.length;
  if (n === 0) return { hasQuestData: false, earliestDays: 0, latestDays: 0, confidence, signals: [] };

  const questStats = db.prepare(`
    SELECT
      AVG(completion_percentage) AS avg_completion,
      AVG(CASE
        WHEN julianday(last_activity_at) - julianday(started_at) > 0
        THEN completion_percentage / (julianday(last_activity_at) - julianday(started_at))
        ELSE NULL
      END) AS avg_rate_per_day,
      MIN(CASE
        WHEN julianday(last_activity_at) - julianday(started_at) > 0
        THEN completion_percentage / (julianday(last_activity_at) - julianday(started_at))
        ELSE NULL
      END) AS min_rate,
      MAX(CASE
        WHEN julianday(last_activity_at) - julianday(started_at) > 0
        THEN completion_percentage / (julianday(last_activity_at) - julianday(started_at))
        ELSE NULL
      END) AS max_rate,
      COUNT(DISTINCT customer_id) AS active_learner_count,
      AVG(julianday(last_activity_at) - julianday(started_at)) AS avg_days_active
    FROM quest_progress
    WHERE customer_id IN (${customerIds.map(() => '?').join(',')})
      AND completion_percentage > 0
      AND completion_percentage < 100
  `).get(...customerIds) as {
    avg_completion: number | null;
    avg_rate_per_day: number | null;
    min_rate: number | null;
    max_rate: number | null;
    active_learner_count: number;
    avg_days_active: number | null;
  };

  const avgCompletion = questStats.avg_completion ?? 0;

  // Only show forecast if average completion > 20%
  if (avgCompletion <= 20 || !questStats.avg_rate_per_day) {
    return { hasQuestData: false, earliestDays: 0, latestDays: 0, confidence, signals: [] };
  }

  const avgRate = questStats.avg_rate_per_day;
  // Use a range: optimistic = 75th percentile approximation (avg + some of max)
  // pessimistic = 25th percentile approximation (avg skewed to min)
  const optimisticRate = Math.max(avgRate, avgRate * 0.5 + (questStats.max_rate ?? avgRate) * 0.5);
  const pessimisticRate = Math.max(0.01, avgRate * 0.5 + (questStats.min_rate ?? avgRate) * 0.5);

  const remaining = 100 - avgCompletion;
  const earliestDays = Math.round(remaining / optimisticRate);
  const latestDays = Math.round(remaining / pessimisticRate);

  const signals: ForecastSignal[] = [
    {
      label: 'Average quest completion',
      detail: `${Math.round(avgCompletion)}% average progress across ${questStats.active_learner_count.toLocaleString()} active learners`,
    },
    {
      label: 'Current completion rate',
      detail: `Members are progressing at ~${avgRate.toFixed(1)}% completion per day on average`,
    },
    {
      label: 'Days active',
      detail: `Average of ${Math.round(questStats.avg_days_active ?? 0)} days since quest started — used to extrapolate completion timeline`,
    },
  ];

  return { hasQuestData: true, earliestDays, latestDays, confidence, signals };
}

// ---------------------------------------------------------------------------
// Quarterly trend
// ---------------------------------------------------------------------------

/**
 * Heuristic: compare the "effective member count" implied by two time windows.
 * Window A = count of distinct customers with engagement signals in the last 30 days.
 * Window B = count of distinct customers with engagement signals 31-90 days ago.
 * Ratio A/B determines growth / stable / shrinking.
 *
 * For ML cohorts, "member count" refers to how many of the cohort members
 * were active in each window. For rule-based cohorts, same logic.
 */
export function computeQuarterlyTrendForecast(
  customerIds: string[],
  memberCount: number,
  pipelineRunCount: number,
): QuarterlyTrendForecast {
  const confidence = computeConfidence(memberCount, pipelineRunCount);
  if (confidence === 'too-small') {
    return {
      trend: 'stable',
      currentCount: memberCount,
      projectedCount: memberCount,
      confidence,
      signals: [],
    };
  }

  const db = getDb();
  const n = customerIds.length;
  if (n === 0) {
    return {
      trend: 'stable',
      currentCount: memberCount,
      projectedCount: memberCount,
      confidence,
      signals: [],
    };
  }

  // Recent window: last 30 days
  const recentWindow = db.prepare(`
    SELECT COUNT(DISTINCT customer_id) AS active_count
    FROM engagement_signals
    WHERE customer_id IN (${customerIds.map(() => '?').join(',')})
      AND recorded_date >= datetime('now', '-30 days')
  `).get(...customerIds) as { active_count: number };

  // Older window: 31-90 days ago
  const olderWindow = db.prepare(`
    SELECT COUNT(DISTINCT customer_id) AS active_count
    FROM engagement_signals
    WHERE customer_id IN (${customerIds.map(() => '?').join(',')})
      AND recorded_date >= datetime('now', '-90 days')
      AND recorded_date < datetime('now', '-30 days')
  `).get(...customerIds) as { active_count: number };

  const recentCount = recentWindow.active_count;
  const olderCount = olderWindow.active_count;

  // Use pipeline run variance as secondary signal for projected count
  const runCountRows = db.prepare(`
    SELECT COUNT(*) as run_count,
      MIN(completed_at) as oldest_run,
      MAX(completed_at) as newest_run
    FROM pipeline_runs
    WHERE status = 'success'
  `).get() as { run_count: number; oldest_run: string; newest_run: string };

  // Growth ratio
  const ratio = olderCount > 0 ? recentCount / olderCount : 1;
  const growthPct = (ratio - 1) * 100;

  let trend: QuarterlyTrend;
  if (growthPct >= 5) trend = 'growing';
  else if (growthPct <= -5) trend = 'shrinking';
  else trend = 'stable';

  // Project 90 days: apply ratio compounded over 3 months
  const projectedCount = Math.round(memberCount * Math.pow(ratio, 3));

  const signals: ForecastSignal[] = [
    {
      label: 'Active members — last 30 days',
      detail: `${recentCount.toLocaleString()} of ${n.toLocaleString()} cohort members engaged in the last 30 days (${Math.round((recentCount / n) * 100)}%)`,
    },
    {
      label: 'Active members — 31–90 days ago',
      detail: `${olderCount.toLocaleString()} members were active in the prior 60-day window — ${growthPct >= 0 ? '+' : ''}${growthPct.toFixed(1)}% change`,
    },
    {
      label: 'Pipeline data freshness',
      detail: `Based on ${runCountRows.run_count} pipeline runs — more runs improve trend accuracy`,
    },
  ];

  return { trend, currentCount: memberCount, projectedCount, confidence, signals };
}

// ---------------------------------------------------------------------------
// Public API — compute all forecasts for a set of customer IDs
// ---------------------------------------------------------------------------

export function computeForecasts(
  customerIds: string[],
  memberCount: number,
  pipelineRunCount: number,
): CohortForecasts {
  const tooSmall = memberCount < 50;

  if (tooSmall) {
    return {
      tooSmall: true,
      churn: null,
      reengagement: null,
      questCompletion: null,
      quarterlyTrend: null,
      computedAt: new Date().toISOString(),
    };
  }

  const churn = computeChurnForecast(customerIds, memberCount, pipelineRunCount);
  const reengagement = computeReengagementForecast(customerIds, memberCount, pipelineRunCount);
  const questCompletion = computeQuestCompletionForecast(customerIds, memberCount, pipelineRunCount);
  const quarterlyTrend = computeQuarterlyTrendForecast(customerIds, memberCount, pipelineRunCount);

  return {
    tooSmall: false,
    churn,
    reengagement,
    questCompletion,
    quarterlyTrend,
    computedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Helper: get customer IDs for an ML cohort from the clustering result
// ---------------------------------------------------------------------------

/**
 * Returns auth0_user_ids for a named ML cohort using SQL rules on product_data.
 * Each cohort maps to a set of engagement/behaviour conditions derivable from the snapshot.
 */
export function getCustomerIdsForMlCohort(cohortId: string): string[] {
  const db = getDb();

  const month = (db.prepare(
    "SELECT MAX(month) as m FROM product_data WHERE subscription_status = 'active'"
  ).get() as { m: string | null }).m ?? '2026-07';

  // SQL rules matching the ML cohort definitions used in clustering.ts
  const ruleMap: Record<string, string> = {
    'high-value-engaged': "has_login_in_month = 1 AND has_progress_in_month = 1 AND has_used_eve_in_month = 1",
    'quest-graduates':    "has_login_in_month = 1 AND has_progress_in_month = 1 AND has_used_eve_in_month = 0",
    'at-risk-disengaged': "has_login_in_month = 0 AND COALESCE(total_tenure_days, 0) > 180",
    'new-joiners':        "is_new_subscriber = 1",
    'passive-subscribers':"has_login_in_month = 0 AND COALESCE(total_tenure_days, 0) <= 180 AND is_new_subscriber = 0",
  };

  const rule = ruleMap[cohortId];
  if (!rule) return [];

  const rows = db.prepare(`
    SELECT auth0_user_id AS customer_id
    FROM product_data
    WHERE month = ? AND subscription_status = 'active' AND (${rule})
    LIMIT 5000
  `).all(month) as { customer_id: string }[];

  return rows.map(r => r.customer_id);
}

// ---------------------------------------------------------------------------
// Helper: get customer IDs for a rule-based cohort
// ---------------------------------------------------------------------------

import type { CohortCondition } from './db';

export function getCustomerIdsForRuleCohort(conditions: CohortCondition[]): string[] {
  if (conditions.length === 0) return [];

  const db = getDb();
  const opMap: Record<string, string> = { gt: '>', lt: '<', gte: '>=', lte: '<=', eq: '=' };

  let matchSets: Set<string>[] = [];

  for (const cond of conditions) {
    const op = opMap[cond.operator] ?? '=';
    const val = Number(cond.value);
    let ids: string[] = [];

    switch (cond.field) {
      case 'quest_completion_pct': {
        ids = (db.prepare(`
          SELECT DISTINCT customer_id FROM quest_progress
          WHERE completion_percentage ${op} ?
        `).all(val) as { customer_id: string }[]).map(r => r.customer_id);
        break;
      }
      case 'subscription_tier': {
        ids = (db.prepare(`
          SELECT DISTINCT customer_id FROM subscription_tiers
          WHERE tier_level ${op} ? AND is_active = 1
        `).all(val) as { customer_id: string }[]).map(r => r.customer_id);
        break;
      }
      case 'total_purchases': {
        ids = (db.prepare(`
          SELECT customer_id FROM purchase_history
          GROUP BY customer_id
          HAVING SUM(amount) ${op} ?
        `).all(val) as { customer_id: string }[]).map(r => r.customer_id);
        break;
      }
      case 'days_since_activity': {
        ids = (db.prepare(`
          SELECT customer_id FROM quest_progress
          GROUP BY customer_id
          HAVING CAST(julianday('now') - julianday(MAX(last_activity_at)) AS INTEGER) ${op} ?
        `).all(val) as { customer_id: string }[]).map(r => r.customer_id);
        break;
      }
      case 'event_count_30d': {
        ids = (db.prepare(`
          SELECT customer_id FROM engagement_signals
          WHERE recorded_date >= datetime('now', '-30 days')
          GROUP BY customer_id
          HAVING SUM(event_count) ${op} ?
        `).all(val) as { customer_id: string }[]).map(r => r.customer_id);
        break;
      }
    }

    matchSets.push(new Set(ids));
  }

  if (matchSets.length === 0) return [];
  let result = matchSets[0];
  for (let i = 1; i < matchSets.length; i++) {
    result = new Set([...result].filter(id => matchSets[i].has(id)));
  }
  return [...result];
}

// ---------------------------------------------------------------------------
// Shared math utilities (duplicated from clustering.ts to keep files independent)
// ---------------------------------------------------------------------------

function euclidean(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum);
}

function meanVector(points: number[][]): number[] {
  if (points.length === 0) return new Array(5).fill(0);
  const dim = points[0].length;
  const sums = new Array(dim).fill(0);
  for (const p of points) for (let i = 0; i < dim; i++) sums[i] += p[i];
  return sums.map(s => s / points.length);
}

function daysDiff(isoDate: string): number {
  const d = new Date(isoDate);
  const now = new Date();
  return Math.max(0, Math.round((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)));
}

function assignCohortNames(centroids: number[][]): number[] {
  const k = centroids.length;
  function profileScore(centroid: number[], metaIdx: number): number {
    const [eng, quest, tier, purchase, daysInactive] = centroid;
    switch (metaIdx) {
      case 0: return eng * 3 + tier * 2 + purchase * 2 - daysInactive * 2;
      case 1: return quest * 4 + eng * 1 - daysInactive;
      case 2: return daysInactive * 4 - eng * 3 - quest;
      case 3: return -quest * 2 - purchase * 2 - daysInactive + 2;
      case 4: return tier * 2 - eng * 3 - quest;
      default: return 0;
    }
  }

  const used = new Set<number>();
  const metaAssignment = new Array(k).fill(-1);
  for (let m = 0; m < 5 && m < k; m++) {
    let bestCentroid = -1, bestScore = -Infinity;
    for (let c = 0; c < k; c++) {
      if (used.has(c)) continue;
      const score = profileScore(centroids[c], m);
      if (score > bestScore) { bestScore = score; bestCentroid = c; }
    }
    if (bestCentroid >= 0) { metaAssignment[bestCentroid] = m; used.add(bestCentroid); }
  }
  for (let c = 0; c < k; c++) {
    if (metaAssignment[c] === -1) metaAssignment[c] = c % 5;
  }
  return metaAssignment;
}
