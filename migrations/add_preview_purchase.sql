-- Migration: Add preview_purchase function
-- Run this in Supabase SQL Editor if the function is missing

-- First, check if function exists and drop it
DROP FUNCTION IF EXISTS public.preview_purchase(text, numeric);

-- Create the function
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

  SELECT * INTO v_rule FROM public.point_rules WHERE is_active;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NO_ACTIVE_RULE';
  END IF;

  v_points := floor(p_amount / v_rule.amount_per_point);

  RETURN jsonb_build_object(
    'ok', true,
    'customer_name', v_p.full_name,
    'customer_status', v_c.status,
    'points_earned', v_points,
    'amount_per_point', v_rule.amount_per_point
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.preview_purchase(text, numeric) TO service_role;
