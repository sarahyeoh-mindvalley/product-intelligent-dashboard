/**
 * POST /api/data/refresh
 *
 * Runs the SQL from data/sql.md against BigQuery and re-seeds purchase_cohorts.
 * Protected by REFRESH_SECRET header (same pattern as weekly-revenue-reporting).
 *
 * Required env vars:
 *   GCP_PROJECT_ID
 *   GCP_SERVICE_ACCOUNT_JSON  (or GOOGLE_APPLICATION_CREDENTIALS)
 *   REFRESH_SECRET            (any long random string)
 *
 * Trigger manually or via GitHub Actions on a schedule.
 */

import { NextRequest, NextResponse } from 'next/server';
import { runQuery } from '@/lib/bigquery';
import { loadSql } from '@/lib/sql-loader';
import { seedFromBigQueryRows } from '@/lib/purchase-metrics';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-refresh-secret');
  if (!process.env.REFRESH_SECRET || secret !== process.env.REFRESH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sql = loadSql();
    console.log('[data/refresh] Running BigQuery query from sql.md…');

    const rows = await runQuery(sql);
    console.log(`[data/refresh] Got ${rows.length} rows from BigQuery`);

    seedFromBigQueryRows(rows);
    console.log('[data/refresh] Seeded purchase_cohorts from BigQuery');

    return NextResponse.json({ ok: true, rows: rows.length, refreshed_at: new Date().toISOString() });
  } catch (err) {
    console.error('[data/refresh] Error:', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
