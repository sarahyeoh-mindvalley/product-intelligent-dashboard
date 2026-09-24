/**
 * Deep analysis queries for the 6 "why" questions:
 * 1. Why people cancelled
 * 2. Why people churned (past_due / at-risk)
 * 3. Why people retained — and how to keep them
 * 4. EVE adoption & stickiness
 * 5. How to increase activation
 * 6. How to increase transform rate
 *
 * All analysis uses the latest snapshot per user (MAX(month) per auth0_user_id)
 * so each user is counted once at their most recent known state.
 */

import { getDb } from './db';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function pct(n: number, total: number) {
  return total > 0 ? Math.round((n / total) * 100) : 0;
}

/**
 * Single-snapshot dataset — every user has exactly one row (month = '2026-05').
 * No self-join needed; just filter by month directly for index efficiency.
 */
const LATEST_SNAPSHOT = `(SELECT * FROM product_data WHERE month = (SELECT MAX(month) FROM product_data))`;

// ---------------------------------------------------------------------------
// 1. Cancellation — why people cancelled
// ---------------------------------------------------------------------------

export function getCancellationInsights() {
  const db = getDb();

  // Status breakdown across ALL records (latest snapshot per user)
  const statusRows = db.prepare(`
    SELECT subscription_status as status, COUNT(*) as count,
      ROUND(AVG(COALESCE(total_tenure_days, 0))) as avg_tenure,
      ROUND(AVG(COALESCE(lifetime_value, 0))) as avg_ltv,
      ROUND(100.0 * AVG(has_login_in_month)) as login_rate,
      ROUND(100.0 * AVG(has_progress_in_month)) as progress_rate,
      ROUND(100.0 * AVG(has_used_eve_in_month)) as eve_rate,
      ROUND(AVG(COALESCE(content_watched_min, 0))) as avg_watch_mins
    FROM ${LATEST_SNAPSHOT} ls
    GROUP BY subscription_status ORDER BY count DESC
  `).all() as {
    status: string; count: number; avg_tenure: number; avg_ltv: number;
    login_rate: number; progress_rate: number; eve_rate: number; avg_watch_mins: number;
  }[];

  // Cancelled: tier breakdown
  const cancelledByTier = db.prepare(`
    SELECT COALESCE(tier, 'Unknown') as tier, COUNT(*) as count,
      ROUND(AVG(COALESCE(total_tenure_days, 0))) as avg_tenure,
      ROUND(100.0 * AVG(has_login_in_month)) as login_rate,
      ROUND(100.0 * AVG(has_progress_in_month)) as progress_rate
    FROM ${LATEST_SNAPSHOT} ls
    WHERE subscription_status = 'cancelled'
    GROUP BY tier ORDER BY count DESC
  `).all() as { tier: string; count: number; avg_tenure: number; login_rate: number; progress_rate: number }[];

  // Cancelled: acquisition channel breakdown
  const cancelledByChannel = db.prepare(`
    SELECT COALESCE(acquisition_channel, 'Unknown') as channel, COUNT(*) as count,
      ROUND(AVG(COALESCE(total_tenure_days, 0))) as avg_tenure,
      ROUND(100.0 * AVG(has_progress_in_month)) as progress_rate
    FROM ${LATEST_SNAPSHOT} ls
    WHERE subscription_status = 'cancelled'
    GROUP BY channel ORDER BY count DESC LIMIT 6
  `).all() as { channel: string; count: number; avg_tenure: number; progress_rate: number }[];

  // Cancelled: payment frequency
  const cancelledByFreq = db.prepare(`
    SELECT COALESCE(payment_frequency, 'Unknown') as freq, COUNT(*) as count
    FROM ${LATEST_SNAPSHOT} ls
    WHERE subscription_status = 'cancelled'
    GROUP BY freq ORDER BY count DESC
  `).all() as { freq: string; count: number }[];

  // Cancelled: tenure bucket distribution (shows *when* in life cycle they cancel)
  const cancelledByTenure = db.prepare(`
    SELECT
      CASE
        WHEN total_tenure_days <= 30 THEN '0-30d'
        WHEN total_tenure_days <= 90 THEN '31-90d'
        WHEN total_tenure_days <= 180 THEN '91-180d'
        WHEN total_tenure_days <= 365 THEN '181-365d'
        ELSE '365d+'
      END as tenure_bucket,
      COUNT(*) as count
    FROM ${LATEST_SNAPSHOT} ls
    WHERE subscription_status = 'cancelled' AND total_tenure_days IS NOT NULL
    GROUP BY tenure_bucket ORDER BY MIN(total_tenure_days)
  `).all() as { tenure_bucket: string; count: number }[];

  const total = statusRows.reduce((s, r) => s + r.count, 0);
  const cancelled = statusRows.find(r => r.status === 'cancelled')?.count ?? 0;
  const pastDue = statusRows.find(r => r.status === 'past_due')?.count ?? 0;
  const active = statusRows.find(r => r.status === 'active')?.count ?? 0;

  return {
    statusRows, cancelledByTier, cancelledByChannel, cancelledByFreq, cancelledByTenure,
    total, cancelled, pastDue, active,
    cancelledRate: pct(cancelled, total),
    atRiskRate: pct(cancelled + pastDue, total),
  };
}

