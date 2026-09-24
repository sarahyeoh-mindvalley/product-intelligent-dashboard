WITH raw_orders AS (
  SELECT DISTINCT *
  FROM `mv-segment-data-warehouse.production_osiris_mindvalley.order_completed`
  WHERE
    timestamp >= TIMESTAMP(DATE_SUB(CURRENT_DATE(), INTERVAL 52 WEEK))
    AND (
      REGEXP_CONTAINS(products, 'membership')
      OR REGEXP_CONTAINS(
        products,
        r'id":"3196"|id":"4682"|id":"4001"|id":"4821"|id":"3943"|id":"4823"|id":"4125"|id":"4820"|id":"4344"|id":"4827"|id":"4091"|id":"4822"|id":"4491"|id":"4683"|id":"4516"|id":"4824"|id":"4517"|id":"4829"|id":"4519"|id":"4825"|id":"4520"|id":"4837"|id":"4518"|id":"4836"|id":"5005"|id":"5035"|id":"5048"|id":"4750"|id":"5095"|id":"5094"|id":"5093"|id":"5092"|id":"5086"'
      )
    )
  QUALIFY ROW_NUMBER() OVER (
    PARTITION BY purchase_record_id
    ORDER BY loaded_at DESC
  ) = 1
),

external_users AS (
  SELECT DISTINCT user_id
  FROM `mv-prod-analytics-schema.l3_pii.dim_user_pii`
  WHERE is_mv_user = FALSE
),

sales_order AS (
  SELECT *
  FROM `mv-prod-analytics-schema.l3_sales.fact_sales_order`
  WHERE order_timestamp >= TIMESTAMP(DATE_SUB(CURRENT_DATE(), INTERVAL 52 WEEK))
),

payment AS (
  SELECT
    order_id,
    payment_id,
    payment_method_id,
    payment_amount,
    payment_timestamp,
    payment_status,
    payment_type,
    subscription_payment_number
  FROM `mv-prod-analytics-schema.l3_sales.fact_sales_payment`
),

payment_method AS (
  SELECT
    id,
    type
  FROM `mv-prod-analytics-schema.l3_sales.dim_payment_method`
),

attribution AS (
  SELECT *
  FROM `mv-prod-analytics-schema.l3_sales.fact_sales_attribution`
),

products AS (
  SELECT *
  FROM `mv-prod-analytics-schema.l3_common.dim_product`
),

discounts AS (
  SELECT *
  FROM `mv-prod-analytics-schema.l3_sales.dim_discount`
),

-- NEW: subscription_term_id on sales_order -> subscription_id
subscription_term AS (
  SELECT
    subscription_term_id,
    subscription_id
  FROM `mv-prod-analytics-schema.l3_sales.dim_subscription_term`
),

-- NEW: subscription-level cancellation / churn fields
subscription AS (
  SELECT
    subscription_id,
    cancellation_request_date,
    is_involuntary_churn,
    canceled_at,
    cancellation_reason,
    cancellation_comment
  FROM `mv-prod-analytics-schema.l3_sales.dim_subscription`
),

activity_raw AS (
  SELECT user_id, `timestamp` AS login_time
  FROM `mv-segment-data-warehouse.production_mindvalley_ios_view.screen_viewed_view`
  WHERE user_level_super_property IN (3,4)

  UNION ALL

  SELECT user_id, `timestamp`
  FROM `mv-segment-data-warehouse.production_mindvalley_android_view.screen_viewed_view`
  WHERE user_level_super_property IN (3,4)

  UNION ALL

  SELECT user_id, `timestamp`
  FROM `mv-segment-data-warehouse.mindvalley_com_production_view.page_viewed_view`
  WHERE user_level_super_property IN (3,4)

  UNION ALL

  SELECT user_id, `timestamp`
  FROM `mv-segment-data-warehouse.mindvalley_com_production_view.pages_view`

  UNION ALL

  SELECT user_id, `timestamp`
  FROM `mv-segment-data-warehouse.production_mindvalley_android_view.identifies_view`
  WHERE CAST(user_level AS STRING) IN ('3','4')

  UNION ALL

  SELECT user_id, `timestamp`
  FROM `mv-segment-data-warehouse.production_mindvalley_ios_view.identifies_view`
  WHERE CAST(user_level AS STRING) IN ('3','4')

  UNION ALL

  SELECT user_id, `timestamp`
  FROM `mv-segment-data-warehouse.mindvalley_com_production_view.identifies_view`
  WHERE CAST(user_level AS STRING) IN ('3','4')

  UNION ALL

  SELECT user_id, `timestamp`
  FROM `mv-segment-data-warehouse.mindvalley_com_production_view.user_signed_up_view`

  UNION ALL

  SELECT user_id, `timestamp`
  FROM `mv-segment-data-warehouse.mindvalley_com_production_view.user_logged_in_view`

  UNION ALL

  SELECT
    user_id,
    TIMESTAMP(date) AS timestamp
  FROM `mv-prod-sre-warehouse.auth0_audit_logs.auth0-mindvalley-logs`
  WHERE type IN (
    's',
    'sepft',
    'ssa',
    'seoobft',
    'seotpft',
    'sercft',
    'sertft',
    'seacft',
    'scoa',
    'sens'
  )
),

