import { fetchDashboardServerData } from '@/lib/server-data';
import DashboardClient from './DashboardClient';

/** RSC dashboard — initial data from server (US-F-001). */
export default async function DashboardPage() {
  const data = await fetchDashboardServerData();
  const empty = {
    stats: { totalJobs: 0, totalRoutes: 0, totalTeamMembers: 0, totalProperties: 0 },
    completedJobs: [],
    pendingJobs: [],
  };

  return <DashboardClient {...(data ?? empty)} />;
}