// ---------------------------------------------------------------------------
// 2. Churn / at-risk — past_due profile
// ---------------------------------------------------------------------------

export function getChurnInsights() {
  const db = getDb();

  // At-risk: past_due profile vs active
  const profileComparison = db.prepare(`
    SELECT
      CASE WHEN subscription_status = 'active' THEN 'Active' ELSE 'At-risk' END as group_name,
      COUNT(*) as count,
      ROUND(AVG(COALESCE(total_tenure_days, 0))) as avg_tenure,
      ROUND(AVG(COALESCE(lifetime_value, 0))) as avg_ltv,
      ROUND(100.0 * AVG(has_login_in_month)) as login_rate,
      ROUND(100.0 * AVG(has_progress_in_month)) as progress_rate,
      ROUND(100.0 * AVG(has_used_eve_in_month)) as eve_rate,
      ROUND(AVG(COALESCE(content_watched_min, 0))) as avg_watch_mins,
      ROUND(100.0 * AVG(has_content_progress_within_15d)) as onboarding_activation_rate
    FROM ${LATEST_SNAPSHOT} ls
    WHERE subscription_status IN ('active', 'cancelled', 'past_due')
    GROUP BY group_name
  `).all() as {
    group_name: string; count: number; avg_tenure: number; avg_ltv: number;
    login_rate: number; progress_rate: number; eve_rate: number;
    avg_watch_mins: number; onboarding_activation_rate: number;
  }[];

  // Past_due by tier
  const pastDueByTier = db.prepare(`
    SELECT COALESCE(tier, 'Unknown') as tier, COUNT(*) as count,
      ROUND(AVG(COALESCE(total_tenure_days, 0))) as avg_tenure
    FROM ${LATEST_SNAPSHOT} ls
    WHERE subscription_status = 'past_due'
    GROUP BY tier ORDER BY count DESC
  `).all() as { tier: string; count: number; avg_tenure: number }[];

  // Early churners: cancelled with tenure < 90 days
  const earlyChurners = db.prepare(`
    SELECT COUNT(*) as count,
      ROUND(AVG(COALESCE(total_tenure_days, 0))) as avg_tenure,
      ROUND(100.0 * AVG(has_content_progress_within_15d)) as activation_rate,
      ROUND(100.0 * AVG(has_progress_in_month)) as progress_rate
    FROM ${LATEST_SNAPSHOT} ls
    WHERE subscription_status = 'cancelled' AND COALESCE(total_tenure_days, 999) <= 90
  `).get() as { count: number; avg_tenure: number; activation_rate: number; progress_rate: number };

  // Exit-stage: what was the engagement level of cancelled subscribers?
  const exitStage = db.prepare(`
    SELECT
      CASE
        WHEN has_used_eve_in_month = 1 THEN '4. Used EVE'
        WHEN has_progress_in_month = 1 THEN '3. Made progress'
        WHEN has_login_in_month = 1 THEN '2. Logged in only'
        ELSE '1. Never engaged'
      END as exit_stage,
      COUNT(*) as count
    FROM ${LATEST_SNAPSHOT} ls
    WHERE subscription_status IN ('cancelled', 'past_due')
    GROUP BY exit_stage ORDER BY exit_stage
  `).all() as { exit_stage: string; count: number }[];

  // Churn by acquisition channel (which channels have worst retention?)
  const churnByChannel = db.prepare(`
    SELECT COALESCE(acquisition_channel, 'Unknown') as channel,
      COUNT(*) as total,
      SUM(CASE WHEN subscription_status != 'active' THEN 1 ELSE 0 END) as churned,
      ROUND(100.0 * SUM(CASE WHEN subscription_status != 'active' THEN 1 ELSE 0 END) / COUNT(*)) as churn_rate
    FROM ${LATEST_SNAPSHOT} ls
    GROUP BY channel ORDER BY churn_rate DESC LIMIT 8
  `).all() as { channel: string; total: number; churned: number; churn_rate: number }[];

  return { profileComparison, pastDueByTier, earlyChurners, exitStage, churnByChannel };
}