activation_raw AS (
  SELECT user_id, `timestamp` AS activate_time
  FROM `mv-segment-data-warehouse.production_mindvalley_ios_view.quest_asset_played_view`
  WHERE preview_mode != TRUE

  UNION ALL

  SELECT user_id, `timestamp`
  FROM `mv-segment-data-warehouse.production_mindvalley_android_view.quest_asset_played_view`
  WHERE preview_mode != TRUE

  UNION ALL

  SELECT user_id, `timestamp`
  FROM `mv-segment-data-warehouse.mindvalley_com_production_view.quest_asset_played_view`
  WHERE preview_mode != TRUE

  UNION ALL

  SELECT user_id, `timestamp`
  FROM `mv-segment-data-warehouse.production_mindvalley_ios_view.meditation_media_played_view`

  UNION ALL

  SELECT user_id, `timestamp`
  FROM `mv-segment-data-warehouse.production_mindvalley_android_view.meditation_media_played_view`

  UNION ALL

  SELECT user_id, `timestamp`
  FROM `mv-segment-data-warehouse.mindvalley_com_production_view.meditation_media_played_view`

  UNION ALL

  SELECT user_id, `timestamp`
  FROM `mv-segment-data-warehouse.production_mindvalley_ios_view.eve_ai_user_prompted_view`
  WHERE chat_mode != 'eve_onboarding'

  UNION ALL

  SELECT user_id, `timestamp`
  FROM `mv-segment-data-warehouse.production_mindvalley_android_view.eve_ai_user_prompted_view`
  WHERE chat_mode != 'eve_onboarding'

  UNION ALL

  SELECT user_id, `timestamp`
  FROM `mv-segment-data-warehouse.mindvalley_com_production_view.eve_ai_user_prompted_view`
  WHERE chat_mode != 'eve_onboarding'

  UNION ALL

  SELECT user_id, `timestamp`
  FROM `mv-segment-data-warehouse.production_mindvalley_ios_view.eve_ai_followup_question_clicked_view`
  WHERE chat_mode != 'eve_onboarding'

  UNION ALL

  SELECT user_id, `timestamp`
  FROM `mv-segment-data-warehouse.production_mindvalley_android_view.eve_ai_followup_question_clicked_view`
  WHERE chat_mode != 'eve_onboarding'

  UNION ALL

  SELECT user_id, `timestamp`
  FROM `mv-segment-data-warehouse.mindvalley_com_production_view.eve_ai_followup_question_clicked_view`
  WHERE chat_mode != 'eve_onboarding'

  UNION ALL

  SELECT user_id, `timestamp`
  FROM `mv-segment-data-warehouse.production_mindvalley_ios_view.eve_ai_predefined_prompt_clicked_view`
  WHERE chat_mode != 'eve_onboarding'

  UNION ALL

  SELECT user_id, `timestamp`
  FROM `mv-segment-data-warehouse.production_mindvalley_android_view.eve_ai_predefined_prompt_clicked_view`
  WHERE chat_mode != 'eve_onboarding'

  UNION ALL

  SELECT user_id, `timestamp`
  FROM `mv-segment-data-warehouse.mindvalley_com_production_view.eve_ai_predefined_prompt_clicked_view`
  WHERE chat_mode != 'eve_onboarding'

  UNION ALL

  SELECT user_id, `timestamp`
  FROM `mv-segment-data-warehouse.production_mindvalley_ios_view.shorts_played_view`

  UNION ALL

  SELECT user_id, `timestamp`
  FROM `mv-segment-data-warehouse.production_mindvalley_android_view.shorts_played_view`

  UNION ALL

  SELECT user_id, `timestamp`
  FROM `mv-segment-data-warehouse.mindvalley_com_production_view.shorts_played_view`

  UNION ALL

  SELECT user_id, `timestamp`
  FROM `mv-segment-data-warehouse.production_mindvalley_ios_view.channel_media_content_played_view`

  UNION ALL

  SELECT user_id, `timestamp`
  FROM `mv-segment-data-warehouse.production_mindvalley_android_view.channel_media_content_played_view`

  UNION ALL

  SELECT user_id, `timestamp`
  FROM `mv-segment-data-warehouse.mindvalley_com_production_view.channel_media_content_played_view`

  UNION ALL

  SELECT user_id, `timestamp`
  FROM `mv-segment-data-warehouse.production_mindvalley_ios_view.eve_ai_cta_clicked_view`
  WHERE quest_name IS NOT NULL

  UNION ALL

  SELECT user_id, `timestamp`
  FROM `mv-segment-data-warehouse.production_mindvalley_android_view.eve_ai_cta_clicked_view`
  WHERE quest_name IS NOT NULL

  UNION ALL

  SELECT user_id, `timestamp`
  FROM `mv-segment-data-warehouse.mindvalley_com_production_view.eve_ai_cta_clicked_view`
  WHERE quest_name IS NOT NULL

  UNION ALL

  SELECT user_id, `timestamp`
  FROM `mv-segment-data-warehouse.production_mindvalley_ios_view.eve_ai_quiz_result_page_loaded_view`

  UNION ALL

  SELECT user_id, `timestamp`
  FROM `mv-segment-data-warehouse.production_mindvalley_android_view.eve_ai_quiz_result_page_loaded_view`

  UNION ALL

  SELECT user_id, `timestamp`
  FROM `mv-segment-data-warehouse.mindvalley_com_production_view.eve_ai_quiz_result_page_loaded_view`
),

