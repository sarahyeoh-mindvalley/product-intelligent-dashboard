import { NextRequest, NextResponse } from 'next/server';
import {
  getRecommendationsByRole,
  ensureRecommendationsTable,
  seedRecommendationsIfEmpty,
  expireStaleRecommendations,
} from '@/lib/recommendations';

export async function GET(req: NextRequest) {
  try {
    ensureRecommendationsTable();
    expireStaleRecommendations();
    seedRecommendationsIfEmpty();

    const { searchParams } = new URL(req.url);
    const role = searchParams.get('role') as 'marketing' | 'content' | 'product' | null;

    if (!role || !['marketing', 'content', 'product'].includes(role)) {
      return NextResponse.json(
        { ok: false, error: 'role query param required: marketing | content | product' },
        { status: 400 },
      );
    }

    const recommendations = getRecommendationsByRole(role);
    return NextResponse.json({ ok: true, recommendations });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
