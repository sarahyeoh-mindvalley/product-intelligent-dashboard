import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function getSessionEmail(request: NextRequest): string | null {
  const raw = request.cookies.get('mv_session')?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'));
    return typeof parsed?.email === 'string' ? parsed.email.toLowerCase() : null;
  } catch {
    return null;
  }
}

const ALLOWED_PATH = '/dashboard/activation/purchase-cohorts';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only intercept dashboard routes
  if (!pathname.startsWith('/dashboard')) {
    return NextResponse.next();
  }

  // Unauthenticated — redirect to login
  const email = getSessionEmail(request);
  if (!email || !email.endsWith('@mindvalley.com')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Authenticated — only the north star metric page is unlocked
  if (pathname === ALLOWED_PATH || pathname.startsWith(ALLOWED_PATH + '/')) {
    return NextResponse.next();
  }

  // All other dashboard routes are locked
  return NextResponse.redirect(new URL('/locked', request.url));
}

export const config = {
  matcher: '/dashboard/:path*',
};
