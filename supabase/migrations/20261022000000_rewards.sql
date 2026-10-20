-- Referrals, XP-for-credits and more challenge types.
--
-- Economics (docs/CREDIT-ECONOMICS.md): one credit costs us about $0.004 of AI at 2027 prices.
-- * Referral: the new player and the referrer each get 25 credits (~$0.10 each). A referrer earns
--   from at most 10 referrals per 30 days (250 credits, ~$1).
-- * XP trade-in: 1,000 XP buys 10 credits, at most 20 credits per 7 days, from accounts at least a
--   week old. A steady player earns ~700 XP a week, so about 30 credits a month (~$0.12).
--   Trading XP doesn't lower anyone's rank; the XP spent is tracked in the ledger.

-- ---------- Ledger reasons ----------

alter table public.credit_ledger drop constraint credit_ledger_reason_check;
alter table public.credit_ledger add constraint credit_ledger_reason_check
  check (reason in ('signup_bonus', 'purchase', 'subscription', 'usage', 'refund', 'revoked', 'admin', 'referral', 'xp_redeem'));

-- ---------- Referrals ----------

alter table public.profiles add column referral_code text unique;
alter table public.profiles add column referred_by uuid references auth.users (id) on delete set null;
alter table public.profiles add column referred_at timestamptz;

update public.profiles set referral_code = public.random_code() where referral_code is null;

-- New accounts get a referral code along with the profile and starter credits.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, referral_code) values (new.id, public.random_code()) on conflict do nothing;
  perform public.grant_credits(new.id, 50, 'signup_bonus', 'signup:' || new.id::text, '{}'::jsonb);
  return new;
end;
$$;

