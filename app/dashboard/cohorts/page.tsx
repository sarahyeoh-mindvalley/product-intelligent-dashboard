import { getMLCohorts } from '@/lib/clustering';
import { getAllCohorts, evaluateCohortMemberCount } from '@/lib/db';
import { getPipelineStatus } from '@/lib/pipeline-status';
import DashboardHeader from '@/components/DashboardHeader';
import CohortsClient from './CohortsClient';

export const dynamic = 'force-dynamic';

export default function CohortsPage() {
  const { status, lastRunDate } = getPipelineStatus();

  // ML cohorts (server-side clustering)
  const mlCohorts = getMLCohorts();

  // Rule-based cohorts with live member counts
  const rawRuleCohorts = getAllCohorts();
  const ruleCohorts = rawRuleCohorts.map(c => ({
    ...c,
    conditions: c.conditions,
    memberCount: evaluateCohortMemberCount(c.conditions),
  }));

  return (
    <div className="min-h-full">
      <DashboardHeader
        title="Customer Cohorts"
        subtitle="ML-identified segments and analyst-defined cohorts"
        lastRunDate={lastRunDate}
        pipelineStatus={status}
      />
      <CohortsClient
        initialMlCohorts={mlCohorts}
        initialRuleCohorts={ruleCohorts}
        hasData={status === 'ok'}
      />
    </div>
  );
}
