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

export default function ContentClient({ recommendations, actOnRate, actedOnCount, totalCount }: Props) {
  const [recs, setRecs] = useState<RecommendationRow[]>(recommendations);
  const [actingOn, setActingOn] = useState<Set<number>>(new Set());

  async function handleActOn(id: number) {
    setRecs(prev =>
      prev.map(r =>
        r.id === id ? { ...r, status: 'acted_on' as const, acted_on_at: new Date().toISOString() } : r,
      ),
    );
    setActingOn(prev => new Set(prev).add(id));

    try {
      await fetch(`/api/recommendations/${id}/act`, { method: 'POST' });
    } catch {
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
          <div className="text-2xl font-bold text-blue-700">{actOnRate}%</div>
          <div className="text-sm font-medium text-gray-700 mt-0.5">Act-on Rate</div>
          <div className="text-xs text-gray-400 mt-1">{actedOnCount} of {totalCount} recommendations acted on</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-2xl font-bold text-gray-900">{activeRecs.length}</div>
          <div className="text-sm font-medium text-gray-700 mt-0.5">Content Gaps Identified</div>
          <div className="text-xs text-gray-400 mt-1">Cohorts with unmet content needs</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-2xl font-bold text-emerald-700">{actedOnRecs.length}</div>
          <div className="text-sm font-medium text-gray-700 mt-0.5">Gaps Addressed</div>
          <div className="text-xs text-gray-400 mt-1">This cycle</div>
        </div>
      </div>

      {/* Content gap briefs */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Content Gap Briefs</h2>
          <p className="text-xs text-gray-500 mt-0.5">Cohorts with unmet content needs — ranked by engagement opportunity</p>
        </div>

        {activeRecs.length === 0 && actedOnRecs.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
            </div>
            <p className="text-gray-500 text-sm">No content gaps identified yet. Run the data pipeline to analyse quest completion patterns.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {[...activeRecs, ...actedOnRecs].map(rec => {
              const isActedOn = rec.status === 'acted_on';
              const isActing = actingOn.has(rec.id);

              return (
                <li key={rec.id} className={`px-5 py-4 ${isActedOn ? 'bg-gray-50' : ''}`}>
                  <div className="flex items-start gap-4">
                    {/* Content gap icon */}
                    <div className="flex-shrink-0 pt-0.5">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isActedOn ? 'bg-gray-100' : 'bg-blue-50'}`}>
                        <svg className={`w-4.5 h-4.5 ${isActedOn ? 'text-gray-400' : 'text-blue-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                        </svg>
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 font-medium">
                          Content Gap
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

                      {/* Engagement opportunity */}
                      {rec.engagement_opportunity && (
                        <div className="mt-2 flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                          </svg>
                          <span className="text-xs text-blue-600 font-medium">{rec.engagement_opportunity}</span>
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
                          className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
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
