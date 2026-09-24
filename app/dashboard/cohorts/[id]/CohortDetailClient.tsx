'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { CohortCondition } from '@/lib/db';
import type { CohortForecasts } from '@/lib/forecasting';
import ForecastPanel from '@/components/ForecastPanel';

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------

interface CohortWithCount {
  id: number;
  name: string;
  conditions: CohortCondition[];
  memberCount: number;
  created_at: string;
  updated_at: string;
}

// -----------------------------------------------------------------------
// Field / operator display helpers
// -----------------------------------------------------------------------

const FIELDS: { value: CohortCondition['field']; label: string }[] = [
  { value: 'quest_completion_pct', label: 'Quest completion %' },
  { value: 'subscription_tier', label: 'Subscription tier (0-4)' },
  { value: 'total_purchases', label: 'Total purchases ($)' },
  { value: 'days_since_activity', label: 'Days since activity' },
  { value: 'event_count_30d', label: 'Engagement events (last 30d)' },
];

const OPERATORS: { value: CohortCondition['operator']; label: string }[] = [
  { value: 'gt', label: '>' },
  { value: 'gte', label: '>=' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '<=' },
  { value: 'eq', label: '=' },
];

function operatorLabel(op: CohortCondition['operator']): string {
  return OPERATORS.find(o => o.value === op)?.label ?? op;
}

function fieldLabel(field: CohortCondition['field']): string {
  return FIELDS.find(f => f.value === field)?.label ?? field;
}

// -----------------------------------------------------------------------
// Inline edit form
// -----------------------------------------------------------------------

function defaultCondition(): CohortCondition {
  return { field: 'quest_completion_pct', operator: 'gt', value: 50 };
}