// ---------------------------------------------------------------------------
// 3. Retention — who stays and why
// ---------------------------------------------------------------------------

export function getRetentionInsights() {
  const db = getDb();

  // Long-term retained: active subscribers with 365+ days tenure
  const retainedVsNew = db.prepare(`
    SELECT
      CASE
        WHEN total_tenure_days >= 365 THEN 'Long-term (365d+)'
        WHEN total_tenure_days >= 90 THEN 'Mid-term (90-364d)'
        ELSE 'New (< 90d)'
      END as cohort,
      COUNT(*) as count,
      ROUND(100.0 * AVG(has_login_in_month)) as login_rate,
      ROUND(100.0 * AVG(has_progress_in_month)) as progress_rate,
      ROUND(100.0 * AVG(has_used_eve_in_month)) as eve_rate,
      ROUND(AVG(COALESCE(content_watched_min, 0))) as avg_watch_mins,
      ROUND(AVG(COALESCE(lifetime_value, 0))) as avg_ltv
    FROM ${LATEST_SNAPSHOT} ls
    WHERE subscription_status = 'active' AND total_tenure_days IS NOT NULL
    GROUP BY cohort ORDER BY MIN(total_tenure_days)
  `).all() as {
    cohort: string; count: number; login_rate: number; progress_rate: number;
    eve_rate: number; avg_watch_mins: number; avg_ltv: number;
  }[];

  // Retained by tier
  const retainedByTier = db.prepare(`
    SELECT COALESCE(tier, 'Unknown') as tier,
      COUNT(*) as count,
      ROUND(AVG(COALESCE(total_tenure_days, 0))) as avg_tenure,
      ROUND(100.0 * AVG(has_login_in_month)) as login_rate,
      ROUND(100.0 * AVG(has_progress_in_month)) as progress_rate,
      ROUND(100.0 * AVG(has_used_eve_in_month)) as eve_rate
    FROM ${LATEST_SNAPSHOT} ls
    WHERE subscription_status = 'active'
    GROUP BY tier ORDER BY avg_tenure DESC
  `).all() as {
    tier: string; count: number; avg_tenure: number;
    login_rate: number; progress_rate: number; eve_rate: number;
  }[];

  // Retained by acquisition channel
  const retainedByChannel = db.prepare(`
    SELECT COALESCE(acquisition_channel, 'Unknown') as channel,
      COUNT(*) as count,
      ROUND(AVG(COALESCE(total_tenure_days, 0))) as avg_tenure,
      ROUND(100.0 * AVG(has_login_in_month)) as login_rate,
      ROUND(100.0 * AVG(has_progress_in_month)) as progress_rate
    FROM ${LATEST_SNAPSHOT} ls
    WHERE subscription_status = 'active'
    GROUP BY channel ORDER BY avg_tenure DESC LIMIT 8
  `).all() as { channel: string; count: number; avg_tenure: number; login_rate: number; progress_rate: number }[];

  // Top retainers: EVE + progress users
  const topRetainerProfile = db.prepare(`
    SELECT COUNT(*) as count,
      ROUND(AVG(COALESCE(total_tenure_days, 0))) as avg_tenure,
      ROUND(AVG(COALESCE(lifetime_value, 0))) as avg_ltv,
      ROUND(AVG(COALESCE(content_watched_min, 0))) as avg_watch_mins
    FROM ${LATEST_SNAPSHOT} ls
    WHERE subscription_status = 'active'
      AND has_login_in_month = 1
      AND has_progress_in_month = 1
      AND has_used_eve_in_month = 1
  `).get() as { count: number; avg_tenure: number; avg_ltv: number; avg_watch_mins: number };

  // Engagement ladder: full active base breakdown
  const engagementLadder = db.prepare(`
    SELECT
      CASE
        WHEN has_used_eve_in_month = 1 AND has_progress_in_month = 1 THEN 'Fully engaged (EVE + Progress)'
        WHEN has_progress_in_month = 1 THEN 'Progress only'
        WHEN has_login_in_month = 1 THEN 'Login only'
        ELSE 'Inactive'
      END as tier_label,
      COUNT(*) as count,
      ROUND(AVG(COALESCE(total_tenure_days, 0))) as avg_tenure
    FROM ${LATEST_SNAPSHOT} ls
    WHERE subscription_status = 'active'
    GROUP BY tier_label ORDER BY avg_tenure DESC
  `).all() as { tier_label: string; count: number; avg_tenure: number }[];

  return { retainedVsNew, retainedByTier, retainedByChannel, topRetainerProfile, engagementLadder };
}

