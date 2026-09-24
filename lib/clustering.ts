/**
 * K-means clustering engine for ML-driven cohort identification.
 *
 * Features used per customer:
 *   - avgEngagementEventsPerWeek
 *   - avgQuestCompletionPct
 *   - subscriptionTierLevel (0-4)
 *   - totalPurchaseAmount
 *   - daysSinceLastActivity
 *
 * Produces 5 named clusters with meaningful business labels.
 */

import { getDb } from './db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CustomerFeatures {
  customerId: string;
  avgEngagementPerWeek: number;
  avgQuestCompletion: number;
  tierLevel: number;
  totalPurchaseAmount: number;
  daysSinceLastActivity: number;
}

export interface MlCohort {
  id: string; // slug like "high-value-engaged"
  name: string;
  memberCount: number;
  summary: string;
  topSignals: TopSignal[];
  centroid: number[];
}

export interface TopSignal {
  label: string;
  value: string;
}

// ---------------------------------------------------------------------------
// Named cluster definitions (index → display info)
// ---------------------------------------------------------------------------

const CLUSTER_META: Array<{ id: string; name: string; summaryTemplate: (c: MlCohort, avg: number[]) => string }> = [
  {
    id: 'high-value-engaged',
    name: 'High-Value Engaged',
    summaryTemplate: (c) =>
      `High engagement, active purchasers — ${c.memberCount.toLocaleString()} members`,
  },
  {
    id: 'quest-graduates',
    name: 'Quest Graduates',
    summaryTemplate: (c) =>
      `Near or past quest completion — ${c.memberCount.toLocaleString()} members`,
  },
  {
    id: 'at-risk-disengaged',
    name: 'At-Risk Disengaged',
    summaryTemplate: (c) =>
      `Low recent activity, disengaging — ${c.memberCount.toLocaleString()} members`,
  },
  {
    id: 'new-joiners',
    name: 'New Joiners',
    summaryTemplate: (c) =>
      `Recent starts, low quest completion — ${c.memberCount.toLocaleString()} members`,
  },
  {
    id: 'passive-subscribers',
    name: 'Passive Subscribers',
    summaryTemplate: (c) =>
      `Active subscription, low engagement — ${c.memberCount.toLocaleString()} members`,
  },
];

// ---------------------------------------------------------------------------
// Data extraction
// ---------------------------------------------------------------------------

function extractCustomerFeatures(): CustomerFeatures[] {
  const db = getDb();

  // Discover the current snapshot month from product_data
  const monthRow = db.prepare(
    "SELECT MAX(month) as m FROM product_data WHERE subscription_status = 'active'"
  ).get() as { m: string | null };
  if (!monthRow?.m) return [];
  const month = monthRow.m;

  const tierToLevel: Record<string, number> = {
    'free': 0, 'plus': 1, 'tribe': 2, 'all access': 3, 'all access + live': 4,
  };

  // Sample directly in SQL using rowid modulo to avoid loading 175K rows into JS memory
  const totalRow = db.prepare(
    "SELECT COUNT(*) as n FROM product_data WHERE month = ? AND subscription_status = 'active'"
  ).get(month) as { n: number };
  const total = totalRow.n;
  if (total === 0) return [];
  const step = Math.max(1, Math.floor(total / 10000));

  const sampled = db.prepare(`
    SELECT
      auth0_user_id                                       AS customer_id,
      COALESCE(CAST(n_content_viewed AS REAL) / 4.0, 0) AS avg_engagement_per_week,
      COALESCE(total_quest_played, 0)                     AS total_quest_played,
      LOWER(COALESCE(tier, 'free'))                       AS tier_lower,
      COALESCE(lifetime_value, 0)                         AS lifetime_value,
      last_login_timestamp
    FROM product_data
    WHERE month = ? AND subscription_status = 'active'
      AND (rowid % ${step}) = 0
  `).all(month) as {
    customer_id: string;
    avg_engagement_per_week: number;
    total_quest_played: number;
    tier_lower: string;
    lifetime_value: number;
    last_login_timestamp: string | null;
  }[];

  // Scale factor projects sampled counts back to full population
  _populationScaleFactor = sampled.length > 0 ? total / sampled.length : 1;

  return sampled.map(row => ({
    customerId: row.customer_id,
    avgEngagementPerWeek: row.avg_engagement_per_week,
    avgQuestCompletion: Math.min(row.total_quest_played * 5, 100),
    tierLevel: tierToLevel[row.tier_lower] ?? 0,
    totalPurchaseAmount: row.lifetime_value,
    daysSinceLastActivity: row.last_login_timestamp ? daysDiff(row.last_login_timestamp) : 60,
  }));
}

// Scale factor so member counts reflect the full population, not just the sample
let _populationScaleFactor = 1;

function daysDiff(isoDate: string): number {
  const d = new Date(isoDate);
  const now = new Date();
  return Math.max(0, Math.round((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)));
}

