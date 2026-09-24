'use client';

import Link from 'next/link';
import { Suspense } from 'react';

function LockedContent() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-5">
            <svg className="w-7 h-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <h1 className="text-white text-2xl font-bold">Coming Soon</h1>
          <p className="text-slate-400 text-sm mt-2 leading-relaxed max-w-xs">
            This module is under development and not yet available.
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6 text-left">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            <span className="text-xs text-emerald-400 font-medium">Available now</span>
          </div>
          <div className="text-sm text-white font-medium">Product North Star</div>
          <div className="text-xs text-slate-400 mt-0.5">Weekly cohort activation &amp; login metrics</div>
        </div>

        <Link
          href="/dashboard/activation/purchase-cohorts"
          className="block w-full bg-violet-600 hover:bg-violet-700 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
        >
          Go to Product North Star →
        </Link>
      </div>
    </div>
  );
}

export default function LockedPage() {
  return (
    <Suspense>
      <LockedContent />
    </Suspense>
  );
}
