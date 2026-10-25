-- Starter rewards: new players earn extra credits for the first steps, on top of the 50 at sign-up,
-- so the Coach lasts their first week (~10-12 credits a day with voice replies):
-- * profile: finished the welcome setup (20)
-- * tour: went through the app tour to the end (20)
-- * first_day: logged a full first day (30)
-- Each is paid once per account, within 30 days of signing up (~$0.28 per player in total).

alter table public.credit_ledger drop constraint credit_ledger_reason_check;
alter table public.credit_ledger add constraint credit_ledger_reason_check
  check (reason in ('signup_bonus', 'purchase', 'subscription', 'usage', 'refund', 'revoked', 'admin', 'referral', 'xp_redeem', 'starter'));

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

revoke all on function public.claim_starter_reward(text) from public, anon;
grant execute on function public.claim_starter_reward(text) to authenticated;
