import { NextResponse } from 'next/server';
import { withApiTiming } from '@/lib/api-timing';
import { fetchDashboardServerData } from '@/lib/server-data';

export async function GET() {
  return withApiTiming('GET /api/dashboard', async () => {
    const data = await fetchDashboardServerData();
    if (!data) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(data);
  });
}
