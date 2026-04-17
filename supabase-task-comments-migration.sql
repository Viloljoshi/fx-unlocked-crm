-- ============================================================
-- FX Unlocked CRM — Task Comments Migration
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- Safe to run multiple times (idempotent)
-- ============================================================

-- ── 1. Create task_comments table ─────────────────────────────
CREATE TABLE IF NOT EXISTS task_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  content     TEXT NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 5000),
  created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  edited      BOOLEAN DEFAULT FALSE
);

-- ── 2. Indexes ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id    ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_created_by ON task_comments(created_by);
CREATE INDEX IF NOT EXISTS idx_task_comments_created_at ON task_comments(created_at DESC);

-- ── 3. Auto-update updated_at + edited flag ───────────────────
CREATE OR REPLACE FUNCTION update_task_comments_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only set edited=true when content actually changes
  IF OLD.content IS DISTINCT FROM NEW.content THEN
    NEW.edited = TRUE;
  END IF;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS task_comments_updated_at ON task_comments;
CREATE TRIGGER task_comments_updated_at
  BEFORE UPDATE ON task_comments
  FOR EACH ROW EXECUTE FUNCTION update_task_comments_updated_at();

-- ── 4. Row Level Security ─────────────────────────────────────
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view comments
DROP POLICY IF EXISTS "task_comments_select" ON task_comments;
CREATE POLICY "task_comments_select" ON task_comments
  FOR SELECT TO authenticated USING (true);

-- Authenticated users can add their own comments
DROP POLICY IF EXISTS "task_comments_insert" ON task_comments;
CREATE POLICY "task_comments_insert" ON task_comments
  FOR INSERT TO authenticated
  WITH CHECK (created_by = (SELECT auth.uid()));

-- Authors can edit their own comments; admins can edit any
DROP POLICY IF EXISTS "task_comments_update" ON task_comments;
CREATE POLICY "task_comments_update" ON task_comments
  FOR UPDATE TO authenticated
  USING (
    (SELECT get_user_role()) = 'ADMIN'
    OR created_by = (SELECT auth.uid())
  );

-- Authors can delete their own comments; admins can delete any
DROP POLICY IF EXISTS "task_comments_delete" ON task_comments;
CREATE POLICY "task_comments_delete" ON task_comments
  FOR DELETE TO authenticated
  USING (
    (SELECT get_user_role()) = 'ADMIN'
    OR created_by = (SELECT auth.uid())
  );

-- ============================================================
-- Verification query — should return the new table
-- ============================================================
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema='public' AND table_name='task_comments';
