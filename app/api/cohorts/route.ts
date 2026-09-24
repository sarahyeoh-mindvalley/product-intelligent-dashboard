import { NextRequest, NextResponse } from 'next/server';
import { getAllCohorts, createCohort, CohortCondition, evaluateCohortMemberCount } from '@/lib/db';

export async function GET() {
  try {
    const cohorts = getAllCohorts();
    // Attach live member counts
    const withCounts = cohorts.map(c => ({
      ...c,
      memberCount: evaluateCohortMemberCount(c.conditions),
    }));
    return NextResponse.json({ ok: true, cohorts: withCounts });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, conditions } = body as { name: string; conditions: CohortCondition[] };

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ ok: false, error: 'Name is required' }, { status: 400 });
    }
    if (!Array.isArray(conditions) || conditions.length === 0) {
      return NextResponse.json({ ok: false, error: 'At least one condition is required' }, { status: 400 });
    }

    const cohort = createCohort(name.trim(), conditions);
    const memberCount = evaluateCohortMemberCount(cohort.conditions);
    return NextResponse.json({ ok: true, cohort: { ...cohort, memberCount } }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
