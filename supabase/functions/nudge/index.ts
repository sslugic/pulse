// Sends a friendly "your streak is on the line" nudge from one player to a friend or crewmate:
// records it (once per pair per day) and pushes it to the recipient's iPhones through Apple's push
// service. The nudge still shows in the app if push isn't set up or the recipient turned it off.
//
// Push secrets (set with `supabase secrets set`): APNS_KEY_ID, APNS_TEAM_ID, APNS_PRIVATE_KEY (the
// .p8 file's contents) and APNS_TOPIC (the app's bundle identifier).
import { pushToApple } from '../_shared/apns.ts';
import { admin, callerOf, cors, json } from '../_shared/common.ts';

const BODY: Record<string, (name: string) => { title: string; body: string }> = {
  en: (n) => ({ title: `👊 ${n} nudged you`, body: 'Your streak is on the line. Log anything to keep it alive!' }),
  es: (n) => ({ title: `👊 ${n} te dio un toque`, body: 'Tu racha está en juego. ¡Registra algo para mantenerla!' }),
  de: (n) => ({ title: `👊 ${n} hat dich angestupst`, body: 'Deine Serie steht auf dem Spiel. Trag irgendwas ein, um sie zu retten!' }),
  fr: (n) => ({ title: `👊 ${n} t’a donné un coup de coude`, body: 'Ta série est en jeu. Note quelque chose pour la garder !' }),
  it: (n) => ({ title: `👊 ${n} ti ha dato una spinta`, body: 'La tua serie è a rischio. Registra qualcosa per salvarla!' }),
  pt: (n) => ({ title: `👊 ${n} te cutucou`, body: 'Sua sequência está em jogo. Registre algo para mantê-la!' }),
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const db = admin();
  const user = await callerOf(req, db);
  if (!user) return json({ error: 'unauthorized' }, 401);

  const { to, day } = (await req.json().catch(() => ({}))) as { to?: string; day?: string };
  if (!to || typeof to !== 'string' || !day || !DAY.test(day) || to === user.id) return json({ error: 'bad_request' }, 400);

  const { data: allowed } = await db.rpc('can_see', { viewer: user.id, target: to });
  if (!allowed) return json({ error: 'not_friends' }, 403);

  const { error: insertError } = await db.from('nudges').insert({ sender: user.id, recipient: to, day });
  if (insertError) {
    if (insertError.code === '23505') return json({ error: 'already_nudged' }, 409);
    return json({ error: insertError.message }, 500);
  }

  const { data: me } = await db.from('social_profiles').select('name').eq('user_id', user.id).maybeSingle();
  const { data: tokens } = await db.from('push_tokens').select('token, sandbox, lang').eq('user_id', to);
  let delivered = 0;
  for (const t of tokens ?? []) {
    const msg = (BODY[t.lang] ?? BODY.en)(me?.name ?? 'A friend');
    const status = await pushToApple(t.token, t.sandbox, { aps: { alert: msg, sound: 'default' }, body: { kind: 'nudge' } });
    if (status === 200) delivered++;
    // 410: the app was removed or push turned off for good; forget the token.
    if (status === 410) await db.from('push_tokens').delete().eq('token', t.token);
  }
  return json({ ok: true, delivered });
});
