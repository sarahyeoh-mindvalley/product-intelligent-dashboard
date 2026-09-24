'use client';

import { useState, useMemo } from 'react';

export interface ForecastBaseMetrics {
  active: number;
  loggedIn: number;
  loginRate: number;
  hasProgress: number;
  progressRate: number;
  newSubs: number;
  activation15dRate: number;
  eveRepeatRate: number;
  habitRate: number;
  deepWatchRate: number;
  monthLabel: string;
}

export interface SegmentBreakdown {
  withProgress: { users: number; avgAnnualSpend: number };
  loggedIn: { users: number; avgAnnualSpend: number };
  newNotActivated: { users: number; avgAnnualSpend: number };
  inactive: { users: number; avgAnnualSpend: number };
}

// Churn rate assumptions by engagement stage (annual)
const CHURN = {
  newSubNotActivated: 0.70, // new subscriber, no content progress within 15d
  inactive: 0.55,           // not logged in (established subscriber)
  loggedIn: 0.25,           // logged in but no progress
  withProgress: 0.08,       // made content progress
  deepEngaged: 0.06,        // 120+ min/month watch time — deep value realisation
  habitFormed: 0.04,        // 3+ consecutive months of progress — formed learning habit
  eveRepeat: 0.03,          // repeat EVE user — AI-assisted learning habit
};

function fmt(n: number) { return Math.round(n).toLocaleString(); }
function fmtDollar(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}

interface Lever {
  id: string;
  label: string;
  sublabel: string;
  color: string;
  trackColor: string;
  thumbColor: string;
  current: number;
  unit: string;
  max: number;
  step: number;
}

interface LeverResult {
  id: string;
  label: string;
  color: string;
  additionalUsers: number;
  usersRetained: number;
  annualRevenue: number;
}

const SEGMENT_DEFS = [
  {
    key: 'withProgress' as const,
    label: 'Transform',
    description: '4+ content views or used EVE this month',
    churn: 0.08,
    color: 'text-sky-700',
    badgeBg: 'bg-sky-50',
    badgeText: 'text-sky-700',
    churnColor: 'text-sky-600',
  },
  {
    key: 'loggedIn' as const,
    label: 'Logged In',
    description: 'Logged in, fewer than 4 content views',
    churn: 0.25,
    color: 'text-violet-700',
    badgeBg: 'bg-violet-50',
    badgeText: 'text-violet-700',
    churnColor: 'text-orange-500',
  },
  {
    key: 'inactive' as const,
    label: 'Inactive',
    description: 'Active subscription, not logged in this month',
    churn: 0.55,
    color: 'text-gray-600',
    badgeBg: 'bg-gray-50',
    badgeText: 'text-gray-600',
    churnColor: 'text-red-500',
  },
];

