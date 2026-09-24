import Link from 'next/link';
import { getPipelineStatus } from '@/lib/pipeline-status';
import { seedProductDataIfNeeded } from '@/lib/product-data';
import DataFreshnessBanner from '@/components/DataFreshnessBanner';

export const dynamic = 'force-dynamic';

// ─── Revenue vs. Active-User retention by cohort month ───────────────────────
// Source: MV BigQuery (fact_mrr_movements) + Amplitude rolling retention
// Refreshed: 2026-07-27. Revenue = billing active as of day N. Active = used product ≥1× since purchase.
const COHORT_DATA = [
  { cohort: 'Jul 2025', d20r: 89.0, d20a: 70.0, d60r: 76.5, d60a: 59.8, d120r: 64.0, d120a: 53.2 },
  { cohort: 'Aug 2025', d20r: 88.7, d20a: 63.3, d60r: 77.3, d60a: 54.3, d120r: 65.2, d120a: 47.5 },
  { cohort: 'Sep 2025', d20r: 89.9, d20a: 65.6, d60r: 77.6, d60a: 53.4, d120r: 62.8, d120a: 44.3 },
  { cohort: 'Oct 2025', d20r: 89.2, d20a: 67.1, d60r: 74.2, d60a: 54.3, d120r: 60.5, d120a: 44.5 },
  { cohort: 'Nov 2025', d20r: 88.1, d20a: 73.9, d60r: 79.3, d60a: 64.2, d120r: 71.5, d120a: 55.1 },
  { cohort: 'Dec 2025', d20r: 87.3, d20a: 69.6, d60r: 76.4, d60a: 57.1, d120r: 67.8, d120a: 45.8 },
  { cohort: 'Jan 2026', d20r: 85.4, d20a: 66.0, d60r: 64.9, d60a: 50.5, d120r: 56.0, d120a: 36.4 },
  { cohort: 'Feb 2026', d20r: 85.6, d20a: 64.9, d60r: 59.8, d60a: 48.1, d120r: 50.7, d120a: 31.3 },
  { cohort: 'Mar 2026', d20r: 89.4, d20a: 66.0, d60r: 70.5, d60a: 45.6, d120r: 55.6, d120a: 19.0 },
  { cohort: 'Apr 2026', d20r: 87.6, d20a: 63.8, d60r: 68.6, d60a: 39.8, d120r: null, d120a: null },
  { cohort: 'May 2026', d20r: 89.3, d20a: 60.5, d60r: 69.6, d60a: 20.9, d120r: null, d120a: null },
  { cohort: 'Jun 2026', d20r: 88.0, d20a: 54.4, d60r: null, d60a: null, d120r: null, d120a: null },
  { cohort: 'Jul 2026', d20r: 87.9, d20a: 27.4, d60r: null, d60a: null, d120r: null, d120a: null },
];

// ─── Long-term curves (BigQuery monthly_cohort_retention, by payment type) ───
const ANNUAL = [
  { m: 0, r: 91.2 }, { m: 1, r: 88.5 }, { m: 2, r: 88.4 }, { m: 3, r: 88.3 },
  { m: 6, r: 88.3 }, { m: 9, r: 88.2 }, { m: 11, r: 87.2 },
  { m: 12, r: 36.3 }, { m: 18, r: 35.3 }, { m: 24, r: 18.3 },
];
const MONTHLY_CURVE = [
  { m: 0, r: 90.6 }, { m: 1, r: 62.4 }, { m: 2, r: 43.4 }, { m: 3, r: 33.1 },
  { m: 6, r: 19.4 }, { m: 9, r: 13.9 }, { m: 11, r: 11.8 },
  { m: 12, r: 9.3 }, { m: 18, r: 5.5 }, { m: 24, r: 3.8 },
];

