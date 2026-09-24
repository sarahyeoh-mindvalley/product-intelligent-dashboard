import { seedPurchaseMetricsIfNeeded, SNAPSHOT_DATE } from '@/lib/purchase-metrics';
import PurchaseCohortsClient from './PurchaseCohortsClient';

export const dynamic = 'force-dynamic';

export default function PurchaseCohortsPage() {
  seedPurchaseMetricsIfNeeded();

  return (
    <div className="min-h-full">
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-gray-400">Journey</span>
              <svg className="w-3 h-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
              <span className="text-xs text-violet-600 font-medium">Product North Star</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">Product North Star</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Weekly cohorts · last 52 weeks
            </p>
          </div>
          <div className="text-right shrink-0 pt-1 space-y-2">
            <div className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              <span className="text-xs text-emerald-700 font-medium">
                Data as of {new Date(SNAPSHOT_DATE + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-400">Questions about this dashboard?</p>
              <a href="mailto:sarah@mindvalley.com" className="text-xs text-violet-600 hover:text-violet-800 font-medium">
                sarah@mindvalley.com
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        <PurchaseCohortsClient />
      </div>
    </div>
  );
}
