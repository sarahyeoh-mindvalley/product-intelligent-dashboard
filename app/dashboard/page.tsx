import Link from 'next/link';
import { getJourneyFunnel } from '@/lib/journey';
import DataFreshnessBanner from '@/components/DataFreshnessBanner';
import { getPipelineStatus } from '@/lib/pipeline-status';
import {
  seedProductDataIfNeeded,
  getLatestMonth,
  getMRRStats,
  fmtMonth,
} from '@/lib/product-data';

export const dynamic = 'force-dynamic';

function fmt(n: number) {
  return n.toLocaleString();
}

const MEMBER_GROWTH = [
  { month: 'Dec 25', net: -4670 },
  { month: 'Jan 26', net: -1890 },
  { month: 'Feb 26', net: -4446 },
  { month: 'Mar 26', net: -4008 },
  { month: 'Apr 26', net: -5392 },
  { month: 'May 26', net: -7546 },
  { month: 'Jun 26', net: -11164 },
  { month: 'Jul 26', net: -9432 },
];
const PEAK_MEMBERS = 272392; // Nov 2024 peak
const CURRENT_MEMBERS = 203019; // Aug 2026

const MAX_BAR = 12000;

const STAGES = [
  {
    key: 'acquisition',
    label: 'Acquisition',
    path: '/dashboard/acquisition',
    description: 'Active subscribers',
    bgCard: 'bg-sky-50',
    border: 'border-sky-200',
    numColor: 'text-sky-700',
    badgeBg: 'bg-sky-100',
    badgeText: 'text-sky-700',
    iconColor: 'text-sky-500',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
  },
  {
    key: 'activation',
    label: 'Activation',
    path: '/dashboard/activation',
    description: 'Logged in this month',
    bgCard: 'bg-violet-50',
    border: 'border-violet-200',
    numColor: 'text-violet-700',
    badgeBg: 'bg-violet-100',
    badgeText: 'text-violet-700',
    iconColor: 'text-violet-500',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
  },
  {
    key: 'transform',
    label: 'Transform',
    path: '/dashboard/transform',
    description: 'Consumed 4+ content this month',
    bgCard: 'bg-emerald-50',
    border: 'border-emerald-200',
    numColor: 'text-emerald-700',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-700',
    iconColor: 'text-emerald-500',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
      </svg>
    ),
  },
  {
    key: 'ai-adoption',
    label: 'EVE Adoption',
    path: '/dashboard/ai-adoption',
    description: 'Used EVE this month',
    bgCard: 'bg-amber-50',
    border: 'border-amber-200',
    numColor: 'text-amber-700',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-700',
    iconColor: 'text-amber-500',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
      </svg>
    ),
  },
] as const;

