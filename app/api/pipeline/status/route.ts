import { NextResponse } from 'next/server';
import { getLatestPipelineRun, getSourceCountsForRun, getAllPipelineRuns } from '@/lib/db';

export async function GET() {
  try {
    const latestRun = getLatestPipelineRun();

    if (!latestRun) {
      return NextResponse.json({ status: 'no_data', lastRun: null, sourceCounts: null });
    }

    const sourceCounts = getSourceCountsForRun(latestRun.id);
    const allRuns = getAllPipelineRuns();

    return NextResponse.json({
      status: 'ok',
      lastRun: latestRun,
      sourceCounts,
      allRuns,
    });
  } catch (err) {
    console.error('Pipeline status error:', err);
    return NextResponse.json({ status: 'error', error: String(err) }, { status: 500 });
  }
}
