-- Run this in the Supabase SQL editor, in addition to schema.sql.
--
-- Stores Plaid access tokens - these must NEVER be reachable from
-- client-side code under any circumstances. This table intentionally has
-- NO RLS policies for anon/authenticated roles: only the service role key
-- (used exclusively by the serverless functions in /api/plaid/*, which
-- bypasses RLS by design) may ever read or write it.

create table if not exists plaid_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null unique,
  access_token text not null,
  cursor text,
  institution_id text,
  institution_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table plaid_items enable row level security;

create index if not exists plaid_items_user_id_idx on plaid_items(user_id);
