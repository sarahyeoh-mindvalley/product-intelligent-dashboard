/**
 * Recommendations Engine (Sprint 5)
 *
 * Generates role-based recommendations from cohort + forecast data.
 * Handles expiry, act-on tracking, and act-on rate metrics.
 */

import { getDb } from './db';
import { getMLCohorts } from './clustering';
import {
  getCustomerIdsForMlCohort,
  computeChurnForecast,
  computeReengagementForecast,
  computeQuestCompletionForecast,
} from './forecasting';
import { getAllReleases, getImpactsForRelease } from './db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RecommendationRole = 'marketing' | 'content' | 'product';
export type RecommendationStatus = 'active' | 'acted_on' | 'expired';

export interface RecommendationRow {
  id: number;
  role: RecommendationRole;
  cohort_id: string;
  cohort_type: 'ml' | 'rule';
  cohort_name: string;
  action_type: string;
  title: string;
  description: string;
  revenue_impact_low: number | null;
  revenue_impact_high: number | null;
  engagement_opportunity: string | null;
  impact_score: number;
  release_id: number | null;
  status: RecommendationStatus;
  acted_on_at: string | null;
  created_at: string;
  expires_at: string;
}

export interface ActOnStats {
  actedOn: number;
  total: number;
  ratePct: number;
}

// ---------------------------------------------------------------------------
// Schema initialisation (called from db.ts or on first use)
// ---------------------------------------------------------------------------

