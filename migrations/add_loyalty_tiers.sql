-- Migration: Add loyalty_tiers table and customer tier relationship
-- Run this in Supabase SQL Editor

-- Create loyalty_tiers table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.loyalty_tiers (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null unique,
  min_lifetime_purchases numeric(14,2) not null check (min_lifetime_purchases >= 0),
  point_value_tzs      numeric(12,2) not null check (point_value_tzs > 0),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Add tier_id to customers table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'tier_id'
  ) THEN
    ALTER TABLE public.customers ADD COLUMN tier_id uuid references public.loyalty_tiers(id);
  END IF;
END $$;

-- Add index for tier filtering if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_customers_tier'
  ) THEN
    CREATE INDEX idx_customers_tier ON public.customers (tier_id);
  END IF;
END $$;

-- Add trigger for updated_at on loyalty_tiers if it doesn't exist
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

-- Insert default tiers if they don't exist
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
