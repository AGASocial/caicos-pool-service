import Link from 'next/link';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 border-r border-gray-200 bg-white p-4">
        <nav className="flex flex-col gap-2">
          <Link href="/dashboard" className="rounded px-3 py-2 hover:bg-gray-100">
            Dashboard
          </Link>
          <Link href="/dashboard/jobs" className="rounded px-3 py-2 hover:bg-gray-100">
            Jobs
          </Link>
          <Link href="/dashboard/properties" className="rounded px-3 py-2 hover:bg-gray-100">
            Properties
          </Link>
          <Link href="/dashboard/technicians" className="rounded px-3 py-2 hover:bg-gray-100">
            Team
          </Link>
          <Link href="/dashboard/reports" className="rounded px-3 py-2 hover:bg-gray-100">
            Reports
          </Link>
          <Link href="/dashboard/settings" className="rounded px-3 py-2 hover:bg-gray-100">
            Settings
          </Link>
        </nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
