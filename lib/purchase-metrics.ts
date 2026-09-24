/**
 * purchase-metrics.ts
 *
 * Loads l26weeks_product_metric_v2.json — one row per purchase event.
 * Seeds one row per (user_id, purchase_week) so users with purchases in
 * multiple weeks appear in each of those week's cohorts.
 *
 * Exposes:
 *   seedPurchaseMetricsIfNeeded()
 *   getWeeklyMetrics(filters?)
 *   getFilterOptions()
 */

import path from 'path';
import fs from 'fs';
import { getDb } from './db';

const DATA_PATH = path.join(process.cwd(), 'data', 'l52weeks_product_metric_v8.json');

// Schema version — bump whenever the table structure changes so the DB is rebuilt.
const SCHEMA_VERSION = 20;

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

function ensureTable(): void {
  const db = getDb();

  // Create a metadata table to track schema version
  db.exec(`
    CREATE TABLE IF NOT EXISTS purchase_cohorts_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  const versionRow = db.prepare('SELECT value FROM purchase_cohorts_meta WHERE key = ?').get('schema_version') as { value: string } | undefined;
  const existingVersion = versionRow ? parseInt(versionRow.value, 10) : 0;

  if (existingVersion !== SCHEMA_VERSION) {
    // Drop and recreate with the new schema
    db.exec(`
      DROP TABLE IF EXISTS purchase_cohorts;
      DROP INDEX IF EXISTS idx_pc_week;
      DROP INDEX IF EXISTS idx_pc_traffic;
      DROP INDEX IF EXISTS idx_pc_campaign;
    `);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS purchase_cohorts (
      purchase_record_id TEXT NOT NULL PRIMARY KEY,
      user_id TEXT NOT NULL,
      purchase_week TEXT NOT NULL,
      purchase_date TEXT NOT NULL,
      days_to_login INTEGER,
      days_to_activation INTEGER,
      traffic_source TEXT,
      campaign_type TEXT,
      payment_frequency TEXT,
      device_category TEXT,
      has_discount INTEGER DEFAULT 0,
      order_amount REAL,
      product_funnel TEXT,
      is_mc_funnel INTEGER DEFAULT 0,
      is_vsl_funnel INTEGER DEFAULT 0,
      is_first_order INTEGER DEFAULT 0,
      order_type TEXT,
      place_in_funnel TEXT,
      product_type TEXT,
      has_funnel_quest INTEGER DEFAULT 0,
      product_name TEXT,
      days_to_cancel INTEGER,
      days_to_refund INTEGER,
      is_involuntary_churn INTEGER DEFAULT 0,
      country TEXT,
      payment_processor TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_pc_week ON purchase_cohorts(purchase_week);
    CREATE INDEX IF NOT EXISTS idx_pc_user ON purchase_cohorts(user_id);
    CREATE INDEX IF NOT EXISTS idx_pc_traffic ON purchase_cohorts(traffic_source);
    CREATE INDEX IF NOT EXISTS idx_pc_campaign ON purchase_cohorts(campaign_type);
    CREATE INDEX IF NOT EXISTS idx_pc_country ON purchase_cohorts(country);
    CREATE INDEX IF NOT EXISTS idx_pc_processor ON purchase_cohorts(payment_processor);
  `);

  // Record current schema version
  db.prepare('INSERT OR REPLACE INTO purchase_cohorts_meta (key, value) VALUES (?, ?)').run('schema_version', String(SCHEMA_VERSION));
}

// ---------------------------------------------------------------------------
// Helper: Monday of the ISO week for a given YYYY-MM-DD
// ---------------------------------------------------------------------------
function mondayOfWeek(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  const day = d.getUTCDay(); // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().substring(0, 10);
}

// ---------------------------------------------------------------------------
// Seed helpers — shared by JSON and BigQuery paths
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildPairMap(rows: any[]): Map<string, any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pairMap = new Map<string, any>();
  for (const r of rows) {
    const userId = r.user_id as string;
    if (!userId) continue;
    const recordId = r.purchase_record_id as string;
    if (!recordId) continue;
    const pDate = typeof r.purchase_timestamp === 'string'
      ? r.purchase_timestamp.substring(0, 10) : '';
    if (!pDate) continue;
    if (pairMap.has(recordId)) continue; // deduplicate JOIN fanout
    const week = mondayOfWeek(pDate);
    const hasQuest = r.has_funnel_quest_id === true || r.has_funnel_quest_id === 'true';
    pairMap.set(recordId, { ...r, _date: pDate, _week: week, _has_quest: hasQuest });
  }
  return pairMap;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function insertPairMap(db: ReturnType<typeof getDb>, pairMap: Map<string, any>): void {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO purchase_cohorts (
      purchase_record_id, user_id, purchase_week, purchase_date,
      days_to_login, days_to_activation,
      traffic_source, campaign_type, payment_frequency, device_category,
      has_discount, order_amount, product_funnel,
      is_mc_funnel, is_vsl_funnel, is_first_order,
      order_type, place_in_funnel, product_type, has_funnel_quest,
      product_name, days_to_cancel, days_to_refund, is_involuntary_churn,
      country, payment_processor
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);

  const insertAll = db.transaction(() => {
    for (const [recordId, r] of pairMap.entries()) {
      const userId = r.user_id as string;
      const pDate = r._date as string;
      const week = r._week as string;

      const rawLogin = r.days_to_first_login;
      const daysLogin = rawLogin !== undefined && rawLogin !== null && rawLogin !== ''
        ? parseInt(String(rawLogin), 10) : null;
      const loginVal = daysLogin !== null && !isNaN(daysLogin) ? daysLogin : null;

      const rawAct = r.days_to_first_activation;
      const daysAct = rawAct !== undefined && rawAct !== null && rawAct !== ''
        ? parseInt(String(rawAct), 10) : null;
      const actVal = daysAct !== null && !isNaN(daysAct) ? daysAct : null;

      const orderAmt = r.order_amount !== undefined && r.order_amount !== null
        ? parseFloat(String(r.order_amount)) : null;

      // Normalise payment frequency: "1" → "Monthly", "12" → "Yearly", "36" → "3-Year"
      const rawFreq = String(r.payment_frequency ?? '');
      const freq = rawFreq === '1' ? 'Monthly' : rawFreq === '12' ? 'Yearly' : rawFreq === '36' ? '3-Year' : rawFreq || null;

      const trafficSrc = (r.unified_traffic_source as string) || null;
      const campaignType = (r.campaign_type as string) || null;
      const device = (r.device_category as string) || null;
      const funnel = (r.product_funnel as string) || null;
      const hasDiscount = r.discount_id !== undefined && r.discount_id !== null ? 1 : 0;
      const isMC = r.is_mc_funnel === true || r.is_mc_funnel === 'true' ? 1 : 0;
      const isVSL = r.is_vsl_funnel === true || r.is_vsl_funnel === 'true' ? 1 : 0;
      const isFirst = r.is_first_order === true || r.is_first_order === 'true' ? 1 : 0;
      const orderType = (r.order_type as string) || null;
      const placeInFunnel = (r.place_in_funnel as string) || null;
      const productType = (r.product_type as string) || null;
      const hasFunnelQuest = r._has_quest ? 1 : 0;
      const productName = (r.product_name as string) || null;

      let daysToCancel: number | null = null;
      const rawCanceledAt = r.canceled_at as string | undefined;
      if (rawCanceledAt) {
        const cancelMs = new Date(rawCanceledAt.replace(' UTC', 'Z')).getTime();
        const purchaseMs = new Date(pDate + 'T00:00:00Z').getTime();
        const diff = Math.round((cancelMs - purchaseMs) / (1000 * 60 * 60 * 24));
        if (!isNaN(diff) && diff >= 0) daysToCancel = diff;
      }

      let daysToRefund: number | null = null;
      const rawRefundAt = r.refund_timestamp as string | undefined;
      if (rawRefundAt) {
        const refundMs = new Date(rawRefundAt.replace(' UTC', 'Z')).getTime();
        const purchaseMs = new Date(pDate + 'T00:00:00Z').getTime();
        const diff = Math.round((refundMs - purchaseMs) / (1000 * 60 * 60 * 24));
        if (!isNaN(diff) && diff >= 0) daysToRefund = diff;
      }

      const isInvoluntaryChurn = r.is_involuntary_churn === true || r.is_involuntary_churn === 'true' ? 1 : 0;

      const rawCountry = (r.country as string | undefined) ?? '';
      const countryMap: Record<string, string> = { US: 'US', GB: 'UK', AU: 'Australia', CA: 'Canada', DE: 'Germany' };
      const country = rawCountry && rawCountry !== 'Not Available'
        ? (countryMap[rawCountry] ?? 'RoW') : null;

      const rawSource = (r.source as string) || '';
      const rawPaymentMethod = (r.payment_method_type as string) || '';
      let paymentProcessor: string | null = null;
      if (rawSource === 'apple_app_store') paymentProcessor = 'Apple';
      else if (rawSource === 'google_play_store') paymentProcessor = 'Google Play';
      else if (rawPaymentMethod === 'paypal') paymentProcessor = 'PayPal';
      else if (rawPaymentMethod === 'card' || rawPaymentMethod === 'creditcard' || rawPaymentMethod === '') paymentProcessor = 'Card';
      else if (rawPaymentMethod === 'klarna') paymentProcessor = 'Klarna';

      insert.run(
        recordId, userId, week, pDate,
        loginVal, actVal,
        trafficSrc, campaignType, freq, device,
        hasDiscount, isNaN(orderAmt ?? NaN) ? null : orderAmt,
        funnel, isMC, isVSL, isFirst,
        orderType, placeInFunnel, productType, hasFunnelQuest,
        productName, daysToCancel, daysToRefund, isInvoluntaryChurn,
        country, paymentProcessor
      );
    }
  });

  insertAll();
}

