import { NextRequest, NextResponse } from 'next/server';
import {
  seedPurchaseMetricsIfNeeded,
  getWeeklyMetrics,
  getFilterOptions,
  getLoginDropoffAnalysis,
  getLoginAnalysis,
  getSegmentComparison,
  getRefundMetrics,
  getRefundBreakdown,
  SNAPSHOT_DATE,
  PurchaseFilters,
} from '@/lib/purchase-metrics';

export const dynamic = 'force-dynamic'; // query-param-driven, cache via Cache-Control header

export async function GET(req: NextRequest) {
  try {
    seedPurchaseMetricsIfNeeded();

    const sp = req.nextUrl.searchParams;

    const filters: PurchaseFilters = {};
    if (sp.get('traffic_source')) filters.traffic_source = sp.get('traffic_source')!;
    if (sp.get('campaign_type')) filters.campaign_type = sp.get('campaign_type')!;
    if (sp.get('payment_frequency')) filters.payment_frequency = sp.get('payment_frequency')!;
    if (sp.get('device_category')) filters.device_category = sp.get('device_category')!;
    if (sp.get('has_discount')) filters.has_discount = sp.get('has_discount') as 'yes' | 'no';
    if (sp.get('min_price')) filters.min_price = Number(sp.get('min_price'));
    if (sp.get('max_price')) filters.max_price = Number(sp.get('max_price'));
    if (sp.get('product_funnel')) filters.product_funnel = sp.get('product_funnel')!;
    if (sp.get('is_mc_funnel') === '1') filters.is_mc_funnel = '1';
    if (sp.get('is_vsl_funnel') === '1') filters.is_vsl_funnel = '1';
    if (sp.get('is_first_order') === '1') filters.is_first_order = '1';
    if (sp.get('is_returning_order') === '1') filters.is_returning_order = '1';
    if (sp.get('order_type')) filters.order_type = sp.get('order_type')!;
    if (sp.get('place_in_funnel')) filters.place_in_funnel = sp.get('place_in_funnel')!;
    if (sp.get('product_type')) filters.product_type = sp.get('product_type')!;
    if (sp.get('has_funnel_quest')) filters.has_funnel_quest = sp.get('has_funnel_quest') as 'yes' | 'no';
    if (sp.get('product_name')) filters.product_name = sp.get('product_name')!;
    if (sp.get('country')) filters.country = sp.get('country')!;

    const weeks = getWeeklyMetrics(filters);
    const options = sp.get('include_options') === '1' ? getFilterOptions() : null;
    const dropoff = sp.get('include_dropoff') === '1' ? getLoginDropoffAnalysis(filters) : null;
    const loginAnalysis = sp.get('include_dropoff') === '1' ? getLoginAnalysis(filters) : null;
    const segmentWeeks = Math.min(52, Math.max(1, parseInt(sp.get('segment_weeks') ?? '4', 10) || 4));
    const segments = sp.get('include_segments') === '1' ? getSegmentComparison(filters, segmentWeeks) : null;
    const refundWeeks = sp.get('include_refund') === '1' ? getRefundMetrics(filters) : null;
    const refundBreakdown = sp.get('include_refund') === '1' ? getRefundBreakdown(filters) : null;

    const res = NextResponse.json({ weeks, options, dropoff, loginAnalysis, segments, refundWeeks, refundBreakdown, snapshotDate: SNAPSHOT_DATE });
    res.headers.set('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return res;
  } catch (e) {
    console.error('[api/purchase-cohorts]', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
