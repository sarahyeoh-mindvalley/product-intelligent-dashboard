/**
 * Journey funnel — thin wrapper over product-data.ts.
 * Exposes a single getJourneyFunnel() used by the overview dashboard.
 */

import {
  seedProductDataIfNeeded,
  getLatestMonth,
  getMonthlySnapshot,
  getMonthlyTrend,
  fmtMonth,
} from './product-data';

export type { MonthlySnapshot, TrendRow } from './product-data';

export interface JourneyFunnel {
  month: string;
  monthLabel: string;
  active: number;
  loggedIn: number;
  loginRate: number;
  hasProgress: number;
  progressRate: number;
  eveUsers: number;
  eveRate: number;
  trend: import('./product-data').TrendRow[];
  hasData: boolean;
}

export function getJourneyFunnel(): JourneyFunnel {
  seedProductDataIfNeeded();

  const month = getLatestMonth();
  const snap = getMonthlySnapshot(month);
  const trend = getMonthlyTrend(month, 6);

  return {
    month,
    monthLabel: fmtMonth(month),
    active: snap.active,
    loggedIn: snap.loggedIn,
    loginRate: snap.loginRate,
    hasProgress: snap.hasProgress,
    progressRate: snap.progressRate,
    eveUsers: snap.eveUsers,
    eveRate: snap.eveRate,
    trend,
    hasData: snap.active > 0,
  };
}
