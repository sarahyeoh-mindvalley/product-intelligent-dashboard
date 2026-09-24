'use client';

import { Fragment, useState, useEffect, useCallback, useRef } from 'react';

interface WeekRow {
  week: string;
  weekLabel: string;
  total: number;
  day7LoginPct: number;
  day15ActPct: number;
  day30ActPct: number;
  isMature7: boolean;
  isMature15: boolean;
  isMature30: boolean;
}

interface FilterOptions {
  trafficSources: string[];
  campaignTypes: string[];
  paymentFrequencies: string[];
  devices: string[];
  funnels: string[];
  orderTypes: string[];
  placeInFunnels: string[];
  productTypes: string[];
  productNames: string[];
  countries: string[];
}

interface SegmentRate {
  total: number;
  day15Rate: number;
  prevDay15Rate: number | null;
  prevTotal: number;
}

interface ProductShift {
  productName: string;
  prevShare: number;
  recentShare: number;
  prevDay15: number;
  recentDay15: number;
  recentCount: number;
  prevQuestShare: number;
  recentQuestShare: number;
}

interface SegmentRow {
  label: string;
  total: number;
  day7LoginPct: number | null;
  day15ActPct: number | null;
  baselineTotal: number;
  baselineDay7LoginPct: number | null;
  baselineDay15ActPct: number | null;
  refundRate: number | null;
  baselineRefundRate: number | null;
  firstWeek?: string;
}

interface SegmentGroup {
  dimension: string;
  rows: SegmentRow[];
}

interface DropoffAnalysis {
  weekRange: { min: string; max: string };
  overall: SegmentRate;
  mcFunnel: SegmentRate;
  nonMcFunnel: SegmentRate;
  hasQuest: SegmentRate;
  noQuest: SegmentRate;
  monthlyCustomers: SegmentRate;
  annualCustomers: SegmentRate;
  threeYearCustomers: SegmentRate;
  problemSegment: SegmentRate;
  bestSegment: SegmentRate;
  topProductShifts: ProductShift[];
}

interface ProductLoginData {
  productName: string;
  recentTotal: number;
  recentShare: number;
  day7Rate: number;
  prevDay7Rate: number | null;
  ghostCount: number;
  ghostRate: number;
}

interface DeviceLoginData {
  device: string;
  eligible: number;
  day7Rate: number;
  lateRate: number;
  ghostRate: number;
}

interface PriceBandData {
  label: string;
  eligible: number;
  day7Rate: number;
  lateRate: number;
  ghostRate: number;
}

interface LoginAnalysis {
  weekRange: { min: string; max: string };
  overall: { total: number; day7Rate: number; prevDay7Rate: number | null; prevTotal: number };
  monthlyCustomers: { total: number; day7Rate: number; prevDay7Rate: number | null };
  yearlyCustomers:  { total: number; day7Rate: number; prevDay7Rate: number | null };
  topProducts: ProductLoginData[];
  ghostTotalMature: number;
  lateLoggerMature: number;
  eligibleTotalMature: number;
  deviceBreakdown: DeviceLoginData[];
  priceBreakdown: PriceBandData[];
  lateLoggerTiming: Array<{ bucket: string; count: number }>;
}

type Tab = 'ip' | 'engage' | 'refund' | 'payment';

const PRICE_BUCKETS = [
  { label: 'Any',        min: undefined, max: undefined },
  { label: '$0–$49',     min: 0,   max: 49  },
  { label: '$50–$99',    min: 50,  max: 99  },
  { label: '$100–$199',  min: 100, max: 199 },
  { label: '$200–$299',  min: 200, max: 299 },
  { label: '$300+',      min: 300, max: undefined },
];

const TABS: { id: Tab; label: string; owner: string }[] = [
  { id: 'ip',      label: 'IP Team',     owner: 'Immediate Product' },
  { id: 'engage',  label: 'Engage Team', owner: 'Engagement & Activation' },
  { id: 'refund',  label: 'Refund Rate', owner: 'Finance & Retention' },
  { id: 'payment', label: 'Payment',     owner: 'Finance & Operations' },
];

interface RefundWeekRow {
  week: string;
  weekLabel: string;
  total: number;
  refundCount: number;
  cancelCount: number;
  refundRate: number;
  cancelRate: number;
  isMature: boolean;
}

interface RefundSegment {
  label: string;
  total: number;
  refundRate: number;
  cancelRate: number;
}

interface RefundBreakdown {
  weekRange: { min: string; max: string };
  byPaymentFreq: RefundSegment[];
  byProduct: RefundSegment[];
  byOrderType: RefundSegment[];
  involuntaryRate: number;
}

const METRIC_DEFS: Record<Tab, { key: string; label: string; color: string; definition: string; denominator?: string }[]> = {
  refund: [
    {
      key: 'refundRate',
      label: 'Refund Rate',
      color: '#ef4444',
      definition: 'The share of buyers who received a refund within 15 days of purchase, based on actual refund_timestamp data. Only shown for mature cohorts (22+ days old) where the refund window is complete.',
    },
    {
      key: 'cancelRate',
      label: 'Cancel Rate',
      color: '#f97316',
      definition: 'The share of buyers who cancelled at any point. Includes early and late cancellations. Higher than refund rate as not all cancels result in refunds.',
    },
  ],
  ip: [
    {
      key: 'day7',
      label: 'Day 7 Login %',
      color: '#06b6d4',
      definition: 'The share of all buyers who have logged in at least once within 7 days of purchase, capturing early habit formation.',
    },
  ],
  engage: [
    {
      key: 'day15',
      label: 'Day 15 Activation %',
      color: '#10b981',
      definition: 'The share of all buyers who complete their first meaningful activation event (e.g. quest started, content consumed) within 15 days.',
    },
    {
      key: 'day30',
      label: 'Day 30 Activation %',
      color: '#f59e0b',
      definition: 'The share of all buyers who complete their first activation event within 30 days — the primary long-window engagement signal.',
    },
  ],
  payment: [
    {
      key: 'day7',
      label: 'Day 7 Login %',
      color: '#6366f1',
      definition: 'Share of buyers who logged in within 7 days, by payment processor.',
    },
    {
      key: 'refundRate',
      label: 'Refund Rate',
      color: '#ef4444',
      definition: 'Share of buyers who received a refund within 15 days, by payment processor.',
    },
  ],
};

const IP_LINES = [
  { key: 'day7LoginPct' as const, label: 'Day 7 Login', color: '#06b6d4', dash: '' },
];
const ENGAGE_LINES = [
  { key: 'day15ActPct' as const, label: 'Day 15 Activation', color: '#10b981', dash: '3 3'     },
  { key: 'day30ActPct' as const, label: 'Day 30 Activation', color: '#f59e0b', dash: '8 3 2 3' },
];

// ---------------------------------------------------------------------------
// Trend chart
// ---------------------------------------------------------------------------

type LineSpec = { key: keyof WeekRow; label: string; color: string; dash: string };

