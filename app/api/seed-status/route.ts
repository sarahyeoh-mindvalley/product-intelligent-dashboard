import { NextResponse } from 'next/server';
import fs from 'fs';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

const STATUS_PATH = '/tmp/seed-status.json';

export async function GET() {
  // Read status file written by the seed script
  let fileStatus: Record<string, unknown> | null = null;
  try {
    fileStatus = JSON.parse(fs.readFileSync(STATUS_PATH, 'utf-8'));
  } catch {
    // File doesn't exist yet — seed hasn't started or not running
  }

  // Also check the actual row count as source of truth
  let rows = 0;
  try {
    const db = getDb();
    rows = (db.prepare('SELECT COUNT(*) as cnt FROM purchase_cohorts').get() as { cnt: number }).cnt;
  } catch {
    // Table may not exist yet
  }

  return NextResponse.json({ ...fileStatus, rows });
}