// ---------------------------------------------------------------------------
// Seed — BigQuery path (primary)
// ---------------------------------------------------------------------------

/**
 * Seed purchase_cohorts from rows returned by BigQuery (via sql.md).
 * Clears the table first so this is always a full refresh.
 */
export function seedFromBigQueryRows(rows: Record<string, unknown>[]): void {
  ensureTable();
  const db = getDb();
  db.exec('DELETE FROM purchase_cohorts');
  const pairMap = buildPairMap(rows);
  insertPairMap(db, pairMap);
}

/**
 * Auto-seed: tries BigQuery first (if credentials are configured), then
 * falls back to the local JSON file. No-ops if the table already has rows.
 * Call this from server components instead of seedPurchaseMetricsIfNeeded().
 */
export async function seedPurchaseMetricsAuto(): Promise<void> {
  try {
    ensureTable();
    const db = getDb();
    const { cnt } = db.prepare('SELECT COUNT(*) as cnt FROM purchase_cohorts').get() as { cnt: number };
    if (cnt > 0) return; // already populated

    const hasBigQueryCreds = !!process.env.GCP_PROJECT_ID &&
      !!(process.env.GCP_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS);

    if (hasBigQueryCreds) {
      const { runQuery } = await import('./bigquery');
      const { loadSql } = await import('./sql-loader');
      console.log('[purchase-metrics] Seeding from BigQuery…');
      const sql = loadSql();
      const rows = await runQuery(sql);
      console.log(`[purchase-metrics] Got ${rows.length} rows from BigQuery`);
      seedFromBigQueryRows(rows);
    } else {
      seedPurchaseMetricsIfNeeded();
    }
  } catch (e) {
    console.error('[purchase-metrics] auto-seed error:', e);
  }
}

// ---------------------------------------------------------------------------
// Seed — JSON fallback (local dev without BigQuery credentials)
// ---------------------------------------------------------------------------

