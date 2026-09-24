import Link from 'next/link';
import { seedProductDataIfNeeded, getLatestMonth, getEVEData, fmtMonth } from '@/lib/product-data';
import { getPipelineStatus } from '@/lib/pipeline-status';
import DataFreshnessBanner from '@/components/DataFreshnessBanner';

export const dynamic = 'force-dynamic';

function fmt(n: number) { return n.toLocaleString(); }

export default function AIAdoptionPage() {
  seedProductDataIfNeeded();
  const { status, lastRunDate } = getPipelineStatus();
  const month = getLatestMonth();
  const d = getEVEData(month);
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
              <span className="text-xs text-amber-600 font-medium">EVE Adoption</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">EVE Adoption</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {hasData ? `${d.eveRate}% of subscribers used EVE this month — ${fmtMonth(month)}` : 'No data'}
            </p>
          </div>
          <DataFreshnessBanner lastRunDate={lastRunDate} status={status} />
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'EVE Users', value: hasData ? fmt(d.eveUsers) : '—', detail: `${d.eveRate}% of active subscribers`, accent: 'text-amber-700' },
            { label: 'Never Tried EVE', value: hasData ? fmt(d.neverTriedEVE) : '—', detail: 'Untapped opportunity', accent: 'text-gray-500' },
            { label: 'Repeat Users', value: hasData && d.eveUsers > 0 ? fmt(d.repeatUsers) : '—', detail: `${d.repeatRate}% of EVE users`, accent: 'text-amber-700' },
            { label: 'Avg Active Days', value: hasData && d.eveUsers > 0 ? `${d.avgActiveDays}d` : '—', detail: 'Per EVE user per month', accent: 'text-amber-700' },
          ].map(s => (
            <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className={`text-2xl font-bold ${s.accent} mb-0.5`}>{s.value}</div>
              <div className="text-sm font-medium text-gray-700">{s.label}</div>
              <div className="text-xs text-gray-400 mt-0.5">{s.detail}</div>
            </div>
          ))}
        </div>

        {/* Adoption funnel */}
        {hasData && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">EVE Adoption Funnel</h2>
              <p className="text-xs text-gray-500 mt-0.5">Of {fmt(d.total)} active subscribers in {fmtMonth(month)}</p>
            </div>
            <div className="px-5 py-4 space-y-4">
              {[
                { label: 'Active subscribers', count: d.total, pct: 100, bar: 'bg-sky-300' },
                { label: 'Ever tried EVE', count: d.everAdopted, pct: d.total > 0 ? Math.round((d.everAdopted / d.total) * 100) : 0, bar: 'bg-amber-300' },
                { label: 'Used EVE this month', count: d.eveUsers, pct: d.eveRate, bar: 'bg-amber-500' },
                { label: 'Repeat EVE users', count: d.repeatUsers, pct: d.total > 0 ? Math.round((d.repeatUsers / d.total) * 100) : 0, bar: 'bg-amber-600' },
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

        {/* Retention breakdown */}
        {hasData && d.eveUsers > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">EVE User Retention</h2>
                <p className="text-xs text-gray-500 mt-0.5">Of {fmt(d.everAdopted)} who ever tried EVE</p>
              </div>
              <div className="px-5 py-4 space-y-3">
                {[
                  { label: 'Active this month', count: d.eveUsers, pct: d.everAdopted > 0 ? Math.round((d.eveUsers / d.everAdopted) * 100) : 0, bar: 'bg-amber-500' },
                  { label: 'Lapsed (tried but inactive)', count: d.lapsedEVE, pct: d.everAdopted > 0 ? Math.round((d.lapsedEVE / d.everAdopted) * 100) : 0, bar: 'bg-gray-300' },
                ].map(row => (
                  <div key={row.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">{row.label}</span>
                      <span className="text-sm">
                        <span className="font-bold text-amber-700">{fmt(row.count)}</span>
                        <span className="text-gray-400 ml-1">({row.pct}%)</span>
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full ${row.bar} rounded-full`} style={{ width: `${row.pct}%` }} />
                    </div>
                  </div>
                ))}
                <p className="text-xs text-gray-400 mt-2">
                  {d.lapsedEVE} subscribers tried EVE but haven't used it this month — win-back opportunity.
                </p>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">EVE Engagement Quality</h2>
                <p className="text-xs text-gray-500 mt-0.5">Among {fmt(d.eveUsers)} active EVE users</p>
              </div>
              <div className="px-5 py-4 space-y-4">
                <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                  <span className="text-sm text-gray-700">Avg active days / month</span>
                  <span className="text-lg font-bold text-amber-700">{d.avgActiveDays}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                  <span className="text-sm text-gray-700">Repeat users</span>
                  <span className="text-lg font-bold text-amber-700">{fmt(d.repeatUsers)} ({d.repeatRate}%)</span>
                </div>
                <p className="text-xs text-gray-400">
                  {d.repeatRate >= 50
                    ? 'Strong repeat usage signal — users who try EVE are coming back.'
                    : 'Room to improve EVE stickiness — only ' + d.repeatRate + '% of EVE users return repeatedly.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* EVE Quality */}
        {hasData && d.eveUsers > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">EVE Quality</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Transformations = floor(EVE prompts / 6) — a quality metric for deep engagement
              </p>
            </div>
            <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-amber-50 rounded-xl">
                <div className="text-2xl font-bold text-amber-700">{d.eveTransformations.toLocaleString()}</div>
                <div className="text-sm font-medium text-gray-700 mt-0.5">Total EVE Chat Transformations</div>
                <div className="text-xs text-gray-400 mt-1">floor(EVE prompts / 6) across all active users</div>
              </div>
              <div className="p-4 bg-amber-50 rounded-xl">
                <div className="text-2xl font-bold text-amber-700">{d.learningAssist.toLocaleString()}</div>
                <div className="text-sm font-medium text-gray-700 mt-0.5">Learning Assistance Transformations</div>
                <div className="text-xs text-gray-400 mt-1">Quality learning-assist interactions (cumulative)</div>
              </div>
              <div className="p-4 bg-amber-50 rounded-xl">
                <div className="text-2xl font-bold text-amber-700">{d.avgTransformations}</div>
                <div className="text-sm font-medium text-gray-700 mt-0.5">Avg Transformations / EVE User</div>
                <div className="text-xs text-gray-400 mt-1">Mean EVE chat transformations per EVE user</div>
              </div>
            </div>
          </div>
        )}

        {/* 10-month EVE trend */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">EVE Adoption Trend</h2>
            <p className="text-xs text-gray-500 mt-0.5">Monthly EVE usage since launch (Aug 2025)</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-5 py-3 font-medium">Month</th>
                  <th className="text-right px-5 py-3 font-medium">EVE Users</th>
                  <th className="text-right px-5 py-3 font-medium">Adoption Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {d.trend.map((row, i) => {
                  const isLatest = i === d.trend.length - 1;
                  const prev = i > 0 ? d.trend[i - 1].users : null;
                  const delta = prev !== null ? row.users - prev : null;
                  return (
                    <tr key={row.month} className={isLatest ? 'bg-gray-50' : 'hover:bg-gray-50'}>
                      <td className="px-5 py-3 font-medium text-gray-700">
                        {row.label}
                        {isLatest && <span className="ml-2 text-xs bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded">Latest</span>}
                        {row.month === '2025-08-01' && <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Launch</span>}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="font-bold text-amber-700">{fmt(row.users)}</span>
                        {delta !== null && delta !== 0 && (
                          <span className={`ml-2 text-xs ${delta > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {delta > 0 ? '+' : ''}{fmt(delta)}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className={`font-bold ${row.rate >= 5 ? 'text-amber-600' : row.rate > 0 ? 'text-gray-600' : 'text-gray-400'}`}>
                          {row.rate > 0 ? `${row.rate}%` : '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Insight */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <h3 className="font-semibold text-amber-900 mb-2">Product Insight</h3>
          <ul className="space-y-1.5 text-sm text-amber-800">
            <li>• EVE launched in Aug 2025. Adoption has grown to <strong>{d.eveRate}% ({fmt(d.eveUsers)} users)</strong> in {fmtMonth(month)} — highest ever.</li>
            <li>• <strong>{fmt(d.neverTriedEVE)} subscribers</strong> have never tried EVE. The biggest lever is discoverability and in-product prompts.</li>
            <li>• <strong>{fmt(d.lapsedEVE)} subscribers</strong> tried EVE but lapsed — re-engagement campaigns for this cohort can recover adoption quickly.</li>
            <li>• EVE users average <strong>{d.avgActiveDays} active days/month</strong> — those who adopt tend to use it regularly.</li>
          </ul>
        </div>

        <div className="flex justify-between items-center">
          <Link href="/dashboard/transform" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">← Transform</Link>
          <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">Back to Overview →</Link>
        </div>
      </div>
    </div>
  );
}
