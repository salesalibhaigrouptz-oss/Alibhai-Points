-- Migration: Make customer CO03's points immediately redeemable
-- Run this in Supabase SQL Editor to skip the 90-day waiting period

-- Update all point lots for customer CO03 to make them redeemable immediately
-- We need to update both earned_at and redeemable_at to satisfy the check constraint
UPDATE public.point_lots
SET
  earned_at = NOW() - INTERVAL '91 days',
  redeemable_at = NOW() - INTERVAL '90 days'
WHERE customer_id = (
  SELECT id FROM public.customers WHERE customer_code = 'CO03'
);

-- Verify the update
SELECT
  pl.id,
  pl.points_earned,
  pl.points_remaining,
  pl.earned_at,
  pl.redeemable_at,
  NOW() as current_time,
  NOW() - pl.redeemable_at as days_since_redeemable
FROM public.point_lots pl
JOIN public.customers c ON pl.customer_id = c.id
WHERE c.customer_code = 'CO03';