// ─── Cancellation timing (BigQuery dim_subscription, last 13 months) ─────────
const CANCEL_TIMING = [
  { window: '0–20 days', count: 20735, pct: 45.8, avgDays: 7.2 },
  { window: '21–30 days', count: 2612, pct: 5.8, avgDays: 26.3 },
  { window: '31–60 days', count: 4527, pct: 10.0, avgDays: 42.7 },
  { window: '61–90 days', count: 2593, pct: 5.7, avgDays: 73.6 },
  { window: '91–120 days', count: 1711, pct: 3.8, avgDays: 103.9 },
  { window: '120+ days', count: 13068, pct: 28.9, avgDays: 278.2 },
];

function fmt(n: number) { return n.toLocaleString(); }
function gap(r: number, a: number) { return Math.round(r - a); }
function gapColor(g: number) {
  if (g >= 50) return 'text-red-700 font-bold';
  if (g >= 30) return 'text-red-600 font-semibold';
  if (g >= 20) return 'text-amber-600 font-semibold';
  return 'text-gray-500';
}
function rColor(r: number) {
  if (r >= 60) return 'text-emerald-700';
  if (r >= 40) return 'text-amber-600';
  return 'text-red-600';
}

function getR(data: { m: number; r: number }[], m: number) {
  return data.find(d => d.m === m)?.r ?? null;
}

const CURVE_MONTHS = [0, 1, 2, 3, 6, 9, 11, 12, 18, 24];

