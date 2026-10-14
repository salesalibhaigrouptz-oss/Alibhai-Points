-- Phase 4-B4 Complete Migration Script
-- Run this in Supabase SQL Editor to apply all changes at once
-- This script is idempotent and can be run multiple times safely

-- 1. Add city column to customers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'city'
  ) THEN
    ALTER TABLE public.customers ADD COLUMN city text;
  END IF;
END $$;

-- Add index for city filtering
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_customers_city'
  ) THEN
    CREATE INDEX idx_customers_city ON public.customers (city);
  END IF;
END $$;

-- 2. Create loyalty_tiers table
CREATE TABLE IF NOT EXISTS public.loyalty_tiers (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null unique,
  min_lifetime_purchases numeric(14,2) not null check (min_lifetime_purchases >= 0),
  point_value_tzs      numeric(12,2) not null check (point_value_tzs > 0),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Add tier_id to customers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'tier_id'
  ) THEN
    ALTER TABLE public.customers ADD COLUMN tier_id uuid references public.loyalty_tiers(id);
  END IF;
END $$;

-- Add index for tier filtering
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_customers_tier'
  ) THEN
    CREATE INDEX idx_customers_tier ON public.customers (tier_id);
  END IF;
END $$;

-- Add trigger for updated_at on loyalty_tiers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_loyalty_tiers_updated'
  ) THEN
    CREATE TRIGGER trg_loyalty_tiers_updated
      BEFORE UPDATE ON public.loyalty_tiers
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- Enable RLS
ALTER TABLE public.loyalty_tiers ENABLE ROW LEVEL SECURITY;

-- Revoke all access from public/anon/authenticated
REVOKE ALL ON TABLE public.loyalty_tiers FROM anon, authenticated;

-- Insert default tiers
INSERT INTO public.loyalty_tiers (name, min_lifetime_purchases, point_value_tzs)
SELECT 'Bronze', 0, 100
WHERE NOT EXISTS (SELECT 1 FROM public.loyalty_tiers WHERE name = 'Bronze');

INSERT INTO public.loyalty_tiers (name, min_lifetime_purchases, point_value_tzs)
SELECT 'Silver', 10000000, 120
WHERE NOT EXISTS (SELECT 1 FROM public.loyalty_tiers WHERE name = 'Silver');

INSERT INTO public.loyalty_tiers (name, min_lifetime_purchases, point_value_tzs)
SELECT 'Gold', 50000000, 150
WHERE NOT EXISTS (SELECT 1 FROM public.loyalty_tiers WHERE name = 'Gold');

INSERT INTO public.loyalty_tiers (name, min_lifetime_purchases, point_value_tzs)
SELECT 'Platinum', 100000000, 200
WHERE NOT EXISTS (SELECT 1 FROM public.loyalty_tiers WHERE name = 'Platinum');