export default function DashboardPage() {
  seedProductDataIfNeeded();
  const { status, lastRunDate } = getPipelineStatus();
  const f = getJourneyFunnel();
  const month = getLatestMonth();
  const mrr = getMRRStats(month);

  const stageCounts = [f.active, f.loggedIn, f.hasProgress, f.eveUsers];
  const stageRates = [null, f.loginRate, f.progressRate, f.eveRate];

  const membersLost = PEAK_MEMBERS - CURRENT_MEMBERS;
  const inactiveArrM = (mrr.inactiveArr / 1_000_000).toFixed(1);

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Customer Journey</h1>
            <p className="text-sm text-gray-500 mt-1">
              Snapshot: <span className="font-medium text-gray-700">{fmtMonth(month)}</span>
            </p>
          </div>
          <DataFreshnessBanner lastRunDate={lastRunDate} status={status} />
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* ARR */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Annual Run Rate</div>
            <div className="text-2xl font-bold text-gray-900">${(mrr.arr / 1_000_000).toFixed(2)}M</div>
            <div className="text-xs text-gray-400 mt-1">from active subscribers</div>
          </div>

          {/* MRR */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Monthly Run Rate</div>
            <div className="text-2xl font-bold text-gray-900">${(mrr.mrr / 1_000).toFixed(0)}K</div>
            <div className="text-xs text-gray-400 mt-1">avg ${mrr.avgMonthlySpend}/member/mo</div>
          </div>

          {/* Members lost from peak */}
          <div className="bg-red-50 border border-red-200 rounded-xl p-5">
            <div className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-1">Lost Since Peak (Nov &apos;24)</div>
            <div className="text-2xl font-bold text-red-700">{fmt(membersLost)}</div>
            <div className="text-xs text-red-400 mt-1">down from 272K</div>
          </div>

          {/* ARR at risk */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
            <div className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1">Inactive Member ARR at Risk</div>
            <div className="text-2xl font-bold text-amber-700">${(mrr.inactiveArr / 1_000_000).toFixed(1)}M</div>
            <div className="text-xs text-amber-500 mt-1">55% annual churn est.</div>
          </div>
        </div>

        {/* Member Growth Waterfall */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Member Growth Trend</h2>
            <p className="text-xs text-gray-500 mt-0.5">Net member change per month — from BigQuery</p>
          </div>
          <div className="px-5 py-3 space-y-1.5">
            {MEMBER_GROWTH.map((row) => {
              const isNeg = row.net < 0;
              const barW = Math.min(Math.round((Math.abs(row.net) / MAX_BAR) * 100), 100);
              return (
                <div key={row.month} className="flex items-center gap-3 text-sm">
                  <span className="w-12 text-xs text-gray-500 font-medium flex-shrink-0">{row.month}</span>
                  <span className={`w-20 text-right font-semibold text-xs flex-shrink-0 ${isNeg ? 'text-red-600' : 'text-emerald-600'}`}>
                    {isNeg ? '' : '+'}{fmt(row.net)}
                  </span>
                  <div className="flex-1 flex items-center h-4">
                    <div
                      className={`h-3 rounded-sm ${isNeg ? 'bg-red-400' : 'bg-emerald-400'}`}
                      style={{ width: `${barW}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Journey Funnel cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {STAGES.map((stage, i) => {
            const count = stageCounts[i];
            const rate = stageRates[i];
            return (
              <Link
                key={stage.key}
                href={stage.path}
                className={`relative rounded-xl border p-5 hover:shadow-md transition-all group ${stage.bgCard} ${stage.border}`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className={stage.iconColor}>{stage.icon}</span>
                  <span className={`text-xs font-semibold uppercase tracking-wide ${stage.badgeText}`}>
                    {stage.label}
                  </span>
                </div>
                <div className={`text-3xl font-bold ${stage.numColor} mb-1`}>{fmt(count)}</div>
                <div className="text-xs text-gray-500">{stage.description}</div>
                {rate !== null && (
                  <div className={`mt-3 inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${stage.badgeBg} ${stage.badgeText}`}>
                    {rate}% of active
                  </div>
                )}
                <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg className={`w-4 h-4 ${stage.iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Executive Summary / Decision Required */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <h2 className="font-bold text-amber-900 text-base">3 Decisions for This Week</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Decision 1 */}
            <div className="bg-white rounded-lg border border-amber-200 p-4">
              <div className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2">Re-engagement Campaign</div>
              <p className="text-sm text-gray-700">
                97K inactive subscribers haven&apos;t logged in. At 55% annual churn, that&apos;s ~${inactiveArrM}M ARR at risk. Should we run a re-engagement email sequence?
              </p>
            </div>

            {/* Decision 2 */}
            <div className="bg-white rounded-lg border border-amber-200 p-4">
              <div className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2">Annual Renewal Cliff</div>
              <p className="text-sm text-gray-700">
                63% of annual subscribers don&apos;t renew at Month 12 (36% retention vs 87% in-year). A 5pp improvement = ~$2M ARR recovered. Approve a renewal intervention program?
              </p>
            </div>

            {/* Decision 3 */}
            <div className="bg-white rounded-lg border border-amber-200 p-4">
              <div className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2">Monthly &rarr; Annual Upgrade</div>
              <p className="text-sm text-gray-700">
                Monthly subscribers churn 10&times; faster than annual (9.3% vs 36% at Month 12). Converting 5% of monthly base to annual would materially improve LTV. Approve an upgrade campaign?
              </p>
            </div>
          </div>
          <div className="mt-4">
            <Link href="/dashboard/retention" className="inline-flex items-center gap-1 text-sm font-semibold text-amber-700 hover:text-amber-900">
              View Retention Curves &rarr;
            </Link>
          </div>
        </div>

        {/* 6-month trend */}
        {f.trend.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">6-Month Trend</h2>
              <p className="text-xs text-gray-500 mt-0.5">Monthly snapshot across all journey stages</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                    <th className="text-left px-5 py-3 font-medium">Month</th>
                    <th className="text-right px-4 py-3 font-medium text-sky-600">Active</th>
                    <th className="text-right px-4 py-3 font-medium text-violet-600">Login %</th>
                    <th className="text-right px-4 py-3 font-medium text-emerald-600">Progress %</th>
                    <th className="text-right px-4 py-3 font-medium text-amber-600">EVE %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {f.trend.map((row, i) => {
                    const isLatest = i === f.trend.length - 1;
                    return (
                      <tr key={row.month} className={`${isLatest ? 'bg-gray-50' : 'hover:bg-gray-50'} transition-colors`}>
                        <td className="px-5 py-3 font-medium text-gray-700">
                          {row.label}
                          {isLatest && <span className="ml-2 text-xs bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded">Latest</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-sky-700">{fmt(row.active)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-medium ${row.loginRate >= 40 ? 'text-violet-700' : row.loginRate >= 30 ? 'text-gray-700' : 'text-red-500'}`}>
                            {row.loginRate}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-medium ${row.progressRate >= 20 ? 'text-emerald-700' : 'text-gray-500'}`}>
                            {row.progressRate}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-medium ${row.eveRate >= 5 ? 'text-amber-600' : row.eveRate > 0 ? 'text-gray-600' : 'text-gray-400'}`}>
                            {row.eveRate > 0 ? `${row.eveRate}%` : '—'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Key signals */}
        {f.hasData && (
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Key Signals</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Login gap */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-violet-500" />
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Activation Gap</span>
                </div>
                <p className="text-sm text-gray-700">
                  <span className="font-bold text-gray-900">{fmt(f.active - f.loggedIn)}</span> active subscribers didn&apos;t log in this month
                </p>
                <p className="text-xs text-gray-400 mt-1.5">Login rate has been declining — was 44% in mid-2025</p>
                <Link href="/dashboard/activation" className="inline-flex items-center gap-1 mt-3 text-xs text-violet-600 font-medium hover:text-violet-800">
                  View activation &rarr;
                </Link>
              </div>

              {/* Progress gap */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Transform Gap</span>
                </div>
                <p className="text-sm text-gray-700">
                  <span className="font-bold text-gray-900">{fmt(f.loggedIn - f.hasProgress)}</span> members logged in but didn&apos;t engage with content
                </p>
                <p className="text-xs text-gray-400 mt-1.5">Content progress rate dropped from 26% (mid-2025) to {f.progressRate}%</p>
                <Link href="/dashboard/transform" className="inline-flex items-center gap-1 mt-3 text-xs text-emerald-600 font-medium hover:text-emerald-800">
                  View transform &rarr;
                </Link>
              </div>

              {/* EVE opportunity */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">EVE Opportunity</span>
                </div>
                <p className="text-sm text-gray-700">
                  Only <span className="font-bold text-gray-900">{f.eveRate}%</span> of subscribers used EVE this month
                </p>
                <p className="text-xs text-gray-400 mt-1.5">EVE launched Aug 2025. April 2026 is the highest adoption yet at {f.eveRate}%</p>
                <Link href="/dashboard/ai-adoption" className="inline-flex items-center gap-1 mt-3 text-xs text-amber-600 font-medium hover:text-amber-800">
                  View EVE adoption &rarr;
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
