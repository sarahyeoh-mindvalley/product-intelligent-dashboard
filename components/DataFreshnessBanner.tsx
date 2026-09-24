'use client';

interface DataFreshnessBannerProps {
  lastRunDate: string | null;
  status: 'ok' | 'no_data' | 'error';
}

export default function DataFreshnessBanner({ lastRunDate, status }: DataFreshnessBannerProps) {
  if (status === 'no_data' || status === 'error') {
    return (
      <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-2.5 rounded-lg">
        <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        <span>
          <strong>Data unavailable</strong> — the pipeline has not run yet or encountered an error.
          Charts will update after the next successful pipeline run.
        </span>
      </div>
    );
  }

  const priorDay = lastRunDate
    ? new Date(lastRunDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  return (
    <div className="flex items-center gap-2 text-sm text-slate-500">
      <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>
        Data as of <strong className="text-slate-700">{priorDay}</strong>
      </span>
    </div>
  );
}