content_play_raw AS (
  SELECT user_id, `timestamp` AS play_time
  FROM `mv-segment-data-warehouse.production_mindvalley_ios_view.quest_asset_played_view`
  WHERE preview_mode != TRUE

  UNION ALL

  SELECT user_id, `timestamp`
  FROM `mv-segment-data-warehouse.production_mindvalley_android_view.quest_asset_played_view`
  WHERE preview_mode != TRUE

  UNION ALL

  SELECT user_id, `timestamp`
  FROM `mv-segment-data-warehouse.mindvalley_com_production_view.quest_asset_played_view`
  WHERE preview_mode != TRUE

  UNION ALL

  SELECT user_id, `timestamp`
  FROM `mv-segment-data-warehouse.production_mindvalley_ios_view.meditation_media_played_view`

  UNION ALL

  SELECT user_id, `timestamp`
  FROM `mv-segment-data-warehouse.production_mindvalley_android_view.meditation_media_played_view`

  UNION ALL

  SELECT user_id, `timestamp`
  FROM `mv-segment-data-warehouse.mindvalley_com_production_view.meditation_media_played_view`
),

-- NEW: for subscriptions that were canceled, find the earliest content-play event
-- that happened AFTER canceled_at
post_cancel_content AS (
  SELECT
    o.user_id,
    o.purchase_record_id,
    sub.canceled_at,
    MIN(cp.play_time) AS first_post_cancel_play_time,
    COUNT(cp.play_time) AS post_cancel_play_count
  FROM raw_orders o
  INNER JOIN sales_order s
    ON o.user_id = s.user_id
    AND DATE(s.order_timestamp) = DATE(o.timestamp)
  INNER JOIN subscription_term st
    ON s.subscription_term_id = st.subscription_term_id
  INNER JOIN subscription sub
    ON st.subscription_id = sub.subscription_id
  LEFT JOIN content_play_raw cp
    ON o.user_id = cp.user_id
    AND cp.play_time > sub.canceled_at
  WHERE sub.canceled_at IS NOT NULL
  GROUP BY
    o.user_id,
    o.purchase_record_id,
    sub.canceled_at
),

activity AS (
  SELECT
    o.user_id,
    o.purchase_record_id,
    MIN(ar.login_time) AS first_login_time
  FROM raw_orders o
  LEFT JOIN activity_raw ar
    ON o.user_id = ar.user_id
    AND ar.login_time >= o.timestamp
  GROUP BY o.user_id, o.purchase_record_id
),

activation_events AS (
  SELECT
    o.user_id,
    o.purchase_record_id,
    MIN(act.activate_time) AS first_activate_time
  FROM raw_orders o
  LEFT JOIN activation_raw act
    ON o.user_id = act.user_id
    AND act.activate_time >= o.timestamp
  GROUP BY o.user_id, o.purchase_record_id
),

post_refund_content AS (
  SELECT
    o.user_id,
    o.purchase_record_id,
    s.refund_timestamp,
    MIN(cp.play_time) AS first_post_refund_play_time,
    COUNT(cp.play_time) AS post_refund_play_count
  FROM raw_orders o
  INNER JOIN sales_order s
    ON o.user_id = s.user_id
    AND DATE(s.order_timestamp) = DATE(o.timestamp)
  LEFT JOIN content_play_raw cp
    ON o.user_id = cp.user_id
    AND cp.play_time > s.refund_timestamp
  WHERE s.refund_timestamp IS NOT NULL
  GROUP BY
    o.user_id,
    o.purchase_record_id,
    s.refund_timestamp
),

