-- ============================================
-- FX Unlocked CRM — Supabase DB Sync Script
-- ============================================
-- Run this ONCE in Supabase Dashboard → SQL Editor
-- This brings your live DB in sync with the app code.
-- Safe to run multiple times (uses IF NOT EXISTS / IF EXISTS checks).
-- ============================================

-- 1. Add 'email' column to profiles (code writes it, column was missing)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Update commissions status constraint to allow AWAITED and CANCELLED
-- (Drop old constraint, add new one)
DO $$
BEGIN
  -- Check if the constraint exists and needs updating
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'commissions_status_check'
  ) THEN
    ALTER TABLE commissions DROP CONSTRAINT commissions_status_check;
  END IF;

  -- Add the updated constraint
  ALTER TABLE commissions ADD CONSTRAINT commissions_status_check
    CHECK (status IN ('PENDING', 'PAID', 'AWAITED', 'CANCELLED'));
EXCEPTION
  WHEN duplicate_object THEN
    -- Constraint already exists with correct definition, skip
    NULL;
END $$;

-- 3. Verify all tables exist (these should already exist from initial setup)
-- If any are missing, the full schema is in app/api/setup/route.js

-- Quick verification queries (uncomment to check):
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'profiles' ORDER BY ordinal_position;
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'brokers' ORDER BY ordinal_position;
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'affiliates' ORDER BY ordinal_position;
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'commissions' ORDER BY ordinal_position;
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'affiliate_notes' ORDER BY ordinal_position;
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'appointments' ORDER BY ordinal_position;
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'audit_logs' ORDER BY ordinal_position;
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'company_kpis' ORDER BY ordinal_position;
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'staff_kpis' ORDER BY ordinal_position;

-- ============================================
-- DONE! Your DB is now in sync with the app.
-- ============================================
