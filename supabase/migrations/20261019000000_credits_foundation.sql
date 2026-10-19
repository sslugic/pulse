-- Pulse accounts, AI credits and cloud backup.
--
-- Credits live in an append-only ledger: every grant (sign-up bonus, purchase, subscription
-- renewal, refund) and every spend (an AI call) is one row, and the balance is their sum.
-- Clients can only read their own rows; all writes go through security-definer functions that
-- the edge functions call with the service role.

-- ---------- Profiles ----------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "read own profile" on public.profiles for select using (auth.uid() = id);

-- ---------- Ledger ----------

create table public.credit_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  delta integer not null check (delta <> 0),
  reason text not null check (reason in ('signup_bonus', 'purchase', 'subscription', 'usage', 'refund', 'revoked', 'admin')),
  -- Idempotency key: RevenueCat event id, AI request id, ... A replayed event can't grant twice.
  ref text unique,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index credit_ledger_user_idx on public.credit_ledger (user_id, created_at desc);

alter table public.credit_ledger enable row level security;
create policy "read own ledger" on public.credit_ledger for select using (auth.uid() = user_id);

-- ---------- Prices: what each AI feature costs and what each product grants ----------
-- Kept in tables so prices can change without shipping a new app build.

create table public.feature_costs (
  feature text primary key,
  credits integer not null check (credits >= 0),
  description text not null default ''
);

alter table public.feature_costs enable row level security;
create policy "anyone can read prices" on public.feature_costs for select using (true);

insert into public.feature_costs (feature, credits, description) values
  ('coach', 1, 'Coach reply to a text message'),
  ('coach_media', 2, 'Coach reply to a voice note or photo'),
  ('voice', 1, 'Coach reply read aloud in a natural voice'),
  ('insight', 0, 'Daily one-line insight on HQ'),
  ('wellbeing', 1, 'Stress and sleep analysis'),
  ('meal_plan', 3, 'Meal plan'),
  ('workout_plan', 3, 'Workout plan'),
  ('recap', 2, 'Weekly comic recap captions'),
  ('estimate', 0, 'Repairing a meal saved without calories'),
  ('goal_plan', 1, 'Nutrition targets from a goal');

create table public.products (
  product_id text primary key, -- App Store / RevenueCat product identifier
  credits integer not null check (credits > 0),
  kind text not null check (kind in ('pack', 'subscription')),
  label text not null default ''
);

alter table public.products enable row level security;
create policy "anyone can read products" on public.products for select using (true);

insert into public.products (product_id, credits, kind, label) values
  ('pulse_credits_100', 100, 'pack', '100 credits'),
  ('pulse_credits_500', 500, 'pack', '500 credits'),
  ('pulse_credits_1500', 1500, 'pack', '1,500 credits'),
  ('pulse_pro_monthly', 1000, 'subscription', 'Pulse Pro: 1,000 credits every month');

-- ---------- Subscriptions (kept in sync by the RevenueCat webhook) ----------

create table public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  product_id text not null,
  active boolean not null default false,
  expires_at timestamptz,
  will_renew boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;
create policy "read own subscription" on public.subscriptions for select using (auth.uid() = user_id);

-- ---------- Cloud backup of the app's local data ----------

create table public.user_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.user_state enable row level security;
create policy "read own backup" on public.user_state for select using (auth.uid() = user_id);
create policy "write own backup" on public.user_state for insert with check (auth.uid() = user_id);
create policy "update own backup" on public.user_state for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own backup" on public.user_state for delete using (auth.uid() = user_id);

-- ---------- Functions ----------

create or replace function public.credit_balance(uid uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(delta), 0)::integer from public.credit_ledger where user_id = uid;
$$;

-- The signed-in user's own balance, callable from the app with supabase.rpc('my_balance').
create or replace function public.my_balance()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select public.credit_balance(auth.uid());
$$;

-- Adds credits once per ref. Returns the new balance (unchanged if the ref was already used).
create or replace function public.grant_credits(uid uuid, amount integer, why text, ref_key text, info jsonb default '{}'::jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.credit_ledger (user_id, delta, reason, ref, meta)
  values (uid, amount, why, ref_key, coalesce(info, '{}'::jsonb))
  on conflict (ref) do nothing;
  return public.credit_balance(uid);
end;
$$;

-- Spends credits atomically: locks the user's ledger, refuses if the balance is too low, and is
-- idempotent per ref (a retried request isn't charged twice). Returns the new balance, or raises
-- 'insufficient_credits'.
create or replace function public.spend_credits(uid uuid, amount integer, ref_key text, info jsonb default '{}'::jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  bal integer;
begin
  if amount <= 0 then
    return public.credit_balance(uid);
  end if;
  perform pg_advisory_xact_lock(hashtext(uid::text));
  if exists (select 1 from public.credit_ledger where ref = ref_key) then
    return public.credit_balance(uid);
  end if;
  bal := public.credit_balance(uid);
  if bal < amount then
    raise exception 'insufficient_credits' using errcode = 'P0001', detail = bal::text;
  end if;
  insert into public.credit_ledger (user_id, delta, reason, ref, meta)
  values (uid, -amount, 'usage', ref_key, coalesce(info, '{}'::jsonb));
  return bal - amount;
end;
$$;

-- Only the service role (edge functions) may move credits.
revoke all on function public.grant_credits(uuid, integer, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.spend_credits(uuid, integer, text, jsonb) from public, anon, authenticated;
revoke all on function public.credit_balance(uuid) from public, anon, authenticated;
grant execute on function public.my_balance() to authenticated;

-- New accounts get a profile and a starter balance.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  perform public.grant_credits(new.id, 50, 'signup_bonus', 'signup:' || new.id::text, '{}'::jsonb);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
