import Link from 'next/link';
import { seedProductDataIfNeeded, getLatestMonth, getAcquisitionData, getMonthlyTrend, fmtMonth } from '@/lib/product-data';
import { getPipelineStatus } from '@/lib/pipeline-status';
import DataFreshnessBanner from '@/components/DataFreshnessBanner';

export const dynamic = 'force-dynamic';

function fmt(n: number) { return n.toLocaleString(); }
function fmtCurrency(n: number) { return `$${n.toLocaleString()}`; }

export default function AcquisitionPage() {
  seedProductDataIfNeeded();
  const { status, lastRunDate } = getPipelineStatus();
  const month = getLatestMonth();
  const d = getAcquisitionData(month);
  const trend = getMonthlyTrend(month, 6);
  const hasData = d.total > 0;

  const paidTypes = d.acqTypes.filter(t => t.name === 'Paid').reduce((sum, t) => sum + t.count, 0);
  const organicTypes = d.acqTypes.filter(t => t.name === 'Organic' || t.name === 'Owned').reduce((sum, t) => sum + t.count, 0);
  const paidPct = d.total > 0 ? Math.round((paidTypes / d.total) * 100) : 0;

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
              <span className="text-xs text-sky-600 font-medium">Acquisition</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">Acquisition</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {hasData ? fmtMonth(month) : 'No data'} · {hasData ? fmt(d.total) : '—'} active subscribers
            </p>
          </div>
          <DataFreshnessBanner lastRunDate={lastRunDate} status={status} />
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Active Subscribers', value: hasData ? fmt(d.total) : '—', detail: fmtMonth(month), accent: 'text-sky-700' },
            { label: 'Avg Lifetime Value', value: hasData ? fmtCurrency(d.avgLTV) : '—', detail: 'Per active subscriber', accent: 'text-sky-700' },
            { label: 'Paid Acquisition', value: hasData ? `${paidPct}%` : '—', detail: `${fmt(paidTypes)} paid-channel members`, accent: 'text-sky-700' },
            { label: 'Annual Subscribers', value: hasData ? `${d.paymentFreqs.find(f => f.name === 'annual')?.pct ?? 0}%` : '—', detail: 'Pay annually', accent: 'text-sky-700' },
          ].map(s => (
            <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className={`text-2xl font-bold ${s.accent} mb-0.5`}>{s.value}</div>
              <div className="text-sm font-medium text-gray-700">{s.label}</div>
              <div className="text-xs text-gray-400 mt-0.5">{s.detail}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Acquisition channels */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Acquisition Channels</h2>
              <p className="text-xs text-gray-500 mt-0.5">How members found Mindvalley</p>
            </div>
            <div className="px-5 py-4 space-y-3">
              {hasData ? d.channels.map(ch => (
                <div key={ch.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-700">{ch.name}</span>
                    <span className="text-sm">
                      <span className="font-bold text-gray-900">{fmt(ch.count)}</span>
                      <span className="text-gray-400 ml-1">({ch.pct}%)</span>
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-sky-500 rounded-full" style={{ width: `${ch.pct}%` }} />
                  </div>
                </div>
              )) : <p className="text-sm text-gray-400 py-4 text-center">No data available</p>}
            </div>
          </div>

          {/* Tier + Payment */}
          <div className="space-y-4">
            {/* Tier distribution */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Subscription Tiers</h2>
                <p className="text-xs text-gray-500 mt-0.5">Active members by tier</p>
              </div>
              <div className="px-5 py-4 space-y-2.5">
                {hasData ? d.tiers.filter(t => t.name !== 'Not Available').map(t => (
                  <div key={t.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700 capitalize">{t.name}</span>
                      <span className="text-sm"><span className="font-bold text-gray-900">{fmt(t.count)}</span><span className="text-gray-400 ml-1">({t.pct}%)</span></span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-sky-400 rounded-full" style={{ width: `${t.pct}%`, opacity: 0.5 + t.pct / 100 }} />
                    </div>
                  </div>
                )) : null}
              </div>
            </div>

            {/* Payment frequency */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Payment Frequency</h2>
              </div>
              <div className="px-5 py-4 flex flex-wrap gap-3">
                {hasData ? d.paymentFreqs.map(f => (
                  <div key={f.name} className="flex-1 min-w-[100px] bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-sky-700">{f.pct}%</div>
                    <div className="text-xs text-gray-500 capitalize">{f.name}</div>
                    <div className="text-xs text-gray-400">{fmt(f.count)}</div>
                  </div>
                )) : null}
              </div>
            </div>
          </div>
        </div>

        {/* Top countries */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Top Countries</h2>
            <p className="text-xs text-gray-500 mt-0.5">Geographic distribution of active subscribers</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 divide-x divide-y divide-gray-100">
            {hasData ? d.topCountries.map(c => (
              <div key={c.name} className="px-4 py-3 text-center">
                <div className="text-lg font-bold text-gray-900">{c.name}</div>
                <div className="text-sm text-sky-700 font-semibold">{c.pct}%</div>
                <div className="text-xs text-gray-400">{fmt(c.count)}</div>
              </div>
            )) : null}
          </div>
        </div>

        {/* Trend */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Growth Trend</h2>
            <p className="text-xs text-gray-500 mt-0.5">Active subscriber count by month</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-5 py-3 font-medium">Month</th>
                  <th className="text-right px-5 py-3 font-medium">Active</th>
                  <th className="text-right px-5 py-3 font-medium">MoM Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {trend.map((row, i) => {
                  const prev = i > 0 ? trend[i - 1].active : null;
                  const change = prev ? row.active - prev : null;
                  const isLatest = i === trend.length - 1;
                  return (
                    <tr key={row.month} className={isLatest ? 'bg-gray-50' : 'hover:bg-gray-50'}>
                      <td className="px-5 py-3 font-medium text-gray-700">
                        {row.label}
                        {isLatest && <span className="ml-2 text-xs bg-sky-100 text-sky-600 px-1.5 py-0.5 rounded">Latest</span>}
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-sky-700">{fmt(row.active)}</td>
                      <td className="px-5 py-3 text-right text-sm">
                        {change !== null ? (
                          <span className={change >= 0 ? 'text-emerald-600 font-medium' : 'text-red-500 font-medium'}>
                            {change >= 0 ? '+' : ''}{fmt(change)}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Insight */}
        <div className="bg-sky-50 border border-sky-200 rounded-xl p-5">
          <h3 className="font-semibold text-sky-900 mb-2">Product Insight</h3>
          <ul className="space-y-1.5 text-sm text-sky-800">
            <li>• <strong>91% annual subscribers</strong> — extremely high commitment signal. Focus retention over acquisition.</li>
            <li>• <strong>Paid Social (38%)</strong> is the dominant channel, followed by Paid Search (22%). Test organic/referral to reduce CAC.</li>
            <li>• <strong>US represents 45%</strong> of the subscriber base. International expansion (CA, GB, AU) is growing.</li>
            <li>• Avg LTV of <strong>${fmt(d.avgLTV)}</strong> validates the premium subscription model.</li>
          </ul>
        </div>

        <div className="flex justify-end">
          <Link href="/dashboard/activation" className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors">
            Next: Activation →
          </Link>
        </div>
      </div>
    </div>
  );
}
