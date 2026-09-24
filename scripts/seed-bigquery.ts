/**
 * Startup seed script — runs before `pnpm start` in production.
 *
 * Reads data/sql.md, runs it against BigQuery, and seeds the local
 * SQLite database. Exits 0 on success or when credentials are not
 * configured (so the server still starts). Exits 1 on unexpected error.
 */

import { BigQuery } from '@google-cloud/bigquery';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const DB_DIR = process.env.VERCEL ? '/tmp/data' : path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'cohorts.db');
const SQL_PATH = path.join(process.cwd(), 'data', 'sql.md');

function loadSql(): string {
  const content = fs.readFileSync(SQL_PATH, 'utf-8');
  const fenced = content.match(/```(?:sql)?\n([\s\S]*?)```/);
  return fenced ? fenced[1].trim() : content.trim();
}

function normalizeValue(v: unknown): unknown {
  if (v && typeof v === 'object' && 'value' in (v as object)) {
    return (v as { value: unknown }).value;
  }
  if (v instanceof Date) return v.toISOString();
  return v;
}

function mondayOfWeek(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().substring(0, 10);
}

async function main() {
  // Skip if no credentials
  if (!process.env.GCP_PROJECT_ID || (!process.env.GCP_SERVICE_ACCOUNT_JSON && !process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
    console.log('[seed] No BigQuery credentials configured — skipping seed');
    process.exit(0);
  }

  if (!fs.existsSync(SQL_PATH)) {
    console.error('[seed] data/sql.md not found');
    process.exit(1);
  }

  // Ensure data directory
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  // Connect to SQLite
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  // Check if already seeded
  db.exec(`
    CREATE TABLE IF NOT EXISTS purchase_cohorts_meta (key TEXT PRIMARY KEY, value TEXT);
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
  `);

  const { cnt } = db.prepare('SELECT COUNT(*) as cnt FROM purchase_cohorts').get() as { cnt: number };
  if (cnt > 0) {
    console.log(`[seed] purchase_cohorts already has ${cnt} rows — skipping`);
    process.exit(0);
  }

  // Connect to BigQuery
  console.log('[seed] Connecting to BigQuery…');
  const credentials = process.env.GCP_SERVICE_ACCOUNT_JSON
    ? JSON.parse(process.env.GCP_SERVICE_ACCOUNT_JSON)
    : undefined;

  const bq = new BigQuery({
    projectId: process.env.GCP_PROJECT_ID,
    ...(credentials ? { credentials } : {}),
  });

  // Run query
  console.log('[seed] Running BigQuery query from data/sql.md…');
  const sql = loadSql();
  const [rows] = await bq.query({ query: sql });
  console.log(`[seed] Got ${rows.length} rows`);

  // Seed SQLite
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const normalized = (rows as Record<string, unknown>[]).map(row =>
    Object.fromEntries(Object.entries(row).map(([k, v]) => [k, normalizeValue(v)]))
  );

  const insertAll = db.transaction(() => {
    let inserted = 0;
    for (const r of normalized) {
      const recordId = r.purchase_record_id as string;
      if (!recordId) continue;
      const userId = r.user_id as string;
      if (!userId) continue;
      const rawDate = typeof r.purchase_timestamp === 'string' ? r.purchase_timestamp.substring(0, 10) : '';
      if (!rawDate) continue;

      const week = mondayOfWeek(rawDate);
      const hasQuest = r.has_funnel_quest_id === true || r.has_funnel_quest_id === 'true';

      const rawLogin = r.days_to_first_login;
      const loginVal = rawLogin !== null && rawLogin !== undefined ? parseInt(String(rawLogin), 10) : null;

      const rawAct = r.days_to_first_activation;
      const actVal = rawAct !== null && rawAct !== undefined ? parseInt(String(rawAct), 10) : null;

      const orderAmt = r.order_amount !== null && r.order_amount !== undefined ? parseFloat(String(r.order_amount)) : null;

      const rawFreq = String(r.payment_frequency ?? '');
      const freq = rawFreq === '1' ? 'Monthly' : rawFreq === '12' ? 'Yearly' : rawFreq === '36' ? '3-Year' : rawFreq || null;

      const isMC = r.is_mc_funnel === true || r.is_mc_funnel === 'true' ? 1 : 0;
      const isVSL = r.is_vsl_funnel === true || r.is_vsl_funnel === 'true' ? 1 : 0;
      const isFirst = r.is_first_order === true || r.is_first_order === 'true' ? 1 : 0;
      const hasDiscount = r.discount_id !== null && r.discount_id !== undefined ? 1 : 0;

      let daysToCancel: number | null = null;
      const rawCanceledAt = r.canceled_at as string | undefined;
      if (rawCanceledAt) {
        const diff = Math.round((new Date(rawCanceledAt.replace(' UTC', 'Z')).getTime() - new Date(rawDate + 'T00:00:00Z').getTime()) / 86400000);
        if (!isNaN(diff) && diff >= 0) daysToCancel = diff;
      }

      let daysToRefund: number | null = null;
      const rawRefund = r.refund_timestamp as string | undefined;
      if (rawRefund) {
        const diff = Math.round((new Date(rawRefund.replace(' UTC', 'Z')).getTime() - new Date(rawDate + 'T00:00:00Z').getTime()) / 86400000);
        if (!isNaN(diff) && diff >= 0) daysToRefund = diff;
      }

      const isInvoluntaryChurn = r.is_involuntary_churn === true || r.is_involuntary_churn === 'true' ? 1 : 0;

      const countryMap: Record<string, string> = { US: 'US', GB: 'UK', AU: 'Australia', CA: 'Canada', DE: 'Germany' };
      const rawCountry = (r.country as string) || '';
      const country = rawCountry && rawCountry !== 'Not Available' ? (countryMap[rawCountry] ?? 'RoW') : null;

      const rawPaymentMethod = (r.payment_method_type as string) || '';
      let paymentProcessor: string | null = null;
      if ((r.source as string) === 'apple_app_store') paymentProcessor = 'Apple';
      else if ((r.source as string) === 'google_play_store') paymentProcessor = 'Google Play';
      else if (rawPaymentMethod === 'paypal') paymentProcessor = 'PayPal';
      else if (rawPaymentMethod === 'klarna') paymentProcessor = 'Klarna';
      else if (rawPaymentMethod === 'card' || rawPaymentMethod === 'creditcard' || rawPaymentMethod === '') paymentProcessor = 'Card';

      insert.run(
        recordId, userId, week, rawDate,
        isNaN(loginVal ?? NaN) ? null : loginVal,
        isNaN(actVal ?? NaN) ? null : actVal,
        (r.unified_traffic_source as string) || null,
        (r.campaign_type as string) || null,
        freq,
        (r.device_category as string) || null,
        hasDiscount,
        isNaN(orderAmt ?? NaN) ? null : orderAmt,
        (r.product_funnel as string) || null,
        isMC, isVSL, isFirst,
        (r.order_type as string) || null,
        (r.place_in_funnel as string) || null,
        (r.product_type as string) || null,
        hasQuest ? 1 : 0,
        (r.product_name as string) || null,
        daysToCancel, daysToRefund, isInvoluntaryChurn,
        country, paymentProcessor,
      );
      inserted++;
    }
    console.log(`[seed] Inserted ${inserted} rows into purchase_cohorts`);
  });

  insertAll();
  db.close();
  console.log('[seed] Done');
}

main().catch(err => {
  console.error('[seed] Fatal error:', err);
  process.exit(1);
});
