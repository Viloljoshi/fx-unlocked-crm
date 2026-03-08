-- ============================================================
-- FX Unlocked CRM — Supabase Migration / Sync Script v3
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- Safe to run multiple times (all statements are idempotent)
-- ============================================================

-- ── 1. Add email column to profiles (if not exists) ─────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- ── 2. Fix commissions status constraint ─────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'commissions_status_check'
  ) THEN
    ALTER TABLE commissions DROP CONSTRAINT commissions_status_check;
  END IF;
  ALTER TABLE commissions ADD CONSTRAINT commissions_status_check
    CHECK (status IN ('PENDING', 'PAID', 'AWAITED', 'CANCELLED'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── 3. Ensure profiles FK cascades when auth user deleted ────
-- (so deleting from auth.users auto-removes the profile row)
DO $$
BEGIN
  -- Drop existing FK if it doesn't cascade
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'profiles' AND constraint_name = 'profiles_id_fkey'
  ) THEN
    ALTER TABLE profiles DROP CONSTRAINT profiles_id_fkey;
  END IF;
  ALTER TABLE profiles
    ADD CONSTRAINT profiles_id_fkey
    FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── 4. Ensure get_user_role() helper exists ───────────────────
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS text AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- ── 5. Fix RLS: commissions ───────────────────────────────────
-- Staff see commissions for any affiliate they manage (not just where staff_member_id = them)
DROP POLICY IF EXISTS "commissions_select" ON commissions;
CREATE POLICY "commissions_select" ON commissions FOR SELECT USING (
  get_user_role() = 'ADMIN' OR
  staff_member_id = auth.uid() OR
  affiliate_id IN (SELECT id FROM affiliates WHERE manager_id = auth.uid())
);

DROP POLICY IF EXISTS "commissions_insert" ON commissions;
CREATE POLICY "commissions_insert" ON commissions FOR INSERT WITH CHECK (
  get_user_role() = 'ADMIN' OR
  affiliate_id IN (SELECT id FROM affiliates WHERE manager_id = auth.uid())
);

DROP POLICY IF EXISTS "commissions_update" ON commissions;
CREATE POLICY "commissions_update" ON commissions FOR UPDATE USING (
  get_user_role() = 'ADMIN' OR staff_member_id = auth.uid() OR
  affiliate_id IN (SELECT id FROM affiliates WHERE manager_id = auth.uid())
);

DROP POLICY IF EXISTS "commissions_delete" ON commissions;
CREATE POLICY "commissions_delete" ON commissions FOR DELETE USING (
  get_user_role() = 'ADMIN'
);

-- ── 6. Fix RLS: appointments ──────────────────────────────────
-- Staff only see/manage appointments for affiliates they manage
DROP POLICY IF EXISTS "appointments_select" ON appointments;
CREATE POLICY "appointments_select" ON appointments FOR SELECT USING (
  get_user_role() = 'ADMIN' OR
  affiliate_id IN (SELECT id FROM affiliates WHERE manager_id = auth.uid())
);

DROP POLICY IF EXISTS "appointments_insert" ON appointments;
CREATE POLICY "appointments_insert" ON appointments FOR INSERT WITH CHECK (
  get_user_role() = 'ADMIN' OR
  affiliate_id IN (SELECT id FROM affiliates WHERE manager_id = auth.uid())
);

DROP POLICY IF EXISTS "appointments_update" ON appointments;
CREATE POLICY "appointments_update" ON appointments FOR UPDATE USING (
  get_user_role() = 'ADMIN' OR
  affiliate_id IN (SELECT id FROM affiliates WHERE manager_id = auth.uid())
);

DROP POLICY IF EXISTS "appointments_delete" ON appointments;
CREATE POLICY "appointments_delete" ON appointments FOR DELETE USING (
  get_user_role() = 'ADMIN' OR
  affiliate_id IN (SELECT id FROM affiliates WHERE manager_id = auth.uid())
);

-- ── 7. Fix RLS: affiliate_notes ───────────────────────────────
DROP POLICY IF EXISTS "notes_select" ON affiliate_notes;
CREATE POLICY "notes_select" ON affiliate_notes FOR SELECT USING (
  get_user_role() = 'ADMIN' OR
  user_id = auth.uid() OR
  affiliate_id IN (SELECT id FROM affiliates WHERE manager_id = auth.uid())
);

DROP POLICY IF EXISTS "notes_insert" ON affiliate_notes;
CREATE POLICY "notes_insert" ON affiliate_notes FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "notes_update" ON affiliate_notes;
CREATE POLICY "notes_update" ON affiliate_notes FOR UPDATE USING (
  get_user_role() = 'ADMIN' OR user_id = auth.uid()
);

DROP POLICY IF EXISTS "notes_delete" ON affiliate_notes;
CREATE POLICY "notes_delete" ON affiliate_notes FOR DELETE USING (
  get_user_role() = 'ADMIN' OR user_id = auth.uid()
);

-- ── 8. Fix RLS: affiliates ────────────────────────────────────
DROP POLICY IF EXISTS "affiliates_select" ON affiliates;
CREATE POLICY "affiliates_select" ON affiliates FOR SELECT USING (
  get_user_role() = 'ADMIN' OR manager_id = auth.uid()
);

DROP POLICY IF EXISTS "affiliates_insert" ON affiliates;
CREATE POLICY "affiliates_insert" ON affiliates FOR INSERT WITH CHECK (
  get_user_role() = 'ADMIN' OR manager_id = auth.uid()
);

DROP POLICY IF EXISTS "affiliates_update" ON affiliates;
CREATE POLICY "affiliates_update" ON affiliates FOR UPDATE USING (
  get_user_role() = 'ADMIN' OR manager_id = auth.uid()
);

DROP POLICY IF EXISTS "affiliates_delete" ON affiliates;
CREATE POLICY "affiliates_delete" ON affiliates FOR DELETE USING (
  get_user_role() = 'ADMIN'
);

-- ── 9. Fix RLS: profiles ──────────────────────────────────────
DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (
  get_user_role() = 'ADMIN' OR id = auth.uid()
);

DROP POLICY IF EXISTS "profiles_insert" ON profiles;
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (
  id = auth.uid()
);

DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (
  get_user_role() = 'ADMIN' OR id = auth.uid()
);

-- ── 10. Fix RLS: brokers ──────────────────────────────────────
DROP POLICY IF EXISTS "brokers_select" ON brokers;
CREATE POLICY "brokers_select" ON brokers FOR SELECT USING (
  auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "brokers_insert" ON brokers;
CREATE POLICY "brokers_insert" ON brokers FOR INSERT WITH CHECK (
  get_user_role() = 'ADMIN'
);

DROP POLICY IF EXISTS "brokers_update" ON brokers;
CREATE POLICY "brokers_update" ON brokers FOR UPDATE USING (
  get_user_role() = 'ADMIN'
);

DROP POLICY IF EXISTS "brokers_delete" ON brokers;
CREATE POLICY "brokers_delete" ON brokers FOR DELETE USING (
  get_user_role() = 'ADMIN'
);

-- ── 11. Ensure RLS is enabled on all tables ───────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE brokers ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ── 12. Supabase Auth URL Configuration reminder ──────────────
-- Add these to: Supabase Dashboard → Authentication → URL Configuration
--
--  Site URL:         https://fx-unlocked-crm.vercel.app
--  Redirect URLs:    https://fx-unlocked-crm.vercel.app/**
--                    (wildcard covers /reset-password, /auth/callback, /dashboard, etc.)
--
-- This enables:
--  • Password reset emails to land on /reset-password
--  • Invite emails to land on /auth/callback?next=/dashboard
--  • Magic links and OAuth redirects

-- ── Done ─────────────────────────────────────────────────────
SELECT 'FX Unlocked DB sync v3 complete ✓' AS status;
