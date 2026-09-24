---
title: 'Mindvalley Customer Cohorts'
slug: 'mindvalley-customer-cohorts'
scope: product
status: resolved
parent: null
children: []
created: 2026-04-10
updated: 2026-04-10
children: [data-pipeline, cohort-identification-engine, behavior-forecasting, feature-release-impact, recommendation-engine, role-based-dashboard]
resolution: 8/8
---

# Mindvalley Customer Cohorts

## Problem

When a KPI moves at Mindvalley, PMs depend on analysts to explain why. This process takes approximately one week, answers the question that was asked — not the question that mattered — and even when the root cause is found, teams often don't know what intervention to make.

Three distinct failure modes compound each other:
1. **Speed**: Root-cause diagnosis takes ~1 week, during which wrong assumptions drive decisions.
2. **Coverage**: Analysts answer the stated question but miss unstated drivers. Example: WAU declined because engaged customers completed their Quest and had no next step — the team was looking for churn signals while their best customers were graduating unattended.
3. **Actionability**: Even when the real cause is identified, there is no playbook. Insight lands in a Slack thread and dies there.

The result: customer cohorts that need timely intervention — re-engagement before Quest completion, upsell at the moment of high engagement, win-back for at-risk segments — fall through the cracks because the system cannot surface what wasn't asked, and cannot translate findings into action.

## Vision

A proactive intelligence layer that surfaces cohort-level insights before anyone asks — automatically identifying why KPIs move, which customer segments need intervention, and what to do next.

Today, Mindvalley reacts: a metric drops, a PM asks an analyst, a week passes, an incomplete answer arrives, and no one knows what action to take. The system inverts this. Instead of answering questions, it raises them: "Your Quest-completing cohort — 3,400 users this week — has no next step. Here's the recommended intervention and its projected revenue impact."

**6-month targets:**
- Retention: 63% → 80%
- Incremental weekly revenue attributable to cohort interventions: +$100K → +$500K
- Root-cause diagnosis time: 1 week → same day

The product serves product and marketing teams directly, eliminating the analyst bottleneck for cohort-level questions while freeing analysts for deeper, non-routine work.

## Users

Three distinct user types, each with a tailored dashboard view. No data science background assumed — all three are business users who need outputs, not tools to build their own analysis.

**Marketing team — Campaign builders**
Job-to-be-done: Identify which cohorts to target for reactivation or growth campaigns.
What they see: Cohorts ranked by intervention potential (re-engagement, upsell, win-back), with recommended action type (e.g., reactivation email) and projected revenue impact.
What they do: Take the cohort to their campaign tool and build the outreach.

**Content team — Content creators**
Job-to-be-done: Identify gaps in the content library for specific cohorts.
What they see: Cohorts with unmet content needs — e.g., Quest-completing users who have no obvious next step. Surfaced as content opportunities, not raw data.
What they do: Brief or build new Quests/content to fill the gap.

**Product team — Feature prioritizers**
Job-to-be-done: Understand which features to build or prioritize based on cohort impact.
What they see: Cohort behavior tied to product feature usage, with forecasted impact of potential feature investments on KPIs and revenue.
What they do: Adjust roadmap priorities based on projected cohort outcomes.

**Non-users (explicitly excluded):**
Data scientists — they build and maintain the models underneath. This dashboard is not for them; they interact with the underlying data infrastructure directly.

## Core Capabilities

### 1. Cohort Identification
Automatically surfaces customer segments without anyone asking. Uses a hybrid approach:
- **ML-driven clustering**: discovers non-obvious cohorts from behavioral patterns across purchase history, Quest progress, engagement signals, and subscription tier
- **Analyst-defined rules**: analysts configure named cohorts based on business logic (e.g., "users within 7 days of Quest completion")

Analysts shift from ad-hoc query runners to system configurers — they maintain cohort definitions rather than answering one-off questions.

### 2. Behavior Forecasting
Predicts what each cohort will do next, at time horizons matched to each team's action cycle:
- **14–30 days**: churn risk, re-engagement windows — actionable for marketing campaigns
- **30+ days**: Quest completion trajectory, content gap signals — actionable for content creation
- **Quarterly**: feature impact on cohort KPIs and revenue — actionable for product roadmap planning

### 3. Feature Release Impact Forecasting
Two-mode capability trained on Mindvalley's existing release history (changelog/release log):
- **Pre-release**: given a planned feature, forecast its projected impact on KPIs and revenue by cohort before it ships
- **Post-release**: after a feature launches, attribute actual KPI changes to the release — separating feature impact from market noise

