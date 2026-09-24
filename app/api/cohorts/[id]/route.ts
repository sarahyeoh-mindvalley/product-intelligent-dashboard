import { NextRequest, NextResponse } from 'next/server';
import { getCohortById, updateCohort, deleteCohort, CohortCondition, evaluateCohortMemberCount } from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const numId = parseInt(id, 10);
    if (isNaN(numId)) {
      return NextResponse.json({ ok: false, error: 'Invalid id' }, { status: 400 });
    }

    const cohort = getCohortById(numId);
    if (!cohort) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }

    const memberCount = evaluateCohortMemberCount(cohort.conditions);
    return NextResponse.json({ ok: true, cohort: { ...cohort, memberCount } });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const numId = parseInt(id, 10);
    if (isNaN(numId)) {
      return NextResponse.json({ ok: false, error: 'Invalid id' }, { status: 400 });
    }

    const body = await req.json();
    const { name, conditions } = body as { name: string; conditions: CohortCondition[] };

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ ok: false, error: 'Name is required' }, { status: 400 });
    }
    if (!Array.isArray(conditions) || conditions.length === 0) {
      return NextResponse.json({ ok: false, error: 'At least one condition is required' }, { status: 400 });
    }

    const updated = updateCohort(numId, name.trim(), conditions);
    if (!updated) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }

    const memberCount = evaluateCohortMemberCount(updated.conditions);
    return NextResponse.json({ ok: true, cohort: { ...updated, memberCount } });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const numId = parseInt(id, 10);
    if (isNaN(numId)) {
      return NextResponse.json({ ok: false, error: 'Invalid id' }, { status: 400 });
    }

    const deleted = deleteCohort(numId);
    if (!deleted) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
