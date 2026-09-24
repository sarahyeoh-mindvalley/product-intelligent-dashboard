import Link from 'next/link';
import {
  seedProductDataIfNeeded,
  getLatestMonth,
  getMonthlySnapshot,
  getActivationData,
  getSegmentBreakdown,
  getRetentionFactorRates,
  fmtMonth,
} from '@/lib/product-data';
import { getPipelineStatus } from '@/lib/pipeline-status';
import DataFreshnessBanner from '@/components/DataFreshnessBanner';
import ForecastSimulator, { type ForecastBaseMetrics } from '@/components/ForecastSimulator';

export const dynamic = 'force-dynamic';

export default function ForecastPage() {
  seedProductDataIfNeeded();
  const { status, lastRunDate } = getPipelineStatus();
  const month = getLatestMonth();

  const snap = getMonthlySnapshot(month);
  const act = getActivationData(month);
  const segments = getSegmentBreakdown(month);
  const retention = getRetentionFactorRates(month);

  const base: ForecastBaseMetrics = {
    active: snap.active,
    loggedIn: snap.loggedIn,
    loginRate: snap.loginRate,
    hasProgress: snap.hasProgress,
    progressRate: snap.progressRate,
    newSubs: act.newSubs,
    activation15dRate: act.activation15dRate,
    eveRepeatRate: retention.eveRepeatRate,
    habitRate: retention.habitRate,
    deepWatchRate: retention.deepWatchRate,
    monthLabel: fmtMonth(month),
  };

  return (
    <div className="min-h-full">
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/dashboard" className="text-xs text-gray-400 hover:text-gray-600">Journey</Link>
              <svg className="w-3 h-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
              <span className="text-xs text-violet-600 font-medium">Forecast</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">What-If Forecast</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Model the revenue impact of improving each journey stage — {fmtMonth(month)}
            </p>
          </div>
          <DataFreshnessBanner lastRunDate={lastRunDate} status={status} />
        </div>
      </div>

      <div className="p-6">
        <ForecastSimulator base={base} segments={segments} />
      </div>
    </div>
  );
}
