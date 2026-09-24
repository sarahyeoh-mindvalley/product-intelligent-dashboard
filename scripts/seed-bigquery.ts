/**
 * Startup seed script — seeds SQLite from the local JSON file.
 * BigQuery disabled until GCP permissions are granted.
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const DB_DIR = process.env.VERCEL ? '/tmp/data' : path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'cohorts.db');
const JSON_PATH = path.join(process.cwd(), 'data', 'l52weeks_product_metric_v9.json');
const JSON_GZ_PATH = path.join(process.cwd(), 'data', 'l52weeks_product_metric_v9.json.gz');
const STATUS_PATH = '/tmp/seed-status.json';

type SeedStatus = {
  status: 'running' | 'done' | 'skipped' | 'error';
  startedAt: string;
  completedAt?: string;
  rows?: number;
  error?: string;
};

function writeStatus(s: SeedStatus) {
  try { fs.writeFileSync(STATUS_PATH, JSON.stringify(s)); } catch { /* ignore */ }
}

function mondayOfWeek(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().substring(0, 10);
}

function seedFromJson(db: Database.Database): number {
  let lines: string[] = [];
  if (fs.existsSync(JSON_GZ_PATH)) {
    console.log('[seed] Reading', JSON_GZ_PATH);
    lines = zlib.gunzipSync(fs.readFileSync(JSON_GZ_PATH)).toString('utf-8').split('\n');
  } else if (fs.existsSync(JSON_PATH)) {
    console.log('[seed] Reading', JSON_PATH);
    lines = fs.readFileSync(JSON_PATH, 'utf-8').split('\n');
  } else {
    console.log('[seed] No local data file found — skipping');
    return 0;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawRows: any[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    try { rawRows.push(JSON.parse(t)); } catch { continue; }
  }
  console.log(`[seed] Parsed ${rawRows.length} rows`);

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

  const countryMap: Record<string, string> = { US: 'US', GB: 'UK', AU: 'Australia', CA: 'Canada', DE: 'Germany' };
  let inserted = 0;

  const insertAll = db.transaction(() => {
    for (const r of rawRows) {
      const recordId = r.purchase_record_id as string;
      if (!recordId) continue;
      const userId = r.user_id as string;
      if (!userId) continue;
      const rawDate = typeof r.purchase_timestamp === 'string' ? r.purchase_timestamp.substring(0, 10) : '';
      if (!rawDate) continue;

      const week = mondayOfWeek(rawDate);
      const loginVal = r.days_to_first_login != null ? parseInt(String(r.days_to_first_login), 10) : null;
      const actVal = r.days_to_first_activation != null ? parseInt(String(r.days_to_first_activation), 10) : null;
      const orderAmt = r.order_amount != null ? parseFloat(String(r.order_amount)) : null;
      const rawFreq = String(r.payment_frequency ?? '');
      const freq = rawFreq === '1' ? 'Monthly' : rawFreq === '12' ? 'Yearly' : rawFreq === '36' ? '3-Year' : rawFreq || null;
      const isMC = r.is_mc_funnel === true || r.is_mc_funnel === 'true' ? 1 : 0;
      const isVSL = r.is_vsl_funnel === true || r.is_vsl_funnel === 'true' ? 1 : 0;
      const isFirst = r.is_first_order === true || r.is_first_order === 'true' ? 1 : 0;
      const hasDiscount = r.discount_id != null ? 1 : 0;
      const hasQuest = r.has_funnel_quest_id === true || r.has_funnel_quest_id === 'true' ? 1 : 0;

      let daysToCancel: number | null = null;
      if (r.canceled_at) {
        const d = Math.round((new Date((r.canceled_at as string).replace(' UTC', 'Z')).getTime() - new Date(rawDate + 'T00:00:00Z').getTime()) / 86400000);
        if (!isNaN(d) && d >= 0) daysToCancel = d;
      }
      let daysToRefund: number | null = null;
      if (r.refund_timestamp) {
        const d = Math.round((new Date((r.refund_timestamp as string).replace(' UTC', 'Z')).getTime() - new Date(rawDate + 'T00:00:00Z').getTime()) / 86400000);
        if (!isNaN(d) && d >= 0) daysToRefund = d;
      }
      const isInvoluntaryChurn = r.is_involuntary_churn === true || r.is_involuntary_churn === 'true' ? 1 : 0;
      const rawCountry = (r.country as string) || '';
      const country = rawCountry && rawCountry !== 'Not Available' ? (countryMap[rawCountry] ?? 'RoW') : null;
      const rawPaymentMethod = (r.payment_method_type as string) || '';
      let paymentProcessor: string | null = null;
      if ((r.source as string) === 'apple_app_store') paymentProcessor = 'Apple';
      else if ((r.source as string) === 'google_play_store') paymentProcessor = 'Google Play';
      else if (rawPaymentMethod === 'paypal') paymentProcessor = 'PayPal';
      else if (rawPaymentMethod === 'klarna') paymentProcessor = 'Klarna';
      else paymentProcessor = 'Card';

      insert.run(
        recordId, userId, week, rawDate,
        isNaN(loginVal ?? NaN) ? null : loginVal,
        isNaN(actVal ?? NaN) ? null : actVal,
        (r.unified_traffic_source as string) || null,
        (r.campaign_type as string) || null,
        freq,
        (r.device_category as string) || null,
        hasDiscount, isNaN(orderAmt ?? NaN) ? null : orderAmt,
        (r.product_funnel as string) || null,
        isMC, isVSL, isFirst,
        (r.order_type as string) || null,
        (r.place_in_funnel as string) || null,
        (r.product_type as string) || null,
        hasQuest,
        (r.product_name as string) || null,
        daysToCancel, daysToRefund, isInvoluntaryChurn,
        country, paymentProcessor,
      );
      inserted++;
    }
  });
  insertAll();
  console.log(`[seed] Inserted ${inserted} rows`);
  return inserted;
}

async function main() {
  const startedAt = new Date().toISOString();

  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS purchase_cohorts_meta (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE IF NOT EXISTS purchase_cohorts (
      purchase_record_id TEXT NOT NULL PRIMARY KEY,
      user_id TEXT NOT NULL, purchase_week TEXT NOT NULL, purchase_date TEXT NOT NULL,
      days_to_login INTEGER, days_to_activation INTEGER,
      traffic_source TEXT, campaign_type TEXT, payment_frequency TEXT, device_category TEXT,
      has_discount INTEGER DEFAULT 0, order_amount REAL, product_funnel TEXT,
      is_mc_funnel INTEGER DEFAULT 0, is_vsl_funnel INTEGER DEFAULT 0, is_first_order INTEGER DEFAULT 0,
      order_type TEXT, place_in_funnel TEXT, product_type TEXT, has_funnel_quest INTEGER DEFAULT 0,
      product_name TEXT, days_to_cancel INTEGER, days_to_refund INTEGER,
      is_involuntary_churn INTEGER DEFAULT 0, country TEXT, payment_processor TEXT
    );
  `);

  const { cnt } = db.prepare('SELECT COUNT(*) as cnt FROM purchase_cohorts').get() as { cnt: number };
  if (cnt > 0) {
    console.log(`[seed] Already has ${cnt} rows — skipping`);
    writeStatus({ status: 'done', startedAt, completedAt: new Date().toISOString(), rows: cnt });
    db.close();
    return;
  }

  writeStatus({ status: 'running', startedAt });
  const rows = seedFromJson(db);
  db.close();
  writeStatus({ status: rows > 0 ? 'done' : 'skipped', startedAt, completedAt: new Date().toISOString(), rows });
}

main().catch(err => {
  console.error('[seed] Error:', err);
  try { fs.writeFileSync(STATUS_PATH, JSON.stringify({ status: 'skipped', startedAt: new Date().toISOString(), completedAt: new Date().toISOString() })); } catch { /* ignore */ }
});

export {};
