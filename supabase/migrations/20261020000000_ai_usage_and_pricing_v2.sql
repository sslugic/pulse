-- Token usage per AI request, so credit prices can be checked against what Gemini actually costs
-- (docs/CREDIT-ECONOMICS.md). Written by the `ai` edge function with the service role; not readable
-- by users.
create table public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  feature text not null,
  model text not null,
  request_id text not null,
  credits integer not null default 0,
  prompt_tokens integer not null default 0,
  cached_tokens integer not null default 0,
  output_tokens integer not null default 0,
  thoughts_tokens integer not null default 0,
  audio_out_tokens integer not null default 0,
  cost_usd numeric(12, 6) not null default 0,
  created_at timestamptz not null default now()
);

create index ai_usage_created_idx on public.ai_usage (created_at desc);
create index ai_usage_feature_idx on public.ai_usage (feature, created_at desc);

alter table public.ai_usage enable row level security;

-- Cost per credit by feature and day. "cost_per_credit" is the number to watch: keep it under 40% of
-- the revenue we keep per credit (about $0.0117 on Pro, $0.0117 on the 1,500 pack after Apple's 30%).
create view public.ai_usage_daily
with (security_invoker = true) as
select
  date_trunc('day', created_at)::date as day,
  feature,
  model,
  count(*) as calls,
  sum(credits) as credits,
  round(avg(prompt_tokens)) as avg_prompt,
  round(avg(cached_tokens)) as avg_cached,
  round(avg(output_tokens + thoughts_tokens)) as avg_output,
  sum(cost_usd) as cost_usd,
  case when sum(credits) > 0 then round(sum(cost_usd) / sum(credits), 5) end as cost_per_credit
from public.ai_usage
group by 1, 2, 3;

revoke all on public.ai_usage_daily from anon, authenticated;

-- New credit prices: plans run on Flash-Lite and are priced by length; recaps are cheaper.
update public.feature_costs set credits = 1, description = 'One day''s meal plan' where feature = 'meal_plan';
update public.feature_costs set credits = 1, description = 'One day''s workout plan' where feature = 'workout_plan';
update public.feature_costs set credits = 1 where feature = 'recap';
insert into public.feature_costs (feature, credits, description) values
  ('meal_plan_3d', 2, '3-day meal plan'),
  ('workout_plan_3d', 2, '3-day workout plan'),
  ('workout_plan_7d', 4, '7-day workout plan')
on conflict (feature) do update set credits = excluded.credits, description = excluded.description;

-- Pulse Pro: 600 credits a month (was 1,000). The 1,500 pack keeps its size; its App Store price goes to $24.99.
update public.products set credits = 600, label = 'Pulse Pro: 600 credits every month' where product_id = 'pulse_pro_monthly';