// ---------------------------------------------------------------------------
// 4. EVE adoption & stickiness
// ---------------------------------------------------------------------------

export function getEVEInsights() {
  const db = getDb();

  // Three EVE segments: never, tried once, repeat
  const eveSegments = db.prepare(`
    SELECT
      CASE
        WHEN has_used_eve_in_month = 1 AND is_eve_repeat_user = 1 THEN 'Repeat EVE user'
        WHEN has_used_eve_in_month = 1 THEN 'Active EVE user'
        WHEN has_adopted_eve_before_month = 1 THEN 'Lapsed EVE user'
        ELSE 'Never used EVE'
      END as segment,
      COUNT(*) as count,
      ROUND(AVG(COALESCE(total_tenure_days, 0))) as avg_tenure,
      ROUND(AVG(COALESCE(lifetime_value, 0))) as avg_ltv,
      ROUND(100.0 * AVG(has_login_in_month)) as login_rate,
      ROUND(100.0 * AVG(has_progress_in_month)) as progress_rate,
      ROUND(AVG(COALESCE(content_watched_min, 0))) as avg_watch_mins,
      ROUND(AVG(COALESCE(eve_active_days, 0))) as avg_eve_days
    FROM ${LATEST_SNAPSHOT} ls
    WHERE subscription_status = 'active'
    GROUP BY segment ORDER BY avg_tenure DESC
  `).all() as {
    segment: string; count: number; avg_tenure: number; avg_ltv: number;
    login_rate: number; progress_rate: number; avg_watch_mins: number; avg_eve_days: number;
  }[];

  // Repeat EVE users: tier breakdown
  const repeatByTier = db.prepare(`
    SELECT COALESCE(tier, 'Unknown') as tier,
      COUNT(*) as total,
      SUM(CASE WHEN is_eve_repeat_user = 1 THEN 1 ELSE 0 END) as repeat_count,
      ROUND(100.0 * AVG(CASE WHEN has_used_eve_in_month = 1 THEN is_eve_repeat_user ELSE NULL END)) as repeat_rate_of_eve_users
    FROM ${LATEST_SNAPSHOT} ls
    WHERE subscription_status = 'active' AND has_used_eve_in_month = 1
    GROUP BY tier ORDER BY total DESC
  `).all() as { tier: string; total: number; repeat_count: number; repeat_rate_of_eve_users: number }[];

  // EVE adoption by acquisition channel
  const eveByChannel = db.prepare(`
    SELECT COALESCE(acquisition_channel, 'Unknown') as channel,
      COUNT(*) as total,
      SUM(has_used_eve_in_month) as eve_users,
      ROUND(100.0 * AVG(has_used_eve_in_month)) as adoption_rate
    FROM ${LATEST_SNAPSHOT} ls
    WHERE subscription_status = 'active'
    GROUP BY channel ORDER BY adoption_rate DESC LIMIT 8
  `).all() as { channel: string; total: number; eve_users: number; adoption_rate: number }[];

  // EVE adoption by tenure band — do longer-tenured subscribers adopt more?
  const eveByTenure = db.prepare(`
    SELECT
      CASE
        WHEN total_tenure_days <= 90 THEN '0-90d'
        WHEN total_tenure_days <= 180 THEN '91-180d'
        WHEN total_tenure_days <= 365 THEN '181-365d'
        ELSE '365d+'
      END as tenure_band,
      COUNT(*) as total,
      SUM(has_used_eve_in_month) as eve_users,
      ROUND(100.0 * AVG(has_used_eve_in_month)) as adoption_rate
    FROM ${LATEST_SNAPSHOT} ls
    WHERE subscription_status = 'active' AND total_tenure_days IS NOT NULL
    GROUP BY tenure_band ORDER BY MIN(total_tenure_days)
  `).all() as { tenure_band: string; total: number; eve_users: number; adoption_rate: number }[];

  // Platform preference of EVE users
  const eveByPlatform = db.prepare(`
    SELECT COALESCE(web_or_app, 'unknown') as platform,
      COUNT(*) as total,
      SUM(has_used_eve_in_month) as eve_users,
      ROUND(100.0 * AVG(has_used_eve_in_month)) as adoption_rate
    FROM ${LATEST_SNAPSHOT} ls
    WHERE subscription_status = 'active'
    GROUP BY platform ORDER BY adoption_rate DESC
  `).all() as { platform: string; total: number; eve_users: number; adoption_rate: number }[];

  return { eveSegments, repeatByTier, eveByChannel, eveByTenure, eveByPlatform };
}

