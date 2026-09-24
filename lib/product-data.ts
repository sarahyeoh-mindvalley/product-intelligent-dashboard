/**
 * Product Data — loads product_data_full.json (NDJSON, one row per user) into
 * SQLite and provides analytics queries.
 *
 * Column-name compatibility: the DB keeps the old column names so that all
 * existing query code (analysis.ts, pages) works without changes.  The new
 * JSON fields are mapped / derived during seeding.
 *
 * Derived columns (computed at seed time):
 *   has_login_in_month       = last_login_timestamp >= RECENT_CUTOFF
 *   has_progress_in_month    = total_months_with_progress > 0
 *   has_used_eve_in_month    = has_ever_used_eve
 *   has_adopted_eve_before_month = has_ever_used_eve  (snapshot — no separation)
 *   is_new_subscriber        = subscription_start_date >= RECENT_CUTOFF
 *   is_eve_repeat_user       = total_months_with_eve >= 2
 *   eve_active_days          = total_eve_active_days (JSON field)
 *   web_or_app               = sales_channel (web | app)
 *   month                    = SNAPSHOT_MONTH  (hardcoded — single snapshot)
 */

import path from 'path';
import fs from 'fs';
import { getDb } from './db';

const DATA_PATH = path.join(process.cwd(), 'data', 'product_data_full.json');

/** All data treated as this single snapshot month */
const SNAPSHOT_MONTH = '2026-07';

/** "Active in last 30 days" cutoff — 30 days before end of July 2026 */
const RECENT_CUTOFF = '2026-07-01';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MonthlySnapshot {
  month: string;
  active: number;
  loggedIn: number;
  loginRate: number;
  hasProgress: number;
  progressRate: number;
  eveUsers: number;
  eveRate: number;
}

export interface TrendRow {
  month: string;
  label: string;
  active: number;
  loggedIn: number;
  loginRate: number;
  hasProgress: number;
  progressRate: number;
  eveUsers: number;
  eveRate: number;
}

