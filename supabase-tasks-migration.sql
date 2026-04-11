-- ============================================================
-- FX Unlocked CRM — Tasks Module Migration
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- Safe to run multiple times (idempotent)
-- ============================================================

-- ── 1. Create tasks table ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  priority     TEXT NOT NULL DEFAULT 'MEDIUM'
                 CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  owner_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  deadline     DATE,
  status       TEXT NOT NULL DEFAULT 'TODO'
                 CHECK (status IN ('TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED')),
  description  TEXT,
  created_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. Indexes ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tasks_owner_id    ON tasks(owner_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by  ON tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_status      ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority    ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_deadline    ON tasks(deadline);

-- ── 3. Auto-update updated_at ─────────────────────────────────
CREATE OR REPLACE FUNCTION update_tasks_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_updated_at ON tasks;
CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_tasks_updated_at();

-- ── 4. Row Level Security ─────────────────────────────────────
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view all tasks
DROP POLICY IF EXISTS "tasks_select" ON tasks;
CREATE POLICY "tasks_select" ON tasks
  FOR SELECT TO authenticated
  USING (true);

-- All authenticated users can create tasks
DROP POLICY IF EXISTS "tasks_insert" ON tasks;
CREATE POLICY "tasks_insert" ON tasks
  FOR INSERT TO authenticated
  WITH CHECK (created_by = (SELECT auth.uid()));

-- Admins can update any task; staff can update tasks they own or created
DROP POLICY IF EXISTS "tasks_update" ON tasks;
CREATE POLICY "tasks_update" ON tasks
  FOR UPDATE TO authenticated
  USING (
    (SELECT get_user_role()) = 'ADMIN'
    OR owner_id = (SELECT auth.uid())
    OR created_by = (SELECT auth.uid())
  );

-- Only admins can delete tasks
DROP POLICY IF EXISTS "tasks_delete" ON tasks;
CREATE POLICY "tasks_delete" ON tasks
  FOR DELETE TO authenticated
  USING ((SELECT get_user_role()) = 'ADMIN');