// ---------------------------------------------------------------------------
// 5. Activation — who activates and what drives it
// ---------------------------------------------------------------------------

export function getActivationInsights() {
  const db = getDb();

  // Logged in vs not: profile comparison (active subscribers)
  const loginComparison = db.prepare(`
    SELECT
      CASE WHEN has_login_in_month = 1 THEN 'Logged in' ELSE 'Not logged in' END as segment,
      COUNT(*) as count,
      ROUND(AVG(COALESCE(total_tenure_days, 0))) as avg_tenure,
      ROUND(AVG(COALESCE(lifetime_value, 0))) as avg_ltv,
      ROUND(100.0 * AVG(has_progress_in_month)) as progress_rate,
      ROUND(100.0 * AVG(has_used_eve_in_month)) as eve_rate,
      ROUND(AVG(COALESCE(content_watched_min, 0))) as avg_watch_mins
    FROM ${LATEST_SNAPSHOT} ls
    WHERE subscription_status = 'active'
    GROUP BY segment ORDER BY count DESC
  `).all() as {
    segment: string; count: number; avg_tenure: number; avg_ltv: number;
    progress_rate: number; eve_rate: number; avg_watch_mins: number;
  }[];

  // Login rate by tier
  const loginByTier = db.prepare(`
    SELECT COALESCE(tier, 'Unknown') as tier,
      COUNT(*) as total,
      SUM(has_login_in_month) as logged_in,
      ROUND(100.0 * AVG(has_login_in_month)) as login_rate
    FROM ${LATEST_SNAPSHOT} ls
    WHERE subscription_status = 'active'
    GROUP BY tier ORDER BY login_rate DESC
  `).all() as { tier: string; total: number; logged_in: number; login_rate: number }[];

  // Login rate by acquisition channel
  const loginByChannel = db.prepare(`
    SELECT COALESCE(acquisition_channel, 'Unknown') as channel,
      COUNT(*) as total,
      SUM(has_login_in_month) as logged_in,
      ROUND(100.0 * AVG(has_login_in_month)) as login_rate
    FROM ${LATEST_SNAPSHOT} ls
    WHERE subscription_status = 'active'
    GROUP BY channel ORDER BY login_rate DESC LIMIT 8
  `).all() as { channel: string; total: number; logged_in: number; login_rate: number }[];

  // Login rate by platform
  const loginByPlatform = db.prepare(`
    SELECT COALESCE(web_or_app, 'unknown') as platform,
      COUNT(*) as total,
      SUM(has_login_in_month) as logged_in,
      ROUND(100.0 * AVG(has_login_in_month)) as login_rate
    FROM ${LATEST_SNAPSHOT} ls
    WHERE subscription_status = 'active'
    GROUP BY platform ORDER BY login_rate DESC
  `).all() as { platform: string; total: number; logged_in: number; login_rate: number }[];

  // New subscriber 15d activation: by tier and channel
  const newSubActivation = db.prepare(`
    SELECT COALESCE(tier, 'Unknown') as tier,
      COUNT(*) as new_subs,
      SUM(CASE WHEN has_content_progress_within_15d = 1 THEN 1 ELSE 0 END) as activated,
      ROUND(100.0 * AVG(CASE WHEN has_content_progress_within_15d = 1 THEN 1.0 ELSE 0.0 END)) as activation_rate
    FROM ${LATEST_SNAPSHOT} ls
    WHERE is_new_subscriber = 1
    GROUP BY tier ORDER BY activation_rate DESC
  `).all() as { tier: string; new_subs: number; activated: number; activation_rate: number }[];

  // Tenure bands and login rate — do longer subscribers login more?
  const loginByTenure = db.prepare(`
    SELECT
      CASE
        WHEN total_tenure_days <= 90 THEN '0-90d'
        WHEN total_tenure_days <= 365 THEN '91-365d'
        WHEN total_tenure_days <= 730 THEN '1-2 years'
        ELSE '2+ years'
      END as tenure_band,
      COUNT(*) as total,
      ROUND(100.0 * AVG(has_login_in_month)) as login_rate
    FROM ${LATEST_SNAPSHOT} ls
    WHERE subscription_status = 'active' AND total_tenure_days IS NOT NULL
    GROUP BY tenure_band ORDER BY MIN(total_tenure_days)
  `).all() as { tenure_band: string; total: number; login_rate: number }[];

  return { loginComparison, loginByTier, loginByChannel, loginByPlatform, newSubActivation, loginByTenure };
}