function ConditionRow({
  condition,
  index,
  onChange,
  onRemove,
  showRemove,
}: {
  condition: CohortCondition;
  index: number;
  onChange: (index: number, updated: CohortCondition) => void;
  onRemove: (index: number) => void;
  showRemove: boolean;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select
        value={condition.field}
        onChange={e => onChange(index, { ...condition, field: e.target.value as CohortCondition['field'] })}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
      >
        {FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
      </select>
      <select
        value={condition.operator}
        onChange={e => onChange(index, { ...condition, operator: e.target.value as CohortCondition['operator'] })}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
      >
        {OPERATORS.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
      </select>
      <input
        type="number"
        value={condition.value as number}
        onChange={e => onChange(index, { ...condition, value: parseFloat(e.target.value) || 0 })}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 w-24 focus:outline-none focus:ring-2 focus:ring-violet-500"
      />
      {showRemove && (
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="text-gray-400 hover:text-red-500 p-1 rounded transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------
// Main component
// -----------------------------------------------------------------------

export default function CohortDetailClient({
  cohort: initialCohort,
  forecasts,
}: {
  cohort: CohortWithCount;
  forecasts?: CohortForecasts;
}) {
  const router = useRouter();

  const [cohort, setCohort] = useState(initialCohort);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(initialCohort.name);
  const [editConditions, setEditConditions] = useState<CohortCondition[]>(initialCohort.conditions);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  function startEdit() {
    setEditName(cohort.name);
    setEditConditions([...cohort.conditions]);
    setEditing(true);
    setError('');
  }

  function cancelEdit() {
    setEditing(false);
    setError('');
  }

  async function saveEdit() {
    if (!editName.trim()) { setError('Name is required'); return; }
    if (editConditions.length === 0) { setError('At least one condition is required'); return; }

    setSaving(true);
    setError('');

    try {
      const res = await fetch(`/api/cohorts/${cohort.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim(), conditions: editConditions }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? 'Save failed');
      } else {
        setCohort(data.cohort);
        setEditing(false);
      }
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this cohort? This action cannot be undone.')) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/cohorts/${cohort.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.ok) {
        router.push('/dashboard/cohorts');
      }
    } finally {
      setDeleting(false);
    }
  }

  function updateCondition(index: number, updated: CohortCondition) {
    setEditConditions(prev => prev.map((c, i) => (i === index ? updated : c)));
  }

  function removeCondition(index: number) {
    setEditConditions(prev => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="p-6 space-y-6">
      {/* Back link */}
      <Link href="/dashboard/cohorts" className="text-sm text-violet-600 hover:text-violet-800 font-medium">
        ← Back to Cohorts
      </Link>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="text-3xl font-bold text-gray-900 mb-1">{cohort.memberCount.toLocaleString()}</div>
          <div className="text-sm text-gray-500">Members matching rules</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="text-3xl font-bold text-gray-900 mb-1">{cohort.conditions.length}</div>
          <div className="text-sm text-gray-500">Active conditions</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-medium text-emerald-700 uppercase tracking-wide">Rule-Based</span>
          </div>
          <p className="text-xs text-emerald-700">
            Member counts recalculated on each page load from live database.
          </p>
        </div>
      </div>

      {/* Behavior Forecasts */}
      {forecasts && <ForecastPanel forecasts={forecasts} />}

      {/* Conditions — view or edit mode */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">Cohort Rules</h2>
            <p className="text-xs text-gray-500 mt-0.5">Customers matching ALL conditions are included</p>
          </div>
          {!editing && (
            <div className="flex items-center gap-2">
              <button
                onClick={startEdit}
                className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-violet-600 font-medium px-3 py-1.5 rounded-lg hover:bg-violet-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                </svg>
                Edit
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-red-500 font-medium px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          )}
        </div>

        {!editing ? (
          <div className="divide-y divide-gray-50">
            <div className="px-5 py-3.5 flex items-center justify-between">
              <span className="text-sm text-gray-500">Cohort name</span>
              <span className="text-sm font-semibold text-gray-900">{cohort.name}</span>
            </div>
            {cohort.conditions.map((c, i) => (
              <div key={i} className="px-5 py-3.5 flex items-center justify-between">
                <span className="text-sm text-gray-600">Condition {i + 1}</span>
                <span className="text-sm font-medium text-gray-900 font-mono">
                  {fieldLabel(c.field)} {operatorLabel(c.operator)} {c.value}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-5 py-5 space-y-4">
            {/* Name edit */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Cohort Name</label>
              <input
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>

            {/* Conditions edit */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Conditions</label>
              <div className="space-y-2.5">
                {editConditions.map((c, i) => (
                  <ConditionRow
                    key={i}
                    condition={c}
                    index={i}
                    onChange={updateCondition}
                    onRemove={removeCondition}
                    showRemove={editConditions.length > 1}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => setEditConditions(prev => [...prev, defaultCondition()])}
                className="mt-3 text-sm text-violet-600 hover:text-violet-800 font-medium flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Add condition
              </button>
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={saveEdit}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-60 rounded-lg transition-colors"
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
              <button
                onClick={cancelEdit}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Data Driving This Segment</h2>
        </div>
        <div className="divide-y divide-gray-50">
          <div className="px-5 py-3.5 flex items-center justify-between">
            <span className="text-sm text-gray-500">Created</span>
            <span className="text-sm text-gray-900">{new Date(cohort.created_at).toLocaleString()}</span>
          </div>
          <div className="px-5 py-3.5 flex items-center justify-between">
            <span className="text-sm text-gray-500">Last updated</span>
            <span className="text-sm text-gray-900">{new Date(cohort.updated_at).toLocaleString()}</span>
          </div>
          <div className="px-5 py-3.5 flex items-center justify-between">
            <span className="text-sm text-gray-500">Segment type</span>
            <span className="text-sm font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">Rule-based</span>
          </div>
          <div className="px-5 py-3.5">
            <p className="text-xs text-gray-500">
              Rule-based cohorts evaluate conditions against live SQLite data on each page load.
              The fields <span className="font-mono">quest_completion_pct</span>, <span className="font-mono">subscription_tier</span>,{' '}
              <span className="font-mono">total_purchases</span>, <span className="font-mono">days_since_activity</span>,
              and <span className="font-mono">event_count_30d</span> are derived from the ingested pipeline tables.
              In production, counts would update after the daily data refresh.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