function SegmentRevenueTable({ segments }: { segments: SegmentBreakdown }) {
  const rows = SEGMENT_DEFS.map(def => {
    const { users, avgAnnualSpend } = segments[def.key];
    const annualRevenue = users * avgAnnualSpend;
    const retainedRevenue = users * (1 - def.churn) * avgAnnualSpend;
    const atRiskRevenue = users * def.churn * avgAnnualSpend;
    return { ...def, users, avgAnnualSpend, annualRevenue, retainedRevenue, atRiskRevenue };
  });

  const totalRevenue = rows.reduce((s, r) => s + r.annualRevenue, 0);
  const totalRetained = rows.reduce((s, r) => s + r.retainedRevenue, 0);
  const totalAtRisk = rows.reduce((s, r) => s + r.atRiskRevenue, 0);

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-gray-900">Current Revenue by Engagement Segment</h2>
          <p className="text-xs text-gray-400 mt-0.5">Annual spend × retention rate — based on current subscription price per engagement stage</p>
        </div>
        <div className="text-right hidden sm:block">
          <div className="text-xs text-gray-400">Total at risk / year</div>
          <div className="text-lg font-bold text-red-600">{fmtDollar(totalAtRisk)}</div>
        </div>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 divide-x divide-gray-100 bg-gray-50 border-b border-gray-100">
        <div className="px-4 py-3 text-center">
          <div className="text-xs text-gray-400 mb-0.5">Total annual revenue</div>
          <div className="text-base font-bold text-gray-800">{fmtDollar(totalRevenue)}</div>
        </div>
        <div className="px-4 py-3 text-center">
          <div className="text-xs text-gray-400 mb-0.5">Retained (expected)</div>
          <div className="text-base font-bold text-emerald-600">{fmtDollar(totalRetained)}</div>
        </div>
        <div className="px-4 py-3 text-center">
          <div className="text-xs text-gray-400 mb-0.5">At risk from churn</div>
          <div className="text-base font-bold text-red-600">{fmtDollar(totalAtRisk)}</div>
        </div>
      </div>

      {/* Segment rows */}
      <div className="divide-y divide-gray-50">
        {rows.map(row => {
          const retainedPct = row.annualRevenue > 0 ? Math.round((row.retainedRevenue / row.annualRevenue) * 100) : 0;
          return (
            <div key={row.key} className="px-5 py-3 flex items-center gap-4">
              {/* Label */}
              <div className="w-40 flex-shrink-0">
                <div className={`text-xs font-semibold ${row.color}`}>{row.label}</div>
                <div className="text-xs text-gray-400 mt-0.5 leading-tight">{row.description}</div>
              </div>

              {/* Users + churn */}
              <div className="w-24 flex-shrink-0">
                <div className="text-sm font-semibold text-gray-800">{fmt(row.users)}</div>
                <div className={`text-xs font-medium ${row.churnColor}`}>{Math.round(row.churn * 100)}% churn</div>
              </div>

              {/* Bar + retained pct */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-400"
                      style={{ width: `${retainedPct}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-8 text-right flex-shrink-0">{retainedPct}%</span>
                </div>
              </div>

              {/* Revenue numbers */}
              <div className="text-right flex-shrink-0 space-y-0.5">
                <div className="text-xs text-emerald-600 font-semibold">{fmtDollar(row.retainedRevenue)}<span className="text-gray-400 font-normal"> kept</span></div>
                <div className="text-xs text-red-500">{fmtDollar(row.atRiskRevenue)}<span className="text-gray-400"> at risk</span></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ForecastSimulator({ base, segments }: { base: ForecastBaseMetrics; segments: SegmentBreakdown }) {
  const [deltas, setDeltas] = useState({ login: 0, progress: 0, deepWatch: 0, habit: 0, eveRepeat: 0 });

  const levers: Lever[] = [
    {
      id: 'login',
      label: 'Login Rate',
      sublabel: `Currently ${base.loginRate}% — lift % of active subscribers who log in monthly`,
      color: 'text-violet-700',
      trackColor: 'accent-violet-500',
      thumbColor: 'bg-violet-500',
      current: base.loginRate,
      unit: 'pp',
      max: Math.min(30, 100 - base.loginRate),
      step: 1,
    },
    {
      id: 'progress',
      label: 'Transform Rate (4+ content views)',
      sublabel: `Currently ${base.progressRate}% — lift % of active subscribers reaching 4+ content interactions`,
      color: 'text-emerald-700',
      trackColor: 'accent-emerald-500',
      thumbColor: 'bg-emerald-500',
      current: base.progressRate,
      unit: 'pp',
      max: Math.min(25, 100 - base.progressRate),
      step: 1,
    },
    {
      id: 'deepWatch',
      label: 'Deep Watch Sessions (≥120 min/mo)',
      sublabel: `Currently ${base.deepWatchRate}% watch 120+ min/month — deep content consumption signals high value realisation`,
      color: 'text-teal-700',
      trackColor: 'accent-teal-500',
      thumbColor: 'bg-teal-500',
      current: base.deepWatchRate,
      unit: 'pp',
      max: Math.min(20, 100 - base.deepWatchRate),
      step: 1,
    },
    {
      id: 'habit',
      label: 'Learning Habit Formation (3+ months)',
      sublabel: `Currently ${base.habitRate}% have made progress for 3+ consecutive months — habit-formed learners rarely churn`,
      color: 'text-indigo-700',
      trackColor: 'accent-indigo-500',
      thumbColor: 'bg-indigo-500',
      current: base.habitRate,
      unit: 'pp',
      max: Math.min(25, 100 - base.habitRate),
      step: 1,
    },
    {
      id: 'eveRepeat',
      label: 'EVE Repeat Usage',
      sublabel: `Currently ${base.eveRepeatRate}% use EVE multiple times/month — AI-assisted learning habit is the strongest retention signal`,
      color: 'text-amber-700',
      trackColor: 'accent-amber-500',
      thumbColor: 'bg-amber-500',
      current: base.eveRepeatRate,
      unit: 'pp',
      max: Math.min(30, 100 - base.eveRepeatRate),
      step: 1,
    },
  ];

  const results = useMemo<LeverResult[]>(() => {
    // Revenue uses each segment's avg annual spend
    const loginAdditional = (deltas.login / 100) * base.active;
    const loginRetained = loginAdditional * (CHURN.inactive - CHURN.loggedIn);
    const loginRevenue = loginRetained * segments.loggedIn.avgAnnualSpend;

    const progressAdditional = (deltas.progress / 100) * base.active;
    const progressRetained = progressAdditional * (CHURN.loggedIn - CHURN.withProgress);
    const progressRevenue = progressRetained * segments.withProgress.avgAnnualSpend;

    // Levers 4–6 upgrade users within "with progress" to deeper engagement states
    const deepWatchAdditional = (deltas.deepWatch / 100) * base.active;
    const deepWatchRetained = deepWatchAdditional * (CHURN.withProgress - CHURN.deepEngaged);
    const deepWatchRevenue = deepWatchRetained * segments.withProgress.avgAnnualSpend;

    const habitAdditional = (deltas.habit / 100) * base.active;
    const habitRetained = habitAdditional * (CHURN.withProgress - CHURN.habitFormed);
    const habitRevenue = habitRetained * segments.withProgress.avgAnnualSpend;

    const eveRepeatAdditional = (deltas.eveRepeat / 100) * base.active;
    const eveRepeatRetained = eveRepeatAdditional * (CHURN.withProgress - CHURN.eveRepeat);
    const eveRepeatRevenue = eveRepeatRetained * segments.withProgress.avgAnnualSpend;

    return [
      { id: 'login', label: 'Login Rate', color: 'text-violet-700', additionalUsers: loginAdditional, usersRetained: loginRetained, annualRevenue: loginRevenue },
      { id: 'progress', label: 'Content Progress', color: 'text-emerald-700', additionalUsers: progressAdditional, usersRetained: progressRetained, annualRevenue: progressRevenue },
      { id: 'deepWatch', label: 'Deep Watch Sessions', color: 'text-teal-700', additionalUsers: deepWatchAdditional, usersRetained: deepWatchRetained, annualRevenue: deepWatchRevenue },
      { id: 'habit', label: 'Learning Habit', color: 'text-indigo-700', additionalUsers: habitAdditional, usersRetained: habitRetained, annualRevenue: habitRevenue },
      { id: 'eveRepeat', label: 'EVE Repeat Usage', color: 'text-amber-700', additionalUsers: eveRepeatAdditional, usersRetained: eveRepeatRetained, annualRevenue: eveRepeatRevenue },
    ];
  }, [deltas, base, segments]);

  const totalRetained = results.reduce((s, r) => s + r.usersRetained, 0);
  const totalRevenue = results.reduce((s, r) => s + r.annualRevenue, 0);
  const anyActive = Object.values(deltas).some(v => v > 0);

  function setDelta(id: string, val: number) {
    setDeltas(prev => ({ ...prev, [id]: val }));
  }

  const leverDelta: Record<string, number> = {
    login: deltas.login,
    progress: deltas.progress,
    deepWatch: deltas.deepWatch,
    habit: deltas.habit,
    eveRepeat: deltas.eveRepeat,
  };

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className={`rounded-xl border p-5 transition-all ${anyActive ? 'bg-violet-50 border-violet-200' : 'bg-gray-50 border-gray-200'}`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Projected Impact — Combined Levers
            </div>
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className={`text-4xl font-bold ${anyActive ? 'text-violet-700' : 'text-gray-300'}`}>
                {fmtDollar(totalRevenue)}
              </span>
              <span className="text-sm text-gray-500">annual revenue retained</span>
              {anyActive && (
                <span className="text-sm font-medium text-emerald-600">
                  +{fmt(totalRetained)} subscribers saved from churn
                </span>
              )}
            </div>
          </div>
          {!anyActive && (
            <p className="text-sm text-gray-400 italic">Move the sliders below to model impact</p>
          )}
        </div>
        {anyActive && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {results.map(r => (
              <div key={r.id} className="bg-white rounded-lg p-3 border border-gray-100">
                <div className={`text-xs font-semibold uppercase tracking-wide ${r.color} mb-1`}>{r.label}</div>
                <div className={`text-xl font-bold ${r.annualRevenue > 0 ? r.color : 'text-gray-300'}`}>
                  {fmtDollar(r.annualRevenue)}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {r.usersRetained >= 0.1 ? `~${fmt(r.usersRetained)} users saved` : 'no impact'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Current revenue by engagement segment */}
      <SegmentRevenueTable segments={segments} />

      {/* Levers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {levers.map(lever => {
          const delta = leverDelta[lever.id];
          const result = results.find(r => r.id === lever.id)!;
          const newRate = lever.current + delta;

          return (
            <div key={lever.id} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className={`text-sm font-semibold ${lever.color}`}>{lever.label}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{lever.sublabel}</div>
                </div>
                <div className="text-right ml-4 flex-shrink-0">
                  <div className={`text-2xl font-bold ${delta > 0 ? lever.color : 'text-gray-300'}`}>
                    {delta > 0 ? `+${delta}pp` : '—'}
                  </div>
                  {delta > 0 && (
                    <div className="text-xs text-gray-400">{lever.current}% → {newRate}%</div>
                  )}
                </div>
              </div>

              {/* Slider */}
              <div className="mt-4 mb-4">
                <input
                  type="range"
                  min={0}
                  max={lever.max}
                  step={lever.step}
                  value={delta}
                  onChange={e => setDelta(lever.id, Number(e.target.value))}
                  className={`w-full h-2 rounded-full appearance-none cursor-pointer bg-gray-100 ${lever.trackColor}`}
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>No change</span>
                  <span>+{lever.max}pp</span>
                </div>
              </div>

              {/* Impact breakdown */}
              {delta > 0 ? (
                <div className="mt-3 pt-3 border-t border-gray-50 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className={`text-base font-bold ${lever.color}`}>+{fmt(result.additionalUsers)}</div>
                    <div className="text-xs text-gray-400">additional users</div>
                  </div>
                  <div>
                    <div className="text-base font-bold text-emerald-600">~{fmt(result.usersRetained)}</div>
                    <div className="text-xs text-gray-400">saved/year</div>
                  </div>
                  <div>
                    <div className={`text-base font-bold ${lever.color}`}>{fmtDollar(result.annualRevenue)}</div>
                    <div className="text-xs text-gray-400">revenue/year</div>
                  </div>
                </div>
              ) : (
                <div className="mt-3 pt-3 border-t border-gray-50 text-xs text-gray-400 text-center">
                  Drag slider to model impact
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Assumptions */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Model Assumptions</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-gray-500">
          <div>
            <div className="font-medium text-gray-600 mb-1.5">Annual churn rate by engagement stage</div>
            <ul className="space-y-1">
              <li className="flex justify-between"><span>Not logged in</span><span className="font-mono text-red-500">55%</span></li>
              <li className="flex justify-between"><span>Logged in, no progress</span><span className="font-mono text-orange-500">25%</span></li>
              <li className="flex justify-between"><span>With content progress</span><span className="font-mono text-emerald-600">8%</span></li>
              <li className="flex justify-between"><span>Deep watch (120+ min/mo)</span><span className="font-mono text-teal-600">6%</span></li>
              <li className="flex justify-between"><span>Learning habit (3+ months)</span><span className="font-mono text-indigo-600">4%</span></li>
              <li className="flex justify-between"><span>EVE repeat user</span><span className="font-mono text-amber-600">3%</span></li>
            </ul>
          </div>
          <div>
            <div className="font-medium text-gray-600 mb-1.5">Revenue model</div>
            <ul className="space-y-1">
              <li className="flex justify-between"><span>Base: active subscribers</span><span className="font-mono">{fmt(base.active)}</span></li>
              <li className="flex justify-between"><span>Base month</span><span className="font-mono">{base.monthLabel}</span></li>
              <li className="flex justify-between"><span>Revenue basis</span><span className="font-mono text-xs">Avg annual spend per segment</span></li>
              <li className="flex justify-between mt-2 pt-2 border-t border-gray-200"><span className="text-gray-400 italic" style={{fontSize: '0.68rem'}}>Churn rates are model estimates based on SaaS subscription research. Validate against actual cohort churn data.</span></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