export default function RetentionPage() {
  seedProductDataIfNeeded();
  const { status, lastRunDate } = getPipelineStatus();

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/dashboard" className="text-xs text-gray-400 hover:text-gray-600">Journey</Link>
              <svg className="w-3 h-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
              <span className="text-xs text-teal-600 font-medium">Retention</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">Retention Curves</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Revenue vs. engagement retention by cohort — BigQuery + Amplitude. Refreshed 27 Jul 2026.
            </p>
          </div>
          <DataFreshnessBanner lastRunDate={lastRunDate} status={status} />
        </div>
      </div>

      <div className="p-6 space-y-6">

        {/* ── ALERT ── */}
        <div className="bg-red-700 rounded-xl p-5 text-white">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 mt-0.5 flex-shrink-0 text-red-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <div>
              <div className="font-bold text-base mb-1">Engagement crisis hidden behind revenue numbers</div>
              <p className="text-red-100 text-sm leading-relaxed">
                Revenue retention looks stable at ~88% at Day 20. But <strong className="text-white">active-user retention has collapsed</strong> — the Jul 2026 cohort is only <strong className="text-white">27.4% active at Day 20</strong>, down from <strong className="text-white">70.0%</strong> a year ago. Members keep paying, but they&apos;ve stopped using the product. This is a <strong className="text-white">delayed churn bomb</strong> — people who aren&apos;t using it will eventually cancel.
              </p>
            </div>
          </div>
        </div>

        {/* ── Three views of retention (KPI cards) ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Revenue Retention — Day 20 avg</div>
            <div className="text-3xl font-bold text-emerald-700">88.1%</div>
            <div className="text-xs text-gray-500 mt-1">Billing still active — the most generous view</div>
            <div className="mt-3 text-xs text-gray-400 bg-gray-50 rounded-lg p-2">Day 120 avg: <span className="font-semibold text-gray-700">61.6%</span></div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Churn-Adjusted — Day 20 avg</div>
            <div className="text-3xl font-bold text-amber-600">81.0%</div>
            <div className="text-xs text-gray-500 mt-1">Excludes anyone who ever cancelled/refunded — 7pp lower</div>
            <div className="mt-3 text-xs text-gray-400 bg-gray-50 rounded-lg p-2">Day 120 avg: <span className="font-semibold text-gray-700">55.8%</span></div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-5">
            <div className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-1">Active-User Retention — Day 20 avg</div>
            <div className="text-3xl font-bold text-red-700">62.5%</div>
            <div className="text-xs text-red-600 mt-1">Actually used the product at least once — the real picture</div>
            <div className="mt-3 text-xs text-red-400 bg-red-50 rounded-lg p-2">Day 120 avg: <span className="font-semibold text-red-700">41.9%</span> — 1.5× gap vs revenue</div>
          </div>
        </div>

        {/* ── Revenue vs Engagement gap table (by cohort) ── */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Revenue vs. Active-User Retention — by Cohort</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Rev = billing active · Active = used product ≥1× since purchase (Amplitude rolling) · Gap = Revenue − Active
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-5 py-3 font-medium">Cohort</th>
                  <th className="text-right px-3 py-3 font-medium text-blue-600">Day 20 Rev</th>
                  <th className="text-right px-3 py-3 font-medium text-rose-600">Day 20 Active</th>
                  <th className="text-right px-3 py-3 font-medium text-gray-500">Gap</th>
                  <th className="text-right px-3 py-3 font-medium text-blue-600">Day 60 Rev</th>
                  <th className="text-right px-3 py-3 font-medium text-rose-600">Day 60 Active</th>
                  <th className="text-right px-3 py-3 font-medium text-gray-500">Gap</th>
                  <th className="text-right px-3 py-3 font-medium text-blue-600">Day 120 Rev</th>
                  <th className="text-right px-3 py-3 font-medium text-rose-600">Day 120 Active</th>
                  <th className="text-right px-3 py-3 font-medium text-gray-500">Gap</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {COHORT_DATA.map((row) => {
                  const g20 = gap(row.d20r, row.d20a);
                  const g60 = row.d60r !== null && row.d60a !== null ? gap(row.d60r, row.d60a) : null;
                  const g120 = row.d120r !== null && row.d120a !== null ? gap(row.d120r, row.d120a) : null;
                  const isAlarm = g20 >= 40 || (g60 !== null && g60 >= 40);
                  return (
                    <tr key={row.cohort} className={`${isAlarm ? 'bg-red-50' : 'hover:bg-gray-50'} transition-colors`}>
                      <td className="px-5 py-2.5 font-medium text-gray-800 text-xs">
                        {row.cohort}
                        {isAlarm && <span className="ml-1.5 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-semibold">!</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs text-blue-700">{row.d20r}%</td>
                      <td className={`px-3 py-2.5 text-right text-xs ${rColor(row.d20a)}`}>{row.d20a}%</td>
                      <td className={`px-3 py-2.5 text-right text-xs ${gapColor(g20)}`}>+{g20}pp</td>
                      <td className="px-3 py-2.5 text-right text-xs text-blue-700">{row.d60r !== null ? `${row.d60r}%` : '—'}</td>
                      <td className={`px-3 py-2.5 text-right text-xs ${row.d60a !== null ? rColor(row.d60a) : 'text-gray-300'}`}>{row.d60a !== null ? `${row.d60a}%` : '—'}</td>
                      <td className={`px-3 py-2.5 text-right text-xs ${g60 !== null ? gapColor(g60) : 'text-gray-300'}`}>{g60 !== null ? `+${g60}pp` : '—'}</td>
                      <td className="px-3 py-2.5 text-right text-xs text-blue-700">{row.d120r !== null ? `${row.d120r}%` : '—'}</td>
                      <td className={`px-3 py-2.5 text-right text-xs ${row.d120a !== null ? rColor(row.d120a) : 'text-gray-300'}`}>{row.d120a !== null ? `${row.d120a}%` : '—'}</td>
                      <td className={`px-3 py-2.5 text-right text-xs ${g120 !== null ? gapColor(g120) : 'text-gray-300'}`}>{g120 !== null ? `+${g120}pp` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
            Source: BigQuery <code className="bg-gray-100 px-1 rounded">fact_mrr_movements</code> + Amplitude rolling retention · — = window not yet elapsed
          </div>
        </div>

        {/* ── Engagement trend visual ── */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Active-User Retention at Day 20 — Trend</h2>
            <p className="text-xs text-gray-500 mt-0.5">The % of each month&apos;s new members who actually used the product within their first 20 days</p>
          </div>
          <div className="px-5 py-4 space-y-2">
            {COHORT_DATA.map((row) => {
              const isWorst = row.cohort === 'Jul 2026';
              const isBest = row.cohort === 'Nov 2025';
              return (
                <div key={row.cohort} className="flex items-center gap-3">
                  <div className="w-20 text-xs text-gray-600 text-right flex-shrink-0">{row.cohort}</div>
                  <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${isWorst ? 'bg-red-500' : isBest ? 'bg-emerald-500' : 'bg-rose-400'}`}
                      style={{ width: `${row.d20a}%` }}
                    />
                  </div>
                  <div className={`w-12 text-xs text-right font-semibold flex-shrink-0 ${isWorst ? 'text-red-600' : isBest ? 'text-emerald-600' : rColor(row.d20a)}`}>
                    {row.d20a}%
                  </div>
                  {isWorst && <span className="text-xs text-red-600 font-bold flex-shrink-0">← worst</span>}
                  {isBest && <span className="text-xs text-emerald-600 font-bold flex-shrink-0">← best</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Cancellation timing ── */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">When Do Members Cancel?</h2>
            <p className="text-xs text-gray-500 mt-0.5">Last 13 months of subscription starts · 46% cancel within 20 days · 81% give no reason</p>
          </div>
          <div className="px-5 py-4 space-y-3">
            {CANCEL_TIMING.map((row) => {
              const isFirst = row.window === '0–20 days';
              return (
                <div key={row.window}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm font-medium ${isFirst ? 'text-red-700' : 'text-gray-700'}`}>
                      {row.window}
                      {isFirst && <span className="ml-2 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">avg {row.avgDays}d to request</span>}
                    </span>
                    <div className="text-sm text-right">
                      <span className={`font-bold ${isFirst ? 'text-red-700' : 'text-gray-700'}`}>{fmt(row.count)}</span>
                      <span className="text-gray-400 ml-1.5">({row.pct}%)</span>
                    </div>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${isFirst ? 'bg-red-500' : 'bg-gray-300'}`}
                      style={{ width: `${row.pct * 2}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="px-5 py-3 bg-amber-50 border-t border-amber-100">
            <p className="text-xs text-amber-800">
              <strong>81% of first-20-day cancellers give no reason.</strong> Top stated reason: &quot;too expensive&quot; (6%). Many annual-plan early cancellations are pre-emptive — people cancelling to avoid next year&apos;s charge, not because they dislike the product.
            </p>
          </div>
        </div>

        {/* ── Long-term curves (annual vs monthly) ── */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Long-Term Retention by Payment Plan</h2>
            <p className="text-xs text-gray-500 mt-0.5">% of original cohort still active at each month — BigQuery monthly_cohort_retention</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-5 py-3 font-medium w-32">Month</th>
                  <th className="text-right px-4 py-3 font-medium text-teal-600 w-24">Annual</th>
                  <th className="px-4 py-3 w-48"></th>
                  <th className="text-right px-4 py-3 font-medium text-violet-600 w-24">Monthly</th>
                  <th className="px-4 py-3 w-48"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {CURVE_MONTHS.map((m) => {
                  const ar = getR(ANNUAL, m);
                  const mr = getR(MONTHLY_CURVE, m);
                  const isCliff = m === 12;
                  const isSecondCliff = m === 24;
                  return (
                    <tr key={m} className={`${isCliff ? 'bg-red-50 border-l-4 border-l-red-500' : isSecondCliff ? 'bg-orange-50 border-l-4 border-l-orange-400' : 'hover:bg-gray-50'} transition-colors`}>
                      <td className="px-5 py-2.5 font-medium text-gray-700 text-sm">
                        Month {m}
                        {isCliff && <span className="ml-2 text-xs text-red-600 font-semibold">← Annual renewal cliff</span>}
                        {isSecondCliff && <span className="ml-2 text-xs text-orange-600 font-semibold">← Year-2 renewal</span>}
                      </td>
                      <td className={`px-4 py-2.5 text-right text-sm font-semibold ${ar !== null ? (isCliff ? 'text-red-600' : 'text-teal-700') : 'text-gray-300'}`}>
                        {ar !== null ? `${ar}%` : '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        {ar !== null && (
                          <div className="w-full bg-gray-100 rounded-full h-2.5">
                            <div className={`h-2.5 rounded-full ${isCliff ? 'bg-red-400' : 'bg-teal-500'}`} style={{ width: `${ar}%` }} />
                          </div>
                        )}
                      </td>
                      <td className={`px-4 py-2.5 text-right text-sm font-semibold ${mr !== null ? rColor(mr) : 'text-gray-300'}`}>
                        {mr !== null ? `${mr}%` : '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        {mr !== null && (
                          <div className="w-full bg-gray-100 rounded-full h-2.5">
                            <div className="h-2.5 rounded-full bg-violet-400" style={{ width: `${mr}%` }} />
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Two-column insight ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-5">
            <h3 className="font-bold text-rose-800 mb-3">The Engagement Crisis</h3>
            <ul className="space-y-2 text-sm text-rose-900">
              <li>• Revenue retention hides a worsening engagement gap — ratio is <strong>1.5× at Day 120</strong></li>
              <li>• Active-user retention at Day 20 has fallen from <strong>70% → 27%</strong> in 12 months</li>
              <li>• Mar 2026 cohort: 55.6% still paying at Day 120, only <strong>19.0% ever used the product</strong></li>
              <li>• Members who don&apos;t use the product <strong>will eventually cancel</strong> — this is future churn already banked</li>
              <li>• <strong>The window is Day 0–20.</strong> 46% of all cancellations are requested within the first 20 days</li>
            </ul>
          </div>
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-5">
            <h3 className="font-bold text-teal-800 mb-3">The Month-12 Renewal Cliff</h3>
            <ul className="space-y-2 text-sm text-teal-900">
              <li>• Annual subscribers retain at <strong>87–88% month-to-month</strong> during their year</li>
              <li>• At Month 12 renewal: only <strong>36.3% renew</strong> — 63.7% don&apos;t</li>
              <li>• Industry median for annual plan renewal is 27% (RevenueCat); we&apos;re above median but far from best-in-class (45%)</li>
              <li>• The 29% who cancel after 120+ days are mostly <strong>annual-plan non-renewers</strong></li>
              <li>• A 5pp improvement in renewal rate would recover <strong>significant ARR</strong> annually</li>
            </ul>
          </div>
        </div>

        {/* ── Decision callout ── */}
        <div className="bg-gray-900 rounded-xl p-6 text-white">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Decision Required</div>
          <h3 className="text-lg font-bold mb-3">Two different problems. Two different fixes.</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-sm font-bold text-red-300 mb-1">Problem 1: Engagement collapse (Day 0–20)</div>
              <p className="text-sm text-gray-300 leading-relaxed">27% active-user retention at Day 20 means new members aren&apos;t getting to value. An onboarding overhaul in the first 2 weeks is the highest-leverage product investment right now.</p>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-sm font-bold text-amber-300 mb-1">Problem 2: Annual renewal cliff (Month 9–12)</div>
              <p className="text-sm text-gray-300 leading-relaxed">63% of annual subscribers don&apos;t renew. A pre-renewal engagement program in months 9–11 — when members are paying attention — targets the single largest churn event in the business.</p>
            </div>
          </div>
          <div className="mt-4">
            <Link href="/dashboard/forecast" className="inline-flex items-center gap-1.5 bg-white text-gray-900 font-semibold text-sm px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors">
              Model revenue impact →
            </Link>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <Link href="/dashboard/ai-adoption" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            EVE Adoption
          </Link>
          <Link href="/dashboard/forecast" className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors">
            Next: Forecast →
          </Link>
        </div>

      </div>
    </div>
  );
}
