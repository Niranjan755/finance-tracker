-- Web push notification support: one row per subscribed browser/device, plus
-- a dedup log so the daily alert cron doesn't re-notify about the same
-- bill/budget every day it stays unresolved. Run this once in the Supabase
-- SQL editor (mirrors schema.sql / plaid_schema.sql from earlier setup).

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;

create policy "manage own subscriptions" on push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists sent_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dedup_key text not null,
  sent_at timestamptz not null default now(),
  unique (user_id, dedup_key)
);

alter table sent_notifications enable row level security;
-- Deliberately no anon/authenticated policies - only the service role
-- (used exclusively by the api/cron/check-alerts serverless function) needs
-- to read or write this table.
