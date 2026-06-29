-- Monetized API platform schema (run in Supabase SQL editor)

create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  balance numeric(12, 6) not null default 0,
  total_spent numeric(12, 6) not null default 0,
  is_active boolean not null default true,
  is_admin boolean not null default false
);

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  key_hash text not null unique,
  key_preview text not null,
  name text not null default 'Default',
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  is_active boolean not null default true,
  rate_limit integer not null default 60,
  last_used_at timestamptz
);

create index if not exists api_keys_user_id_idx on public.api_keys(user_id);
create index if not exists api_keys_key_preview_idx on public.api_keys(key_preview);

create table if not exists public.api_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  api_key_id uuid references public.api_keys(id) on delete set null,
  endpoint text not null,
  method text not null,
  tokens_input integer not null default 0,
  tokens_output integer not null default 0,
  tokens_total integer not null default 0,
  cost numeric(12, 6) not null default 0,
  response_time_ms integer,
  status_code integer,
  created_at timestamptz not null default now()
);

create index if not exists api_usage_user_id_idx on public.api_usage(user_id);
create index if not exists api_usage_created_at_idx on public.api_usage(created_at desc);

create table if not exists public.billing_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null check (type in ('usage', 'topup', 'refund', 'adjustment')),
  amount numeric(12, 6) not null,
  description text,
  reference_id text,
  created_at timestamptz not null default now()
);

create index if not exists billing_transactions_user_id_idx on public.billing_transactions(user_id);

create table if not exists public.pricing (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  cost_per_token numeric(12, 8) not null default 0.0001,
  cost_per_request numeric(12, 8) not null default 0.001,
  updated_at timestamptz not null default now()
);

insert into public.pricing (endpoint, cost_per_token, cost_per_request)
values ('default', 0.0001, 0.001)
on conflict (endpoint) do nothing;

insert into public.pricing (endpoint, cost_per_token, cost_per_request)
values ('/api/generate', 0.0001, 0.001)
on conflict (endpoint) do nothing;

insert into public.pricing (endpoint, cost_per_token, cost_per_request)
values ('/api/public/chat', 0.00012, 0.001)
on conflict (endpoint) do nothing;

-- Service role bypasses RLS; enable RLS for direct client access if needed later
alter table public.users enable row level security;
alter table public.api_keys enable row level security;
alter table public.api_usage enable row level security;
alter table public.billing_transactions enable row level security;
alter table public.pricing enable row level security;