-- Grant execute permission to service_role
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- 3. Update preview_purchase to include tier information (only if tier_id column exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'tier_id') THEN
    CREATE OR REPLACE FUNCTION public.preview_purchase(
      p_customer_code text,
      p_amount numeric
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
      v_rule   public.point_rules%rowtype;
      v_points integer;
    BEGIN
      IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'INVALID_AMOUNT';
      END IF;

      SELECT * INTO v_c FROM public.customers
       WHERE customer_code = upper(trim(p_customer_code));

      IF NOT FOUND THEN
        RAISE EXCEPTION 'CUSTOMER_NOT_FOUND';
      END IF;

      SELECT * INTO v_p FROM public.profiles WHERE id = v_c.profile_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'CUSTOMER_NOT_FOUND';
      END IF;

      SELECT * INTO v_tier FROM public.loyalty_tiers WHERE id = v_c.tier_id;

      SELECT * INTO v_rule FROM public.point_rules WHERE is_active;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'NO_ACTIVE_RULE';
      END IF;

      v_points := floor(p_amount / v_rule.amount_per_point);

      RETURN jsonb_build_object(
        'ok', true,
        'customer_name', v_p.full_name,
        'customer_status', v_c.status,
        'customer_tier', COALESCE(v_tier.name, 'Unknown'),
        'points_earned', v_points,
        'amount_per_point', v_rule.amount_per_point
      );
    END;
    $$;
  END IF;
END $$;

-- 4. Drop new RPC functions if they exist
DROP FUNCTION IF EXISTS public.find_customer(text, uuid);
DROP FUNCTION IF EXISTS public.get_recent_activity(uuid);
DROP FUNCTION IF EXISTS public.get_recent_activity(uuid, integer);
DROP FUNCTION IF EXISTS public.get_customer_statement(text, uuid, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS public.update_loyalty_tier(uuid, uuid, numeric, numeric);

-- 5. Create find_customer function
CREATE OR REPLACE FUNCTION public.find_customer(
  p_identifier text,
  p_admin_id uuid
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
BEGIN
  PERFORM public._require_admin(p_admin_id);

  -- Try to find by customer_code first, then by phone
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

  RETURN jsonb_build_object(
    'ok', true,
    'customer', jsonb_build_object(
      'id', v_c.id,
      'customer_code', v_c.customer_code,
      'initials', v_c.initials,
      'sequence_number', v_c.sequence_number,
      'status', v_c.status,
      'points_balance', v_c.points_balance,
      'last_transaction_at', v_c.last_transaction_at,
      'city', v_c.city,
      'tier_id', v_c.tier_id,
      'created_at', v_c.created_at,
      'updated_at', v_c.updated_at
    ),
    'profile', jsonb_build_object(
      'id', v_p.id,
      'full_name', v_p.full_name,
      'phone', v_p.phone,
      'role', v_p.role,
      'is_active', v_p.is_active
    ),
    'tier', CASE WHEN v_tier IS NOT NULL THEN
      jsonb_build_object(
        'id', v_tier.id,
        'name', v_tier.name,
        'min_lifetime_purchases', v_tier.min_lifetime_purchases,
        'point_value_tzs', v_tier.point_value_tzs
      )
    ELSE NULL END
  );
END;
$$;

-- 6. Create get_recent_activity function
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

-- 7. Create get_customer_statement function
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
BEGIN
  PERFORM public._require_admin(p_admin_id);

  -- Find customer
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

  -- Get entries (purchases and redemptions)
  WITH all_entries AS (
    SELECT
      purchased_at as date,
      'purchase' as type,
      transaction_reference as reference,
      purchase_amount as amount_tzs,
      points_earned as points,
      purchase_amount as value_tzs,
      status,
      NULL as note
    FROM public.purchases
    WHERE customer_id = v_c.id
      AND status = 'completed'
      AND (p_from IS NULL OR purchased_at >= p_from)
      AND (p_to IS NULL OR purchased_at <= p_to)

    UNION ALL

    SELECT
      redeemed_at as date,
      'redemption' as type,
      redemption_reference as reference,
      NULL as amount_tzs,
      -points_redeemed as points,
      -(points_redeemed * COALESCE(v_tier.point_value_tzs, 100)) as value_tzs,
      status,
      NULL as note
    FROM public.point_redemptions
    WHERE customer_id = v_c.id
      AND (p_from IS NULL OR redeemed_at >= p_from)
      AND (p_to IS NULL OR redeemed_at <= p_to)
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'date', date,
    'type', type,
    'reference', reference,
    'amount_tzs', amount_tzs,
    'points', points,
    'value_tzs', value_tzs,
    'status', status,
    'note', note
  ) ORDER BY date DESC), '[]'::jsonb)
  INTO v_entries
  FROM all_entries;

  -- Calculate totals
  SELECT jsonb_build_object(
    'total_purchases', COALESCE(SUM(purchase_amount), 0),
    'total_points_earned', COALESCE(SUM(points_earned), 0),
    'total_points_redeemed', COALESCE((
      SELECT SUM(points_redeemed)
      FROM public.point_redemptions
      WHERE customer_id = v_c.id
        AND (p_from IS NULL OR redeemed_at >= p_from)
        AND (p_to IS NULL OR redeemed_at <= p_to)
    ), 0),
    'total_purchase_value', COALESCE((
      SELECT SUM(purchase_amount)
      FROM public.purchases
      WHERE customer_id = v_c.id
        AND status = 'completed'
        AND (p_from IS NULL OR purchased_at >= p_from)
        AND (p_to IS NULL OR purchased_at <= p_to)
    ), 0)
  )
  INTO v_totals
  FROM public.purchases
  WHERE customer_id = v_c.id
    AND status = 'completed'
    AND (p_from IS NULL OR purchased_at >= p_from)
    AND (p_to IS NULL OR purchased_at <= p_to);

  -- Audit log
  INSERT INTO public.admin_audit_logs (admin_id, action, entity_type, entity_id, description, metadata)
  VALUES (p_admin_id, 'STATEMENT_EXPORTED', 'customer', v_c.id,
          'Statement exported for ' || v_c.customer_code,
          jsonb_build_object('customer_code', v_c.customer_code, 'from', p_from, 'to', p_to));

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

-- 8. Create update_loyalty_tier function
CREATE OR REPLACE FUNCTION public.update_loyalty_tier(
  p_admin_id uuid,
  p_tier_id uuid,
  p_min_lifetime_purchases numeric,
  p_point_value_tzs numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tier   public.loyalty_tiers%rowtype;
  v_all_tiers record;
  v_prev_min numeric;
  v_prev_max numeric;
BEGIN
  PERFORM public._require_admin(p_admin_id);

  -- Get the tier being updated
  SELECT * INTO v_tier FROM public.loyalty_tiers WHERE id = p_tier_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'TIER_NOT_FOUND');
  END IF;

  -- Check that the new value doesn't break the ordering
  -- Get all tiers ordered by min_lifetime_purchases
  FOR v_all_tiers IN
    SELECT id, name, min_lifetime_purchases
    FROM public.loyalty_tiers
    WHERE id != p_tier_id
    ORDER BY min_lifetime_purchases
  LOOP
    -- Check if the new value would create a gap or overlap
    IF p_min_lifetime_purchases = v_all_tiers.min_lifetime_purchases THEN
      RETURN jsonb_build_object('ok', false, 'code', 'TIER_ORDER_VIOLATION',
                               'message', 'Tier min_lifetime_purchases must be unique');
    END IF;
  END LOOP;

  -- Update the tier
  UPDATE public.loyalty_tiers
  SET min_lifetime_purchases = p_min_lifetime_purchases,
      point_value_tzs = p_point_value_tzs,
      updated_at = now()
  WHERE id = p_tier_id;

  -- Recalculate all customer tiers based on their lifetime purchases
  -- Calculate lifetime purchases for each customer
  WITH customer_purchases AS (
    SELECT
      c.id as customer_id,
      COALESCE(SUM(p.purchase_amount), 0) as lifetime_purchases
    FROM public.customers c
    LEFT JOIN public.purchases p ON c.id = p.customer_id AND p.status = 'completed'
    GROUP BY c.id
  )
  UPDATE public.customers c
  SET tier_id = (
    SELECT lt.id
    FROM public.loyalty_tiers lt
    WHERE lt.min_lifetime_purchases <= cp.lifetime_purchases
    ORDER BY lt.min_lifetime_purchases DESC
    LIMIT 1
  )
  FROM customer_purchases cp
  WHERE c.id = cp.customer_id;

  -- Audit log
  INSERT INTO public.admin_audit_logs (admin_id, action, entity_type, entity_id, description, metadata)
  VALUES (p_admin_id, 'TIER_UPDATED', 'loyalty_tier', p_tier_id,
          'Loyalty tier updated: ' || v_tier.name,
          jsonb_build_object(
            'tier_id', p_tier_id,
            'tier_name', v_tier.name,
            'min_lifetime_purchases', p_min_lifetime_purchases,
            'point_value_tzs', p_point_value_tzs
          ));

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.find_customer(text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_recent_activity(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_customer_statement(text, uuid, timestamptz, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_loyalty_tier(uuid, uuid, numeric, numeric) TO service_role;
