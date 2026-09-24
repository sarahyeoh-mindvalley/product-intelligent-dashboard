/**
 * Feature Release Impact Engine
 *
 * Computes:
 * - Before/after KPI comparison (WAU, weekly retention, revenue) around a release date
 * - Cohort attribution: which ML cohorts were most positively/negatively impacted
 * - Planned release forecasting: projects expected KPI change from historical averages
 * - Forecast accuracy metric: based on consistency (variance) of historical deltas
 */

import { getDb, getAllReleases, FeatureReleaseRow } from './db';
import { getMLCohorts } from './clustering';
import { getCustomerIdsForMlCohort } from './forecasting';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KpiSnapshot {
  wau: number;           // distinct active users in a 7-day window
  retentionPct: number;  // % of week-1 users who returned in week-2 (within 30-day window)
  revenue: number;       // total purchase amounts
}

export interface KpiComparison {
  before: KpiSnapshot;
  after: KpiSnapshot;
  wauDelta: number;
  retentionDelta: number;
  revenueDelta: number;
  wauDeltaPct: number;
  retentionDeltaPct: number;
  revenueDeltaPct: number;
}

export interface CohortImpact {
  cohortId: string;
  cohortName: string;
  cohortType: 'ml' | 'rule';
  impactScore: number;        // delta in avg engagement score
  direction: 'positive' | 'negative' | 'neutral';
  memberCount: number;
  beforeEngagement: number;
  afterEngagement: number;
}

export interface ReleaseDetail {
  release: FeatureReleaseRow;
  kpiComparison: KpiComparison | null;   // null for planned
  cohortImpacts: CohortImpact[];
  topPositive: CohortImpact[];
  topNegative: CohortImpact[];
}

export interface ForecastAccuracy {
  historicalReleaseCount: number;
  averageAccuracyPct: number;
  detail: string;
}

export interface PlannedReleaseForecast {
  forecastedWauDelta: number;
  forecastedWauDeltaPct: number;
  forecastedRetentionDelta: number;
  forecastedRetentionDeltaPct: number;
  forecastedRevenueDelta: number;
  forecastedRevenueDeltaPct: number;
  cohortForecasts: Array<{
    cohortId: string;
    cohortName: string;
    forecastedImpactScore: number;
    direction: 'positive' | 'negative' | 'neutral';
    memberCount: number;
  }>;
  accuracy: ForecastAccuracy;
}

export interface RankedPlannedRelease {
  release: FeatureReleaseRow;
  netCohortImpactScore: number;
  cohortForecasts: PlannedReleaseForecast['cohortForecasts'];
}

// ---------------------------------------------------------------------------
// KPI computation helpers
// ---------------------------------------------------------------------------

/**
 * Compute KPI snapshot for subscribers whose subscription_start_date falls in [fromDate, toDate).
 * Uses the product_data snapshot (single month) as the source of truth.
 * WAU  = active subscribers from this cohort who logged in this month (MAU).
 * Retention = % who made content progress this month.
 * Revenue  = annualised subscription spend for this cohort.
 */
