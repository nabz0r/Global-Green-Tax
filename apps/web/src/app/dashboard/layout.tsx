'use client';

import { Sidebar } from '@/components/dashboard/sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      {/* Main content – shifts by sidebar width via peer/group is complex;
          use a stable left margin. The sidebar animates 72-260px,
          so we use the expanded width as min margin for layout stability. */}
      <main className="ml-[260px] flex-1 min-w-0 transition-[margin] duration-200">
        {children}
      </main>
    </div>
  );
}
