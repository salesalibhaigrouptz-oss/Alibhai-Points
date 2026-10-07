-- Migration: Fix all functions to use compatible random generation
-- Run this in Supabase SQL Editor to replace all gen_random_bytes calls

-- Fix record_purchase (already done, but included for completeness)
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

  PERFORM public.apply_inactivity_if_due(v_c.id, p_now);

  v_points := floor(p_amount / v_rule.amount_per_point);

  -- Use md5(random()::text) instead of gen_random_bytes
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

-- Fix create_redemption
CREATE OR REPLACE FUNCTION public.create_redemption(
  p_customer_id uuid, p_points integer, p_admin_id uuid default null,
  p_now timestamptz default now())
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_c          public.customers%rowtype;
  v_redeemable integer;
  v_id         uuid;
  v_ref        text;
  v_need       integer := p_points;
  v_take       integer;
  v_lot        record;
  v_status     text;
BEGIN
  IF p_points IS NULL OR p_points <= 0 THEN
    RAISE EXCEPTION 'INVALID_POINTS';
  END IF;

  IF p_admin_id IS NOT NULL THEN
    PERFORM public._require_admin(p_admin_id);
  END IF;

  SELECT * INTO v_c FROM public.customers WHERE id = p_customer_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CUSTOMER_NOT_FOUND';
  END IF;

  PERFORM public.apply_inactivity_if_due(p_customer_id, p_now);
  SELECT * INTO v_c FROM public.customers WHERE id = p_customer_id;

  IF v_c.status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'CUSTOMER_INACTIVE');
  END IF;

  IF EXISTS (SELECT 1 FROM public.point_redemptions
              WHERE customer_id = p_customer_id AND status = 'pending') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'PENDING_REQUEST_EXISTS');
  END IF;

  SELECT coalesce(sum(points_remaining), 0) INTO v_redeemable FROM public.point_lots
   WHERE customer_id = p_customer_id AND status = 'active' AND redeemable_at <= p_now;

  IF p_points > v_redeemable THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INSUFFICIENT_REDEEMABLE_POINTS',
                              'redeemable_points', v_redeemable);
  END IF;

  v_status := CASE WHEN p_admin_id IS NULL THEN 'pending' ELSE 'completed' END;

  -- Use md5(random()::text) instead of gen_random_bytes
  v_ref := 'RDM-' || to_char(p_now, 'YYMMDD') || '-' ||
           upper(substr(md5(random()::text), 1, 6));

  INSERT INTO public.point_redemptions (customer_id, points_redeemed, redemption_reference, source,
                                        status, processed_by, completed_at, redeemed_at)
    VALUES (p_customer_id, p_points, v_ref,
            CASE WHEN p_admin_id IS NULL THEN 'customer_request' ELSE 'admin_direct' END,
            v_status, p_admin_id,
            CASE WHEN p_admin_id IS NULL THEN NULL ELSE p_now END, p_now)
    RETURNING id INTO v_id;

  FOR v_lot IN SELECT id, points_remaining FROM public.point_lots
                WHERE customer_id = p_customer_id AND status = 'active'
                  AND redeemable_at <= p_now AND points_remaining > 0
                ORDER BY earned_at, id FOR UPDATE LOOP
    EXIT WHEN v_need <= 0;
    v_take := least(v_need, v_lot.points_remaining);
    UPDATE public.point_lots
       SET points_remaining = points_remaining - v_take,
           status = CASE WHEN points_remaining - v_take = 0 THEN 'fully_redeemed' ELSE 'active' END
     WHERE id = v_lot.id;
    INSERT INTO public.point_redemption_items (redemption_id, point_lot_id, points_used)
      VALUES (v_id, v_lot.id, v_take);
    v_need := v_need - v_take;
  END LOOP;

  UPDATE public.customers SET points_balance = points_balance - p_points WHERE id = p_customer_id;

  IF p_admin_id IS NOT NULL THEN
    INSERT INTO public.admin_audit_logs (admin_id, action, entity_type, entity_id, description, metadata)
      VALUES (p_admin_id, 'REDEMPTION_DIRECT', 'redemption', v_id,
              'Points deducted for ' || v_c.customer_code,
              jsonb_build_object('points', p_points, 'reference', v_ref));
  END IF;

  RETURN jsonb_build_object('ok', true, 'redemption_id', v_id, 'reference', v_ref,
                            'status', v_status, 'points', p_points);
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.record_purchase(text, numeric, uuid, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_redemption(uuid, integer, uuid, timestamptz) TO service_role;
