-- RYPL shared workspace — run once in Supabase: Dashboard → SQL Editor → paste → Run.
-- Only the local RYPL server talks to these tables (with the service-role key), so RLS is ON with no policies:
-- nobody can read or write them with the public anon key.

create table if not exists public.plan_items (
  id          text primary key,
  status      text not null,
  date        text not null,
  data        jsonb not null,           -- the full calendar item (title, angle, result, caption…)
  updated_at  timestamptz not null default now(),
  claimed_by  text,                     -- which laptop is generating / publishing it right now
  claimed_at  timestamptz
);
create index if not exists plan_items_date on public.plan_items (date);

create table if not exists public.kv (
  key         text primary key,         -- 'brand', 'autopilot', 'autoplan:2026-10-23' (daily planning lock)
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);

alter table public.plan_items enable row level security;
alter table public.kv enable row level security;

-- Private bucket for rendered posts/reels, uploads and logos.
insert into storage.buckets (id, name, public)
values ('rypl', 'rypl', false)
on conflict (id) do nothing;
