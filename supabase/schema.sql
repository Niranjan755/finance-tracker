-- Run this in the Supabase SQL editor.
--
-- If you ran an earlier version of this schema (a shared `app_state` table
-- keyed by a text `id` with no RLS policies), drop it first — the shape
-- below is incompatible:
--   drop table if exists app_state;

create table if not exists app_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  revision text not null,
  updated_at timestamptz not null default now()
);

alter table app_state enable row level security;

create policy "select own row" on app_state
  for select using (auth.uid() = user_id);

create policy "insert own row" on app_state
  for insert with check (auth.uid() = user_id);

create policy "update own row" on app_state
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Required for realtime UPDATE events to fire on this table.
alter publication supabase_realtime add table app_state;

-- Example payload shape:
-- {
--   "accounts": [],
--   "categories": [],
--   "transactions": [],
--   "transfers": [],
--   "recurring": [],
--   "budgets": [],
--   "settings": { ... }
-- }
