import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { roleToPath } from '@/lib/auth';

export default async function Home() {
  const session = await getSession();
  if (session) {
    redirect(roleToPath(session.role));
  }
  redirect('/login');
}