### 4. Tailored Recommendations by Role
Each team sees recommendations scoped to their action space — same cohort data, different outputs:
- **Marketing**: cohorts ranked by intervention potential (reactivation, upsell, win-back) with recommended campaign type and projected revenue impact
- **Content**: cohorts with content gaps surfaced as creation briefs — e.g., "Quest-completing cohort has no next step: 3 recommended Quest themes"
- **Product**: features ranked by projected cohort impact, with pre/post release attribution to validate past decisions

## Boundaries

**In v1, this product stops at the recommendation.** It identifies cohorts, forecasts behavior, and tells each team what to do — but does not execute anything. Users take the recommendation to their own tools.

Explicitly out of scope for v1:
- **No campaign execution**: does not send emails, trigger in-app messages, or push to any marketing platform
- **No CMS integration**: content recommendations are surfaced in the dashboard; content teams brief and build in their own tools
- **No product management integration**: feature prioritization insights are surfaced in the dashboard; PMs update Jira/Linear/roadmap tools manually
- **No raw data access**: the dashboard is not a query tool. Data scientists work with the underlying data infrastructure directly, not through this product
- **No customer support workflows**: support team is not a user; cohort insights do not feed into ticketing or support tooling
- **No self-serve model tuning**: business users cannot adjust ML model parameters. Analysts manage cohort definitions; data scientists manage models

v2 consideration: integrations with email platforms, CMS, and product management tools to close the loop between recommendation and action.

## Success Criteria

**6-month targets:**
| Metric | Baseline | Target |
|--------|----------|--------|
| Weekly retention rate | 63% | 80% |
| Incremental weekly revenue (from actions taken on recommendations) | $100K | $500K |
| Recommendation act-on rate (cohort recommendations that result in a campaign, content piece, or feature) | — | 50% |
| Root-cause diagnosis time | ~1 week | Same day |

**Attribution model**: Revenue and retention gains are attributed to campaigns, content, and features shipped by marketing and product teams — not to the tool directly. The tool's job is to surface the right targets; the teams' job is to act on them.

**Minimum bar (v1 success floor)**: Directional improvement in retention (any meaningful movement toward 80%) combined with meaningful adoption (35%+ act-on rate) constitutes a success worth continuing. The full targets are aspirational; the floor is "is this changing how decisions get made?"

**Adoption definition**: A recommendation is "acted on" when a cohort surfaced by the system results in a campaign launched, content piece created, or feature prioritized within 30 days of surfacing.

## Open Questions

1. **Data freshness expectation**: Data is sourced from multiple systems on a daily batch cycle. "Same-day insights" means insights from the prior day's data, surfaced each morning — not real-time. This needs to be communicated clearly to teams so they don't expect live signals.

2. **Data pipeline ownership**: With multi-source data, who owns pipeline reliability and data quality? If a source fails or goes stale, cohort recommendations become unreliable. This ownership needs to be defined before launch.

3. **Historical data sufficiency for ML**: How much historical data exists across purchase history, Quest progress, engagement signals, and subscription tier? The behavior forecasting models need sufficient history to train reliably — especially for rare events like high-value churn.

4. **Release history structure**: Existing feature release data is confirmed to exist but its structure and cleanliness is unknown. Pre-release forecasting accuracy depends on how well past releases are documented and tagged. May require cleanup before training.

5. **Analyst capacity for cohort configuration**: Analysts shift from ad-hoc queries to managing cohort definitions. Is there dedicated analyst capacity for this, and is the tooling for defining rule-based cohorts within their skill set?

6. **Recommendation confidence threshold**: At what confidence level should a cohort recommendation be surfaced? Surfacing low-confidence recommendations damages trust; being too conservative limits value. Threshold needs to be defined during model development.

## Epics

Dependency order — each epic builds on the previous:

| # | Epic | Purpose |
|---|------|---------|
| 1 | **Data Pipeline** | Unify purchase history, Quest progress, engagement signals, and subscription tier from multiple sources into a clean, reliable daily feed |
| 2 | **Cohort Identification Engine** | ML clustering to discover unknown segments + analyst tooling to define rule-based cohorts |
| 3 | **Behavior Forecasting** | Predict cohort-level actions at 14–30 day and quarterly horizons (churn, re-engagement, purchase) |
| 4 | **Feature Release Impact** | Pre-release impact forecasting and post-release KPI attribution using historical release data |
| 5 | **Recommendation Engine** | Translate cohort and forecast signals into role-specific recommendations with projected impact |
| 6 | **Role-Based Dashboard** | Tailored views for marketing (campaign targeting), content (gap analysis), and product (feature prioritization) |
