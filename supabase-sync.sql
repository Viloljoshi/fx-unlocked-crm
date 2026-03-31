-- ============================================================
-- FX Unlocked CRM — Supabase Migration / Sync Script v7
-- NOTE: For Deals module tables, run supabase-deals-migration.sql separately
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- Safe to run multiple times (all statements are idempotent)
-- ============================================================
-- Changes in v6:
--   • Fixed function search_path (security hardening)
--   • Removed duplicate RLS policies (company_kpis, staff_kpis, profiles)
--   • Optimised ALL policies: (SELECT auth.uid()) and (SELECT get_user_role())
--     to prevent per-row re-evaluation (auth_rls_initplan performance fix)
--   • Added 12 missing FK indexes for query performance
--   • Added affiliates.master_ib_id column + self-referencing FK
-- ============================================================

-- ── 1. Schema: ensure all required columns exist ─────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email          TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS first_name     TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_name      TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role           TEXT DEFAULT 'STAFF';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active      BOOLEAN DEFAULT true;

-- affiliates.master_ib_id (self-referencing hierarchy — added in v5.x)
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS master_ib_id UUID REFERENCES affiliates(id) ON DELETE SET NULL;

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

-- ── 3. Profiles FK: cascade delete when auth user is removed ──
DO $$
BEGIN
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

-- ── 4. Auto-create profile row on new user signup ────────────
-- Triggered whenever a new auth.users row is inserted.
-- Fixed: SET search_path = public prevents search_path injection.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, first_name, last_name, is_active, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'STAFF'),
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    true,
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email      = EXCLUDED.email,
    first_name = CASE WHEN profiles.first_name = '' OR profiles.first_name IS NULL
                      THEN EXCLUDED.first_name ELSE profiles.first_name END,
    last_name  = CASE WHEN profiles.last_name  = '' OR profiles.last_name  IS NULL
                      THEN EXCLUDED.last_name  ELSE profiles.last_name  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── 5. Helper: get current user's role ───────────────────────
-- Fixed: SET search_path = public + (SELECT auth.uid()) for performance.
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS text AS $$
  SELECT role FROM public.profiles WHERE id = (SELECT auth.uid());
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- ── 6. Timestamp auto-update trigger ─────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ── 7. Enable RLS on all tables ──────────────────────────────
ALTER TABLE profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliates      ENABLE ROW LEVEL SECURITY;
ALTER TABLE brokers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_kpis      ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_kpis    ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs      ENABLE ROW LEVEL SECURITY;

-- ── 8. RLS: profiles ─────────────────────────────────────────
-- NOTE: (SELECT get_user_role()) and (SELECT auth.uid()) evaluated once per
-- query, not per row — critical performance optimisation at scale.

DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (
  (SELECT get_user_role()) = 'ADMIN' OR id = (SELECT auth.uid())
);

DROP POLICY IF EXISTS "profiles_insert" ON profiles;
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (
  (SELECT get_user_role()) = 'ADMIN' OR id = (SELECT auth.uid())
);

