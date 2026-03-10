# FX Unlocked CRM — Project Memory

## Project Overview
- **Repo**: https://github.com/Viloljoshi/fx-unlocked-crm.git
- **Stack**: Next.js 14 (App Router) + Supabase + Tailwind + shadcn/ui
- **Supabase project**: `gvkmsynnhlcstfcwhxno` — "FX Unlocked CRM" — ap-northeast-1 — ACTIVE_HEALTHY
- **Main branch**: `main` on origin
- **Worktree branch**: `claude/vibrant-chatterjee`

## Architecture
- ALL dashboard pages are `'use client'` — interactive UI with client-side Supabase queries
- Security layer = Supabase RLS (not SSR) — the anon key is intentionally public
- `lib/supabase/client.js` — browser client (anon key)
- `lib/supabase/server.js` — server client + admin client (service role key, server-only)
- `middleware.js` — auth guard redirecting unauthenticated users away from `/dashboard`
- `app/api/` — server-side API routes: AI chat, user management (invite/delete)
- `lib/hooks/useUserRole.js` — client hook returning `{userId, role, profile, loading}`

## DB Tables (all RLS-enabled)
profiles, affiliates, brokers, commissions, affiliate_notes, appointments, staff_kpis, company_kpis, audit_logs

## Key Features
- Affiliates with master_ib_id hierarchy + deal_type (CPA/PNL/HYBRID/REBATES) + deal_details JSONB
- Revenue/commissions with PENDING/PAID/AWAITED/CANCELLED statuses
- Role-based access: ADMIN sees all, STAFF sees own affiliates, VIEWER read-only
- AI chat via GPT-4o streaming (server API route)
- Dashboard customization via localStorage

## Migrations Applied (Mar 2026)
- `fix_duplicate_policies_fk_indexes_function_search_path`: removed duplicate INSERT policies on company_kpis/staff_kpis, consolidated profiles UPDATE policies, fixed function search_path security, added all FK indexes, fixed auth RLS init plan performance

## Clutter Removed
- Removed `mongodb` unused dependency from package.json
- Removed `backend_test.py`, `review_test.py`, `test_result.md`, `test_reports/`

## Dev Setup
- `.env.local` needed in worktree (copied from main repo `.env`)
- `yarn install` needed in worktree before running
- Launch config: `dev` → `yarn dev` on port 3000
