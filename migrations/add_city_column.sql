-- Migration: Add city column to customers table
-- Run this in Supabase SQL Editor

-- Add city column to customers table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'city'
  ) THEN
    ALTER TABLE public.customers ADD COLUMN city text;
  END IF;
END $$;

-- Add index for city filtering if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_customers_city'
  ) THEN
    CREATE INDEX idx_customers_city ON public.customers (city);
  END IF;
END $$;
