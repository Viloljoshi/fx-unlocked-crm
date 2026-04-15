-- ============================================================
-- FX UNLOCKED CRM — MULTI-DEAL PER PARTNER MIGRATION
-- Run this in Supabase SQL Editor
--
-- PURPOSE: Enable multiple deals per affiliate/IB partner
-- e.g. Lewis Page → CPA with Startrader AND REBATES with PU Prime
--
-- SAFE TO RUN: All operations use IF NOT EXISTS / IF EXISTS guards
-- BACKWARDS COMPATIBLE: deal_id is nullable, existing data stays intact
-- ============================================================

-- 1. ADD deal_id TO COMMISSIONS TABLE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commissions' AND column_name = 'deal_id'
  ) THEN
    ALTER TABLE commissions ADD COLUMN deal_id UUID REFERENCES deals(id) ON DELETE SET NULL;
    CREATE INDEX idx_commissions_deal_id ON commissions(deal_id);
    RAISE NOTICE 'Added deal_id column to commissions';
  ELSE
    RAISE NOTICE 'deal_id column already exists on commissions';
  END IF;
END $$;

-- 2. ADD deal_notes TO DEALS TABLE (for inline notes from affiliate form)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'deals' AND column_name = 'deal_notes'
  ) THEN
    ALTER TABLE deals ADD COLUMN deal_notes TEXT;
    RAISE NOTICE 'Added deal_notes column to deals';
  ELSE
    RAISE NOTICE 'deal_notes column already exists on deals';
  END IF;
END $$;

-- 3a. Create deals from affiliate_brokers junction table
-- (affiliates that have deal_type set + linked brokers via junction table)
INSERT INTO deals (affiliate_id, broker_id, deal_type, status, deal_details, deal_notes, created_by, created_at, updated_at)
SELECT
  a.id, ab.broker_id, a.deal_type, 'ACTIVE',
  COALESCE(a.deal_details, '{}')::jsonb,
  COALESCE(a.deal_details->>'notes', NULL),
  COALESCE(a.manager_id, (SELECT id FROM profiles WHERE role = 'ADMIN' LIMIT 1)),
  a.created_at, NOW()
FROM affiliates a
JOIN affiliate_brokers ab ON ab.affiliate_id = a.id
WHERE a.deal_type IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM deals d
    WHERE d.affiliate_id = a.id AND d.broker_id = ab.broker_id AND d.deal_type = a.deal_type
  );

-- 3b. Create deals for affiliates with deal_type but NO broker associations
INSERT INTO deals (affiliate_id, broker_id, deal_type, status, deal_details, deal_notes, created_by, created_at, updated_at)
SELECT
  a.id, NULL, a.deal_type, 'ACTIVE',
  COALESCE(a.deal_details, '{}')::jsonb,
  COALESCE(a.deal_details->>'notes', NULL),
  COALESCE(a.manager_id, (SELECT id FROM profiles WHERE role = 'ADMIN' LIMIT 1)),
  a.created_at, NOW()
FROM affiliates a
WHERE a.deal_type IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM affiliate_brokers ab WHERE ab.affiliate_id = a.id)
  AND NOT EXISTS (
    SELECT 1 FROM deals d
    WHERE d.affiliate_id = a.id AND d.broker_id IS NULL AND d.deal_type = a.deal_type
  );

-- Report
DO $$
DECLARE deal_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO deal_count FROM deals;
  RAISE NOTICE 'Total deals in table after migration: %', deal_count;
END $$;

-- 4. BACKFILL commissions.deal_id
UPDATE commissions c SET deal_id = d.id
FROM deals d
WHERE c.deal_id IS NULL
  AND c.affiliate_id = d.affiliate_id
  AND (
    (c.broker_id IS NOT NULL AND c.broker_id = d.broker_id)
    OR (c.broker_id IS NULL AND d.broker_id IS NULL)
  )
  AND c.deal_type = d.deal_type;

-- Report backfill
DO $$
DECLARE
  total_comms INTEGER; linked_comms INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_comms FROM commissions;
  SELECT COUNT(*) INTO linked_comms FROM commissions WHERE deal_id IS NOT NULL;
  RAISE NOTICE 'Commissions backfill: % total, % linked, % unlinked',
    total_comms, linked_comms, total_comms - linked_comms;
END $$;

-- 5. CREATE HELPER VIEW: affiliate_deals_summary
CREATE OR REPLACE VIEW affiliate_deals_summary AS
SELECT
  d.id AS deal_id,
  d.affiliate_id,
  a.name AS affiliate_name,
  d.broker_id,
  COALESCE(b.name, 'No Broker') AS broker_name,
  d.deal_type,
  d.status AS deal_status,
  d.deal_notes,
  d.deal_details,
  d.created_at,
  d.deal_type || ' - ' || COALESCE(b.name, 'No Broker') AS deal_label,
  a.name || ' - ' || d.deal_type || ' - ' || COALESCE(b.name, 'No Broker') AS full_label
FROM deals d
JOIN affiliates a ON a.id = d.affiliate_id
LEFT JOIN brokers b ON b.id = d.broker_id
WHERE d.status IN ('ACTIVE', 'DRAFT', 'PENDING');

-- 6. ADD COMPOSITE INDEXES
CREATE INDEX IF NOT EXISTS idx_commissions_affiliate_deal
  ON commissions(affiliate_id, deal_id);
CREATE INDEX IF NOT EXISTS idx_deals_affiliate_broker_type
  ON deals(affiliate_id, broker_id, deal_type);

-- ============================================================
-- DONE!
-- commissions: +deal_id UUID FK (nullable, indexed)
-- deals: +deal_notes TEXT
-- New deals auto-created for existing affiliates
-- Existing commissions backfilled with deal_id
-- New view: affiliate_deals_summary
-- New indexes for performance
-- ============================================================
