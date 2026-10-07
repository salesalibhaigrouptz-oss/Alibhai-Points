-- Migration: Fix record_purchase to use compatible random generation
-- Run this in Supabase SQL Editor

CREATE OR REPLACE FUNCTION public.record_purchase(
  p_customer_code text, p_amount numeric, p_admin_id uuid,
  p_idempotency_key text default null, p_now timestamptz default now())
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_c      public.customers%rowtype;
  v_rule   public.point_rules%rowtype;
  v_old    public.purchases%rowtype;
  v_points integer;
  v_pid    uuid;
  v_ref    text;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT';
  END IF;

  PERFORM public._require_admin(p_admin_id);

  SELECT * INTO v_c FROM public.customers
   WHERE customer_code = upper(trim(p_customer_code)) FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CUSTOMER_NOT_FOUND';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_c.profile_id AND is_active) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'CUSTOMER_DISABLED');
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_old FROM public.purchases WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN jsonb_build_object('ok', true, 'duplicate', true, 'purchase_id', v_old.id,
        'transaction_reference', v_old.transaction_reference, 'points_earned', v_old.points_earned,
        'points_balance', v_c.points_balance, 'customer_status', v_c.status);
    END IF;
  END IF;

  SELECT * INTO v_rule FROM public.point_rules WHERE is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NO_ACTIVE_RULE';
  END IF;

  -- if the customer is overdue, old points expire BEFORE the new points are added
  PERFORM public.apply_inactivity_if_due(v_c.id, p_now);

  v_points := floor(p_amount / v_rule.amount_per_point);

  -- Use md5(random()::text) instead of gen_random_bytes for compatibility
  v_ref := 'TXN-' || to_char(p_now, 'YYMMDD') || '-' ||
           upper(substr(md5(random()::text), 1, 6));

  INSERT INTO public.purchases (customer_id, point_rule_id, purchase_amount, amount_per_point_used,
                                points_earned, recorded_by, transaction_reference,
                                idempotency_key, purchased_at)
    VALUES (v_c.id, v_rule.id, p_amount, v_rule.amount_per_point, v_points, p_admin_id,
            v_ref, p_idempotency_key, p_now)
    RETURNING id INTO v_pid;

  IF v_points > 0 THEN
    INSERT INTO public.point_lots (customer_id, purchase_id, points_earned, points_remaining,
                                   earned_at, redeemable_at)
      VALUES (v_c.id, v_pid, v_points, v_points, p_now,
              p_now + make_interval(days => v_rule.redemption_wait_days));
  END IF;

  SELECT * INTO v_c FROM public.customers WHERE id = v_c.id;
  IF v_c.status = 'inactive' THEN
    INSERT INTO public.customer_status_events (customer_id, previous_status, new_status, reason, created_at)
      VALUES (v_c.id, 'inactive', 'active', 'New purchase', p_now);
  END IF;

  UPDATE public.customers
     SET last_transaction_at = p_now, status = 'active',
         points_balance = points_balance + v_points
   WHERE id = v_c.id
   RETURNING * INTO v_c;

  INSERT INTO public.admin_audit_logs (admin_id, action, entity_type, entity_id, description, metadata)
    VALUES (p_admin_id, 'PURCHASE_RECORDED', 'purchase', v_pid,
            'Purchase for ' || v_c.customer_code,
            jsonb_build_object('amount', p_amount, 'points', v_points, 'reference', v_ref));

  RETURN jsonb_build_object('ok', true, 'duplicate', false, 'purchase_id', v_pid,
    'transaction_reference', v_ref, 'points_earned', v_points,
    'points_balance', v_c.points_balance, 'customer_status', v_c.status);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_purchase(text, numeric, uuid, text, timestamptz) TO service_role;
