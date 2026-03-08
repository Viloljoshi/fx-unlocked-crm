-- ============================================================
-- FX Unlocked CRM — Supabase Migration / Sync Script v2
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

-- ── 3. Ensure get_user_role() helper exists ───────────────────
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS text AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- ── 4. Fix RLS: commissions ───────────────────────────────────
-- BUG FIX: old policy only checked staff_member_id.
-- Staff now see commissions for any affiliate they manage.
DROP POLICY IF EXISTS "commissions_select" ON commissions;
CREATE POLICY "commissions_select" ON commissions FOR SELECT USING (
  get_user_role() = 'ADMIN' OR
  staff_member_id = auth.uid() OR
  affiliate_id IN (SELECT id FROM affiliates WHERE manager_id = auth.uid())
);

DROP POLICY IF EXISTS "commissions_update" ON commissions;
CREATE POLICY "commissions_update" ON commissions FOR UPDATE USING (
  get_user_role() = 'ADMIN' OR staff_member_id = auth.uid()
);

-- ── 5. Fix RLS: appointments ──────────────────────────────────
-- BUG FIX: old policy allowed ALL authenticated users to see ALL appointments.
-- Staff now only see appointments for affiliates they manage.
DROP POLICY IF EXISTS "appointments_select" ON appointments;
CREATE POLICY "appointments_select" ON appointments FOR SELECT USING (
  get_user_role() = 'ADMIN' OR
  affiliate_id IN (SELECT id FROM affiliates WHERE manager_id = auth.uid())
);

-- ── 6. Fix RLS: affiliate_notes ───────────────────────────────
-- Staff see notes they created or notes for their affiliates
DROP POLICY IF EXISTS "notes_select" ON affiliate_notes;
CREATE POLICY "notes_select" ON affiliate_notes FOR SELECT USING (
  get_user_role() = 'ADMIN' OR
  user_id = auth.uid() OR
  affiliate_id IN (SELECT id FROM affiliates WHERE manager_id = auth.uid())
);

DROP POLICY IF EXISTS "notes_insert" ON affiliate_notes;
CREATE POLICY "notes_insert" ON affiliate_notes FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ── 7. Ensure RLS is enabled on all tables ────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE brokers ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ── Done ─────────────────────────────────────────────────────
SELECT 'FX Unlocked DB sync complete ✓' AS status;