// ---------------------------------------------------------------------------
// Feature normalisation (min-max to [0, 1])
// ---------------------------------------------------------------------------

function normalise(features: CustomerFeatures[]): { normalised: number[][]; min: number[]; max: number[] } {
  const keys: (keyof Omit<CustomerFeatures, 'customerId'>)[] = [
    'avgEngagementPerWeek',
    'avgQuestCompletion',
    'tierLevel',
    'totalPurchaseAmount',
    'daysSinceLastActivity',
  ];

  const min = keys.map(k => features.reduce((m, f) => Math.min(m, f[k] as number), Infinity));
  const max = keys.map(k => features.reduce((m, f) => Math.max(m, f[k] as number), -Infinity));

  const normalised = features.map(f =>
    keys.map((k, i) => {
      const range = max[i] - min[i];
      return range === 0 ? 0 : ((f[k] as number) - min[i]) / range;
    })
  );

  return { normalised, min, max };
}

// ---------------------------------------------------------------------------
// K-means implementation
// ---------------------------------------------------------------------------

function euclidean(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - b[i]) ** 2;
  }
  return Math.sqrt(sum);
}

function meanVector(points: number[][]): number[] {
  if (points.length === 0) return new Array(5).fill(0);
  const dim = points[0].length;
  const sums = new Array(dim).fill(0);
  for (const p of points) {
    for (let i = 0; i < dim; i++) sums[i] += p[i];
  }
  return sums.map(s => s / points.length);
}

function kmeans(
  points: number[][],
  k: number,
  maxIter = 50
): { assignments: number[]; centroids: number[][] } {
  const n = points.length;
  if (n === 0) return { assignments: [], centroids: [] };

  // Initialise centroids using k-means++ style spread selection
  const centroids: number[][] = [];
  // Pick first centroid randomly (deterministic seed)
  centroids.push([...points[Math.floor(points.length * 0.17)]]);

  for (let c = 1; c < k; c++) {
    // For each point, compute distance to nearest centroid
    const distances = points.map(p =>
      Math.min(...centroids.map(cent => euclidean(p, cent)))
    );
    const totalDist = distances.reduce((a, b) => a + b, 0);
    // Pick the point farthest from existing centroids (deterministic variant)
    let maxDist = -1;
    let maxIdx = 0;
    for (let i = 0; i < distances.length; i++) {
      if (distances[i] > maxDist) {
        maxDist = distances[i];
        maxIdx = i;
      }
    }
    centroids.push([...points[maxIdx]]);
  }

  let assignments = new Array(n).fill(0);

  for (let iter = 0; iter < maxIter; iter++) {
    // Assign
    const newAssignments = points.map(p => {
      let minDist = Infinity;
      let best = 0;
      for (let c = 0; c < k; c++) {
        const d = euclidean(p, centroids[c]);
        if (d < minDist) { minDist = d; best = c; }
      }
      return best;
    });

    // Check convergence
    const changed = newAssignments.some((a, i) => a !== assignments[i]);
    assignments = newAssignments;

    // Recompute centroids
    for (let c = 0; c < k; c++) {
      const clusterPoints = points.filter((_, i) => assignments[i] === c);
      if (clusterPoints.length > 0) {
        centroids[c] = meanVector(clusterPoints);
      }
    }

    if (!changed) break;
  }

  return { assignments, centroids };
}

// ---------------------------------------------------------------------------
// Map raw cluster index → named cohort
// ---------------------------------------------------------------------------

/**
 * Given 5 centroids (in normalised space), assign each to the best-matching
 * named cohort definition based on the centroid's feature profile.
 *
 * Features (indices):
 *   0: avgEngagementPerWeek   (higher = more engaged)
 *   1: avgQuestCompletion     (higher = more complete)
 *   2: tierLevel              (higher = better tier)
 *   3: totalPurchaseAmount    (higher = bigger spender)
 *   4: daysSinceLastActivity  (higher = more churned)
 */
