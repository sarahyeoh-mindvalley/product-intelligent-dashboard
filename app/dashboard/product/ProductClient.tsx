'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { RecommendationRow, TopWinRelease } from '@/lib/recommendations';

interface Props {
  recommendations: RecommendationRow[];
  topWins: TopWinRelease[];
  actOnRate: number;
  actedOnCount: number;
  totalCount: number;
}

function formatImpactScore(score: number): string {
  if (Math.abs(score) >= 1000) return `${(score / 1000).toFixed(1)}K`;
  return score.toFixed(1);
}

export default function ProductClient({ recommendations, topWins, actOnRate, actedOnCount, totalCount }: Props) {
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
    <div className="space-y-6">
      {/* Act-on rate metric */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-2xl font-bold text-violet-700">{actOnRate}%</div>
          <div className="text-sm font-medium text-gray-700 mt-0.5">Act-on Rate</div>
          <div className="text-xs text-gray-400 mt-1">{actedOnCount} of {totalCount} recommendations acted on</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-2xl font-bold text-gray-900">{activeRecs.length}</div>
          <div className="text-sm font-medium text-gray-700 mt-0.5">Active Recommendations</div>
          <div className="text-xs text-gray-400 mt-1">Ranked by cohort impact</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-2xl font-bold text-emerald-700">{actedOnRecs.length}</div>
          <div className="text-sm font-medium text-gray-700 mt-0.5">Acted On</div>
          <div className="text-xs text-gray-400 mt-1">This cycle</div>
        </div>
      </div>

      {/* Feature recommendations */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Planned Feature Recommendations</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Ranked by projected cohort impact — top impacted cohort named for each feature
          </p>
        </div>

        {activeRecs.length === 0 && actedOnRecs.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
              </svg>
            </div>
            <p className="text-gray-500 text-sm">
              No feature recommendations yet. Add planned releases to generate cohort impact forecasts.
            </p>
            <Link
              href="/dashboard/releases"
              className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 text-sm font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
            >
              Add planned release
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {[...activeRecs, ...actedOnRecs].map((rec, idx) => {
              const isActedOn = rec.status === 'acted_on';
              const isActing = actingOn.has(rec.id);
              const impactScore = rec.impact_score;

              return (
                <li key={rec.id} className={`px-5 py-4 ${isActedOn ? 'bg-gray-50' : ''}`}>
                  <div className="flex items-start gap-4">
                    {/* Rank badge */}
                    <div className="flex-shrink-0 pt-0.5">
                      <div className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center ${isActedOn ? 'bg-gray-100 text-gray-400' : 'bg-violet-100 text-violet-700'}`}>
                        {idx + 1}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-100 font-medium">
                          {rec.action_type}
                        </span>
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

                      {/* Top impacted cohort + impact score */}
                      <div className="mt-2 flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                          </svg>
                          <span className="text-xs text-gray-600">
                            Top cohort: <span className="font-semibold text-gray-800">{rec.cohort_name}</span>
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                          </svg>
                          <span className="text-xs text-emerald-700 font-medium">
                            Impact score: {formatImpactScore(impactScore)}
                          </span>
                        </div>
                      </div>

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
                          href={rec.release_id ? `/dashboard/releases/${rec.release_id}` : `/dashboard/cohorts/${rec.cohort_type === 'ml' ? `ml-${rec.cohort_id}` : `rule-${rec.cohort_id}`}`}
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

      {/* Top wins from past releases */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Top Wins from Past Releases</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            The 3 releases with the strongest positive cohort impact
          </p>
        </div>

        {topWins.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-500">
            No past releases with cohort impact data yet.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {topWins.map((win, idx) => {
              const releaseDate = new Date(win.releaseDate + 'T00:00:00');
              const daysAgo = Math.round((Date.now() - releaseDate.getTime()) / (1000 * 60 * 60 * 24));
              return (
                <li key={win.releaseId}>
                  <Link
                    href={`/dashboard/releases/${win.releaseId}`}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors group"
                  >
                    {/* Medal rank */}
                    <div className="flex-shrink-0">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                        idx === 1 ? 'bg-gray-100 text-gray-500' :
                        'bg-orange-50 text-orange-600'
                      }`}>
                        {idx + 1}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 group-hover:text-violet-700 transition-colors truncate">
                        {win.releaseName}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-400">{daysAgo}d ago</span>
                        <span className="text-xs text-gray-300">·</span>
                        <span className="text-xs text-gray-500">
                          Top cohort: <span className="font-medium text-gray-700">{win.topCohortName}</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex-shrink-0 text-right">
                      <div className="text-sm font-semibold text-emerald-600">
                        +{formatImpactScore(win.impactScore)}
                      </div>
                      <div className="text-xs text-gray-400">impact score</div>
                    </div>

                    <svg className="w-4 h-4 text-gray-400 group-hover:text-violet-500 flex-shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
