import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getMLCohorts } from '@/lib/clustering';
import { getCohortById, evaluateCohortMemberCount, getAllPipelineRuns } from '@/lib/db';
import { getPipelineStatus } from '@/lib/pipeline-status';
import {
  computeForecasts,
  getCustomerIdsForMlCohort,
  getCustomerIdsForRuleCohort,
} from '@/lib/forecasting';
import DashboardHeader from '@/components/DashboardHeader';
import ForecastPanel from '@/components/ForecastPanel';
import CohortDetailClient from './CohortDetailClient';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CohortDetailPage({ params }: PageProps) {
  const { id } = await params;
  const { status, lastRunDate } = getPipelineStatus();

  // Route format: "ml-<slug>" or "rule-<numericId>"
  if (id.startsWith('ml-')) {
    const slug = id.slice(3);
    const mlCohorts = getMLCohorts();
    const cohort = mlCohorts.find(c => c.id === slug);
    if (!cohort) notFound();

    // Compute forecasts server-side from live data
    const pipelineRuns = getAllPipelineRuns();
    const pipelineRunCount = pipelineRuns.filter(r => r.status === 'success').length;
    const customerIds = getCustomerIdsForMlCohort(slug);
    const forecasts = computeForecasts(customerIds, cohort.memberCount, pipelineRunCount);

    return (
      <div className="min-h-full">
        <DashboardHeader
          title={cohort.name}
          subtitle="ML-identified cohort"
          lastRunDate={lastRunDate}
          pipelineStatus={status}
        />
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-2 text-sm">
            <Link href="/dashboard/cohorts" className="text-violet-600 hover:text-violet-800 font-medium">
              ← Back to Cohorts
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="text-3xl font-bold text-gray-900 mb-1">{cohort.memberCount.toLocaleString()}</div>
              <div className="text-sm text-gray-500">Members in this cohort</div>
            </div>
            <div className="sm:col-span-2 bg-violet-50 border border-violet-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-violet-500" />
                <span className="text-xs font-medium text-violet-700 uppercase tracking-wide">ML-Identified</span>
              </div>
              <p className="text-sm text-violet-900 font-medium">{cohort.summary}</p>
              <p className="text-xs text-violet-600 mt-1">
                Automatically discovered through k-means clustering of behavioral data. No analyst configuration required.
              </p>
            </div>
          </div>

          {/* Behavior Forecasts */}
          <ForecastPanel forecasts={forecasts} />

          {/* Behavioral signals */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Key Behavioral Signals</h2>
              <p className="text-xs text-gray-500 mt-0.5">Cluster centroid values — representative averages for this segment</p>
            </div>
            <div className="divide-y divide-gray-50">
              {cohort.topSignals.map(signal => (
                <div key={signal.label} className="px-5 py-3.5 flex items-center justify-between">
                  <span className="text-sm text-gray-600">{signal.label}</span>
                  <span className="text-sm font-semibold text-gray-900">{signal.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Data driving segment */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Data driving this segment</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p>• Quest progress records (completion percentage, last activity date)</p>
              <p>• Engagement signals (event type, event count over last 7 days)</p>
              <p>• Subscription tier level (0 = Free → 4 = All Access + Live)</p>
              <p>• Purchase history (cumulative spend across all products)</p>
            </div>
            <p className="text-xs text-gray-400 mt-3">
              Clustering runs server-side on each page load. Results are cached for 1 hour.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (id.startsWith('rule-')) {
    const numId = parseInt(id.slice(5), 10);
    if (isNaN(numId)) notFound();

    const cohort = getCohortById(numId);
    if (!cohort) notFound();

    const memberCount = evaluateCohortMemberCount(cohort.conditions);

    // Compute forecasts server-side from live data
    const pipelineRuns = getAllPipelineRuns();
    const pipelineRunCount = pipelineRuns.filter(r => r.status === 'success').length;
    const customerIds = getCustomerIdsForRuleCohort(cohort.conditions);
    const forecasts = computeForecasts(customerIds, memberCount, pipelineRunCount);

    return (
      <div className="min-h-full">
        <DashboardHeader
          title={cohort.name}
          subtitle="Analyst-defined rule-based cohort"
          lastRunDate={lastRunDate}
          pipelineStatus={status}
        />
        <CohortDetailClient cohort={{ ...cohort, memberCount }} forecasts={forecasts} />
      </div>
    );
  }

  notFound();
}
