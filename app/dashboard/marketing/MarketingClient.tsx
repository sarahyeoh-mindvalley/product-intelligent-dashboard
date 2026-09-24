'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { RecommendationRow } from '@/lib/recommendations';

interface Props {
  recommendations: RecommendationRow[];
  actOnRate: number;
  actedOnCount: number;
  totalCount: number;
}

const ACTION_COLORS: Record<string, { badge: string; icon: string }> = {
  Reactivation: {
    badge: 'bg-red-100 text-red-700 border border-red-200',
    icon: 'text-red-500',
  },
  Upsell: {
    badge: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    icon: 'text-emerald-500',
  },
  'Win-back': {
    badge: 'bg-amber-100 text-amber-700 border border-amber-200',
    icon: 'text-amber-500',
  },
};

function formatRevenue(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${Math.round(val / 1_000)}K`;
  return `$${val}`;
}

export default function MarketingClient({ recommendations, actOnRate, actedOnCount, totalCount }: Props) {
  const [recs, setRecs] = useState<RecommendationRow[]>(recommendations);
  const [actingOn, setActingOn] = useState<Set<number>>(new Set());

  async function handleActOn(id: number) {
    // Optimistic update
    setRecs(prev =>
      prev.map(r =>
        r.id === id ? { ...r, status: 'acted_on' as const, acted_on_at: new Date().toISOString() } : r,
      ),
    );
    setActingOn(prev => new Set(prev).add(id));

    try {
      await fetch(`/api/recommendations/${id}/act`, { method: 'POST' });
    } catch {
      // Revert on error
      setRecs(prev =>
        prev.map(r => (r.id === id ? { ...r, status: 'active' as const, acted_on_at: null } : r)),
      );
    } finally {
      setActingOn(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  const activeRecs = recs.filter(r => r.status === 'active');
  const actedOnRecs = recs.filter(r => r.status === 'acted_on');

  return (
    <div className="p-6 space-y-6">
      {/* Act-on rate widget */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-2xl font-bold text-violet-700">{actOnRate}%</div>
          <div className="text-sm font-medium text-gray-700 mt-0.5">Act-on Rate</div>
          <div className="text-xs text-gray-400 mt-1">{actedOnCount} of {totalCount} recommendations acted on</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-2xl font-bold text-gray-900">{activeRecs.length}</div>
          <div className="text-sm font-medium text-gray-700 mt-0.5">Active Recommendations</div>
          <div className="text-xs text-gray-400 mt-1">Ranked by revenue impact</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-2xl font-bold text-emerald-700">{actedOnRecs.length}</div>
          <div className="text-sm font-medium text-gray-700 mt-0.5">Acted On</div>
          <div className="text-xs text-gray-400 mt-1">This cycle</div>
        </div>
      </div>

      {/* Recommendations list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Cohort Intervention Recommendations</h2>
          <p className="text-xs text-gray-500 mt-0.5">Ranked by projected revenue impact (high to low)</p>
        </div>

        {activeRecs.length === 0 && actedOnRecs.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
            </div>
            <p className="text-gray-500 text-sm">No recommendations yet. Run the data pipeline to generate cohort insights.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {[...activeRecs, ...actedOnRecs].map(rec => {
              const colors = ACTION_COLORS[rec.action_type] ?? ACTION_COLORS['Win-back'];
              const isActedOn = rec.status === 'acted_on';
              const isActing = actingOn.has(rec.id);

              return (
                <li key={rec.id} className={`px-5 py-4 ${isActedOn ? 'bg-gray-50' : ''}`}>
                  <div className="flex items-start gap-4">
                    {/* Action type badge */}
                    <div className="flex-shrink-0 pt-0.5">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${colors.badge}`}>
                        {rec.action_type}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className={`text-sm font-semibold ${isActedOn ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                          {rec.title}
                        </h3>
                        {isActedOn && (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                            </svg>
                            Acted On {rec.acted_on_at ? new Date(rec.acted_on_at).toLocaleDateString() : ''}
                          </span>
                        )}
                      </div>

                      <p className={`text-xs mt-1 ${isActedOn ? 'text-gray-400' : 'text-gray-500'}`}>
                        {rec.description}
                      </p>

                      {/* Revenue impact */}
                      {rec.revenue_impact_low != null && rec.revenue_impact_high != null && (
                        <div className="mt-2 flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
                          </svg>
                          <span className="text-xs font-medium text-emerald-700">
                            {formatRevenue(rec.revenue_impact_low)}–{formatRevenue(rec.revenue_impact_high)} if 30% of cohort converts
                          </span>
                        </div>
                      )}

                      {/* Links */}
                      <div className="mt-2 flex items-center gap-3">
                        <Link
                          href={`/dashboard/cohorts/${rec.cohort_type === 'ml' ? `ml-${rec.cohort_id}` : `rule-${rec.cohort_id}`}`}
                          className="text-xs text-violet-600 hover:text-violet-800 font-medium transition-colors flex items-center gap-1"
                        >
                          View cohort
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                          </svg>
                        </Link>
                        <Link
                          href={`/dashboard/cohorts/${rec.cohort_type === 'ml' ? `ml-${rec.cohort_id}` : `rule-${rec.cohort_id}`}`}
                          className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1"
                        >
                          View forecast
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                          </svg>
                        </Link>
                      </div>
                    </div>

                    {/* Act On button */}
                    <div className="flex-shrink-0">
                      {isActedOn ? (
                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                          <svg className="w-4 h-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleActOn(rec.id)}
                          disabled={isActing}
                          className="px-3 py-1.5 text-xs font-semibold bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                        >
                          {isActing ? 'Saving…' : 'Act On'}
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
