-- Pulse Squad: friends, a weekly friends board, crews with a shared streak, challenges, nudges,
-- and the reporting and blocking that App Store guideline 1.2 requires for user content.
--
-- What other people can see is deliberately small: a display name, a colour, rank, streak and XP,
-- and which days someone logged (no food, weight or health data ever leaves the user's backup).
-- People only see each other once they are friends (added through an invite link the other person
-- shared) or share a crew, and never after either one blocks the other.
--
-- Tables are readable through RLS; every write goes through a security-definer function that
-- validates it. XP and streaks are computed on the device and reported here, the same numbers the
-- player sees on HQ.

-- ---------- Names ----------

-- Display and crew names: 1-24 characters, no links, no slurs or common profanity.
create or replace function public.clean_name(raw text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  n text := btrim(regexp_replace(coalesce(raw, ''), '\s+', ' ', 'g'));
  folded text;
begin
  if char_length(n) < 1 or char_length(n) > 24 then
    raise exception 'bad_name' using errcode = 'P0001', detail = 'length';
  end if;
  if n ~* '(https?:|www\.|\.(com|net|org|io|app|gg|xyz)\b|@)' then
    raise exception 'bad_name' using errcode = 'P0001', detail = 'link';
  end if;
  -- Fold look-alike characters so "f4ck" and "s.h.i.t" are caught too.
  folded := translate(lower(n), '013457@$!|', 'oieastasii');
  folded := regexp_replace(folded, '[^a-z]', '', 'g');
  if folded ~ '(fuck|shit|cunt|bitch|whore|slut|nigg|fagg|retard|hitler|kike|chink|twat|pussy|penis|vagina|porn)' then
    raise exception 'bad_name' using errcode = 'P0001', detail = 'word';
  end if;
  return n;
end;
$$;

-- ---------- Public cards ----------

create table public.social_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  color text not null default 'orange' check (color ~ '^[a-z]{3,12}$'),
  -- Shared in invite links; anyone with it can add this player as a friend.
  invite_code text not null unique,
  rules_accepted_at timestamptz not null,
  xp integer not null default 0 check (xp >= 0),
  level integer not null default 1 check (level between 1 and 99),
  streak integer not null default 0 check (streak >= 0),
  last_day date,
  updated_at timestamptz not null default now()
);

create table public.weekly_scores (
  user_id uuid not null references auth.users (id) on delete cascade,
  week date not null, -- the Monday the week starts on, in the player's own calendar
  xp integer not null default 0 check (xp >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, week)
);

-- Days the player logged anything, for crew streaks. No detail about what was logged.
create table public.activity_days (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  primary key (user_id, day)
);

-- ---------- Relationships ----------

create table public.friendships (
  user_a uuid not null references auth.users (id) on delete cascade,
  user_b uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);
create index friendships_b_idx on public.friendships (user_b);

create table public.blocks (
  blocker uuid not null references auth.users (id) on delete cascade,
  blocked uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);
create index blocks_blocked_idx on public.blocks (blocked);

-- Reviewed by the developer in the Supabase dashboard (Apple expects action within 24 hours).
create table public.reports (
  id bigint generated always as identity primary key,
  reporter uuid references auth.users (id) on delete set null,
  reported uuid references auth.users (id) on delete set null,
  reported_name text,
  reason text not null check (reason in ('name', 'harassment', 'cheating', 'other')),
  details text check (char_length(details) <= 500),
  crew_id uuid,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.crews (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.crew_members (
  crew_id uuid not null references public.crews (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  -- The member's own calendar day they joined; days before it don't count against the crew.
  joined_day date not null,
  primary key (crew_id, user_id)
);
create index crew_members_user_idx on public.crew_members (user_id);

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  template text not null check (template in ('protein', 'meals', 'water', 'workouts', 'logging')),
  target integer not null check (target between 1 and 31),
  starts date not null,
  ends date not null,
  created_by uuid references auth.users (id) on delete cascade,
  -- Null for a solo challenge.
  opponent uuid references auth.users (id) on delete cascade,
  declined_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends >= starts and ends - starts <= 30)
);
create index challenges_creator_idx on public.challenges (created_by);
create index challenges_opponent_idx on public.challenges (opponent);

create table public.challenge_progress (
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  progress integer not null default 0 check (progress >= 0),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (challenge_id, user_id)
);

create table public.nudges (
  id bigint generated always as identity primary key,
  sender uuid not null references auth.users (id) on delete cascade,
  recipient uuid not null references auth.users (id) on delete cascade,
  day date not null, -- the sender's calendar day; one nudge per pair per day
  created_at timestamptz not null default now(),
  seen_at timestamptz,
  unique (sender, recipient, day)
);
create index nudges_recipient_idx on public.nudges (recipient, created_at desc);

create table public.push_tokens (
  token text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  sandbox boolean not null default false,
  lang text not null default 'en' check (lang ~ '^[a-z]{2}$'),
  updated_at timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id);

-- ---------- Who can see whom ----------

create or replace function public.is_blocked(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.blocks where (blocker = a and blocked = b) or (blocker = b and blocked = a));
$$;

create or replace function public.are_friends(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.friendships where user_a = least(a, b) and user_b = greatest(a, b));
$$;

create or replace function public.share_crew(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.crew_members m1 join public.crew_members m2 on m1.crew_id = m2.crew_id
    where m1.user_id = a and m2.user_id = b
  );
$$;

create or replace function public.can_see(viewer uuid, target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select viewer is not null and (
    viewer = target
    or ((public.are_friends(viewer, target) or public.share_crew(viewer, target)) and not public.is_blocked(viewer, target))
  );
$$;

create or replace function public.in_crew(crew uuid, uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.crew_members where crew_id = crew and user_id = uid);
$$;

-- ---------- Row level security (reads only; writes go through the functions below) ----------

alter table public.social_profiles enable row level security;
create policy "see visible players" on public.social_profiles for select using (public.can_see(auth.uid(), user_id));

alter table public.weekly_scores enable row level security;
create policy "see visible scores" on public.weekly_scores for select using (public.can_see(auth.uid(), user_id));

alter table public.activity_days enable row level security;
create policy "see visible days" on public.activity_days for select using (public.can_see(auth.uid(), user_id));

alter table public.friendships enable row level security;
create policy "see own friendships" on public.friendships for select using (auth.uid() in (user_a, user_b));

alter table public.blocks enable row level security;
create policy "see own blocks" on public.blocks for select using (auth.uid() = blocker);

alter table public.reports enable row level security; -- no client access

alter table public.crews enable row level security;
create policy "see own crews" on public.crews for select using (public.in_crew(id, auth.uid()));

alter table public.crew_members enable row level security;
create policy "see crewmates" on public.crew_members for select using (public.in_crew(crew_id, auth.uid()));

alter table public.challenges enable row level security;
create policy "see own challenges" on public.challenges for select using (auth.uid() in (created_by, opponent));

alter table public.challenge_progress enable row level security;
create policy "see progress in own challenges" on public.challenge_progress for select using (
  exists (select 1 from public.challenges c where c.id = challenge_id and auth.uid() in (c.created_by, c.opponent))
);

alter table public.nudges enable row level security;
create policy "see own nudges" on public.nudges for select using (auth.uid() in (sender, recipient));

alter table public.push_tokens enable row level security; -- no client reads

-- ---------- Profile and stats ----------

create or replace function public.random_code()
returns text language sql volatile set search_path = public as $$
  -- 8 characters without look-alikes (no 0/O, 1/I/L).
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '')
  from generate_series(1, 8);
$$;

-- Creates or updates the caller's card. Joining needs the community rules accepted once.
create or replace function public.save_social_profile(p_name text, p_color text, p_accept_rules boolean default false)
returns public.social_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row public.social_profiles;
begin
  if uid is null then raise exception 'unauthorized' using errcode = 'P0001'; end if;
  select * into row from public.social_profiles where user_id = uid;
  if not found then
    if not p_accept_rules then raise exception 'rules_not_accepted' using errcode = 'P0001'; end if;
    insert into public.social_profiles (user_id, name, color, invite_code, rules_accepted_at)
    values (uid, public.clean_name(p_name), coalesce(p_color, 'orange'), public.random_code(), now())
    returning * into row;
  else
    update public.social_profiles
    set name = public.clean_name(p_name), color = coalesce(p_color, color), updated_at = now()
    where user_id = uid
    returning * into row;
  end if;
  return row;
end;
$$;

-- Reports the caller's numbers: total XP, level, streak, this week's XP and recently logged days.
create or replace function public.sync_social_stats(p_xp integer, p_level integer, p_streak integer, p_week date, p_weekly_xp integer, p_days date[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'unauthorized' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.social_profiles where user_id = uid) then return; end if;
  -- A Monday within a week of the server's date (time zones put people a day either side).
  if extract(isodow from p_week) <> 1 or p_week > current_date + 1 or p_week < current_date - 8 then
    raise exception 'bad_week' using errcode = 'P0001';
  end if;
  update public.social_profiles
  set xp = greatest(0, least(p_xp, 10000000)),
      level = greatest(1, least(p_level, 99)),
      streak = greatest(0, least(p_streak, 10000)),
      last_day = (select max(d) from unnest(p_days) d where d <= current_date + 1),
      updated_at = now()
  where user_id = uid;
  insert into public.weekly_scores (user_id, week, xp, updated_at)
  values (uid, p_week, greatest(0, least(p_weekly_xp, 100000)), now())
  on conflict (user_id, week) do update set xp = excluded.xp, updated_at = now();
  insert into public.activity_days (user_id, day)
  select uid, d from unnest(p_days) d
  where d between current_date - 60 and current_date + 1
  on conflict do nothing;
end;
$$;

-- ---------- Friends ----------

-- Adds the owner of an invite code as a friend (both ways). Returns their card.
create or replace function public.add_friend(p_code text)
returns public.social_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  other public.social_profiles;
begin
  if uid is null then raise exception 'unauthorized' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.social_profiles where user_id = uid) then
    raise exception 'no_profile' using errcode = 'P0001';
  end if;
  select * into other from public.social_profiles where invite_code = upper(btrim(p_code));
  if not found then raise exception 'code_not_found' using errcode = 'P0001'; end if;
  if other.user_id = uid then raise exception 'own_code' using errcode = 'P0001'; end if;
  if public.is_blocked(uid, other.user_id) then raise exception 'code_not_found' using errcode = 'P0001'; end if;
  if (select count(*) from public.friendships where uid in (user_a, user_b)) >= 200 then
    raise exception 'too_many_friends' using errcode = 'P0001';
  end if;
  insert into public.friendships (user_a, user_b) values (least(uid, other.user_id), greatest(uid, other.user_id))
  on conflict do nothing;
  return other;
end;
$$;

create or replace function public.remove_friend(p_other uuid)
returns void language sql security definer set search_path = public as $$
  delete from public.friendships where user_a = least(auth.uid(), p_other) and user_b = greatest(auth.uid(), p_other);
$$;

-- Blocking ends the friendship, cancels open duels between the two, and hides each from the other
-- everywhere (crewmates included). The blocked player isn't told.
create or replace function public.block_user(p_other uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or p_other is null or p_other = uid then raise exception 'bad_request' using errcode = 'P0001'; end if;
  insert into public.blocks (blocker, blocked) values (uid, p_other) on conflict do nothing;
  delete from public.friendships where user_a = least(uid, p_other) and user_b = greatest(uid, p_other);
  update public.challenges set declined_at = coalesce(declined_at, now())
  where ((created_by = uid and opponent = p_other) or (created_by = p_other and opponent = uid)) and ends >= current_date - 1;
end;
$$;

create or replace function public.unblock_user(p_other uuid)
returns void language sql security definer set search_path = public as $$
  delete from public.blocks where blocker = auth.uid() and blocked = p_other;
$$;

-- Names of the people the caller has blocked, so they can unblock from settings.
create or replace function public.my_blocks()
returns table (user_id uuid, name text)
language sql stable security definer set search_path = public as $$
  select b.blocked, coalesce(p.name, '?') from public.blocks b
  left join public.social_profiles p on p.user_id = b.blocked
  where b.blocker = auth.uid() order by b.created_at desc;
$$;

create or replace function public.report_user(p_other uuid, p_reason text, p_details text default null, p_crew uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'unauthorized' using errcode = 'P0001'; end if;
  if (select count(*) from public.reports where reporter = uid and created_at > now() - interval '1 day') >= 20 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  insert into public.reports (reporter, reported, reported_name, reason, details, crew_id)
  values (uid, p_other, (select name from public.social_profiles where user_id = p_other), p_reason, left(p_details, 500), p_crew);
end;
$$;

-- ---------- Crews ----------

create or replace function public.create_crew(p_name text, p_today date)
returns public.crews
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row public.crews;
begin
  if uid is null then raise exception 'unauthorized' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.social_profiles where user_id = uid) then raise exception 'no_profile' using errcode = 'P0001'; end if;
  if (select count(*) from public.crew_members where user_id = uid) >= 3 then raise exception 'too_many_crews' using errcode = 'P0001'; end if;
  insert into public.crews (name, invite_code, created_by) values (public.clean_name(p_name), public.random_code(), uid) returning * into row;
  insert into public.crew_members (crew_id, user_id, joined_day) values (row.id, uid, p_today);
  return row;
end;
$$;

create or replace function public.join_crew(p_code text, p_today date)
returns public.crews
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row public.crews;
begin
  if uid is null then raise exception 'unauthorized' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.social_profiles where user_id = uid) then raise exception 'no_profile' using errcode = 'P0001'; end if;
  select * into row from public.crews where invite_code = upper(btrim(p_code));
  if not found then raise exception 'code_not_found' using errcode = 'P0001'; end if;
  if public.in_crew(row.id, uid) then return row; end if;
  if (select count(*) from public.crew_members where user_id = uid) >= 3 then raise exception 'too_many_crews' using errcode = 'P0001'; end if;
  perform pg_advisory_xact_lock(hashtext(row.id::text));
  if (select count(*) from public.crew_members where crew_id = row.id) >= 8 then raise exception 'crew_full' using errcode = 'P0001'; end if;
  insert into public.crew_members (crew_id, user_id, joined_day) values (row.id, uid, p_today);
  return row;
end;
$$;

create or replace function public.leave_crew(p_crew uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.crew_members where crew_id = p_crew and user_id = auth.uid();
  delete from public.crews c where c.id = p_crew and not exists (select 1 from public.crew_members m where m.crew_id = c.id);
end;
$$;

-- A crew's members as the caller sees them (blocked members show without a name), and the crew
-- streak: consecutive days, ending today or yesterday, on which every member logged. A member's
-- days before they joined don't count against the crew.
create or replace function public.crew_overview(p_crew uuid, p_today date)
returns table (user_id uuid, name text, color text, level integer, streak integer, weekly_xp integer, logged_today boolean, hidden boolean, crew_streak integer)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  run integer := 0;
  d date := p_today;
  v_week date := p_today - (extract(isodow from p_today)::int - 1);
begin
  if not public.in_crew(p_crew, uid) then raise exception 'not_member' using errcode = 'P0001'; end if;
  -- Today doesn't break the streak until it's over.
  if exists (
    select 1 from public.crew_members m
    where m.crew_id = p_crew and m.joined_day <= d
      and not exists (select 1 from public.activity_days a where a.user_id = m.user_id and a.day = d)
  ) then
    d := d - 1;
  end if;
  loop
    exit when run >= 365;
    -- Count the day only if at least one member had joined and every member who had joined logged.
    exit when not exists (select 1 from public.crew_members m where m.crew_id = p_crew and m.joined_day <= d);
    exit when exists (
      select 1 from public.crew_members m
      where m.crew_id = p_crew and m.joined_day <= d
        and not exists (select 1 from public.activity_days a where a.user_id = m.user_id and a.day = d)
    );
    run := run + 1;
    d := d - 1;
  end loop;
  return query
    select m.user_id,
           case when public.is_blocked(uid, m.user_id) then null else p.name end,
           coalesce(p.color, 'orange'),
           coalesce(p.level, 1),
           case when public.is_blocked(uid, m.user_id) then 0 else coalesce(p.streak, 0) end,
           case when public.is_blocked(uid, m.user_id) then 0 else coalesce((select w.xp from public.weekly_scores w where w.user_id = m.user_id and w.week = v_week), 0) end,
           exists (select 1 from public.activity_days a where a.user_id = m.user_id and a.day = p_today),
           public.is_blocked(uid, m.user_id),
           run
    from public.crew_members m
    left join public.social_profiles p on p.user_id = m.user_id
    where m.crew_id = p_crew
    order by m.joined_at;
end;
$$;

-- ---------- Challenges ----------

create or replace function public.create_challenge(p_template text, p_target integer, p_starts date, p_days integer, p_opponent uuid default null)
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
  insert into public.challenges (template, target, starts, ends, created_by, opponent)
  values (p_template, p_target, p_starts, p_starts + p_days - 1, uid, p_opponent)
  returning * into row;
  insert into public.challenge_progress (challenge_id, user_id) values (row.id, uid);
  if p_opponent is not null then
    insert into public.challenge_progress (challenge_id, user_id) values (row.id, p_opponent);
  end if;
  return row;
end;
$$;

-- Either side can call off a duel; a solo challenge is just dropped.
create or replace function public.decline_challenge(p_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.challenges set declined_at = coalesce(declined_at, now())
  where id = p_id and auth.uid() in (created_by, opponent);
$$;

create or replace function public.report_challenge_progress(p_id uuid, p_progress integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  c public.challenges;
begin
  if uid is null then raise exception 'unauthorized' using errcode = 'P0001'; end if;
  select * into c from public.challenges where id = p_id;
  if not found or uid not in (c.created_by, coalesce(c.opponent, c.created_by)) then raise exception 'not_found' using errcode = 'P0001'; end if;
  -- Accept progress until a day after the last day, for players a time zone behind.
  if c.declined_at is not null or current_date > c.ends + 1 then return; end if;
  insert into public.challenge_progress (challenge_id, user_id, progress, completed_at, updated_at)
  values (p_id, uid, least(greatest(p_progress, 0), c.target), case when p_progress >= c.target then now() end, now())
  on conflict (challenge_id, user_id) do update
    set progress = greatest(public.challenge_progress.progress, excluded.progress),
        completed_at = coalesce(public.challenge_progress.completed_at, excluded.completed_at),
        updated_at = now();
end;
$$;

-- ---------- Nudges and push ----------

create or replace function public.register_push_token(p_token text, p_sandbox boolean, p_lang text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or p_token !~ '^[0-9a-fA-F]{32,200}$' then raise exception 'bad_request' using errcode = 'P0001'; end if;
  insert into public.push_tokens (token, user_id, sandbox, lang, updated_at)
  values (lower(p_token), auth.uid(), p_sandbox, case when p_lang ~ '^[a-z]{2}$' then p_lang else 'en' end, now())
  on conflict (token) do update set user_id = excluded.user_id, sandbox = excluded.sandbox, lang = excluded.lang, updated_at = now();
end;
$$;

create or replace function public.unregister_push_token(p_token text)
returns void language sql security definer set search_path = public as $$
  delete from public.push_tokens where token = lower(p_token) and user_id = auth.uid();
$$;

create or replace function public.mark_nudges_seen()
returns void language sql security definer set search_path = public as $$
  update public.nudges set seen_at = now() where recipient = auth.uid() and seen_at is null;
$$;

-- ---------- Grants ----------

revoke all on function public.clean_name(text) from public, anon;
revoke all on function public.random_code() from public, anon, authenticated;
revoke all on function public.is_blocked(uuid, uuid) from public, anon, authenticated;
revoke all on function public.are_friends(uuid, uuid) from public, anon, authenticated;
revoke all on function public.share_crew(uuid, uuid) from public, anon, authenticated;
revoke all on function public.can_see(uuid, uuid) from public, anon;
revoke all on function public.in_crew(uuid, uuid) from public, anon;
grant execute on function public.can_see(uuid, uuid) to authenticated;
grant execute on function public.in_crew(uuid, uuid) to authenticated;

do $$
declare
  f text;
begin
  foreach f in array array[
    'save_social_profile(text, text, boolean)',
    'sync_social_stats(integer, integer, integer, date, integer, date[])',
    'add_friend(text)', 'remove_friend(uuid)', 'block_user(uuid)', 'unblock_user(uuid)', 'my_blocks()',
    'report_user(uuid, text, text, uuid)',
    'create_crew(text, date)', 'join_crew(text, date)', 'leave_crew(uuid)', 'crew_overview(uuid, date)',
    'create_challenge(text, integer, date, integer, uuid)', 'decline_challenge(uuid)', 'report_challenge_progress(uuid, integer)',
    'register_push_token(text, boolean, text)', 'unregister_push_token(text)', 'mark_nudges_seen()'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end;
$$;