function TrendChart({ weeks, lines, loading }: { weeks: WeekRow[]; lines: LineSpec[]; loading: boolean }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartW, setChartW] = useState(800);
  const [tooltip, setTooltip] = useState<{ x: number; week: WeekRow } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(e => setChartW(e[0].contentRect.width));
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const PAD = { top: 16, right: 64, bottom: 48, left: 40 };
  const H = 220;
  const W = chartW;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const n = weeks.length;

  const Y_MIN = 50;
  const Y_MAX = 100;
  const xOf = (i: number) => PAD.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const yOf = (v: number) => PAD.top + innerH - ((Math.max(Y_MIN, v) - Y_MIN) / (Y_MAX - Y_MIN)) * innerH;

  const yTicks = [50, 60, 70, 80, 90, 100];
  const step = Math.max(1, Math.round(n / 7));
  const xLabels = weeks.map((w, i) => ({ i, label: w.weekLabel })).filter((_, i) => i % step === 0 || i === n - 1);

  // Right Y-axis — cohort size
  const maxTotal = Math.max(...weeks.map(w => w.total), 1);
  const rightYOf = (v: number) => PAD.top + innerH - (v / maxTotal) * innerH;
  const fmtCount = (v: number) => v >= 1000 ? `${+(v / 1000).toFixed(1)}k` : String(v);
  const rightTicks = [0, Math.round(maxTotal / 2), maxTotal];
  const RX = W - PAD.right; // x-position of right axis line
  const barW = Math.max(3, Math.round(innerW / Math.max(n, 1)) - 3);

  function pathFor(key: keyof WeekRow) {
    if (n === 0) return '';
    return weeks.map((w, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(w[key] as number).toFixed(1)}`).join(' ');
  }

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || n === 0) return;
    const mx = e.clientX - rect.left - PAD.left;
    const idx = Math.max(0, Math.min(n - 1, Math.round((mx / innerW) * (n - 1))));
    setTooltip({ x: xOf(idx), week: weeks[idx] });
  }

  return (
    <div ref={containerRef} className="relative w-full">
      {loading ? (
        <div className="h-[220px] flex items-center justify-center">
          <div className="w-7 h-7 rounded-full border-2 border-violet-200 border-t-violet-600 animate-spin" />
        </div>
      ) : n === 0 ? (
        <div className="h-[220px] flex items-center justify-center text-sm text-gray-400">No data</div>
      ) : (
        <svg ref={svgRef} width={W} height={H} className="w-full"
          onMouseMove={handleMouseMove} onMouseLeave={() => setTooltip(null)}>
          {/* Grid */}
          {yTicks.map(v => (
            <g key={v}>
              <line x1={PAD.left} y1={yOf(v)} x2={W - PAD.right} y2={yOf(v)} stroke="#f3f4f6" strokeWidth={v === 50 ? 1.5 : 1} />
              <text x={PAD.left - 6} y={yOf(v) + 4} fontSize={10} fill="#9ca3af" textAnchor="end">{v}%</text>
            </g>
          ))}
          {/* Right Y-axis — cohort size */}
          <line x1={RX} y1={PAD.top} x2={RX} y2={PAD.top + innerH} stroke="#e0e7ff" strokeWidth={1} />
          {rightTicks.map(v => (
            <g key={v}>
              <line x1={RX} y1={rightYOf(v)} x2={RX + 4} y2={rightYOf(v)} stroke="#818cf8" strokeWidth={1} />
              <text x={RX + 7} y={rightYOf(v) + 4} fontSize={10} fill="#6366f1" textAnchor="start" fontWeight={v === maxTotal ? '600' : 'normal'}>{fmtCount(v)}</text>
            </g>
          ))}
          <text
            x={RX + 7} y={PAD.top - 4}
            fontSize={9} fill="#a5b4fc" textAnchor="start" letterSpacing="0.5"
          >users</text>
          {xLabels.map(({ i, label }) => (
            <text key={i} x={xOf(i)} y={H - 8} fontSize={10} fill="#9ca3af" textAnchor="middle">{label}</text>
          ))}
          {/* Maturing region */}
          {(() => { const fi = weeks.findIndex(w => !w.isMature15); return fi >= 0 ? (
            <rect x={xOf(fi)} y={PAD.top} width={W - PAD.right - xOf(fi)} height={innerH} fill="#f5f3ff" opacity={0.5} />
          ) : null; })()}
          {/* Volume bars — scaled to right Y-axis */}
          {weeks.map((w, i) => {
            const bh = Math.max(1, (w.total / maxTotal) * innerH);
            return (
              <rect key={i}
                x={xOf(i) - barW / 2}
                y={PAD.top + innerH - bh}
                width={barW}
                height={bh}
                fill="#c7d2fe"
                opacity={0.55}
                rx={1.5}
              />
            );
          })}
          {/* Lines */}
          {lines.map(l => (
            <path key={l.key} d={pathFor(l.key)} fill="none" stroke={l.color} strokeWidth={2.5}
              strokeDasharray={l.dash} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {/* Hover */}
          {tooltip && <>
            <line x1={tooltip.x} y1={PAD.top} x2={tooltip.x} y2={H - PAD.bottom} stroke="#e5e7eb" strokeWidth={1} strokeDasharray="4 2" />
            {lines.map(l => (
              <circle key={l.key} cx={tooltip.x} cy={yOf(tooltip.week[l.key] as number)}
                r={4} fill={l.color} stroke="white" strokeWidth={1.5} />
            ))}
          </>}
        </svg>
      )}

      {/* Tooltip */}
      {tooltip && (
        <div className="pointer-events-none absolute z-10 bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs min-w-[160px]"
          style={{ left: tooltip.x + 40 > chartW * 0.6 ? tooltip.x - 170 : tooltip.x + 16, top: 16 }}>
          <div className="font-semibold text-gray-800 mb-2">{tooltip.week.weekLabel}</div>
          <div className="flex items-center justify-between gap-3 py-0.5 border-b border-gray-100 mb-1 pb-2">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-2.5 rounded-sm inline-block bg-indigo-200" />
              <span className="text-gray-600">Cohort size</span>
            </div>
            <span className="font-bold text-indigo-500">{tooltip.week.total.toLocaleString()}</span>
          </div>
          {lines.map(l => (
            <div key={l.key} className="flex items-center justify-between gap-3 py-0.5">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 rounded inline-block" style={{ backgroundColor: l.color }} />
                <span className="text-gray-600">{l.label}</span>
              </div>
              <span className="font-bold" style={{ color: l.color }}>{tooltip.week[l.key] as number}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Refund chart
// ---------------------------------------------------------------------------

function RefundChart({ weeks, loading }: { weeks: RefundWeekRow[]; loading: boolean }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartW, setChartW] = useState(800);
  const [tooltip, setTooltip] = useState<{ x: number; week: RefundWeekRow } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(e => setChartW(e[0].contentRect.width));
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const PAD = { top: 16, right: 64, bottom: 48, left: 44 };
  const H = 220;
  const W = chartW;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const n = weeks.length;

  const maxRate = Math.max(...weeks.map(w => Math.max(w.refundRate, w.cancelRate)), 5);
  const yMax = Math.ceil(maxRate / 5) * 5;
  const xOf = (i: number) => PAD.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const yOf = (v: number) => PAD.top + innerH - (v / yMax) * innerH;
  const yTicks = Array.from({ length: 5 }, (_, i) => Math.round(yMax / 4 * i));
  const step = Math.max(1, Math.round(n / 7));
  const xLabels = weeks.map((w, i) => ({ i, label: w.weekLabel })).filter((_, i) => i % step === 0 || i === n - 1);
  const pathFor = (key: 'refundRate' | 'cancelRate') =>
    n === 0 ? '' : weeks.map((w, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(w[key]).toFixed(1)}`).join(' ');
  const maxVol = Math.max(...weeks.map(w => w.total), 1);
  const barW = Math.max(3, Math.round(innerW / Math.max(n, 1)) - 3);
  const RX = W - PAD.right;
  const rightYOf = (v: number) => PAD.top + innerH - (v / maxVol) * innerH;
  const fmtCount = (v: number) => v >= 1000 ? `${+(v / 1000).toFixed(1)}k` : String(v);
  const rightTicks = [0, Math.round(maxVol / 2), maxVol];

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || n === 0) return;
    const mx = e.clientX - rect.left - PAD.left;
    const idx = Math.max(0, Math.min(n - 1, Math.round((mx / innerW) * (n - 1))));
    setTooltip({ x: xOf(idx), week: weeks[idx] });
  }

  return (
    <div ref={containerRef} className="relative w-full">
      {loading ? (
        <div className="h-[220px] flex items-center justify-center">
          <div className="w-7 h-7 rounded-full border-2 border-violet-200 border-t-violet-600 animate-spin" />
        </div>
      ) : n === 0 ? (
        <div className="h-[220px] flex items-center justify-center text-sm text-gray-400">No data</div>
      ) : (
        <svg ref={svgRef} width={W} height={H} className="w-full"
          onMouseMove={handleMouseMove} onMouseLeave={() => setTooltip(null)}>
          {/* Grid */}
          {yTicks.map(v => (
            <g key={v}>
              <line x1={PAD.left} y1={yOf(v)} x2={W - PAD.right} y2={yOf(v)} stroke="#f3f4f6" strokeWidth={1} />
              <text x={PAD.left - 6} y={yOf(v) + 4} fontSize={10} fill="#9ca3af" textAnchor="end">{v}%</text>
            </g>
          ))}
          {/* Right Y-axis */}
          <line x1={RX} y1={PAD.top} x2={RX} y2={PAD.top + innerH} stroke="#e0e7ff" strokeWidth={1} />
          {rightTicks.map(v => (
            <g key={v}>
              <line x1={RX} y1={rightYOf(v)} x2={RX + 4} y2={rightYOf(v)} stroke="#818cf8" strokeWidth={1} />
              <text x={RX + 7} y={rightYOf(v) + 4} fontSize={10} fill="#6366f1" textAnchor="start">{fmtCount(v)}</text>
            </g>
          ))}
          <text x={RX + 7} y={PAD.top - 4} fontSize={9} fill="#a5b4fc" textAnchor="start">users</text>
          {/* Volume bars */}
          {weeks.map((w, i) => {
            const bh = Math.max(1, (w.total / maxVol) * innerH);
            return <rect key={i} x={xOf(i) - barW / 2} y={PAD.top + innerH - bh} width={barW} height={bh} fill="#c7d2fe" opacity={0.5} rx={1.5} />;
          })}
          {/* Immature shading */}
          {(() => { const fi = weeks.findIndex(w => !w.isMature); return fi >= 0 ? (
            <rect x={xOf(fi)} y={PAD.top} width={W - PAD.right - xOf(fi)} height={innerH} fill="#fef2f2" opacity={0.6} />
          ) : null; })()}
          {/* X labels */}
          {xLabels.map(({ i, label }) => (
            <text key={i} x={xOf(i)} y={H - 8} fontSize={10} fill="#9ca3af" textAnchor="middle">{label}</text>
          ))}
          {/* Lines */}
          <path d={pathFor('cancelRate')} fill="none" stroke="#f97316" strokeWidth={2.5} strokeDasharray="6 3" strokeLinejoin="round" strokeLinecap="round" />
          <path d={pathFor('refundRate')} fill="none" stroke="#ef4444" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          {/* Hover crosshair */}
          {tooltip && <>
            <line x1={tooltip.x} y1={PAD.top} x2={tooltip.x} y2={H - PAD.bottom} stroke="#e5e7eb" strokeWidth={1} strokeDasharray="4 2" />
            <circle cx={tooltip.x} cy={yOf(tooltip.week.refundRate)} r={4} fill="#ef4444" stroke="white" strokeWidth={1.5} />
            <circle cx={tooltip.x} cy={yOf(tooltip.week.cancelRate)} r={4} fill="#f97316" stroke="white" strokeWidth={1.5} />
          </>}
        </svg>
      )}

      {/* Tooltip */}
      {tooltip && (
        <div className="pointer-events-none absolute z-10 bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs min-w-[180px]"
          style={{ left: tooltip.x + 40 > chartW * 0.6 ? tooltip.x - 195 : tooltip.x + 16, top: 16 }}>
          <div className="font-semibold text-gray-800 mb-2">{tooltip.week.weekLabel}</div>
          <div className="flex items-center justify-between gap-3 py-0.5 border-b border-gray-100 mb-1 pb-2">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-2.5 rounded-sm inline-block bg-indigo-200" />
              <span className="text-gray-600">Cohort size</span>
            </div>
            <span className="font-bold text-indigo-500">{tooltip.week.total.toLocaleString()}</span>
          </div>
          {[
            { label: 'Refund Rate', value: tooltip.week.refundRate, count: tooltip.week.refundCount, color: '#ef4444' },
            { label: 'Cancel Rate', value: tooltip.week.cancelRate, count: tooltip.week.cancelCount, color: '#f97316' },
          ].map(l => (
            <div key={l.label} className="flex items-center justify-between gap-3 py-0.5">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 rounded inline-block" style={{ backgroundColor: l.color }} />
                <span className="text-gray-600">{l.label}</span>
              </div>
              <div className="text-right">
                <span className="font-bold" style={{ color: l.color }}>{l.value}%</span>
                <span className="text-gray-400 ml-1">({l.count.toLocaleString()})</span>
              </div>
            </div>
          ))}
          {!tooltip.week.isMature && (
            <div className="mt-2 pt-2 border-t border-gray-100 text-[10px] text-red-400">15-day window not complete</div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pctColor(pct: number, lo: number, hi: number) {
  if (pct >= hi) return 'text-emerald-700 font-bold';
  if (pct >= lo) return 'text-amber-600 font-semibold';
  return 'text-red-500 font-semibold';
}

function Bar({ pct, color, mature }: { pct: number; color: string; mature: boolean }) {
  return (
    <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: mature ? color : '#d1d5db' }} />
    </div>
  );
}

function SelectFilter({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-400 min-w-[140px]">
        <option value="">All</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Segment comparison table
// ---------------------------------------------------------------------------

function rateColor(pct: number, lo: number, hi: number) {
  if (pct >= hi) return { text: 'text-emerald-700 font-semibold', bg: 'bg-emerald-50' };
  if (pct >= lo) return { text: 'text-amber-600 font-semibold', bg: 'bg-amber-50' };
  return { text: 'text-red-600 font-semibold', bg: 'bg-red-50' };
}

type SegmentMetricKey = 'day7LoginPct' | 'day15ActPct';
type SegmentBaselineKey = 'baselineDay7LoginPct' | 'baselineDay15ActPct';

const SEGMENT_COL_CONFIG: Record<SegmentMetricKey, {
  label: string;
  baselineKey: SegmentBaselineKey;
  color: string;
  lo: number;
  hi: number;
}> = {
  day7LoginPct:  { label: 'Day 7 Login %',        baselineKey: 'baselineDay7LoginPct',  color: 'text-cyan-600',   lo: 60, hi: 80 },
  day15ActPct:   { label: 'Day 15 Activation %',  baselineKey: 'baselineDay15ActPct',   color: 'text-emerald-600', lo: 30, hi: 50 },
};

function SegmentComparisonTable({
  groups,
  cols,
  loading,
  snapshotDate,
}: {
  groups: SegmentGroup[];
  cols: [SegmentMetricKey, SegmentMetricKey];
  loading: boolean;
  snapshotDate: string;
}) {
  if (loading) {
    return (
      <div className="h-32 flex items-center justify-center">
        <div className="w-7 h-7 rounded-full border-2 border-violet-200 border-t-violet-600 animate-spin" />
      </div>
    );
  }
  if (groups.length === 0) return null;

  const [colA, colB] = cols;
  const cfgA = SEGMENT_COL_CONFIG[colA];
  const cfgB = SEGMENT_COL_CONFIG[colB];

  function delta(recent: number | null, baseline: number | null): number | null {
    if (recent === null || baseline === null) return null;
    return Math.round((recent - baseline) * 10) / 10;
  }

  function DeltaBadge({ d }: { d: number | null }) {
    if (d === null) return null;
    const positive = d > 0;
    const neutral = d === 0;
    return (
      <span className={`ml-1 text-[10px] font-medium ${neutral ? 'text-gray-400' : positive ? 'text-emerald-600' : 'text-red-500'}`}>
        {positive ? '+' : ''}{d}pp
      </span>
    );
  }

  function MetricCell({ val, baseline, lo, hi, isNew, isPrimary }: {
    val: number | null; baseline: number | null; lo: number; hi: number; isNew: boolean; isPrimary: boolean;
  }) {
    const colors = val !== null && !isNew ? rateColor(val, lo, hi) : null;
    const d = delta(val, baseline);
    if (val === null) return <span className="text-gray-300">—</span>;
    return (
      <>
        <span className={`inline-block px-2 py-0.5 rounded-md text-xs ${colors ? colors.text : 'text-gray-500'} ${isPrimary && colors ? colors.bg : ''}`}>
          {val}%
        </span>
        {baseline !== null && (
          <div className="text-[11px] text-gray-400 mt-1">
            {baseline}%<DeltaBadge d={d} />
          </div>
        )}
      </>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
            <th className="text-left px-5 py-3 font-medium">Segment</th>
            <th className="text-right px-4 py-3 font-medium">Users</th>
            <th className={`text-right px-4 py-3 font-medium ${cfgA.color}`}>
              <div>{cfgA.label}</div>
              <div className="text-[10px] normal-case tracking-normal text-gray-400 font-normal mt-0.5">recent · 12w avg</div>
            </th>
            <th className={`text-right px-4 py-3 font-medium ${cfgB.color}`}>
              <div>{cfgB.label}</div>
              <div className="text-[10px] normal-case tracking-normal text-gray-400 font-normal mt-0.5">recent · 12w avg</div>
            </th>
            <th className="text-right px-4 py-3 font-medium text-rose-600">
              <div>Refund Rate</div>
              <div className="text-[10px] normal-case tracking-normal text-gray-400 font-normal mt-0.5">recent · 12w avg</div>
            </th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group, gi) => (
            <Fragment key={gi}>
              <tr className="bg-gray-50 border-t border-gray-100">
                <td colSpan={5} className="px-5 py-2">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{group.dimension}</span>
                </td>
              </tr>
              {(() => {
                const groupRecentTotal = group.rows.reduce((s, r) => s + r.total, 0);
                const groupBaselineTotal = group.rows.reduce((s, r) => s + r.baselineTotal, 0);
                return group.rows.map((row) => {
                const snapshotMs = new Date(snapshotDate || '2026-09-02').getTime();
                const isNew = row.firstWeek
                  ? (snapshotMs - new Date(row.firstWeek).getTime()) / (1000 * 60 * 60 * 24 * 7) < 13
                  : false;
                const recentShare = groupRecentTotal > 0
                  ? Math.round(row.total / groupRecentTotal * 1000) / 10
                  : null;
                const baselineShare = groupBaselineTotal > 0
                  ? Math.round(row.baselineTotal / groupBaselineTotal * 1000) / 10
                  : null;
                const shareShift = recentShare !== null && baselineShare !== null
                  ? Math.round((recentShare - baselineShare) * 10) / 10
                  : null;
                const avgB = group.rows.filter(r => r[colB] !== null).reduce((s, r, _, a) => s + ((r[colB] as number) ?? 0) / a.length, 0);
                const isDragging = !isNew && shareShift !== null && shareShift > 1 &&
                  row[colB] !== null && (row[colB] as number) < avgB;

                return (
                  <tr key={`${gi}-${row.label}`} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-800">
                      <div className="flex items-center gap-2 flex-wrap">
                        {row.label}
                        {isNew && (
                          <span className="text-[10px] font-semibold text-sky-600 bg-sky-50 border border-sky-100 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                            new
                          </span>
                        )}
                        {isDragging && (
                          <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                            mix shift ↑
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 tabular-nums align-top pt-3.5">
                      {row.total.toLocaleString()}
                      {recentShare !== null && (
                        <div className="text-[10px] mt-0.5">
                          <span className="text-gray-400">{recentShare}%</span>
                          {shareShift !== null && shareShift !== 0 && (
                            <span className={`ml-1 font-semibold ${shareShift > 0 ? 'text-amber-500' : 'text-sky-500'}`}>
                              {shareShift > 0 ? '+' : ''}{shareShift}pp
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums align-top pt-3.5">
                      <MetricCell
                        val={row[colA] as number | null}
                        baseline={row[cfgA.baselineKey] as number | null}
                        lo={cfgA.lo} hi={cfgA.hi}
                        isNew={isNew} isPrimary={false}
                      />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums align-top pt-3.5">
                      <MetricCell
                        val={row[colB] as number | null}
                        baseline={row[cfgB.baselineKey] as number | null}
                        lo={cfgB.lo} hi={cfgB.hi}
                        isNew={isNew} isPrimary={true}
                      />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums align-top pt-3.5">
                      {row.refundRate === null ? (
                        <span className="text-gray-300">—</span>
                      ) : (
                        <>
                          <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-semibold ${
                            row.refundRate <= 2 ? 'text-emerald-600 bg-emerald-50' :
                            row.refundRate <= 5 ? 'text-amber-600 bg-amber-50' :
                            'text-red-600 bg-red-50'
                          }`}>{row.refundRate}%</span>
                          {row.baselineRefundRate !== null && (() => {
                            const d = delta(row.refundRate, row.baselineRefundRate);
                            return (
                              <div className="text-[11px] text-gray-400 mt-1">
                                {row.baselineRefundRate}%
                                {d !== null && d !== 0 && (
                                  <span className={`ml-1 text-[10px] font-medium ${d > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                                    {d > 0 ? '+' : ''}{d}pp
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </>
                      )}
                    </td>
                  </tr>
                );
              });
              })()}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export default function PurchaseCohortsClient() {
  const [activeTab, setActiveTab] = useState<Tab>('ip');
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [options, setOptions] = useState<FilterOptions | null>(null);
  const [dropoff, setDropoff] = useState<DropoffAnalysis | null>(null);
  const [loginAnalysis, setLoginAnalysis] = useState<LoginAnalysis | null>(null);
  const [segments, setSegments] = useState<SegmentGroup[]>([]);
  const [refundWeeks, setRefundWeeks] = useState<RefundWeekRow[]>([]);
  const [refundBreakdown, setRefundBreakdown] = useState<RefundBreakdown | null>(null);
  const [snapshotDate, setSnapshotDate] = useState('');
  const [segmentWeeks, setSegmentWeeks] = useState(4);
  const [fromWeek, setFromWeek] = useState('');
  const [toWeek, setToWeek] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [trafficSource, setTrafficSource] = useState('');
  const [campaignType, setCampaignType] = useState('');
  const [payFreq, setPayFreq] = useState('');
  const [device, setDevice] = useState('');
  const [hasDiscount, setHasDiscount] = useState('');
  const [priceBucket, setPriceBucket] = useState(0);
  const [productFunnel, setProductFunnel] = useState('');
  const [isMC, setIsMC] = useState(false);
  const [isVSL, setIsVSL] = useState(false);
  const [firstOrderFilter, setFirstOrderFilter] = useState(''); // '' | 'first' | 'returning'
  const [orderType, setOrderType] = useState('');
  const [placeInFunnel, setPlaceInFunnel] = useState('');
  const [productType, setProductType] = useState('');
  const [hasFunnelQuest, setHasFunnelQuest] = useState('');
  const [productName, setProductName] = useState('');
  const [country, setCountry] = useState('');

  const fetchData = useCallback(async (includeOptions: boolean) => {
    setLoading(true);
    try {
      const bucket = PRICE_BUCKETS[priceBucket];
      const params = new URLSearchParams();
      if (trafficSource) params.set('traffic_source', trafficSource);
      if (campaignType) params.set('campaign_type', campaignType);
      if (payFreq) params.set('payment_frequency', payFreq);
      if (device) params.set('device_category', device);
      if (hasDiscount) params.set('has_discount', hasDiscount);
      if (bucket.min !== undefined) params.set('min_price', String(bucket.min));
      if (bucket.max !== undefined) params.set('max_price', String(bucket.max));
      if (productFunnel) params.set('product_funnel', productFunnel);
      if (isMC) params.set('is_mc_funnel', '1');
      if (isVSL) params.set('is_vsl_funnel', '1');
      if (firstOrderFilter === 'first') params.set('is_first_order', '1');
      if (firstOrderFilter === 'returning') params.set('is_returning_order', '1');
      if (orderType) params.set('order_type', orderType);
      if (placeInFunnel) params.set('place_in_funnel', placeInFunnel);
      if (productType) params.set('product_type', productType);
      if (hasFunnelQuest) params.set('has_funnel_quest', hasFunnelQuest);
      if (productName) params.set('product_name', productName);
      if (country) params.set('country', country);
      if (includeOptions) params.set('include_options', '1');
      params.set('include_dropoff', '1');
      params.set('include_segments', '1');
      params.set('include_refund', '1');
      params.set('segment_weeks', String(segmentWeeks));

      const res = await fetch(`/api/purchase-cohorts?${params}`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setWeeks(data.weeks ?? []);
      if (data.options) setOptions(data.options);
      setDropoff(data.dropoff ?? null);
      setLoginAnalysis(data.loginAnalysis ?? null);
      setSegments(data.segments ?? []);
      setRefundWeeks(data.refundWeeks ?? []);
      setRefundBreakdown(data.refundBreakdown ?? null);
      if (data.snapshotDate) setSnapshotDate(data.snapshotDate);
    } catch {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [trafficSource, campaignType, payFreq, device, hasDiscount, priceBucket, productFunnel, isMC, isVSL, firstOrderFilter, orderType, placeInFunnel, productType, hasFunnelQuest, productName, segmentWeeks]);

  useEffect(() => { fetchData(true); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isInitialMount = useState(true);
  useEffect(() => {
    if (isInitialMount[0]) { isInitialMount[1](false); return; }
    fetchData(false);
  }, [trafficSource, campaignType, payFreq, device, hasDiscount, priceBucket, productFunnel, isMC, isVSL, firstOrderFilter, orderType, placeInFunnel, productType, hasFunnelQuest, productName, country, segmentWeeks]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetFilters = () => {
    setTrafficSource(''); setCampaignType(''); setPayFreq('');
    setDevice(''); setHasDiscount(''); setPriceBucket(0);
    setProductFunnel(''); setIsMC(false); setIsVSL(false); setFirstOrderFilter('');
    setOrderType(''); setPlaceInFunnel(''); setProductType(''); setHasFunnelQuest(''); setProductName(''); setCountry('');
    setFromWeek(''); setToWeek('');
  };

  const hasActiveFilters = trafficSource || campaignType || payFreq || device || hasDiscount || priceBucket > 0 || productFunnel || isMC || isVSL || firstOrderFilter || orderType || placeInFunnel || productType || hasFunnelQuest || productName;

  // Client-side date range slice
  const viewedWeeks = weeks.filter(w =>
    (!fromWeek || w.week >= fromWeek) && (!toWeek || w.week <= toWeek)
  );
  const totalUsers = viewedWeeks.reduce((s, w) => s + w.total, 0);

  // Exclude only the current partial week (last entry) — it has < 7 days of data.
  // All other completed weeks are included, even if immature.
  const completedWeeks = viewedWeeks.slice(0, -1);
  const recent4 = completedWeeks.slice(-4);
  const prev4 = completedWeeks.slice(-8, -4);
  const weekAvg = (ws: WeekRow[], key: keyof WeekRow): number | null =>
    ws.length > 0
      ? Math.round(ws.reduce((s, w) => s + (w[key] as number), 0) / ws.length * 10) / 10
      : null;
  const momDelta = (key: keyof WeekRow): number | null => {
    const cur = weekAvg(recent4, key);
    const prv = weekAvg(prev4, key);
    if (cur === null || prv === null || prv === 0) return null;
    return Math.round((cur - prv) * 10) / 10;
  };

  // Per-tab config
  const isIP = activeTab === 'ip';
  const isRefund = activeTab === 'refund';
  const isPayment = activeTab === 'payment';

  const lines = isIP ? IP_LINES : ENGAGE_LINES;
  const cards = isIP
    ? [
        { key: 'day7LoginPct' as const, label: 'Day 7 Login', detail: 'Login within 7d', color: '#06b6d4', lo: 60, hi: 80 },
      ]
    : activeTab === 'engage'
    ? [
        { key: 'day15ActPct' as const, label: 'Day 15 Activation', detail: 'Activated within 15d', color: '#10b981', lo: 30, hi: 50 },
        { key: 'day30ActPct' as const, label: 'Day 30 Activation', detail: 'Activated within 30d', color: '#f59e0b', lo: 35, hi: 55 },
      ]
    : [];

  if (error) return <div className="p-6 text-red-500">{error}</div>;

  return (
    <div className="space-y-6">

      {/* Team tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Metric definitions */}
      <div className="bg-violet-50 border border-violet-100 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
          <span className="text-xs font-semibold text-violet-700 uppercase tracking-wide">Metric Definitions</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {METRIC_DEFS[activeTab].map(d => (
            <div key={d.key} className="flex gap-3">
              <span className="mt-0.5 w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
              <div>
                <div className="text-xs font-semibold text-gray-800">{d.label}</div>
                <div className="text-xs text-gray-600 mt-0.5 leading-relaxed">{d.definition}</div>
                {d.denominator && (
                  <div className="text-xs text-violet-500 mt-1 font-medium">Denominator: {d.denominator}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Filters</h2>
          <button
            onClick={resetFilters}
            disabled={!hasActiveFilters && !fromWeek && !toWeek}
            className="text-xs font-medium transition-colors disabled:text-gray-300 disabled:cursor-default text-violet-600 hover:text-violet-800"
          >
            Reset all
          </button>
        </div>
        <div className="flex flex-wrap gap-4">
          {/* Date range */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">From week</label>
            <select value={fromWeek} onChange={e => setFromWeek(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-400 min-w-[160px]">
              <option value="">Earliest</option>
              {weeks.map(w => <option key={w.week} value={w.week}>{w.weekLabel}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">To week</label>
            <select value={toWeek} onChange={e => setToWeek(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-400 min-w-[160px]">
              <option value="">Latest</option>
              {weeks.map(w => <option key={w.week} value={w.week}>{w.weekLabel}</option>)}
            </select>
          </div>
          <div className="self-end pb-0.5 h-9 w-px bg-gray-200" />
          {options && (
            <>
              <SelectFilter label="Traffic Source"  value={trafficSource}  options={options.trafficSources}    onChange={setTrafficSource} />
              <SelectFilter label="Campaign Type"   value={campaignType}   options={options.campaignTypes}     onChange={setCampaignType} />
              <SelectFilter label="Payment"         value={payFreq}        options={options.paymentFrequencies} onChange={setPayFreq} />
              <SelectFilter label="Device"          value={device}         options={options.devices}           onChange={setDevice} />
              <SelectFilter label="Funnel"          value={productFunnel}  options={options.funnels}           onChange={setProductFunnel} />
            </>
          )}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Price</label>
            <select value={priceBucket} onChange={e => setPriceBucket(Number(e.target.value))}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-400 min-w-[120px]">
              {PRICE_BUCKETS.map((b, i) => <option key={i} value={i}>{b.label}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Discount</label>
            <select value={hasDiscount} onChange={e => setHasDiscount(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-400 min-w-[120px]">
              <option value="">All</option>
              <option value="yes">With discount</option>
              <option value="no">No discount</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Funnel type</label>
            <div className="flex gap-2 pt-1">
              {[
                { label: 'MC',  active: isMC,  toggle: () => { setIsMC(p => !p);  if (!isMC) setIsVSL(false); } },
                { label: 'VSL', active: isVSL, toggle: () => { setIsVSL(p => !p); if (!isVSL) setIsMC(false); } },
              ].map(({ label, active, toggle }) => (
                <button key={label} onClick={toggle}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${active ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Order</label>
            <select value={firstOrderFilter} onChange={e => setFirstOrderFilter(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-400 min-w-[140px]">
              <option value="">All orders</option>
              <option value="first">First order</option>
              <option value="returning">Returning order</option>
            </select>
          </div>
          {options && (
            <>
              <SelectFilter label="Order Type"       value={orderType}      options={options.orderTypes}      onChange={setOrderType} />
              <SelectFilter label="Place in Funnel"  value={placeInFunnel}  options={options.placeInFunnels}  onChange={setPlaceInFunnel} />
            </>
          )}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Funnel Quest</label>
            <select value={hasFunnelQuest} onChange={e => setHasFunnelQuest(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-400 min-w-[120px]">
              <option value="">All</option>
              <option value="yes">Has quest</option>
              <option value="no">No quest</option>
            </select>
          </div>
          {options && (
            <SelectFilter label="Product Name" value={productName} options={options.productNames} onChange={setProductName} />
          )}
          {options && (
            <SelectFilter label="Country" value={country} options={options.countries} onChange={setCountry} />
          )}
        </div>
      </div>

      {/* Summary cards — IP and Engage tabs only */}
      {!isRefund && !isPayment && !loading && recent4.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {cards.map(c => {
            const val = weekAvg(recent4, c.key);
            const delta = momDelta(c.key);
            const isUp = delta !== null && delta > 0;
            const isDown = delta !== null && delta < 0;
            return (
              <div key={c.key} className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-3 h-1 rounded-full inline-block" style={{ backgroundColor: c.color }} />
                  <span className="text-xs text-gray-500">{c.detail}</span>
                </div>
                <div className="flex items-end gap-3">
                  <div className={`text-3xl ${val !== null ? pctColor(val, c.lo, c.hi) : 'text-gray-300'}`}>
                    {val !== null ? `${val}%` : '—'}
                  </div>
                  {delta !== null && (
                    <div className={`flex items-center gap-0.5 text-sm font-semibold mb-1 ${isUp ? 'text-emerald-600' : isDown ? 'text-red-500' : 'text-gray-400'}`}>
                      {isUp ? (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                        </svg>
                      ) : isDown ? (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 4.5l15 15m0 0V8.25m0 11.25H8.25" />
                        </svg>
                      ) : null}
                      {Math.abs(delta)}pp
                    </div>
                  )}
                </div>
                <div className="text-sm font-medium text-gray-700 mt-1">{c.label}</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  Last 4 weeks avg
                  {prev4.length > 0 && <span className="ml-1">· vs prev 4 weeks</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Trend chart — IP and Engage tabs only */}
      {!isRefund && !isPayment && <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-semibold text-gray-900">
              {isIP ? 'IP Team — Login Trend' : 'Engage Team — Activation Trend'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {loading ? 'Loading…' : `${viewedWeeks.length} weeks · ${totalUsers.toLocaleString()} users`}
              {hasActiveFilters && !loading && <span className="ml-2 text-violet-600 font-medium">· filtered</span>}
            </p>
          </div>
          <div className="flex flex-wrap gap-4 items-center">
            {lines.map(l => (
              <div key={l.key} className="flex items-center gap-1.5 text-xs text-gray-600">
                <svg width="20" height="8">
                  <line x1="0" y1="4" x2="20" y2="4" stroke={l.color} strokeWidth="2.5" strokeDasharray={l.dash} />
                </svg>
                {l.label}
              </div>
            ))}
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className="w-3 h-3 rounded-sm inline-block bg-violet-100" />
              Maturing
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className="w-3 h-3 rounded-sm inline-block bg-indigo-100" />
              Cohort size
            </div>
          </div>
        </div>
        <div className="px-5 py-4">
          <TrendChart weeks={viewedWeeks} lines={lines} loading={loading} />
        </div>
      </div>}

      {/* Segment comparison table — IP and Engage tabs only */}
      {!isRefund && !isPayment &&
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-semibold text-gray-900">
              {isIP ? 'IP Team — Segment Breakdown' : 'Engage Team — Segment Breakdown'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Variables driving differences in {isIP ? 'login' : 'activation'}
              {snapshotDate && (
                <span className="ml-2 text-gray-400">· Data as of {new Date(snapshotDate + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {([4, 8, 13, 26] as const).map(w => (
              <button key={w} onClick={() => setSegmentWeeks(w)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${segmentWeeks === w ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-500 border-gray-200 hover:border-violet-300'}`}>
                {w}w
              </button>
            ))}
          </div>
        </div>
        <SegmentComparisonTable
          groups={segments.filter(g => g.dimension !== 'Payment Processor')}
          cols={isIP ? ['day7LoginPct', 'day15ActPct'] : ['day7LoginPct', 'day15ActPct']}
          loading={loading}
          snapshotDate={snapshotDate}
        />
      </div>}

      {/* Payment tab content */}
      {isPayment && !loading && (() => {
        const processorGroups = segments.filter(g => g.dimension === 'Payment Processor');
        const rows = processorGroups[0]?.rows ?? [];
        const cardRow    = rows.find(r => r.label === 'Card');
        const paypalRow  = rows.find(r => r.label === 'PayPal');
        const totalVol   = rows.reduce((s, r) => s + r.total, 0);
        return (
          <div className="space-y-4">
            {/* Stat cards — Card vs PayPal */}
            {cardRow && paypalRow && (
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Card', row: cardRow, color: '#6366f1' },
                  { label: 'PayPal', row: paypalRow, color: '#f59e0b' },
                ].map(({ label, row, color }) => {
                  const share = totalVol > 0 ? Math.round(row.total / totalVol * 1000) / 10 : 0;
                  return (
                    <div key={label} className="bg-white border border-gray-200 rounded-xl p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="w-3 h-1 rounded-full inline-block" style={{ backgroundColor: color }} />
                        <span className="text-sm font-semibold text-gray-800">{label}</span>
                        <span className="ml-auto text-xs text-gray-400">{share}% of volume</span>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div>
                          <div className="text-lg font-bold text-gray-900">{row.day7LoginPct !== null ? `${row.day7LoginPct}%` : '—'}</div>
                          <div className="text-[10px] text-gray-400 mt-0.5">Day 7 Login</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold text-gray-900">{row.day15ActPct !== null ? `${row.day15ActPct}%` : '—'}</div>
                          <div className="text-[10px] text-gray-400 mt-0.5">Day 15 Activation</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold" style={{ color: (row.refundRate ?? 0) > 5 ? '#ef4444' : (row.refundRate ?? 0) > 2 ? '#f59e0b' : '#10b981' }}>
                            {row.refundRate !== null ? `${row.refundRate}%` : '—'}
                          </div>
                          <div className="text-[10px] text-gray-400 mt-0.5">Refund Rate</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Full breakdown table */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Payment Processor — Segment Breakdown</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Critical metrics by payment processor · last {segmentWeeks} weeks vs 12-week baseline
                  {snapshotDate && (
                    <span className="ml-2 text-gray-400">· Data as of {new Date(snapshotDate + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</span>
                  )}
                </p>
              </div>
              <SegmentComparisonTable
                groups={processorGroups}
                cols={['day7LoginPct', 'day15ActPct']}
                loading={loading}
                snapshotDate={snapshotDate}
              />
            </div>
          </div>
        );
      })()}

      {/* Who's not logging in? — IP Team only */}
      {isIP && loginAnalysis && !loading && (() => {
        const nonDay7Total = loginAnalysis.lateLoggerMature + loginAnalysis.ghostTotalMature;
        const lateLoggerPct = nonDay7Total > 0 ? Math.round(loginAnalysis.lateLoggerMature / nonDay7Total * 100) : 0;
        const ghostOnlyPct  = nonDay7Total > 0 ? Math.round(loginAnalysis.ghostTotalMature  / nonDay7Total * 100) : 0;
        const missedDay7Pct = loginAnalysis.eligibleTotalMature > 0
          ? Math.round(nonDay7Total / loginAnalysis.eligibleTotalMature * 1000) / 10 : 0;

        const questGhosts = loginAnalysis.topProducts
          .filter(p => p.productName.toLowerCase().includes('quest'))
          .reduce((s, p) => s + p.ghostCount, 0);
        const questGhostPct = loginAnalysis.ghostTotalMature > 0
          ? Math.round(questGhosts / loginAnalysis.ghostTotalMature * 100) : 0;

        const yearlyMonthlyGap = Math.round(Math.abs(
          loginAnalysis.yearlyCustomers.day7Rate - loginAnalysis.monthlyCustomers.day7Rate
        ) * 10) / 10;

        const overallDelta = loginAnalysis.overall.prevDay7Rate !== null
          ? Math.round((loginAnalysis.overall.day7Rate - loginAnalysis.overall.prevDay7Rate) * 10) / 10 : null;

        // In-app vs best device for headline
        const inApp   = loginAnalysis.deviceBreakdown.find(d => d.device === 'in-app');
        const desktop = loginAnalysis.deviceBreakdown.find(d => d.device === 'desktop');
        const deviceGap = inApp && desktop ? Math.round((desktop.day7Rate - inApp.day7Rate) * 10) / 10 : null;

        return (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Who&apos;s not logging in?</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Mature cohorts (14d+ old) · {loginAnalysis.eligibleTotalMature.toLocaleString()} eligible buyers
                {overallDelta !== null && (
                  <span className={`ml-2 font-semibold ${overallDelta >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    · Day 7 {overallDelta >= 0 ? '+' : ''}{overallDelta}pp recent vs prev 4w
                  </span>
                )}
              </p>
            </div>
            <div className="p-5 space-y-4">

              {/* Finding 1 — What happened to non-loggers? */}
              <div className="border border-blue-100 bg-blue-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">Finding 1</span>
                  <span className="text-sm font-semibold text-gray-800 flex-1">
                    {missedDay7Pct}% missed the 7-day window — {lateLoggerPct}% eventually came back, {ghostOnlyPct}% never did
                  </span>
                  <span className="text-xs font-bold text-gray-600 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full whitespace-nowrap">{nonDay7Total.toLocaleString()} users</span>
                </div>
                <p className="text-xs text-gray-600 mb-3">
                  Of the {nonDay7Total.toLocaleString()} buyers who didn&apos;t log in within 7 days: <strong>{loginAnalysis.lateLoggerMature.toLocaleString()} logged in late</strong> (after day 7) and <strong>{loginAnalysis.ghostTotalMature.toLocaleString()} never logged in at all</strong>. Late loggers show the product has value — they&apos;re reachable through nudges. True ghosts are at high churn risk.
                </p>
                {loginAnalysis.lateLoggerTiming.length > 0 && (
                  <div>
                    <p className="text-[10px] text-gray-500 font-medium mb-1.5">When did late loggers come back?</p>
                    <div className="flex gap-2 flex-wrap">
                      {loginAnalysis.lateLoggerTiming.map(t => (
                        <div key={t.bucket} className="flex flex-col items-center bg-white border border-blue-100 rounded-lg px-3 py-2 min-w-[64px]">
                          <span className="text-xs font-bold text-blue-700">{t.count.toLocaleString()}</span>
                          <span className="text-[10px] text-gray-500 mt-0.5">{t.bucket}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Finding 2 — Why didn't they log in? Device + Price */}
              <div className="border border-amber-100 bg-amber-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">Finding 2</span>
                  <span className="text-sm font-semibold text-gray-800 flex-1">
                    {deviceGap !== null
                      ? `In-app buyers log in ${deviceGap}pp less than desktop — and take longer to come back`
                      : 'Purchase channel drives the login gap'}
                  </span>
                </div>
                <p className="text-xs text-gray-600 mb-3">
                  In-app purchases (no browser redirect) have the lowest Day 7 rate and the highest late-logger rate — users bought but weren&apos;t routed to login. Desktop converts best. Higher price points ($400+) also show elevated ghost rates, possibly buyer&apos;s remorse before logging in.
                </p>

                {/* Device table */}
                {loginAnalysis.deviceBreakdown.length > 0 && (
                  <div className="mb-3">
                    <p className="text-[10px] text-gray-500 font-medium mb-1.5">By purchase channel</p>
                    <div className="overflow-x-auto -mx-1">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-400 border-b border-amber-100">
                            <th className="text-left pb-1.5 pl-1 font-medium">Channel</th>
                            <th className="text-right pb-1.5 font-medium">Buyers</th>
                            <th className="text-right pb-1.5 font-medium">Day 7 login %</th>
                            <th className="text-right pb-1.5 font-medium">Logged in late</th>
                            <th className="text-right pb-1.5 pr-1 font-medium">Never logged in</th>
                          </tr>
                        </thead>
                        <tbody>
                          {loginAnalysis.deviceBreakdown.map(d => {
                            const d7Color = d.day7Rate >= 90 ? '#059669' : d.day7Rate >= 80 ? '#d97706' : '#dc2626';
                            const ghostColor = d.ghostRate >= 12 ? '#dc2626' : d.ghostRate >= 8 ? '#d97706' : '#6b7280';
                            return (
                              <tr key={d.device} className="border-b border-amber-50 last:border-0">
                                <td className="py-1.5 pl-1 font-medium text-gray-700 capitalize">{d.device}</td>
                                <td className="py-1.5 text-right text-gray-400">{d.eligible.toLocaleString()}</td>
                                <td className="py-1.5 text-right font-semibold" style={{ color: d7Color }}>{d.day7Rate}%</td>
                                <td className="py-1.5 text-right text-blue-600">{d.lateRate}%</td>
                                <td className="py-1.5 text-right pr-1 font-semibold" style={{ color: ghostColor }}>{d.ghostRate}%</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Price band table */}
                {loginAnalysis.priceBreakdown.length > 0 && (
                  <div>
                    <p className="text-[10px] text-gray-500 font-medium mb-1.5">By price point (Yearly subscribers only)</p>
                    <div className="overflow-x-auto -mx-1">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-400 border-b border-amber-100">
                            <th className="text-left pb-1.5 pl-1 font-medium">Price band</th>
                            <th className="text-right pb-1.5 font-medium">Buyers</th>
                            <th className="text-right pb-1.5 font-medium">Day 7 login %</th>
                            <th className="text-right pb-1.5 font-medium">Logged in late</th>
                            <th className="text-right pb-1.5 pr-1 font-medium">Never logged in</th>
                          </tr>
                        </thead>
                        <tbody>
                          {loginAnalysis.priceBreakdown.map(p => {
                            const d7Color = p.day7Rate >= 90 ? '#059669' : p.day7Rate >= 85 ? '#d97706' : '#dc2626';
                            const ghostColor = p.ghostRate >= 10 ? '#dc2626' : p.ghostRate >= 8 ? '#d97706' : '#6b7280';
                            return (
                              <tr key={p.label} className="border-b border-amber-50 last:border-0">
                                <td className="py-1.5 pl-1 font-medium text-gray-700">{p.label}</td>
                                <td className="py-1.5 text-right text-gray-400">{p.eligible.toLocaleString()}</td>
                                <td className="py-1.5 text-right font-semibold" style={{ color: d7Color }}>{p.day7Rate}%</td>
                                <td className="py-1.5 text-right text-blue-600">{p.lateRate}%</td>
                                <td className="py-1.5 text-right pr-1 font-semibold" style={{ color: ghostColor }}>{p.ghostRate}%</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Finding 3 — Who are ghost buyers? (product + payment freq) */}
              <div className="border border-orange-100 bg-orange-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">Finding 3</span>
                  <span className="text-sm font-semibold text-gray-800 flex-1">
                    Quest products drive {questGhostPct}% of ghost buyers · Yearly buyers lag Monthly by {yearlyMonthlyGap}pp
                  </span>
                  <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full whitespace-nowrap">{loginAnalysis.ghostTotalMature.toLocaleString()} ghosts</span>
                </div>
                <p className="text-xs text-gray-600 mb-3">
                  Quest All Access and Quest Only dominate ghost buyers — broad-catalogue products attract discovery buyers with no specific content urgency. Yearly subscribers ({loginAnalysis.yearlyCustomers.day7Rate}% Day 7) log in less than Monthly ({loginAnalysis.monthlyCustomers.day7Rate}% Day 7) — paying upfront removes the &quot;use what I pay for&quot; pressure.
                </p>
                <div className="overflow-x-auto -mx-1">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-400 border-b border-orange-100">
                        <th className="text-left pb-2 pl-1 font-medium">Product</th>
                        <th className="text-right pb-2 font-medium">Share</th>
                        <th className="text-right pb-2 font-medium">Day 7 %</th>
                        <th className="text-right pb-2 font-medium">Ghost count</th>
                        <th className="text-right pb-2 pr-1 font-medium">Ghost %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loginAnalysis.topProducts.slice(0, 5).map(p => {
                        const ghostColor = p.ghostRate >= 15 ? '#dc2626' : p.ghostRate >= 8 ? '#d97706' : '#059669';
                        const day7Color  = p.day7Rate  >= 88 ? '#059669' : p.day7Rate  >= 80 ? '#d97706' : '#dc2626';
                        return (
                          <tr key={p.productName} className="border-b border-orange-50 last:border-0">
                            <td className="py-1.5 pl-1 font-medium text-gray-700" style={{ maxWidth: 160 }}>
                              <div className="truncate" title={p.productName}>{p.productName}</div>
                            </td>
                            <td className="py-1.5 text-right text-gray-400">{p.recentShare}%</td>
                            <td className="py-1.5 text-right font-semibold" style={{ color: day7Color }}>
                              {p.day7Rate}%
                              {p.prevDay7Rate !== null && (
                                <span className={`ml-1 font-normal text-[10px] ${p.day7Rate >= p.prevDay7Rate ? 'text-emerald-600' : 'text-red-500'}`}>
                                  ({p.day7Rate >= p.prevDay7Rate ? '+' : ''}{Math.round((p.day7Rate - p.prevDay7Rate) * 10) / 10}pp)
                                </span>
                              )}
                            </td>
                            <td className="py-1.5 text-right text-gray-500">{p.ghostCount.toLocaleString()}</td>
                            <td className="py-1.5 text-right pr-1 font-semibold" style={{ color: ghostColor }}>{p.ghostRate}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-gray-400 mt-2">Ghost % = eligible buyers in mature cohorts who never logged in · snapshot {new Date(loginAnalysis.weekRange.max + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}</p>
              </div>

            </div>
          </div>
        );
      })()}

      {/* Refund Rate tab content */}
      {isRefund && !loading && (() => {
        const matureRefundWeeks = refundWeeks.filter(w => w.isMature);
        const viewedRefundWeeks = refundWeeks.filter(w =>
          (!fromWeek || w.week >= fromWeek) && (!toWeek || w.week <= toWeek)
        );
        const recent4r = matureRefundWeeks.slice(-4);
        const prev4r = matureRefundWeeks.slice(-8, -4);
        const avgRefund4 = recent4r.length > 0 ? Math.round(recent4r.reduce((s, w) => s + w.refundRate, 0) / recent4r.length * 10) / 10 : null;
        const avgRefundPrev = prev4r.length > 0 ? Math.round(prev4r.reduce((s, w) => s + w.refundRate, 0) / prev4r.length * 10) / 10 : null;
        const avgCancel4 = recent4r.length > 0 ? Math.round(recent4r.reduce((s, w) => s + w.cancelRate, 0) / recent4r.length * 10) / 10 : null;
        const refundDelta = avgRefund4 !== null && avgRefundPrev !== null ? Math.round((avgRefund4 - avgRefundPrev) * 10) / 10 : null;

        return (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-4">
              {[
                {
                  label: 'Refund Rate', detail: 'Refunded within 15 days of purchase', value: avgRefund4,
                  delta: refundDelta, color: '#ef4444', lo: 15, hi: 10,
                },
                {
                  label: 'Cancel Rate', detail: 'Cancelled at any point', value: avgCancel4,
                  delta: null, color: '#f97316', lo: 50, hi: 30,
                },
              ].map(c => {
                const isDown = c.delta !== null && c.delta < 0;
                const isUp   = c.delta !== null && c.delta > 0;
                // For refund: lower is better
                const valColor = c.value === null ? 'text-gray-300'
                  : c.value <= c.hi ? 'text-emerald-700 font-bold'
                  : c.value <= c.lo ? 'text-amber-600 font-semibold'
                  : 'text-red-500 font-semibold';
                return (
                  <div key={c.label} className="bg-white border border-gray-200 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-3 h-1 rounded-full inline-block" style={{ backgroundColor: c.color }} />
                      <span className="text-xs text-gray-500">{c.detail}</span>
                    </div>
                    <div className="flex items-end gap-3">
                      <div className={`text-3xl ${valColor}`}>{c.value !== null ? `${c.value}%` : '—'}</div>
                      {c.delta !== null && (
                        <div className={`flex items-center gap-0.5 text-sm font-semibold mb-1 ${isDown ? 'text-emerald-600' : isUp ? 'text-red-500' : 'text-gray-400'}`}>
                          {isDown ? (
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 4.5l15 15m0 0V8.25m0 11.25H8.25" />
                            </svg>
                          ) : isUp ? (
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                            </svg>
                          ) : null}
                          {Math.abs(c.delta)}pp
                        </div>
                      )}
                    </div>
                    <div className="text-sm font-medium text-gray-700 mt-1">{c.label}</div>
                    <div className="text-xs text-gray-400 mt-0.5">Last 4 mature weeks avg{prev4r.length > 0 && c.delta !== null && ' · vs prev 4 weeks'}</div>
                  </div>
                );
              })}
            </div>

            {/* Trend chart */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between flex-wrap gap-3">
                <div>
                  <h2 className="font-semibold text-gray-900">Refund Rate — Weekly Trend</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    By purchase cohort week · shaded = incomplete 15-day window
                    {snapshotDate && <span className="ml-2 text-gray-400">· Data as of {new Date(snapshotDate + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</span>}
                  </p>
                </div>
                <div className="flex flex-wrap gap-4 items-center">
                  {[
                    { label: 'Refund Rate', color: '#ef4444', dash: '' },
                    { label: 'Cancel Rate', color: '#f97316', dash: '6 3' },
                  ].map(l => (
                    <div key={l.label} className="flex items-center gap-1.5 text-xs text-gray-600">
                      <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke={l.color} strokeWidth="2.5" strokeDasharray={l.dash} /></svg>
                      {l.label}
                    </div>
                  ))}
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <span className="w-3 h-3 rounded-sm inline-block bg-red-50 border border-red-100" />
                    Immature
                  </div>
                </div>
              </div>
              <div className="px-5 py-4">
                <RefundChart weeks={viewedRefundWeeks} loading={loading} />
              </div>
            </div>

            {/* Key finding — refund rate drivers */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">What&apos;s driving the refund rate up since Jul 27?</h2>
                <p className="text-xs text-gray-500 mt-0.5">Actual refunds · Apr 21–Jul 20 vs Jul 27–Aug 10 · paying customers only (excl. Trial &amp; Not Applicable)</p>
              </div>
              <div className="p-5 space-y-4">

                {/* Finding 1 — Quest funnel products */}
                <div className="border border-red-100 bg-red-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">Finding 1</span>
                    <span className="text-sm font-semibold text-gray-800 flex-1">
                      Quest subscription funnels spiked — qomm +3.9pp, qaap +4.4pp since Jul 27
                    </span>
                    <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full whitespace-nowrap">12.7% → 13.1%</span>
                  </div>
                  <p className="text-xs text-gray-600 mb-3">
                    Overall refund rate increased <strong>+0.4pp to 13.1%</strong> since July 27 (vs 12.7% before). The biggest rate jumps are in Quest subscription products: <strong>qomm_product +3.9pp to 17.5%</strong> and <strong>qaap_product +4.4pp to 15.1%</strong>. eb_product remains the highest absolute rate (17.3%) but is actually slightly improving (−1.0pp). Major funnels like sums (−2.3pp) and du (−1.7pp) are getting better.
                  </p>
                  <div className="overflow-x-auto -mx-1">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-400 border-b border-red-100">
                          <th className="text-left pb-1.5 pl-1 font-medium">Funnel</th>
                          <th className="text-right pb-1.5 font-medium">Buyers (after)</th>
                          <th className="text-right pb-1.5 font-medium">Refund rate</th>
                          <th className="text-right pb-1.5 pr-1 font-medium">vs before Jul 27</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { name: 'eb_product',    n: 741,  rate: 17.3, delta: -1.0 },
                          { name: 'qomm_product',  n: 177,  rate: 17.5, delta: +3.9 },
                          { name: 'sb_product',    n: 81,   rate: 14.8, delta: -1.2 },
                          { name: 'qaap_product',  n: 166,  rate: 15.1, delta: +4.4 },
                          { name: 'be_product',    n: 248,  rate: 14.1, delta: +2.4 },
                          { name: 'tam_product',   n: 424,  rate: 13.0, delta: +1.9 },
                          { name: 'du_product',    n: 511,  rate: 13.1, delta: -1.7 },
                          { name: 'sums_product',  n: 925,  rate: 11.1, delta: -2.3 },
                          { name: 'Not Applicable', n: 301, rate: 6.3,  delta: -2.3 },
                        ].map(p => {
                          const rateColor = p.rate >= 17 ? '#dc2626' : p.rate >= 13 ? '#d97706' : '#059669';
                          const deltaColor = p.delta > 2 ? '#dc2626' : p.delta < -1 ? '#059669' : '#6b7280';
                          return (
                            <tr key={p.name} className="border-b border-red-50 last:border-0">
                              <td className="py-1.5 pl-1 font-medium text-gray-700">{p.name}</td>
                              <td className="py-1.5 text-right text-gray-400">{p.n.toLocaleString()}</td>
                              <td className="py-1.5 text-right font-semibold" style={{ color: rateColor }}>{p.rate}%</td>
                              <td className="py-1.5 text-right pr-1 font-semibold" style={{ color: deltaColor }}>{p.delta > 0 ? '+' : ''}{p.delta}pp</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Finding 2 — Direct and Email traffic spike */}
                <div className="border border-amber-100 bg-amber-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">Finding 2</span>
                    <span className="text-sm font-semibold text-gray-800 flex-1">
                      Direct and Email refund rates spiked — but Facebook (49% of buyers) is flat
                    </span>
                    <span className="text-xs font-bold text-amber-700 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full whitespace-nowrap">16% Direct</span>
                  </div>
                  <p className="text-xs text-gray-600 mb-3">
                    Facebook (49% of buyers) is essentially flat at 12.9% (−0.4pp) — the dominant channel is not the problem. The spikes are in smaller channels: <strong>General Email +4.8pp to 15.6%</strong> and <strong>Direct +4.3pp to 16%</strong>. Not Classified traffic (20% of buyers) is also slightly elevated at 14.9% (+0.7pp). <strong>App traffic remains low at 3.1%</strong> — paying app buyers are committed.
                  </p>
                  <div className="overflow-x-auto -mx-1">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-400 border-b border-amber-100">
                          <th className="text-left pb-1.5 pl-1 font-medium">Traffic source</th>
                          <th className="text-right pb-1.5 font-medium">Buyers (after)</th>
                          <th className="text-right pb-1.5 font-medium">Refund rate</th>
                          <th className="text-right pb-1.5 pr-1 font-medium">vs before Jul 27</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { source: 'Direct',         n: 150,  rate: 16.0, delta: +4.3 },
                          { source: 'General Email',  n: 64,   rate: 15.6, delta: +4.8 },
                          { source: 'Not Classified', n: 784,  rate: 14.9, delta: +0.7 },
                          { source: 'Google',         n: 767,  rate: 13.2, delta: +0.6 },
                          { source: 'Facebook',       n: 1942, rate: 12.9, delta: -0.4 },
                          { source: 'Impact',         n: 92,   rate: 12.0, delta: -1.0 },
                          { source: 'App',            n: 129,  rate: 3.1,  delta: +0.2 },
                        ].map(r => {
                          const rateColor = r.rate >= 15 ? '#dc2626' : r.rate >= 13 ? '#d97706' : '#059669';
                          const deltaColor = r.delta > 3 ? '#dc2626' : r.delta < -0.5 ? '#059669' : '#6b7280';
                          return (
                            <tr key={r.source} className="border-b border-amber-50 last:border-0">
                              <td className="py-1.5 pl-1 font-medium text-gray-700">{r.source}</td>
                              <td className="py-1.5 text-right text-gray-400">{r.n.toLocaleString()}</td>
                              <td className="py-1.5 text-right font-semibold" style={{ color: rateColor }}>{r.rate}%</td>
                              <td className="py-1.5 text-right pr-1 font-semibold" style={{ color: deltaColor }}>{r.delta > 0 ? '+' : ''}{r.delta}pp</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            </div>

            {/* Breakdown table */}
            {refundBreakdown && (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h2 className="font-semibold text-gray-900">Refund Rate by Segment</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Mature cohorts from recent 8 weeks · {new Date(refundBreakdown.weekRange.min + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })} – {new Date(refundBreakdown.weekRange.max + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}
                    {refundBreakdown.involuntaryRate > 0 && (
                      <span className="ml-2 text-amber-600 font-medium">· {refundBreakdown.involuntaryRate}% of cancellations are involuntary churn</span>
                    )}
                  </p>
                </div>
                <div className="p-5 space-y-6">
                  {[
                    { title: 'By Payment Frequency', rows: refundBreakdown.byPaymentFreq },
                    { title: 'By Order Type', rows: refundBreakdown.byOrderType },
                    { title: 'By Product (top 8)', rows: refundBreakdown.byProduct },
                  ].filter(s => s.rows.length > 0).map(section => (
                    <div key={section.title}>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{section.title}</p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                              <th className="text-left px-4 py-2 font-medium">Segment</th>
                              <th className="text-right px-4 py-2 font-medium">Buyers</th>
                              <th className="text-right px-4 py-2 font-medium text-red-500">Refund Rate</th>
                              <th className="text-right px-4 py-2 font-medium text-orange-500">Cancel Rate</th>
                            </tr>
                          </thead>
                          <tbody>
                            {section.rows.map(row => {
                              const refundColor = row.refundRate <= 10 ? '#059669' : row.refundRate <= 15 ? '#d97706' : '#dc2626';
                              const cancelColor = row.cancelRate <= 20 ? '#059669' : row.cancelRate <= 35 ? '#d97706' : '#dc2626';
                              return (
                                <tr key={row.label} className="border-b border-gray-50 hover:bg-gray-50">
                                  <td className="px-4 py-2.5 font-medium text-gray-800 max-w-[200px]">
                                    <div className="truncate" title={row.label}>{row.label}</div>
                                  </td>
                                  <td className="px-4 py-2.5 text-right text-gray-400 tabular-nums">{row.total.toLocaleString()}</td>
                                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold" style={{ color: refundColor }}>{row.refundRate}%</td>
                                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold" style={{ color: cancelColor }}>{row.cancelRate}%</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        );
      })()}

      {/* What's driving the decline? — Engage Team only */}
      {activeTab === 'engage' && dropoff && !loading && dropoff.topProductShifts.length > 0 && (() => {
        const manifesting = dropoff.topProductShifts.find(p => p.productName.toLowerCase().includes('manifesting'));
        const annualGap = Math.round(Math.abs(dropoff.monthlyCustomers.day15Rate - dropoff.annualCustomers.day15Rate) * 10) / 10;
        const overallDecline = dropoff.overall.prevDay15Rate !== null ? dropoff.overall.day15Rate - dropoff.overall.prevDay15Rate : 0;

        // Mix shift impact: Σ (Δshare/100 × prevDay15) across all products
        const mixShiftPp = dropoff.topProductShifts.reduce((sum, p) =>
          sum + ((p.recentShare - p.prevShare) / 100) * p.prevDay15, 0);

        // F3: how much Manifesting's advantage over the overall average shrank, weighted by share
        // = recentShare × (recentDeviation - prevDeviation)
        const manifestingRatePp = manifesting && dropoff.overall.prevDay15Rate !== null
          ? (manifesting.recentShare / 100) * (
              (manifesting.recentDay15 - dropoff.overall.day15Rate) -
              (manifesting.prevDay15 - dropoff.overall.prevDay15Rate)
            )
          : 0;

        // F2: combined payment frequency impact
        // = rate change within annual (recent share × Δrate)
        // + mix shift drag (Δannual_share × annual-vs-monthly gap)
        const prevAnnualShare = dropoff.overall.prevTotal > 0 ? dropoff.annualCustomers.prevTotal / dropoff.overall.prevTotal : 0;
        const recentAnnualShare = dropoff.overall.total > 0 ? dropoff.annualCustomers.total / dropoff.overall.total : 0;
        const annualRateChange = dropoff.annualCustomers.day15Rate - (dropoff.annualCustomers.prevDay15Rate ?? dropoff.annualCustomers.day15Rate);
        const annualMonthlyGap = dropoff.annualCustomers.day15Rate - dropoff.monthlyCustomers.day15Rate;
        const paymentMixPp = recentAnnualShare * annualRateChange + (recentAnnualShare - prevAnnualShare) * annualMonthlyGap;

        const fmtPp = (n: number) => `${n > 0 ? '+' : ''}${Math.round(n * 10) / 10}pp`;
        const fmtPct = (n: number) => overallDecline !== 0 ? `${Math.round(n / overallDecline * 100)}% of decline` : '';

        return (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">What&apos;s driving the decline?</h2>
              <p className="text-xs text-gray-500 mt-0.5">3 root causes identified · overall {fmtPp(overallDecline)} ({dropoff.overall.prevDay15Rate}% → {dropoff.overall.day15Rate}%)</p>
            </div>
            <div className="p-5 space-y-4">

              {/* Finding 1 — Annual payment (largest impact) */}
              <div className="border border-amber-100 bg-amber-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">Finding 1</span>
                  <span className="text-sm font-semibold text-gray-800 flex-1">Annual customers are growing — and activate at lower rates</span>
                  <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full whitespace-nowrap">{fmtPp(paymentMixPp)}</span>
                </div>
                <p className="text-xs text-gray-600">
                  Monthly customers activate at <strong>{dropoff.monthlyCustomers.day15Rate}%</strong> vs Annual at <strong>{dropoff.annualCustomers.day15Rate}%</strong> — a <strong>{annualGap}pp gap</strong>. Annual&apos;s share of the cohort grew from the prior period
                  {dropoff.annualCustomers.prevDay15Rate !== null && (
                    <span> (annual: {dropoff.annualCustomers.prevDay15Rate}% → {dropoff.annualCustomers.day15Rate}%)</span>
                  )}, pulling the blended average down.
                </p>
              </div>

              {/* Finding 2 — Manifesting internal decline */}
              {manifesting && (
                <div className="border border-violet-100 bg-violet-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold text-violet-700 bg-violet-100 px-2 py-0.5 rounded-full">Finding 2</span>
                    <span className="text-sm font-semibold text-gray-800 flex-1">Manifesting Pathway Day 15 activation is declining</span>
                    <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full whitespace-nowrap">{fmtPp(manifestingRatePp)}</span>
                  </div>
                  <p className="text-xs text-gray-600 mb-2">
                    Day 15 rate within Manifesting Pathway fell from <strong>{manifesting.prevDay15}%</strong> to <strong>{manifesting.recentDay15}%</strong>. This is the largest product by volume ({manifesting.recentShare}% of cohort, {manifesting.recentCount.toLocaleString()} users).
                  </p>
                  <div className="text-xs text-violet-800 bg-violet-100 rounded-lg px-3 py-2">
                    <strong>Note — empty funnel quest ID:</strong> Manifesting Pathway customers have essentially no funnel quest IDs. As the product grows to {manifesting.recentShare}% of the cohort, it amplifies the overall mix toward the lower-activation &quot;no quest&quot; segment. The internal rate decline compounds this — more buyers in a product with no quest content to drive Day 15 activation.
                  </div>
                </div>
              )}

              {/* Finding 3 — Mix shift (smallest impact) */}
              <div className="border border-orange-100 bg-orange-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">Finding 3</span>
                  <span className="text-sm font-semibold text-gray-800 flex-1">Product mix shifted away from high-activation products</span>
                  <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full whitespace-nowrap">{fmtPp(mixShiftPp)}</span>
                </div>
                <p className="text-xs text-gray-600 mb-3">
                  Quest Only Membership (high activation) lost volume share while Manifesting Pathway and Entrepreneurship &amp; AI grew. A counterfactual shows this mix shift almost entirely explains the overall rate decline.
                </p>
                <div className="overflow-x-auto -mx-1">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-400 border-b border-orange-100">
                        <th className="text-left pb-2 pl-1 font-medium">Product</th>
                        <th className="text-right pb-2 font-medium">Prev share</th>
                        <th className="text-right pb-2 font-medium">Recent share</th>
                        <th className="text-right pb-2 pr-1 font-medium">Day 15</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dropoff.topProductShifts.slice(0, 4).map(p => {
                        const shareDelta = p.recentShare - p.prevShare;
                        const shareColor = Math.abs(shareDelta) > 0.5
                          ? (shareDelta > 0 ? 'text-amber-700 font-semibold' : 'text-blue-600 font-semibold')
                          : 'text-gray-600';
                        const rateColor = p.recentDay15 >= 78 ? '#059669' : p.recentDay15 >= 73 ? '#d97706' : '#dc2626';
                        return (
                          <tr key={p.productName} className="border-b border-orange-50 last:border-0">
                            <td className="py-1.5 pl-1 font-medium text-gray-700" style={{ maxWidth: 160 }}>
                              <div className="truncate" title={p.productName}>{p.productName}</div>
                            </td>
                            <td className="py-1.5 text-right text-gray-400">{p.prevShare}%</td>
                            <td className="py-1.5 text-right">
                              <span className={shareColor}>
                                {p.recentShare}%{Math.abs(shareDelta) > 0.5 && <span className="ml-0.5">{shareDelta > 0 ? '↑' : '↓'}</span>}
                              </span>
                            </td>
                            <td className="py-1.5 text-right pr-1 font-semibold" style={{ color: rateColor }}>{p.recentDay15}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>
        );
      })()}

    </div>
  );
}
