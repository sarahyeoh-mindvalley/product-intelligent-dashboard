import { NextRequest, NextResponse } from 'next/server';
import { encodeSession, nameFromEmail } from '@/lib/auth';

const LOGIN_PASSWORD = 'mindvalleyproduct';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email, password } = body;

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  const normalized = email.trim().toLowerCase();

  if (!normalized.endsWith('@mindvalley.com')) {
    return NextResponse.json(
      { error: 'Access is restricted to @mindvalley.com email addresses.' },
      { status: 403 },
    );
  }

  if (!password || password !== LOGIN_PASSWORD) {
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 403 });
  }

  const session = {
    name: nameFromEmail(normalized),
    email: normalized,
    role: 'Product' as const,
  };
  const encoded = encodeSession(session);

  const response = NextResponse.json({ ok: true, redirectTo: '/dashboard/activation/purchase-cohorts' });
  response.cookies.set('mv_session', encoded, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}
