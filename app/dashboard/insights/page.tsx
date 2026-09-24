import Link from 'next/link';
import {
  seedProductDataIfNeeded,
  getLatestMonth,
  getAcquisitionData,
  getActivationData,
  getTransformData,
  getEVEData,
  fmtMonth,
} from '@/lib/product-data';
import { getJourneyFunnel } from '@/lib/journey';
import { getPipelineStatus } from '@/lib/pipeline-status';
import { getAllReleases } from '@/lib/db';
import DataFreshnessBanner from '@/components/DataFreshnessBanner';

export const dynamic = 'force-dynamic';

function fmt(n: number) { return n.toLocaleString(); }

export default function InsightsPage() {
  const { status, lastRunDate } = getPipelineStatus();
  seedProductDataIfNeeded();
  const month = getLatestMonth();
  const funnel = getJourneyFunnel();
  const acq = getAcquisitionData(month);
  const act = getActivationData(month);
  const transform = getTransformData(month);
  const eve = getEVEData(month);

  const allReleases = getAllReleases();
  const plannedReleases = allReleases.filter((r) => r.status === 'planned');
  const pastReleases = allReleases.filter((r) => r.status === 'released');

  const STAGE_OPPORTUNITIES = [
    {
      stage: 'Acquisition',
      path: '/dashboard/acquisition',
      bgColor: 'bg-sky-50',
      borderColor: 'border-sky-200',
      textColor: 'text-sky-700',
      badgeColor: 'bg-sky-100 text-sky-700',
      count: acq.total,
      metric: `${acq.avgLTV ? '$' + fmt(acq.avgLTV) : '—'} avg LTV`,
      insight: `${acq.newSubs} new subscribers this month. Annual plan dominates at ${acq.paymentFreqs.find(f => f.name === 'annual')?.pct ?? 0}% — high commitment signal.`,
    },
    {
      stage: 'Activation',
      path: '/dashboard/activation',
      bgColor: 'bg-violet-50',
      borderColor: 'border-violet-200',
      textColor: 'text-violet-700',
      badgeColor: 'bg-violet-100 text-violet-700',
      count: act.loggedIn,
      metric: `${act.loginRate}% login rate`,
      insight: `${fmt(act.notLoggedIn)} active subscribers didn't log in this month. Login rate declining — was 44% in mid-2025.`,
    },
    {
      stage: 'Transform',
      path: '/dashboard/transform',
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-200',
      textColor: 'text-emerald-700',
      badgeColor: 'bg-emerald-100 text-emerald-700',
      count: transform.hasProgress,
      metric: `${transform.progressRate}% progress rate`,
      insight: `${fmt(transform.notProgress)} subscribers active but not engaging with content. Avg ${fmt(transform.avgWatchMins)} watch mins for those who do.`,
    },
    {
      stage: 'EVE Adoption',
      path: '/dashboard/ai-adoption',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      textColor: 'text-amber-700',
      badgeColor: 'bg-amber-100 text-amber-700',
      count: eve.eveUsers,
      metric: `${eve.eveRate}% adoption`,
      insight: `${fmt(eve.neverTriedEVE)} subscribers have never tried EVE. ${fmt(eve.lapsedEVE)} lapsed users are a quick win for re-engagement.`,
    },
  ];

  return (
    <div className="min-h-full">
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Product Insights</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Signals and opportunities across the journey — {fmtMonth(month)}
            </p>
          </div>
          <DataFreshnessBanner lastRunDate={lastRunDate} status={status} />
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Top Product Actions — first thing you see */}
        {funnel.hasData && (
          <div className="bg-violet-50 border border-violet-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-4 h-4 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
              <h3 className="font-semibold text-violet-900">Top Product Actions</h3>
            </div>
            <ul className="space-y-3">
              {[
                {
                  priority: '1',
                  urgency: 'bg-red-100 text-red-700',
                  tag: 'High impact',
                  text: <>Re-engagement campaign for <strong>{fmt(act.notLoggedIn)} inactive subscribers</strong> — login rate has declined from 44% to {act.loginRate}%.</>,
                  link: '/dashboard/activation',
                  linkLabel: 'View Activation →',
                },
                {
                  priority: '2',
                  urgency: 'bg-orange-100 text-orange-700',
                  tag: 'High impact',
                  text: <>Content discovery improvements for <strong>{fmt(transform.notProgress)} non-progressing</strong> active subscribers — personalized recommendations via EVE.</>,
                  link: '/dashboard/transform',
                  linkLabel: 'View Transform →',
                },
                {
                  priority: '3',
                  urgency: 'bg-amber-100 text-amber-700',
                  tag: 'Quick win',
                  text: <>EVE win-back for <strong>{fmt(eve.lapsedEVE)} lapsed users</strong> + first-time onboarding prompt for {fmt(eve.neverTriedEVE)} who never tried EVE.</>,
                  link: '/dashboard/ai-adoption',
                  linkLabel: 'View EVE →',
                },
                {
                  priority: '4',
                  urgency: 'bg-violet-100 text-violet-700',
                  tag: 'Strategic',
                  text: <>Streak / habit mechanic to drive weekly logins — target recovering to 40%+ login rate. Model the revenue impact in <Link href="/dashboard/forecast" className="underline underline-offset-2 hover:text-violet-900">Forecast</Link>.</>,
                  link: '/dashboard/forecast',
                  linkLabel: 'Open Forecast →',
                },
              ].map(item => (
                <li key={item.priority} className="flex gap-3 items-start bg-white rounded-lg p-3 border border-violet-100">
                  <span className="w-6 h-6 rounded-full bg-violet-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {item.priority}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${item.urgency}`}>{item.tag}</span>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">{item.text}</p>
                  </div>
                  <Link href={item.link} className="text-xs text-violet-600 hover:text-violet-800 font-medium flex-shrink-0 mt-1">
                    {item.linkLabel}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Journey health summary */}
        {funnel.hasData && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Journey Health — {fmtMonth(month)}</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Active Subscribers', value: fmt(funnel.active), color: 'text-sky-700' },
                { label: 'Login Rate', value: `${funnel.loginRate}%`, color: funnel.loginRate >= 40 ? 'text-emerald-600' : 'text-red-500' },
                { label: 'Progress Rate', value: `${funnel.progressRate}%`, color: funnel.progressRate >= 20 ? 'text-emerald-600' : 'text-red-500' },
                { label: 'EVE Adoption', value: `${funnel.eveRate}%`, color: 'text-amber-600' },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stage signals */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Stage Signals</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {STAGE_OPPORTUNITIES.map((s) => (
              <Link
                key={s.stage}
                href={s.path}
                className={`block rounded-xl border p-5 hover:shadow-md transition-all group ${s.bgColor} ${s.borderColor}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-semibold uppercase tracking-wide ${s.textColor}`}>{s.stage}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.badgeColor}`}>{s.metric}</span>
                </div>
                <div className={`text-2xl font-bold ${s.textColor} mb-2`}>{funnel.hasData ? fmt(s.count) : '—'}</div>
                <p className="text-xs text-gray-600 leading-relaxed">{s.insight}</p>
                <div className={`flex items-center gap-1 mt-3 text-xs font-medium ${s.textColor} opacity-0 group-hover:opacity-100 transition-opacity`}>
                  Deep dive
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Releases */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Planned Releases</h2>
              <Link href="/dashboard/releases" className="text-xs text-violet-600 hover:text-violet-800 font-medium">View all →</Link>
            </div>
            {plannedReleases.length === 0 ? (
              <div className="px-5 py-6 text-sm text-gray-400 text-center">No planned releases</div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {plannedReleases.slice(0, 3).map((r) => (
                  <li key={r.id}>
                    <Link href={`/dashboard/releases/${r.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors">
                      <span className="text-sm text-gray-800 truncate">{r.name}</span>
                      <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full ml-2 flex-shrink-0">Planned</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Recent Releases</h2>
              <Link href="/dashboard/releases" className="text-xs text-violet-600 hover:text-violet-800 font-medium">View all →</Link>
            </div>
            {pastReleases.length === 0 ? (
              <div className="px-5 py-6 text-sm text-gray-400 text-center">No past releases</div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {pastReleases.slice(0, 3).map((r) => {
                  const daysAgo = Math.round(
                    (Date.now() - new Date(r.release_date + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24)
                  );
                  return (
                    <li key={r.id}>
                      <Link href={`/dashboard/releases/${r.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors">
                        <span className="text-sm text-gray-800 truncate">{r.name}</span>
                        <span className="text-xs text-gray-400 ml-2 flex-shrink-0">{daysAgo}d ago</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
