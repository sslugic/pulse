// Referrals, XP-for-credits and the new challenge types, against a local Supabase (supabase start).
// Run: ANON=... SR=... node supabase/tests/rewards.mjs   (ages accounts with `docker exec` into the db)
import { execFileSync } from 'node:child_process';

const API = 'http://127.0.0.1:54321', ANON = process.env.ANON, SR = process.env.SR;
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? 'PASS' : 'FAIL', m); };
const j = (r) => r.json().catch(() => null);
const sql = (q) => execFileSync('docker', ['exec', '-i', 'supabase_db_pulse', 'psql', '-U', 'postgres', '-At', '-c', q]).toString().trim();

async function user(tag) {
  const email = `${tag}${Date.now()}@pulse.test`, password = 'Passw0rd!x';
  const u = await j(await fetch(`${API}/auth/v1/admin/users`, { method: 'POST', headers: { apikey: SR, Authorization: `Bearer ${SR}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, email_confirm: true }) }));
  const tok = (await j(await fetch(`${API}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) }))).access_token;
  const rpc = async (fn, args = {}) => {
    const r = await fetch(`${API}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
    const body = await j(r);
    return { ok: r.ok, body, error: r.ok ? null : body?.message };
  };
  return { id: u.id, rpc };
}
const age = (id, days) => sql(`update auth.users set created_at = now() - interval '${days} days' where id = '${id}'`);

const a = await user('ref-a'), b = await user('ref-b'), c = await user('ref-c');

// Referrals
let r = await a.rpc('my_referrals');
const code = r.body?.[0]?.code;
ok(r.ok && /^[A-Z2-9]{8}$/.test(code) && r.body[0].referred === 0 && r.body[0].can_claim === true, 'new account has a referral code and can still claim one');
r = await a.rpc('claim_referral', { p_code: code });
ok(!r.ok && r.error === 'own_code', 'can’t refer yourself');
r = await b.rpc('claim_referral', { p_code: 'NOPE2345' });
ok(!r.ok && r.error === 'code_not_found', 'unknown code rejected');
r = await b.rpc('claim_referral', { p_code: code.toLowerCase() });
ok(r.ok && r.body === 75, `new player gets 25 on top of the 50 sign-up credits (${r.body})`);
ok((await a.rpc('my_balance')).body === 75, 'referrer gets 25');
r = await b.rpc('claim_referral', { p_code: code });
ok(!r.ok && r.error === 'referral_used', 'only one referral per account');
const bCode = (await b.rpc('my_referrals')).body[0].code;
r = await a.rpc('claim_referral', { p_code: bCode });
ok(!r.ok && r.error === 'code_not_found', 'two accounts can’t refer each other');
age(c.id, 20);
r = await c.rpc('claim_referral', { p_code: code });
ok(!r.ok && r.error === 'referral_too_late', 'referral only within 14 days of signing up');
r = await a.rpc('my_referrals');
ok(r.body[0].referred === 1 && r.body[0].credits_earned === 25, 'referral stats');
// Referrer cap: 10 paid referrals per 30 days.
for (let i = 0; i < 11; i++) await (await user(`ref-n${i}`)).rpc('claim_referral', { p_code: code });
r = await a.rpc('my_referrals');
ok(r.body[0].referred === 12 && r.body[0].credits_earned === 250, `referrer earns from at most 10 referrals a month (${r.body[0].credits_earned})`);

// XP for credits
r = await b.rpc('redeem_xp', { p_total_xp: 5000 });
ok(!r.ok && r.error === 'xp_too_new', 'accounts under a week old can’t trade XP');
age(b.id, 8);
r = await b.rpc('redeem_xp', { p_total_xp: 900 });
ok(!r.ok && r.error === 'xp_not_enough', 'needs 1,000 XP');
r = await b.rpc('redeem_xp', { p_total_xp: 2500 });
ok(r.ok && r.body === 85, `1,000 XP → 10 credits (${r.body})`);
r = await b.rpc('redeem_xp', { p_total_xp: 2500 });
ok(r.ok && r.body === 95, 'second trade the same week');
r = await b.rpc('xp_trade_status');
ok(r.body[0].xp_spent === 2000 && r.body[0].credits_this_week === 20 && r.body[0].eligible, 'trade status');
r = await b.rpc('redeem_xp', { p_total_xp: 9000 });
ok(!r.ok && r.error === 'xp_weekly_cap', 'at most 20 credits a week');
sql(`update credit_ledger set created_at = now() - interval '8 days' where user_id = '${b.id}' and reason = 'xp_redeem'`);
r = await b.rpc('redeem_xp', { p_total_xp: 2500 });
ok(!r.ok && r.error === 'xp_not_enough', 'XP already traded can’t be traded again');
r = await b.rpc('redeem_xp', { p_total_xp: 3000 });
ok(r.ok && r.body === 105, 'a new week, more XP earned: trade again');
const g = await b.rpc('grant_credits', { uid: b.id, amount: 1000, why: 'xp_redeem', ref_key: 'hack' });
ok(!g.ok, 'clients still can’t grant credits directly');

// New challenge types
await b.rpc('save_social_profile', { p_name: 'Bee', p_color: 'pink', p_accept_rules: true });
const today = new Date().toISOString().slice(0, 10);
r = await b.rpc('create_challenge', { p_template: 'active', p_target: 210, p_starts: today, p_days: 7, p_hard: true });
ok(r.ok && r.body.hard === true && r.body.target === 210, 'cumulative hard challenge (active minutes)');
r = await b.rpc('create_challenge', { p_template: 'perfect', p_target: 2, p_starts: today, p_days: 7 });
ok(r.ok && r.body.hard === false, 'perfect-day challenge');
r = await b.rpc('create_challenge', { p_template: 'nope', p_target: 2, p_starts: today, p_days: 7 });
ok(!r.ok, 'unknown template rejected');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