function computeKpiForWindow(fromDate: string, toDate: string): KpiSnapshot {
  const db = getDb();
  const month = (db.prepare(
    "SELECT MAX(month) as m FROM product_data WHERE subscription_status = 'active'"
  ).get() as { m: string | null }).m ?? '2026-07';

  const wauRow = db.prepare(`
    SELECT COUNT(*) AS wau
    FROM product_data
    WHERE month = ? AND subscription_status = 'active'
      AND has_login_in_month = 1
      AND subscription_start_date >= ? AND subscription_start_date < ?
  `).get(month, fromDate, toDate) as { wau: number };

  const totalRow = db.prepare(`
    SELECT COUNT(*) AS n
    FROM product_data
    WHERE month = ? AND subscription_status = 'active'
      AND subscription_start_date >= ? AND subscription_start_date < ?
  `).get(month, fromDate, toDate) as { n: number };

  const progressRow = db.prepare(`
    SELECT COUNT(*) AS n
    FROM product_data
    WHERE month = ? AND subscription_status = 'active'
      AND has_progress_in_month = 1
      AND subscription_start_date >= ? AND subscription_start_date < ?
  `).get(month, fromDate, toDate) as { n: number };

  const revenueRow = db.prepare(`
    SELECT COALESCE(SUM(
      CASE WHEN purchase_price > 0 THEN
        CASE WHEN LOWER(payment_frequency) = 'monthly' THEN purchase_price * 12.0 ELSE purchase_price END
      ELSE 0 END
    ), 0) AS total
    FROM product_data
    WHERE month = ? AND subscription_status = 'active'
      AND subscription_start_date >= ? AND subscription_start_date < ?
  `).get(month, fromDate, toDate) as { total: number };

  const total = totalRow.n;
  return {
    wau: wauRow.wau,
    retentionPct: total > 0 ? Math.round((progressRow.n / total) * 100) : 0,
    revenue: Math.round(revenueRow.total * 100) / 100,
  };
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function pctDelta(before: number, after: number): number {
  if (before === 0) return after > 0 ? 100 : 0;
  return Math.round(((after - before) / before) * 1000) / 10; // one decimal
}

// ---------------------------------------------------------------------------
// Before/after KPI comparison (AC2)
// ---------------------------------------------------------------------------

export function computeReleaseKpiComparison(releaseDate: string): KpiComparison {
  const beforeStart = addDays(releaseDate, -30);
  const beforeEnd = releaseDate;
  const afterStart = releaseDate;
  const afterEnd = addDays(releaseDate, 30);

  const before = computeKpiForWindow(beforeStart, beforeEnd);
  const after = computeKpiForWindow(afterStart, afterEnd);

  return {
    before,
    after,
    wauDelta: after.wau - before.wau,
    retentionDelta: after.retentionPct - before.retentionPct,
    revenueDelta: Math.round((after.revenue - before.revenue) * 100) / 100,
    wauDeltaPct: pctDelta(before.wau, after.wau),
    retentionDeltaPct: after.retentionPct - before.retentionPct, // already in pct points
    revenueDeltaPct: pctDelta(before.revenue, after.revenue),
  };
}

// ---------------------------------------------------------------------------
// Cohort impact attribution (AC3)
// ---------------------------------------------------------------------------

/**
 * Cohort SQL rules — maps ML cohort IDs to product_data WHERE clauses.
 * "Before" cohort = subscribers who joined before the release date.
 * "After" cohort  = subscribers who joined after the release date.
 * Delta in login rate (MAU/MAS) per cohort = impact score.
 */
const COHORT_SQL_RULES: Record<string, string> = {
  'high-value-engaged': "has_login_in_month = 1 AND has_progress_in_month = 1 AND has_used_eve_in_month = 1",
  'quest-graduates':    "has_login_in_month = 1 AND has_progress_in_month = 1 AND has_used_eve_in_month = 0",
  'at-risk-disengaged': "has_login_in_month = 0 AND COALESCE(total_tenure_days, 0) > 180",
  'new-joiners':        "is_new_subscriber = 1",
  'passive-subscribers':"has_login_in_month = 0 AND COALESCE(total_tenure_days, 0) <= 180 AND is_new_subscriber = 0",
};

/**
 * For each ML cohort, compare login rate (MAU/MAS) between:
 *  - subscribers who joined in the 30 days BEFORE the release date (long-tenured relative to release)
 *  - subscribers who joined in the 30 days AFTER the release date (newer, post-release onboarding)
 * Impact score = login rate delta (positive = post-release cohort is more engaged).
 */
export function computeCohortImpacts(releaseDate: string): CohortImpact[] {
  const db = getDb();
  const mlCohorts = getMLCohorts();
  const impacts: CohortImpact[] = [];

  const beforeStart = addDays(releaseDate, -30);
  const afterEnd = addDays(releaseDate, 30);
  const month = (db.prepare(
    "SELECT MAX(month) as m FROM product_data WHERE subscription_status = 'active'"
  ).get() as { m: string | null }).m ?? '2026-07';

  for (const cohort of mlCohorts) {
    const rule = COHORT_SQL_RULES[cohort.id];
    if (!rule) continue;

    const base = `FROM product_data WHERE month = '${month}' AND subscription_status = 'active' AND (${rule})`;

    // Count total members in this cohort
    const memberCount = (db.prepare(`SELECT COUNT(*) AS n ${base}`).get() as { n: number }).n;
    if (memberCount === 0) continue;

    // "Before": members of this cohort who subscribed before the release (longer tenured relative to release)
    const beforeRow = db.prepare(`
      SELECT COUNT(*) AS total, SUM(has_login_in_month) AS logged_in
      ${base} AND subscription_start_date < ?
    `).get(releaseDate) as { total: number; logged_in: number };

    // "After": members of this cohort who subscribed after the release
    const afterRow = db.prepare(`
      SELECT COUNT(*) AS total, SUM(has_login_in_month) AS logged_in
      ${base} AND subscription_start_date >= ?
    `).get(releaseDate) as { total: number; logged_in: number };

    const beforeAvg = beforeRow.total > 0 ? (beforeRow.logged_in ?? 0) / beforeRow.total : 0;
    const afterAvg  = afterRow.total  > 0 ? (afterRow.logged_in  ?? 0) / afterRow.total  : 0;
    const delta = afterAvg - beforeAvg;
    const impactScore = Math.round(delta * 10000) / 100; // expressed as pp

    let direction: 'positive' | 'negative' | 'neutral';
    if (impactScore > 1) direction = 'positive';
    else if (impactScore < -1) direction = 'negative';
    else direction = 'neutral';

    impacts.push({
      cohortId: cohort.id,
      cohortName: cohort.name,
      cohortType: 'ml',
      impactScore,
      direction,
      memberCount,
      beforeEngagement: Math.round(beforeAvg * 1000) / 10, // login rate %
      afterEngagement:  Math.round(afterAvg  * 1000) / 10,
    });
  }

  impacts.sort((a, b) => b.impactScore - a.impactScore);
  return impacts;
}

// ---------------------------------------------------------------------------
// Historical average deltas (for forecasting)
// ---------------------------------------------------------------------------

interface HistoricalDelta {
  wauDeltaPct: number;
  retentionDeltaPct: number;
  revenueDeltaPct: number;
  cohortDeltas: Map<string, number>; // cohortId → avg engagement delta
}

function computeHistoricalDeltas(): HistoricalDelta[] {
  const releases = getAllReleases().filter(r => r.status === 'released');
  const deltas: HistoricalDelta[] = [];

  for (const release of releases) {
    try {
      const comparison = computeReleaseKpiComparison(release.release_date);
      const cohortImpacts = computeCohortImpacts(release.release_date);

      const cohortDeltas = new Map<string, number>();
      for (const ci of cohortImpacts) {
        cohortDeltas.set(ci.cohortId, ci.impactScore);
      }

      deltas.push({
        wauDeltaPct: comparison.wauDeltaPct,
        retentionDeltaPct: comparison.retentionDeltaPct,
        revenueDeltaPct: comparison.revenueDeltaPct,
        cohortDeltas,
      });
    } catch {
      // Skip releases with insufficient data
    }
  }

  return deltas;
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function variance(nums: number[]): number {
  if (nums.length < 2) return 0;
  const mean = avg(nums);
  return avg(nums.map(n => (n - mean) ** 2));
}

// ---------------------------------------------------------------------------
// Forecast accuracy (AC6)
// ---------------------------------------------------------------------------

export function computeForecastAccuracy(): ForecastAccuracy {
  const releases = getAllReleases().filter(r => r.status === 'released');
  const historicalReleaseCount = releases.length;

  if (historicalReleaseCount === 0) {
    return {
      historicalReleaseCount: 0,
      averageAccuracyPct: 0,
      detail: 'No historical releases available to compute accuracy.',
    };
  }

  const deltas = computeHistoricalDeltas();
  if (deltas.length === 0) {
    return {
      historicalReleaseCount,
      averageAccuracyPct: 50,
      detail: `Based on ${historicalReleaseCount} historical releases. Insufficient data for accuracy estimate.`,
    };
  }

  const wauVars = variance(deltas.map(d => d.wauDeltaPct));
  const retVars = variance(deltas.map(d => d.retentionDeltaPct));
  const revVars = variance(deltas.map(d => d.revenueDeltaPct));

  // Normalize variance to 0-100 accuracy scale:
  // Higher variance = lower accuracy. Max useful variance ~400 (std dev ~20%)
  const MAX_VAR = 400;
  const avgVar = (wauVars + retVars + revVars) / 3;
  const accuracyPct = Math.round(Math.max(10, Math.min(95, 95 - (avgVar / MAX_VAR) * 85)));

  return {
    historicalReleaseCount,
    averageAccuracyPct: accuracyPct,
    detail: `Projected from ${historicalReleaseCount} historical releases. Accuracy is derived from consistency of before/after KPI deltas — lower variance in past releases yields a higher accuracy score.`,
  };
}

// ---------------------------------------------------------------------------
// Planned release forecast (AC5)
// ---------------------------------------------------------------------------

export function computePlannedReleaseForecast(releaseId: number): PlannedReleaseForecast {
  const deltas = computeHistoricalDeltas();
  const accuracy = computeForecastAccuracy();
  const mlCohorts = getMLCohorts();

  // Average KPI deltas across historical releases
  const forecastedWauDeltaPct = Math.round(avg(deltas.map(d => d.wauDeltaPct)) * 10) / 10;
  const forecastedRetentionDeltaPct = Math.round(avg(deltas.map(d => d.retentionDeltaPct)) * 10) / 10;
  const forecastedRevenueDeltaPct = Math.round(avg(deltas.map(d => d.revenueDeltaPct)) * 10) / 10;

  // For each ML cohort, compute avg expected impact from historical data
  const cohortForecasts = mlCohorts.map(cohort => {
    const historicalImpacts = deltas
      .map(d => d.cohortDeltas.get(cohort.id))
      .filter((v): v is number => v !== undefined);

    const forecastedScore = historicalImpacts.length > 0
      ? Math.round(avg(historicalImpacts) * 100) / 100
      : 0;

    let direction: 'positive' | 'negative' | 'neutral';
    if (forecastedScore > 0.05) direction = 'positive';
    else if (forecastedScore < -0.05) direction = 'negative';
    else direction = 'neutral';

    const customerIds = getCustomerIdsForMlCohort(cohort.id);

    return {
      cohortId: cohort.id,
      cohortName: cohort.name,
      forecastedImpactScore: forecastedScore,
      direction,
      memberCount: customerIds.length,
    };
  });

  // Sort by forecasted impact score descending
  cohortForecasts.sort((a, b) => b.forecastedImpactScore - a.forecastedImpactScore);

  // Fake baseline WAU/revenue to compute absolute deltas from percentages
  // Use current real baseline for display
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = addDays(today, -30);
  const baselineKpi = computeKpiForWindow(thirtyDaysAgo, today);

  const forecastedWauDelta = Math.round(baselineKpi.wau * forecastedWauDeltaPct / 100);
  const forecastedRevenueDelta = Math.round(baselineKpi.revenue * forecastedRevenueDeltaPct / 100 * 100) / 100;
  const forecastedRetentionDelta = forecastedRetentionDeltaPct;

  return {
    forecastedWauDelta,
    forecastedWauDeltaPct,
    forecastedRetentionDelta,
    forecastedRetentionDeltaPct,
    forecastedRevenueDelta,
    forecastedRevenueDeltaPct,
    cohortForecasts,
    accuracy,
  };
}

// ---------------------------------------------------------------------------
// Planned releases ranked by projected net cohort impact (AC7)
// ---------------------------------------------------------------------------

export function getRankedPlannedReleases(): RankedPlannedRelease[] {
  const releases = getAllReleases().filter(r => r.status === 'planned');
  const deltas = computeHistoricalDeltas();

  const mlCohorts = getMLCohorts();

  const ranked: RankedPlannedRelease[] = releases.map(release => {
    const cohortForecasts = mlCohorts.map(cohort => {
      const historicalImpacts = deltas
        .map(d => d.cohortDeltas.get(cohort.id))
        .filter((v): v is number => v !== undefined);

      const forecastedScore = historicalImpacts.length > 0
        ? Math.round(avg(historicalImpacts) * 100) / 100
        : 0;

      let direction: 'positive' | 'negative' | 'neutral';
      if (forecastedScore > 0.05) direction = 'positive';
      else if (forecastedScore < -0.05) direction = 'negative';
      else direction = 'neutral';

      const customerIds = getCustomerIdsForMlCohort(cohort.id);

      return {
        cohortId: cohort.id,
        cohortName: cohort.name,
        forecastedImpactScore: forecastedScore,
        direction,
        memberCount: customerIds.length,
      };
    });

    // Net cohort impact score = sum of positive impacts - sum of |negative impacts|
    // Weighted by member count
    const netScore = cohortForecasts.reduce((acc, cf) => {
      const weightedImpact = cf.forecastedImpactScore * cf.memberCount;
      return acc + weightedImpact;
    }, 0);

    return {
      release,
      netCohortImpactScore: Math.round(netScore * 100) / 100,
      cohortForecasts,
    };
  });

  // Sort highest net impact first
  ranked.sort((a, b) => b.netCohortImpactScore - a.netCohortImpactScore);
  return ranked;
}

// ---------------------------------------------------------------------------
// Full release detail (AC2 + AC3 combined)
// ---------------------------------------------------------------------------

export function getReleaseDetail(release: FeatureReleaseRow): ReleaseDetail {
  if (release.status === 'released') {
    const kpiComparison = computeReleaseKpiComparison(release.release_date);
    const cohortImpacts = computeCohortImpacts(release.release_date);

    const positiveImpacts = cohortImpacts.filter(c => c.direction === 'positive').slice(0, 2);
    const negativeImpacts = cohortImpacts.filter(c => c.direction === 'negative').slice(0, 2);

    return {
      release,
      kpiComparison,
      cohortImpacts,
      topPositive: positiveImpacts,
      topNegative: negativeImpacts,
    };
  } else {
    // Planned — no historical KPI comparison
    const cohortImpacts = computeCohortImpacts(new Date().toISOString().slice(0, 10));
    return {
      release,
      kpiComparison: null,
      cohortImpacts,
      topPositive: cohortImpacts.filter(c => c.direction === 'positive').slice(0, 2),
      topNegative: cohortImpacts.filter(c => c.direction === 'negative').slice(0, 2),
    };
  }
}
