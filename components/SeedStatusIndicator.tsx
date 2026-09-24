'use client';

import { useEffect, useState } from 'react';

type Status = 'unknown' | 'running' | 'done' | 'skipped' | 'error';

interface SeedState {
  status: Status;
  rows?: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export default function SeedStatusIndicator() {
  const [state, setState] = useState<SeedState>({ status: 'unknown' });
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const res = await fetch('/api/seed-status');
        if (!res.ok) return;
        const data = await res.json();
        setState(data);

        // Auto-hide after done/skipped with a delay
        if (data.status === 'done' || data.status === 'skipped') {
          timer = setTimeout(() => setVisible(false), 8000);
          return; // stop polling
        }

        // Keep polling while running or unknown
        timer = setTimeout(poll, 5000);
      } catch {
        timer = setTimeout(poll, 10000);
      }
    }

    poll();
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;
  if (state.status === 'unknown' || state.status === 'skipped') return null;

  const config = {
    running: {
      bg: 'bg-amber-50 border-amber-200',
      dot: 'bg-amber-400 animate-pulse',
      text: 'text-amber-800',
      label: 'Seeding data from BigQuery…',
    },
    done: {
      bg: 'bg-emerald-50 border-emerald-200',
      dot: 'bg-emerald-500',
      text: 'text-emerald-800',
      label: `Data ready · ${state.rows?.toLocaleString() ?? 0} rows`,
    },
    error: {
      bg: 'bg-red-50 border-red-200',
      dot: 'bg-red-500',
      text: 'text-red-800',
      label: `Seed failed: ${state.error ?? 'unknown error'}`,
    },
  }[state.status as 'running' | 'done' | 'error'] ?? null;

  if (!config) return null;

  return (
    <div className={`fixed bottom-4 right-4 z-50 flex items-center gap-2.5 px-3.5 py-2 rounded-lg border shadow-sm text-xs font-medium ${config.bg} ${config.text}`}>
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${config.dot}`} />
      {config.label}
      <button
        onClick={() => setVisible(false)}
        className="ml-1 opacity-50 hover:opacity-100 transition-opacity"
        aria-label="Dismiss"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
