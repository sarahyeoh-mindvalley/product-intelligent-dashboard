import path from 'path';
import fs from 'fs';
import { getLatestPipelineRun, getSourceCountsForRun, getDb, SourceCounts } from './db';

export interface PipelineStatus {
  status: 'ok' | 'no_data' | 'error';
  lastRunDate: string | null;
  sourceCounts: SourceCounts | null;
  runId: number | null;
}

export function getPipelineStatus(): PipelineStatus {
  try {
    const latestRun = getLatestPipelineRun();

    if (latestRun) {
      const sourceCounts = getSourceCountsForRun(latestRun.id);
      return { status: 'ok', lastRunDate: latestRun.run_date, sourceCounts, runId: latestRun.id };
    }

    // Fall back: check if product_data has been seeded from the JSON export
    try {
      const db = getDb();
      const row = db.prepare("SELECT COUNT(*) as n FROM product_data WHERE subscription_status='active'").get() as { n: number } | undefined;
      if (row && row.n > 0) {
        // Use the JSON file modification date as the data date
        const dataPath = path.join(process.cwd(), 'data', 'product_data_full.json');
        const mtime = fs.existsSync(dataPath) ? fs.statSync(dataPath).mtime : new Date();
        return { status: 'ok', lastRunDate: mtime.toISOString().slice(0, 10), sourceCounts: null, runId: null };
      }
    } catch {
      // product_data table doesn't exist yet — still seeding
    }

    return { status: 'no_data', lastRunDate: null, sourceCounts: null, runId: null };
  } catch {
    return { status: 'error', lastRunDate: null, sourceCounts: null, runId: null };
  }
}
