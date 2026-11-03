-- App Review fixes (rejection of 1.1.0, Nov 2026):
-- * 3.1.1: credits come only from In-App Purchase or from playing, never from a code. Referral codes
--   no longer give credits; a referral is no longer recorded at all.
-- * 5.1.1(v): buying credits must not need registration. The app signs a buyer in as a guest (a
--   Supabase anonymous user) so purchases have an account to land on. Guests get no free credits
--   (sign-up bonus, starter rewards, XP trade-in): reinstalling would otherwise farm them. The
--   sign-up bonus is paid when a guest signs in with Apple, which keeps the same user id.

create or replace function public.is_guest(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_anonymous from auth.users where id = uid), false);
$$;

revoke all on function public.is_guest(uuid) from public, anon, authenticated;

-- New accounts: a profile always, the sign-up bonus only for real (non-guest) accounts.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, referral_code) values (new.id, public.random_code()) on conflict do nothing;
  if not coalesce(new.is_anonymous, false) then
    perform public.grant_credits(new.id, 50, 'signup_bonus', 'signup:' || new.id::text, '{}'::jsonb);
  end if;
  return new;
end;
$$;

-- A guest who signs in with Apple becomes a real account: pay the sign-up bonus then (once, by ref).
create or replace function public.handle_guest_upgraded()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.grant_credits(new.id, 50, 'signup_bonus', 'signup:' || new.id::text, '{}'::jsonb);
  return new;
end;
$$;

drop trigger if exists on_auth_guest_upgraded on auth.users;
create trigger on_auth_guest_upgraded
  after update of is_anonymous on auth.users
  for each row
  when (old.is_anonymous is true and new.is_anonymous is false)
  execute function public.handle_guest_upgraded();

-- Referral codes no longer unlock credits (guideline 3.1.1).
create or replace function public.claim_referral(p_code text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'referrals_closed' using errcode = 'P0001';
end;
$$;

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
  if public.is_guest(uid) then raise exception 'sign_in_required' using errcode = 'P0001'; end if;
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

create or replace function public.claim_starter_reward(p_kind text)
returns table (granted integer, balance integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  amount integer;
  ref_key text;
begin
  if uid is null then raise exception 'unauthorized' using errcode = 'P0001'; end if;
  -- Guests earn nothing free; the client tries again after they sign in.
  if public.is_guest(uid) then raise exception 'sign_in_required' using errcode = 'P0001'; end if;
  amount := case p_kind when 'profile' then 20 when 'tour' then 20 when 'first_day' then 30 end;
  if amount is null then raise exception 'bad_kind' using errcode = 'P0001'; end if;
  if (select created_at from auth.users where id = uid) < now() - interval '30 days' then
    raise exception 'starter_too_late' using errcode = 'P0001';
  end if;
  ref_key := 'starter:' || p_kind || ':' || uid::text;
  perform pg_advisory_xact_lock(hashtext(ref_key));
  if exists (select 1 from public.credit_ledger where ref = ref_key) then
    return query select 0, public.credit_balance(uid);
    return;
  end if;
  perform public.grant_credits(uid, amount, 'starter', ref_key, jsonb_build_object('kind', p_kind));
  return query select amount, public.credit_balance(uid);
end;
$$;