function assignCohortNames(centroids: number[][]): number[] {
  // Score each centroid for each named cohort
  // Returns mapping: centroid index → CLUSTER_META index
  const k = centroids.length;

  // Compute a "profile score" for each (centroid, named-cluster) pair
  // Higher score = better match
  function profileScore(centroid: number[], metaIdx: number): number {
    const [eng, quest, tier, purchase, daysInactive] = centroid;
    switch (metaIdx) {
      case 0: // High-Value Engaged: high eng, high tier, high purchase, low inactive
        return eng * 3 + tier * 2 + purchase * 2 - daysInactive * 2;
      case 1: // Quest Graduates: high quest completion, moderate engagement
        return quest * 4 + eng * 1 - daysInactive;
      case 2: // At-Risk Disengaged: high days inactive, low engagement
        return daysInactive * 4 - eng * 3 - quest;
      case 3: // New Joiners: low quest completion, low purchase, low inactive (recently active)
        return -quest * 2 - purchase * 2 - daysInactive + 2;
      case 4: // Passive Subscribers: moderate tier, low engagement
        return tier * 2 - eng * 3 - quest;
      default: return 0;
    }
  }

  // Greedy assignment: pick best match for each meta cluster, no duplicates
  const used = new Set<number>();
  const metaAssignment = new Array(k).fill(-1); // centroid idx → meta idx

  // For each meta cluster (in priority order), find the best unassigned centroid
  for (let m = 0; m < CLUSTER_META.length && m < k; m++) {
    let bestCentroid = -1;
    let bestScore = -Infinity;
    for (let c = 0; c < k; c++) {
      if (used.has(c)) continue;
      const score = profileScore(centroids[c], m);
      if (score > bestScore) {
        bestScore = score;
        bestCentroid = c;
      }
    }
    if (bestCentroid >= 0) {
      metaAssignment[bestCentroid] = m;
      used.add(bestCentroid);
    }
  }

  // Fill any unassigned (shouldn't happen if k <= CLUSTER_META.length)
  for (let c = 0; c < k; c++) {
    if (metaAssignment[c] === -1) metaAssignment[c] = c % CLUSTER_META.length;
  }

  return metaAssignment;
}

// ---------------------------------------------------------------------------
// Build cohort top signals
// ---------------------------------------------------------------------------

function buildTopSignals(
  centroid: number[],
  metaIdx: number,
  memberCount: number,
  min: number[],
  max: number[]
): TopSignal[] {
  // Denormalise centroid back to real values
  const denorm = centroid.map((v, i) => v * (max[i] - min[i]) + min[i]);
  const [eng, quest, tier, purchase, daysInactive] = denorm;

  const tierNames = ['Free', 'Plus', 'Tribe', 'All Access', 'All Access + Live'];
  const tierName = tierNames[Math.round(Math.min(4, Math.max(0, tier)))] ?? 'Free';

  return [
    { label: 'Avg quest completion', value: `${Math.round(quest)}%` },
    { label: 'Avg weekly engagement events', value: Math.round(eng).toString() },
    { label: 'Most common tier', value: tierName },
    { label: 'Avg lifetime purchases', value: `$${Math.round(purchase).toLocaleString()}` },
    { label: 'Avg days since last activity', value: `${Math.round(daysInactive)} days` },
    { label: 'Member count', value: memberCount.toLocaleString() },
  ];
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

interface CacheEntry {
  cohorts: MlCohort[];
  computedAt: number;
}

let cache: CacheEntry | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getMLCohorts(forceRefresh = false): MlCohort[] {
  const now = Date.now();
  if (!forceRefresh && cache && now - cache.computedAt < CACHE_TTL_MS) {
    return cache.cohorts;
  }

  const features = extractCustomerFeatures();

  if (features.length === 0) {
    // Return empty cohorts
    const cohorts = CLUSTER_META.map(meta => ({
      id: meta.id,
      name: meta.name,
      memberCount: 0,
      summary: `${meta.name} — no data yet`,
      topSignals: [],
      centroid: [],
    }));
    cache = { cohorts, computedAt: now };
    return cohorts;
  }

  const K = Math.min(5, CLUSTER_META.length);
  const scaleFactor = _populationScaleFactor;
  const { normalised, min, max } = normalise(features);
  const { assignments, centroids } = kmeans(normalised, K);

  // Count members per cluster and scale back to full population size
  const rawCounts = new Array(K).fill(0);
  for (const a of assignments) rawCounts[a]++;
  const counts = rawCounts.map(c => Math.round(c * scaleFactor));

  // Map cluster indices to named cohorts
  const centroidToMeta = assignCohortNames(centroids);

  // Build MlCohort objects
  const cohorts: MlCohort[] = [];
  for (let c = 0; c < K; c++) {
    const metaIdx = centroidToMeta[c];
    const meta = CLUSTER_META[metaIdx];
    const memberCount = counts[c];

    const topSignals = buildTopSignals(centroids[c], metaIdx, memberCount, min, max);
    const cohort: MlCohort = {
      id: meta.id,
      name: meta.name,
      memberCount,
      summary: meta.summaryTemplate({ id: meta.id, name: meta.name, memberCount, summary: '', topSignals, centroid: centroids[c] }, centroids[c]),
      topSignals,
      centroid: centroids[c],
    };
    cohorts.push(cohort);
  }

  // Sort by member count descending
  cohorts.sort((a, b) => b.memberCount - a.memberCount);

  cache = { cohorts, computedAt: now };
  return cohorts;
}

export function getMlCohortById(id: string): MlCohort | null {
  const cohorts = getMLCohorts();
  return cohorts.find(c => c.id === id) ?? null;
}