-- Consolidated: replaces old profiles_update + profiles_update_own (duplicate)
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update" ON profiles FOR UPDATE
  USING (
    (SELECT get_user_role()) = 'ADMIN' OR id = (SELECT auth.uid())
  )
  WITH CHECK (
    (SELECT get_user_role()) = 'ADMIN' OR id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "profiles_delete" ON profiles;
CREATE POLICY "profiles_delete" ON profiles FOR DELETE USING (
  (SELECT get_user_role()) = 'ADMIN'
);

-- ── 9. RLS: affiliates ────────────────────────────────────────
DROP POLICY IF EXISTS "affiliates_select" ON affiliates;
CREATE POLICY "affiliates_select" ON affiliates FOR SELECT USING (
  (SELECT get_user_role()) = 'ADMIN'
  OR manager_id = (SELECT auth.uid())
);

DROP POLICY IF EXISTS "affiliates_insert" ON affiliates;
CREATE POLICY "affiliates_insert" ON affiliates FOR INSERT WITH CHECK (
  (SELECT get_user_role()) IN ('ADMIN', 'STAFF')
);

DROP POLICY IF EXISTS "affiliates_update" ON affiliates;
CREATE POLICY "affiliates_update" ON affiliates FOR UPDATE USING (
  (SELECT get_user_role()) IN ('ADMIN', 'STAFF')
);

DROP POLICY IF EXISTS "affiliates_delete" ON affiliates;
CREATE POLICY "affiliates_delete" ON affiliates FOR DELETE USING (
  (SELECT get_user_role()) = 'ADMIN'
);

-- ── 10. RLS: brokers ─────────────────────────────────────────
DROP POLICY IF EXISTS "brokers_select" ON brokers;
CREATE POLICY "brokers_select" ON brokers FOR SELECT USING (
  (SELECT get_user_role()) IN ('ADMIN', 'STAFF', 'VIEWER')
);

DROP POLICY IF EXISTS "brokers_insert" ON brokers;
CREATE POLICY "brokers_insert" ON brokers FOR INSERT WITH CHECK (
  (SELECT get_user_role()) = 'ADMIN'
);

DROP POLICY IF EXISTS "brokers_update" ON brokers;
CREATE POLICY "brokers_update" ON brokers FOR UPDATE USING (
  (SELECT get_user_role()) = 'ADMIN'
);

DROP POLICY IF EXISTS "brokers_delete" ON brokers;
CREATE POLICY "brokers_delete" ON brokers FOR DELETE USING (
  (SELECT get_user_role()) = 'ADMIN'
);

-- ── 11. RLS: commissions ──────────────────────────────────────
DROP POLICY IF EXISTS "commissions_select" ON commissions;
CREATE POLICY "commissions_select" ON commissions FOR SELECT USING (
  (SELECT get_user_role()) IN ('ADMIN', 'STAFF', 'VIEWER')
);

DROP POLICY IF EXISTS "commissions_insert" ON commissions;
CREATE POLICY "commissions_insert" ON commissions FOR INSERT WITH CHECK (
  (SELECT get_user_role()) IN ('ADMIN', 'STAFF')
);

DROP POLICY IF EXISTS "commissions_update" ON commissions;
CREATE POLICY "commissions_update" ON commissions FOR UPDATE USING (
  (SELECT get_user_role()) IN ('ADMIN', 'STAFF')
);

DROP POLICY IF EXISTS "commissions_delete" ON commissions;
CREATE POLICY "commissions_delete" ON commissions FOR DELETE USING (
  (SELECT get_user_role()) = 'ADMIN'
);

-- ── 12. RLS: appointments ─────────────────────────────────────
DROP POLICY IF EXISTS "appointments_select" ON appointments;
CREATE POLICY "appointments_select" ON appointments FOR SELECT USING (
  (SELECT get_user_role()) IN ('ADMIN', 'STAFF', 'VIEWER')
);

DROP POLICY IF EXISTS "appointments_insert" ON appointments;
CREATE POLICY "appointments_insert" ON appointments FOR INSERT WITH CHECK (
  (SELECT get_user_role()) IN ('ADMIN', 'STAFF')
);

DROP POLICY IF EXISTS "appointments_update" ON appointments;
CREATE POLICY "appointments_update" ON appointments FOR UPDATE USING (
  (SELECT get_user_role()) IN ('ADMIN', 'STAFF')
);

DROP POLICY IF EXISTS "appointments_delete" ON appointments;
CREATE POLICY "appointments_delete" ON appointments FOR DELETE USING (
  (SELECT get_user_role()) IN ('ADMIN', 'STAFF')
);

-- ── 13. RLS: affiliate_notes ──────────────────────────────────
DROP POLICY IF EXISTS "notes_select" ON affiliate_notes;
CREATE POLICY "notes_select" ON affiliate_notes FOR SELECT USING (
  (SELECT get_user_role()) IN ('ADMIN', 'STAFF', 'VIEWER')
);

DROP POLICY IF EXISTS "notes_insert" ON affiliate_notes;
CREATE POLICY "notes_insert" ON affiliate_notes FOR INSERT WITH CHECK (
  (SELECT get_user_role()) IN ('ADMIN', 'STAFF')
);

DROP POLICY IF EXISTS "notes_update" ON affiliate_notes;
CREATE POLICY "notes_update" ON affiliate_notes FOR UPDATE USING (
  (SELECT get_user_role()) IN ('ADMIN', 'STAFF')
);

DROP POLICY IF EXISTS "notes_delete" ON affiliate_notes;
CREATE POLICY "notes_delete" ON affiliate_notes FOR DELETE USING (
  (SELECT get_user_role()) IN ('ADMIN', 'STAFF')
);

-- ── 14. RLS: staff_kpis ───────────────────────────────────────
-- NOTE: Removed duplicate staff_kpis_write policy (was identical to staff_kpis_insert)
DROP POLICY IF EXISTS "staff_kpis_write" ON staff_kpis;

DROP POLICY IF EXISTS "staff_kpis_select" ON staff_kpis;
CREATE POLICY "staff_kpis_select" ON staff_kpis FOR SELECT USING (
  (SELECT get_user_role()) IN ('ADMIN', 'STAFF', 'VIEWER')
);

DROP POLICY IF EXISTS "staff_kpis_insert" ON staff_kpis;
CREATE POLICY "staff_kpis_insert" ON staff_kpis FOR INSERT WITH CHECK (
  (SELECT get_user_role()) = 'ADMIN'
);

DROP POLICY IF EXISTS "staff_kpis_update" ON staff_kpis;
CREATE POLICY "staff_kpis_update" ON staff_kpis FOR UPDATE USING (
  (SELECT get_user_role()) = 'ADMIN'
);

DROP POLICY IF EXISTS "staff_kpis_delete" ON staff_kpis;
CREATE POLICY "staff_kpis_delete" ON staff_kpis FOR DELETE USING (
  (SELECT get_user_role()) = 'ADMIN'
);

-- ── 15. RLS: company_kpis ─────────────────────────────────────
-- NOTE: Removed duplicate company_kpis_write policy (was identical to company_kpis_insert)
DROP POLICY IF EXISTS "company_kpis_write" ON company_kpis;

DROP POLICY IF EXISTS "company_kpis_select" ON company_kpis;
CREATE POLICY "company_kpis_select" ON company_kpis FOR SELECT USING (
  (SELECT get_user_role()) IN ('ADMIN', 'STAFF', 'VIEWER')
);

DROP POLICY IF EXISTS "company_kpis_insert" ON company_kpis;
CREATE POLICY "company_kpis_insert" ON company_kpis FOR INSERT WITH CHECK (
  (SELECT get_user_role()) = 'ADMIN'
);

DROP POLICY IF EXISTS "company_kpis_update" ON company_kpis;
CREATE POLICY "company_kpis_update" ON company_kpis FOR UPDATE USING (
  (SELECT get_user_role()) = 'ADMIN'
);

DROP POLICY IF EXISTS "company_kpis_delete" ON company_kpis;
CREATE POLICY "company_kpis_delete" ON company_kpis FOR DELETE USING (
  (SELECT get_user_role()) = 'ADMIN'
);

-- ── 16. RLS: audit_logs ───────────────────────────────────────
DROP POLICY IF EXISTS "audit_logs_select" ON audit_logs;
CREATE POLICY "audit_logs_select" ON audit_logs FOR SELECT USING (
  (SELECT get_user_role()) = 'ADMIN'
);

DROP POLICY IF EXISTS "audit_logs_insert" ON audit_logs;
CREATE POLICY "audit_logs_insert" ON audit_logs FOR INSERT WITH CHECK (
  (SELECT get_user_role()) IN ('ADMIN', 'STAFF')
);

-- ── 17. Performance: FK indexes ───────────────────────────────
-- All foreign key columns that lacked covering indexes (identified by Supabase advisor)
CREATE INDEX IF NOT EXISTS idx_affiliate_notes_affiliate_id ON affiliate_notes(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_notes_user_id      ON affiliate_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliates_broker_id         ON affiliates(broker_id);
CREATE INDEX IF NOT EXISTS idx_affiliates_manager_id        ON affiliates(manager_id);
CREATE INDEX IF NOT EXISTS idx_affiliates_master_ib_id      ON affiliates(master_ib_id);
CREATE INDEX IF NOT EXISTS idx_appointments_affiliate_id    ON appointments(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_appointments_user_id         ON appointments(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id           ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_commissions_affiliate_id     ON commissions(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_commissions_broker_id        ON commissions(broker_id);
CREATE INDEX IF NOT EXISTS idx_commissions_staff_member_id  ON commissions(staff_member_id);
CREATE INDEX IF NOT EXISTS idx_staff_kpis_staff_member_id   ON staff_kpis(staff_member_id);

-- ── 18. Supabase Auth URL Configuration ───────────────────────
-- Set these in: Supabase Dashboard → Authentication → URL Configuration
--
--   Site URL:       https://fx-unlocked-crm.vercel.app
--   Redirect URLs:  https://fx-unlocked-crm.vercel.app/**
--                   http://localhost:3000/**   (for local dev)
--
-- This covers:
--   /reset-password      ← password reset email links
--   /auth/callback       ← invite email magic links
--   /dashboard           ← post-login redirect

-- ── Done ──────────────────────────────────────────────────────
SELECT 'FX Unlocked DB sync v6 complete ✓' AS status;