export function seedPurchaseMetricsIfNeeded(): void {
  try {
    ensureTable();
    const db = getDb();
    const count = (db.prepare('SELECT COUNT(*) as cnt FROM purchase_cohorts').get() as { cnt: number }).cnt;
    if (count > 0) return;
    if (!fs.existsSync(DATA_PATH)) return;

    const CHUNK = 65536;
    const fd = fs.openSync(DATA_PATH, 'r');
    const buf = Buffer.alloc(CHUNK);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawRows: any[] = [];
    let leftover = '';
    let bytesRead = 0;

    try {
      while ((bytesRead = fs.readSync(fd, buf, 0, CHUNK, null)) > 0) {
        const text = leftover + buf.subarray(0, bytesRead).toString('utf-8');
        const lines = text.split('\n');
        leftover = lines.pop() ?? '';
        for (const line of lines) {
          const t = line.trim();
          if (!t) continue;
          try { rawRows.push(JSON.parse(t)); } catch { continue; }
        }
      }
      const t = leftover.trim();
      if (t) { try { rawRows.push(JSON.parse(t)); } catch { /* ignore */ } }
    } finally {
      fs.closeSync(fd);
    }

    const pairMap = buildPairMap(rawRows);
    insertPairMap(db, pairMap);
  } catch (e) {
    console.error('[purchase-metrics] seed error:', e);
  }
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export interface PurchaseFilters {
  traffic_source?: string;
  campaign_type?: string;
  payment_frequency?: string;
  device_category?: string;
  has_discount?: 'yes' | 'no';
  min_price?: number;
  max_price?: number;
  product_funnel?: string;
  is_mc_funnel?: '1';
  is_vsl_funnel?: '1';
  is_first_order?: '1';
  order_type?: string;
  place_in_funnel?: string;
  product_type?: string;
  has_funnel_quest?: 'yes' | 'no';
  product_name?: string;
  country?: string;
}

function buildWhere(filters: PurchaseFilters): { where: string; params: unknown[] } {
  // Exclude records with no order_type — data-quality gaps in the export
  // Exclude Masters of Manifesting — all rows are 'Not Applicable' and skew product breakdown
  const clauses: string[] = ['order_type IS NOT NULL', `product_name != 'Masters of Manifesting'`];
  const params: unknown[] = [];

  if (filters.traffic_source) {
    clauses.push('traffic_source = ?');
    params.push(filters.traffic_source);
  }
  if (filters.campaign_type) {
    clauses.push('campaign_type = ?');
    params.push(filters.campaign_type);
  }
  if (filters.payment_frequency) {
    clauses.push('payment_frequency = ?');
    params.push(filters.payment_frequency);
  }
  if (filters.device_category) {
    clauses.push('device_category = ?');
    params.push(filters.device_category);
  }
  if (filters.has_discount === 'yes') {
    clauses.push('has_discount = 1');
  } else if (filters.has_discount === 'no') {
    clauses.push('has_discount = 0');
  }
  if (filters.min_price !== undefined) {
    clauses.push('order_amount >= ?');
    params.push(filters.min_price);
  }
  if (filters.max_price !== undefined) {
    clauses.push('order_amount <= ?');
    params.push(filters.max_price);
  }
  if (filters.product_funnel) {
    clauses.push('product_funnel = ?');
    params.push(filters.product_funnel);
  }
  if (filters.is_mc_funnel === '1') {
    clauses.push('is_mc_funnel = 1');
  }
  if (filters.is_vsl_funnel === '1') {
    clauses.push('is_vsl_funnel = 1');
  }
  if (filters.is_first_order === '1') {
    clauses.push('is_first_order = 1');
  }
  if (filters.order_type) {
    clauses.push('order_type = ?');
    params.push(filters.order_type);
  }
  if (filters.place_in_funnel) {
    clauses.push('place_in_funnel = ?');
    params.push(filters.place_in_funnel);
  }
  if (filters.product_type) {
    clauses.push('product_type = ?');
    params.push(filters.product_type);
  }
  if (filters.has_funnel_quest === 'yes') {
    clauses.push('has_funnel_quest = 1');
  } else if (filters.has_funnel_quest === 'no') {
    clauses.push('has_funnel_quest = 0');
  }
  if (filters.product_name) {
    clauses.push('product_name = ?');
    params.push(filters.product_name);
  }
  if (filters.country) {
    clauses.push('country = ?');
    params.push(filters.country);
  }

  return {
    where: clauses.length > 0 ? 'WHERE ' + clauses.join(' AND ') : '',
    params,
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export interface WeeklyMetricRow {
  week: string;       // YYYY-MM-DD (Monday)
  weekLabel: string;  // e.g. "Feb 23"
  total: number;
  loginEligible: number; // rows where order_type IN ('New','Trial') AND is_first_order=1
  day0LoginPct: number;
  day7LoginPct: number;
  day15ActPct: number;
  day30ActPct: number;
  isMature30: boolean; // cohort is 30+ days old
  isMature15: boolean;
  isMature7: boolean;
}

export const SNAPSHOT_DATE = '2026-09-11';

export function getWeeklyMetrics(filters: PurchaseFilters = {}): WeeklyMetricRow[] {
  const db = getDb();
  const { where, params } = buildWhere(filters);

  // Login metrics denominator: only New/Trial first orders (matches BQ definition)
  const rows = db.prepare(`
    SELECT
      purchase_week as week,
      COUNT(DISTINCT user_id) as total,
      COUNT(DISTINCT CASE WHEN order_type IN ('New','Trial') AND is_first_order = 1 THEN user_id END) as login_eligible,
      ROUND(
        COUNT(DISTINCT CASE WHEN order_type IN ('New','Trial') AND is_first_order = 1 AND days_to_login IS NOT NULL AND days_to_login = 0 THEN user_id END)
        * 100.0 / NULLIF(COUNT(DISTINCT CASE WHEN order_type IN ('New','Trial') AND is_first_order = 1 THEN user_id END), 0)
      , 1) as day0_login,
      ROUND(
        COUNT(DISTINCT CASE WHEN order_type IN ('New','Trial') AND is_first_order = 1 AND days_to_login IS NOT NULL AND days_to_login <= 7 THEN user_id END)
        * 100.0 / NULLIF(COUNT(DISTINCT CASE WHEN order_type IN ('New','Trial') AND is_first_order = 1 THEN user_id END), 0)
      , 1) as day7_login,
      ROUND(COUNT(DISTINCT CASE WHEN days_to_activation IS NOT NULL AND days_to_activation <= 15 THEN user_id END) * 100.0 / NULLIF(COUNT(DISTINCT user_id), 0), 1) as day15_act,
      ROUND(COUNT(DISTINCT CASE WHEN days_to_activation IS NOT NULL AND days_to_activation <= 30 THEN user_id END) * 100.0 / NULLIF(COUNT(DISTINCT user_id), 0), 1) as day30_act
    FROM purchase_cohorts
    ${where}
    GROUP BY purchase_week
    ORDER BY purchase_week ASC
  `).all(...params) as {
    week: string;
    total: number;
    login_eligible: number;
    day0_login: number;
    day7_login: number;
    day15_act: number;
    day30_act: number;
  }[];

  return rows.map(r => {
    const daysOld = Math.floor(
      (new Date(SNAPSHOT_DATE).getTime() - new Date(r.week).getTime()) / (1000 * 60 * 60 * 24)
    );
    return {
      week: r.week,
      weekLabel: new Date(r.week + 'T00:00:00Z').toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', timeZone: 'UTC',
      }),
      total: r.total,
      loginEligible: r.login_eligible ?? 0,
      day0LoginPct: r.day0_login ?? 0,
      day7LoginPct: r.day7_login ?? 0,
      day15ActPct: r.day15_act ?? 0,
      day30ActPct: r.day30_act ?? 0,
      isMature7: daysOld >= 14,  // need a full week + buffer
      isMature15: daysOld >= 22,
      isMature30: daysOld >= 37,
    };
  });
}

export interface FilterOptions {
  trafficSources: string[];
  campaignTypes: string[];
  paymentFrequencies: string[];
  devices: string[];
  funnels: string[];
  orderTypes: string[];
  placeInFunnels: string[];
  productTypes: string[];
  productNames: string[];
  countries: string[];
}

export function getFilterOptions(): FilterOptions {
  const db = getDb();
  const distinct = (col: string) =>
    (db.prepare(`SELECT DISTINCT ${col} as v FROM purchase_cohorts WHERE ${col} IS NOT NULL AND product_name != 'Masters of Manifesting' ORDER BY v`).all() as { v: string }[])
      .map(r => r.v)
      .filter(Boolean);

  return {
    trafficSources: distinct('traffic_source'),
    campaignTypes: distinct('campaign_type'),
    paymentFrequencies: distinct('payment_frequency'),
    devices: distinct('device_category'),
    funnels: distinct('product_funnel'),
    orderTypes: distinct('order_type'),
    placeInFunnels: distinct('place_in_funnel'),
    productTypes: distinct('product_type'),
    productNames: distinct('product_name'),
    countries: ['US', 'UK', 'Australia', 'Canada', 'Germany', 'RoW'],
  };
}

// ---------------------------------------------------------------------------
// Engage Team — Activation root cause analysis
// ---------------------------------------------------------------------------

export interface SegmentRate {
  total: number;
  day15Rate: number;
  prevDay15Rate: number | null;
  prevTotal: number;
}

export interface ProductShift {
  productName: string;
  prevShare: number;      // % of total volume in prior 4-week window
  recentShare: number;    // % of total volume in recent 4-week window
  prevDay15: number;      // Day 15 rate in prior window
  recentDay15: number;    // Day 15 rate in recent window
  recentCount: number;    // user count in recent window
  prevQuestShare: number;    // % with funnel quest in prior window
  recentQuestShare: number;  // % with funnel quest in recent window
}

export interface DropoffAnalysis {
  weekRange: { min: string; max: string };
  overall: SegmentRate;
  // MC funnel split
  mcFunnel: SegmentRate;
  nonMcFunnel: SegmentRate;
  // Funnel quest split (uses has_funnel_quest column)
  hasQuest: SegmentRate;
  noQuest: SegmentRate;
  // Payment frequency — three separate buckets
  monthlyCustomers: SegmentRate;
  annualCustomers: SegmentRate;
  threeYearCustomers: SegmentRate;
  // Problem segment: MC + no quest
  problemSegment: SegmentRate;
  // Best segment: non-MC + has quest
  bestSegment: SegmentRate;
  // Top products by recent volume, with share/rate changes vs prior window
  topProductShifts: ProductShift[];
}

// ---------------------------------------------------------------------------
// Segment comparison (last 4 complete weeks)
// ---------------------------------------------------------------------------

export interface SegmentRow {
  label: string;
  total: number;
  loginEligible: number;
  day0LoginPct: number | null;
  day7LoginPct: number | null;
  day15ActPct: number | null;
  // 12-week baseline averages
  baselineTotal: number;
  baselineDay0LoginPct: number | null;
  baselineDay7LoginPct: number | null;
  baselineDay15ActPct: number | null;
  /** Refund rate (within 15d of purchase) — excludes Trial/Not Applicable */
  refundRate: number | null;
  baselineRefundRate: number | null;
  /** YYYY-MM-DD of the earliest week this segment label appears in the dataset */
  firstWeek?: string;
}

export interface SegmentGroup {
  dimension: string;
  rows: SegmentRow[];
}

export function getSegmentComparison(filters: PurchaseFilters = {}, weeksCount = 4): SegmentGroup[] {
  const db = getDb();
  const { where, params } = buildWhere(filters);

  const completedCutoff = new Date(SNAPSHOT_DATE);
  completedCutoff.setUTCDate(completedCutoff.getUTCDate() - 7);
  const cutoffStr = completedCutoff.toISOString().substring(0, 10);

  // Recent N complete weeks
  const recentWeekRows = db.prepare(
    `SELECT DISTINCT purchase_week FROM purchase_cohorts WHERE purchase_week <= ? ORDER BY purchase_week DESC LIMIT ${weeksCount}`
  ).all(cutoffStr) as { purchase_week: string }[];
  if (recentWeekRows.length === 0) return [];
  const recentMax = recentWeekRows[0].purchase_week;
  const recentMin = recentWeekRows[recentWeekRows.length - 1].purchase_week;

  // Baseline: 12 weeks immediately before the recent window (weeks 5–16 looking back)
  // Skip the recent N weeks, then take the next 12.
  const baselineWeekRows = db.prepare(
    `SELECT DISTINCT purchase_week FROM purchase_cohorts WHERE purchase_week < ? ORDER BY purchase_week DESC LIMIT 12`
  ).all(recentMin) as { purchase_week: string }[];
  const baselineMax = baselineWeekRows[0]?.purchase_week ?? recentMax;
  const baselineMin = baselineWeekRows[baselineWeekRows.length - 1]?.purchase_week ?? recentMin;

  const recentRangeClause = where
    ? `${where} AND purchase_week BETWEEN ? AND ?`
    : `WHERE purchase_week BETWEEN ? AND ?`;
  const recentRangeParams: unknown[] = [...params, recentMin, recentMax];

  const baselineRangeClause = where
    ? `${where} AND purchase_week BETWEEN ? AND ?`
    : `WHERE purchase_week BETWEEN ? AND ?`;
  const baselineRangeParams: unknown[] = [...params, baselineMin, baselineMax];

  const SELECT_METRICS = `
    COUNT(DISTINCT user_id) as total,
    COUNT(DISTINCT CASE WHEN order_type IN ('New','Trial') AND is_first_order = 1 THEN user_id END) as login_eligible,
    ROUND(
      COUNT(DISTINCT CASE WHEN order_type IN ('New','Trial') AND is_first_order = 1 AND days_to_login IS NOT NULL AND days_to_login = 0 THEN user_id END)
      * 100.0 / NULLIF(COUNT(DISTINCT CASE WHEN order_type IN ('New','Trial') AND is_first_order = 1 THEN user_id END), 0)
    , 1) as day0_login,
    ROUND(
      COUNT(DISTINCT CASE WHEN order_type IN ('New','Trial') AND is_first_order = 1 AND days_to_login IS NOT NULL AND days_to_login <= 7 THEN user_id END)
      * 100.0 / NULLIF(COUNT(DISTINCT CASE WHEN order_type IN ('New','Trial') AND is_first_order = 1 THEN user_id END), 0)
    , 1) as day7_login,
    ROUND(COUNT(DISTINCT CASE WHEN days_to_activation IS NOT NULL AND days_to_activation <= 15 THEN user_id END) * 100.0 / NULLIF(COUNT(DISTINCT user_id), 0), 1) as day15_act,
    ROUND(
      COUNT(DISTINCT CASE WHEN days_to_refund IS NOT NULL AND days_to_refund <= 15 AND order_type NOT IN ('Trial', 'Not Applicable') THEN user_id END)
      * 100.0 / NULLIF(COUNT(DISTINCT CASE WHEN order_type NOT IN ('Trial', 'Not Applicable') THEN user_id END), 0)
    , 1) as refund_rate
  `;

  type RawMetrics = { total: number; login_eligible: number; day0_login: number; day7_login: number; day15_act: number; refund_rate: number };
  const EMPTY: RawMetrics = { total: 0, login_eligible: 0, day0_login: 0, day7_login: 0, day15_act: 0, refund_rate: 0 };

  function toRow(label: string, r: RawMetrics, b: RawMetrics): SegmentRow {
    const eligible = (r.login_eligible ?? 0) > 0;
    const bEligible = (b.login_eligible ?? 0) > 0;
    return {
      label,
      total: r.total,
      loginEligible: r.login_eligible ?? 0,
      day0LoginPct: eligible ? (r.day0_login ?? 0) : null,
      day7LoginPct: eligible ? (r.day7_login ?? 0) : null,
      day15ActPct: r.total > 0 ? (r.day15_act ?? 0) : null,
      baselineTotal: b.total,
      baselineDay0LoginPct: bEligible ? (b.day0_login ?? 0) : null,
      baselineDay7LoginPct: bEligible ? (b.day7_login ?? 0) : null,
      baselineDay15ActPct: b.total > 0 ? (b.day15_act ?? 0) : null,
      refundRate: r.total > 0 ? (r.refund_rate ?? 0) : null,
      baselineRefundRate: b.total > 0 ? (b.refund_rate ?? 0) : null,
    };
  }

  function queryFixedRecent(extra: string): RawMetrics {
    return (db.prepare(`SELECT ${SELECT_METRICS} FROM purchase_cohorts ${recentRangeClause} AND ${extra}`)
      .get(...recentRangeParams) as RawMetrics) ?? EMPTY;
  }

  function queryFixedBaseline(extra: string): RawMetrics {
    return (db.prepare(`SELECT ${SELECT_METRICS} FROM purchase_cohorts ${baselineRangeClause} AND ${extra}`)
      .get(...baselineRangeParams) as RawMetrics) ?? EMPTY;
  }

  function queryGrouped(col: string, limit?: number): SegmentRow[] {
    const limitClause = limit ? `LIMIT ${limit}` : '';
    const recentRows = (db.prepare(`
      SELECT ${col} as seg, ${SELECT_METRICS}
      FROM purchase_cohorts ${recentRangeClause} AND ${col} IS NOT NULL AND ${col} != ''
      GROUP BY ${col} ORDER BY total DESC ${limitClause}
    `).all(...recentRangeParams) as ({ seg: string } & RawMetrics)[])
      .filter(r => r.total >= 100);

    if (recentRows.length === 0) return [];

    const baselineRows = (db.prepare(`
      SELECT ${col} as seg, ${SELECT_METRICS}
      FROM purchase_cohorts ${baselineRangeClause} AND ${col} IS NOT NULL AND ${col} != ''
      GROUP BY ${col}
    `).all(...baselineRangeParams) as ({ seg: string } & RawMetrics)[]);
    const baselineMap = new Map(baselineRows.map(r => [r.seg, r]));

    // First week each segment label appears in the entire dataset (for recency labelling)
    const firstWeekRows = (db.prepare(`
      SELECT ${col} as seg, MIN(purchase_week) as first_week
      FROM purchase_cohorts WHERE ${col} IS NOT NULL AND ${col} != ''
      GROUP BY ${col}
    `).all() as { seg: string; first_week: string }[]);
    const firstWeekMap = new Map(firstWeekRows.map(r => [r.seg, r.first_week]));

    return recentRows.map(r => ({
      ...toRow(r.seg, r, baselineMap.get(r.seg) ?? EMPTY),
      firstWeek: firstWeekMap.get(r.seg),
    }));
  }

  const paymentRows = (
    [
      { label: 'Monthly', clause: `payment_frequency = 'Monthly'` },
      { label: 'Yearly',  clause: `payment_frequency = 'Yearly'`  },
      { label: '3-Year',  clause: `payment_frequency = '3-Year'`  },
    ] as { label: string; clause: string }[]
  ).map(({ label, clause }) => {
    const r = queryFixedRecent(clause);
    const b = queryFixedBaseline(clause);
    return r.total >= 100 ? toRow(label, r, b) : null;
  }).filter((r): r is SegmentRow => r !== null);

  const acquisitionRows = (
    [
      { label: 'MC',                   clause: `is_mc_funnel = 1 AND campaign_type = 'Evergreen'` },
      { label: 'MC · Launch',          clause: `is_mc_funnel = 1 AND campaign_type = 'Product Launch'` },
      { label: 'VSL',                  clause: `is_vsl_funnel = 1 AND campaign_type = 'Evergreen'` },
      { label: 'VSL · Launch',         clause: `is_vsl_funnel = 1 AND campaign_type = 'Product Launch'` },
      { label: 'Organic',              clause: `is_mc_funnel = 0 AND is_vsl_funnel = 0` },
    ] as { label: string; clause: string }[]
  ).map(({ label, clause }) => {
    const r = queryFixedRecent(clause);
    const b = queryFixedBaseline(clause);
    return r.total >= 100 ? toRow(label, r, b) : null;
  }).filter((r): r is SegmentRow => r !== null);

  const countryOrder = ['US', 'UK', 'Canada', 'Australia', 'Germany', 'RoW'];
  const countryRows = countryOrder.map(label => {
    const r = queryFixedRecent(`country = '${label}'`);
    const b = queryFixedBaseline(`country = '${label}'`);
    return r.total >= 50 ? toRow(label, r, b) : null;
  }).filter((r): r is SegmentRow => r !== null);

  const processorOrder = ['Card', 'PayPal', 'Apple', 'Google Play'];
  const processorRows = processorOrder.map(label => {
    const r = queryFixedRecent(`payment_processor = '${label}'`);
    const b = queryFixedBaseline(`payment_processor = '${label}'`);
    return r.total >= 50 ? toRow(label, r, b) : null;
  }).filter((r): r is SegmentRow => r !== null);

  return [
    { dimension: 'Payment Plan',       rows: paymentRows },
    { dimension: 'Product Type',       rows: queryGrouped('product_name', 10) },
    { dimension: 'Acquisition',        rows: acquisitionRows },
    { dimension: 'Device',             rows: queryGrouped('device_category') },
    { dimension: 'Country',            rows: countryRows },
    { dimension: 'Payment Processor',  rows: processorRows },
  ].filter(g => g.rows.length > 0);
}

// ---------------------------------------------------------------------------
// IP Team — Login analysis (ghost buyers, Day 7 breakdown)
// ---------------------------------------------------------------------------

export interface ProductLoginData {
  productName: string;
  recentTotal: number;
  recentShare: number;
  day7Rate: number;
  prevDay7Rate: number | null;
  ghostCount: number;   // eligible users in mature cohorts who never logged in
  ghostRate: number;    // % of mature-cohort eligible who never logged in
}

export interface DeviceLoginData {
  device: string;
  eligible: number;
  day7Rate: number;
  lateRate: number;  // logged in after day 7
  ghostRate: number; // never logged in
}

export interface PriceBandData {
  label: string;
  eligible: number;
  day7Rate: number;
  lateRate: number;
  ghostRate: number;
}

export interface Day0ProductRow {
  productName: string;
  beforeShare: number;   // % of before-window eligible
  afterShare: number;    // % of after-window eligible
  beforeDay0: number;    // Day 0 % in before window
  afterDay0: number;     // Day 0 % in after window
  beforeElig: number;
  afterElig: number;
}

export interface Day0DeviceRow {
  device: string;
  beforeElig: number;
  afterElig: number;
  beforeDay0: number;
  afterDay0: number;
}

export interface Day0Decline {
  cutoff: string;        // e.g. '2026-06-29'
  beforeRate: number;    // overall Day 0 % before cutoff
  afterRate: number;     // overall Day 0 % after cutoff
  delta: number;         // afterRate - beforeRate (negative = decline)
  beforeElig: number;
  afterElig: number;
  mixShiftImpact: number;   // pp impact from product mix change alone
  rateChangeImpact: number; // pp impact from within-product rate changes alone
  byProduct: Day0ProductRow[];
  byDevice: Day0DeviceRow[];
}

export interface LoginAnalysis {
  weekRange: { min: string; max: string };
  overall: { total: number; day7Rate: number; prevDay7Rate: number | null; prevTotal: number };
  monthlyCustomers: { total: number; day7Rate: number; prevDay7Rate: number | null };
  yearlyCustomers:  { total: number; day7Rate: number; prevDay7Rate: number | null };
  topProducts: ProductLoginData[];
  ghostTotalMature: number;      // never logged in (mature cohorts)
  lateLoggerMature: number;      // logged in after day 7 (mature cohorts)
  eligibleTotalMature: number;
  deviceBreakdown: DeviceLoginData[];
  priceBreakdown: PriceBandData[];
  lateLoggerTiming: Array<{ bucket: string; count: number }>;
  day0Decline: Day0Decline | null;
}

export function getLoginAnalysis(filters: PurchaseFilters = {}): LoginAnalysis | null {
  const db = getDb();
  const { where, params } = buildWhere(filters);

  const completedCutoff = new Date(SNAPSHOT_DATE);
  completedCutoff.setUTCDate(completedCutoff.getUTCDate() - 7);
  const completedCutoffStr = completedCutoff.toISOString().substring(0, 10);

  const recentWeekRows = db.prepare(
    `SELECT DISTINCT purchase_week FROM purchase_cohorts WHERE purchase_week <= ? ORDER BY purchase_week DESC LIMIT 4`
  ).all(completedCutoffStr) as { purchase_week: string }[];
  if (recentWeekRows.length === 0) return null;

  const maxWeek = recentWeekRows[0].purchase_week;
  const minWeek = recentWeekRows[recentWeekRows.length - 1].purchase_week;
  // weeksBefore defined below — inline the logic here
  const prevMax = (() => { const d = new Date(minWeek + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - 7); return d.toISOString().substring(0, 10); })();
  const prevMin = (() => { const d = new Date(minWeek + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - 28); return d.toISOString().substring(0, 10); })();

  function mkWhere(wMin: string, wMax: string, extra = '') {
    const base = where ? `${where} AND purchase_week BETWEEN ? AND ?` : `WHERE purchase_week BETWEEN ? AND ?`;
    return { clause: extra ? `${base} AND ${extra}` : base, p: [...params, wMin, wMax] as unknown[] };
  }

  function day7Seg(wMin: string, wMax: string, extra = '') {
    const { clause, p } = mkWhere(wMin, wMax, extra);
    const r = db.prepare(`
      SELECT
        COUNT(DISTINCT CASE WHEN order_type IN ('New','Trial') AND is_first_order=1 THEN user_id END) as total,
        COUNT(DISTINCT CASE WHEN order_type IN ('New','Trial') AND is_first_order=1 AND days_to_login IS NOT NULL AND days_to_login <= 7 THEN user_id END) as day7
      FROM purchase_cohorts ${clause}
    `).get(...p) as { total: number; day7: number };
    return { total: r.total ?? 0, day7Rate: (r.total ?? 0) > 0 ? Math.round((r.day7 ?? 0) / r.total * 1000) / 10 : 0 };
  }

  const cur = day7Seg(minWeek, maxWeek);
  const prv = day7Seg(prevMin, prevMax);

  function paymentRow(freq: string) {
    const c = day7Seg(minWeek, maxWeek, `payment_frequency = '${freq}'`);
    const p = day7Seg(prevMin, prevMax, `payment_frequency = '${freq}'`);
    return { total: c.total, day7Rate: c.day7Rate, prevDay7Rate: p.total > 0 ? p.day7Rate : null };
  }

  // Mature cohorts = purchase_week <= snapshot - 14 days (Day 7 window closed)
  const matureCutoff = new Date(SNAPSHOT_DATE);
  matureCutoff.setUTCDate(matureCutoff.getUTCDate() - 14);
  const matureCutoffStr = matureCutoff.toISOString().substring(0, 10);

  const eligBase = where
    ? `${where} AND purchase_week <= ? AND order_type IN ('New','Trial') AND is_first_order = 1`
    : `WHERE purchase_week <= ? AND order_type IN ('New','Trial') AND is_first_order = 1`;
  const eligP = [...params, matureCutoffStr] as unknown[];

  const ghostTotals = db.prepare(`
    SELECT
      COUNT(DISTINCT user_id) as eligible,
      COUNT(DISTINCT CASE WHEN days_to_login IS NULL THEN user_id END) as ghost,
      COUNT(DISTINCT CASE WHEN days_to_login IS NOT NULL AND days_to_login > 7 THEN user_id END) as late_logger
    FROM purchase_cohorts ${eligBase}
  `).get(...eligP) as { eligible: number; ghost: number; late_logger: number };

  // Device breakdown (mature cohorts)
  const deviceRows = (db.prepare(`
    SELECT
      COALESCE(device_category, 'in-app') as device,
      COUNT(DISTINCT user_id) as eligible,
      COUNT(DISTINCT CASE WHEN days_to_login IS NOT NULL AND days_to_login <= 7 THEN user_id END) as day7,
      COUNT(DISTINCT CASE WHEN days_to_login IS NOT NULL AND days_to_login > 7 THEN user_id END) as late,
      COUNT(DISTINCT CASE WHEN days_to_login IS NULL THEN user_id END) as ghost
    FROM purchase_cohorts ${eligBase}
    GROUP BY device ORDER BY eligible DESC
  `).all(...eligP) as { device: string; eligible: number; day7: number; late: number; ghost: number }[]);

  const deviceBreakdown: DeviceLoginData[] = deviceRows
    .filter(r => r.eligible >= 50)
    .map(r => ({
      device: r.device,
      eligible: r.eligible,
      day7Rate: r.eligible > 0 ? Math.round(r.day7 / r.eligible * 1000) / 10 : 0,
      lateRate: r.eligible > 0 ? Math.round(r.late / r.eligible * 1000) / 10 : 0,
      ghostRate: r.eligible > 0 ? Math.round(r.ghost / r.eligible * 1000) / 10 : 0,
    }));

  // Price band breakdown (mature cohorts, Yearly subscribers only — monthly mix is too small)
  const priceBandSql = `
    SELECT
      CASE
        WHEN order_amount < 50  THEN 'Under $50'
        WHEN order_amount < 100 THEN '$50–$99'
        WHEN order_amount < 200 THEN '$100–$199'
        WHEN order_amount < 400 THEN '$200–$399'
        ELSE '$400+'
      END as label,
      MIN(order_amount) as min_amt,
      COUNT(DISTINCT user_id) as eligible,
      COUNT(DISTINCT CASE WHEN days_to_login IS NOT NULL AND days_to_login <= 7 THEN user_id END) as day7,
      COUNT(DISTINCT CASE WHEN days_to_login IS NOT NULL AND days_to_login > 7 THEN user_id END) as late,
      COUNT(DISTINCT CASE WHEN days_to_login IS NULL THEN user_id END) as ghost
    FROM purchase_cohorts ${eligBase} AND order_amount IS NOT NULL AND payment_frequency = 'Yearly'
    GROUP BY label ORDER BY MIN(order_amount)
  `;
  const priceRows = (db.prepare(priceBandSql).all(...eligP) as {
    label: string; min_amt: number; eligible: number; day7: number; late: number; ghost: number;
  }[]);
  const priceBreakdown: PriceBandData[] = priceRows.map(r => ({
    label: r.label,
    eligible: r.eligible,
    day7Rate: r.eligible > 0 ? Math.round(r.day7 / r.eligible * 1000) / 10 : 0,
    lateRate: r.eligible > 0 ? Math.round(r.late / r.eligible * 1000) / 10 : 0,
    ghostRate: r.eligible > 0 ? Math.round(r.ghost / r.eligible * 1000) / 10 : 0,
  }));

  // Late logger timing (how long after day 7 did they come back?)
  const timingRows = (db.prepare(`
    SELECT
      CASE
        WHEN days_to_login BETWEEN 8 AND 14 THEN '8–14d'
        WHEN days_to_login BETWEEN 15 AND 30 THEN '15–30d'
        WHEN days_to_login BETWEEN 31 AND 60 THEN '31–60d'
        ELSE '60d+'
      END as bucket,
      MIN(days_to_login) as min_d,
      COUNT(DISTINCT user_id) as cnt
    FROM purchase_cohorts ${eligBase} AND days_to_login > 7
    GROUP BY bucket ORDER BY MIN(days_to_login)
  `).all(...eligP) as { bucket: string; min_d: number; cnt: number }[]);
  const lateLoggerTiming = timingRows.map(r => ({ bucket: r.bucket, count: r.cnt }));

  const ghostByProduct = (db.prepare(`
    SELECT COALESCE(product_name,'(null)') as prod,
      COUNT(DISTINCT user_id) as eligible,
      COUNT(DISTINCT CASE WHEN days_to_login IS NULL THEN user_id END) as ghost
    FROM purchase_cohorts ${eligBase} AND product_name IS NOT NULL
    GROUP BY prod ORDER BY eligible DESC
  `).all(...eligP) as { prod: string; eligible: number; ghost: number }[]);
  const ghostMap = new Map(ghostByProduct.map(r => [r.prod, r]));

  const { clause: rc, p: rp } = mkWhere(minWeek, maxWeek);
  const { clause: pc, p: pp } = mkWhere(prevMin, prevMax);

  const recentProds = (db.prepare(`
    SELECT COALESCE(product_name,'(null)') as prod,
      COUNT(DISTINCT CASE WHEN order_type IN ('New','Trial') AND is_first_order=1 THEN user_id END) as total,
      COUNT(DISTINCT CASE WHEN order_type IN ('New','Trial') AND is_first_order=1 AND days_to_login IS NOT NULL AND days_to_login <= 7 THEN user_id END) as day7
    FROM purchase_cohorts ${rc} AND product_name IS NOT NULL
    GROUP BY prod ORDER BY total DESC LIMIT 8
  `).all(...rp) as { prod: string; total: number; day7: number }[]);

  const prevProds = (db.prepare(`
    SELECT COALESCE(product_name,'(null)') as prod,
      COUNT(DISTINCT CASE WHEN order_type IN ('New','Trial') AND is_first_order=1 THEN user_id END) as total,
      COUNT(DISTINCT CASE WHEN order_type IN ('New','Trial') AND is_first_order=1 AND days_to_login IS NOT NULL AND days_to_login <= 7 THEN user_id END) as day7
    FROM purchase_cohorts ${pc} AND product_name IS NOT NULL GROUP BY prod
  `).all(...pp) as { prod: string; total: number; day7: number }[]);
  const prevProdMap = new Map(prevProds.map(r => [r.prod, r]));

  const totalRecent = recentProds.reduce((s, r) => s + r.total, 0);
  const topProducts: ProductLoginData[] = recentProds.map(r => {
    const prev = prevProdMap.get(r.prod);
    const ghost = ghostMap.get(r.prod);
    return {
      productName: r.prod,
      recentTotal: r.total,
      recentShare: totalRecent > 0 ? Math.round(r.total / totalRecent * 1000) / 10 : 0,
      day7Rate: r.total > 0 ? Math.round(r.day7 / r.total * 1000) / 10 : 0,
      prevDay7Rate: prev && prev.total > 0 ? Math.round(prev.day7 / prev.total * 1000) / 10 : null,
      ghostCount: ghost?.ghost ?? 0,
      ghostRate: ghost && ghost.eligible > 0 ? Math.round(ghost.ghost / ghost.eligible * 1000) / 10 : 0,
    };
  });

  // ---------------------------------------------------------------------------
  // Day 0 decline analysis — before vs after June 29 cutoff
  // ---------------------------------------------------------------------------
  const D0_CUTOFF = '2026-06-29';
  // Before window: 13 weeks immediately prior to cutoff (Mar 30 – Jun 22)
  const d0BeforeMax = (() => { const d = new Date(D0_CUTOFF + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - 7); return d.toISOString().substring(0, 10); })();
  const d0BeforeMin = (() => { const d = new Date(D0_CUTOFF + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - 7 * 14); return d.toISOString().substring(0, 10); })();
  // After window: cutoff through most-recent complete week
  const d0AfterMin = D0_CUTOFF;
  const d0AfterMax = completedCutoffStr;

  let day0Decline: Day0Decline | null = null;
  try {
    const eligExtra = `order_type IN ('New','Trial') AND is_first_order = 1`;

    function d0Query(wMin: string, wMax: string, extraAnd = '') {
      const clause = where
        ? `${where} AND purchase_week BETWEEN ? AND ? AND ${eligExtra}${extraAnd ? ' AND ' + extraAnd : ''}`
        : `WHERE purchase_week BETWEEN ? AND ? AND ${eligExtra}${extraAnd ? ' AND ' + extraAnd : ''}`;
      return db.prepare(`
        SELECT COUNT(DISTINCT user_id) as elig,
          COUNT(DISTINCT CASE WHEN days_to_login IS NOT NULL AND days_to_login = 0 THEN user_id END) as day0
        FROM purchase_cohorts ${clause}
      `).get(...params, wMin, wMax) as { elig: number; day0: number };
    }

    const beforeAll = d0Query(d0BeforeMin, d0BeforeMax);
    const afterAll  = d0Query(d0AfterMin,  d0AfterMax);

    if (beforeAll.elig > 0 && afterAll.elig > 0) {
      const beforeRate = Math.round(beforeAll.day0 / beforeAll.elig * 1000) / 10;
      const afterRate  = Math.round(afterAll.day0  / afterAll.elig  * 1000) / 10;

      // Product breakdown
      const allProds = (db.prepare(`
        SELECT product_name as prod,
          SUM(CASE WHEN purchase_week BETWEEN ? AND ? THEN 1 ELSE 0 END) as b_cnt,
          SUM(CASE WHEN purchase_week BETWEEN ? AND ? THEN 1 ELSE 0 END) as a_cnt
        FROM purchase_cohorts
        ${where ? where + ' AND' : 'WHERE'} product_name IS NOT NULL AND ${eligExtra}
        GROUP BY prod
        HAVING b_cnt + a_cnt > 0
        ORDER BY b_cnt + a_cnt DESC LIMIT 10
      `).all(d0BeforeMin, d0BeforeMax, d0AfterMin, d0AfterMax, ...params) as { prod: string; b_cnt: number; a_cnt: number }[]);

      const byProduct: Day0ProductRow[] = [];
      for (const row of allProds) {
        const safeP = row.prod.replace(/'/g, "''");
        const b = d0Query(d0BeforeMin, d0BeforeMax, `product_name = '${safeP}'`);
        const a = d0Query(d0AfterMin,  d0AfterMax,  `product_name = '${safeP}'`);
        if (b.elig + a.elig < 30) continue;
        byProduct.push({
          productName: row.prod,
          beforeElig: b.elig,
          afterElig: a.elig,
          beforeShare: beforeAll.elig > 0 ? Math.round(b.elig / beforeAll.elig * 1000) / 10 : 0,
          afterShare:  afterAll.elig  > 0 ? Math.round(a.elig / afterAll.elig  * 1000) / 10 : 0,
          beforeDay0: b.elig > 0 ? Math.round(b.day0 / b.elig * 1000) / 10 : 0,
          afterDay0:  a.elig > 0 ? Math.round(a.day0 / a.elig * 1000) / 10 : 0,
        });
      }

      // Device breakdown
      const deviceList = ['mobile', 'desktop', 'tablet'] as const;
      const byDevice: Day0DeviceRow[] = [];
      for (const dev of deviceList) {
        const b = d0Query(d0BeforeMin, d0BeforeMax, `device_category = '${dev}'`);
        const a = d0Query(d0AfterMin,  d0AfterMax,  `device_category = '${dev}'`);
        if (b.elig + a.elig < 50) continue;
        byDevice.push({
          device: dev,
          beforeElig: b.elig, afterElig: a.elig,
          beforeDay0: b.elig > 0 ? Math.round(b.day0 / b.elig * 1000) / 10 : 0,
          afterDay0:  a.elig > 0 ? Math.round(a.day0 / a.elig * 1000) / 10 : 0,
        });
      }
      // In-app (null device)
      const bIA = d0Query(d0BeforeMin, d0BeforeMax, 'device_category IS NULL');
      const aIA = d0Query(d0AfterMin,  d0AfterMax,  'device_category IS NULL');
      if (bIA.elig + aIA.elig >= 50) {
        byDevice.push({
          device: 'in-app',
          beforeElig: bIA.elig, afterElig: aIA.elig,
          beforeDay0: bIA.elig > 0 ? Math.round(bIA.day0 / bIA.elig * 1000) / 10 : 0,
          afterDay0:  aIA.elig > 0 ? Math.round(aIA.day0 / aIA.elig * 1000) / 10 : 0,
        });
      }

      // Counterfactual decomposition
      // Mix shift impact: apply after-window shares to before-window rates → compare to before overall
      // Rate change impact: apply after-window rates to before-window shares → compare to before overall
      let mixShiftImpact = 0;
      let rateChangeImpact = 0;
      if (byProduct.length > 0) {
        // counterfactual 1: after shares, before rates
        const cf1 = byProduct.reduce((s, p) => s + (p.afterShare / 100) * p.beforeDay0, 0);
        mixShiftImpact = Math.round((cf1 - beforeRate) * 10) / 10;
        // counterfactual 2: before shares, after rates
        const cf2 = byProduct.reduce((s, p) => s + (p.beforeShare / 100) * p.afterDay0, 0);
        rateChangeImpact = Math.round((cf2 - beforeRate) * 10) / 10;
      }

      day0Decline = {
        cutoff: D0_CUTOFF,
        beforeRate,
        afterRate,
        delta: Math.round((afterRate - beforeRate) * 10) / 10,
        beforeElig: beforeAll.elig,
        afterElig: afterAll.elig,
        mixShiftImpact,
        rateChangeImpact,
        byProduct,
        byDevice,
      };
    }
  } catch (_) { /* non-critical — skip if no data */ }

  return {
    weekRange: { min: minWeek, max: maxWeek },
    overall: { total: cur.total, day7Rate: cur.day7Rate, prevDay7Rate: prv.total > 0 ? prv.day7Rate : null, prevTotal: prv.total },
    monthlyCustomers: paymentRow('Monthly'),
    yearlyCustomers:  paymentRow('Yearly'),
    topProducts,
    ghostTotalMature: ghostTotals.ghost ?? 0,
    lateLoggerMature: ghostTotals.late_logger ?? 0,
    eligibleTotalMature: ghostTotals.eligible ?? 0,
    deviceBreakdown,
    priceBreakdown,
    lateLoggerTiming,
    day0Decline,
  };
}

/** Return the YYYY-MM-DD of the Monday n weeks before the given Monday */
function weeksBefore(monday: string, n: number): string {
  const d = new Date(monday + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 7 * n);
  return d.toISOString().substring(0, 10);
}

export function getLoginDropoffAnalysis(filters: PurchaseFilters = {}): DropoffAnalysis | null {
  const db = getDb();

  // Use the 4 most-recent COMPLETE weeks (excluding the current partial week,
  // which has < 7 days of data and inflates the apparent decline).
  // Immature weeks (not yet 15+ days old) ARE included — their partially-measured
  // rates are fine for root-cause direction, just not for absolute precision.
  const completedCutoff = new Date(SNAPSHOT_DATE);
  completedCutoff.setUTCDate(completedCutoff.getUTCDate() - 7);
  const completedCutoffStr = completedCutoff.toISOString().substring(0, 10);

  const recentRows = db.prepare(`
    SELECT DISTINCT purchase_week FROM purchase_cohorts
    WHERE purchase_week <= ?
    ORDER BY purchase_week DESC LIMIT 4
  `).all(completedCutoffStr) as { purchase_week: string }[];

  if (recentRows.length === 0) return null;

  const maxWeek = recentRows[0].purchase_week;
  const minWeek = recentRows[recentRows.length - 1].purchase_week;
  // Previous window: 4 weeks immediately before the current 4-week window
  const prevMaxWeek = weeksBefore(minWeek, 1);
  const prevMinWeek = weeksBefore(minWeek, 4);

  const { where, params } = buildWhere(filters);

  function makeWhere(wMin: string, wMax: string, extra = ''): { clause: string; p: unknown[] } {
    const base = where ? `${where} AND purchase_week BETWEEN ? AND ?` : `WHERE purchase_week BETWEEN ? AND ?`;
    return {
      clause: extra ? `${base} AND ${extra}` : base,
      p: [...params, wMin, wMax],
    };
  }

  function segmentRate(wMin: string, wMax: string, extra = ''): { total: number; day15Rate: number } {
    const { clause, p } = makeWhere(wMin, wMax, extra);
    const r = db.prepare(`
      SELECT
        COUNT(DISTINCT user_id) as total,
        ROUND(COUNT(DISTINCT CASE WHEN days_to_activation IS NOT NULL AND days_to_activation <= 15 THEN user_id END) * 100.0 / NULLIF(COUNT(DISTINCT user_id), 0), 1) as day15
      FROM purchase_cohorts ${clause}
    `).get(...p) as { total: number; day15: number };
    return { total: r.total, day15Rate: r.day15 ?? 0 };
  }

  function buildSegmentRate(extra: string): SegmentRate {
    const cur = segmentRate(minWeek, maxWeek, extra);
    const prev = segmentRate(prevMinWeek, prevMaxWeek, extra);
    return {
      total: cur.total,
      day15Rate: cur.day15Rate,
      prevDay15Rate: prev.total > 0 ? prev.day15Rate : null,
      prevTotal: prev.total,
    };
  }

  // Per-product share + Day 15 rate for the recent and prior windows.
  // Returns rows ordered by recent count desc.
  function productWindowData(wMin: string, wMax: string): {
    productName: string; cnt: number; day15: number; questShare: number;
  }[] {
    const { clause, p } = makeWhere(wMin, wMax, `product_name IS NOT NULL`);
    return (db.prepare(`
      SELECT
        product_name,
        COUNT(DISTINCT user_id) as cnt,
        ROUND(COUNT(DISTINCT CASE WHEN days_to_activation IS NOT NULL AND days_to_activation <= 15 THEN user_id END) * 100.0 / NULLIF(COUNT(DISTINCT user_id), 0), 1) as day15,
        ROUND(COUNT(DISTINCT CASE WHEN has_funnel_quest = 1 THEN user_id END) * 100.0 / NULLIF(COUNT(DISTINCT user_id), 0), 1) as quest_share
      FROM purchase_cohorts ${clause}
      GROUP BY product_name
      ORDER BY cnt DESC
    `).all(...p) as { product_name: string; cnt: number; day15: number; quest_share: number }[])
      .map(r => ({ productName: r.product_name, cnt: r.cnt, day15: r.day15 ?? 0, questShare: r.quest_share ?? 0 }));
  }

  const recentProducts = productWindowData(minWeek, maxWeek);
  const prevProducts = productWindowData(prevMinWeek, prevMaxWeek);
  const recentTotal = recentProducts.reduce((s, r) => s + r.cnt, 0);
  const prevTotal = prevProducts.reduce((s, r) => s + r.cnt, 0);
  const prevMap = new Map(prevProducts.map(r => [r.productName, r]));

  const topProductShifts: ProductShift[] = recentProducts.slice(0, 8).map(r => {
    const p = prevMap.get(r.productName);
    return {
      productName: r.productName,
      recentShare: recentTotal > 0 ? Math.round(r.cnt / recentTotal * 1000) / 10 : 0,
      recentDay15: r.day15,
      recentCount: r.cnt,
      recentQuestShare: r.questShare,
      prevShare: p && prevTotal > 0 ? Math.round(p.cnt / prevTotal * 1000) / 10 : 0,
      prevDay15: p ? p.day15 : 0,
      prevQuestShare: p ? p.questShare : 0,
    };
  });

  return {
    weekRange: { min: minWeek, max: maxWeek },
    overall:           buildSegmentRate(''),
    mcFunnel:          buildSegmentRate('is_mc_funnel = 1'),
    nonMcFunnel:       buildSegmentRate('is_mc_funnel = 0'),
    hasQuest:          buildSegmentRate('has_funnel_quest = 1'),
    noQuest:           buildSegmentRate('has_funnel_quest = 0'),
    monthlyCustomers:  buildSegmentRate(`payment_frequency = 'Monthly'`),
    annualCustomers:   buildSegmentRate(`payment_frequency = 'Yearly'`),
    threeYearCustomers: buildSegmentRate(`payment_frequency = '3-Year'`),
    problemSegment:    buildSegmentRate(`is_mc_funnel = 1 AND has_funnel_quest = 0`),
    bestSegment:       buildSegmentRate(`is_mc_funnel = 0 AND has_funnel_quest = 1`),
    topProductShifts,
  };
}

// ---------------------------------------------------------------------------
// Refund Rate — weekly cancellation-within-30d rate by purchase cohort
// ---------------------------------------------------------------------------

export interface RefundWeekRow {
  week: string;
  weekLabel: string;
  total: number;
  refundCount: number;   // actual refunds (refund_timestamp IS NOT NULL, within 15d window)
  cancelCount: number;   // cancelled at any point (canceled_at IS NOT NULL)
  refundRate: number;    // refundCount / total * 100
  cancelRate: number;    // cancelCount / total * 100
  isMature: boolean;     // cohort is 22+ days old (refund window complete)
}

export function getRefundMetrics(filters: PurchaseFilters = {}): RefundWeekRow[] {
  const db = getDb();
  const { where, params } = buildWhere(filters);
  // Exclude Trial and Not Applicable — trials cannot be refunded (no charge), consistent with BQ refund logic
  const refundWhere = where + ` AND order_type NOT IN ('Trial', 'Not Applicable')`;

  const rows = db.prepare(`
    SELECT
      purchase_week as week,
      COUNT(DISTINCT user_id) as total,
      COUNT(DISTINCT CASE WHEN days_to_refund IS NOT NULL AND days_to_refund <= 15 THEN user_id END) as refunded,
      COUNT(DISTINCT CASE WHEN days_to_cancel IS NOT NULL THEN user_id END) as cancelled
    FROM purchase_cohorts
    ${refundWhere}
    GROUP BY purchase_week
    ORDER BY purchase_week ASC
  `).all(...params) as { week: string; total: number; refunded: number; cancelled: number }[];

  return rows.map(r => {
    const daysOld = Math.floor(
      (new Date(SNAPSHOT_DATE).getTime() - new Date(r.week).getTime()) / (1000 * 60 * 60 * 24)
    );
    return {
      week: r.week,
      weekLabel: new Date(r.week + 'T00:00:00Z').toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', timeZone: 'UTC',
      }),
      total: r.total,
      refundCount: r.refunded ?? 0,
      cancelCount: r.cancelled ?? 0,
      refundRate: r.total > 0 ? Math.round((r.refunded ?? 0) / r.total * 1000) / 10 : 0,
      cancelRate: r.total > 0 ? Math.round((r.cancelled ?? 0) / r.total * 1000) / 10 : 0,
      isMature: daysOld >= 22,
    };
  });
}

