import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import Sidebar from '@/components/Sidebar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar session={session} />
      <main className="flex-1 overflow-y-auto pt-12 sm:pt-0">
        {children}
      </main>
    </div>
  );
}
