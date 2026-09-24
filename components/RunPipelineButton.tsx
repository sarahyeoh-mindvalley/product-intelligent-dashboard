'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RunPipelineButton() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message?: string } | null>(null);

  async function runPipeline() {
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch('/api/pipeline/run', { method: 'POST' });
      const data = await res.json();
      setResult({ ok: data.ok, message: data.ok ? 'Pipeline completed successfully.' : (data.error ?? 'Pipeline failed.') });
      if (data.ok) {
        router.refresh();
      }
    } catch (_err) {
      setResult({ ok: false, message: 'Network error — could not reach pipeline endpoint.' });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {result && (
        <span className={`text-sm ${result.ok ? 'text-emerald-600' : 'text-red-600'}`}>
          {result.ok ? '✓' : '✗'} {result.message}
        </span>
      )}
      <button
        onClick={runPipeline}
        disabled={running}
        className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-wait text-white text-sm font-medium rounded-lg transition-colors"
      >
        {running ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Running…
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
            </svg>
            Run Pipeline Now
          </>
        )}
      </button>
    </div>
  );
}
