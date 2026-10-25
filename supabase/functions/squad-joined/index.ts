// Tells players someone just joined them in the Squad: the friend whose invite was used, or the rest
// of the crew that was joined. Called by the new member's app right after add_friend / join_crew. It
// only announces a friendship or crew membership the caller made in the last 10 minutes, so it can't
// be used to spam anyone. Delivery is best effort: without push set up nothing is sent.
import { pushToApple } from '../_shared/apns.ts';
import { admin, callerOf, cors, json } from '../_shared/common.ts';

type Msg = { title: string; body: string };
const FRIEND: Record<string, (name: string) => Msg> = {
  en: (n) => ({ title: `🤝 ${n} joined your Squad`, body: 'You’re on each other’s board now. Time to set the pace!' }),
  es: (n) => ({ title: `🤝 ${n} se unió a tu Squad`, body: 'Ya estáis en la tabla del otro. ¡A marcar el ritmo!' }),
  de: (n) => ({ title: `🤝 ${n} ist deiner Squad beigetreten`, body: 'Ihr steht jetzt auf der Rangliste des anderen. Zeig, wo’s langgeht!' }),
  fr: (n) => ({ title: `🤝 ${n} a rejoint ta Squad`, body: 'Vous êtes dans le classement l’un de l’autre. À toi de donner le rythme !' }),
  it: (n) => ({ title: `🤝 ${n} è entrato nella tua Squad`, body: 'Ora siete l’uno nella classifica dell’altro. Detta il ritmo!' }),
  pt: (n) => ({ title: `🤝 ${n} entrou no seu Squad`, body: 'Agora vocês estão no ranking um do outro. Hora de ditar o ritmo!' }),
};
const CREW: Record<string, (name: string, crew: string) => Msg> = {
  en: (n, c) => ({ title: `🔥 ${n} joined ${c}`, body: 'One more on the crew streak. Make them feel welcome!' }),
  es: (n, c) => ({ title: `🔥 ${n} se unió a ${c}`, body: 'Uno más en la racha del equipo. ¡Dale la bienvenida!' }),
  de: (n, c) => ({ title: `🔥 ${n} ist ${c} beigetreten`, body: 'Einer mehr für die Crew-Serie. Heiß ihn willkommen!' }),
  fr: (n, c) => ({ title: `🔥 ${n} a rejoint ${c}`, body: 'Un de plus sur la série de l’équipe. Souhaite-lui la bienvenue !' }),
  it: (n, c) => ({ title: `🔥 ${n} è entrato in ${c}`, body: 'Uno in più nella serie della squadra. Dagli il benvenuto!' }),
  pt: (n, c) => ({ title: `🔥 ${n} entrou na ${c}`, body: 'Mais um na sequência da equipe. Dê as boas-vindas!' }),
};

const RECENT_MS = 10 * 60 * 1000;
const UUID = /^[0-9a-f-]{36}$/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const db = admin();
  const user = await callerOf(req, db);
  if (!user) return json({ error: 'unauthorized' }, 401);

  const body = (await req.json().catch(() => ({}))) as { kind?: string; to?: string; crew?: string };
  const since = new Date(Date.now() - RECENT_MS).toISOString();
  const { data: me } = await db.from('social_profiles').select('name').eq('user_id', user.id).maybeSingle();
  const name = me?.name ?? 'A friend';

  let recipients: string[] = [];
  let message: (lang: string) => Msg;
  if (body.kind === 'friend' && body.to && UUID.test(body.to) && body.to !== user.id) {
    const [a, b] = [user.id, body.to].sort();
    const { data: f } = await db.from('friendships').select('created_at').eq('user_a', a).eq('user_b', b).gte('created_at', since).maybeSingle();
    if (!f) return json({ error: 'not_recent' }, 403);
    recipients = [body.to];
    message = (lang) => (FRIEND[lang] ?? FRIEND.en)(name);
  } else if (body.kind === 'crew' && body.crew && UUID.test(body.crew)) {
    const { data: m } = await db.from('crew_members').select('joined_at').eq('crew_id', body.crew).eq('user_id', user.id).gte('joined_at', since).maybeSingle();
    if (!m) return json({ error: 'not_recent' }, 403);
    const { data: crew } = await db.from('crews').select('name').eq('id', body.crew).maybeSingle();
    const { data: others } = await db.from('crew_members').select('user_id').eq('crew_id', body.crew).neq('user_id', user.id);
    recipients = (others ?? []).map((o) => o.user_id);
    message = (lang) => (CREW[lang] ?? CREW.en)(name, crew?.name ?? 'your crew');
  } else {
    return json({ error: 'bad_request' }, 400);
  }

  if (!recipients.length) return json({ ok: true, delivered: 0 });
  const { data: tokens } = await db.from('push_tokens').select('token, sandbox, lang').in('user_id', recipients);
  let delivered = 0;
  for (const t of tokens ?? []) {
    const status = await pushToApple(t.token, t.sandbox, { aps: { alert: message(t.lang), sound: 'default' }, body: { kind: 'squad' } });
    if (status === 200) delivered++;
    // 410: the app was removed or push turned off for good; forget the token.
    if (status === 410) await db.from('push_tokens').delete().eq('token', t.token);
  }
  return json({ ok: true, delivered });
});