export interface RefundSegment {
  label: string;
  total: number;
  refundRate: number;
  cancelRate: number;
}

export interface RefundBreakdown {
  weekRange: { min: string; max: string };
  byPaymentFreq: RefundSegment[];
  byProduct: RefundSegment[];
  byOrderType: RefundSegment[];
  involuntaryRate: number;  // % of all cancellations that are involuntary churn
}

export function getRefundBreakdown(filters: PurchaseFilters = {}): RefundBreakdown {
  const db = getDb();
  const { where, params } = buildWhere(filters);

  // Use the most recent 8 complete weeks
  const completedCutoff = new Date(SNAPSHOT_DATE);
  completedCutoff.setUTCDate(completedCutoff.getUTCDate() - 7);
  const cutoffStr = completedCutoff.toISOString().substring(0, 10);

  const windowRows = db.prepare(
    `SELECT DISTINCT purchase_week FROM purchase_cohorts WHERE purchase_week <= ? ORDER BY purchase_week DESC LIMIT 8`
  ).all(cutoffStr) as { purchase_week: string }[];
  if (windowRows.length === 0) return { weekRange: { min: '', max: '' }, byPaymentFreq: [], byProduct: [], byOrderType: [], involuntaryRate: 0 };

  const maxWeek = windowRows[0].purchase_week;
  const minWeek = windowRows[windowRows.length - 1].purchase_week;

  // Only use mature weeks (30+ days old) so the refund window is complete
  const matureWeeks = windowRows.filter(r => {
    const daysOld = Math.floor((new Date(SNAPSHOT_DATE).getTime() - new Date(r.purchase_week).getTime()) / (1000 * 60 * 60 * 24));
    return daysOld >= 22;
  }).map(r => r.purchase_week);

  if (matureWeeks.length === 0) return { weekRange: { min: minWeek, max: maxWeek }, byPaymentFreq: [], byProduct: [], byOrderType: [], involuntaryRate: 0 };

  const placeholders = matureWeeks.map(() => '?').join(',');
  const windowFilter = `purchase_week IN (${placeholders})`;

  function buildWhere2(extra: string): { clause: string; p: unknown[] } {
    const baseWhere = where.replace('WHERE ', '');
    // Exclude Trial and Not Applicable — trials cannot be refunded (no charge)
    const parts = [windowFilter, `order_type NOT IN ('Trial', 'Not Applicable')`];
    if (baseWhere) parts.push(baseWhere);
    if (extra) parts.push(extra);
    return { clause: 'WHERE ' + parts.join(' AND '), p: [...matureWeeks, ...params] };
  }

  function segmentQuery(groupCol: string, extraFilter = ''): RefundSegment[] {
    const { clause, p } = buildWhere2(extraFilter);
    const rows = db.prepare(`
      SELECT
        ${groupCol} as label,
        COUNT(DISTINCT user_id) as total,
        COUNT(DISTINCT CASE WHEN days_to_refund IS NOT NULL AND days_to_refund <= 15 THEN user_id END) as refunded,
        COUNT(DISTINCT CASE WHEN days_to_cancel IS NOT NULL THEN user_id END) as cancelled
      FROM purchase_cohorts
      ${clause} AND ${groupCol} IS NOT NULL
      GROUP BY ${groupCol}
      ORDER BY total DESC
    `).all(...p) as { label: string; total: number; refunded: number; cancelled: number }[];
    return rows
      .filter(r => r.total >= 50)
      .map(r => ({
        label: r.label,
        total: r.total,
        refundRate: r.total > 0 ? Math.round((r.refunded ?? 0) / r.total * 1000) / 10 : 0,
        cancelRate: r.total > 0 ? Math.round((r.cancelled ?? 0) / r.total * 1000) / 10 : 0,
      }));
  }

  // Involuntary churn rate — % of all cancellations (any window) that are involuntary
  const { clause: invClause, p: invP } = buildWhere2('');
  const invRow = db.prepare(`
    SELECT
      COUNT(DISTINCT CASE WHEN days_to_cancel IS NOT NULL THEN user_id END) as total_cancelled,
      COUNT(DISTINCT CASE WHEN days_to_cancel IS NOT NULL AND is_involuntary_churn = 1 THEN user_id END) as involuntary
    FROM purchase_cohorts ${invClause}
  `).get(...invP) as { total_cancelled: number; involuntary: number } | undefined;

  const involuntaryRate = invRow && invRow.total_cancelled > 0
    ? Math.round(invRow.involuntary / invRow.total_cancelled * 1000) / 10
    : 0;

  return {
    weekRange: { min: minWeek, max: maxWeek },
    byPaymentFreq: segmentQuery('payment_frequency'),
    byProduct: segmentQuery('product_name').slice(0, 8),
    byOrderType: segmentQuery('order_type'),
    involuntaryRate,
  };
}
