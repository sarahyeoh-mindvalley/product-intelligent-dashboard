import { NextRequest, NextResponse } from 'next/server';

const UNLOCK_PASSWORD = 'mindvalleyproduct';
const UNLOCK_COOKIE = 'mv_module_unlock';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email, password } = body;

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
  }
  if (!password || typeof password !== 'string') {
    return NextResponse.json({ error: 'Password is required.' }, { status: 400 });
  }

  if (!email.toLowerCase().endsWith('@mindvalley.com')) {
    return NextResponse.json({ error: 'Access is restricted to @mindvalley.com email addresses.' }, { status: 403 });
  }

  if (password !== UNLOCK_PASSWORD) {
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 403 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(UNLOCK_COOKIE, UNLOCK_PASSWORD, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return response;
}
