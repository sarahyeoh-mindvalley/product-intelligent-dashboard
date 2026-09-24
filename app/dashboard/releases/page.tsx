import { getAllReleases } from '@/lib/db';
import { getPipelineStatus } from '@/lib/pipeline-status';
import { getRankedPlannedReleases, computeForecastAccuracy } from '@/lib/releases';
import DashboardHeader from '@/components/DashboardHeader';
import ReleasesClient from './ReleasesClient';

export const dynamic = 'force-dynamic';

export default function ReleasesPage() {
  const { status, lastRunDate } = getPipelineStatus();
  const allReleases = getAllReleases();
  const pastReleases = allReleases.filter(r => r.status === 'released');
  const rankedPlanned = getRankedPlannedReleases();
  const accuracy = computeForecastAccuracy();

  return (
    <div className="min-h-full">
      <DashboardHeader
        title="Feature Release Impact"
        subtitle="Historical attribution and forward-looking forecasts by cohort"
        lastRunDate={lastRunDate}
        pipelineStatus={status}
      />
      <ReleasesClient
        pastReleases={pastReleases}
        rankedPlanned={rankedPlanned}
        accuracy={accuracy}
      />
    </div>
  );
}
