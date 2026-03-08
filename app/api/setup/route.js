import { NextResponse } from 'next/server'
import { createAdminClient, getAuthUser } from '@/lib/supabase/server'

const MIGRATION_SQL = `
-- FX Unlocked CRM Database Schema
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard)

-- 1. Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  role TEXT DEFAULT 'STAFF' CHECK (role IN ('ADMIN', 'STAFF', 'VIEWER')),
  is_active BOOLEAN DEFAULT true,
  start_date DATE,
  salary NUMERIC,
  salary_currency TEXT,
  contract_file TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Brokers table
CREATE TABLE IF NOT EXISTS brokers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  account_manager TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  agreement_date DATE,
  renewal_date DATE,
  deal_types TEXT,
  master_deal_terms TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Affiliates table
CREATE TABLE IF NOT EXISTS affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  address TEXT,
  region TEXT,
  country TEXT,
  traffic_region TEXT,
  traffic_types TEXT,
  deal_type TEXT NOT NULL CHECK (deal_type IN ('CPA', 'PNL', 'HYBRID', 'REBATES')),
  deal_terms TEXT,
  deal_details JSONB,
  status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ONBOARDING', 'LEAD', 'INACTIVE')),
  start_date DATE DEFAULT now(),
  renewal_date DATE,
  source TEXT,
  website TEXT,
  instagram TEXT,
  telegram TEXT,
  x_handle TEXT,
  notes TEXT,
  broker_id UUID REFERENCES brokers(id),
  manager_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Commissions table
CREATE TABLE IF NOT EXISTS commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INT NOT NULL,
  deal_type TEXT NOT NULL CHECK (deal_type IN ('CPA', 'PNL', 'HYBRID', 'REBATES')),
  revenue_amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'AWAITED', 'CANCELLED')),
  paid_date DATE,
  notes TEXT,
  affiliate_id UUID REFERENCES affiliates(id),
  broker_id UUID REFERENCES brokers(id),
  staff_member_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Affiliate Notes
CREATE TABLE IF NOT EXISTS affiliate_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  note_type TEXT CHECK (note_type IN ('CALL', 'MEETING', 'EMAIL', 'GENERAL')),
  affiliate_id UUID REFERENCES affiliates(id),
  user_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Appointments
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  appointment_type TEXT NOT NULL CHECK (appointment_type IN ('MEETING', 'CALL', 'FOLLOW_UP')),
  scheduled_at TIMESTAMPTZ NOT NULL,
  notes TEXT,
  status TEXT DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'COMPLETED', 'CANCELLED')),
  affiliate_id UUID REFERENCES affiliates(id),
  user_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Staff KPIs
CREATE TABLE IF NOT EXISTS staff_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INT,
  quarter INT CHECK (quarter BETWEEN 1 AND 4),
  month INT CHECK (month BETWEEN 1 AND 12),
  target_revenue NUMERIC,
  actual_revenue NUMERIC DEFAULT 0,
  target_affiliates INT,
  actual_affiliates INT DEFAULT 0,
  notes TEXT,
  staff_member_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Company KPIs
CREATE TABLE IF NOT EXISTS company_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INT,
  month INT CHECK (month BETWEEN 1 AND 12),
  quarter INT,
  target_revenue NUMERIC,
  actual_revenue NUMERIC DEFAULT 0,
  target_affiliates INT,
  actual_affiliates INT DEFAULT 0,
  target_commissions INT,
  actual_commissions INT DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(year, month)
);

-- 9. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  action TEXT CHECK (action IN ('CREATE', 'UPDATE', 'DELETE')),
  entity_type TEXT CHECK (entity_type IN ('AFFILIATE', 'BROKER', 'COMMISSION', 'USER')),
  entity_id UUID,
  changes JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'profiles_updated_at') THEN
    CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'brokers_updated_at') THEN
    CREATE TRIGGER brokers_updated_at BEFORE UPDATE ON brokers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'affiliates_updated_at') THEN
    CREATE TRIGGER affiliates_updated_at BEFORE UPDATE ON affiliates FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'commissions_updated_at') THEN
    CREATE TRIGGER commissions_updated_at BEFORE UPDATE ON commissions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, first_name, last_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    CASE
      WHEN (SELECT COUNT(*) FROM profiles) = 0 THEN 'ADMIN'
      ELSE COALESCE(NEW.raw_user_meta_data->>'role', 'STAFF')
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE brokers ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS text AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- RLS Policies
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (id = auth.uid() OR get_user_role() = 'ADMIN');
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (id = auth.uid() OR get_user_role() = 'ADMIN');
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (true);

CREATE POLICY "brokers_select" ON brokers FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "brokers_insert" ON brokers FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "brokers_update" ON brokers FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "brokers_delete" ON brokers FOR DELETE USING (get_user_role() = 'ADMIN');

CREATE POLICY "affiliates_select" ON affiliates FOR SELECT USING (manager_id = auth.uid() OR get_user_role() = 'ADMIN');
CREATE POLICY "affiliates_insert" ON affiliates FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "affiliates_update" ON affiliates FOR UPDATE USING (manager_id = auth.uid() OR get_user_role() = 'ADMIN');
CREATE POLICY "affiliates_delete" ON affiliates FOR DELETE USING (get_user_role() = 'ADMIN');

CREATE POLICY "commissions_select" ON commissions FOR SELECT USING (staff_member_id = auth.uid() OR get_user_role() = 'ADMIN');
CREATE POLICY "commissions_insert" ON commissions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "commissions_update" ON commissions FOR UPDATE USING (get_user_role() = 'ADMIN');
CREATE POLICY "commissions_delete" ON commissions FOR DELETE USING (get_user_role() = 'ADMIN');

CREATE POLICY "notes_select" ON affiliate_notes FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "notes_insert" ON affiliate_notes FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "appointments_select" ON appointments FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "appointments_insert" ON appointments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "appointments_update" ON appointments FOR UPDATE USING (user_id = auth.uid() OR get_user_role() = 'ADMIN');

CREATE POLICY "staff_kpis_select" ON staff_kpis FOR SELECT USING (staff_member_id = auth.uid() OR get_user_role() = 'ADMIN');
CREATE POLICY "staff_kpis_write" ON staff_kpis FOR INSERT WITH CHECK (get_user_role() = 'ADMIN');
CREATE POLICY "staff_kpis_update" ON staff_kpis FOR UPDATE USING (get_user_role() = 'ADMIN');

CREATE POLICY "company_kpis_select" ON company_kpis FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "company_kpis_write" ON company_kpis FOR INSERT WITH CHECK (get_user_role() = 'ADMIN');
CREATE POLICY "company_kpis_update" ON company_kpis FOR UPDATE USING (get_user_role() = 'ADMIN');

CREATE POLICY "audit_logs_select" ON audit_logs FOR SELECT USING (get_user_role() = 'ADMIN');
CREATE POLICY "audit_logs_insert" ON audit_logs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
`;

export async function GET() {
  // Auth guard — admin only
  const { user, role } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = createAdminClient()
  const tables = ['profiles', 'brokers', 'affiliates', 'commissions', 'affiliate_notes', 'appointments', 'staff_kpis', 'company_kpis', 'audit_logs']
  const status = {}

  for (const table of tables) {
    try {
      const { error } = await supabase.from(table).select('id').limit(1)
      status[table] = !error
    } catch {
      status[table] = false
    }
  }

  const allReady = Object.values(status).every(Boolean)

  return NextResponse.json({
    ready: allReady,
    tables: status,
    migrationSQL: allReady ? undefined : MIGRATION_SQL
  })
}
