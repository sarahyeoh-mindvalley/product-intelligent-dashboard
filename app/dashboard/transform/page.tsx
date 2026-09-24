import Link from 'next/link';
import { seedProductDataIfNeeded, getLatestMonth, getTransformData, getMonthlyTrend, fmtMonth } from '@/lib/product-data';
import { getPipelineStatus } from '@/lib/pipeline-status';
import DataFreshnessBanner from '@/components/DataFreshnessBanner';

export const dynamic = 'force-dynamic';

function fmt(n: number) { return n.toLocaleString(); }

export default function TransformPage() {
  seedProductDataIfNeeded();
  const { status, lastRunDate } = getPipelineStatus();
  const month = getLatestMonth();
  const d = getTransformData(month);
  const trend = getMonthlyTrend(month, 6);
  const hasData = d.total > 0;

  const { high, medium, low } = d.engagementTiers;
  const engagingTotal = high + medium + low;

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
              <span className="text-xs text-emerald-600 font-medium">Transform</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">Transform</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {hasData ? `${d.progressRate}% of subscribers made content progress — ${fmtMonth(month)}` : 'No data'}
            </p>
          </div>
          <DataFreshnessBanner lastRunDate={lastRunDate} status={status} />
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'With Progress', value: hasData ? fmt(d.hasProgress) : '—', detail: `${d.progressRate}% of active subscribers`, accent: 'text-emerald-700' },
            { label: 'No Progress', value: hasData ? fmt(d.notProgress) : '—', detail: 'Active but no content engagement', accent: 'text-gray-500' },
            { label: 'Avg Watch Time', value: hasData ? `${fmt(d.avgWatchMins)}m` : '—', detail: 'Per engaging subscriber', accent: 'text-emerald-700' },
            { label: 'Avg Tenure', value: hasData ? `${fmt(d.avgTenureDays)}d` : '—', detail: 'Days as subscriber', accent: 'text-emerald-700' },
          ].map(s => (
            <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className={`text-2xl font-bold ${s.accent} mb-0.5`}>{s.value}</div>
              <div className="text-sm font-medium text-gray-700">{s.label}</div>
              <div className="text-xs text-gray-400 mt-0.5">{s.detail}</div>
            </div>
          ))}
        </div>

        {/* Progress funnel */}
        {hasData && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Content Engagement Funnel</h2>
              <p className="text-xs text-gray-500 mt-0.5">Of {fmt(d.total)} active subscribers in {fmtMonth(month)}</p>
            </div>
            <div className="px-5 py-4 space-y-4">
              {[
                { label: 'Active subscribers', count: d.total, pct: 100, bar: 'bg-sky-300' },
                { label: 'Made content progress', count: d.hasProgress, pct: d.progressRate, bar: 'bg-emerald-500' },
                { label: 'No content progress', count: d.notProgress, pct: 100 - d.progressRate, bar: 'bg-gray-200' },
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

        {/* Engagement depth */}
        {hasData && engagingTotal > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Engagement Depth</h2>
              <p className="text-xs text-gray-500 mt-0.5">Watch time among {fmt(d.hasProgress)} progressing subscribers</p>
            </div>
            <div className="px-5 py-4 space-y-4">
              {[
                { label: 'High engagement', sub: '500+ watch minutes', count: high, pct: engagingTotal > 0 ? Math.round((high / engagingTotal) * 100) : 0, bar: 'bg-emerald-500' },
                { label: 'Medium engagement', sub: '100–499 watch minutes', count: medium, pct: engagingTotal > 0 ? Math.round((medium / engagingTotal) * 100) : 0, bar: 'bg-emerald-300' },
                { label: 'Low engagement', sub: 'Under 100 watch minutes', count: low, pct: engagingTotal > 0 ? Math.round((low / engagingTotal) * 100) : 0, bar: 'bg-gray-200' },
              ].map(row => (
                <div key={row.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div>
                      <span className="text-sm font-medium text-gray-700">{row.label}</span>
                      <span className="text-xs text-gray-400 ml-2">{row.sub}</span>
                    </div>
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

        {/* Content stats */}
        {hasData && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Content Consumption</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Avg content items viewed</span>
                  <span className="text-sm font-bold text-emerald-700">{fmt(d.avgContentViewed)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Avg watch minutes</span>
                  <span className="text-sm font-bold text-emerald-700">{fmt(d.avgWatchMins)} min</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Avg subscriber tenure</span>
                  <span className="text-sm font-bold text-gray-700">{fmt(d.avgTenureDays)} days</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Progress rate</span>
                  <span className={`text-sm font-bold ${d.progressRate >= 20 ? 'text-emerald-700' : 'text-red-500'}`}>{d.progressRate}%</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Subscriber Mix</h3>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-600">With progress</span>
                    <span className="text-sm font-bold text-emerald-700">{d.progressRate}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${d.progressRate}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-600">No progress</span>
                    <span className="text-sm font-bold text-gray-500">{100 - d.progressRate}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gray-300 rounded-full" style={{ width: `${100 - d.progressRate}%` }} />
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-4">
                {d.notProgress} subscribers logged in but made no content progress this month.
              </p>
            </div>
          </div>
        )}

        {/* Content Type Breakdown */}
        {hasData && d.hasProgress > 0 && (() => {
          const { quests, meditations, shorts, standalone } = d.contentTypes;
          const typeTotal = quests + meditations + shorts + standalone;
          const typePct = (n: number) => typeTotal > 0 ? Math.round((n / typeTotal) * 100) : 0;
          return (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Content Type Breakdown</h2>
                <p className="text-xs text-gray-500 mt-0.5">Total plays among active subscribers with progress</p>
              </div>
              <div className="px-5 py-4 space-y-4">
                {[
                  { label: 'Quests', count: quests, pct: typePct(quests), bar: 'bg-emerald-500' },
                  { label: 'Meditations', count: meditations, pct: typePct(meditations), bar: 'bg-violet-500' },
                  { label: 'Shorts', count: shorts, pct: typePct(shorts), bar: 'bg-amber-400' },
                  { label: 'Standalone Courses', count: standalone, pct: typePct(standalone), bar: 'bg-sky-400' },
                ].map(row => (
                  <div key={row.label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-gray-700">{row.label}</span>
                      <div className="text-sm">
                        <span className="font-bold text-gray-900">{row.count.toLocaleString()}</span>
                        <span className="text-gray-400 ml-1.5">({row.pct}%)</span>
                      </div>
                    </div>
                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full ${row.bar} rounded-full`} style={{ width: `${Math.max(row.pct, row.count > 0 ? 1 : 0)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* 6-month trend */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Progress Rate Trend</h2>
            <p className="text-xs text-gray-500 mt-0.5">Monthly content progress rate</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-5 py-3 font-medium">Month</th>
                  <th className="text-right px-5 py-3 font-medium">Active</th>
                  <th className="text-right px-5 py-3 font-medium">With Progress</th>
                  <th className="text-right px-5 py-3 font-medium">Progress Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {trend.map((row, i) => {
                  const isLatest = i === trend.length - 1;
                  const prevRate = i > 0 ? trend[i - 1].progressRate : null;
                  const delta = prevRate !== null ? row.progressRate - prevRate : null;
                  return (
                    <tr key={row.month} className={isLatest ? 'bg-gray-50' : 'hover:bg-gray-50'}>
                      <td className="px-5 py-3 font-medium text-gray-700">
                        {row.label}
                        {isLatest && <span className="ml-2 text-xs bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded">Latest</span>}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-600">{fmt(row.active)}</td>
                      <td className="px-5 py-3 text-right text-gray-600">{fmt(row.hasProgress)}</td>
                      <td className="px-5 py-3 text-right">
                        <span className={`font-bold ${row.progressRate >= 20 ? 'text-emerald-700' : row.progressRate >= 15 ? 'text-gray-700' : 'text-red-500'}`}>
                          {row.progressRate}%
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

        {/* Insight */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
          <h3 className="font-semibold text-emerald-900 mb-2">Product Insight</h3>
          <ul className="space-y-1.5 text-sm text-emerald-800">
            <li>• Progress rate has <strong>declined from ~26% to {trend[trend.length - 1]?.progressRate ?? '?'}%</strong> over the past 6 months — a leading indicator of churn.</li>
            <li>• <strong>{fmt(d.notProgress)} subscribers</strong> are active but not progressing. Re-engagement with personalized content recommendations is the highest leverage action.</li>
            <li>• Avg watch time of <strong>{fmt(d.avgWatchMins)} minutes</strong> among engaging users — those who engage, engage deeply.</li>
            <li>• <strong>Subscribers with high tenure ({fmt(d.avgTenureDays)} days avg)</strong> are still progressing — long-term retention is tied to consistent content engagement.</li>
          </ul>
        </div>

        <div className="flex justify-between items-center">
          <Link href="/dashboard/activation" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">← Activation</Link>
          <Link href="/dashboard/ai-adoption" className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors">Next: EVE Adoption →</Link>
        </div>
      </div>
    </div>
  );
}