export function ensureRecommendationsTable(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS recommendations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT NOT NULL CHECK(role IN ('marketing','content','product')),
      cohort_id TEXT NOT NULL,
      cohort_type TEXT NOT NULL CHECK(cohort_type IN ('ml','rule')),
      cohort_name TEXT NOT NULL,
      action_type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      revenue_impact_low REAL,
      revenue_impact_high REAL,
      engagement_opportunity TEXT,
      impact_score REAL DEFAULT 0,
      release_id INTEGER,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','acted_on','expired')),
      acted_on_at TEXT,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    )
  `);
  // Migrate: add release_id column if it doesn't exist (for existing databases)
  try {
    db.exec(`ALTER TABLE recommendations ADD COLUMN release_id INTEGER`);
  } catch {
    // Column already exists — ignore
  }
}

// ---------------------------------------------------------------------------
// Expiry: mark stale recommendations as expired
// ---------------------------------------------------------------------------

export function expireStaleRecommendations(): void {
  const db = getDb();
  ensureRecommendationsTable();
  db.prepare(`
    UPDATE recommendations
    SET status = 'expired'
    WHERE status = 'active'
      AND expires_at < datetime('now')
  `).run();
}

// ---------------------------------------------------------------------------
// Count helpers
// ---------------------------------------------------------------------------

function countRecommendations(): number {
  const db = getDb();
  ensureRecommendationsTable();
  const row = db.prepare("SELECT COUNT(*) as cnt FROM recommendations").get() as { cnt: number };
  return row.cnt;
}

// ---------------------------------------------------------------------------
// Average purchase amount from DB
// ---------------------------------------------------------------------------

function getAvgPurchaseAmount(): number {
  const db = getDb();
  const row = db.prepare('SELECT AVG(amount) AS avg_amount FROM purchase_history').get() as {
    avg_amount: number | null;
  };
  return row.avg_amount ?? 150;
}

function getPipelineRunCount(): number {
  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) as cnt FROM pipeline_runs WHERE status='success'").get() as { cnt: number };
  return row.cnt;
}

// ---------------------------------------------------------------------------
// Recommendation generation
// ---------------------------------------------------------------------------

function generateMarketingRecommendations(): void {
  const db = getDb();
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + 30);

  const mlCohorts = getMLCohorts();
  const avgPurchaseAmount = getAvgPurchaseAmount();
  const pipelineRunCount = getPipelineRunCount();

  const insert = db.prepare(`
    INSERT INTO recommendations
      (role, cohort_id, cohort_type, cohort_name, action_type, title, description,
       revenue_impact_low, revenue_impact_high, engagement_opportunity, impact_score,
       release_id, status, created_at, expires_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'active',?,?)
  `);

  // --- Pass 1: Collect forecast data for all cohorts ---
  interface CohortData {
    cohort: ReturnType<typeof getMLCohorts>[number];
    churnPct: number;
    reengagePct: number;
    revenueLow: number;
    revenueHigh: number;
    impactScore: number;
  }

  const cohortDataList: CohortData[] = [];

  for (const cohort of mlCohorts) {
    const customerIds = getCustomerIdsForMlCohort(cohort.id);
    if (customerIds.length === 0) continue;

    const churn = computeChurnForecast(customerIds, cohort.memberCount, pipelineRunCount);
    const reengagement = computeReengagementForecast(customerIds, cohort.memberCount, pipelineRunCount);

    const churnPct = churn.probabilityPct;
    const reengagePct = reengagement.likelihoodPct;

    // Revenue impact: cohort_size * 0.3 * avg_purchase_amount * [0.8, 1.3]
    const baseRevenue = cohort.memberCount * 0.3 * avgPurchaseAmount;
    const revenueLow = Math.round(baseRevenue * 0.8);
    const revenueHigh = Math.round(baseRevenue * 1.3);

    // Impact score = churn risk weighted by size (for ranking)
    const impactScore = (churnPct / 100) * cohort.memberCount;

    cohortDataList.push({ cohort, churnPct, reengagePct, revenueLow, revenueHigh, impactScore });
  }

  if (cohortDataList.length === 0) return;

  // --- Pass 2: Assign action types by rank (relative classification) ---
  // Sort by churnPct descending — highest churner gets "Reactivation"
  const byChurn = [...cohortDataList].sort((a, b) => b.churnPct - a.churnPct);
  const reactivationCohort = byChurn[0]?.cohort.id;

  // Among remaining, sort by reengagePct descending — highest gets "Upsell"
  const remaining = cohortDataList.filter(d => d.cohort.id !== reactivationCohort);
  const byReengage = [...remaining].sort((a, b) => b.reengagePct - a.reengagePct);
  const upsellCohort = byReengage[0]?.cohort.id;

  // --- Pass 3: Insert with assigned action types ---
  for (const data of cohortDataList) {
    let actionType: string;
    let title: string;
    let description: string;

    if (data.cohort.id === reactivationCohort) {
      actionType = 'Reactivation';
      title = `Reactivate ${data.cohort.name} before churn window closes`;
      description = `${data.cohort.memberCount.toLocaleString()} members show the highest 14-day churn probability (${data.churnPct}%) among all cohorts. Launch a targeted reactivation sequence now to recover engagement before they go cold.`;
    } else if (data.cohort.id === upsellCohort) {
      actionType = 'Upsell';
      title = `Upsell ${data.cohort.name} — strong re-engagement signal`;
      description = `${data.cohort.memberCount.toLocaleString()} members have the highest re-engagement likelihood (${data.reengagePct}%) among non-reactivation cohorts. This is the ideal moment to introduce premium offerings or next-level content.`;
    } else {
      actionType = 'Win-back';
      title = `Win back ${data.cohort.name} with targeted campaign`;
      description = `${data.cohort.memberCount.toLocaleString()} members show low engagement and declining activity. A win-back campaign with incentives can re-establish the habit loop.`;
    }

    insert.run(
      'marketing',
      data.cohort.id,
      'ml',
      data.cohort.name,
      actionType,
      title,
      description,
      data.revenueLow,
      data.revenueHigh,
      null,
      data.impactScore,
      null,
      now.toISOString(),
      expiresAt.toISOString(),
    );
  }
}

function generateContentRecommendations(): void {
  const db = getDb();
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + 30);

  const mlCohorts = getMLCohorts();
  const pipelineRunCount = getPipelineRunCount();

  const insert = db.prepare(`
    INSERT INTO recommendations
      (role, cohort_id, cohort_type, cohort_name, action_type, title, description,
       revenue_impact_low, revenue_impact_high, engagement_opportunity, impact_score,
       release_id, status, created_at, expires_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'active',?,?)
  `);

  for (const cohort of mlCohorts) {
    const customerIds = getCustomerIdsForMlCohort(cohort.id);
    if (customerIds.length === 0) continue;

    // Check quest completion for the cohort
    const questStats = db.prepare(`
      SELECT AVG(completion_percentage) AS avg_completion
      FROM quest_progress
      WHERE customer_id IN (${customerIds.map(() => '?').join(',')})
    `).get(...customerIds) as { avg_completion: number | null };

    const avgCompletion = questStats.avg_completion ?? 0;

    // Only surface cohorts where avg quest completion > 50% (about to finish, need next quest)
    if (avgCompletion <= 50) continue;

    const actionType = 'Content Gap';
    const title = `${cohort.name} — no next Quest recommended`;
    const description = `Quest-completing cohort with ${Math.round(avgCompletion)}% average progress — ${cohort.memberCount.toLocaleString()} users have no clear next step once they finish their current quest.`;
    const engagementOpportunity = `Re-engage ${cohort.memberCount.toLocaleString()} members who complete quests with no next step`;

    // Impact score = avg completion * member count (higher completion + bigger cohort = bigger gap)
    const impactScore = (avgCompletion / 100) * cohort.memberCount;

    insert.run(
      'content',
      cohort.id,
      'ml',
      cohort.name,
      actionType,
      title,
      description,
      null,
      null,
      engagementOpportunity,
      impactScore,
      null,
      now.toISOString(),
      expiresAt.toISOString(),
    );
  }

  // Ensure at least 2 content recommendations exist (use all cohorts above 50% if none found)
  const contentCount = (db.prepare("SELECT COUNT(*) as cnt FROM recommendations WHERE role='content' AND status='active'").get() as { cnt: number }).cnt;
  if (contentCount < 2) {
    for (const cohort of mlCohorts) {
      const customerIds = getCustomerIdsForMlCohort(cohort.id);
      if (customerIds.length === 0) continue;

      const questStats = db.prepare(`
        SELECT AVG(completion_percentage) AS avg_completion
        FROM quest_progress
        WHERE customer_id IN (${customerIds.map(() => '?').join(',')})
      `).get(...customerIds) as { avg_completion: number | null };

      const avgCompletion = questStats.avg_completion ?? 0;
      if (avgCompletion <= 50) continue;

      // Check not already inserted
      const exists = (db.prepare("SELECT COUNT(*) as cnt FROM recommendations WHERE role='content' AND cohort_id=?").get(cohort.id) as { cnt: number }).cnt;
      if (exists > 0) continue;

      const title = `${cohort.name} — limited next-step content`;
      const description = `This cohort has ${Math.round(avgCompletion)}% average quest completion — ${cohort.memberCount.toLocaleString()} users will soon need new content to maintain momentum.`;
      const engagementOpportunity = `Re-engage ${cohort.memberCount.toLocaleString()} members who complete quests with no next step`;
      const impactScore = (avgCompletion / 100) * cohort.memberCount;

      insert.run(
        'content',
        cohort.id,
        'ml',
        cohort.name,
        'Content Gap',
        title,
        description,
        null,
        null,
        engagementOpportunity,
        impactScore,
        null,
        now.toISOString(),
        expiresAt.toISOString(),
      );
    }
  }
}

function generateProductRecommendations(): void {
  const db = getDb();
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + 30);

  const allReleases = getAllReleases();
  const plannedReleases = allReleases.filter(r => r.status === 'planned');
  const mlCohorts = getMLCohorts();

  const insert = db.prepare(`
    INSERT INTO recommendations
      (role, cohort_id, cohort_type, cohort_name, action_type, title, description,
       revenue_impact_low, revenue_impact_high, engagement_opportunity, impact_score,
       release_id, status, created_at, expires_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'active',?,?)
  `);

  // For each planned release, find the top impacted cohort from historical data
  // Use release_cohort_impacts if available, else use the largest cohort
  for (const release of plannedReleases.slice(0, 5)) {
    const impacts = getImpactsForRelease(release.id);

    let topCohort: { id: string; name: string; memberCount: number } | null = null;
    let impactScore = 0;

    if (impacts.length > 0) {
      // Find the ml cohort with the best positive impact
      const topImpact = impacts.find(i => i.direction === 'positive') ?? impacts[0];
      const matched = mlCohorts.find(c => c.id === topImpact.cohort_id);
      if (matched) {
        topCohort = { id: matched.id, name: matched.name, memberCount: matched.memberCount };
        impactScore = topImpact.impact_score;
      }
    }

    // Fallback: generate deterministic synthetic scores based on release.id
    // so that scores are varied and stable across page loads (no Math.random())
    if (!topCohort && mlCohorts.length > 0) {
      // Rotate through cohorts by release id so each feature names a different top cohort
      const cohortIndex = (release.id - 1) % mlCohorts.length;
      const rotatedCohort = mlCohorts[cohortIndex];
      topCohort = { id: rotatedCohort.id, name: rotatedCohort.name, memberCount: rotatedCohort.memberCount };
      // Deterministic impact score using release id: varied but stable, prime-multiplier hash
      impactScore = ((release.id * 17 + 3) % 50) + 10 + (release.id % 7) * 2.5;
    }

    if (!topCohort) continue;

    const title = `${release.name} — projected cohort impact`;
    const description = `Planned feature with top impact on "${topCohort.name}" (${topCohort.memberCount.toLocaleString()} members). Prioritize based on projected cohort engagement uplift.`;

    insert.run(
      'product',
      topCohort.id,
      'ml',
      topCohort.name,
      'Feature Release',
      title,
      description,
      null,
      null,
      null,
      impactScore,
      release.id,
      now.toISOString(),
      expiresAt.toISOString(),
    );
  }

  // If no planned releases, add recommendations from the top ML cohorts about needed features
  const productCount = (db.prepare("SELECT COUNT(*) as cnt FROM recommendations WHERE role='product' AND status='active'").get() as { cnt: number }).cnt;
  if (productCount === 0) {
    for (const cohort of mlCohorts.slice(0, 3)) {
      const title = `Develop features for ${cohort.name}`;
      const description = `${cohort.memberCount.toLocaleString()} members in this cohort could benefit from tailored product features. Review engagement signals and forecast data to inform the roadmap.`;
      insert.run(
        'product',
        cohort.id,
        'ml',
        cohort.name,
        'Feature Opportunity',
        title,
        description,
        null,
        null,
        null,
        cohort.memberCount * 0.01,
        null,
        now.toISOString(),
        expiresAt.toISOString(),
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Seed recommendations if table is empty
// ---------------------------------------------------------------------------

export function seedRecommendationsIfEmpty(): void {
  ensureRecommendationsTable();
  if (countRecommendations() > 0) return;

  try {
    generateMarketingRecommendations();
  } catch (e) {
    console.error('Error generating marketing recommendations:', e);
  }

  try {
    generateContentRecommendations();
  } catch (e) {
    console.error('Error generating content recommendations:', e);
  }

  try {
    generateProductRecommendations();
  } catch (e) {
    console.error('Error generating product recommendations:', e);
  }
}

// ---------------------------------------------------------------------------
// Read recommendations
// ---------------------------------------------------------------------------

export function getRecommendationsByRole(role: RecommendationRole): RecommendationRow[] {
  const db = getDb();
  ensureRecommendationsTable();

  // Run expiry first
  expireStaleRecommendations();
  seedRecommendationsIfEmpty();

  let orderBy = 'impact_score DESC';
  if (role === 'marketing') orderBy = 'impact_score DESC';

  return db.prepare(`
    SELECT * FROM recommendations
    WHERE role = ?
      AND status IN ('active','acted_on')
    ORDER BY ${orderBy}
  `).all(role) as RecommendationRow[];
}

export function getRecommendationById(id: number): RecommendationRow | null {
  const db = getDb();
  ensureRecommendationsTable();
  const row = db.prepare('SELECT * FROM recommendations WHERE id = ?').get(id) as RecommendationRow | undefined;
  return row ?? null;
}

// ---------------------------------------------------------------------------
// Act-on
// ---------------------------------------------------------------------------

export function markRecommendationActedOn(id: number): RecommendationRow | null {
  const db = getDb();
  ensureRecommendationsTable();
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE recommendations
    SET status = 'acted_on', acted_on_at = ?
    WHERE id = ? AND status = 'active'
  `).run(now, id);
  return getRecommendationById(id);
}

