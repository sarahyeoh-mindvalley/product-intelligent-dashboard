'use client';

import { useState } from 'react';
import type { CohortForecasts, ConfidenceLevel, ForecastSignal } from '@/lib/forecasting';

// ---------------------------------------------------------------------------
// Confidence badge
// ---------------------------------------------------------------------------

function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  const styles: Record<ConfidenceLevel, string> = {
    High: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    Medium: 'bg-amber-100 text-amber-700 border border-amber-200',
    Low: 'bg-rose-100 text-rose-700 border border-rose-200',
    'too-small': 'bg-gray-100 text-gray-500 border border-gray-200',
  };

  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[level]}`}>
      {level === 'too-small' ? 'Too small' : `${level} confidence`}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Expandable forecast card
// ---------------------------------------------------------------------------

interface ForecastCardProps {
  icon: React.ReactNode;
  title: string;
  value: React.ReactNode;
  confidence: ConfidenceLevel;
  signals: ForecastSignal[];
  accent?: string; // Tailwind border/bg color class
}

function ForecastCard({ icon, title, value, confidence, signals, accent = 'border-violet-200' }: ForecastCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`bg-white border rounded-xl overflow-hidden ${accent}`}>
      <button
        type="button"
        onClick={() => setExpanded(prev => !prev)}
        className="w-full text-left px-5 py-4 flex items-start justify-between gap-4 hover:bg-gray-50/60 transition-colors"
      >
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="mt-0.5 flex-shrink-0 text-violet-500">{icon}</div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">{title}</div>
            <div className="text-base font-semibold text-gray-900">{value}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
          <ConfidenceBadge level={confidence} />
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && signals.length > 0 && (
        <div className="px-5 pb-4 border-t border-gray-100 pt-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Top driving signals</p>
          <ul className="space-y-2">
            {signals.slice(0, 3).map((signal, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="flex-shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full bg-violet-400 mt-1.5" />
                <div>
                  <span className="text-xs font-semibold text-gray-700">{signal.label}: </span>
                  <span className="text-xs text-gray-500">{signal.detail}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trend icon
// ---------------------------------------------------------------------------

function TrendIcon({ trend }: { trend: 'growing' | 'stable' | 'shrinking' }) {
  if (trend === 'growing') {
    return (
      <svg className="w-4 h-4 text-emerald-500 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
      </svg>
    );
  }
  if (trend === 'shrinking') {
    return (
      <svg className="w-4 h-4 text-rose-500 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6L9 12.75l4.306-4.307a11.95 11.95 0 015.814 5.519l2.74 1.22m0 0l-5.94 2.28m5.94-2.28l-2.28-5.941" />
      </svg>
    );
  }
  return (
    <svg className="w-4 h-4 text-gray-400 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main ForecastPanel
// ---------------------------------------------------------------------------

interface Props {
  forecasts: CohortForecasts;
}

export default function ForecastPanel({ forecasts }: Props) {
  if (forecasts.tooSmall) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">Behavior Forecasts</h2>
            <p className="text-xs text-gray-500 mt-0.5">Predictive signals for this cohort</p>
          </div>
        </div>
        <div className="px-5 py-8 text-center">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-gray-700 mb-1">Too small to forecast</p>
          <p className="text-xs text-gray-500 max-w-xs mx-auto">
            This cohort has fewer than 50 members. Forecasting requires at least 50 members to produce
            statistically meaningful predictions.
          </p>
        </div>
      </div>
    );
  }

  const { churn, reengagement, questCompletion, quarterlyTrend } = forecasts;

  const trendColors: Record<string, string> = {
    growing: 'text-emerald-600',
    stable: 'text-gray-600',
    shrinking: 'text-rose-600',
  };

  const trendAccents: Record<string, string> = {
    growing: 'border-emerald-200',
    stable: 'border-gray-200',
    shrinking: 'border-rose-200',
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="font-semibold text-gray-900">Behavior Forecasts</h2>
          <p className="text-xs text-gray-500 mt-0.5">Click any forecast to see the top 3 driving signals</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Refreshed {new Date(forecasts.computedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      <div className="p-5 space-y-3">
        {/* 14-day churn */}
        {churn && (
          <ForecastCard
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
            }
            title="14-Day Churn Probability"
            value={
              <span>
                <span className={churn.probabilityPct >= 60 ? 'text-rose-600' : churn.probabilityPct >= 30 ? 'text-amber-600' : 'text-emerald-600'}>
                  {churn.probabilityPct}%
                </span>
                {' '}
                <span className="text-sm font-normal text-gray-500">likely to disengage within 14 days</span>
              </span>
            }
            confidence={churn.confidence}
            signals={churn.signals}
            accent={churn.probabilityPct >= 60 ? 'border-rose-200' : churn.probabilityPct >= 30 ? 'border-amber-200' : 'border-emerald-200'}
          />
        )}

        {/* 30-day re-engagement */}
        {reengagement && (
          <ForecastCard
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            }
            title="30-Day Re-Engagement Likelihood"
            value={
              <span>
                <span className={reengagement.likelihoodPct >= 60 ? 'text-emerald-600' : reengagement.likelihoodPct >= 30 ? 'text-amber-600' : 'text-rose-600'}>
                  {reengagement.likelihoodPct}%
                </span>
                {' '}
                <span className="text-sm font-normal text-gray-500">likely to re-engage or purchase within 30 days</span>
              </span>
            }
            confidence={reengagement.confidence}
            signals={reengagement.signals}
            accent={reengagement.likelihoodPct >= 60 ? 'border-emerald-200' : reengagement.likelihoodPct >= 30 ? 'border-amber-200' : 'border-rose-200'}
          />
        )}

        {/* Quest completion date range */}
        {questCompletion && (
          questCompletion.hasQuestData ? (
            <ForecastCard
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
                </svg>
              }
              title="Quest Completion Projection"
              value={
                <span>
                  Majority completing in{' '}
                  <span className="text-violet-600">
                    {questCompletion.earliestDays}–{questCompletion.latestDays} days
                  </span>
                </span>
              }
              confidence={questCompletion.confidence}
              signals={questCompletion.signals}
              accent="border-violet-200"
            />
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="text-gray-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
                  </svg>
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Quest Completion Projection</div>
                  <div className="text-sm text-gray-600">
                    Average quest completion is below 20% — not enough progress for a reliable timeline
                  </div>
                </div>
              </div>
            </div>
          )
        )}

        {/* Quarterly trend */}
        {quarterlyTrend && (
          <ForecastCard
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            }
            title="Quarterly Trend"
            value={
              <span className="flex items-center gap-1">
                <TrendIcon trend={quarterlyTrend.trend} />
                <span className={`capitalize ${trendColors[quarterlyTrend.trend]}`}>
                  {quarterlyTrend.trend}
                </span>
                <span className="text-sm font-normal text-gray-500 ml-1">
                  — projected {quarterlyTrend.projectedCount.toLocaleString()} members in 90 days
                </span>
              </span>
            }
            confidence={quarterlyTrend.confidence}
            signals={quarterlyTrend.signals}
            accent={trendAccents[quarterlyTrend.trend]}
          />
        )}
      </div>

      <div className="px-5 pb-4">
        <p className="text-xs text-gray-400">
          Forecasts are computed from live SQLite data on each page load using statistical heuristics.
          Values change as new engagement, quest, and purchase data arrives.
        </p>
      </div>
    </div>
  );
}
