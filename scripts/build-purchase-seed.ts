/**
 * Rebuilds seed/cohorts.db.gz to include the purchase_cohorts table,
 * seeded from data/l26weeks_product_metric_v3.json (which is not deployed
 * to Vercel — see .vercelignore). Run this locally whenever that JSON
 * changes, then commit the resulting seed/cohorts.db.gz.
 *
 * Run with: pnpm tsx scripts/build-purchase-seed.ts
 */

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const SEED_GZ = path.join(process.cwd(), 'seed', 'cohorts.db.gz');
const DB_PATH = path.join(process.cwd(), 'data', 'cohorts.db');
const BACKUP_PATH = DB_PATH + '.localbak';

if (!fs.existsSync(SEED_GZ)) {
  throw new Error(`Missing ${SEED_GZ}`);
}

// Preserve the current local dev db so this script doesn't clobber it.
if (fs.existsSync(DB_PATH)) {
  fs.renameSync(DB_PATH, BACKUP_PATH);
}
for (const ext of ['-wal', '-shm']) {
  const p = DB_PATH + ext;
  if (fs.existsSync(p)) fs.rmSync(p);
}

// Start from the currently-committed seed snapshot so product_data,
// pipeline_runs, etc. are preserved — only purchase_cohorts is added.
fs.writeFileSync(DB_PATH, zlib.gunzipSync(fs.readFileSync(SEED_GZ)));

async function main() {
  const { getDb } = await import('../lib/db');
  const { seedPurchaseMetricsIfNeeded } = await import('../lib/purchase-metrics');

  getDb(); // ensure base schema exists (idempotent)
  seedPurchaseMetricsIfNeeded();

  const db = getDb();
  const count = (db.prepare('SELECT COUNT(*) as c FROM purchase_cohorts').get() as { c: number }).c;
  console.log(`purchase_cohorts rows: ${count}`);
  db.close();

  const rebuilt = fs.readFileSync(DB_PATH);
  fs.writeFileSync(SEED_GZ, zlib.gzipSync(rebuilt));
  console.log(`Wrote ${SEED_GZ} (${(fs.statSync(SEED_GZ).size / 1024 / 1024).toFixed(1)} MB)`);

  // Restore the original local dev db.
  fs.rmSync(DB_PATH);
  for (const ext of ['-wal', '-shm']) {
    const p = DB_PATH + ext;
    if (fs.existsSync(p)) fs.rmSync(p);
  }
  if (fs.existsSync(BACKUP_PATH)) {
    fs.renameSync(BACKUP_PATH, DB_PATH);
  }
}

main();
