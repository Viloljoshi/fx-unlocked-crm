-- ============================================================
-- FX UNLOCKED CRM — DEALS MODULE MIGRATION
-- Run this in Supabase SQL Editor (or via CLI)
-- Depends on: profiles, affiliates, brokers tables existing
-- ============================================================

-- 1. DEALS (core entity)
CREATE TABLE IF NOT EXISTS deals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id    UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  broker_id       UUID REFERENCES brokers(id) ON DELETE SET NULL,
  deal_type       TEXT NOT NULL CHECK (deal_type IN ('CPA', 'PNL', 'HYBRID', 'REBATES')),
  status          TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PENDING', 'ACTIVE', 'REJECTED', 'ARCHIVED')),
  deal_terms      TEXT,
  deal_details    JSONB DEFAULT '{}',
  created_by      UUID NOT NULL REFERENCES profiles(id),
  approved_by     UUID REFERENCES profiles(id),
  approved_at     TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. DEAL_LEVELS (rebate hierarchy)
CREATE TABLE IF NOT EXISTS deal_levels (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id         UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  level_number    INT NOT NULL,
  label           TEXT NOT NULL,
  affiliate_id    UUID REFERENCES affiliates(id) ON DELETE SET NULL,
  rebate_forex    NUMERIC(10,4) NOT NULL DEFAULT 0,
  rebate_gold     NUMERIC(10,4) NOT NULL DEFAULT 0,
  rebate_crypto   NUMERIC(10,4) NOT NULL DEFAULT 0,
  rebate_custom   NUMERIC(10,4) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(deal_id, level_number)
);

-- 3. DEAL_NOTES
CREATE TABLE IF NOT EXISTS deal_notes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id         UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  content         TEXT NOT NULL,
  note_type       TEXT NOT NULL DEFAULT 'GENERAL' CHECK (note_type IN ('GENERAL', 'INTERNAL', 'APPROVAL')),
  user_id         UUID NOT NULL REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. DEAL_VERSIONS (change history)
CREATE TABLE IF NOT EXISTS deal_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id         UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  version_number  INT NOT NULL,
  changes         JSONB NOT NULL,
  changed_by      UUID NOT NULL REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. DEAL_APPROVAL_TOKENS
