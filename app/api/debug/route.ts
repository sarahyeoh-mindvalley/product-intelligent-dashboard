import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getDb } from '@/lib/db';
import { getMLCohorts } from '@/lib/clustering';

export const dynamic = 'force-dynamic';

export async function GET() {
  const cwd = process.cwd();
  const dataDir = process.env.VERCEL ? '/tmp/data' : path.join(cwd, 'data');
  const seedPath = path.join(cwd, 'seed', 'cohorts.db.gz');
  const dbPath = path.join(dataDir, 'cohorts.db');

  const info: Record<string, unknown> = {
    cwd,
    isVercel: !!process.env.VERCEL,
    seedPath,
    seedExists: fs.existsSync(seedPath),
    seedSize: fs.existsSync(seedPath) ? fs.statSync(seedPath).size : 0,
    dbPath,
    dbExists: fs.existsSync(dbPath),
    dbSize: fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0,
    seedDirExists: fs.existsSync(path.join(cwd, 'seed')),
    seedDirContents: fs.existsSync(path.join(cwd, 'seed'))
      ? fs.readdirSync(path.join(cwd, 'seed'))
      : [],
  };

  try {
    const db = getDb();
    const months = db.prepare('SELECT DISTINCT month FROM product_data LIMIT 5').all();
    info.months = months;
    const counts = db.prepare(
      "SELECT subscription_status, COUNT(*) as cnt FROM product_data WHERE month='2026-07' GROUP BY subscription_status"
    ).all();
    info.counts = counts;
    const arr = db.prepare(
      "SELECT ROUND(SUM(CASE WHEN purchase_price>0 THEN CASE WHEN LOWER(payment_frequency)='monthly' THEN purchase_price*12 ELSE purchase_price END ELSE 0 END)/1e6,2) as arr FROM product_data WHERE subscription_status='active' AND month='2026-07'"
    ).get();
    info.arrMillions = arr;

    // Test rowid sampling
    const step = 17;
    const sampleCount = db.prepare(
      `SELECT COUNT(*) as n FROM product_data WHERE month='2026-07' AND subscription_status='active' AND (rowid % ${step}) = 0`
    ).get();
    info.rowidSampleCount = sampleCount;
  } catch (e) {
    info.dbError = String(e);
  }

  try {
    const mlCohorts = getMLCohorts(true);
    info.mlCohorts = mlCohorts.map(c => ({ id: c.id, memberCount: c.memberCount }));
  } catch (e) {
    info.mlCohortError = String(e);
  }

  return NextResponse.json(info, { status: 200 });
}