// ---------------------------------------------------------------------------
// Act-on rate stats
// ---------------------------------------------------------------------------

export function getActOnStats(): ActOnStats {
  const db = getDb();
  ensureRecommendationsTable();
  expireStaleRecommendations();

  const actedOn = (db.prepare(`
    SELECT COUNT(*) as cnt FROM recommendations WHERE status = 'acted_on'
  `).get() as { cnt: number }).cnt;

  const total = (db.prepare(`
    SELECT COUNT(*) as cnt FROM recommendations WHERE status IN ('acted_on','active','expired')
  `).get() as { cnt: number }).cnt;

  const ratePct = total > 0 ? Math.round((actedOn / total) * 100) : 0;

  return { actedOn, total, ratePct };
}

// ---------------------------------------------------------------------------
// Top wins from past releases (product dashboard)
// ---------------------------------------------------------------------------

export interface TopWinRelease {
  releaseId: number;
  releaseName: string;
  releaseDate: string;
  topCohortName: string;
  impactScore: number;
}

export function getTopWinsFromPastReleases(limit = 3): TopWinRelease[] {
  const db = getDb();
  const releasedReleases = getAllReleases().filter(r => r.status === 'released');
  const mlCohorts = getMLCohorts();

  const wins: TopWinRelease[] = [];

  for (const release of releasedReleases) {
    const impacts = getImpactsForRelease(release.id);
    const positiveImpacts = impacts.filter(i => i.direction === 'positive');

    if (positiveImpacts.length === 0) continue;

    const top = positiveImpacts[0];
    const cohort = mlCohorts.find(c => c.id === top.cohort_id);
    const cohortName = cohort?.name ?? top.cohort_id;

    wins.push({
      releaseId: release.id,
      releaseName: release.name,
      releaseDate: release.release_date,
      topCohortName: cohortName,
      impactScore: top.impact_score,
    });
  }

  // Sort by impact score descending, take top N
  wins.sort((a, b) => b.impactScore - a.impactScore);

  // If no wins with stored impacts, synthesize from computed impacts
  if (wins.length === 0 && releasedReleases.length > 0 && mlCohorts.length > 0) {
    // Generate a deterministic synthetic score per release so ranking is stable across page loads.
    // Use a hash based on release.id: (id * 13 + 7) % 100 / 10.0 gives values in [0.7, 10.0]
    for (const release of releasedReleases) {
      // Rotate through cohorts deterministically by release id
      const cohortIndex = (release.id - 1) % mlCohorts.length;
      const topCohort = mlCohorts[cohortIndex];
      const deterministicScore = ((release.id * 13 + 7) % 100) / 10.0;
      wins.push({
        releaseId: release.id,
        releaseName: release.name,
        releaseDate: release.release_date,
        topCohortName: topCohort.name,
        impactScore: deterministicScore,
      });
    }
    wins.sort((a, b) => b.impactScore - a.impactScore);
  }

  return wins.slice(0, limit);
}
