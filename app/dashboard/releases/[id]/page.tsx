import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getReleaseById } from '@/lib/db';
import { getReleaseDetail, computePlannedReleaseForecast } from '@/lib/releases';
import { getPipelineStatus } from '@/lib/pipeline-status';
import DashboardHeader from '@/components/DashboardHeader';
import ReleaseDetailClient from './ReleaseDetailClient';

export const dynamic = 'force-dynamic';

export default async function ReleaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const releaseId = parseInt(id, 10);
  if (isNaN(releaseId)) notFound();

  const release = getReleaseById(releaseId);
  if (!release) notFound();

  const { status, lastRunDate } = getPipelineStatus();
  const detail = getReleaseDetail(release);

  let forecast = null;
  if (release.status === 'planned') {
    forecast = computePlannedReleaseForecast(releaseId);
  }

  return (
    <div className="min-h-full">
      <DashboardHeader
        title={release.name}
        subtitle={release.status === 'released' ? 'Before/after KPI attribution' : 'Forecasted cohort impact'}
        lastRunDate={lastRunDate}
        pipelineStatus={status}
      />
      <div className="p-6">
        <div className="mb-5">
          <Link
            href="/dashboard/releases"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-violet-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back to Releases
          </Link>
        </div>
        <ReleaseDetailClient release={release} detail={detail} forecast={forecast} />
      </div>
    </div>
  );
}