-- The caller's referral code and how it's doing.
create or replace function public.my_referrals()
returns table (code text, referred integer, credits_earned integer, can_claim boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  c text;
begin
  if uid is null then raise exception 'unauthorized' using errcode = 'P0001'; end if;
  select referral_code into c from public.profiles where id = uid;
  if c is null then
    c := public.random_code();
    insert into public.profiles (id, referral_code) values (uid, c)
    on conflict (id) do update set referral_code = coalesce(public.profiles.referral_code, excluded.referral_code)
    returning referral_code into c;
  end if;
  return query select
    c,
    (select count(*)::int from public.profiles where referred_by = uid),
    (select coalesce(sum(delta), 0)::int from public.credit_ledger where user_id = uid and reason = 'referral' and ref like 'referral-out:%'),
    exists (
      select 1 from public.profiles p join auth.users u on u.id = p.id
      where p.id = uid and p.referred_by is null and u.created_at > now() - interval '14 days'
    );
end;
$$;

-- A new player enters who invited them (within 14 days of signing up, once). Both get 25 credits;
-- the referrer only while under 10 paid referrals in the last 30 days. Returns the new balance.
create or replace function public.claim_referral(p_code text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  referrer uuid;
  created timestamptz;
begin
  if uid is null then raise exception 'unauthorized' using errcode = 'P0001'; end if;
  select created_at into created from auth.users where id = uid;
  if created < now() - interval '14 days' then raise exception 'referral_too_late' using errcode = 'P0001'; end if;
  if exists (select 1 from public.profiles where id = uid and referred_by is not null) then
    raise exception 'referral_used' using errcode = 'P0001';
  end if;
  select id into referrer from public.profiles where referral_code = upper(btrim(p_code));
  if referrer is null then raise exception 'code_not_found' using errcode = 'P0001'; end if;
  if referrer = uid then raise exception 'own_code' using errcode = 'P0001'; end if;
  -- Two accounts can't refer each other.
  if exists (select 1 from public.profiles where id = referrer and referred_by = uid) then
    raise exception 'code_not_found' using errcode = 'P0001';
  end if;

  update public.profiles set referred_by = referrer, referred_at = now() where id = uid;
  perform public.grant_credits(uid, 25, 'referral', 'referral-in:' || uid::text, jsonb_build_object('referrer', referrer));
  perform pg_advisory_xact_lock(hashtext('referral:' || referrer::text));
  if (select count(*) from public.credit_ledger
      where user_id = referrer and reason = 'referral' and ref like 'referral-out:%' and created_at > now() - interval '30 days') < 10 then
    perform public.grant_credits(referrer, 25, 'referral', 'referral-out:' || uid::text, jsonb_build_object('referee', uid));
  end if;
  return public.credit_balance(uid);
end;
$$;

-- ---------- XP for credits ----------

-- What the caller can trade: XP already traded, credits traded this week, and whether the account is
-- old enough.
create or replace function public.xp_trade_status()
returns table (xp_spent integer, credits_this_week integer, eligible boolean)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((select sum((meta->>'xp')::int) from public.credit_ledger where user_id = auth.uid() and reason = 'xp_redeem'), 0)::int,
    coalesce((select sum(delta) from public.credit_ledger where user_id = auth.uid() and reason = 'xp_redeem' and created_at > now() - interval '7 days'), 0)::int,
    coalesce((select created_at < now() - interval '7 days' from auth.users where id = auth.uid()), false);
$$;

-- Trades 1,000 XP for 10 credits. `p_total_xp` is the player's lifetime XP from the device; the XP
-- already traded is subtracted on the server. Returns the new balance.
create or replace function public.redeem_xp(p_total_xp integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  spent integer;
  week integer;
begin
  if uid is null then raise exception 'unauthorized' using errcode = 'P0001'; end if;
  perform pg_advisory_xact_lock(hashtext('xp:' || uid::text));
  if (select created_at from auth.users where id = uid) > now() - interval '7 days' then
    raise exception 'xp_too_new' using errcode = 'P0001';
  end if;
  select coalesce(sum((meta->>'xp')::int), 0) into spent from public.credit_ledger where user_id = uid and reason = 'xp_redeem';
  select coalesce(sum(delta), 0) into week from public.credit_ledger where user_id = uid and reason = 'xp_redeem' and created_at > now() - interval '7 days';
  if week + 10 > 20 then raise exception 'xp_weekly_cap' using errcode = 'P0001'; end if;
  if p_total_xp - spent < 1000 then raise exception 'xp_not_enough' using errcode = 'P0001'; end if;
  perform public.grant_credits(uid, 10, 'xp_redeem', 'xp:' || uid::text || ':' || (spent + 1000)::text, jsonb_build_object('xp', 1000));
  return public.credit_balance(uid);
end;
$$;

-- ---------- More challenges ----------

alter table public.challenges drop constraint challenges_template_check;
alter table public.challenges add constraint challenges_template_check check (template in (
  'logging', 'protein', 'meals', 'water', 'workouts',
  'calories', 'sleep', 'journal', 'breakfast', 'weighin', 'active', 'burn', 'quests', 'perfect'
));
alter table public.challenges drop constraint challenges_target_check;
alter table public.challenges add constraint challenges_target_check check (target between 1 and 100000);
alter table public.challenges add column hard boolean not null default false;

drop function public.create_challenge(text, integer, date, integer, uuid);
create or replace function public.create_challenge(p_template text, p_target integer, p_starts date, p_days integer, p_opponent uuid default null, p_hard boolean default false)
returns public.challenges
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row public.challenges;
begin
  if uid is null then raise exception 'unauthorized' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.social_profiles where user_id = uid) then raise exception 'no_profile' using errcode = 'P0001'; end if;
  if p_days not in (3, 7, 14) or p_starts < current_date - 1 or p_starts > current_date + 1 then
    raise exception 'bad_request' using errcode = 'P0001';
  end if;
  if p_opponent is not null and (not public.are_friends(uid, p_opponent) or public.is_blocked(uid, p_opponent)) then
    raise exception 'not_friends' using errcode = 'P0001';
  end if;
  if (select count(*) from public.challenges c where uid in (c.created_by, c.opponent) and c.ends >= current_date - 1 and c.declined_at is null) >= 10 then
    raise exception 'too_many_challenges' using errcode = 'P0001';
  end if;
  insert into public.challenges (template, target, starts, ends, created_by, opponent, hard)
  values (p_template, p_target, p_starts, p_starts + p_days - 1, uid, p_opponent, coalesce(p_hard, false))
  returning * into row;
  insert into public.challenge_progress (challenge_id, user_id) values (row.id, uid);
  if p_opponent is not null then
    insert into public.challenge_progress (challenge_id, user_id) values (row.id, p_opponent);
  end if;
  return row;
end;
$$;

-- ---------- Grants ----------

do $$
declare
  f text;
begin
  foreach f in array array[
    'my_referrals()', 'claim_referral(text)', 'xp_trade_status()', 'redeem_xp(integer)',
    'create_challenge(text, integer, date, integer, uuid, boolean)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end;
$$;