// ---------------------------------------------------------------------------
// 6. Transform — who engages with content and what drives it
// ---------------------------------------------------------------------------

export function getTransformInsights() {
  const db = getDb();

  // Engagement tier profiles
  const engagementTierProfiles = db.prepare(`
    SELECT
      CASE
        WHEN content_watched_min >= 500 THEN 'High (500m+)'
        WHEN content_watched_min >= 100 THEN 'Medium (100-499m)'
        WHEN content_watched_min > 0 THEN 'Low (1-99m)'
        ELSE 'None (0m)'
      END as eng_tier,
      COUNT(*) as count,
      ROUND(AVG(COALESCE(total_tenure_days, 0))) as avg_tenure,
      ROUND(AVG(COALESCE(lifetime_value, 0))) as avg_ltv,
      ROUND(100.0 * AVG(has_used_eve_in_month)) as eve_rate,
      ROUND(100.0 * AVG(is_eve_repeat_user)) as eve_repeat_rate,
      ROUND(AVG(COALESCE(n_content_viewed, 0))) as avg_content_items,
      ROUND(AVG(COALESCE(content_watched_min, 0))) as avg_watch_mins
    FROM ${LATEST_SNAPSHOT} ls
    WHERE subscription_status = 'active'
    GROUP BY eng_tier ORDER BY MIN(COALESCE(content_watched_min, -1)) DESC
  `).all() as {
    eng_tier: string; count: number; avg_tenure: number; avg_ltv: number;
    eve_rate: number; eve_repeat_rate: number; avg_content_items: number; avg_watch_mins: number;
  }[];

  // High engagers by tier
  const highEngagersByTier = db.prepare(`
    SELECT COALESCE(tier, 'Unknown') as tier,
      COUNT(*) as total,
      SUM(CASE WHEN COALESCE(content_watched_min, 0) >= 500 THEN 1 ELSE 0 END) as high_engagers,
      ROUND(100.0 * AVG(CASE WHEN COALESCE(content_watched_min, 0) >= 500 THEN 1.0 ELSE 0.0 END)) as high_eng_rate
    FROM ${LATEST_SNAPSHOT} ls
    WHERE subscription_status = 'active'
    GROUP BY tier ORDER BY high_eng_rate DESC
  `).all() as { tier: string; total: number; high_engagers: number; high_eng_rate: number }[];

  // High engagers by acquisition channel
  const highEngagersByChannel = db.prepare(`
    SELECT COALESCE(acquisition_channel, 'Unknown') as channel,
      COUNT(*) as total,
      SUM(CASE WHEN COALESCE(content_watched_min, 0) >= 500 THEN 1 ELSE 0 END) as high_engagers,
      ROUND(100.0 * AVG(CASE WHEN COALESCE(content_watched_min, 0) >= 500 THEN 1.0 ELSE 0.0 END)) as high_eng_rate
    FROM ${LATEST_SNAPSHOT} ls
    WHERE subscription_status = 'active'
    GROUP BY channel ORDER BY high_eng_rate DESC LIMIT 8
  `).all() as { channel: string; total: number; high_engagers: number; high_eng_rate: number }[];

  // Platform preference of content engagers
  const highEngagersByPlatform = db.prepare(`
    SELECT COALESCE(web_or_app, 'unknown') as platform,
      COUNT(*) as total,
      SUM(CASE WHEN COALESCE(content_watched_min, 0) >= 100 THEN 1 ELSE 0 END) as engaged,
      ROUND(100.0 * AVG(CASE WHEN COALESCE(content_watched_min, 0) >= 100 THEN 1.0 ELSE 0.0 END)) as engagement_rate
    FROM ${LATEST_SNAPSHOT} ls
    WHERE subscription_status = 'active'
    GROUP BY platform ORDER BY engagement_rate DESC
  `).all() as { platform: string; total: number; engaged: number; engagement_rate: number }[];

  // Tenure correlation: do longer subscribers engage more?
  const engByTenure = db.prepare(`
    SELECT
      CASE
        WHEN total_tenure_days <= 90 THEN '0-90d'
        WHEN total_tenure_days <= 365 THEN '91-365d'
        WHEN total_tenure_days <= 730 THEN '1-2 years'
        ELSE '2+ years'
      END as tenure_band,
      COUNT(*) as total,
      ROUND(100.0 * AVG(has_progress_in_month)) as progress_rate,
      ROUND(AVG(COALESCE(content_watched_min, 0))) as avg_watch_mins
    FROM ${LATEST_SNAPSHOT} ls
    WHERE subscription_status = 'active' AND total_tenure_days IS NOT NULL
    GROUP BY tenure_band ORDER BY MIN(total_tenure_days)
  `).all() as { tenure_band: string; total: number; progress_rate: number; avg_watch_mins: number }[];

  // EVE × progress correlation
  const eveProgressCorrelation = db.prepare(`
    SELECT
      CASE
        WHEN has_used_eve_in_month = 1 AND has_progress_in_month = 1 THEN 'EVE + Progress'
        WHEN has_used_eve_in_month = 1 THEN 'EVE only'
        WHEN has_progress_in_month = 1 THEN 'Progress only'
        ELSE 'Neither'
      END as segment,
      COUNT(*) as count,
      ROUND(AVG(COALESCE(content_watched_min, 0))) as avg_watch_mins,
      ROUND(AVG(COALESCE(total_tenure_days, 0))) as avg_tenure
    FROM ${LATEST_SNAPSHOT} ls
    WHERE subscription_status = 'active'
    GROUP BY segment ORDER BY avg_watch_mins DESC
  `).all() as { segment: string; count: number; avg_watch_mins: number; avg_tenure: number }[];

  return { engagementTierProfiles, highEngagersByTier, highEngagersByChannel, highEngagersByPlatform, engByTenure, eveProgressCorrelation };
}

