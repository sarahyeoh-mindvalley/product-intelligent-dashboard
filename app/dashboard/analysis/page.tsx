import Link from 'next/link';
import { seedProductDataIfNeeded } from '@/lib/product-data';
import { getPipelineStatus } from '@/lib/pipeline-status';
import DataFreshnessBanner from '@/components/DataFreshnessBanner';
import {
  getCancellationInsights,
  getChurnInsights,
  getRetentionInsights,
  getEVEInsights,
  getActivationInsights,
  getTransformInsights,
  getDemographicInsights,
} from '@/lib/analysis';

export const dynamic = 'force-dynamic';

function fmt(n: number) { return Math.round(n).toLocaleString(); }
function pct(n: number) { return `${Math.round(n)}%`; }

function SectionHeader({ id, num, label, color, sub }: { id: string; num: string; label: string; color: string; sub: string }) {
  return (
    <div id={id} className="scroll-mt-6">
      <div className="flex items-center gap-3 mb-1">
        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${color}`}>{num}</span>
        <h2 className="text-base font-bold text-gray-900">{label}</h2>
      </div>
      <p className="text-sm text-gray-500 ml-10">{sub}</p>
    </div>
  );
}

function StatRow({ label, a, b, aLabel = 'Value', bLabel, aColor = 'text-gray-900', bColor = 'text-gray-900' }: {
  label: string; a: string; b?: string; aLabel?: string; bLabel?: string; aColor?: string; bColor?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <div className="flex items-center gap-6">
        <span className={`text-sm font-bold ${aColor}`}>{a}</span>
        {b !== undefined && <span className={`text-sm font-bold ${bColor}`}>{b}</span>}
      </div>
    </div>
  );
}

function InsightBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-violet-50 border border-violet-200 rounded-lg p-4 text-sm text-violet-800 leading-relaxed">
      {children}
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
            {headers.map(h => (
              <th key={h} className={`py-2 font-medium ${h === headers[0] ? 'text-left' : 'text-right'}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50">
              {row.map((cell, j) => (
                <td key={j} className={`py-2.5 ${j === 0 ? 'text-left font-medium text-gray-700 capitalize' : 'text-right text-gray-600'}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const SECTIONS = [
  { id: 'cancellation', num: '1', label: 'Why people cancelled', color: 'bg-red-500' },
  { id: 'churn', num: '2', label: 'Why people churned', color: 'bg-orange-500' },
  { id: 'retention', num: '3', label: 'Why people retained — and how to keep them', color: 'bg-emerald-500' },
  { id: 'eve', num: '4', label: 'EVE adoption & stickiness', color: 'bg-amber-500' },
  { id: 'activation', num: '5', label: 'How to increase activation', color: 'bg-violet-500' },
  { id: 'transform', num: '6', label: 'How to increase transform rate', color: 'bg-sky-500' },
  { id: 'demographics', num: '7', label: 'Demographics — gender, age & language', color: 'bg-pink-500' },
];

export default function AnalysisPage() {
  seedProductDataIfNeeded();
  const { status, lastRunDate } = getPipelineStatus();

  const cancel = getCancellationInsights();
  const churn = getChurnInsights();
  const retention = getRetentionInsights();
  const eve = getEVEInsights();
  const activation = getActivationInsights();
  const transform = getTransformInsights();
  const demo = getDemographicInsights();

  const active = cancel.statusRows.find(r => r.status === 'active');
  const cancelled = cancel.statusRows.find(r => r.status === 'cancelled');
  const pastDue = cancel.statusRows.find(r => r.status === 'past_due');

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Deep Analysis</h1>
            <p className="text-sm text-gray-500 mt-0.5">Why subscribers cancel, churn, retain, and engage — from the data</p>
          </div>
          <DataFreshnessBanner lastRunDate={lastRunDate} status={status} />
        </div>
      </div>

      <div className="p-6 space-y-8">
        {/* Table of contents */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Jump to</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SECTIONS.map(s => (
              <a key={s.id} href={`#${s.id}`} className="flex items-center gap-2 text-sm text-gray-600 hover:text-violet-700 group">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white ${s.color} flex-shrink-0`}>{s.num}</span>
                <span className="group-hover:underline underline-offset-2">{s.label}</span>
              </a>
            ))}
          </div>
        </div>

        {/* ── 1. CANCELLATION ─────────────────────────────────────────── */}
        <div className="space-y-4">
          <SectionHeader id="cancellation" num="1" label="Why people cancelled" color="bg-red-500"
            sub={`${cancel.cancelled} cancelled · ${cancel.pastDue} past_due · ${pct(cancel.atRiskRate)} of all subscribers at risk`} />

          {/* Active vs cancelled comparison */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Active vs Cancelled — side by side</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                    <th className="text-left py-2 font-medium">Metric</th>
                    <th className="text-right py-2 font-medium text-emerald-600">Active ({fmt(cancel.active)})</th>
                    <th className="text-right py-2 font-medium text-red-500">Cancelled ({fmt(cancel.cancelled)})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[
                    { label: 'Avg tenure', a: active ? `${fmt(active.avg_tenure)}d` : '—', b: cancelled ? `${fmt(cancelled.avg_tenure)}d` : '—' },
                    { label: 'Avg LTV', a: active ? `$${fmt(active.avg_ltv)}` : '—', b: cancelled ? `$${fmt(cancelled.avg_ltv)}` : '—' },
                    { label: 'Login rate', a: active ? pct(active.login_rate) : '—', b: cancelled ? pct(cancelled.login_rate) : '—', bColor: 'text-red-500' },
                    { label: 'Progress rate', a: active ? pct(active.progress_rate) : '—', b: cancelled ? pct(cancelled.progress_rate) : '—', bColor: 'text-red-500' },
                    { label: 'EVE rate', a: active ? pct(active.eve_rate) : '—', b: cancelled ? pct(cancelled.eve_rate) : '—', bColor: 'text-red-500' },
                    { label: 'Avg watch mins', a: active ? fmt(active.avg_watch_mins) : '—', b: cancelled ? fmt(cancelled.avg_watch_mins) : '—', bColor: 'text-red-500' },
                  ].map(row => (
                    <tr key={row.label} className="hover:bg-gray-50">
                      <td className="py-2.5 text-gray-600">{row.label}</td>
                      <td className="py-2.5 text-right font-bold text-emerald-600">{row.a}</td>
                      <td className={`py-2.5 text-right font-bold ${row.bColor ?? 'text-red-500'}`}>{row.b}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Cancelled — when in lifecycle?</h3>
              <Table
                headers={['Tenure at cancel', 'Count']}
                rows={cancel.cancelledByTenure.map(r => [r.tenure_bucket, fmt(r.count)])}
              />
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Cancelled — by tier</h3>
              <Table
                headers={['Tier', 'Count', 'Avg tenure', 'Login %', 'Progress %']}
                rows={cancel.cancelledByTier.map(r => [r.tier, fmt(r.count), `${fmt(r.avg_tenure)}d`, pct(r.login_rate), pct(r.progress_rate)])}
              />
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Cancelled — by acquisition channel</h3>
            <Table
              headers={['Channel', 'Count', 'Avg tenure', 'Progress rate']}
              rows={cancel.cancelledByChannel.map(r => [r.channel, fmt(r.count), `${fmt(r.avg_tenure)}d`, pct(r.progress_rate)])}
            />
          </div>

          <InsightBox>
            <strong>Key finding:</strong> Cancelled subscribers have significantly lower login, progress, and EVE rates than active ones — they disengaged before cancelling.
            Most cancellations happen within the first 90 days. Focus: fix early onboarding to prevent early-lifecycle churn.
            {cancel.cancelledByTenure.find(r => r.tenure_bucket === '0-30d')?.count
              ? ` ${fmt(cancel.cancelledByTenure.find(r => r.tenure_bucket === '0-30d')!.count)} cancelled within the first 30 days.`
              : ''}
          </InsightBox>
        </div>

        <hr className="border-gray-100" />

        {/* ── 2. CHURN ────────────────────────────────────────────────── */}
        <div className="space-y-4">
          <SectionHeader id="churn" num="2" label="Why people churned" color="bg-orange-500"
            sub={`${cancel.pastDue} past_due (payment at risk) + ${cancel.cancelled} cancelled = ${cancel.pastDue + cancel.cancelled} total at-risk`} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Exit stage — where they dropped off</h3>
              <p className="text-xs text-gray-400 mb-3">Last engagement state of cancelled + past_due subscribers</p>
              {churn.exitStage.map(row => {
                const total = churn.exitStage.reduce((s, r) => s + r.count, 0);
                const pctVal = total > 0 ? Math.round((row.count / total) * 100) : 0;
                const barColor = row.exit_stage.startsWith('1') ? 'bg-red-400' : row.exit_stage.startsWith('2') ? 'bg-orange-400' : row.exit_stage.startsWith('3') ? 'bg-yellow-400' : 'bg-emerald-400';
                return (
                  <div key={row.exit_stage} className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-600">{row.exit_stage}</span>
                      <span className="text-sm font-bold text-gray-900">{fmt(row.count)} <span className="text-gray-400 font-normal">({pctVal}%)</span></span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full ${barColor} rounded-full`} style={{ width: `${pctVal}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Early churners (cancelled ≤90d tenure)</h3>
              {churn.earlyChurners && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <span className="text-sm text-gray-600">Count</span>
                    <span className="font-bold text-red-600">{fmt(churn.earlyChurners.count)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600">Avg tenure at cancel</span>
                    <span className="font-bold text-gray-700">{fmt(churn.earlyChurners.avg_tenure)}d</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600">15-day activation rate</span>
                    <span className="font-bold text-red-500">{pct(churn.earlyChurners.activation_rate)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600">Content progress rate</span>
                    <span className="font-bold text-red-500">{pct(churn.earlyChurners.progress_rate)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Churn rate by acquisition channel</h3>
            <p className="text-xs text-gray-400 mb-3">Which channels bring subscribers who stay longest?</p>
            <Table
              headers={['Channel', 'Total', 'Churned', 'Churn rate']}
              rows={churn.churnByChannel.map(r => [r.channel, fmt(r.total), fmt(r.churned), pct(r.churn_rate)])}
            />
          </div>

          <InsightBox>
            <strong>Key finding:</strong> The majority of churned subscribers were in the "never engaged" or "logged in only" stage — they paid but never formed a habit.
            Early churners (≤90d) had low 15-day activation rates, confirming that failing to activate in the first 2 weeks = very high churn probability.
            <strong> Recommendation:</strong> Trigger a day-3, day-7, and day-14 onboarding email sequence for all new subscribers.
          </InsightBox>
        </div>

        <hr className="border-gray-100" />

        {/* ── 3. RETENTION ────────────────────────────────────────────── */}
        <div className="space-y-4">
          <SectionHeader id="retention" num="3" label="Why people retained — and how to keep them" color="bg-emerald-500"
            sub="What long-term active subscribers look like and what keeps them engaged" />

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Engagement by tenure cohort</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                    {['Cohort', 'Count', 'Login %', 'Progress %', 'EVE %', 'Avg watch', 'Avg LTV'].map(h => (
                      <th key={h} className={`py-2 font-medium ${h === 'Cohort' ? 'text-left' : 'text-right'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {retention.retainedVsNew.map(r => (
                    <tr key={r.cohort} className="hover:bg-gray-50">
                      <td className="py-2.5 font-medium text-gray-700">{r.cohort}</td>
                      <td className="py-2.5 text-right text-gray-600">{fmt(r.count)}</td>
                      <td className={`py-2.5 text-right font-bold ${r.login_rate >= 40 ? 'text-emerald-600' : 'text-red-500'}`}>{pct(r.login_rate)}</td>
                      <td className={`py-2.5 text-right font-bold ${r.progress_rate >= 20 ? 'text-emerald-600' : 'text-gray-500'}`}>{pct(r.progress_rate)}</td>
                      <td className="py-2.5 text-right font-bold text-amber-600">{pct(r.eve_rate)}</td>
                      <td className="py-2.5 text-right text-gray-600">{fmt(r.avg_watch_mins)}m</td>
                      <td className="py-2.5 text-right text-gray-600">${fmt(r.avg_ltv)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Engagement ladder of active subscribers</h3>
              <p className="text-xs text-gray-400 mb-3">Longer avg tenure = stronger retention signal</p>
              <Table
                headers={['Segment', 'Count', 'Avg tenure']}
                rows={retention.engagementLadder.map(r => [r.tier_label, fmt(r.count), `${fmt(r.avg_tenure)}d`])}
              />
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Fully engaged subscribers</h3>
              <p className="text-xs text-gray-400 mb-3">Logged in + made progress + used EVE</p>
              {retention.topRetainerProfile && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                    <span className="text-sm text-gray-600">Count</span>
                    <span className="font-bold text-emerald-700">{fmt(retention.topRetainerProfile.count)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                    <span className="text-sm text-gray-600">Avg tenure</span>
                    <span className="font-bold text-emerald-700">{fmt(retention.topRetainerProfile.avg_tenure)}d</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                    <span className="text-sm text-gray-600">Avg LTV</span>
                    <span className="font-bold text-emerald-700">${fmt(retention.topRetainerProfile.avg_ltv)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                    <span className="text-sm text-gray-600">Avg watch mins</span>
                    <span className="font-bold text-emerald-700">{fmt(retention.topRetainerProfile.avg_watch_mins)}m</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Retention by acquisition channel</h3>
            <Table
              headers={['Channel', 'Count', 'Avg tenure', 'Login %', 'Progress %']}
              rows={retention.retainedByChannel.map(r => [r.channel, fmt(r.count), `${fmt(r.avg_tenure)}d`, pct(r.login_rate), pct(r.progress_rate)])}
            />
          </div>

          <InsightBox>
            <strong>Key finding:</strong> Subscribers who do all three — login + progress + EVE — have the longest tenure and highest LTV. Tenure strongly predicts engagement: the longer someone has been subscribed, the more likely they are to log in and progress.
            <strong> How to keep them:</strong> (1) Get new subscribers to their first content progress moment within 15 days. (2) Introduce EVE to users who are already progressing — that combination creates your most retained cohort.
          </InsightBox>
        </div>

        <hr className="border-gray-100" />

        {/* ── 4. EVE ADOPTION ─────────────────────────────────────────── */}
        <div className="space-y-4">
          <SectionHeader id="eve" num="4" label="EVE adoption & stickiness" color="bg-amber-500"
            sub="Who uses EVE, who becomes a repeat user, and what drives it" />

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">EVE segment comparison</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                    {['Segment', 'Count', 'Avg tenure', 'Login %', 'Progress %', 'Avg watch', 'Avg LTV'].map(h => (
                      <th key={h} className={`py-2 font-medium ${h === 'Segment' ? 'text-left' : 'text-right'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {eve.eveSegments.map(r => (
                    <tr key={r.segment} className="hover:bg-gray-50">
                      <td className="py-2.5 font-medium text-gray-700">{r.segment}</td>
                      <td className="py-2.5 text-right text-gray-600">{fmt(r.count)}</td>
                      <td className="py-2.5 text-right text-gray-600">{fmt(r.avg_tenure)}d</td>
                      <td className={`py-2.5 text-right font-bold ${r.login_rate >= 40 ? 'text-emerald-600' : 'text-gray-500'}`}>{pct(r.login_rate)}</td>
                      <td className={`py-2.5 text-right font-bold ${r.progress_rate >= 20 ? 'text-emerald-600' : 'text-gray-500'}`}>{pct(r.progress_rate)}</td>
                      <td className="py-2.5 text-right text-gray-600">{fmt(r.avg_watch_mins)}m</td>
                      <td className="py-2.5 text-right text-gray-600">${fmt(r.avg_ltv)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">EVE adoption by tenure band</h3>
              <p className="text-xs text-gray-400 mb-3">Longer subscribers adopt EVE more</p>
              <Table
                headers={['Tenure', 'Total', 'EVE users', 'Rate']}
                rows={eve.eveByTenure.map(r => [r.tenure_band, fmt(r.total), fmt(r.eve_users), pct(r.adoption_rate)])}
              />
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Repeat EVE rate by tier</h3>
              <p className="text-xs text-gray-400 mb-3">Of EVE users — who becomes repeat?</p>
              <Table
                headers={['Tier', 'EVE users', 'Repeat', 'Repeat rate']}
                rows={eve.repeatByTier.map(r => [r.tier, fmt(r.total), fmt(r.repeat_count), pct(r.repeat_rate_of_eve_users)])}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">EVE adoption by channel</h3>
              <Table
                headers={['Channel', 'Total', 'EVE users', 'Rate']}
                rows={eve.eveByChannel.map(r => [r.channel, fmt(r.total), fmt(r.eve_users), pct(r.adoption_rate)])}
              />
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">EVE adoption by platform</h3>
              <Table
                headers={['Platform', 'Total', 'EVE users', 'Rate']}
                rows={eve.eveByPlatform.map(r => [r.platform, fmt(r.total), fmt(r.eve_users), pct(r.adoption_rate)])}
              />
            </div>
          </div>

          <InsightBox>
            <strong>Who sticks with EVE:</strong> Repeat EVE users have longer tenure, higher LTV, higher content progress rates, and more watch minutes than anyone else.
            EVE adoption increases significantly with tenure — newer subscribers adopt less. <strong>Recommendation:</strong> (1) Don't wait for subscribers to "discover" EVE — introduce it at their first progress milestone (e.g., after completing 20% of a quest). (2) Focus EVE onboarding on your highest-tenure, progress-active subscribers first — they have the highest stickiness.
          </InsightBox>
        </div>

        <hr className="border-gray-100" />

        {/* ── 5. ACTIVATION ───────────────────────────────────────────── */}
        <div className="space-y-4">
          <SectionHeader id="activation" num="5" label="How to increase activation" color="bg-violet-500"
            sub="Who logs in vs who doesn't — and what differentiates them" />

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Logged in vs not logged in — profile comparison</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                    {['Metric', 'Logged in', 'Not logged in'].map(h => (
                      <th key={h} className={`py-2 font-medium ${h === 'Metric' ? 'text-left' : 'text-right'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(() => {
                    const loggedIn = activation.loginComparison.find(r => r.segment === 'Logged in');
                    const notLoggedIn = activation.loginComparison.find(r => r.segment === 'Not logged in');
                    return [
                      { label: 'Count', a: fmt(loggedIn?.count ?? 0), b: fmt(notLoggedIn?.count ?? 0) },
                      { label: 'Avg tenure', a: `${fmt(loggedIn?.avg_tenure ?? 0)}d`, b: `${fmt(notLoggedIn?.avg_tenure ?? 0)}d` },
                      { label: 'Avg LTV', a: `$${fmt(loggedIn?.avg_ltv ?? 0)}`, b: `$${fmt(notLoggedIn?.avg_ltv ?? 0)}` },
                      { label: 'Progress rate', a: pct(loggedIn?.progress_rate ?? 0), b: pct(notLoggedIn?.progress_rate ?? 0) },
                      { label: 'EVE rate', a: pct(loggedIn?.eve_rate ?? 0), b: pct(notLoggedIn?.eve_rate ?? 0) },
                      { label: 'Avg watch mins', a: fmt(loggedIn?.avg_watch_mins ?? 0), b: fmt(notLoggedIn?.avg_watch_mins ?? 0) },
                    ].map(row => (
                      <tr key={row.label} className="hover:bg-gray-50">
                        <td className="py-2.5 text-gray-600">{row.label}</td>
                        <td className="py-2.5 text-right font-bold text-violet-700">{row.a}</td>
                        <td className="py-2.5 text-right font-bold text-gray-400">{row.b}</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Login rate by tier</h3>
              <Table
                headers={['Tier', 'Total', 'Logged in', 'Login rate']}
                rows={activation.loginByTier.map(r => [r.tier, fmt(r.total), fmt(r.logged_in), pct(r.login_rate)])}
              />
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Login rate by tenure</h3>
              <p className="text-xs text-gray-400 mb-3">Longer-tenured = higher login rate?</p>
              <Table
                headers={['Tenure', 'Total', 'Login rate']}
                rows={activation.loginByTenure.map(r => [r.tenure_band, fmt(r.total), pct(r.login_rate)])}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Login rate by acquisition channel</h3>
              <Table
                headers={['Channel', 'Total', 'Logged in', 'Login rate']}
                rows={activation.loginByChannel.map(r => [r.channel, fmt(r.total), fmt(r.logged_in), pct(r.login_rate)])}
              />
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">New subscriber 15d activation by tier</h3>
              <Table
                headers={['Tier', 'New subs', 'Activated', 'Rate']}
                rows={activation.newSubActivation.map(r => [r.tier, fmt(r.new_subs), fmt(r.activated), pct(r.activation_rate)])}
              />
            </div>
          </div>

          <InsightBox>
            <strong>Key finding:</strong> Logged-in subscribers have higher LTV, more progress, more EVE usage, and more watch time. They are your most valuable cohort.
            <strong> How to increase activation:</strong> (1) The biggest gap is non-logged-in subscribers — target with push notifications or email re-engagement campaigns segmented by tier.
            (2) Improve 15-day new subscriber activation with a structured onboarding sequence (day 1 welcome, day 3 first quest prompt, day 7 progress check).
            (3) Check login rate by platform — app vs web — to identify where friction is highest.
          </InsightBox>
        </div>

        <hr className="border-gray-100" />

        {/* ── 6. TRANSFORM ────────────────────────────────────────────── */}
        <div className="space-y-4">
          <SectionHeader id="transform" num="6" label="How to increase transform rate" color="bg-sky-500"
            sub="Who engages deeply with content — and what drives high watch time" />

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Engagement tier profiles</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                    {['Engagement', 'Count', 'Avg tenure', 'EVE %', 'EVE repeat %', 'Avg items', 'Avg watch', 'Avg LTV'].map(h => (
                      <th key={h} className={`py-2 font-medium ${h === 'Engagement' ? 'text-left' : 'text-right'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {transform.engagementTierProfiles.map(r => (
                    <tr key={r.eng_tier} className="hover:bg-gray-50">
                      <td className="py-2.5 font-medium text-gray-700">{r.eng_tier}</td>
                      <td className="py-2.5 text-right text-gray-600">{fmt(r.count)}</td>
                      <td className="py-2.5 text-right text-gray-600">{fmt(r.avg_tenure)}d</td>
                      <td className="py-2.5 text-right font-bold text-amber-600">{pct(r.eve_rate)}</td>
                      <td className="py-2.5 text-right text-gray-600">{pct(r.eve_repeat_rate)}</td>
                      <td className="py-2.5 text-right text-gray-600">{fmt(r.avg_content_items)}</td>
                      <td className="py-2.5 text-right text-gray-600">{fmt(r.avg_watch_mins)}m</td>
                      <td className="py-2.5 text-right text-gray-600">${fmt(r.avg_ltv)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">High engagers by tier</h3>
              <Table
                headers={['Tier', 'Total', 'High engagers', 'Rate']}
                rows={transform.highEngagersByTier.map(r => [r.tier, fmt(r.total), fmt(r.high_engagers), pct(r.high_eng_rate)])}
              />
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Content engagement by tenure</h3>
              <Table
                headers={['Tenure', 'Total', 'Progress %', 'Avg watch']}
                rows={transform.engByTenure.map(r => [r.tenure_band, fmt(r.total), pct(r.progress_rate), `${fmt(r.avg_watch_mins)}m`])}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">EVE × content progress correlation</h3>
              <Table
                headers={['Segment', 'Count', 'Avg watch', 'Avg tenure']}
                rows={transform.eveProgressCorrelation.map(r => [r.segment, fmt(r.count), `${fmt(r.avg_watch_mins)}m`, `${fmt(r.avg_tenure)}d`])}
              />
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">High engagers by channel</h3>
              <Table
                headers={['Channel', 'Total', 'High eng.', 'Rate']}
                rows={transform.highEngagersByChannel.map(r => [r.channel, fmt(r.total), fmt(r.high_engagers), pct(r.high_eng_rate)])}
              />
            </div>
          </div>

          <InsightBox>
            <strong>Who are the high engagers:</strong> High-engagement subscribers (500+ mins) have the longest tenure, highest LTV, highest EVE adoption, and highest EVE repeat rates.
            EVE + progress is the most powerful combination — subscribers doing both watch significantly more content.
            <strong> How to increase transform rate:</strong> (1) Surface EVE to progressing subscribers early — the EVE × progress cohort is your highest-value group.
            (2) Longer-tenured subscribers engage more — early habit formation is critical. (3) Subscribers who log in but don't progress are the highest-leverage group to convert — personalised quest recommendations or push prompts at their last stopping point can move them.
          </InsightBox>
        </div>

        <hr className="border-gray-100" />

        {/* ── 7. DEMOGRAPHICS ─────────────────────────────────────────── */}
        <div className="space-y-4">
          <SectionHeader id="demographics" num="7" label="Demographics — gender, age & language" color="bg-pink-500"
            sub="How gender, age bracket, language, acquisition source and payment method affect engagement and retention" />

          {/* Gender */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Gender breakdown</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                    {['Gender', 'Count', 'Avg tenure', 'Login %', 'Progress %', 'EVE %', 'Avg LTV', 'Churn %'].map(h => (
                      <th key={h} className={`py-2 font-medium ${h === 'Gender' ? 'text-left' : 'text-right'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {demo.byGender.filter(r => r.gender !== 'Not Available').map(r => (
                    <tr key={r.gender} className="hover:bg-gray-50">
                      <td className="py-2.5 font-medium text-gray-700 capitalize">{r.gender.replace('_', ' ')}</td>
                      <td className="py-2.5 text-right text-gray-600">{fmt(r.count)}</td>
                      <td className="py-2.5 text-right text-gray-600">{fmt(r.avg_tenure)}d</td>
                      <td className={`py-2.5 text-right font-bold ${r.login_rate >= 40 ? 'text-emerald-600' : 'text-gray-500'}`}>{pct(r.login_rate)}</td>
                      <td className={`py-2.5 text-right font-bold ${r.progress_rate >= 20 ? 'text-emerald-600' : 'text-gray-500'}`}>{pct(r.progress_rate)}</td>
                      <td className="py-2.5 text-right font-bold text-amber-600">{pct(r.eve_rate)}</td>
                      <td className="py-2.5 text-right text-gray-600">${fmt(r.avg_ltv)}</td>
                      <td className={`py-2.5 text-right font-bold ${r.churn_rate > 8 ? 'text-red-500' : 'text-gray-500'}`}>{pct(r.churn_rate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Gender × EVE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Gender × EVE adoption</h3>
              <Table
                headers={['Gender', 'Total', 'EVE users', 'EVE rate', 'Repeat rate']}
                rows={demo.genderEVE.filter(r => r.gender !== 'Not Available').map(r => [
                  r.gender.replace('_', ' '), fmt(r.total), fmt(r.eve_users), pct(r.eve_rate), pct(r.repeat_rate ?? 0)
                ])}
              />
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Language breakdown</h3>
              <Table
                headers={['Language', 'Count', 'Login %', 'Progress %', 'EVE %', 'Churn %']}
                rows={demo.byLanguage.map(r => [
                  r.language, fmt(r.count), pct(r.login_rate), pct(r.progress_rate), pct(r.eve_rate), pct(r.churn_rate)
                ])}
              />
            </div>
          </div>

          {/* Age bracket */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Age bracket breakdown</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                    {['Age', 'Count', 'Login %', 'Progress %', 'EVE %', 'Avg watch', 'Avg LTV', 'Churn %'].map(h => (
                      <th key={h} className={`py-2 font-medium ${h === 'Age' ? 'text-left' : 'text-right'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {demo.byAge.filter(r => r.age_bracket !== 'Not Available').map(r => (
                    <tr key={r.age_bracket} className="hover:bg-gray-50">
                      <td className="py-2.5 font-medium text-gray-700">{r.age_bracket}</td>
                      <td className="py-2.5 text-right text-gray-600">{fmt(r.count)}</td>
                      <td className={`py-2.5 text-right font-bold ${r.login_rate >= 40 ? 'text-emerald-600' : 'text-gray-500'}`}>{pct(r.login_rate)}</td>
                      <td className={`py-2.5 text-right font-bold ${r.progress_rate >= 20 ? 'text-emerald-600' : 'text-gray-500'}`}>{pct(r.progress_rate)}</td>
                      <td className="py-2.5 text-right font-bold text-amber-600">{pct(r.eve_rate)}</td>
                      <td className="py-2.5 text-right text-gray-600">{fmt(r.avg_watch_mins)}m</td>
                      <td className="py-2.5 text-right text-gray-600">${fmt(r.avg_ltv)}</td>
                      <td className={`py-2.5 text-right font-bold ${r.churn_rate > 8 ? 'text-red-500' : 'text-gray-500'}`}>{pct(r.churn_rate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Acquisition source + payment method */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Acquisition source</h3>
              <p className="text-xs text-gray-400 mb-3">Facebook vs Google vs Instagram etc.</p>
              <Table
                headers={['Source', 'Count', 'Login %', 'Progress %', 'Churn %']}
                rows={demo.byAcqSource.map(r => [r.source, fmt(r.count), pct(r.login_rate), pct(r.progress_rate), pct(r.churn_rate)])}
              />
            </div>
            <div className="space-y-4">
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Payment method</h3>
                <Table
                  headers={['Method', 'Count', 'Login %', 'Avg LTV', 'Churn %']}
                  rows={demo.byPaymentMethod.map(r => [r.method, fmt(r.count), pct(r.login_rate), `$${fmt(r.avg_ltv)}`, pct(r.churn_rate)])}
                />
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Order type</h3>
                <p className="text-xs text-gray-400 mb-3">Upgrades vs Renewals vs New — who retains best?</p>
                <Table
                  headers={['Order type', 'Count', 'Login %', 'Avg LTV', 'Churn %']}
                  rows={demo.byOrderType.map(r => [r.order_type, fmt(r.count), pct(r.login_rate), `$${fmt(r.avg_ltv)}`, pct(r.churn_rate)])}
                />
              </div>
            </div>
          </div>

          <InsightBox>
            <strong>What to watch for in the demographic data:</strong> Age brackets with high EVE adoption but lower progress rates may need better content discovery.
            Language cohorts show how well localized content is driving engagement — lower login rates in non-English languages often signal a content availability gap.
            Acquisition source churn rate reveals which paid channels bring subscribers who actually stick — use this to reallocate ad spend toward higher-retention sources.
            Upgrade and renewal order types typically have the lowest churn — these users have already re-committed once.
          </InsightBox>
        </div>

        {/* Back nav */}
        <div className="flex items-center justify-between pt-2">
          <Link href="/dashboard/insights" className="text-sm text-gray-500 hover:text-gray-700">← Insights</Link>
          <Link href="/dashboard/forecast" className="text-sm text-violet-600 hover:text-violet-800 font-medium">Model the impact in Forecast →</Link>
        </div>
      </div>
    </div>
  );
}
