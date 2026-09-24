'use client';

import type { FeatureReleaseRow } from '@/lib/db';
import type { ReleaseDetail, PlannedReleaseForecast } from '@/lib/releases';

interface Props {
  release: FeatureReleaseRow;
  detail: ReleaseDetail;
  forecast: PlannedReleaseForecast | null;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function DeltaBadge({ value, unit = '' }: { value: number; unit?: string }) {
  const isPositive = value > 0;
  const isNegative = value < 0;
  return (
    <span
      className={`inline-flex items-center gap-1 text-sm font-semibold ${
        isPositive ? 'text-emerald-600' : isNegative ? 'text-red-600' : 'text-gray-500'
      }`}
    >
      {isPositive ? '+' : ''}{typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: 1 }) : value}{unit}
    </span>
  );
}

function KpiCard({
  label,
  before,
  after,
  delta,
  deltaPct,
  prefix = '',
  suffix = '',
}: {
  label: string;
  before: number;
  after: number;
  delta: number;
  deltaPct: number;
  prefix?: string;
  suffix?: string;
}) {
  const isPositive = delta > 0;
  const isNegative = delta < 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">{label}</div>
      <div className="flex items-end justify-between gap-2">
        <div>
          <div className="text-xs text-gray-400 mb-0.5">Before</div>
          <div className="text-xl font-bold text-gray-700">
            {prefix}{before.toLocaleString(undefined, { maximumFractionDigits: 1 })}{suffix}
          </div>
        </div>
        <svg className="w-5 h-5 text-gray-300 flex-shrink-0 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
        </svg>
        <div>
          <div className="text-xs text-gray-400 mb-0.5">After</div>
          <div className="text-xl font-bold text-gray-900">
            {prefix}{after.toLocaleString(undefined, { maximumFractionDigits: 1 })}{suffix}
          </div>
        </div>
      </div>
      <div className={`mt-3 pt-3 border-t border-gray-100 flex items-center gap-2`}>
        <span className={`text-sm font-semibold ${isPositive ? 'text-emerald-600' : isNegative ? 'text-red-600' : 'text-gray-500'}`}>
          {isPositive ? '+' : ''}{delta.toLocaleString(undefined, { maximumFractionDigits: 1 })}{suffix}
        </span>
        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
          isPositive ? 'bg-emerald-50 text-emerald-700' : isNegative ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600'
        }`}>
          {isPositive ? '+' : ''}{deltaPct.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

function ForecastKpiCard({
  label,
  deltaValue,
  deltaPct,
  prefix = '',
  suffix = '',
}: {
  label: string;
  deltaValue: number;
  deltaPct: number;
  prefix?: string;
  suffix?: string;
}) {
  const isPositive = deltaPct > 0;
  const isNegative = deltaPct < 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">{label}</div>
      <div className="text-2xl font-bold text-gray-900">
        <span className={isPositive ? 'text-emerald-600' : isNegative ? 'text-red-600' : 'text-gray-500'}>
          {isPositive ? '+' : ''}{deltaPct.toFixed(1)}%
        </span>
      </div>
      <div className="text-sm text-gray-500 mt-1">
        {isPositive ? '+' : ''}{prefix}{deltaValue.toLocaleString(undefined, { maximumFractionDigits: 1 })}{suffix} projected
      </div>
    </div>
  );
}

function CohortImpactRow({
  cohortName,
  impactScore,
  direction,
  memberCount,
  before,
  after,
}: {
  cohortName: string;
  impactScore: number;
  direction: 'positive' | 'negative' | 'neutral';
  memberCount: number;
  before?: number;
  after?: number;
}) {
  const directionStyles = {
    positive: { dot: 'bg-emerald-400', badge: 'bg-emerald-50 text-emerald-700', sign: '+' },
    negative: { dot: 'bg-red-400', badge: 'bg-red-50 text-red-700', sign: '' },
    neutral: { dot: 'bg-gray-300', badge: 'bg-gray-100 text-gray-600', sign: '' },
  };
  const styles = directionStyles[direction];

  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${styles.dot}`} />
        <div className="min-w-0">
          <div className="text-sm font-medium text-gray-900">{cohortName}</div>
          <div className="text-xs text-gray-400">{memberCount.toLocaleString()} members</div>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        {before !== undefined && after !== undefined && (
          <div className="text-xs text-gray-400 hidden sm:block">
            {before.toFixed(1)} → {after.toFixed(1)} avg events/member
          </div>
        )}
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles.badge}`}>
          {styles.sign}{impactScore.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

export default function ReleaseDetailClient({ release, detail, forecast }: Props) {
  const isReleased = release.status === 'released';

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Release header */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <h1 className="text-lg font-bold text-gray-900">{release.name}</h1>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                isReleased ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {isReleased ? 'Released' : 'Planned'}
              </span>
            </div>
            <p className="text-sm text-gray-600">{release.description}</p>
          </div>
          <div className="flex-shrink-0 text-right">
            <div className="text-xs text-gray-400 mb-0.5">{isReleased ? 'Release date' : 'Target date'}</div>
            <div className="text-sm font-semibold text-gray-900">{formatDate(release.release_date)}</div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* RELEASED: Before/after KPI comparison                               */}
      {/* ------------------------------------------------------------------ */}
      {isReleased && detail.kpiComparison && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Before / After KPI Comparison</h2>
              <p className="text-xs text-gray-500 mt-0.5">30-day window before and after release date</p>
            </div>
          </div>

          {/* Causation disclaimer (AC8) */}
          <div className="mb-4 flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <svg className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <p className="text-xs text-amber-800">
              <span className="font-semibold">Directional signal, not proven causation.</span>{' '}
              These metrics reflect aggregate changes in the 30-day windows around the release date. Many factors influence KPIs simultaneously; this comparison is correlation-based and should be treated as a starting point for investigation, not a definitive attribution.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard
              label="Weekly Active Users (WAU)"
              before={detail.kpiComparison.before.wau}
              after={detail.kpiComparison.after.wau}
              delta={detail.kpiComparison.wauDelta}
              deltaPct={detail.kpiComparison.wauDeltaPct}
            />
            <KpiCard
              label="Weekly Retention Rate"
              before={detail.kpiComparison.before.retentionPct}
              after={detail.kpiComparison.after.retentionPct}
              delta={detail.kpiComparison.retentionDelta}
              deltaPct={detail.kpiComparison.retentionDeltaPct}
              suffix="%"
            />
            <KpiCard
              label="Revenue (30-day window)"
              before={detail.kpiComparison.before.revenue}
              after={detail.kpiComparison.after.revenue}
              delta={detail.kpiComparison.revenueDelta}
              deltaPct={detail.kpiComparison.revenueDeltaPct}
              prefix="$"
            />
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* PLANNED: Forecast                                                    */}
      {/* ------------------------------------------------------------------ */}
      {!isReleased && forecast && (
        <section>
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Projected KPI Impact</h2>
            <p className="text-xs text-gray-500 mt-0.5">Forecast based on average of {forecast.accuracy.historicalReleaseCount} historical releases</p>
          </div>

          {/* Accuracy badge */}
          <div className="mb-4 flex items-start gap-2.5 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
            <svg className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
            <p className="text-xs text-blue-800">
              <span className="font-semibold">Forecast model: {forecast.accuracy.historicalReleaseCount} historical releases · {forecast.accuracy.averageAccuracyPct}% average accuracy.</span>{' '}
              {forecast.accuracy.detail}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <ForecastKpiCard
              label="WAU Change (projected)"
              deltaValue={forecast.forecastedWauDelta}
              deltaPct={forecast.forecastedWauDeltaPct}
            />
            <ForecastKpiCard
              label="Retention Rate Change"
              deltaValue={forecast.forecastedRetentionDelta}
              deltaPct={forecast.forecastedRetentionDeltaPct}
              suffix="pp"
            />
            <ForecastKpiCard
              label="Revenue Change (projected)"
              deltaValue={forecast.forecastedRevenueDelta}
              deltaPct={forecast.forecastedRevenueDeltaPct}
              prefix="$"
            />
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Cohort attribution / forecasted cohort impact                        */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-gray-900">
            {isReleased ? 'Cohort Attribution' : 'Forecasted Cohort Impact'}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {isReleased
              ? 'Change in average engagement events per cohort member — 30 days before vs after release'
              : 'Projected engagement impact by cohort, derived from historical release averages'}
          </p>
        </div>

        {isReleased && (
          <div className="mb-4 flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <svg className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <p className="text-xs text-amber-800">
              <span className="font-semibold">Directional signal, not proven causation.</span>{' '}
              Cohort engagement changes coincide with this release but may be influenced by other concurrent factors.
            </p>
          </div>
        )}

        {/* Top positively impacted */}
        {isReleased && detail.topPositive.length > 0 && (
          <div className="mb-4">
            <div className="text-xs font-medium text-emerald-700 uppercase tracking-wider px-1 mb-2">
              Most Positively Impacted
            </div>
            <div className="bg-white rounded-xl border border-emerald-200 px-5 divide-y divide-gray-100">
              {detail.topPositive.map(ci => (
                <CohortImpactRow
                  key={ci.cohortId}
                  cohortName={ci.cohortName}
                  impactScore={ci.impactScore}
                  direction={ci.direction}
                  memberCount={ci.memberCount}
                  before={ci.beforeEngagement}
                  after={ci.afterEngagement}
                />
              ))}
            </div>
          </div>
        )}

        {/* Top negatively impacted */}
        {isReleased && detail.topNegative.length > 0 && (
          <div className="mb-4">
            <div className="text-xs font-medium text-red-700 uppercase tracking-wider px-1 mb-2">
              Most Negatively Impacted
            </div>
            <div className="bg-white rounded-xl border border-red-200 px-5 divide-y divide-gray-100">
              {detail.topNegative.map(ci => (
                <CohortImpactRow
                  key={ci.cohortId}
                  cohortName={ci.cohortName}
                  impactScore={ci.impactScore}
                  direction={ci.direction}
                  memberCount={ci.memberCount}
                  before={ci.beforeEngagement}
                  after={ci.afterEngagement}
                />
              ))}
            </div>
          </div>
        )}

        {/* All cohorts */}
        <div>
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider px-1 mb-2">
            All Cohorts
          </div>
          <div className="bg-white rounded-xl border border-gray-200 px-5 divide-y divide-gray-100">
            {isReleased
              ? detail.cohortImpacts.map(ci => (
                  <CohortImpactRow
                    key={ci.cohortId}
                    cohortName={ci.cohortName}
                    impactScore={ci.impactScore}
                    direction={ci.direction}
                    memberCount={ci.memberCount}
                    before={ci.beforeEngagement}
                    after={ci.afterEngagement}
                  />
                ))
              : forecast?.cohortForecasts.map(cf => (
                  <CohortImpactRow
                    key={cf.cohortId}
                    cohortName={cf.cohortName}
                    impactScore={cf.forecastedImpactScore}
                    direction={cf.direction}
                    memberCount={cf.memberCount}
                  />
                ))}

            {isReleased && detail.cohortImpacts.length === 0 && (
              <div className="py-8 text-center text-sm text-gray-500">
                No cohort data available for this release window.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