export interface ChannelBreakdown {
  name: string;
  count: number;
  pct: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function fmtMonth(iso: string): string {
  const [y, m] = iso.split('-');
  return new Date(+y, +m - 1, 1).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
}

function bool(v: unknown): number {
  return v === 'true' || v === true || v === 1 ? 1 : 0;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '' || v === 'Not Available') return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function clean(v: unknown): string | null {
  if (!v || v === 'Not Available' || v === 'None' || v === 'null') return null;
  return String(v);
}

/** Returns 1 if a date string (any format starting YYYY-MM-DD) is >= cutoff */
function isRecent(dateStr: unknown): number {
  if (!dateStr || typeof dateStr !== 'string' || dateStr === 'None') return 0;
  return dateStr.substring(0, 10) >= RECENT_CUTOFF ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

function ensureProductDataTable(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS product_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month TEXT NOT NULL,
      auth0_user_id TEXT NOT NULL,
      subscription_status TEXT,
      membership_product_name TEXT,
      tier TEXT,
      payment_frequency TEXT,
      tenure_days INTEGER,
      is_new_subscriber INTEGER DEFAULT 0,
      country TEXT,
      total_tenure_days INTEGER,
      lifetime_value REAL,
      purchase_price REAL,
      n_content_viewed INTEGER,
      content_watched_min INTEGER,
      acquisition_type TEXT,
      acquisition_channel TEXT,
      acquisition_source TEXT,
      traffic_channel TEXT,
      payment_method_type TEXT,
      order_type TEXT,
      sales_channel TEXT,
      gender TEXT,
      age_bracket TEXT,
      language TEXT,
      has_login_within_15d INTEGER DEFAULT 0,
      has_content_progress_within_15d INTEGER DEFAULT 0,
      has_login_in_month INTEGER DEFAULT 0,
      has_progress_in_month INTEGER DEFAULT 0,
      has_used_eve_in_month INTEGER DEFAULT 0,
      has_adopted_eve_before_month INTEGER DEFAULT 0,
      eve_first_use_date TEXT,
      is_eve_repeat_user INTEGER DEFAULT 0,
      eve_active_days INTEGER DEFAULT 0,
      web_or_app TEXT,
      subscription_start_date TEXT,
      last_login_timestamp TEXT,
      total_months_with_login INTEGER DEFAULT 0,
      total_months_with_progress INTEGER DEFAULT 0,
      total_months_with_eve INTEGER DEFAULT 0,
      consumed_month INTEGER DEFAULT 0,
      total_quest_played INTEGER DEFAULT 0,
      total_meditation_played INTEGER DEFAULT 0,
      total_shorts_played INTEGER DEFAULT 0,
      total_standalone_course_played INTEGER DEFAULT 0,
      total_eve_chat_transformation INTEGER DEFAULT 0,
      total_learning_assistance_transformation INTEGER DEFAULT 0,
      number_of_email_delivered INTEGER DEFAULT 0,
      number_of_email_opened INTEGER DEFAULT 0,
      number_of_email_clicked INTEGER DEFAULT 0,
      number_of_push_tapped INTEGER DEFAULT 0,
      have_mastery INTEGER DEFAULT 0,
      have_certification INTEGER DEFAULT 0,
      have_mv_coach INTEGER DEFAULT 0,
      have_accelerator INTEGER DEFAULT 0,
      number_of_premium_program_purchased INTEGER DEFAULT 0,
      UNIQUE(month, auth0_user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_pd_month ON product_data(month);
    CREATE INDEX IF NOT EXISTS idx_pd_status ON product_data(subscription_status);
    CREATE INDEX IF NOT EXISTS idx_pd_eve ON product_data(has_used_eve_in_month);
    CREATE INDEX IF NOT EXISTS idx_pd_month_status ON product_data(month, subscription_status);
    CREATE INDEX IF NOT EXISTS idx_pd_gender ON product_data(gender);
    CREATE INDEX IF NOT EXISTS idx_pd_age ON product_data(age_bracket);
    CREATE INDEX IF NOT EXISTS idx_pd_login ON product_data(has_login_in_month);
  `);
}

/** Drop and recreate if schema is outdated or snapshot month has changed. */
function migrateProductDataIfNeeded(): void {
  const db = getDb();
  try {
    const cols = db.prepare('PRAGMA table_info(product_data)').all() as { name: string }[];
    if (cols.length === 0) return; // table doesn't exist yet

    const hasNewSchema = cols.some(c => c.name === 'consumed_month') && cols.some(c => c.name === 'purchase_price');
    if (!hasNewSchema) {
      db.exec('DROP TABLE IF EXISTS product_data');
      ensureProductDataTable();
      return;
    }

    // Drop if data is from a different snapshot month
    const row = db.prepare('SELECT month FROM product_data LIMIT 1').get() as { month: string } | undefined;
    if (row && row.month !== SNAPSHOT_MONTH) {
      db.exec('DROP TABLE IF EXISTS product_data');
      ensureProductDataTable();
    }
  } catch {
    // table doesn't exist yet — ensureProductDataTable will create it
  }
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

export function seedProductDataIfNeeded(): void {
  try {
    migrateProductDataIfNeeded();
    ensureProductDataTable();
    const db = getDb();

    const count = (
      db.prepare('SELECT COUNT(*) as cnt FROM product_data').get() as { cnt: number }
    ).cnt;
    if (count > 0) return;

    if (!fs.existsSync(DATA_PATH)) return;

    const insert = db.prepare(`
      INSERT OR IGNORE INTO product_data (
        month, auth0_user_id, subscription_status, membership_product_name,
        tier, payment_frequency, tenure_days, is_new_subscriber, country,
        total_tenure_days, lifetime_value, purchase_price, n_content_viewed, content_watched_min,
        acquisition_type, acquisition_channel, acquisition_source,
        traffic_channel, payment_method_type, order_type, sales_channel,
        gender, age_bracket, language,
        has_login_within_15d, has_content_progress_within_15d,
        has_login_in_month, has_progress_in_month,
        has_used_eve_in_month, has_adopted_eve_before_month,
        eve_first_use_date, is_eve_repeat_user, eve_active_days, web_or_app,
        subscription_start_date, last_login_timestamp,
        total_months_with_login, total_months_with_progress, total_months_with_eve,
        consumed_month, total_quest_played, total_meditation_played,
        total_shorts_played, total_standalone_course_played,
        total_eve_chat_transformation, total_learning_assistance_transformation,
        number_of_email_delivered, number_of_email_opened, number_of_email_clicked,
        number_of_push_tapped, have_mastery, have_certification,
        have_mv_coach, have_accelerator, number_of_premium_program_purchased
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const insertBatch = db.transaction((rows: any[]) => {
      for (const r of rows) {
        // Detect BigQuery export format (has pre-computed monthly flags)
        // vs old cumulative format (has total_months_with_* fields)
        const isBQFormat = r.has_login_in_month !== undefined;

        const subStart = clean(r.subscription_start_date);
        const lastLogin = clean(r.last_login_timestamp);

        // Login/progress/EVE flags — use BQ pre-computed values if available
        const hasLoginInMonth = isBQFormat
          ? bool(r.has_login_in_month)
          : isRecent(lastLogin);

        const hasProgressInMonth = isBQFormat
          ? bool(r.has_progress_in_month)
          : (num(r.total_months_with_progress) ?? 0) > 0 ? 1 : 0;

        const hasUsedEVE = isBQFormat
          ? bool(r.has_used_eve_in_month)
          : bool(r.has_ever_used_eve);

        const isEVERepeat = isBQFormat
          ? bool(r.is_eve_repeat_user_in_month)
          : (num(r.total_months_with_eve) ?? 0) >= 2 ? 1 : 0;

        const eveActiveDays = isBQFormat
          ? (num(r.eve_active_days_in_month) ?? 0)
          : (num(r.total_eve_active_days) ?? 0);

        // total_months_with_login: 0 in BQ format (total_active_month_history = tenure, not logins)
        const totalMonthsLogin = isBQFormat ? 0 : (num(r.total_months_with_login) ?? 0);
        // consumed_month = distinct months with any content consumption (BQ) or legacy progress months
        const consumedMonth = isBQFormat
          ? (num(r.consumed_month) ?? 0)
          : (num(r.total_months_with_progress) ?? 0);
        const totalMonthsProgress = consumedMonth;
        const totalMonthsEVE = isBQFormat ? 0 : (num(r.total_months_with_eve) ?? 0);

        insert.run(
          SNAPSHOT_MONTH,
          r.auth0_user_id,
          r.subscription_status ?? null,
          r.membership_product_name ?? null,
          clean(r.tier),
          clean(r.payment_frequency),
          num(r.tenure_of_latest_subscription_days),
          isRecent(subStart),                           // is_new_subscriber
          r.country ?? null,
          num(r.total_tenure_days),
          num(r.lifetime_value),
          num(r.purchase_price),
          num(r.n_content_viewed),
          num(r.content_watched_min),
          r.acquisition_type ?? null,
          r.acquisition_channel ?? null,
          clean(r.acquisition_source),
          clean(r.traffic_channel),
          clean(r.payment_method_type),
          clean(r.order_type),
          clean(r.sales_channel),
          clean(r.gender),
          clean(r.age_bracket),
          clean(r.language),
          bool(r.has_login_within_15d_of_order),
          bool(r.has_content_progress_within_15d_of_order),
          hasLoginInMonth,
          hasProgressInMonth,
          hasUsedEVE,
          hasUsedEVE,                                   // adopted_eve_before_month ≈ used_eve
          null,                                         // eve_first_use_date
          isEVERepeat,
          eveActiveDays,
          clean(r.sales_channel) ?? 'web',
          subStart,
          lastLogin,
          totalMonthsLogin,
          totalMonthsProgress,
          totalMonthsEVE,
          // New columns
          consumedMonth,
          num(r.total_quest_played) ?? 0,
          num(r.total_meditation_played) ?? 0,
          num(r.total_shorts_played) ?? 0,
          num(r.total_standalone_course_played) ?? 0,
          num(r.total_eve_chat_transformation) ?? 0,
          num(r.total_learning_assistance_transformation) ?? 0,
          num(r.number_of_email_delivered) ?? 0,
          num(r.number_of_email_opened) ?? 0,
          num(r.number_of_email_clicked) ?? 0,
          num(r.number_of_push_tapped) ?? 0,
          bool(r.have_mastery),
          bool(r.have_certification),
          bool(r.have_mv_coach),
          bool(r.have_accelerator),
          num(r.number_of_premium_program_purchased) ?? 0
        );
      }
    });

    // Stream NDJSON synchronously in 64 KB chunks — avoids loading 600MB+ into memory
    const CHUNK = 65536;
    const fd = fs.openSync(DATA_PATH, 'r');
    const buf = Buffer.alloc(CHUNK);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let batch: any[] = [];
    let leftover = '';
    let bytesRead = 0;

    try {
      while ((bytesRead = fs.readSync(fd, buf, 0, CHUNK, null)) > 0) {
        const text = leftover + buf.subarray(0, bytesRead).toString('utf-8');
        const lines = text.split('\n');
        leftover = lines.pop() ?? '';

        for (const line of lines) {
          const t = line.trim();
          if (!t || t === '[' || t === ']') continue;
          const src = t.endsWith(',') ? t.slice(0, -1) : t;
          try { batch.push(JSON.parse(src)); } catch { continue; }
          if (batch.length >= 5000) { insertBatch(batch); batch = []; }
        }
      }
      // flush remaining line
      const t = leftover.trim();
      if (t && t !== ']') { try { batch.push(JSON.parse(t)); } catch { /* ignore */ } }
      if (batch.length > 0) insertBatch(batch);
    } finally {
      fs.closeSync(fd);
    }
  } catch (e) {
    console.error('[product-data] seed error:', e);
  }
}

// ---------------------------------------------------------------------------
// Core queries
// ---------------------------------------------------------------------------

export function getLatestMonth(): string {
  return SNAPSHOT_MONTH;
}

export function getMonthlySnapshot(month: string): MonthlySnapshot {
  const db = getDb();

  const base = "FROM product_data WHERE month = ? AND subscription_status = 'active'";

  const active = (db.prepare(`SELECT COUNT(*) as n ${base}`).get(month) as { n: number }).n;
  const loggedIn = (
    db.prepare(`SELECT COUNT(*) as n ${base} AND has_login_in_month = 1`).get(month) as { n: number }
  ).n;
  const hasProgress = (
    db.prepare(`SELECT COUNT(*) as n ${base} AND n_content_viewed >= 4`).get(month) as { n: number }
  ).n;
  const eveUsers = (
    db.prepare(`SELECT COUNT(*) as n ${base} AND has_used_eve_in_month = 1`).get(month) as { n: number }
  ).n;

  return {
    month,
    active,
    loggedIn,
    loginRate: active > 0 ? Math.round((loggedIn / active) * 100) : 0,
    hasProgress,
    progressRate: active > 0 ? Math.round((hasProgress / active) * 100) : 0,
    eveUsers,
    eveRate: active > 0 ? Math.round((eveUsers / active) * 100) : 0,
  };
}

/** No monthly time-series in full snapshot — returns empty array. */
export function getMonthlyTrend(_latestMonth: string, _n = 6): TrendRow[] {
  return [];
}

export function getMRRStats(month: string) {
  const db = getDb();
  const row = db.prepare(`
    SELECT
      COUNT(*) as active,
      SUM(CASE WHEN is_new_subscriber = 1 THEN 1 ELSE 0 END) as new_subs,
      SUM(CASE
        WHEN purchase_price IS NOT NULL AND purchase_price > 0 THEN
          CASE WHEN LOWER(payment_frequency) = 'monthly' THEN purchase_price ELSE purchase_price / 12.0 END
        ELSE 0
      END) as mrr,
      SUM(CASE
        WHEN purchase_price IS NOT NULL AND purchase_price > 0 THEN
          CASE WHEN LOWER(payment_frequency) = 'monthly' THEN purchase_price * 12.0 ELSE purchase_price END
        ELSE 0
      END) as arr,
      SUM(CASE WHEN has_login_in_month = 0 AND is_new_subscriber = 0 THEN
        CASE WHEN purchase_price IS NOT NULL AND purchase_price > 0 THEN
          CASE WHEN LOWER(payment_frequency) = 'monthly' THEN purchase_price * 12.0 ELSE purchase_price END
        ELSE 0 END
      ELSE 0 END) as inactive_arr
    FROM product_data
    WHERE month = ? AND subscription_status = 'active'
  `).get(month) as { active: number; new_subs: number; mrr: number; arr: number; inactive_arr: number } | undefined;

  const active = row?.active ?? 0;
  const mrr = Math.round(row?.mrr ?? 0);
  const arr = Math.round(row?.arr ?? 0);
  return {
    active,
    newSubs: row?.new_subs ?? 0,
    mrr,
    arr,
    avgMonthlySpend: active > 0 ? Math.round(mrr / active) : 0,
    inactiveArr: Math.round(row?.inactive_arr ?? 0),
  };
}

// ---------------------------------------------------------------------------
// Acquisition — channel revenue alignment
// ---------------------------------------------------------------------------

export interface ChannelRevenueRow {
  channel: string;
  members: number;
  arr: number;
  arrPct: number;
  avgAnnualSpend: number;
  avgLtv: number;
  pctActive: number;
  pctTransformer: number;
  newSubs: number;
}

export function getChannelRevenueData(month: string): ChannelRevenueRow[] {
  const db = getDb();

  const totalArr = (db.prepare(`
    SELECT SUM(CASE WHEN purchase_price > 0 THEN
      CASE WHEN LOWER(payment_frequency) = 'monthly' THEN purchase_price * 12.0 ELSE purchase_price END
    ELSE 0 END) as total
    FROM product_data WHERE month = ? AND subscription_status = 'active'
  `).get(month) as { total: number }).total ?? 1;

  const rows = db.prepare(`
    SELECT
      COALESCE(acquisition_channel, 'Unknown') as channel,
      COUNT(*) as members,
      ROUND(SUM(CASE WHEN purchase_price > 0 THEN
        CASE WHEN LOWER(payment_frequency) = 'monthly' THEN purchase_price * 12.0 ELSE purchase_price END
      ELSE 0 END), 0) as arr,
      ROUND(AVG(CASE WHEN purchase_price > 0 THEN
        CASE WHEN LOWER(payment_frequency) = 'monthly' THEN purchase_price * 12.0 ELSE purchase_price END
      ELSE 0 END), 0) as avg_annual_spend,
      ROUND(AVG(lifetime_value), 0) as avg_ltv,
      ROUND(SUM(CASE WHEN has_login_in_month = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) as pct_active,
      ROUND(SUM(CASE WHEN has_login_in_month=1 AND has_progress_in_month=1 AND has_used_eve_in_month=1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) as pct_transformer,
      SUM(CASE WHEN is_new_subscriber = 1 THEN 1 ELSE 0 END) as new_subs
    FROM product_data
    WHERE month = ? AND subscription_status = 'active'
    GROUP BY acquisition_channel
    HAVING members >= 100
    ORDER BY arr DESC
  `).all(month, month) as {
    channel: string; members: number; arr: number; avg_annual_spend: number;
    avg_ltv: number; pct_active: number; pct_transformer: number; new_subs: number;
  }[];

  return rows.map(r => ({
    channel: r.channel,
    members: r.members,
    arr: r.arr,
    arrPct: Math.round((r.arr / totalArr) * 1000) / 10,
    avgAnnualSpend: r.avg_annual_spend,
    avgLtv: r.avg_ltv,
    pctActive: r.pct_active,
    pctTransformer: r.pct_transformer,
    newSubs: r.new_subs,
  }));
}

export function getAcquisitionData(month: string) {
  const db = getDb();

  const base = "FROM product_data WHERE month = ? AND subscription_status = 'active'";
  const total = (db.prepare(`SELECT COUNT(*) as n ${base}`).get(month) as { n: number }).n;

  const channels = db
    .prepare(
      `SELECT COALESCE(acquisition_channel,'Unknown') as name, COUNT(*) as cnt
       ${base} GROUP BY name ORDER BY cnt DESC LIMIT 10`
    )
    .all(month) as { name: string; cnt: number }[];

  const acqTypes = db
    .prepare(
      `SELECT COALESCE(acquisition_type,'Unknown') as name, COUNT(*) as cnt
       ${base} GROUP BY name ORDER BY cnt DESC`
    )
    .all(month) as { name: string; cnt: number }[];

  const tiers = db
    .prepare(
      `SELECT COALESCE(tier,'Unknown') as name, COUNT(*) as cnt
       ${base} GROUP BY name ORDER BY name`
    )
    .all(month) as { name: string; cnt: number }[];

  const freqs = db
    .prepare(
      `SELECT COALESCE(payment_frequency,'Unknown') as name, COUNT(*) as cnt
       ${base} GROUP BY name ORDER BY cnt DESC`
    )
    .all(month) as { name: string; cnt: number }[];

  const countries = db
    .prepare(
      `SELECT COALESCE(country,'Unknown') as name, COUNT(*) as cnt
       ${base} GROUP BY name ORDER BY cnt DESC LIMIT 10`
    )
    .all(month) as { name: string; cnt: number }[];

  const ltvRow = db
    .prepare(`SELECT AVG(lifetime_value) as avg_ltv, SUM(lifetime_value) as total_ltv ${base}`)
    .get(month) as { avg_ltv: number | null; total_ltv: number | null };

  const newSubs = (
    db.prepare(`SELECT COUNT(*) as n ${base} AND is_new_subscriber = 1`).get(month) as { n: number }
  ).n;

  const toBreakdown = (rows: { name: string; cnt: number }[]): ChannelBreakdown[] =>
    rows.map((r) => ({
      name: r.name,
      count: r.cnt,
      pct: total > 0 ? Math.round((r.cnt / total) * 100) : 0,
    }));

  return {
    total,
    newSubs,
    avgLTV: Math.round(ltvRow?.avg_ltv ?? 0),
    totalLTV: Math.round(ltvRow?.total_ltv ?? 0),
    channels: toBreakdown(channels),
    acqTypes: toBreakdown(acqTypes),
    tiers: toBreakdown(tiers),
    paymentFreqs: toBreakdown(freqs),
    topCountries: toBreakdown(countries),
  };
}

// ---------------------------------------------------------------------------
// Activation
// ---------------------------------------------------------------------------

export function getActivationData(month: string) {
  const db = getDb();

  const base = "FROM product_data WHERE month = ? AND subscription_status = 'active'";
  const total = (db.prepare(`SELECT COUNT(*) as n ${base}`).get(month) as { n: number }).n;
  const loggedIn = (
    db.prepare(`SELECT COUNT(*) as n ${base} AND has_login_in_month = 1`).get(month) as { n: number }
  ).n;

  // New subs who activated within 15d
  const newSubs = (
    db.prepare(`SELECT COUNT(*) as n ${base} AND is_new_subscriber = 1`).get(month) as { n: number }
  ).n;
  const newActivated15d = (
    db
      .prepare(
        `SELECT COUNT(*) as n ${base} AND is_new_subscriber = 1 AND has_content_progress_within_15d = 1`
      )
      .get(month) as { n: number }
  ).n;

  // Web vs app split (web_or_app = sales_channel)
  const platforms = db
    .prepare(
      `SELECT COALESCE(web_or_app,'web') as platform, COUNT(*) as cnt
       ${base} AND has_login_in_month = 1 GROUP BY platform`
    )
    .all(month) as { platform: string; cnt: number }[];

  // Login by tier
  const tierLogin = db
    .prepare(
      `SELECT COALESCE(tier,'Unknown') as tier,
        COUNT(*) as total_in_tier,
        SUM(has_login_in_month) as logged_in
       ${base} GROUP BY tier ORDER BY tier`
    )
    .all(month) as { tier: string; total_in_tier: number; logged_in: number }[];

  return {
    total,
    loggedIn,
    loginRate: total > 0 ? Math.round((loggedIn / total) * 100) : 0,
    notLoggedIn: total - loggedIn,
    newSubs,
    newActivated15d,
    activation15dRate: newSubs > 0 ? Math.round((newActivated15d / newSubs) * 100) : 0,
    platforms: platforms.map((p) => ({
      platform: p.platform,
      count: p.cnt,
      pct: loggedIn > 0 ? Math.round((p.cnt / loggedIn) * 100) : 0,
    })),
    tierLogin: tierLogin.map((t) => ({
      tier: t.tier,
      total: t.total_in_tier,
      loggedIn: t.logged_in,
      rate: t.total_in_tier > 0 ? Math.round((t.logged_in / t.total_in_tier) * 100) : 0,
    })),
  };
}

// ---------------------------------------------------------------------------
// Transform
// ---------------------------------------------------------------------------

export function getTransformData(month: string) {
  const db = getDb();

  const base = "FROM product_data WHERE month = ? AND subscription_status = 'active'";
  const total = (db.prepare(`SELECT COUNT(*) as n ${base}`).get(month) as { n: number }).n;
  // Transform = 4+ content views (meaningful engagement threshold)
  const hasProgress = (
    db.prepare(`SELECT COUNT(*) as n ${base} AND n_content_viewed >= 4`).get(month) as { n: number }
  ).n;

  const contentRow = db
    .prepare(
      `SELECT
        AVG(n_content_viewed) as avg_content,
        AVG(content_watched_min) as avg_watch,
        MAX(n_content_viewed) as max_content,
        AVG(total_tenure_days) as avg_tenure
       ${base} AND n_content_viewed >= 4`
    )
    .get(month) as {
    avg_content: number | null;
    avg_watch: number | null;
    max_content: number | null;
    avg_tenure: number | null;
  };

  const allTenureRow = db
    .prepare(`SELECT AVG(total_tenure_days) as avg_tenure ${base}`)
    .get(month) as { avg_tenure: number | null };

  // Engagement tiers: high (>500 mins), medium (100–500), low (<100)
  const engagementTiers = db
    .prepare(
      `SELECT
        SUM(CASE WHEN content_watched_min >= 500 THEN 1 ELSE 0 END) as high,
        SUM(CASE WHEN content_watched_min >= 100 AND content_watched_min < 500 THEN 1 ELSE 0 END) as medium,
        SUM(CASE WHEN content_watched_min < 100 THEN 1 ELSE 0 END) as low
       ${base} AND has_progress_in_month = 1 AND content_watched_min IS NOT NULL`
    )
    .get(month) as { high: number; medium: number; low: number };

  const contentTypesRow = db
    .prepare(
      `SELECT
        SUM(total_quest_played) as quests,
        SUM(total_meditation_played) as meditations,
        SUM(total_shorts_played) as shorts,
        SUM(total_standalone_course_played) as standalone
       ${base} AND has_progress_in_month = 1`
    )
    .get(month) as { quests: number | null; meditations: number | null; shorts: number | null; standalone: number | null };

  // avg(consumed_month / total_active_month_history) for active users with content and positive tenure
  const consumptionRateRow = db
    .prepare(
      `SELECT AVG(CAST(consumed_month AS REAL) / CAST(total_tenure_days AS REAL) * 30.0) as rate
       ${base} AND has_progress_in_month = 1 AND total_tenure_days > 0`
    )
    .get(month) as { rate: number | null };

  return {
    total,
    hasProgress,
    progressRate: total > 0 ? Math.round((hasProgress / total) * 100) : 0,
    notProgress: total - hasProgress,
    avgContentViewed: Math.round(contentRow?.avg_content ?? 0),
    avgWatchMins: Math.round(contentRow?.avg_watch ?? 0),
    avgTenureDays: Math.round(allTenureRow?.avg_tenure ?? 0),
    engagementTiers: {
      high: engagementTiers?.high ?? 0,
      medium: engagementTiers?.medium ?? 0,
      low: engagementTiers?.low ?? 0,
    },
    contentTypes: {
      quests: contentTypesRow?.quests ?? 0,
      meditations: contentTypesRow?.meditations ?? 0,
      shorts: contentTypesRow?.shorts ?? 0,
      standalone: contentTypesRow?.standalone ?? 0,
    },
    consumptionRate: parseFloat(((consumptionRateRow?.rate ?? 0)).toFixed(1)),
  };
}

// ---------------------------------------------------------------------------
// EVE / AI Adoption
// ---------------------------------------------------------------------------

export function getEVEData(month: string) {
  const db = getDb();

  const base = "FROM product_data WHERE month = ? AND subscription_status = 'active'";
  const total = (db.prepare(`SELECT COUNT(*) as n ${base}`).get(month) as { n: number }).n;
  const eveUsers = (
    db.prepare(`SELECT COUNT(*) as n ${base} AND has_used_eve_in_month = 1`).get(month) as { n: number }
  ).n;
  const repeatUsers = (
    db
      .prepare(
        `SELECT COUNT(*) as n ${base} AND has_used_eve_in_month = 1 AND is_eve_repeat_user = 1`
      )
      .get(month) as { n: number }
  ).n;
  // In a single snapshot, "ever adopted" = current users (no lapsed concept)
  const everAdopted = eveUsers;

  const avgDaysRow = db
    .prepare(
      `SELECT AVG(eve_active_days) as avg FROM product_data WHERE month = ? AND has_used_eve_in_month = 1`
    )
    .get(month) as { avg: number | null };

  const eveTransformRow = db
    .prepare(
      `SELECT
        SUM(total_eve_chat_transformation) as eve_transform,
        SUM(total_learning_assistance_transformation) as learn_assist,
        AVG(CASE WHEN has_used_eve_in_month = 1 THEN total_eve_chat_transformation ELSE NULL END) as avg_transform
       FROM product_data WHERE month = ? AND subscription_status = 'active'`
    )
    .get(month) as { eve_transform: number | null; learn_assist: number | null; avg_transform: number | null };

  // Single snapshot — no monthly trend available
  const trend: { month: string; label: string; users: number; rate: number }[] = [];

  return {
    total,
    eveUsers,
    eveRate: total > 0 ? Math.round((eveUsers / total) * 100) : 0,
    repeatUsers,
    repeatRate: eveUsers > 0 ? Math.round((repeatUsers / eveUsers) * 100) : 0,
    everAdopted,
    lapsedEVE: 0, // not determinable from single snapshot
    neverTriedEVE: total - eveUsers,
    avgActiveDays: parseFloat((avgDaysRow?.avg ?? 0).toFixed(1)),
    eveTransformations: eveTransformRow?.eve_transform ?? 0,
    learningAssist: eveTransformRow?.learn_assist ?? 0,
    avgTransformations: parseFloat(((eveTransformRow?.avg_transform ?? 0)).toFixed(1)),
    trend,
    hasData: eveUsers > 0,
  };
}

// ---------------------------------------------------------------------------
// Email & Push Engagement
// ---------------------------------------------------------------------------

export function getEmailData(month: string) {
  const db = getDb();
  const base = "FROM product_data WHERE month = ? AND subscription_status = 'active'";

  const row = db
    .prepare(
      `SELECT
        SUM(number_of_email_delivered) as delivered,
        SUM(number_of_email_opened) as opened,
        SUM(number_of_email_clicked) as clicked,
        SUM(number_of_push_tapped) as push_tapped
       ${base}`
    )
    .get(month) as {
    delivered: number | null;
    opened: number | null;
    clicked: number | null;
    push_tapped: number | null;
  };

  const delivered = row?.delivered ?? 0;
  const opened = row?.opened ?? 0;
  const clicked = row?.clicked ?? 0;
  const pushTapped = row?.push_tapped ?? 0;

  return {
    delivered,
    opened,
    clicked,
    openRate: delivered > 0 ? parseFloat(((opened / delivered) * 100).toFixed(1)) : 0,
    clickRate: opened > 0 ? parseFloat(((clicked / opened) * 100).toFixed(1)) : 0,
    pushTapped,
  };
}

// ---------------------------------------------------------------------------
// Premium Ownership
// ---------------------------------------------------------------------------

export function getPremiumData(month: string) {
  const db = getDb();
  const base = "FROM product_data WHERE month = ? AND subscription_status = 'active'";
  const total = (db.prepare(`SELECT COUNT(*) as n ${base}`).get(month) as { n: number }).n;

  const row = db
    .prepare(
      `SELECT
        SUM(have_mastery) as mastery,
        SUM(have_certification) as cert,
        SUM(have_mv_coach) as coach,
        SUM(have_accelerator) as accel,
        AVG(number_of_premium_program_purchased) as avg_prem
       ${base}`
    )
    .get(month) as {
    mastery: number | null;
    cert: number | null;
    coach: number | null;
    accel: number | null;
    avg_prem: number | null;
  };

  const mastery = row?.mastery ?? 0;
  const cert = row?.cert ?? 0;
  const coach = row?.coach ?? 0;
  const accel = row?.accel ?? 0;

  const hasAny = (db
    .prepare(
      `SELECT COUNT(*) as n ${base} AND (have_mastery = 1 OR have_certification = 1 OR have_mv_coach = 1 OR have_accelerator = 1)`
    )
    .get(month) as { n: number }).n;

  const toPct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0;

  return {
    hasAny,
    hasAnyPct: toPct(hasAny),
    hasMastery: mastery,
    hasMasteryPct: toPct(mastery),
    hasCert: cert,
    hasCertPct: toPct(cert),
    hasCoach: coach,
    hasCoachPct: toPct(coach),
    hasAccelerator: accel,
    hasAcceleratorPct: toPct(accel),
    avgPremiumOwned: parseFloat(((row?.avg_prem ?? 0)).toFixed(2)),
    total,
  };
}

// ---------------------------------------------------------------------------
// Segment revenue breakdown (for Forecast page)
// ---------------------------------------------------------------------------
// Mutually exclusive priority: transform (4+ content views or EVE) > logged in > inactive

export function getSegmentBreakdown(month: string) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT
      CASE
        WHEN n_content_viewed >= 4 OR has_used_eve_in_month = 1 THEN 'with_progress'
        WHEN has_login_in_month = 1 THEN 'logged_in'
        ELSE 'inactive'
      END as segment,
      COUNT(*) as users,
      ROUND(AVG(
        CASE
          WHEN purchase_price IS NOT NULL AND purchase_price > 0 THEN
            CASE WHEN LOWER(payment_frequency) = 'monthly' THEN purchase_price * 12.0 ELSE purchase_price END
          WHEN total_tenure_days IS NOT NULL AND total_tenure_days > 30 THEN
            lifetime_value * 365.0 / total_tenure_days
          ELSE COALESCE(lifetime_value, 0)
        END
      ), 2) as avg_annual_spend
    FROM product_data
    WHERE month = ? AND subscription_status = 'active'
    GROUP BY segment
  `).all(month) as { segment: string; users: number; avg_annual_spend: number }[];

  const by = Object.fromEntries(rows.map(r => [r.segment, r]));
  const seg = (key: string) => ({ users: by[key]?.users ?? 0, avgAnnualSpend: by[key]?.avg_annual_spend ?? 0 });

  return {
    withProgress: seg('with_progress'),
    loggedIn: seg('logged_in'),
    newNotActivated: { users: 0, avgAnnualSpend: 0 }, // removed — folded into inactive
    inactive: seg('inactive'),
  };
}

// ---------------------------------------------------------------------------
// Retention factor rates (for Forecast page levers)
// ---------------------------------------------------------------------------

export function getRetentionFactorRates(month: string) {
  const db = getDb();
  const row = db.prepare(`
    SELECT
      COUNT(*) as active,
      SUM(is_eve_repeat_user) as eve_repeat_users,
      SUM(CASE WHEN has_used_eve_in_month = 1 THEN 1 ELSE 0 END) as eve_users,
      SUM(CASE WHEN total_months_with_progress >= 3 THEN 1 ELSE 0 END) as habit_users,
      SUM(CASE WHEN content_watched_min >= 120 THEN 1 ELSE 0 END) as deep_watch_users
    FROM product_data
    WHERE month = ? AND subscription_status = 'active'
  `).get(month) as {
    active: number;
    eve_repeat_users: number;
    eve_users: number;
    habit_users: number;
    deep_watch_users: number;
  };

  const pct = (n: number) => row.active > 0 ? Math.round((n / row.active) * 100) : 0;
  return {
    eveRepeatRate: pct(row.eve_repeat_users),
    habitRate: pct(row.habit_users),
    deepWatchRate: pct(row.deep_watch_users),
  };
}

// ---------------------------------------------------------------------------
// Product Metrics — consolidated breakdown for the Product Metrics page
// ---------------------------------------------------------------------------

export interface ProductBreakdownRow {
  name: string;
  count: number;
  pct: number;
  avgLtv: number;
}

export interface EngagementBands {
  high: number;
  medium: number;
  low: number;
  none: number;
}

export function getProductMetrics(month: string) {
  const db = getDb();

  const activeBase = "FROM product_data WHERE month = ? AND subscription_status = 'active'";
  const total = (db.prepare(`SELECT COUNT(*) as n ${activeBase}`).get(month) as { n: number }).n;

  const toPct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  // Product (membership_product_name) breakdown
  const products = db
    .prepare(
      `SELECT COALESCE(membership_product_name,'Unknown') as name,
              COUNT(*) as cnt,
              AVG(lifetime_value) as avg_ltv
       ${activeBase} GROUP BY name ORDER BY cnt DESC LIMIT 8`,
    )
    .all(month) as { name: string; cnt: number; avg_ltv: number | null }[];

  // Tier breakdown
  const tiers = db
    .prepare(
      `SELECT COALESCE(tier,'Unknown') as name, COUNT(*) as cnt
       ${activeBase} GROUP BY name ORDER BY name`,
    )
    .all(month) as { name: string; cnt: number }[];

  // Payment frequency breakdown
  const payFreqs = db
    .prepare(
      `SELECT COALESCE(payment_frequency,'Unknown') as name, COUNT(*) as cnt
       ${activeBase} GROUP BY name ORDER BY cnt DESC`,
    )
    .all(month) as { name: string; cnt: number }[];

  // Acquisition channel breakdown
  const channels = db
    .prepare(
      `SELECT COALESCE(acquisition_channel,'Unknown') as name, COUNT(*) as cnt
       ${activeBase} GROUP BY name ORDER BY cnt DESC LIMIT 6`,
    )
    .all(month) as { name: string; cnt: number }[];

  // Engagement bands (content_watched_min)
  const engRow = db
    .prepare(
      `SELECT
        SUM(CASE WHEN content_watched_min >= 500 THEN 1 ELSE 0 END) as high,
        SUM(CASE WHEN content_watched_min >= 100 AND content_watched_min < 500 THEN 1 ELSE 0 END) as medium,
        SUM(CASE WHEN content_watched_min > 0 AND content_watched_min < 100 THEN 1 ELSE 0 END) as low,
        SUM(CASE WHEN content_watched_min IS NULL OR content_watched_min = 0 THEN 1 ELSE 0 END) as none_
       ${activeBase}`,
    )
    .get(month) as { high: number; medium: number; low: number; none_: number };

  // New vs returning
  const newSubs = (db.prepare(`SELECT COUNT(*) as n ${activeBase} AND is_new_subscriber = 1`).get(month) as { n: number }).n;

  // Avg LTV
  const ltvRow = db
    .prepare(`SELECT AVG(lifetime_value) as avg_ltv, SUM(lifetime_value) as total_ltv ${activeBase}`)
    .get(month) as { avg_ltv: number | null; total_ltv: number | null };

  const toRows = (rows: { name: string; cnt: number; avg_ltv?: number | null }[]): ProductBreakdownRow[] =>
    rows.map((r) => ({
      name: r.name,
      count: r.cnt,
      pct: toPct(r.cnt),
      avgLtv: Math.round(r.avg_ltv ?? 0),
    }));

  return {
    total,
    newSubs,
    avgLtv: Math.round(ltvRow?.avg_ltv ?? 0),
    totalLtv: Math.round(ltvRow?.total_ltv ?? 0),
    products: toRows(products),
    tiers: toRows(tiers),
    paymentFreqs: toRows(payFreqs),
    channels: toRows(channels),
    engagement: {
      high: engRow?.high ?? 0,
      medium: engRow?.medium ?? 0,
      low: engRow?.low ?? 0,
      none: engRow?.none_ ?? 0,
    } as EngagementBands,
  };
}
