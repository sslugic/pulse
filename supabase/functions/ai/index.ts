// AI proxy: the app sends its Gemini request here instead of to Google. The server holds the
// Gemini key, charges the feature's price in credits first, forwards the call (streaming or not),
// and refunds the charge if Gemini fails before answering.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

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
  // A retry of the same request isn't charged again; note that so usage stats don't count it twice.
  const { count: already } = await db.from('credit_ledger').select('id', { count: 'exact', head: true }).eq('ref', ref);
  const charged = already ? 0 : cost;

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
    console.error('gemini error', JSON.stringify({ status: upstream.status, feature, model, body: body.slice(0, 1000) }));
    // Request problems (400/404) go back as-is so the app can adapt (e.g. retry without thinking).
    // Anything on Google's side (billing or quota exhausted, auth, outages) is our problem, not the
    // player's: report it as AI unavailable so the app never mistakes it for an empty credit balance.
    if (upstream.status === 400 || upstream.status === 404) {
      return new Response(body, { status: upstream.status, headers: { ...cors, 'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json' } });
    }
    // `message` is what older app builds show for an unknown error.
    const message = 'Pulse AI is temporarily unavailable. You weren’t charged. Try again a bit later.';
    return json({ error: { code: 'ai_unavailable', message }, upstream: upstream.status, retryable: upstream.status === 429 || upstream.status >= 500 }, 503);
  }
  // Pass the answer through untouched while keeping a copy; once it has all been sent, log the token
  // usage from it. Doing it at the end of the stream keeps the request alive until the log is written.
  const decoder = new TextDecoder();
  let seen = '';
  const meter = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, out) {
      seen += decoder.decode(chunk, { stream: true });
      out.enqueue(chunk);
    },
    async flush() {
      await logUsage(db, { userId: user.id, feature, model, requestId, credits: charged }, seen).catch((e) => console.error('usage log failed', e));
    },
  });
  return new Response(upstream.body?.pipeThrough(meter) ?? null, {
    status: 200,
    headers: { ...cors, 'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json', 'x-credits-balance': balance, 'x-credits-cost': String(cost) },
  });
});

// ---------- Token usage ----------

type Usage = {
  promptTokenCount?: number;
  cachedContentTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
  candidatesTokensDetails?: { modality?: string; tokenCount?: number }[];
};

/**
 * USD per 1M tokens, by model prefix: [input, cached input, text output, audio output]. Estimates for
 * reporting only (credits are what users pay); update when Google's prices change.
 * gemini-3.8-flash and its TTS double on 2027-01-01.
 */
function priceFor(model: string, at = new Date()): [number, number, number, number] {
  const y27 = at >= new Date('2027-01-01T00:00:00Z') ? 2 : 1;
  if (model.startsWith('gemini-3.8-flash-lite-tts')) return [0.5 * y27, 0.5 * y27, 0, 6 * y27];
  if (model.includes('tts')) return [0.5 * y27, 0.5 * y27, 0, 9 * y27];
  if (model.startsWith('gemini-3.5-flash-lite')) return [0.3, 0.03, 2.5, 2.5];
  if (model.startsWith('gemini-3.8-flash')) return [0.75 * y27, 0.075 * y27, 3.75 * y27, 3.75 * y27];
  return [0.75, 0.075, 3.75, 3.75];
}

/** Takes the final usageMetadata from a (possibly streamed) Gemini response and stores it. */
async function logUsage(db: SupabaseClient, meta: { userId: string; feature: string; model: string; requestId: string; credits: number }, text: string) {
  let usage: Usage | undefined;
  // Streamed (SSE): each "data:" line is a JSON chunk and the last one carries the totals.
  // Non-streamed: the whole body is one JSON object.
  let whole: unknown = null;
  try {
    whole = JSON.parse(text);
  } catch {
    // not a single JSON object, so it's a stream
  }
  const chunks = whole ? [text] : text.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5));
  for (const c of chunks) {
    try {
      const u = JSON.parse(c)?.usageMetadata;
      if (u) usage = u;
    } catch {
      // skip a chunk that isn't JSON
    }
  }
  if (!usage) return;
  const prompt = usage.promptTokenCount ?? 0;
  const cached = usage.cachedContentTokenCount ?? 0;
  const output = usage.candidatesTokenCount ?? 0;
  const thoughts = usage.thoughtsTokenCount ?? 0;
  const audioOut = usage.candidatesTokensDetails?.filter((d) => d.modality === 'AUDIO').reduce((n, d) => n + (d.tokenCount ?? 0), 0) ?? 0;
  const [pin, pcached, pout, paudio] = priceFor(meta.model);
  const cost = ((prompt - cached) * pin + cached * pcached + (output - audioOut + thoughts) * pout + audioOut * paudio) / 1e6;
  const { error } = await db.from('ai_usage').insert({
    user_id: meta.userId,
    feature: meta.feature,
    model: meta.model,
    request_id: meta.requestId,
    credits: meta.credits,
    prompt_tokens: prompt,
    cached_tokens: cached,
    output_tokens: output,
    thoughts_tokens: thoughts,
    audio_out_tokens: audioOut,
    cost_usd: Math.round(cost * 1e6) / 1e6,
  });
  if (error) console.error('usage insert failed', error.message);
}
