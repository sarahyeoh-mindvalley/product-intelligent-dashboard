import { NextRequest, NextResponse } from 'next/server';
import { getReleaseById } from '@/lib/db';
import { getReleaseDetail, computePlannedReleaseForecast } from '@/lib/releases';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const releaseId = parseInt(id, 10);
    if (isNaN(releaseId)) {
      return NextResponse.json({ ok: false, error: 'Invalid release ID' }, { status: 400 });
    }

    const release = getReleaseById(releaseId);
    if (!release) {
      return NextResponse.json({ ok: false, error: 'Release not found' }, { status: 404 });
    }

    const detail = getReleaseDetail(release);

    // For planned releases, also return a forecast
    let forecast = null;
    if (release.status === 'planned') {
      forecast = computePlannedReleaseForecast(releaseId);
    }

    return NextResponse.json({ ok: true, detail, forecast });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
