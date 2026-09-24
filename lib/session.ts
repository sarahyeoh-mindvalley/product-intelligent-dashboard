import { cookies } from 'next/headers';
import { Session } from './auth';

const SESSION_COOKIE = 'mv_session';

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'));
    if (parsed?.name && parsed?.role && parsed?.email) {
      return parsed as Session;
    }
    return null;
  } catch {
    return null;
  }
}
