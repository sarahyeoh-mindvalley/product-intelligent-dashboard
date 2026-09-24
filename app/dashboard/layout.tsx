import Sidebar from '@/components/Sidebar';
import SeedStatusIndicator from '@/components/SeedStatusIndicator';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto pt-12 sm:pt-0">
        {children}
      </main>
      <SeedStatusIndicator />
    </div>
  );
}
