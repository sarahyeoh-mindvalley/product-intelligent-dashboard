import Link from 'next/link';
import { seedProductDataIfNeeded, getLatestMonth, getActivationData, getMonthlyTrend, fmtMonth } from '@/lib/product-data';
import { getPipelineStatus } from '@/lib/pipeline-status';
import DataFreshnessBanner from '@/components/DataFreshnessBanner';

export const dynamic = 'force-dynamic';

function fmt(n: number) { return n.toLocaleString(); }

export default function ActivationPage() {
  seedProductDataIfNeeded();
  const { status, lastRunDate } = getPipelineStatus();
  const month = getLatestMonth();
  const d = getActivationData(month);
  const trend = getMonthlyTrend(month, 6);
  const hasData = d.total > 0;

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
              <span className="text-xs text-violet-600 font-medium">Activation</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">Activation</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {hasData ? `${d.loginRate}% of subscribers logged in — ${fmtMonth(month)}` : 'No data'}
            </p>
          </div>
          <DataFreshnessBanner lastRunDate={lastRunDate} status={status} />
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { label: 'Logged In', value: hasData ? fmt(d.loggedIn) : '—', detail: `${d.loginRate}% login rate`, accent: 'text-violet-700' },
            { label: 'Not Logged In', value: hasData ? fmt(d.notLoggedIn) : '—', detail: 'Inactive this month', accent: 'text-gray-500' },
            { label: 'New Sub Activation', value: hasData && d.newSubs > 0 ? `${d.activation15dRate}%` : '—', detail: 'Content progress within 15d of join', accent: 'text-violet-700' },
          ].map(s => (
            <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className={`text-2xl font-bold ${s.accent} mb-0.5`}>{s.value}</div>
              <div className="text-sm font-medium text-gray-700">{s.label}</div>
              <div className="text-xs text-gray-400 mt-0.5">{s.detail}</div>
            </div>
          ))}
        </div>

        {/* Active vs inactive funnel */}
        {hasData && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Monthly Login Funnel</h2>
              <p className="text-xs text-gray-500 mt-0.5">Of {fmt(d.total)} active subscribers in {fmtMonth(month)}</p>
            </div>
            <div className="px-5 py-4 space-y-4">
              {[
                { label: 'Active subscribers', count: d.total, pct: 100, bar: 'bg-sky-300' },
                { label: 'Logged in this month', count: d.loggedIn, pct: d.loginRate, bar: 'bg-violet-500' },
                { label: 'Did not log in', count: d.notLoggedIn, pct: 100 - d.loginRate, bar: 'bg-gray-200' },
              ].map(row => (
                <div key={row.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-gray-700">{row.label}</span>
                    <div className="text-sm">
                      <span className="font-bold text-gray-900">{fmt(row.count)}</span>
                      <span className="text-gray-400 ml-1.5">({row.pct}%)</span>
                    </div>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${row.bar} rounded-full`} style={{ width: `${row.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Login by tier */}
          {hasData && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Login Rate by Tier</h2>
                <p className="text-xs text-gray-500 mt-0.5">Which tiers are most active?</p>
              </div>
              <div className="px-5 py-4 space-y-3">
                {d.tierLogin.filter(t => t.tier !== 'Not Available').map(t => (
                  <div key={t.tier}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700 capitalize">{t.tier}</span>
                      <span className="text-sm">
                        <span className="font-bold text-violet-700">{t.rate}%</span>
                        <span className="text-gray-400 ml-1">({fmt(t.loggedIn)} / {fmt(t.total)})</span>
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-violet-400 rounded-full" style={{ width: `${t.rate}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* 6-month login trend */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Login Rate Trend</h2>
            <p className="text-xs text-gray-500 mt-0.5">Monthly login rate — note the declining trend</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-5 py-3 font-medium">Month</th>
                  <th className="text-right px-5 py-3 font-medium">Active</th>
                  <th className="text-right px-5 py-3 font-medium">Logged In</th>
                  <th className="text-right px-5 py-3 font-medium">Login Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {trend.map((row, i) => {
                  const isLatest = i === trend.length - 1;
                  const prevRate = i > 0 ? trend[i - 1].loginRate : null;
                  const delta = prevRate !== null ? row.loginRate - prevRate : null;
                  return (
                    <tr key={row.month} className={isLatest ? 'bg-gray-50' : 'hover:bg-gray-50'}>
                      <td className="px-5 py-3 font-medium text-gray-700">
                        {row.label}
                        {isLatest && <span className="ml-2 text-xs bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded">Latest</span>}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-600">{fmt(row.active)}</td>
                      <td className="px-5 py-3 text-right text-gray-600">{fmt(row.loggedIn)}</td>
                      <td className="px-5 py-3 text-right">
                        <span className={`font-bold ${row.loginRate >= 40 ? 'text-violet-700' : row.loginRate >= 30 ? 'text-gray-700' : 'text-red-500'}`}>
                          {row.loginRate}%
                        </span>
                        {delta !== null && (
                          <span className={`ml-2 text-xs ${delta >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {delta >= 0 ? '+' : ''}{delta}pp
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Purchase cohort deep-dive */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Purchase Cohort Metrics</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Day 0/7 login & Day 15/30 activation rates — weekly view with filters for price, discount, traffic source &amp; more
            </p>
          </div>
          <Link
            href="/dashboard/activation/purchase-cohorts"
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors"
          >
            View cohorts →
          </Link>
        </div>

        {/* Insight */}
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-5">
          <h3 className="font-semibold text-violet-900 mb-2">Product Insight</h3>
          <ul className="space-y-1.5 text-sm text-violet-800">
            <li>• Login rate has <strong>declined from ~44% to {trend[trend.length - 1]?.loginRate ?? '?'}%</strong> over the past 6 months. This is a leading indicator of churn risk.</li>
            <li>• <strong>{fmt(d.notLoggedIn)} subscribers</strong> didn't log in this month — re-engagement campaigns should target this cohort first.</li>
            <li>• Consider adding a <strong>streak or habit mechanic</strong> to increase weekly login frequency.</li>
            <li>• New subscriber onboarding: getting them to log in and progress <strong>within 15 days</strong> is the critical activation window.</li>
          </ul>
        </div>

        <div className="flex justify-between items-center">
          <Link href="/dashboard/acquisition" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">← Acquisition</Link>
          <Link href="/dashboard/transform" className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors">Next: Transform →</Link>
        </div>
      </div>
    </div>
  );
}
