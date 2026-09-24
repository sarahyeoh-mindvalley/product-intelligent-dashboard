import { NextRequest, NextResponse } from 'next/server';
import { getAllReleases, createRelease } from '@/lib/db';

export async function GET() {
  try {
    const releases = getAllReleases();
    return NextResponse.json({ ok: true, releases });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description, release_date, status } = body as {
      name: string;
      description: string;
      release_date: string;
      status?: 'released' | 'planned';
    };

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ ok: false, error: 'Name is required' }, { status: 400 });
    }
    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return NextResponse.json({ ok: false, error: 'Description is required' }, { status: 400 });
    }
    if (!release_date || typeof release_date !== 'string') {
      return NextResponse.json({ ok: false, error: 'release_date is required (YYYY-MM-DD)' }, { status: 400 });
    }

    const releaseStatus: 'released' | 'planned' = status === 'released' ? 'released' : 'planned';
    const release = createRelease(name.trim(), description.trim(), release_date, releaseStatus);

    return NextResponse.json({ ok: true, release }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
