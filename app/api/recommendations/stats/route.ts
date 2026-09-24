import { NextResponse } from 'next/server';
import {
  getActOnStats,
  ensureRecommendationsTable,
  expireStaleRecommendations,
  seedRecommendationsIfEmpty,
} from '@/lib/recommendations';

export async function GET() {
  try {
    ensureRecommendationsTable();
    expireStaleRecommendations();
    seedRecommendationsIfEmpty();

    const stats = getActOnStats();
    return NextResponse.json({ ok: true, stats });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
