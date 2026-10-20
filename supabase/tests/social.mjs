// End-to-end checks for Pulse Squad against a local Supabase (supabase start; supabase functions serve).
// Run: ANON=... SR=... node supabase/tests/social.mjs
const API = 'http://127.0.0.1:54321', ANON = process.env.ANON, SR = process.env.SR;
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? 'PASS' : 'FAIL', m); };
const j = (r) => r.json().catch(() => null);

async function user(tag) {
  const email = `${tag}${Date.now()}@pulse.test`, password = 'Passw0rd!x';
  const u = await j(await fetch(`${API}/auth/v1/admin/users`, { method: 'POST', headers: { apikey: SR, Authorization: `Bearer ${SR}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, email_confirm: true }) }));
  const s = await j(await fetch(`${API}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) }));
  const tok = s.access_token;
  const rpc = async (fn, args = {}) => {
    const r = await fetch(`${API}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
    const body = await j(r);
    return { ok: r.ok, body, error: r.ok ? null : body?.message };
  };
  const get = async (path) => j(await fetch(`${API}/rest/v1/${path}`, { headers: { apikey: ANON, Authorization: `Bearer ${tok}` } }));
  const fn = async (name, body) => {
    const r = await fetch(`${API}/functions/v1/${name}`, { method: 'POST', headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: r.status, body: await j(r) };
  };
  return { id: u.id, rpc, get, fn };
}

const iso = (d) => d.toISOString().slice(0, 10);
const today = new Date();
const day = (n) => { const d = new Date(today); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const monday = (() => { const d = new Date(today); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return iso(d); })();

const a = await user('a'), b = await user('b'), c = await user('c');

// Profiles
let r = await a.rpc('save_social_profile', { p_name: 'Ana', p_color: 'pink' });
ok(!r.ok && r.error === 'rules_not_accepted', 'joining needs the community rules accepted');
r = await a.rpc('save_social_profile', { p_name: 'sh1t head', p_color: 'pink', p_accept_rules: true });
ok(!r.ok && r.error === 'bad_name', 'profanity in names is rejected');
r = await a.rpc('save_social_profile', { p_name: 'visit www.spam.com', p_color: 'pink', p_accept_rules: true });
ok(!r.ok && r.error === 'bad_name', 'links in names are rejected');
r = await a.rpc('save_social_profile', { p_name: '  Ana   Smith ', p_color: 'pink', p_accept_rules: true });
ok(r.ok && r.body.name === 'Ana Smith' && /^[A-Z2-9]{8}$/.test(r.body.invite_code), 'profile created with tidy name and invite code');
const codeA = r.body.invite_code;
ok((await b.rpc('save_social_profile', { p_name: 'Ben', p_color: 'cyan', p_accept_rules: true })).ok, 'second player joins');
ok((await c.rpc('save_social_profile', { p_name: 'Cy', p_color: 'lime', p_accept_rules: true })).ok, 'third player joins');

// Stats
r = await a.rpc('sync_social_stats', { p_xp: 1200, p_level: 4, p_streak: 3, p_week: monday, p_weekly_xp: 300, p_days: [day(-2), day(-1), day(0)] });
ok(r.ok, 'stats sync');
r = await a.rpc('sync_social_stats', { p_xp: 1, p_level: 1, p_streak: 0, p_week: day(-100), p_weekly_xp: 0, p_days: [] });
ok(!r.ok && r.error === 'bad_week', 'a week far from today is rejected');
await b.rpc('sync_social_stats', { p_xp: 800, p_level: 3, p_streak: 1, p_week: monday, p_weekly_xp: 450, p_days: [day(-1), day(0)] });

// Visibility before and after becoming friends
ok((await b.get('social_profiles?select=name')).length === 1, 'strangers can’t see each other');
r = await b.rpc('add_friend', { p_code: 'nope1234' });
ok(!r.ok && r.error === 'code_not_found', 'unknown code rejected');
r = await a.rpc('add_friend', { p_code: codeA });
ok(!r.ok && r.error === 'own_code', 'can’t add yourself');
r = await b.rpc('add_friend', { p_code: codeA.toLowerCase() });
ok(r.ok && r.body.name === 'Ana Smith', 'friend added by invite code (case-insensitive)');
const board = await b.get(`weekly_scores?select=user_id,xp&week=eq.${monday}`);
ok(board.length === 2 && board.some((x) => x.xp === 300) && board.some((x) => x.xp === 450), 'friends see each other on the weekly board');
ok((await c.get('weekly_scores?select=xp')).length === 0, 'outsiders see no scores');
ok((await a.get('activity_days?select=day')).length === 5, 'friends see logged days');

// Crews
r = await a.rpc('create_crew', { p_name: 'Night Owls', p_today: day(-2) });
ok(r.ok && r.body.name === 'Night Owls', 'crew created');
const crew = r.body;
r = await c.rpc('join_crew', { p_code: crew.invite_code, p_today: day(-2) });
ok(r.ok, 'crew joined by code');
r = await c.rpc('crew_overview', { p_crew: crew.id, p_today: day(0) });
ok(r.ok && r.body.length === 2 && r.body[0].crew_streak === 0, 'crew streak 0 while a member hasn’t logged ' + JSON.stringify(r.error ?? ''));
ok((await c.get('social_profiles?select=name')).length === 2, 'crewmates can see each other');
await c.rpc('sync_social_stats', { p_xp: 100, p_level: 1, p_streak: 3, p_week: monday, p_weekly_xp: 50, p_days: [day(-2), day(-1)] });
r = await c.rpc('crew_overview', { p_crew: crew.id, p_today: day(0) });
ok(r.ok && r.body[0].crew_streak === 2, `crew streak counts days everyone logged (today pending): ${r.body?.[0]?.crew_streak}`);
await c.rpc('sync_social_stats', { p_xp: 110, p_level: 1, p_streak: 3, p_week: monday, p_weekly_xp: 60, p_days: [day(0)] });
r = await c.rpc('crew_overview', { p_crew: crew.id, p_today: day(0) });
ok(r.ok && r.body[0].crew_streak === 3 && r.body.every((m) => m.logged_today), 'crew streak includes today once everyone logged');
r = await b.rpc('crew_overview', { p_crew: crew.id, p_today: day(0) });
ok(!r.ok && r.error === 'not_member', 'non-members can’t read a crew');

// Challenges
r = await a.rpc('create_challenge', { p_template: 'protein', p_target: 5, p_starts: day(0), p_days: 7, p_opponent: c.id });
ok(!r.ok && r.error === 'not_friends', 'duels only with friends');
r = await a.rpc('create_challenge', { p_template: 'protein', p_target: 5, p_starts: day(0), p_days: 7, p_opponent: b.id });
ok(r.ok, 'duel created');
const duel = r.body;
ok((await b.get(`challenges?id=eq.${duel.id}&select=id`)).length === 1, 'opponent sees the duel');
ok((await c.get(`challenges?id=eq.${duel.id}&select=id`)).length === 0, 'others don’t');
ok((await b.rpc('report_challenge_progress', { p_id: duel.id, p_progress: 9 })).ok, 'progress reported');
let prog = await a.get(`challenge_progress?challenge_id=eq.${duel.id}&select=user_id,progress,completed_at`);
const bp = prog.find((p) => p.user_id === b.id);
ok(bp.progress === 5 && bp.completed_at, 'progress is capped at the target and completion stamped');
await b.rpc('report_challenge_progress', { p_id: duel.id, p_progress: 2 });
prog = await a.get(`challenge_progress?challenge_id=eq.${duel.id}&user_id=eq.${b.id}&select=progress`);
ok(prog[0].progress === 5, 'progress never goes down');
ok(!(await c.rpc('report_challenge_progress', { p_id: duel.id, p_progress: 3 })).ok, 'outsiders can’t report progress');
r = await c.rpc('create_challenge', { p_template: 'water', p_target: 3, p_starts: day(0), p_days: 3 });
ok(r.ok && r.body.opponent === null, 'solo challenge');

// Nudges (needs `supabase functions serve`)
r = await b.fn('nudge', { to: a.id, day: day(0) });
ok(r.status === 200 && r.body.ok, `nudge sent (${r.status})`);
r = await b.fn('nudge', { to: a.id, day: day(0) });
ok(r.status === 409, 'one nudge per friend per day');
r = await c.fn('nudge', { to: b.id, day: day(0) });
ok(r.status === 403, 'can’t nudge strangers');
ok((await a.get('nudges?select=sender,seen_at')).length === 1, 'recipient sees the nudge');
await a.rpc('mark_nudges_seen');
ok((await a.get('nudges?select=seen_at'))[0].seen_at, 'nudges marked seen');
ok((await a.rpc('register_push_token', { p_token: 'ab'.repeat(32), p_sandbox: true, p_lang: 'es' })).ok, 'push token registered');
ok(!(await a.rpc('register_push_token', { p_token: 'not a token', p_sandbox: true, p_lang: 'es' })).ok, 'malformed token rejected');
ok((await a.get('push_tokens?select=token')).length === 0, 'push tokens aren’t readable by clients');

// Report and block
ok((await a.rpc('report_user', { p_other: c.id, p_reason: 'name', p_details: 'rude name' })).ok, 'report filed');
ok((await a.get('reports?select=id')).length === 0, 'reports aren’t readable by clients');
ok((await a.rpc('block_user', { p_other: b.id })).ok, 'block');
ok((await a.get('friendships?select=user_a')).length === 0, 'block ends the friendship');
ok((await b.get('social_profiles?select=user_id')).length === 1, 'blocked player can’t see the blocker');
r = await b.rpc('add_friend', { p_code: codeA });
ok(!r.ok && r.error === 'code_not_found', 'blocked player can’t re-add with the code');
r = await b.fn('nudge', { to: a.id, day: day(1) });
ok(r.status === 403, 'blocked player can’t nudge');
const declined = await a.get(`challenges?id=eq.${duel.id}&select=declined_at`);
ok(declined[0].declined_at, 'block calls off open duels');
await b.rpc('join_crew', { p_code: crew.invite_code, p_today: day(0) });
r = await a.rpc('crew_overview', { p_crew: crew.id, p_today: day(0) });
const hidden = r.body.find((m) => m.user_id === b.id);
ok(hidden.hidden && hidden.name === null, 'blocked crewmate shows without a name');
ok((await b.get(`social_profiles?user_id=eq.${a.id}&select=name`)).length === 0, 'block wins over a shared crew');
r = await a.rpc('my_blocks');
ok(r.ok && r.body.length === 1 && r.body[0].name === 'Ben', 'blocked list for unblocking');
ok((await a.rpc('unblock_user', { p_other: b.id })).ok, 'unblock');

// Leaving and deleting
ok((await c.rpc('leave_crew', { p_crew: crew.id })).ok, 'leave crew');
ok((await c.get(`crews?id=eq.${crew.id}&select=id`)).length === 0, 'left crew is no longer visible');
const del = await c.fn('delete-account', {});
ok(del.status === 200, 'delete account');
const left = await j(await fetch(`${API}/rest/v1/social_profiles?user_id=eq.${c.id}&select=user_id`, { headers: { apikey: SR, Authorization: `Bearer ${SR}` } }));
ok(left.length === 0, 'deleting the account removes the social card');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
