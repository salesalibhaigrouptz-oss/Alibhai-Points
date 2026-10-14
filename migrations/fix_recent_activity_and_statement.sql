-- Fix overloaded get_recent_activity (PostgREST cannot choose a candidate)
-- and get_customer_statement (ORDER BY was inside jsonb_build_object).
-- Run this in the Supabase SQL editor.

DROP FUNCTION IF EXISTS public.get_recent_activity(uuid);
DROP FUNCTION IF EXISTS public.get_recent_activity(uuid, integer);

CREATE OR REPLACE FUNCTION public.get_recent_activity(
  p_customer_id uuid,
  p_limit integer DEFAULT 5
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_limit integer := GREATEST(1, LEAST(COALESCE(p_limit, 5), 50));
  v_items jsonb;
BEGIN
  WITH combined AS (
    SELECT
      purchased_at AS occurred_at,
      jsonb_build_object(
        'type', 'purchase',
        'at', purchased_at,
        'amount_tzs', purchase_amount,
        'points', points_earned,
        'reference', transaction_reference,
        'status', status,
        'value_tzs', NULL
      ) AS item
    FROM public.purchases
    WHERE customer_id = p_customer_id

    UNION ALL

    SELECT
      redeemed_at AS occurred_at,
      jsonb_build_object(
        'type', 'redemption',
        'at', redeemed_at,
        'amount_tzs', NULL,
        'points', points_redeemed,
        'reference', redemption_reference,
        'status', status,
        'value_tzs', NULL
      ) AS item
    FROM public.point_redemptions
    WHERE customer_id = p_customer_id
  )
  SELECT COALESCE(jsonb_agg(item ORDER BY occurred_at DESC), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT occurred_at, item
    FROM combined
    ORDER BY occurred_at DESC
    LIMIT v_limit
  ) ranked;

  RETURN COALESCE(v_items, '[]'::jsonb);
END;
$$;

DROP FUNCTION IF EXISTS public.get_customer_statement(text, uuid, timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION public.get_customer_statement(
  p_identifier text,
  p_admin_id uuid,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_c      public.customers%rowtype;
  v_p      public.profiles%rowtype;
  v_tier   public.loyalty_tiers%rowtype;
  v_entries jsonb;
  v_totals jsonb;
  v_from   timestamptz := p_from;
  v_to     timestamptz := p_to;
BEGIN
  PERFORM public._require_admin(p_admin_id);

  -- Date-only upper bound is midnight; treat it as the end of that day.
  IF v_to IS NOT NULL AND v_to = date_trunc('day', v_to) THEN
    v_to := v_to + interval '1 day' - interval '1 millisecond';
  END IF;

  SELECT * INTO v_c FROM public.customers
   WHERE customer_code = upper(trim(p_identifier));

  IF NOT FOUND THEN
    SELECT c.* INTO v_c FROM public.customers c
    INNER JOIN public.profiles p ON c.profile_id = p.id
    WHERE p.phone = p_identifier;
  END IF;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'CUSTOMER_NOT_FOUND');
  END IF;

  SELECT * INTO v_p FROM public.profiles WHERE id = v_c.profile_id;
  SELECT * INTO v_tier FROM public.loyalty_tiers WHERE id = v_c.tier_id;

  WITH all_entries AS (
    SELECT
      purchased_at as date,
      'purchase' as type,
      transaction_reference as reference,
      purchase_amount as amount_tzs,
      points_earned as points,
      purchase_amount as value_tzs,
      status,
      NULL::text as note
    FROM public.purchases
    WHERE customer_id = v_c.id
      AND (v_from IS NULL OR purchased_at >= v_from)
      AND (v_to IS NULL OR purchased_at <= v_to)

    UNION ALL

    SELECT
      redeemed_at as date,
      'redemption' as type,
      redemption_reference as reference,
      NULL::numeric as amount_tzs,
      -points_redeemed as points,
      -(points_redeemed * COALESCE(v_tier.point_value_tzs, 100)) as value_tzs,
      status,
      NULL::text as note
    FROM public.point_redemptions
    WHERE customer_id = v_c.id
      AND (v_from IS NULL OR redeemed_at >= v_from)
      AND (v_to IS NULL OR redeemed_at <= v_to)
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'date', date,
      'type', type,
      'reference', reference,
      'amount_tzs', amount_tzs,
      'points', points,
      'value_tzs', value_tzs,
      'status', status,
      'note', note
    ) ORDER BY date DESC
  ), '[]'::jsonb)
  INTO v_entries
  FROM all_entries;

  SELECT jsonb_build_object(
    'total_purchases', COALESCE(SUM(purchase_amount), 0),
    'total_points_earned', COALESCE(SUM(points_earned), 0),
    'total_points_redeemed', COALESCE((
      SELECT SUM(points_redeemed)
      FROM public.point_redemptions
      WHERE customer_id = v_c.id
        AND (v_from IS NULL OR redeemed_at >= v_from)
        AND (v_to IS NULL OR redeemed_at <= v_to)
    ), 0),
    'total_purchase_value', COALESCE(SUM(purchase_amount), 0)
  )
  INTO v_totals
  FROM public.purchases
  WHERE customer_id = v_c.id
    AND status = 'completed'
    AND (v_from IS NULL OR purchased_at >= v_from)
    AND (v_to IS NULL OR purchased_at <= v_to);

  INSERT INTO public.admin_audit_logs (admin_id, action, entity_type, entity_id, description, metadata)
  VALUES (p_admin_id, 'STATEMENT_EXPORTED', 'customer', v_c.id,
          'Statement exported for ' || v_c.customer_code,
          jsonb_build_object('customer_code', v_c.customer_code, 'from', v_from, 'to', v_to));

  RETURN jsonb_build_object(
    'ok', true,
    'customer', jsonb_build_object(
      'id', v_c.id,
      'customer_code', v_c.customer_code,
      'full_name', v_p.full_name,
      'phone', v_p.phone,
      'city', v_c.city,
      'tier', v_tier.name
    ),
    'entries', v_entries,
    'totals', v_totals
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_recent_activity(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_customer_statement(text, uuid, timestamptz, timestamptz) TO service_role;