summary AS (
  SELECT DISTINCT
    o.user_id,
    o.timestamp AS purchase_timestamp,
    o.purchase_record_id,
    o.revenue,
    o.products,
    o.payment_frequency,
    o.device_category,
    o.tags,

    REGEXP_CONTAINS(LOWER(o.tags), r'mc_funnel') AS is_mc_funnel,
    REGEXP_CONTAINS(LOWER(o.tags), r'vsl') AS is_vsl_funnel,

    s.order_id,
    s.order_amount,
    s.order_type,
    s.is_first_order,
    s.discount_id,
    s.product_funnel,
    s.campaign_type,
    s.sales_type,
    s.place_in_funnel,

    -- Payment method
    pm.type AS payment_method_type,

    JSON_EXTRACT_SCALAR(
      s.metadata,
      '$.funnel_quest_id'
    ) IS NOT NULL AS has_funnel_quest_id,

    JSON_EXTRACT_SCALAR(
      s.metadata,
      '$.funnel_quest_id'
    ) AS funnel_quest_id,

    JSON_EXTRACT_SCALAR(
      s.metadata,
      '$.product_page_path'
    ) AS product_page_path,

    b.unified_traffic_source,

    c.name AS product_name,

    d.name AS discount_name,

    ROUND(d.percent_off * 100, 2) AS percent_off_pct,

    a.first_login_time,
    ae.first_activate_time,

    s.refund_timestamp,

    DATE_DIFF(
      DATE(a.first_login_time),
      DATE(o.timestamp),
      DAY
    ) AS days_to_first_login,

    DATE_DIFF(
      DATE(ae.first_activate_time),
      DATE(o.timestamp),
      DAY
    ) AS days_to_first_activation,

    pr.first_post_refund_play_time,
    pr.post_refund_play_count,

    CASE
      WHEN s.refund_timestamp IS NULL THEN NULL
      WHEN pr.first_post_refund_play_time IS NOT NULL THEN TRUE
      ELSE FALSE
    END AS played_content_after_refund,

    DATE_DIFF(
      DATE(pr.first_post_refund_play_time),
      DATE(s.refund_timestamp),
      DAY
    ) AS days_from_refund_to_next_play,

    -- NEW: subscription-level cancellation / involuntary churn fields,
    -- reached via sales_order.subscription_term_id -> dim_subscription_term.subscription_id -> dim_subscription
    sub.cancellation_request_date,
    sub.is_involuntary_churn,
    sub.canceled_at,
    sub.cancellation_reason,
    sub.cancellation_comment,

    -- NEW: did the user play content (quest asset or meditation media) after canceling their subscription?
    pc.first_post_cancel_play_time,
    pc.post_cancel_play_count,

    CASE
      WHEN sub.canceled_at IS NULL THEN NULL
      WHEN pc.first_post_cancel_play_time IS NOT NULL THEN TRUE
      ELSE FALSE
    END AS played_content_after_cancel,

    DATE_DIFF(
      DATE(pc.first_post_cancel_play_time),
      DATE(sub.canceled_at),
      DAY
    ) AS days_from_cancel_to_next_play

  FROM raw_orders o

  INNER JOIN external_users eu
    ON o.user_id = eu.user_id

  LEFT JOIN sales_order s
    ON o.user_id = s.user_id
    AND DATE(s.order_timestamp) = DATE(o.timestamp)

  LEFT JOIN payment p
    ON s.order_id = p.order_id

  LEFT JOIN payment_method pm
    ON p.payment_method_id = pm.id

  LEFT JOIN attribution b
    ON s.order_id = b.order_id

  LEFT JOIN products c
    ON s.product_id = c.product_id

  LEFT JOIN discounts d
    ON s.discount_id = d.discount_id

  LEFT JOIN activity a
    ON o.user_id = a.user_id
    AND o.purchase_record_id = a.purchase_record_id

  LEFT JOIN activation_events ae
    ON o.user_id = ae.user_id
    AND o.purchase_record_id = ae.purchase_record_id

  LEFT JOIN post_refund_content pr
    ON o.user_id = pr.user_id
    AND o.purchase_record_id = pr.purchase_record_id

  LEFT JOIN subscription_term st
    ON s.subscription_term_id = st.subscription_term_id

  LEFT JOIN subscription sub
    ON st.subscription_id = sub.subscription_id

  LEFT JOIN post_cancel_content pc
    ON o.user_id = pc.user_id
    AND o.purchase_record_id = pc.purchase_record_id

  ORDER BY o.user_id, o.timestamp
)

SELECT *
FROM summary;