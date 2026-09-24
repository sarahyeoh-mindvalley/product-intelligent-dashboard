'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { FeatureReleaseRow } from '@/lib/db';
import type { RankedPlannedRelease, ForecastAccuracy } from '@/lib/releases';

interface Props {
  pastReleases: FeatureReleaseRow[];
  rankedPlanned: RankedPlannedRelease[];
  accuracy: ForecastAccuracy;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysAgo(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  return Math.round((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function daysFromNow(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  return Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function ImpactBadge({ score }: { score: number }) {
  const abs = Math.abs(score);
  if (abs < 0.5) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
        Neutral
      </span>
    );
  }
  if (score > 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700">
        +{score.toFixed(1)} projected
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700">
      {score.toFixed(1)} projected
    </span>
  );
}

export default function ReleasesClient({ pastReleases, rankedPlanned, accuracy }: Props) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', release_date: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  async function handleAddRelease(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/releases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, status: 'planned' }),
      });
      const data = await res.json();
      if (data.ok) {
        setSuccessMsg(`"${data.release.name}" added. Refresh to see it in the rankings.`);
        setForm({ name: '', description: '', release_date: '' });
        setShowAddForm(false);
      } else {
        setError(data.error ?? 'Failed to add release');
      }
    } catch {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-6 space-y-8">
      {/* Success banner */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-800 text-sm flex items-center justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-600 hover:text-emerald-800 ml-4">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Planned releases — ranked by net cohort impact                      */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Planned Features</h2>
            <p className="text-xs text-gray-500 mt-0.5">Ranked by projected net cohort impact score, highest first</p>
          </div>
          <button
            onClick={() => setShowAddForm(v => !v)}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Planned Release
          </button>
        </div>

        {/* Add form */}
        {showAddForm && (
          <div className="bg-white border border-violet-200 rounded-xl p-5 mb-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">New Planned Feature Release</h3>
            <form onSubmit={handleAddRelease} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Feature Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required
                  placeholder="e.g. Social Learning Rooms"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  required
                  rows={3}
                  placeholder="What does this feature do and who is it for?"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Target Release Date</label>
                <input
                  type="date"
                  value={form.release_date}
                  onChange={e => setForm(f => ({ ...f, release_date: e.target.value }))}
                  required
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              {error && <p className="text-red-600 text-xs">{error}</p>}
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50"
                >
                  {submitting ? 'Adding…' : 'Add Release'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAddForm(false); setError(''); }}
                  className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Forecast accuracy banner */}
        {accuracy.historicalReleaseCount > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5">
            <div className="flex items-start gap-3">
              <svg className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-blue-900">
                  Forecast model: {accuracy.historicalReleaseCount} historical releases · {accuracy.averageAccuracyPct}% average accuracy
                </p>
                <p className="text-xs text-blue-700 mt-0.5">{accuracy.detail}</p>
              </div>
            </div>
          </div>
        )}

        {rankedPlanned.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-10 text-center text-gray-500 text-sm">
            No planned releases yet. Add one above to see forecasted cohort impact rankings.
          </div>
        ) : (
          <div className="space-y-3">
            {rankedPlanned.map((item, idx) => {
              const fromNow = daysFromNow(item.release.release_date);
              return (
                <Link
                  key={item.release.id}
                  href={`/dashboard/releases/${item.release.id}`}
                  className="block bg-white rounded-xl border border-gray-200 px-5 py-4 hover:border-violet-300 hover:shadow-sm transition-all group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-gray-900 group-hover:text-violet-700 transition-colors">
                            {item.release.name}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                            Planned
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{item.release.description}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          Target: {formatDate(item.release.release_date)}
                          {fromNow > 0 ? ` · in ${fromNow} days` : fromNow === 0 ? ' · today' : ` · ${Math.abs(fromNow)} days overdue`}
                        </p>
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <div className="text-xs text-gray-500 mb-1">Net cohort impact</div>
                      <ImpactBadge score={item.netCohortImpactScore} />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Past releases log                                                    */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <div className="mb-4">
          <h2 className="text-base font-semibold text-gray-900">Release Log</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {pastReleases.length} historical releases — click any to see before/after KPI attribution
          </p>
        </div>

        {pastReleases.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-10 text-center text-gray-500 text-sm">
            No past releases found.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <ul className="divide-y divide-gray-100">
              {pastReleases.map(release => {
                const ago = daysAgo(release.release_date);
                return (
                  <li key={release.id}>
                    <Link
                      href={`/dashboard/releases/${release.id}`}
                      className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors group"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-900 group-hover:text-violet-700 transition-colors">
                            {release.name}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                            Released
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{release.description}</p>
                      </div>
                      <div className="flex-shrink-0 flex items-center gap-3 ml-4">
                        <div className="text-right">
                          <div className="text-xs font-medium text-gray-700">{formatDate(release.release_date)}</div>
                          <div className="text-xs text-gray-400">{ago} days ago</div>
                        </div>
                        <svg className="w-4 h-4 text-gray-400 group-hover:text-violet-500 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
