// AI proxy: the app sends its Gemini request here instead of to Google. The server holds the
// Gemini key, charges the feature's price in credits first, forwards the call (streaming or not),
// and refunds the charge if Gemini fails before answering.
import { admin, callerOf, cors, json } from '../_shared/common.ts';

const GEMINI = Deno.env.get('GEMINI_BASE_URL') ?? 'https://generativelanguage.googleapis.com/v1beta';
const METHODS = new Set(['generateContent', 'streamGenerateContent']);
const MODEL = /^gemini-[a-z0-9.-]+$/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const db = admin();
  const user = await callerOf(req, db);
  if (!user) return json({ error: 'unauthorized' }, 401);

  let input: { feature?: string; model?: string; method?: string; requestId?: string; payload?: unknown };
  try {
    input = await req.json();
  } catch {
    return json({ error: 'bad_json' }, 400);
  }
  const { feature, model, method, requestId, payload } = input;
  if (!feature || !model || !MODEL.test(model) || !method || !METHODS.has(method) || !requestId || typeof payload !== 'object') {
    return json({ error: 'bad_request' }, 400);
  }

  const { data: price } = await db.from('feature_costs').select('credits').eq('feature', feature).maybeSingle();
  if (!price) return json({ error: 'unknown_feature' }, 400);
  const cost: number = price.credits;
  const ref = `ai:${user.id}:${requestId}`;

  const spent = await db.rpc('spend_credits', { uid: user.id, amount: cost, ref_key: ref, info: { feature, model } });
  if (spent.error) {
    if (spent.error.message.includes('insufficient_credits')) {
      const { data: balance } = await db.rpc('credit_balance', { uid: user.id });
      return json({ error: 'insufficient_credits', balance, cost }, 402);
    }
    console.error('spend failed', spent.error);
    return json({ error: 'billing_failed' }, 500);
  }
  const balance = String(spent.data);

  const refund = () =>
    cost > 0 ? db.rpc('grant_credits', { uid: user.id, amount: cost, why: 'refund', ref_key: `refund:${ref}`, info: { feature, model } }) : Promise.resolve();

  let upstream: Response;
  try {
    upstream = await fetch(`${GEMINI}/models/${model}:${method}${method === 'streamGenerateContent' ? '?alt=sse' : ''}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': Deno.env.get('GEMINI_API_KEY') ?? '' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    await refund();
    console.error('gemini unreachable', err);
    return json({ error: 'upstream_unreachable' }, 502);
  }
  if (!upstream.ok) {
    await refund();
    const body = await upstream.text();
    return new Response(body, { status: upstream.status, headers: { ...cors, 'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json' } });
  }
  return new Response(upstream.body, {
    status: 200,
    headers: { ...cors, 'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json', 'x-credits-balance': balance, 'x-credits-cost': String(cost) },
  });
});
