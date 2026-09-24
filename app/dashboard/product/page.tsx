import { seedProductDataIfNeeded, getLatestMonth, getMonthlySnapshot, fmtMonth, getProductMetrics, getEmailData, getPremiumData } from '@/lib/product-data';
import type { ProductBreakdownRow, EngagementBands } from '@/lib/product-data';

export const dynamic = 'force-dynamic';

function fmt(n: number) {
  return n.toLocaleString();
}

function BarRow({ label, count, pct, sub }: { label: string; count: number; pct: number; sub?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-36 text-xs text-gray-600 truncate shrink-0" title={label}>{label}</div>
      <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-violet-500 rounded-full transition-all"
          style={{ width: `${Math.max(pct, 1)}%` }}
        />
      </div>
      <div className="w-14 text-right text-xs font-medium text-gray-700 shrink-0">{fmt(count)}</div>
      <div className="w-8 text-right text-xs text-gray-400 shrink-0">{pct}%</div>
      {sub && <div className="text-xs text-gray-400 shrink-0">{sub}</div>}
    </div>
  );
}

function ColorBarRow({
  label,
  count,
  pct,
  color,
}: {
  label: string;
  count: number;
  pct: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-24 text-xs text-gray-600 truncate shrink-0">{label}</div>
      <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.max(pct, 1)}%` }} />
      </div>
      <div className="w-14 text-right text-xs font-medium text-gray-700 shrink-0">{fmt(count)}</div>
      <div className="w-8 text-right text-xs text-gray-400 shrink-0">{pct}%</div>
    </div>
  );
}

function FunnelStep({
  label,
  count,
  rate,
  color,
  bg,
  isFirst,
}: {
  label: string;
  count: number;
  rate: number | null;
  color: string;
  bg: string;
  isFirst: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      {!isFirst && (
        <div className="flex flex-col items-center w-6">
          <div className="w-0 h-0 border-l-[8px] border-r-[8px] border-t-[10px] border-l-transparent border-r-transparent border-t-gray-300" />
        </div>
      )}
      <div className={`flex-1 rounded-xl border p-4 ${bg}`}>
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">{label}</div>
        <div className={`text-2xl font-bold ${color}`}>{fmt(count)}</div>
        {rate !== null && (
          <div className="text-xs text-gray-400 mt-1">{rate}% of active</div>
        )}
      </div>
    </div>
  );
}

function EngagementBandsSection({ eng, total }: { eng: EngagementBands; total: number }) {
  const toPct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0;
  const bands = [
    { label: 'High (≥500 min)', count: eng.high, pct: toPct(eng.high), color: 'bg-emerald-500' },
    { label: 'Medium (100–499 min)', count: eng.medium, pct: toPct(eng.medium), color: 'bg-violet-500' },
    { label: 'Low (1–99 min)', count: eng.low, pct: toPct(eng.low), color: 'bg-amber-500' },
    { label: 'No content watched', count: eng.none, pct: toPct(eng.none), color: 'bg-gray-300' },
  ];
  return (
    <div className="space-y-3">
      {bands.map((b) => (
        <ColorBarRow key={b.label} label={b.label} count={b.count} pct={b.pct} color={b.color} />
      ))}
    </div>
  );
}

export default function ProductMetricsPage() {
  seedProductDataIfNeeded();
  const month = getLatestMonth();
  const snap = getMonthlySnapshot(month);
  const metrics = getProductMetrics(month);
  const email = getEmailData(month);
  const premium = getPremiumData(month);

  const funnelSteps = [
    { label: 'Active Subscribers', count: snap.active, rate: null, color: 'text-sky-700', bg: 'bg-sky-50 border-sky-200' },
    { label: 'Logged In', count: snap.loggedIn, rate: snap.loginRate, color: 'text-violet-700', bg: 'bg-violet-50 border-violet-200' },
    { label: 'Content Progress', count: snap.hasProgress, rate: snap.progressRate, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
    { label: 'Used EVE', count: snap.eveUsers, rate: snap.eveRate, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  ];

  const dropOffs = [
    snap.active - snap.loggedIn,
    snap.loggedIn - snap.hasProgress,
    snap.hasProgress - snap.eveUsers,
  ];

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <h1 className="text-xl font-bold text-gray-900">Product Metrics</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Snapshot: <span className="font-medium text-gray-700">{fmtMonth(month)}</span>
          &nbsp;·&nbsp;{fmt(metrics.total)} active subscribers
        </p>
      </div>

      <div className="p-6 space-y-6">

        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: 'Active Subs', value: fmt(metrics.total), sub: 'subscription_status = active' },
            { label: 'New This Period', value: fmt(metrics.newSubs), sub: 'started recently' },
            { label: 'Avg LTV', value: `$${fmt(metrics.avgLtv)}`, sub: 'lifetime value' },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-2xl font-bold text-gray-900">{kpi.value}</div>
              <div className="text-sm font-medium text-gray-700 mt-0.5">{kpi.label}</div>
              <div className="text-xs text-gray-400 mt-0.5">{kpi.sub}</div>
            </div>
          ))}
        </div>

        {/* User Journey Funnel */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">User Journey Funnel</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              How subscribers move through each engagement stage
            </p>
          </div>
          <div className="p-5">
            {/* Funnel steps */}
            <div className="flex flex-col sm:flex-row gap-2 items-stretch">
              {funnelSteps.map((step, i) => (
                <div key={step.label} className="flex sm:flex-col items-center gap-2 flex-1">
                  <div className={`flex-1 w-full rounded-xl border p-4 ${step.bg}`}>
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">{step.label}</div>
                    <div className={`text-2xl font-bold ${step.color}`}>{fmt(step.count)}</div>
                    {step.rate !== null && (
                      <div className="text-xs text-gray-400 mt-1">{step.rate}% of active</div>
                    )}
                  </div>
                  {i < dropOffs.length && (
                    <div className="text-xs text-red-400 font-medium shrink-0 sm:text-center">
                      <span className="sm:hidden">↓ </span>
                      <span className="hidden sm:inline">↓ </span>
                      {fmt(dropOffs[i])} drop off
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Conversion rate summary */}
            <div className="mt-4 grid grid-cols-3 gap-3">
              {[
                { label: 'Login conversion', value: `${snap.loginRate}%`, color: 'text-violet-700' },
                { label: 'Progress conversion', value: `${snap.progressRate}%`, color: 'text-emerald-700' },
                { label: 'EVE adoption', value: `${snap.eveRate}%`, color: 'text-amber-700' },
              ].map((c) => (
                <div key={c.label} className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className={`text-xl font-bold ${c.color}`}>{c.value}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{c.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Product breakdown */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Membership Products</h2>
              <p className="text-xs text-gray-500 mt-0.5">Active subscribers by product</p>
            </div>
            <div className="p-5 space-y-3">
              {metrics.products.map((p) => (
                <BarRow
                  key={p.name}
                  label={p.name}
                  count={p.count}
                  pct={p.pct}
                  sub={p.avgLtv > 0 ? `avg $${p.avgLtv} LTV` : undefined}
                />
              ))}
            </div>
          </div>

          {/* Engagement bands */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Content Engagement</h2>
              <p className="text-xs text-gray-500 mt-0.5">Minutes watched by active subscribers</p>
            </div>
            <div className="p-5">
              <EngagementBandsSection eng={metrics.engagement} total={metrics.total} />
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="bg-emerald-50 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-emerald-700">
                    {metrics.total > 0 ? Math.round(((metrics.engagement.high + metrics.engagement.medium) / metrics.total) * 100) : 0}%
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">Engaged (≥100 min)</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-gray-700">
                    {metrics.total > 0 ? Math.round(((metrics.engagement.low + metrics.engagement.none) / metrics.total) * 100) : 0}%
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">Low/No engagement</div>
                </div>
              </div>
            </div>
          </div>

          {/* Tier distribution */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Subscription Tier</h2>
              <p className="text-xs text-gray-500 mt-0.5">Price tier distribution</p>
            </div>
            <div className="p-5 space-y-3">
              {metrics.tiers.map((t) => (
                <BarRow key={t.name} label={t.name} count={t.count} pct={t.pct} />
              ))}
            </div>
          </div>

          {/* Payment frequency */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Payment Frequency</h2>
              <p className="text-xs text-gray-500 mt-0.5">How subscribers pay</p>
            </div>
            <div className="p-5 space-y-3">
              {metrics.paymentFreqs.map((f) => (
                <BarRow key={f.name} label={f.name} count={f.count} pct={f.pct} />
              ))}
            </div>
          </div>

        </div>

        {/* Acquisition channels */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Acquisition Channels</h2>
            <p className="text-xs text-gray-500 mt-0.5">Where active subscribers came from</p>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {metrics.channels.map((c) => (
              <BarRow key={c.name} label={c.name} count={c.count} pct={c.pct} />
            ))}
          </div>
        </div>

        {/* Email Engagement */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Email Engagement</h2>
            <p className="text-xs text-gray-500 mt-0.5">Monthly email delivery and engagement metrics</p>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-5">
              {[
                { label: 'Delivered', value: fmt(email.delivered), sub: 'Emails delivered this month', accent: 'text-gray-900' },
                { label: 'Open Rate', value: `${email.openRate}%`, sub: `${fmt(email.opened)} opened`, accent: 'text-violet-700' },
                { label: 'Click Rate', value: `${email.clickRate}%`, sub: `${fmt(email.clicked)} clicked (of opened)`, accent: 'text-emerald-700' },
              ].map(k => (
                <div key={k.label} className="bg-gray-50 rounded-xl p-4">
                  <div className={`text-2xl font-bold ${k.accent}`}>{k.value}</div>
                  <div className="text-sm font-medium text-gray-700 mt-0.5">{k.label}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{k.sub}</div>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              {[
                { label: 'Opened', count: email.opened, pct: email.delivered > 0 ? Math.round((email.opened / email.delivered) * 100) : 0, color: 'bg-violet-500' },
                { label: 'Clicked', count: email.clicked, pct: email.delivered > 0 ? Math.round((email.clicked / email.delivered) * 100) : 0, color: 'bg-emerald-500' },
                { label: 'Push Tapped', count: email.pushTapped, pct: email.delivered > 0 ? Math.round((email.pushTapped / email.delivered) * 100) : 0, color: 'bg-amber-400' },
              ].map(row => (
                <div key={row.label} className="flex items-center gap-3">
                  <div className="w-24 text-xs text-gray-600 truncate shrink-0">{row.label}</div>
                  <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${row.color}`} style={{ width: `${Math.max(row.pct, row.count > 0 ? 1 : 0)}%` }} />
                  </div>
                  <div className="w-16 text-right text-xs font-medium text-gray-700 shrink-0">{fmt(row.count)}</div>
                  <div className="w-10 text-right text-xs text-gray-400 shrink-0">{row.pct}%</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Premium Ownership */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Premium Ownership</h2>
            <p className="text-xs text-gray-500 mt-0.5">Active subscribers who own premium add-on products</p>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-5">
              {[
                { label: 'Any Premium', value: `${premium.hasAnyPct}%`, sub: `${fmt(premium.hasAny)} subscribers`, accent: 'text-violet-700' },
                { label: 'Avg Premium Owned', value: premium.avgPremiumOwned.toFixed(2), sub: 'programs per subscriber', accent: 'text-gray-900' },
                { label: 'Total Active', value: fmt(premium.total), sub: 'active subscribers', accent: 'text-gray-900' },
              ].map(k => (
                <div key={k.label} className="bg-gray-50 rounded-xl p-4">
                  <div className={`text-2xl font-bold ${k.accent}`}>{k.value}</div>
                  <div className="text-sm font-medium text-gray-700 mt-0.5">{k.label}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{k.sub}</div>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              {[
                { label: 'Mastery', count: premium.hasMastery, pct: premium.hasMasteryPct, color: 'bg-violet-600' },
                { label: 'Certification', count: premium.hasCert, pct: premium.hasCertPct, color: 'bg-violet-400' },
                { label: 'MV Coach', count: premium.hasCoach, pct: premium.hasCoachPct, color: 'bg-emerald-500' },
                { label: 'Accelerator', count: premium.hasAccelerator, pct: premium.hasAcceleratorPct, color: 'bg-amber-500' },
              ].map(row => (
                <div key={row.label} className="flex items-center gap-3">
                  <div className="w-24 text-xs text-gray-600 truncate shrink-0">{row.label}</div>
                  <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${row.color}`} style={{ width: `${Math.max(row.pct, row.count > 0 ? 1 : 0)}%` }} />
                  </div>
                  <div className="w-16 text-right text-xs font-medium text-gray-700 shrink-0">{fmt(row.count)}</div>
                  <div className="w-10 text-right text-xs text-gray-400 shrink-0">{row.pct}%</div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