CREATE TABLE IF NOT EXISTS deal_approval_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id         UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  token           TEXT UNIQUE NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL,
  used            BOOLEAN NOT NULL DEFAULT FALSE,
  used_at         TIMESTAMPTZ,
  used_by_ip      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_deals_affiliate_id ON deals(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_deals_broker_id ON deals(broker_id);
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);
CREATE INDEX IF NOT EXISTS idx_deals_created_by ON deals(created_by);
CREATE INDEX IF NOT EXISTS idx_deals_created_at ON deals(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_deal_levels_deal_id ON deal_levels(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_levels_affiliate_id ON deal_levels(affiliate_id);

CREATE INDEX IF NOT EXISTS idx_deal_notes_deal_id ON deal_notes(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_notes_user_id ON deal_notes(user_id);

CREATE INDEX IF NOT EXISTS idx_deal_versions_deal_id ON deal_versions(deal_id);

CREATE INDEX IF NOT EXISTS idx_deal_approval_tokens_deal_id ON deal_approval_tokens(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_approval_tokens_token ON deal_approval_tokens(token);

-- ============================================================
-- UPDATED_AT TRIGGERS (match existing pattern)
-- ============================================================
CREATE OR REPLACE FUNCTION update_deals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_deals_updated_at
  BEFORE UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION update_deals_updated_at();

CREATE TRIGGER trigger_deal_levels_updated_at
  BEFORE UPDATE ON deal_levels
  FOR EACH ROW EXECUTE FUNCTION update_deals_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (matches existing CRM patterns)
-- ============================================================
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_approval_tokens ENABLE ROW LEVEL SECURITY;

-- Helper: reuse existing get_user_role() if available, otherwise define
-- (The CRM already has this function from supabase-sync.sql)

-- DEALS policies
CREATE POLICY "deals_select" ON deals FOR SELECT USING (
  (SELECT get_user_role()) IN ('ADMIN', 'STAFF') OR
  created_by = (SELECT auth.uid())
);

CREATE POLICY "deals_insert" ON deals FOR INSERT WITH CHECK (
  (SELECT get_user_role()) IN ('ADMIN', 'STAFF')
);

CREATE POLICY "deals_update" ON deals FOR UPDATE USING (
  (SELECT get_user_role()) = 'ADMIN' OR
  created_by = (SELECT auth.uid())
);

CREATE POLICY "deals_delete" ON deals FOR DELETE USING (
  (SELECT get_user_role()) = 'ADMIN'
);

-- DEAL_LEVELS policies (follow parent deal access)
CREATE POLICY "deal_levels_select" ON deal_levels FOR SELECT USING (
  EXISTS (SELECT 1 FROM deals WHERE deals.id = deal_levels.deal_id AND (
    (SELECT get_user_role()) IN ('ADMIN', 'STAFF') OR
    deals.created_by = (SELECT auth.uid())
  ))
);

CREATE POLICY "deal_levels_insert" ON deal_levels FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM deals WHERE deals.id = deal_levels.deal_id AND (
    (SELECT get_user_role()) IN ('ADMIN', 'STAFF')
  ))
);

CREATE POLICY "deal_levels_update" ON deal_levels FOR UPDATE USING (
  EXISTS (SELECT 1 FROM deals WHERE deals.id = deal_levels.deal_id AND (
    (SELECT get_user_role()) = 'ADMIN' OR
    deals.created_by = (SELECT auth.uid())
  ))
);

CREATE POLICY "deal_levels_delete" ON deal_levels FOR DELETE USING (
  EXISTS (SELECT 1 FROM deals WHERE deals.id = deal_levels.deal_id AND (
    (SELECT get_user_role()) = 'ADMIN' OR
    deals.created_by = (SELECT auth.uid())
  ))
);

-- DEAL_NOTES policies
CREATE POLICY "deal_notes_select" ON deal_notes FOR SELECT USING (
  (SELECT get_user_role()) IN ('ADMIN', 'STAFF')
);

CREATE POLICY "deal_notes_insert" ON deal_notes FOR INSERT WITH CHECK (
  (SELECT get_user_role()) IN ('ADMIN', 'STAFF')
);

-- DEAL_VERSIONS policies (read-only for staff+)
CREATE POLICY "deal_versions_select" ON deal_versions FOR SELECT USING (
  (SELECT get_user_role()) IN ('ADMIN', 'STAFF')
);

CREATE POLICY "deal_versions_insert" ON deal_versions FOR INSERT WITH CHECK (
  (SELECT get_user_role()) IN ('ADMIN', 'STAFF')
);

-- DEAL_APPROVAL_TOKENS policies
-- Select: service_role only (API routes use admin client for token validation)
-- Insert: ADMIN/STAFF can create tokens when sending deals
CREATE POLICY "deal_approval_tokens_select" ON deal_approval_tokens FOR SELECT USING (
  (SELECT get_user_role()) = 'ADMIN'
);

CREATE POLICY "deal_approval_tokens_insert" ON deal_approval_tokens FOR INSERT WITH CHECK (
  (SELECT get_user_role()) IN ('ADMIN', 'STAFF')
);

CREATE POLICY "deal_approval_tokens_update" ON deal_approval_tokens FOR UPDATE USING (
  (SELECT get_user_role()) = 'ADMIN'
);

-- ============================================================
-- EXTEND AUDIT_LOGS ENTITY TYPE
-- The existing check constraint on entity_type needs updating
-- to include 'DEAL'. If it uses an enum, alter it. If it's a
-- CHECK constraint, we drop and re-add.
-- ============================================================

-- Drop existing check constraint on entity_type (safe — name may vary)
DO $$
BEGIN
  -- Try to drop any CHECK constraint on entity_type
  ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_entity_type_check;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Re-add with DEAL included
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_entity_type_check
  CHECK (entity_type IN ('AFFILIATE', 'BROKER', 'COMMISSION', 'USER', 'DEAL'));