// ---------------------------------------------------------------------------
// 7. Demographics — gender, age, language
// ---------------------------------------------------------------------------

export function getDemographicInsights() {
  const db = getDb();

  // Gender breakdown: count, engagement rates, EVE adoption
  const byGender = db.prepare(`
    SELECT COALESCE(gender, 'Not Available') as gender,
      COUNT(*) as count,
      ROUND(100.0 * AVG(has_login_in_month)) as login_rate,
      ROUND(100.0 * AVG(has_progress_in_month)) as progress_rate,
      ROUND(100.0 * AVG(has_used_eve_in_month)) as eve_rate,
      ROUND(AVG(COALESCE(content_watched_min, 0))) as avg_watch_mins,
      ROUND(AVG(COALESCE(lifetime_value, 0))) as avg_ltv,
      ROUND(AVG(COALESCE(total_tenure_days, 0))) as avg_tenure,
      ROUND(100.0 * SUM(CASE WHEN subscription_status != 'active' THEN 1 ELSE 0 END) / COUNT(*)) as churn_rate
    FROM ${LATEST_SNAPSHOT} ls
    GROUP BY gender ORDER BY count DESC
  `).all() as {
    gender: string; count: number; login_rate: number; progress_rate: number;
    eve_rate: number; avg_watch_mins: number; avg_ltv: number; avg_tenure: number; churn_rate: number;
  }[];

  // Age bracket breakdown
  const byAge = db.prepare(`
    SELECT COALESCE(age_bracket, 'Not Available') as age_bracket,
      COUNT(*) as count,
      ROUND(100.0 * AVG(has_login_in_month)) as login_rate,
      ROUND(100.0 * AVG(has_progress_in_month)) as progress_rate,
      ROUND(100.0 * AVG(has_used_eve_in_month)) as eve_rate,
      ROUND(AVG(COALESCE(content_watched_min, 0))) as avg_watch_mins,
      ROUND(AVG(COALESCE(lifetime_value, 0))) as avg_ltv,
      ROUND(100.0 * SUM(CASE WHEN subscription_status != 'active' THEN 1 ELSE 0 END) / COUNT(*)) as churn_rate
    FROM ${LATEST_SNAPSHOT} ls
    GROUP BY age_bracket ORDER BY age_bracket
  `).all() as {
    age_bracket: string; count: number; login_rate: number; progress_rate: number;
    eve_rate: number; avg_watch_mins: number; avg_ltv: number; churn_rate: number;
  }[];

  // Language breakdown
  const byLanguage = db.prepare(`
    SELECT COALESCE(language, 'Unknown') as language,
      COUNT(*) as count,
      ROUND(100.0 * AVG(has_login_in_month)) as login_rate,
      ROUND(100.0 * AVG(has_progress_in_month)) as progress_rate,
      ROUND(100.0 * AVG(has_used_eve_in_month)) as eve_rate,
      ROUND(AVG(COALESCE(lifetime_value, 0))) as avg_ltv,
      ROUND(100.0 * SUM(CASE WHEN subscription_status != 'active' THEN 1 ELSE 0 END) / COUNT(*)) as churn_rate
    FROM ${LATEST_SNAPSHOT} ls
    GROUP BY language ORDER BY count DESC
  `).all() as {
    language: string; count: number; login_rate: number; progress_rate: number;
    eve_rate: number; avg_ltv: number; churn_rate: number;
  }[];

  // Acquisition source (more granular than channel: Facebook, Google, Instagram…)
  const byAcqSource = db.prepare(`
    SELECT COALESCE(acquisition_source, 'Unknown') as source,
      COUNT(*) as count,
      ROUND(100.0 * AVG(has_login_in_month)) as login_rate,
      ROUND(100.0 * AVG(has_progress_in_month)) as progress_rate,
      ROUND(100.0 * AVG(has_used_eve_in_month)) as eve_rate,
      ROUND(AVG(COALESCE(lifetime_value, 0))) as avg_ltv,
      ROUND(100.0 * SUM(CASE WHEN subscription_status != 'active' THEN 1 ELSE 0 END) / COUNT(*)) as churn_rate
    FROM ${LATEST_SNAPSHOT} ls
    GROUP BY source ORDER BY count DESC LIMIT 12
  `).all() as {
    source: string; count: number; login_rate: number; progress_rate: number;
    eve_rate: number; avg_ltv: number; churn_rate: number;
  }[];

  // Payment method
  const byPaymentMethod = db.prepare(`
    SELECT COALESCE(payment_method_type, 'Unknown') as method,
      COUNT(*) as count,
      ROUND(100.0 * AVG(has_login_in_month)) as login_rate,
      ROUND(100.0 * AVG(has_progress_in_month)) as progress_rate,
      ROUND(AVG(COALESCE(lifetime_value, 0))) as avg_ltv,
      ROUND(100.0 * SUM(CASE WHEN subscription_status != 'active' THEN 1 ELSE 0 END) / COUNT(*)) as churn_rate
    FROM ${LATEST_SNAPSHOT} ls
    GROUP BY method ORDER BY count DESC
  `).all() as {
    method: string; count: number; login_rate: number; progress_rate: number; avg_ltv: number; churn_rate: number;
  }[];

  // Order type: New vs Renewal vs Upgrade vs Downgrade — who retains best?
  const byOrderType = db.prepare(`
    SELECT COALESCE(order_type, 'Unknown') as order_type,
      COUNT(*) as count,
      ROUND(100.0 * AVG(has_login_in_month)) as login_rate,
      ROUND(100.0 * AVG(has_progress_in_month)) as progress_rate,
      ROUND(AVG(COALESCE(lifetime_value, 0))) as avg_ltv,
      ROUND(100.0 * SUM(CASE WHEN subscription_status != 'active' THEN 1 ELSE 0 END) / COUNT(*)) as churn_rate
    FROM ${LATEST_SNAPSHOT} ls
    GROUP BY order_type ORDER BY count DESC
  `).all() as {
    order_type: string; count: number; login_rate: number; progress_rate: number; avg_ltv: number; churn_rate: number;
  }[];

  // Gender × EVE adoption cross-tab
  const genderEVE = db.prepare(`
    SELECT COALESCE(gender, 'Not Available') as gender,
      COUNT(*) as total,
      SUM(has_used_eve_in_month) as eve_users,
      ROUND(100.0 * AVG(has_used_eve_in_month)) as eve_rate,
      SUM(is_eve_repeat_user) as repeat_users,
      ROUND(100.0 * AVG(CASE WHEN has_used_eve_in_month=1 THEN is_eve_repeat_user ELSE NULL END)) as repeat_rate
    FROM ${LATEST_SNAPSHOT} ls
    WHERE subscription_status = 'active'
    GROUP BY gender ORDER BY total DESC
  `).all() as {
    gender: string; total: number; eve_users: number; eve_rate: number;
    repeat_users: number; repeat_rate: number;
  }[];

  // Age bracket × EVE adoption
  const ageEVE = db.prepare(`
    SELECT COALESCE(age_bracket, 'Not Available') as age_bracket,
      COUNT(*) as total,
      ROUND(100.0 * AVG(has_used_eve_in_month)) as eve_rate,
      ROUND(100.0 * AVG(has_progress_in_month)) as progress_rate
    FROM ${LATEST_SNAPSHOT} ls
    WHERE subscription_status = 'active' AND age_bracket IS NOT NULL
    GROUP BY age_bracket ORDER BY age_bracket
  `).all() as { age_bracket: string; total: number; eve_rate: number; progress_rate: number }[];

  return {
    byGender, byAge, byLanguage, byAcqSource, byPaymentMethod, byOrderType,
    genderEVE, ageEVE,
  };
}
