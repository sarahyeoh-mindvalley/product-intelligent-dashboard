import { NextRequest, NextResponse } from 'next/server';
import { markRecommendationActedOn, ensureRecommendationsTable } from '@/lib/recommendations';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    ensureRecommendationsTable();
    const { id } = await params;
    const numId = parseInt(id, 10);

    if (isNaN(numId)) {
      return NextResponse.json({ ok: false, error: 'Invalid id' }, { status: 400 });
    }

    const updated = markRecommendationActedOn(numId);
    if (!updated) {
      return NextResponse.json(
        { ok: false, error: 'Recommendation not found or already acted on' },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, recommendation: updated });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
